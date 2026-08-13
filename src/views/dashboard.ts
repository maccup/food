import { esc, pl, hhmmToMinutes as toMinutes, minutyNaHhmm as hhmm } from './ui';
import { stanMakro } from '../utils/day-status';
import { zdanieBilansu, zdanieMasy } from '../utils/watch';

export interface DashboardData {
  date: string;
  isToday: boolean;
  nowMinutes: number | null;
  phaseName: string | null;
  phaseEnd: string | null;
  daysLeft: number | null;
  totals: any | null;
  targets: Map<string, { min_value: number | null; max_value: number | null }>;
  sittingTimes: Record<number, string>;
  mealsBySitting: Map<number, { total: number; eaten: number }>;
  supplementsTotal: number;
  supplementsTaken: number;
  nextSupplement: { time: string; name: string } | null;
  overdueSupplements: number;
  forbiddenToday: Array<{ food_name: string; meal_name: string }>;
  /** Odchylenia, które malują dzień w kalendarzu na żółto, gotowymi zdaniami. */
  warnToday: string[];
  /** Koniec ostatniego liczącego się podejścia dziś, w minutach od północy. */
  lastBiteMinutes: number | null;
  nextDeliveryGap: { from: string; days: number } | null;
  minGapHours: number;
  /**
   * Bilans kalorii z ostatnich dni ZAMKNIETYCH, nigdy z dzisiejszego.
   * Przemiana podstawowa narasta do polnocy, wiec dzis kazdy dzien wyglada na
   * gigantyczna nadwyzke az do wieczora i taka liczba uczylaby ignorowac panel.
   */
  bilansOkna: { srednia: number; dni: number; kgTydzien: number; ostatni: number | null } | null;
  /** Metryki zegarka poza wlasna norma, zdaniami. Puste, gdy wszystko typowe. */
  zegarekPozaNorma: string[];
  /**
   * Zegarek do tylu o wiecej niz dobe. Null, gdy dane sa swieze.
   * Awaria synchronizacji objawia sie cisza, nie bledem, wiec musi byc widoczna.
   */
  zegarekOpoznienie: { dni: number; ostatni: string } | null;
}

/**
 * Panel kontrolny. Ma odpowiadać na trzy pytania w trzy sekundy:
 * gdzie jestem w protokole, co mam zrobić najbliżej, czy coś poszło nie tak.
 * Liczby szczegółowe są niżej, na stronie dnia.
 */
export function dashboard(d: DashboardData): string {
  const macros = [
    { key: 'kcal', label: 'kcal', digits: 0 },
    { key: 'protein_g', label: 'białko', digits: 0 },
    { key: 'fat_g', label: 'tłuszcz', digits: 0 },
    { key: 'carbs_g', label: 'węgle', digits: 0 },
    { key: 'fiber_g', label: 'błonnik', digits: 0 },
  ];

  const macroTiles = macros.map((m) => {
    const value = d.totals ? Number(d.totals[m.key]) : 0;
    const st = d.totals ? stanMakro(value, d.targets.get(m.key)) : 'none';
    const color = st === 'bad' ? 'var(--bad)' : st === 'warn' ? 'var(--warn)' : st === 'ok' ? 'var(--ok)' : 'var(--muted)';
    return `<div class="tile">
      <div class="tile-value" style="color:${color}">${d.totals ? pl(value, m.digits) : '–'}</div>
      <div class="tile-label">${m.label}</div>
    </div>`;
  }).join('');

  // Najblizsze okno jedzenia i to, czy przerwa od poprzedniego jest wystarczajaca.
  let nextWindow = '';
  if (d.isToday && d.nowMinutes !== null) {
    const entries = [1, 2, 3].map((s) => ({ s, t: d.sittingTimes[s], m: toMinutes(d.sittingTimes[s]) }));
    const upcoming = entries.find((e) => e.m > d.nowMinutes!);
    const current = [...entries].reverse().find((e) => e.m <= d.nowMinutes!);

    /*
     * Wiersz odpowiada na pytanie „za ile moge zjesc", a nie „kiedy wypada okno".
     * Wczesniej pokazywal wylacznie godzine z ustawien, wiec przy zjedzonym
     * pozno sniadaniu mowil, ze pora na obiad, choc przerwa jeszcze nie minela.
     * Wiaze pozniejsza z dwoch godzin i zawsze pisze, ktora wygrala.
     */
    const najwczesniej =
      d.lastBiteMinutes === null ? null : d.lastBiteMinutes + d.minGapHours * 60;

    if (upcoming || (najwczesniej !== null && najwczesniej > d.nowMinutes)) {
      const oknoMin = upcoming ? upcoming.m : null;
      const kiedy = Math.max(oknoMin ?? -1, najwczesniej ?? -1);
      const decydujePrzerwa = najwczesniej !== null && najwczesniej >= (oknoMin ?? -1);

      const mins = Math.max(0, kiedy - d.nowMinutes);
      const h = Math.floor(mins / 60);
      const rest = mins % 60;
      const eaten = upcoming ? d.mealsBySitting.get(upcoming.s) : undefined;

      const powod =
        najwczesniej === null
          ? 'okno z ustawień, dziś jeszcze nic nie zjedzone'
          : decydujePrzerwa
            ? `przerwa ${d.minGapHours} h od ostatniego kęsa o ${hhmm(d.lastBiteMinutes!)}${
                oknoMin !== null ? `, okno z ustawień to ${hhmm(oknoMin)}` : ''
              }`
            : `okno z ustawień, przerwa ${d.minGapHours} h minie już o ${hhmm(najwczesniej)}`;

      nextWindow = `<div class="panel-row">
        <div>
          <div class="panel-row-label">Możesz zjeść</div>
          <div class="panel-row-main">${hhmm(kiedy)}, ${mins === 0 ? 'już teraz' : `za ${h ? `${h} h ` : ''}${rest} min`}</div>
          <div class="panel-row-why">${esc(powod)}</div>
        </div>
        <div class="panel-row-side">${eaten ? `${eaten.total} pudełka` : 'brak pudełek'}</div>
      </div>`;
    } else if (current) {
      nextWindow = `<div class="panel-row">
        <div>
          <div class="panel-row-label">Ostatnie podejście</div>
          <div class="panel-row-main">${esc(current.t)}, minęło</div>
        </div>
        <div class="panel-row-side">przerwa nocna</div>
      </div>`;
    }
  }

  const suppLine = d.supplementsTotal
    ? `<div class="panel-row">
        <div>
          <div class="panel-row-label">Suplementy</div>
          <div class="panel-row-main">${d.supplementsTaken} z ${d.supplementsTotal} wzięte</div>
        </div>
        <div class="panel-row-side">${d.overdueSupplements
          ? `<span style="color:var(--warn);font-weight:600">${d.overdueSupplements} zaległe</span>`
          : d.nextSupplement
            ? `${esc(d.nextSupplement.time)} ${esc(d.nextSupplement.name)}`
            : 'komplet'}</div>
      </div>`
    : '';

  const phaseLine = d.phaseName
    ? `<div class="panel-row">
        <div>
          <div class="panel-row-label">Faza</div>
          <div class="panel-row-main">${esc(d.phaseName)}</div>
        </div>
        <div class="panel-row-side">${d.daysLeft !== null ? `zostało ${d.daysLeft} dni` : 'bez końca'}</div>
      </div>`
    : '';

  /*
   * Karta pokazuje oba powody, dla ktorych kalendarz koloruje dzien, a nie sam
   * czerwony. Wczesniej byl tu wylacznie pasek zakazanych skladnikow, wiec dzien
   * zolty z powodu tluszczu albo blonnika wygladal w karcie na czysty i trzeba
   * bylo zgadywac, o co kalendarzowi chodzi.
   */
  const alerts = [
    d.forbiddenToday.length
      ? `<div class="panel-alert">
          <b>${d.forbiddenToday.length === 1 ? 'Zakazany składnik' : `Zakazane składniki: ${d.forbiddenToday.length}`}</b>
          <div style="margin-top:3px">${d.forbiddenToday.slice(0, 4).map((f) => esc(f.food_name)).join(', ')}</div>
        </div>`
      : '',
    d.warnToday.length
      ? `<div class="panel-alert warn">
          <b>Poza pasmem fazy: ${d.warnToday.length}</b>
          <div style="margin-top:3px">${d.warnToday.map(esc).join('<br>')}</div>
        </div>`
      : '',
    // Zegarek na koncu, bo mowi o organizmie, a nie o tym, co zostalo zjedzone,
    // wiec nie jest odchyleniem od protokolu i nie maluje dnia w kalendarzu.
    d.zegarekPozaNorma.length
      ? `<div class="panel-alert warn">
          <b>Zegarek poza Twoją normą: ${d.zegarekPozaNorma.length}</b>
          <div style="margin-top:3px">${d.zegarekPozaNorma.map(esc).join('<br>')}</div>
        </div>`
      : '',
    // Brak danych z zegarka wyglada tak samo jak brak odchylen, wiec musi
    // powiedziec o sobie sam. Bez tego wygasly certyfikat aplikacji albo
    // cofnieta zgoda HealthKit potrafilyby zostac niezauwazone tygodniami.
    d.zegarekOpoznienie
      ? `<div class="panel-alert warn">
          <b>Zegarek nie synchronizowany od ${d.zegarekOpoznienie.dni} dni</b>
          <div style="margin-top:3px">Ostatnia doba w bazie: ${esc(d.zegarekOpoznienie.ostatni)}. Otwórz aplikację Zdrowie i kliknij Synchronizuj.</div>
        </div>`
      : '',
  ].join('');

  const missingMacros = d.totals?.meals_without_macros > 0 || d.totals?.meals_estimated > 0
    ? `<div class="panel-note">${[
        d.totals.meals_without_macros ? `${d.totals.meals_without_macros} bez makr` : '',
        d.totals.meals_estimated ? `${d.totals.meals_estimated} na oko` : '',
      ].filter(Boolean).join(', ')}, więc sumy są przybliżone</div>`
    : '';

  /*
   * Bilans w panelu pokazuje SREDNIA z okna, a nie ostatni dzien, i to jest
   * istota tego wiersza. Pojedyncza doba potrafi sie rozjechac o tysiac kcal
   * przez jeden trening albo jedna kolacje, a pytanie brzmi „czy schodze", nie
   * „ile zjadlem wczoraj". Ostatni dzien stoi z boku jako kontekst.
   */
  const bilansLine = d.bilansOkna
    ? `<div class="panel-row">
        <div>
          <div class="panel-row-label">Jedzenie a spalanie</div>
          <div class="panel-row-main">${esc(zdanieBilansu(d.bilansOkna.srednia))}</div>
          <div class="panel-row-why">
            ${esc(zdanieMasy(d.bilansOkna.kgTydzien))}.
            Średnia z ${d.bilansOkna.dni} ${d.bilansOkna.dni === 1 ? 'pełnego dnia' : 'pełnych dni'}.
            <a href="/zegarek" style="white-space:nowrap">Jak to liczone ›</a>
          </div>
        </div>
      </div>`
    : '';

  const gapLine = d.nextDeliveryGap
    ? `<div class="panel-row">
        <div>
          <div class="panel-row-label">Przerwa w dostawach</div>
          <div class="panel-row-main">${esc(d.nextDeliveryGap.from)}</div>
        </div>
        <div class="panel-row-side">${d.nextDeliveryGap.days === 0 ? 'dzisiaj' : `za ${d.nextDeliveryGap.days} dni`}</div>
      </div>`
    : '';

  // Kolejnosc wiersze przed kafelkami jest celowa. Rano pytanie brzmi
  // "co mam wziac i kiedy jem", a nie "ile mialem bialka".
  return `<div class="panel">
    <div class="panel-main">
      ${suppLine}
      ${nextWindow}
      ${bilansLine}
      ${phaseLine}
      ${gapLine}
    </div>
    <div class="tiles">${macroTiles}</div>
    ${alerts}
    ${missingMacros}
    <div class="panel-actions">
      <a href="/log?date=${d.date}" class="button button-small button-fill">Dopisz</a>
      <a href="/suplementy?date=${d.date}" class="button button-small">Suplementy</a>
      <a href="/kalendarz?m=${d.date.slice(0, 7)}" class="button button-small">Kalendarz</a>
    </div>
  </div>`;
}
