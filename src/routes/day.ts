import { Hono } from 'hono';
import { Env } from '../types';
import {
  page, card, blockTitle, emptyState, esc, pl, flag, macroBar,
  SLOT_LABEL, todayWarsaw, shiftDate, prettyDate, nowMinutesWarsaw, daysBetween,
  hhmmToMinutes, minutyNaHhmm,
} from '../views/ui';
import { dashboard } from '../views/dashboard';
import { loadSettings, sittingTimes, loadNoDelivery } from '../utils/settings';
import { przerwyDnia, koniecOstatniegoPodejscia, przerywaPrzerwe, RegulyPrzerw } from '../utils/gaps-stats';
import {
  MAKRA_KALENDARZA, MAKRA_POZOSTALE, Odchylenie, odchylenia, opisOdchylenia,
} from '../utils/day-status';
import { loadDayGaps, renderGaps } from './gaps';
import { METRYKI, WatchRow, normy, stan, sygnaly, bilans, kgNaTydzien } from '../utils/watch';

const day = new Hono<{ Bindings: Env }>();

/** Kolejność pasków. Progi i podział na „koloruje kalendarz" siedzą w utils/day-status.ts. */
const MACROS = [
  { key: 'kcal', label: 'Kalorie', unit: 'kcal' },
  { key: 'protein_g', label: 'Białko', unit: 'g' },
  { key: 'fat_g', label: 'Tłuszcz', unit: 'g' },
  { key: 'carbs_g', label: 'Węgle', unit: 'g' },
  { key: 'fiber_g', label: 'Błonnik', unit: 'g' },
];

/**
 * Dlaczego kalendarz zaznacza ten dzień.
 *
 * Reguła koloru kratki siedziała wyłącznie w kalendarzu, więc dawało się ją
 * zobaczyć tylko jako kolor. Do tego część ostrzeżeń nie miała gdzie się
 * pokazać: przekroczone limity i makra spoza tłuszczu i błonnika nie zmieniają
 * koloru dnia i nie było o nich ani słowa. Ten blok wypisuje wszystko, co
 * aplikacja o dniu wie, i mówi wprost, które pozycje ustawiają kolor.
 */
function ostrzezenia(
  zakazane: any[],
  limity: any[],
  kolorujace: Odchylenie[],
  pozostale: Odchylenie[]
): string {
  const wiersz = (poziom: string, znak: string, tytul: string, opis: string) =>
    `<div class="ostrzezenie">
      <span class="flag ${poziom}">${znak}</span>
      <span><b>${esc(tytul)}</b>${opis ? `<br><span class="ostrzezenie-opis">${esc(opis)}</span>` : ''}</span>
    </div>`;

  const duze = kolorujace.filter((o) => o.duze);
  const male = kolorujace.filter((o) => !o.duze);

  const rzedy = [
    ...zakazane.map((b) =>
      wiersz('forbidden', '×', `${b.food_name}${b.meal_name ? ` w „${b.meal_name}”` : ''}`,
        `zakazane: ${b.reason}`)),
    ...duze.map((o) =>
      wiersz('limit', '!', opisOdchylenia(o, pl), 'odchylenie ponad 10 procent, to ono maluje dzień na żółto')),
    ...male.map((o) =>
      wiersz('info', '·', opisOdchylenia(o, pl), 'poza pasmem, ale w granicach 10 procent, więc dzień zostaje zielony')),
    // Limity zbierane po produkcie, nie po posilku: dwie kawy to jedna linia
    // „kawa, 2 razy", bo przy limicie liczy sie dzienna suma, a nie to,
    // przy ktorym posilku padla. Zakazane zostaja rozbite, bo tam chcesz
    // wiedziec, ktory posilek to przyniosl.
    ...[...new Map(limity.map((b: any) => [b.food_name, b])).values()].map((b: any) => {
      const ile = limity.filter((x: any) => x.food_name === b.food_name).length;
      return wiersz('info', '·', `${b.food_name}${ile > 1 ? `, ${ile} razy` : ''}`,
        `limit${b.max_amount ? ` ${b.max_amount}` : ''}: ${b.reason}. Nie zmienia koloru dnia`);
    }),
    ...pozostale.map((o) =>
      wiersz('info', '·', opisOdchylenia(o, pl), 'kalendarz patrzy tylko na tłuszcz i błonnik, więc to nie zmienia koloru dnia')),
  ];

  if (!rzedy.length) {
    return emptyState('Nic do zgłoszenia. Kalendarz pokaże ten dzień na zielono.');
  }

  return card(`${rzedy.join('')}
    <p class="hint" style="margin:10px 0 0">Kolor kratki w kalendarzu ustawiają tylko dwa pierwsze rodzaje:
      produkt z listy zakazanych maluje dzień na czerwono, tłuszcz albo błonnik odchylone
      o ponad 10 procent od pasma fazy na żółto. Reszta jest do wiadomości.</p>`);
}

// Trzy stany zamiast jednej flagi: "dopiero bedzie" i "nie zjadlem" mialy
// wczesniej ta sama wartosc, przez co plan znikal z kalendarza. Patrz 019.
export const STANY: [string, string][] = [
  ['plan', 'zaplanowane'],
  ['zjedzony', 'zjedzone'],
  ['pominiety', 'pominięte'],
];

interface MealRow {
  id: number; slot: string; sitting: number | null; source: string; name: string; eaten_at: string | null; duration_min: number | null;
  kcal: number | null; protein_g: number | null; fat_g: number | null;
  carbs_g: number | null; fiber_g: number | null; fiber: number | null;
  stan: string; eaten_fraction: number; estimated: number; notes: string | null;
}

export async function renderDay(c: any, date: string) {
  const db = c.env.DB;

  const [totals, phase, meals, breaches, symptoms, stools, stres, zegarek] = await Promise.all([
    db.prepare(`SELECT * FROM v_day_totals WHERE date = ?`).bind(date).first<any>(),
    db.prepare(
      `SELECT * FROM phases WHERE ? >= date_from AND (date_to IS NULL OR ? <= date_to) LIMIT 1`
    ).bind(date, date).first<any>(),
    db.prepare(
      `SELECT id, slot, sitting, source, name, eaten_at, duration_min, kcal, protein_g, fat_g, carbs_g, fiber_g,
              stan, eaten_fraction, estimated, notes
       FROM meals WHERE date = ?
       ORDER BY COALESCE(eaten_at, '99:99'),
         CASE slot WHEN 'sniadanie' THEN 1 WHEN 'ii_sniadanie' THEN 2 WHEN 'obiad' THEN 3
                   WHEN 'podwieczorek' THEN 4 WHEN 'kolacja' THEN 5 ELSE 6 END, id`
    ).bind(date).all<MealRow>(),
    db.prepare(
      `SELECT meal_id, meal_name, food_name, level, reason, max_amount FROM v_restriction_breaches WHERE date = ?`
    ).bind(date).all<any>(),
    db.prepare(`SELECT * FROM symptoms WHERE date = ? ORDER BY COALESCE(time,'99:99')`).bind(date).all<any>(),
    db.prepare(`SELECT * FROM stools WHERE date = ? ORDER BY COALESCE(time,'99:99')`).bind(date).all<any>(),
    db.prepare(`SELECT * FROM stress WHERE date = ?`).bind(date).first(),
    db.prepare(`SELECT * FROM watch WHERE date = ?`).bind(date).first(),
  ]);

  /*
   * Norma zegarka dociagana dopiero wtedy, gdy ta doba w ogole ma pomiary.
   * Dane wchodza wsadem raz na kilka tygodni, wiec wiekszosc otwarc strony
   * dotyczy dni bez wiersza i drugie zapytanie byloby wtedy czystym kosztem.
   */
  const normyZegarka = zegarek
    ? normy(((await db.prepare(`SELECT * FROM watch WHERE date BETWEEN ? AND ? ORDER BY date`)
        .bind(shiftDate(date, -180), date).all()).results ?? []) as unknown as WatchRow[])
    : new Map();

  /*
   * Ile dni zegarek jest do tylu.
   *
   * Aplikacja iOS wysyla dane recznie, jednym kliknieciem, wiec jedynym
   * objawem awarii jest CISZA: wygasly certyfikat, cofnieta zgoda HealthKit
   * albo po prostu niekliknięcie wygladaja identycznie, czyli jak brak
   * odchylen. Bez tego wiersza panel wyswietlalby stare liczby jako aktualne.
   */
  const zegarekStan = date === todayWarsaw()
    ? ((await db.prepare(`SELECT MAX(date) AS ostatni FROM watch`).first()) as { ostatni: string | null } | null)
    : null;
  const zegarekOpoznienie = (() => {
    const ostatni = zegarekStan?.ostatni;
    if (!ostatni) return null;
    const dni = Math.round((Date.parse(todayWarsaw()) - Date.parse(ostatni)) / 86400000);
    // Jeden dzien to norma, bo doba domyka sie dopiero po pobudce i wysylce.
    return dni > 1 ? { dni, ostatni } : null;
  })();

  const targets = phase
    ? await db.prepare(`SELECT metric, min_value, max_value FROM targets WHERE phase_id = ?`)
        .bind(phase.id).all<any>()
    : { results: [] };

  const targetBy = new Map<string, any>((targets.results ?? []).map((t: any) => [t.metric, t]));

  const settings = await loadSettings(db);
  const times = sittingTimes(settings);
  const isToday = date === todayWarsaw();

  /*
   * Reguły przerywania przerwy w jednym obiekcie, bo czytają je trzy miejsca
   * tej strony: panel („Możesz zjeść"), przerwy między posiłkami i znacznik
   * przy pozycji. Trzy osobne odczyty z ustawień to trzy okazje na rozjazd.
   */
  const regulyPrzerw: RegulyPrzerw = {
    progKcal: Number(settings.get('gap_kcal_prog') || 30),
    progMakro: Number(settings.get('gap_makro_prog') || 1),
    domyslneTrwanie: Number(settings.get('default_meal_min') || 30),
  };

  const dayCode = ['nie', 'pon', 'wt', 'sr', 'czw', 'pt', 'sob'][new Date(`${date}T12:00:00Z`).getUTCDay()];
  const supps = await db.prepare(
    `SELECT s.id, s.time_of_day, sup.name, l.taken
     FROM supplement_schedule s
     JOIN supplements sup ON sup.id = s.supplement_id
     LEFT JOIN supplement_log l ON l.schedule_id = s.id AND l.date = ?
     WHERE ? >= s.date_from AND (s.date_to IS NULL OR ? <= s.date_to)
       AND (s.days = 'daily' OR (',' || s.days || ',') LIKE ('%,' || ? || ',%'))
       AND sup.status NOT IN ('paused', 'discontinued')
     ORDER BY s.time_of_day`
  ).bind(date, date, date, dayCode).all<any>();

  const suppRows = supps.results ?? [];
  const nowMin = isToday ? nowMinutesWarsaw() : null;
  const nextSupp = suppRows.find((r: any) => {
    if (r.taken === 1) return false;
    if (nowMin === null) return true;
    const [h, m] = String(r.time_of_day).split(':').map(Number);
    return h * 60 + (m || 0) >= nowMin;
  }) ?? suppRows.find((r: any) => r.taken !== 1);

  const overdueSupps = nowMin === null ? 0 : suppRows.filter((r: any) => {
    if (r.taken === 1) return false;
    const [h, m] = String(r.time_of_day).split(':').map(Number);
    return h * 60 + (m || 0) < nowMin;
  }).length;
  const breachBy = new Map<number, any[]>();
  for (const b of breaches.results ?? []) {
    if (!breachBy.has(b.meal_id)) breachBy.set(b.meal_id, []);
    breachBy.get(b.meal_id)!.push(b);
  }

  const macroHtml = MACROS.map((m) => {
    const t = targetBy.get(m.key);
    return macroBar({
      key: m.key,
      label: m.label,
      actual: totals ? Number(totals[m.key]) : 0,
      min: t?.min_value ?? null,
      max: t?.max_value ?? null,
      unit: m.unit,
    });
  }).join('');

  const caveats: string[] = [];
  if (totals?.meals_without_macros > 0)
    caveats.push(`${totals.meals_without_macros} posiłek bez podanych makr, sumy są zaniżone`);
  if (totals?.meals_estimated > 0)
    caveats.push(`${totals.meals_estimated} posiłek z makrami na oko`);

  const bySitting = new Map<number, MealRow[]>();
  for (const m of meals.results ?? []) {
    const s = m.sitting ?? 9;
    if (!bySitting.has(s)) bySitting.set(s, []);
    bySitting.get(s)!.push(m);
  }

  // Poniedzialek biezacego tygodnia, bo reguly braków sa tygodniowe.
  const dow = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  const weekStart = shiftDate(date, -dow);
  const [dayGaps, doKupienia] = await Promise.all([
    loadDayGaps(db, date, weekStart),
    db.prepare(`SELECT COUNT(*) AS n FROM shopping WHERE bought = 0`).first<{ n: number }>(),
  ]);

  // Najblizsza przerwa w dostawach w ciagu dwoch tygodni. Planowanie, nie retrospekcja.
  const noDelivery = await loadNoDelivery(db);
  let nextGap: { from: string; days: number } | null = null;
  for (let i = 0; i <= 14; i++) {
    const probe = shiftDate(date, i);
    if (noDelivery.has(probe) && !noDelivery.has(shiftDate(probe, -1))) {
      nextGap = { from: probe, days: i };
      break;
    }
  }

  /*
   * Okno bilansu: siedem ostatnich dob ZAMKNIETYCH. Dzisiejsza nie wchodzi,
   * bo przemiana podstawowa narasta do polnocy. Siedem, bo tyle wygladza
   * pojedynczy trening i pojedyncza kolacje, a jednoczesnie reaguje na zmiane
   * w ciagu tygodnia, a nie miesiaca.
   */
  const bmrWlasny = Number(settings.get('bmr_kcal') || 0) || null;
  const koniecOkna = date < todayWarsaw() ? date : shiftDate(todayWarsaw(), -1);
  const oknoBilansu = await db.prepare(
    `SELECT w.date, w.kcal_bazowe, w.kcal_aktywne, t.kcal AS zjedzone
     FROM watch w JOIN v_day_totals t ON t.date = w.date
     WHERE w.date BETWEEN ? AND ? ORDER BY w.date`
  ).bind(shiftDate(koniecOkna, -6), koniecOkna).all();

  const bilanse = ((oknoBilansu.results ?? []) as any[])
    .map((r) => ({ date: r.date as string, b: bilans(r.zjedzone, r as WatchRow, true, bmrWlasny) }))
    .filter((x): x is { date: string; b: NonNullable<ReturnType<typeof bilans>> } => x.b !== null);

  const bilansOkna = bilanse.length
    ? (() => {
        const srednia = bilanse.reduce((a, x) => a + x.b.saldo, 0) / bilanse.length;
        return {
          srednia,
          dni: bilanse.length,
          kgTydzien: kgNaTydzien(srednia),
          ostatni: bilanse[bilanse.length - 1].date === koniecOkna
            ? bilanse[bilanse.length - 1].b.saldo
            : null,
        };
      })()
    : null;

  const panel = dashboard({
    date,
    isToday,
    nowMinutes: nowMin,
    phaseName: phase?.name ?? null,
    phaseEnd: phase?.date_to ?? null,
    daysLeft: phase?.date_to ? Math.max(0, daysBetween(date, phase.date_to)) : null,
    totals: totals ?? null,
    targets: targetBy,
    sittingTimes: times,
    mealsBySitting: new Map(
      [...bySitting.entries()].map(([s, list]) => [
        s,
        { total: list.length, eaten: list.filter((m) => m.stan === 'zjedzony').length },
      ])
    ),
    supplementsTotal: suppRows.length,
    supplementsTaken: suppRows.filter((r: any) => r.taken === 1).length,
    nextSupplement: nextSupp ? { time: nextSupp.time_of_day, name: nextSupp.name } : null,
    overdueSupplements: overdueSupps,
    forbiddenToday: (breaches.results ?? [])
      .filter((b: any) => b.level === 'forbidden')
      .map((b: any) => ({ food_name: b.food_name, meal_name: b.meal_name ?? '' })),
    warnToday: odchylenia(totals, (m) => targetBy.get(m), MAKRA_KALENDARZA)
      .filter((o) => o.duze)
      .map((o) => opisOdchylenia(o, pl)),
    lastBiteMinutes: koniecOstatniegoPodejscia(meals.results ?? [], regulyPrzerw),
    minGapHours: Number(settings.get('min_gap_hours') || 4),
    nextDeliveryGap: nextGap,
    bilansOkna,
    zegarekPozaNorma: sygnaly(zegarek as WatchRow | null, normyZegarka).map(
      (s) => `${s.metryka.label} ${s.metryka.format(s.wartosc)}, Twoja norma to ${s.metryka.format(s.norma.mediana)}`
    ),
    zegarekOpoznienie,
  });

  /*
   * Oś czasu z faktycznymi godzinami, nie z planowanymi oknami.
   * Nagłówki "Podejście 1, 09:00" pokazywały godzinę z ustawień, czyli tę,
   * o której miało się jeść, a nie tę, o której się jadło. Zaciemniało to
   * jedyną rzecz, która tu jest naprawdę ważna: realną przerwę między
   * posiłkami, bo to ona uruchamia falę oczyszczającą jelito.
   */
  const minGap = Number(settings.get('min_gap_hours') || 4);

  const lista = meals.results ?? [];
  // Ten sam algorytm co w statystykach, patrz utils/gaps-stats.ts.
  const przerwy = przerwyDnia(lista, regulyPrzerw);
  const wiersze: string[] = [];

  for (const m of lista) {
    const przerwa = przerwy.get(m.id);

    if (przerwa !== undefined) {
      const h = Math.floor(przerwa / 60);
      const min = przerwa % 60;
      const zaKrotka = przerwa < minGap * 60;
      // Granice przerwy wypisane wprost. Sama dlugosc kazala liczyc w pamieci,
      // od ktorej godziny biegnie, a to wlasnie koniec poprzedniego podejscia
      // jest ta godzina, ktora trzeba znac, zeby wiedziec, kiedy wolno zjesc.
      const koniecPoprzedniego = minutyNaHhmm(hhmmToMinutes(m.eaten_at!) - przerwa);
      wiersze.push(`<div class="gap ${zaKrotka ? 'gap-short' : ''}">
        <span>${przerwa < 0
          ? 'podejścia nachodzą na siebie'
          : `przerwa ${h && min ? `${h} h ${min} min` : h ? `${h} h` : `${min} min`}, od ${koniecPoprzedniego} do ${esc(m.eaten_at!)}`}</span>
        ${zaKrotka ? `<span class="gap-note">mniej niż ${minGap} h</span>` : ''}
      </div>`);
    }

    wiersze.push(`<div class="list" style="margin:0"><ul>${mealItem(m, breachBy.get(m.id) ?? [], regulyPrzerw)}</ul></div>`);
  }

  const mealsHtml = lista.length
    ? wiersze.join('')
    : emptyState('Brak posiłków tego dnia. Menu z cateringu wjeżdża importem, a wszystko poza nim dopisujesz w zakładce Dopisz.');

  /*
   * Stres stoi w tym bloku pierwszy i zostaje w nim nawet wtedy, gdy nie jest
   * wpisany. Pusty wiersz z odnosnikiem jest tu jedynym mechanizmem, ktory
   * przypomina o wpisie, a bez wpisow ta liczba nie zmierzy niczego. Dni
   * przyszlych nie zaczepiamy, bo stresu jeszcze nie bylo.
   */
  const stresWiersz = stres
    ? `<li>
        <span>stres dnia${stres.powod ? `, ${esc(stres.powod)}` : ''}${stres.notes ? `, ${esc(stres.notes)}` : ''}</span>
        <span class="ev-right"><span class="ev-wartosc">${stres.level}/10</span>
          <a href="/log?co=stres&date=${date}" class="ev-akcja">Popraw</a>
          <form method="POST" action="/log/stres/usun" style="display:contents"
                onsubmit="return confirm('Usunąć ten wpis? Tego nie da się cofnąć.')">
            <input type="hidden" name="date" value="${date}">
            <button type="submit" class="ev-akcja ev-usun">Usuń</button>
          </form>
        </span>
      </li>`
    : date <= todayWarsaw()
      ? `<li>
          <span style="color:var(--muted)">stres dnia niewpisany</span>
          <span class="ev-right"><a href="/log?co=stres&date=${date}" class="ev-akcja">Wpisz</a></span>
        </li>`
      : '';

  /*
   * Zegarek stoi tuz po stresie, bo obie liczby opisuja cala dobe, a nie moment,
   * i czyta sie je razem: sam spadek HRV nic nie znaczy, dopoki nie wiadomo, czy
   * dzien byl napiety, czy po prostu krotko spany.
   *
   * Wiersza NIE MA, gdy doba nie ma pomiarow, i nie ma tu odpowiednika pustego
   * wiersza od stresu. Stres zalezy od wpisu, wiec przypomnienie ma sens.
   * Zegarek mierzyl niezaleznie od wszystkiego, a brak wiersza znaczy tylko tyle,
   * ze eksport jeszcze nie zostal wgrany. Przypominanie o tym przy kazdym dniu
   * z osobna zamienia sie w szum na kilkudziesieciu ekranach naraz.
   */
  const NA_WIERSZ = ['hrv_noc', 'rhr', 'sen_min'];
  const zegarekWiersz = zegarek
    ? `<li>
        <span>zegarek: ${METRYKI.filter((m) => NA_WIERSZ.includes(m.key as string)).map((m) => {
          const v = (zegarek as any)[m.key];
          if (typeof v !== 'number') return '';
          const poza = stan(m, v, normyZegarka.get(m.key as string)) === 'poza';
          return `<span${poza ? ' style="color:var(--warn);font-weight:600"' : ''}>${esc(m.krotko)} ${esc(m.format(v))}</span>`;
        }).filter(Boolean).join(', ')}</span>
        <span class="ev-right"><a href="/zegarek" class="ev-akcja">Trendy</a></span>
      </li>`
    : '';

  /*
   * Bilans stoi w osobnym wierszu, a nie doklejony do poprzedniego, bo laczy
   * dwa zrodla: spalone przychodzi z zegarka, zjedzone z dziennika. Wiersz
   * znika dla dnia dzisiejszego, bo przemiana podstawowa narasta do polnocy
   * i o poludniu kazdy dzien wygladalby na potezna nadwyzke.
   */
  const b = bilans(totals?.kcal, zegarek as WatchRow | null, date < todayWarsaw(), bmrWlasny);
  const bilansWiersz = b
    ? `<li>
        <span>zjadłeś ${Math.round(b.zjedzone)} kcal, spaliłeś ${Math.round(b.spalone)}</span>
        <span class="ev-right">
          <span class="ev-wartosc">${Math.abs(Math.round(b.saldo))} kcal ${b.saldo < 0 ? 'mniej' : 'więcej'}</span>
          <a href="/zegarek" class="ev-akcja">Bilans</a>
        </span>
      </li>`
    : '';

  const wpisy = [
    stresWiersz,
    zegarekWiersz,
    bilansWiersz,
    ...(symptoms.results ?? []).map((s: any) =>
      `<li>
        <span>${esc(s.time ?? '')} ${esc(s.kind)}${s.notes ? `, ${esc(s.notes)}` : ''}</span>
        <span class="ev-right"><span class="ev-wartosc">${s.severity ?? '?'}/10</span>${akcjeWpisu('objaw', 'symptom', s.id, date)}</span>
      </li>`),
    ...(stools.results ?? []).map((s: any) =>
      `<li>
        <span>${esc(s.time ?? '')} stolec${s.straining ? ', parcie' : ''}${s.incomplete ? ', niepełne wypróżnienie' : ''}${s.floating ? ', pływający' : ''}</span>
        <span class="ev-right"><span class="ev-wartosc">Bristol ${s.bristol}</span>${akcjeWpisu('stolec', 'stool', s.id, date)}</span>
      </li>`),
  ].filter(Boolean);

  const eventsHtml = wpisy.length
    ? `<div class="list simple-list"><ul>${wpisy.join('')}</ul></div>`
    : emptyState('Brak wpisów o objawach i stolcu.');

  /*
   * Kolejnosc sekcji ustawiona 12.08 i jest to kolejnosc czytania dnia, nie
   * wazności danych. Najpierw gdzie jestem (data), potem co mam teraz zrobic
   * (panel z suplementami i godzina najblizszego posilku), potem stan dnia
   * (makro, posilki, objawy), na koncu planowanie na jutro (braki) i dopiero
   * wyjasnienie, dlaczego kalendarz maluje ten dzien tak, a nie inaczej.
   *
   * Legenda stoi ostatnia celowo. To jedyna sekcja, ktora nie niesie nowych
   * faktow, tylko tlumaczy te wypisane wyzej, wiec czytana jest wtedy, gdy cos
   * sie nie zgadza, a nie za kazdym otwarciem ekranu.
   */
  const content = `
    <div class="block" style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
      <a href="/day/${shiftDate(date, -1)}" class="button button-small">‹ poprzedni</a>
      <div style="text-align:center">
        <div style="font-weight:700">${esc(prettyDate(date))}</div>
        <div style="font-size:12px;color:var(--muted)">${phase ? esc(phase.diet_type ?? '') : 'poza fazami protokołu'}</div>
      </div>
      <a href="/day/${shiftDate(date, 1)}" class="button button-small">następny ›</a>
    </div>

    ${panel}

    ${blockTitle('Makro wobec celu')}
    ${totals
      ? card(macroHtml + (caveats.length ? `<div style="margin-top:10px;font-size:12px;color:var(--warn)">${caveats.map(esc).join('<br>')}</div>` : ''))
      : emptyState('Nic jeszcze nie zjedzone tego dnia, więc nie ma czego porównywać z celem.')}

    ${blockTitle('Posiłki', `cel: przerwy min. ${minGap} h`)}
    ${mealsHtml}

    ${blockTitle('Stres, zegarek, objawy i stolec')}
    ${eventsHtml}

    ${blockTitle('Czego dziś brakuje', 'tydzień liczony od poniedziałku')}
    ${renderGaps(dayGaps, date, doKupienia?.n ?? 0)}

    ${blockTitle('Dlaczego kalendarz to zaznacza', 'wszystkie ostrzeżenia dnia')}
    ${ostrzezenia(
      (breaches.results ?? []).filter((b: any) => b.level === 'forbidden'),
      (breaches.results ?? []).filter((b: any) => b.level === 'limit'),
      odchylenia(totals, (m) => targetBy.get(m), MAKRA_KALENDARZA),
      odchylenia(totals, (m) => targetBy.get(m), MAKRA_POZOSTALE)
    )}

    <div class="block"><a href="/log?date=${date}" class="button button-fill">Dopisz posiłek, objaw, stolec albo stres</a></div>
  `;

  return page({
    title: prettyDate(date),
    // Zawsze 'today', nie tylko dla dzisiaj. Brak zakladki znaczy brak dolnego
    // paska, wiec po kliknieciu "poprzedni dzien" albo dnia w kalendarzu
    // uzytkownik na telefonie tracil cala nawigacje i wracal tylko wstecz.
    tab: 'today',
    // Sam dzień bez nazwy tygodnia, bo pełna data nie mieści się w pasku obok
    // czterech ikon („poniedziałek, 10.08.2026" gubiło końcówkę). Pełny zapis
    // stoi wiersz niżej, w przełączniku dni, więc nic nie ginie.
    header: isToday ? 'Dziś' : `${Number(date.slice(8))}.${date.slice(5, 7)}.${date.slice(0, 4)}`,
    content,
  });
}

/**
 * Poprawienie i skasowanie wpisu o objawie albo stolcu.
 *
 * Edycja prowadzi do tego samego formularza w zakladce Dopisz, tylko wypelnionego.
 * Kasowanie jest zwyklym POST-em, bo to jedyny nieodwracalny przycisk na tym
 * ekranie i ma wymagac potwierdzenia, a nie chodzic pod odnosnikiem, ktory
 * przegladarka moze odwiedzic sama.
 */
function akcjeWpisu(co: string, tabela: string, id: number, date: string): string {
  return `<a href="/log?co=${co}&edytuj=${id}" class="ev-akcja">Popraw</a>
    <form method="POST" action="/log/${tabela}/${id}/usun" style="display:contents"
          onsubmit="return confirm('Usunąć ten wpis? Tego nie da się cofnąć.')">
      <input type="hidden" name="date" value="${date}">
      <button type="submit" class="ev-akcja ev-usun">Usuń</button>
    </form>`;
}

/**
 * Godziny posilku od poczatku do konca, a nie poczatek plus czas trwania.
 *
 * Przerwa liczy sie od ostatniego kesa, wiec godzina zakonczenia jest tu
 * wazniejsza niz poczatek, a wczesniej trzeba ja bylo dodawac w pamieci.
 * Gdy czasu trwania nie podano, silnik przerw i tak przyjmuje domyslny, wiec
 * ekran pokazuje ta sama godzine, tylko oznaczona jako przyjeta, zeby nie
 * udawala zmierzonej.
 */
function godziny(m: MealRow, reguly: RegulyPrzerw): string {
  if (!m.eaten_at) return '';
  const mocno = (t: string) => `<b style="color:var(--text);font-size:13px">${t}</b>`;
  const koniec = minutyNaHhmm(hhmmToMinutes(m.eaten_at) + (m.duration_min ?? reguly.domyslneTrwanie));
  return `${mocno(esc(m.eaten_at))}
    <span style="text-transform:none">do ${m.duration_min ? '' : 'ok. '}</span>${mocno(koniec)}
    &middot; `;
}

function mealItem(m: MealRow, breaches: any[], reguly: RegulyPrzerw): string {
  const forbidden = breaches.filter((b) => b.level === 'forbidden');
  const limits = breaches.filter((b) => b.level === 'limit');

  const chips = [
    ...forbidden.map((b) => flag('forbidden', b.food_name)),
    ...limits.map((b) => flag('limit', b.food_name)),
    m.estimated ? flag('info', 'na oko') : '',
    m.source !== 'hfood' ? flag('info', m.source) : '',  // catering nie potrzebuje znacznika, ma swoje makra
    m.stan === 'plan' ? flag('info', 'zaplanowane') : '',
    m.stan === 'pominiety' ? flag('limit', 'pominięte') : '',
    m.stan === 'zjedzony' && m.eaten_fraction < 1 ? flag('info', `zjedzone ${Math.round(m.eaten_fraction * 100)}%`) : '',
    // Ten sam warunek, ktorym silnik liczy przerwy, a nie jego przepisana wersja.
    // Wczesniej stalo tu wpisane na sztywno „ponizej 30 kcal", wiec etykieta
    // klamala i po zmianie progu w Ustawieniach, i przy kawie z mlekiem.
    m.stan === 'zjedzony' && m.eaten_at && !przerywaPrzerwe(m, reguly)
      ? flag('info', 'nie przerywa przerwy') : '',
  ]
    .filter(Boolean)
    .join('');

  const macros = m.kcal === null
    ? '<span style="color:var(--warn)">bez makr</span>'
    : `${pl(m.kcal, 0)} kcal &middot; B ${pl(m.protein_g)} &middot; T ${pl(m.fat_g)} &middot; W ${pl(m.carbs_g)} &middot; bł ${pl(m.fiber_g)}`;

  return `<li class="${m.stan === 'pominiety' ? 'meal-skipped' : m.stan === 'plan' ? 'meal-plan' : ''}">
    <div class="item-content">
      <div class="item-inner" style="display:block;padding-top:10px;padding-bottom:10px">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">
          ${godziny(m, reguly)}${esc(SLOT_LABEL[m.slot] ?? m.slot)}
        </div>
        <div class="item-title" style="white-space:normal;font-weight:600;line-height:1.35">${esc(m.name)}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">${macros}</div>
        ${chips ? `<div style="margin-top:6px">${chips}</div>` : ''}
        <div style="display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap">
          <form method="POST" action="/meal/${m.id}/stan" style="display:flex;gap:8px;align-items:center;margin:0">
            <select name="stan" onchange="this.form.submit()" style="min-height:36px;width:auto;font-size:13px;padding:4px 8px">
              ${STANY.map(([v, l]) =>
                `<option value="${v}" ${m.stan === v ? 'selected' : ''}>${l}</option>`
              ).join('')}
            </select>
            ${m.stan === 'zjedzony' ? `<select name="fraction" onchange="this.form.submit()" style="min-height:36px;width:auto;font-size:13px;padding:4px 8px">
              ${[1, 0.75, 0.5, 0.25].map((f) =>
                `<option value="${f}" ${Math.abs(m.eaten_fraction - f) < 0.01 ? 'selected' : ''}>${f === 1 ? 'całość' : `${f * 100}%`}</option>`
              ).join('')}
            </select>` : `<input type="hidden" name="fraction" value="${m.eaten_fraction}">`}
          </form>
          <a href="/meal/${m.id}/edit" class="button button-small" style="margin-left:auto">Edytuj</a>
        </div>
      </div>
    </div>
  </li>`;
}

day.get('/', async (c) => renderDay(c, todayWarsaw()).then((html) => c.html(html)));

day.get('/day/:date', async (c) => {
  const date = c.req.param('date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.redirect('/');
  return c.html(await renderDay(c, date));
});

day.post('/meal/:id/stan', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.parseBody();
  const stan = STANY.some(([v]) => v === body.stan) ? String(body.stan) : 'zjedzony';
  const fraction = Number(body.fraction ?? 1) || 1;

  const row = await c.env.DB.prepare(`SELECT date, eaten_at FROM meals WHERE id = ?`)
    .bind(id).first<{ date: string; eaten_at: string | null }>();

  // Przejscie w "zjedzone" stempluje godzine, jesli jeszcze jej nie ma i chodzi
  // o dzisiaj. Bez tego pudelka z cateringu nigdy nie maja godziny, a wtedy nie
  // da sie policzyc przerw miedzy posilkami, czyli jedynej rzeczy, ktora tu
  // realnie pracuje na motoryke. Godzine mozna potem poprawic w edycji posilku.
  const stempel =
    stan === 'zjedzony' && !row?.eaten_at && row?.date === todayWarsaw()
      ? new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false,
        }).format(new Date())
      : null;

  await c.env.DB.prepare(
    `UPDATE meals SET stan = ?, eaten_fraction = ?, eaten_at = COALESCE(?, eaten_at) WHERE id = ?`
  ).bind(stan, fraction, stempel, id).run();

  return c.redirect(`/day/${row?.date ?? todayWarsaw()}`);
});

export default day;
