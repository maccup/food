import { Hono } from 'hono';
import { Env } from '../types';
import {
  page, card, blockTitle, emptyState, esc, todayWarsaw, shiftDate, daysBetween, poniedzialek,
} from '../views/ui';
import { loadSettings } from '../utils/settings';
import {
  METRYKI, WatchRow, Norma, Bilans, normy, sygnaly, stan, MIN_DNI_NORMY,
  bilans, opisSalda, kgNaTydzien, KCAL_NA_KILOGRAM,
} from '../utils/watch';

/**
 * Ekran zegarka.
 *
 * Odpowiada na trzy pytania i w tej kolejnosci: czy wczoraj cos odstawalo,
 * jak to wyglada na tle ostatnich tygodni, i co w ogole mierzymy. Trzecie jest
 * na dole celowo, bo czyta sie je raz, a dwa pierwsze przy kazdym wejsciu.
 *
 * Dane wchodza wsadem: `npm run watch:import`. Ten ekran niczego nie zapisuje.
 */
const watch = new Hono<{ Bindings: Env }>();

const ZAKRESY: Array<[string, string]> = [
  ['14', '14 dni'],
  ['30', '30 dni'],
  ['90', '90 dni'],
  ['rok', 'rok'],
];

/*
 * Norma liczy sie ZAWSZE z tego samego okna, niezaleznie od wybranego zakresu.
 * Inaczej przelaczenie na „14 dni" zwezaloby norme do dwoch tygodni i dzien
 * typowy potrafilby nagle wyladowac poza nia, bo zmienil sie punkt odniesienia,
 * a nie stan organizmu.
 */
const OKNO_NORMY = 180;

function okres(zakres: string) {
  const dzis = todayWarsaw();
  if (zakres === 'rok') return { od: shiftDate(dzis, -364), do: dzis, zakres };
  if (zakres === '90') return { od: shiftDate(dzis, -89), do: dzis, zakres };
  if (zakres === '14') return { od: shiftDate(dzis, -13), do: dzis, zakres };
  return { od: shiftDate(dzis, -29), do: dzis, zakres: '30' };
}

function mediana(v: number[]): number | null {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const p = (s.length - 1) / 2;
  return (s[Math.floor(p)] + s[Math.ceil(p)]) / 2;
}

/**
 * Slupki HRV w czasie.
 *
 * Powyzej trzech miesiecy dni zwijaja sie w tygodnie, bo 365 slupkow na
 * szerokosci telefonu ma po jednym pikselu i nie pokazuje juz trendu, tylko
 * szum. Wysokosc liczona od zera bylaby plaska (HRV rzadko schodzi ponizej
 * polowy mediany), wiec skala zaczyna sie od najnizszego dnia.
 */
function wykres(dni: WatchRow[], n: Norma | undefined, zwin: boolean): string {
  let punkty: Array<{ etykieta: string; v: number }> = [];

  if (zwin) {
    const tygodnie = new Map<string, number[]>();
    for (const d of dni) {
      if (typeof d.hrv_noc !== 'number') continue;
      const k = poniedzialek(d.date);
      if (!tygodnie.has(k)) tygodnie.set(k, []);
      tygodnie.get(k)!.push(d.hrv_noc);
    }
    punkty = [...tygodnie.entries()].map(([k, v]) => ({
      etykieta: `${k.slice(8)}.${k.slice(5, 7)}`,
      v: mediana(v)!,
    }));
  } else {
    punkty = dni
      .filter((d): d is WatchRow & { hrv_noc: number } => typeof d.hrv_noc === 'number')
      .map((d) => ({ etykieta: `${d.date.slice(8)}.${d.date.slice(5, 7)}`, v: d.hrv_noc }));
  }

  if (punkty.length < 2) return emptyState('Za mało dni, żeby narysować trend.');

  const wartosci = punkty.map((p) => p.v);
  const dol = Math.min(...wartosci) * 0.95;
  const gora = Math.max(...wartosci) * 1.02;
  const wysokosc = (v: number) => Math.max(2, Math.round(((v - dol) / (gora - dol)) * 60));

  const slupki = punkty.map((p) => {
    const poza = n && p.v < n.p10;
    return `<div style="flex:1;min-width:2px;display:flex;flex-direction:column;justify-content:flex-end;height:62px"
                 title="${esc(p.etykieta)}: ${p.v.toFixed(1)} ms">
      <div style="height:${wysokosc(p.v)}px;background:${poza ? 'var(--warn)' : 'var(--ok)'};border-radius:2px 2px 0 0"></div>
    </div>`;
  }).join('');

  const linia = n
    ? `<div style="position:absolute;left:0;right:0;bottom:${wysokosc(n.mediana)}px;border-top:1px dashed var(--muted);opacity:.7"></div>`
    : '';

  return card(`
    <div style="position:relative"><div style="display:flex;gap:1px;align-items:flex-end">${slupki}</div>${linia}</div>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:4px">
      <span>${esc(punkty[0].etykieta)}</span><span>${esc(punkty[punkty.length - 1].etykieta)}</span>
    </div>
    <p class="hint" style="margin:8px 0 0">
      HRV w nocy${zwin ? ', mediana tygodnia' : ' dzień po dniu'}.
      ${n ? 'Kreska to Twoja mediana, bursztynowe słupki to dni poniżej Twojego progu.' : ''}
      Skala zaczyna się od najniższego dnia, nie od zera, więc różnice są widoczne, ale wyglądają większe, niż są.
    </p>`);
}

watch.get('/zegarek', async (c) => {
  const db = c.env.DB;
  const o = okres(c.req.query('zakres') ?? '30');
  const dniZakresu = daysBetween(o.od, o.do) + 1;
  const dzis = todayWarsaw();

  const [wZakresie, doNormy, ostatni, zjedzone, ostatniaWaga] = await Promise.all([
    db.prepare(`SELECT * FROM watch WHERE date BETWEEN ? AND ? ORDER BY date`)
      .bind(o.od, o.do).all<WatchRow>(),
    db.prepare(`SELECT * FROM watch WHERE date BETWEEN ? AND ? ORDER BY date`)
      .bind(shiftDate(dzis, -OKNO_NORMY), dzis).all<WatchRow>(),
    db.prepare(`SELECT * FROM watch ORDER BY date DESC LIMIT 1`).first<WatchRow>(),
    db.prepare(`SELECT date, kcal, meals_estimated FROM v_day_totals WHERE date BETWEEN ? AND ?`)
      .bind(o.od, o.do).all<any>(),
    db.prepare(`SELECT date, waga FROM watch WHERE waga IS NOT NULL ORDER BY date DESC LIMIT 1`)
      .first<any>(),
  ]);

  const lista = wZakresie.results ?? [];
  const n = normy(doNormy.results ?? []);
  const bmrWlasny = Number((await loadSettings(db)).get('bmr_kcal') || 0) || null;

  if (!ostatni) {
    return c.html(page({
      title: 'Zegarek', tab: 'watch', header: 'Zegarek',
      content: `${blockTitle('Pusto')}${emptyState(
        'Żadnych danych z zegarka. Wgrywa się je poleceniem npm run watch:import po eksporcie ze Zdrowia na iPhonie.'
      )}`,
    }));
  }

  const brakDni = daysBetween(ostatni.date, dzis);
  const stanDanych = card(`
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
      <span style="font-size:13px;color:var(--muted)">Ostatnia doba z zegarka</span>
      <b style="font-size:19px">${esc(ostatni.date)}</b>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-top:8px">
      <span style="font-size:13px;color:var(--muted)">Dni z danymi w zakresie</span>
      <b style="font-size:19px">${lista.length} <span style="font-size:13px;font-weight:400;color:var(--muted)">z ${dniZakresu}</span></b>
    </div>
    ${brakDni > 2
      ? `<p class="hint" style="margin:8px 0 0;color:var(--warn)">
          Dane kończą się ${brakDni} dni temu. Zrób eksport ze Zdrowia i wgraj go poleceniem npm run watch:import.
        </p>`
      : ''}
    ${n.size === 0
      ? `<p class="hint" style="margin:8px 0 0">
          Norma jeszcze nie powstała. Potrzeba minimum ${MIN_DNI_NORMY} dni pomiarów, żeby liczby miały do czego się odnosić.
        </p>`
      : ''}`);

  /*
   * Sygnaly liczone dla ostatniej doby, nie dla dnia dzisiejszego. Dzisiejszy
   * wiersz w bazie zwykle nie istnieje, bo eksport robi sie raz na kilka
   * tygodni, a pusta sekcja „wszystko w normie" klamalaby, sugerujac pomiar.
   */
  const sygnalyOstatniej = sygnaly(ostatni, n);
  const uwaga = sygnalyOstatniej.length
    ? card(sygnalyOstatniej.map((s) => `
        <div class="ostrzezenie">
          <span class="flag limit">!</span>
          <span>
            <b>${esc(s.metryka.label)}: ${esc(s.metryka.format(s.wartosc))}</b>,
            Twoja norma to ${esc(s.metryka.format(s.norma.mediana))}
            <br><span class="ostrzezenie-opis">${esc(s.metryka.sygnal ?? '')}</span>
          </span>
        </div>`).join('') + `
        <p class="hint" style="margin:10px 0 0">
          Dotyczy doby ${esc(ostatni.date)}. Jeden dzień poza normą to najczęściej krótka noc albo kieliszek wina.
          Dopiero trzy pod rząd znaczą, że dzieje się coś, co warto powiązać z objawami.
        </p>`)
    : card(`<p style="margin:0;font-size:14px">
        Nic nie odstaje. Doba ${esc(ostatni.date)} mieści się w Twojej normie we wszystkim, co zegarek mierzy.
      </p>`);

  /*
   * Bilans kalorii.
   *
   * Dzien dzisiejszy jest z niego WYKLUCZONY i to nie jest ostroznosc, tylko
   * warunek sensu. Przemiana podstawowa narasta przez cala dobe, wiec o
   * poludniu wynosi polowe tego, co wyniesie wieczorem, a bilans pokazywalby
   * potezna nadwyzke przy kazdym sniadaniu.
   *
   * Dni bez wpisanego jedzenia tez wypadaja. Zero kcal z bazy nie znaczy „nic
   * nie jadl", tylko „nie wpisal", a policzenie im deficytu 3000 kcal
   * zafalszowaloby srednia w strone, ktora najlatwiej wziac za sukces.
   */
  const zjedzoneWgDat = new Map<string, { kcal: number; szacowane: number }>(
    (zjedzone.results ?? []).map((t: any) => [t.date, { kcal: Number(t.kcal), szacowane: Number(t.meals_estimated ?? 0) }])
  );

  const dniBilansu = lista
    .map((d) => ({ d, b: bilans(zjedzoneWgDat.get(d.date)?.kcal, d, d.date < dzis, bmrWlasny) }))
    .filter((x): x is { d: WatchRow; b: Bilans } => x.b !== null);

  const sredniSaldo = dniBilansu.length
    ? dniBilansu.reduce((a, x) => a + x.b.saldo, 0) / dniBilansu.length
    : 0;
  const kg = kgNaTydzien(sredniSaldo);
  const naSzacunkach = dniBilansu.some((x) => (zjedzoneWgDat.get(x.d.date)?.szacowane ?? 0) > 0);

  const wiekWagi = ostatniaWaga ? daysBetween(ostatniaWaga.date, dzis) : null;

  const bilansHtml = dniBilansu.length
    ? card(`
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
        <span style="font-size:13px;color:var(--muted)">Średnio na dzień</span>
        <b style="font-size:19px;color:${sredniSaldo < -50 ? 'var(--ok)' : sredniSaldo > 50 ? 'var(--warn)' : 'var(--text)'}">
          ${esc(opisSalda(sredniSaldo))}
        </b>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-top:8px">
        <span style="font-size:13px;color:var(--muted)">Co przy takim tempie daje</span>
        <b style="font-size:19px">${kg < 0 ? '−' : '+'}${Math.abs(kg).toFixed(2).replace('.', ',')} kg / tydzień</b>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-top:8px">
        <span style="font-size:13px;color:var(--muted)">Policzone z dni kompletnych</span>
        <b style="font-size:19px">${dniBilansu.length}</b>
      </div>

      <div style="overflow-x:auto;margin-top:14px"><table class="data-table" style="width:100%;font-size:13px">
        <thead><tr><th>Dzień</th><th style="text-align:right">zjedzone</th><th style="text-align:right">spalone</th><th style="text-align:right">saldo</th></tr></thead>
        <tbody>${[...dniBilansu].reverse().slice(0, 30).map(({ d, b }) => `<tr>
          <td><a href="/day/${d.date}">${d.date.slice(8)}.${d.date.slice(5, 7)}</a></td>
          <td style="text-align:right">${Math.round(b.zjedzone)}</td>
          <td style="text-align:right">${Math.round(b.spalone)}
            <span style="color:var(--muted);font-size:11px">${Math.round(b.bazowe)}+${Math.round(b.aktywne)}</span></td>
          <td style="text-align:right;white-space:nowrap;color:${b.saldo < -50 ? 'var(--ok)' : b.saldo > 50 ? 'var(--warn)' : 'var(--muted)'};font-weight:600">
            ${b.saldo < 0 ? '−' : '+'}${Math.abs(Math.round(b.saldo))}</td>
        </tr>`).join('')}</tbody>
      </table></div>

      ${(() => {
        /*
         * Rachunek rozpisany na liczbach z OSTATNIEJ doby, nie na przykladzie.
         * Wzor z literami nie tlumaczy niczego, dopoki nie widac, ktora liczba
         * na tym ekranie jest ktora. Blok liczy sie sam, wiec nie da sie go
         * rozjechac z tabela wyzej.
         */
        const { d, b } = dniBilansu[dniBilansu.length - 1];
        const dzien = `${d.date.slice(8)}.${d.date.slice(5, 7)}`;
        const krok = (opis: string, rachunek: string) =>
          `<div style="display:flex;justify-content:space-between;gap:10px;padding:4px 0;font-size:13px">
            <span style="color:var(--muted)">${opis}</span><b style="white-space:nowrap">${rachunek}</b>
          </div>`;
        return `<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--hairline)">
          <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Jak to policzone, na przykładzie ${dzien}</div>
          ${krok('spalone w spoczynku, z ustawień', `${Math.round(b.bazowe)} kcal`)}
          ${krok('spalone ruchem, z zegarka', `+ ${Math.round(b.aktywne)} kcal`)}
          ${krok('razem spalone', `= ${Math.round(b.spalone)} kcal`)}
          ${krok('zjedzone, z dziennika', `− ${Math.round(b.zjedzone)} kcal`)}
          ${krok('saldo dnia', `= ${b.saldo < 0 ? '−' : '+'}${Math.abs(Math.round(b.saldo))} kcal`)}
          <div style="height:8px"></div>
          ${krok(`średnia z ${dniBilansu.length} ${dniBilansu.length === 1 ? 'dnia' : 'dni'} w tabeli`, `${sredniSaldo < 0 ? '−' : '+'}${Math.abs(Math.round(sredniSaldo))} kcal`)}
          ${krok(`razy 7 dni, dzielone przez ${KCAL_NA_KILOGRAM} kcal na kilogram`, `${kg < 0 ? '−' : '+'}${Math.abs(kg).toFixed(2).replace('.', ',')} kg / tydzień`)}
        </div>`;
      })()}

      <p class="hint" style="margin:12px 0 0">
        <b>Ta liczba jest orientacyjna i trzeba o tym pamiętać za każdym razem.</b>
        ${dniBilansu[0].b.bazoweZZegarka
          ? `Przemiana podstawowa (pierwsza liczba w kolumnie „spalone") nie jest mierzona:
             Apple wylicza ją ze wzoru z wieku, wzrostu, masy i płci, nic nie wie o składzie ciała
             i zwykle wychodzi jej więcej niż z rachunku na masie beztłuszczowej.
             Własną liczbę ustawia się w Ustawieniach, pole „Własna przemiana podstawowa".`
          : `Przemiana podstawowa wzięta z ustawień (${Math.round(dniBilansu[0].b.bazowe)} kcal), nie z zegarka.`} Kalorie aktywne zegarek szacuje z tętna i ruchu, a przy sile potrafi
        pomylić się o kilkadziesiąt procent.${naSzacunkach ? ' Część posiłków po Twojej stronie też jest liczona na oko.' : ''}
        Każdy z tych błędów może iść w dowolną stronę.
      </p>
      <p class="hint" style="margin:8px 0 0">
        <b>Jedynym twardym sprawdzianem deficytu jest masa ciała.</b>
        ${ostatniaWaga && wiekWagi !== null
          ? wiekWagi > 30
            ? `Ostatnia waga w Zdrowiu to ${String(ostatniaWaga.waga).replace('.', ',')} kg z ${esc(ostatniaWaga.date)}, czyli sprzed ${wiekWagi} dni.
               Przy takiej dziurze nie ma czym zweryfikować powyższych liczb. Podepnij wagę do Zdrowia albo waż się raz w tygodniu.`
            : `Ostatnia waga w Zdrowiu: ${String(ostatniaWaga.waga).replace('.', ',')} kg z ${esc(ostatniaWaga.date)}.
               Porównaj kierunek zmiany masy z saldem powyżej: jeśli idą w różne strony, to myli się bilans, nie waga.`
          : 'W Zdrowiu nie ma ani jednego pomiaru masy, więc powyższych liczb nie ma czym zweryfikować.'}
        Przelicznik ${KCAL_NA_KILOGRAM} kcal na kilogram pochodzi z energii czystego tłuszczu, a realny ubytek
        to zawsze mieszanka tłuszczu, wody i mięśni, więc pierwsze dni zawsze wyglądają szybciej, niż jest.
      </p>`)
    : emptyState(
        'Za mało dni, żeby liczyć bilans. Potrzebna jest doba, która ma i pomiar z zegarka, i wpisane jedzenie, ' +
        'i która już się skończyła. Dzisiejszy dzień nie wchodzi, bo przemiana podstawowa narasta do północy.'
      );

  // Kolumny tabeli to metryki sygnalowe plus sen glowny. Reszta siedzi w
  // normach nizej: w tabeli dzien po dniu osiem kolumn nie miesci sie na telefonie.
  const KOLUMNY = METRYKI.filter((m) => ['hrv_noc', 'rhr', 'sen_min', 'temperatura'].includes(m.key as string));

  const wiersze = [...lista].reverse().slice(0, 30).map((d) => {
    const komorki = KOLUMNY.map((m) => {
      const v = d[m.key];
      if (typeof v !== 'number') return `<td style="text-align:right;color:var(--muted)">–</td>`;
      const nm = n.get(m.key as string);
      const poza = stan(m, v, nm) === 'poza';
      return `<td style="text-align:right;white-space:nowrap;${poza ? 'color:var(--warn);font-weight:600' : ''}">
        ${esc(m.format(v))}
      </td>`;
    }).join('');
    return `<tr><td><a href="/day/${d.date}">${d.date.slice(8)}.${d.date.slice(5, 7)}</a></td>${komorki}</tr>`;
  }).join('');

  const tabela = lista.length
    ? `<div style="overflow-x:auto"><table class="data-table" style="width:100%;font-size:13px">
        <thead><tr><th>Dzień</th>${KOLUMNY.map((m) => `<th style="text-align:right">${esc(m.label)}</th>`).join('')}</tr></thead>
        <tbody>${wiersze}</tbody>
      </table></div>
      ${lista.length > 30 ? `<p class="hint" style="margin:8px 0 0">Pokazane 30 ostatnich dni z ${lista.length} w zakresie. Trend z całego zakresu jest na wykresie wyżej.</p>` : ''}`
    : emptyState('Brak dni z zegarka w tym zakresie.');

  const normyHtml = n.size
    ? `<div style="overflow-x:auto"><table class="data-table" style="width:100%;font-size:13px">
        <thead><tr><th>Metryka</th><th style="text-align:right">Twoja mediana</th><th style="text-align:right">pasmo typowe</th><th style="text-align:right">dni</th></tr></thead>
        <tbody>${METRYKI.map((m) => {
          const nm = n.get(m.key as string);
          if (!nm) return '';
          return `<tr>
            <td>${esc(m.label)}</td>
            <td style="text-align:right;white-space:nowrap"><b>${esc(m.format(nm.mediana))}</b></td>
            <td style="text-align:right;white-space:nowrap;color:var(--muted)">${esc(m.format(nm.p10))} do ${esc(m.format(nm.p90))}</td>
            <td style="text-align:right;color:var(--muted)">${nm.n}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
      <p class="hint" style="margin:10px 0 0">
        Liczone z ostatnich ${OKNO_NORMY} dni Twoich własnych pomiarów, nie z norm podręcznikowych.
        HRV zdrowych dorosłych rozciąga się od kilkunastu do ponad stu milisekund, więc jedyne, co ma sens,
        to porównanie Ciebie z Tobą. Pasmo typowe obejmuje osiem na dziesięć Twoich dni,
        czyli jeden dzień na pięć wypada poza nie i to jest normalne.
      </p>`
    : `<p class="hint" style="margin:0">
        Za mało dni. Norma powstaje przy ${MIN_DNI_NORMY} pomiarach, wcześniej progi byłyby szumem
        i co trzeci dzień wyglądałby na nietypowy.
      </p>`;

  const coSledzimy = `<div class="list media-list" style="margin:0"><ul>
    ${METRYKI.map((m) => `<li><div class="item-content"><div class="item-inner" style="display:block;padding:10px 0">
      <b style="font-size:14px">${esc(m.label)}</b>
      <div style="font-size:12px;color:var(--muted);margin-top:3px">${esc(m.poCo)}</div>
      ${m.sygnal ? `<div style="font-size:12px;color:var(--warn);margin-top:4px">${esc(m.sygnal)}</div>` : ''}
    </div></div></li>`).join('')}
  </ul></div>`;

  const przycisk = (wartosc: string, label: string) =>
    `<a href="/zegarek?zakres=${wartosc}" class="button button-small ${o.zakres === wartosc ? 'button-fill' : ''}">${label}</a>`;

  const content = `
    <div class="block" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
      ${ZAKRESY.map(([w, l]) => przycisk(w, l)).join('')}
    </div>

    ${blockTitle('Na co zwrócić uwagę')}
    ${uwaga}

    ${blockTitle('Ile tego jest')}
    ${stanDanych}

    ${blockTitle('Bilans kalorii', 'zjedzone wobec spalonego')}
    ${bilansHtml}

    ${blockTitle('Trend HRV', `${esc(o.od)} do ${esc(o.do)}`)}
    ${wykres(lista, n.get('hrv_noc'), dniZakresu > 92)}

    ${blockTitle('Dzień po dniu')}
    ${card(tabela)}

    ${blockTitle('Twoja norma', `ostatnie ${OKNO_NORMY} dni`)}
    ${card(normyHtml)}

    ${blockTitle('Co śledzimy i po co')}
    ${coSledzimy}
  `;

  return c.html(page({ title: 'Zegarek', tab: 'watch', header: 'Zegarek', content }));
});

export default watch;
