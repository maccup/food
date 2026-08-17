import { Hono } from 'hono';
import { Env } from '../types';
import { page, card, blockTitle, emptyState, esc, pl, todayWarsaw, shiftDate, daysBetween, DAY_NAMES, poniedzialek } from '../views/ui';
import { loadSettings } from '../utils/settings';
import { statystykaPrzerw, PosilekDoPrzerw } from '../utils/gaps-stats';
import { ulozPlan, DobaZegarka, TreningWpis, Zalecenie } from '../utils/trening';
import { ulozWnioski, Wniosek } from '../utils/wnioski';
import { slupkowy, zwinDoTygodni, etykietaDnia, Slupek } from '../views/charts';
import { sekcjeZegarka } from './watch';

/**
 * Statystyki z dowolnego zakresu dat.
 *
 * Zastapily ekran tygodnia, ktory liczyl na sztywno siedem dni wstecz. Zakres
 * siedzi w adresie, wiec da sie go zapisac w zakladce i wkleic w rozmowie.
 */
const stats = new Hono<{ Bindings: Env }>();

const ZAKRESY: Array<[string, string]> = [
  ['7', '7 dni'],
  ['30', '30 dni'],
  ['90', '90 dni'],
  ['rok', 'rok'],
];

function okres(zakres: string, od: string | undefined, doDnia: string | undefined) {
  const dzis = todayWarsaw();
  if (od && doDnia) return { od, do: doDnia, zakres: 'wlasny' };

  if (zakres === '90') return { od: shiftDate(dzis, -89), do: dzis, zakres };
  if (zakres === 'rok') return { od: shiftDate(dzis, -364), do: dzis, zakres };
  if (zakres === '30') return { od: shiftDate(dzis, -29), do: dzis, zakres };
  return { od: shiftDate(dzis, -6), do: dzis, zakres: '7' };
}

function czasPl(minuty: number): string {
  const h = Math.floor(Math.abs(minuty) / 60);
  const m = Math.abs(minuty) % 60;
  return `${minuty < 0 ? '−' : ''}${h} h ${String(m).padStart(2, '0')}`;
}

/** Stary adres zostaje zywy, zeby nie psuc zakladek. */
stats.get('/week', (c) => c.redirect('/statystyki?zakres=7'));

stats.get('/statystyki', async (c) => {
  const db = c.env.DB;
  const o = okres(
    c.req.query('zakres') ?? '7',
    c.req.query('od') || undefined,
    c.req.query('do') || undefined
  );
  const dniZakresu = daysBetween(o.od, o.do) + 1;

  const [totals, phase, coverage, rules, breaches, posilki, objawy, stolce, stresDni, stolceDat] = await Promise.all([
    db.prepare(`SELECT * FROM v_day_totals WHERE date BETWEEN ? AND ? ORDER BY date`).bind(o.od, o.do).all<any>(),
    db.prepare(`SELECT * FROM phases WHERE ? >= date_from AND (date_to IS NULL OR ? <= date_to) LIMIT 1`)
      .bind(o.do, o.do).first<any>(),
    db.prepare(
      `SELECT group_id, COUNT(DISTINCT date) AS days FROM v_group_coverage
       WHERE date BETWEEN ? AND ? GROUP BY group_id`
    ).bind(o.od, o.do).all<any>(),
    db.prepare(
      `SELECT r.group_id, r.min_days_per_week, r.severity, r.rationale, g.name, g.provides
       FROM coverage_rules r JOIN food_groups g ON g.id = r.group_id
       WHERE (r.active_from IS NULL OR r.active_from <= ?) AND (r.active_to IS NULL OR r.active_to >= ?)
       ORDER BY CASE r.severity WHEN 'critical' THEN 1 WHEN 'important' THEN 2 ELSE 3 END`
    ).bind(o.do, o.od).all<any>(),
    db.prepare(
      `SELECT food_name, level, COUNT(*) AS n FROM v_restriction_breaches
       WHERE date BETWEEN ? AND ? AND stan = 'zjedzony'
       GROUP BY food_name, level ORDER BY level DESC, n DESC`
    ).bind(o.od, o.do).all<any>(),
    db.prepare(
      `SELECT id, date, sitting, eaten_at, duration_min, kcal, protein_g, fat_g, stan FROM meals
       WHERE date BETWEEN ? AND ? ORDER BY date, COALESCE(eaten_at, '99:99'), id`
    ).bind(o.od, o.do).all<PosilekDoPrzerw & { date: string }>(),
    db.prepare(
      `SELECT kind, COUNT(*) AS n, ROUND(AVG(severity), 1) AS srednia FROM symptoms
       WHERE date BETWEEN ? AND ? GROUP BY kind ORDER BY n DESC`
    ).bind(o.od, o.do).all<any>(),
    db.prepare(
      `SELECT bristol, COUNT(*) AS n FROM stools WHERE date BETWEEN ? AND ? GROUP BY bristol ORDER BY bristol`
    ).bind(o.od, o.do).all<any>(),
    db.prepare(
      `SELECT date, level, powod FROM stress WHERE date BETWEEN ? AND ? ORDER BY date`
    ).bind(o.od, o.do).all<any>(),
    // Doba przed poczatkiem i dwie po koncu zakresu, bo kazdy dzien ze stresem
    // ogladamy z czterema przesunieciami, od minus jednego do plus dwoch.
    db.prepare(
      `SELECT date, bristol FROM stools WHERE date BETWEEN ? AND ? ORDER BY date`
    ).bind(shiftDate(o.od, -1), shiftDate(o.do, 2)).all<any>(),
  ]);

  // Medytacja z zegarka, do sekcji stresu i wnioskow. Zero i NULL znacza co
  // innego (patrz import): zero to dzien sprawdzony bez praktyki, NULL to
  // doba sprzed poczatku pomiarow, wiec NULL-e w ogole nie wchodza do mianownika.
  const medytacje = await db.prepare(
    `SELECT date, medytacja_min FROM watch WHERE date BETWEEN ? AND ? AND medytacja_min IS NOT NULL`
  ).bind(o.od, o.do).all<any>();
  const medDni = (medytacje.results ?? []) as Array<{ date: string; medytacja_min: number }>;
  const medPraktyka = medDni.filter((m) => m.medytacja_min > 0);
  const medytacja = medDni.length
    ? {
        dniZDanymi: medDni.length,
        dniZPraktyka: medPraktyka.length,
        sredniaMin: medPraktyka.length
          ? medPraktyka.reduce((a, m) => a + m.medytacja_min, 0) / medPraktyka.length
          : 0,
      }
    : null;

  const targets = phase
    ? await db.prepare(`SELECT metric, min_value, max_value FROM targets WHERE phase_id = ?`).bind(phase.id).all<any>()
    : { results: [] };
  const t = new Map<string, any>((targets.results ?? []).map((x: any) => [x.metric, x]));

  const settings = await loadSettings(db);
  const minGap = Number(settings.get('min_gap_hours') || 4);
  const przerwy = statystykaPrzerw(
    posilki.results ?? [],
    {
      progKcal: Number(settings.get('gap_kcal_prog') || 30),
      progMakro: Number(settings.get('gap_makro_prog') || 1),
      domyslneTrwanie: Number(settings.get('default_meal_min') || 30),
    },
    minGap * 60
  );

  // Ta sama komorka co na starym ekranie tygodnia: kolor plus strzalka, bo sam
  // odcien to za malo przy daltonizmie i w sloncu.
  const cell = (value: number, metric: string) => {
    const spec = t.get(metric);
    if (!spec) return `<td style="text-align:right">${pl(value, 0)}</td>`;
    const bad =
      (spec.min_value !== null && value < spec.min_value * 0.9) ||
      (spec.max_value !== null && value > spec.max_value * 1.1);
    const warn =
      !bad &&
      ((spec.min_value !== null && value < spec.min_value) ||
        (spec.max_value !== null && value > spec.max_value));
    const color = bad ? 'var(--bad)' : warn ? 'var(--warn)' : 'var(--ok)';
    const low = spec.min_value !== null && value < spec.min_value;
    const mark = bad || warn ? (low ? '↓' : '↑') : '';
    return `<td style="text-align:right;color:${color};font-weight:600;white-space:nowrap">${pl(value, 0)}<span style="font-size:11px">${mark}</span></td>`;
  };

  const lista = totals.results ?? [];
  const srednia = (key: string, z: any[] = lista) =>
    z.length ? z.reduce((a: number, d: any) => a + Number(d[key] ?? 0), 0) / z.length : 0;

  /*
   * Do 14 dni tabela idzie dzien po dniu. Powyzej zwija sie w tygodnie, bo
   * 365 wierszy nikt nie czyta, a srednia tygodniowa jest i tak wlasciwa
   * jednostka: reguly pokrycia grup sa tygodniowe.
   */
  const poTygodniach = dniZakresu > 14;

  let rows = '';
  if (poTygodniach) {
    const grupy = new Map<string, any[]>();
    for (const d of lista) {
      const k = poniedzialek(d.date);
      if (!grupy.has(k)) grupy.set(k, []);
      grupy.get(k)!.push(d);
    }
    rows = [...grupy.entries()].map(([start, dni]) => `<tr>
      <td><a href="/statystyki?od=${start}&do=${shiftDate(start, 6)}">${start.slice(8)}.${start.slice(5, 7)}</a>
        <span style="color:var(--muted);font-size:11px">${dni.length} dni</span></td>
      ${cell(srednia('kcal', dni), 'kcal')}${cell(srednia('protein_g', dni), 'protein_g')}${cell(srednia('fat_g', dni), 'fat_g')}${cell(srednia('carbs_g', dni), 'carbs_g')}${cell(srednia('fiber_g', dni), 'fiber_g')}
    </tr>`).join('');
  } else {
    rows = lista.map((d: any) => {
      const dow = DAY_NAMES[new Date(`${d.date}T12:00:00Z`).getUTCDay()].slice(0, 3);
      return `<tr>
        <td><a href="/day/${d.date}">${dow} ${d.date.slice(8)}.${d.date.slice(5, 7)}</a></td>
        ${cell(d.kcal, 'kcal')}${cell(d.protein_g, 'protein_g')}${cell(d.fat_g, 'fat_g')}${cell(d.carbs_g, 'carbs_g')}${cell(d.fiber_g, 'fiber_g')}
      </tr>`;
    }).join('');
  }

  /*
   * Trend makro nad tabela: trzy wykresy dla kalorii oraz dwoch makr, ktore
   * koloruja kalendarz (tluszcz i blonnik). Tabela mowi „ile", wykres mowi
   * „czy to sie trzyma pasma", i to drugie pytanie jest wazniejsze.
   * Zwijanie w tygodnie idzie tym samym progiem i tym samym agregatem co
   * tabela obok, zeby obie rzeczy pokazywaly te same liczby.
   */
  const seriaMakro = (key: string): Slupek[] => {
    const dnie = lista.map((d: any) => ({ date: d.date, v: Number(d[key] ?? 0) }));
    return poTygodniach
      ? zwinDoTygodni(dnie, 'srednia')
      : dnie.map((x) => ({ etykieta: etykietaDnia(x.date), v: x.v }));
  };
  const wykresMakro = (key: string, nazwa: string, unit: string) => {
    const spec = t.get(key);
    const pasmo = spec ? { min: spec.min_value, max: spec.max_value } : null;
    const podpis = spec && spec.min_value !== null && spec.max_value !== null
      ? `, pasmo ${pl(spec.min_value, 0)} do ${pl(spec.max_value, 0)} ${unit}` : '';
    return `<div style="margin-bottom:14px">
      <div style="font-size:12px;color:var(--muted);margin-bottom:4px">${esc(nazwa)}${podpis}</div>
      ${slupkowy(seriaMakro(key), { pasmo, format: (v) => `${Math.round(v)} ${unit}` })}
    </div>`;
  };
  const wykresyMakro = lista.length >= 2
    ? card(`
      <div class="cols">
        ${wykresMakro('kcal', 'Kalorie', 'kcal')}
        ${wykresMakro('fat_g', 'Tłuszcz', 'g')}
        ${wykresMakro('fiber_g', 'Błonnik', 'g')}
      </div>
      <p class="hint" style="margin:0">
        Zielone słupki mieszczą się w paśmie fazy, bursztynowe są poza nim, przerywane kreski to granice pasma.
        Skala zaczyna się od najniższego ${poTygodniach ? 'tygodnia' : 'dnia'}, nie od zera, więc różnice wyglądają na większe, niż są.
      </p>`)
    : '';

  const table = lista.length
    ? `<div style="overflow-x:auto"><table class="data-table" style="width:100%;font-size:13px">
        <thead><tr><th>${poTygodniach ? 'Tydzień od' : 'Dzień'}</th><th style="text-align:right">kcal</th><th style="text-align:right">B</th><th style="text-align:right">T</th><th style="text-align:right">W</th><th style="text-align:right">bł</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="border-top:2px solid rgba(0,0,0,.15)">
          <td><b>średnia</b></td>
          ${cell(srednia('kcal'), 'kcal')}${cell(srednia('protein_g'), 'protein_g')}${cell(srednia('fat_g'), 'fat_g')}${cell(srednia('carbs_g'), 'carbs_g')}${cell(srednia('fiber_g'), 'fiber_g')}
        </tr></tfoot>
      </table></div>`
    : emptyState('Brak wpisów z tego zakresu.');

  /*
   * Kompletnosc na samej gorze i celowo przed kazda inna liczba. Srednia z trzech
   * dni wyglada na ekranie identycznie jak srednia z trzydziestu, a znaczy co innego.
   */
  const kompletnosc = card(`
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
      <span style="font-size:13px;color:var(--muted)">Dni z wpisami</span>
      <b style="font-size:19px">${lista.length} <span style="font-size:13px;font-weight:400;color:var(--muted)">z ${dniZakresu}</span></b>
    </div>
    ${lista.length < dniZakresu
      ? `<p class="hint" style="margin:6px 0 0">Reszta liczb dotyczy tylko dni z wpisami. Puste dni nie są wliczane do średnich.</p>`
      : ''}`);

  const przerwyHtml = przerwy.przerwy
    ? card(`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <div style="font-size:12px;color:var(--muted)">Średnia przerwa</div>
          <b style="font-size:19px;color:${przerwy.srednia >= minGap * 60 ? 'var(--ok)' : 'var(--bad)'}">${czasPl(przerwy.srednia)}</b>
        </div>
        <div>
          <div style="font-size:12px;color:var(--muted)">Najkrótsza</div>
          <b style="font-size:19px;color:${(przerwy.najkrotsza ?? 0) >= minGap * 60 ? 'var(--ok)' : 'var(--bad)'}">${czasPl(przerwy.najkrotsza ?? 0)}</b>
        </div>
        <div>
          <div style="font-size:12px;color:var(--muted)">Poniżej ${minGap} h</div>
          <b style="font-size:19px;color:${przerwy.ponizejProgu ? 'var(--bad)' : 'var(--ok)'}">${przerwy.ponizejProgu} z ${przerwy.przerwy}</b>
        </div>
        <div>
          <div style="font-size:12px;color:var(--muted)">Dni z za krótką</div>
          <b style="font-size:19px;color:${przerwy.dniPonizejProgu ? 'var(--bad)' : 'var(--ok)'}">${przerwy.dniPonizejProgu} z ${przerwy.dni}</b>
        </div>
      </div>
      <p class="hint" style="margin:10px 0 0">
        Przerwa liczy się od końca całego podejścia do początku następnego. Pozycje poniżej progu
        kalorycznego, jak czarne espresso, przerwy nie przerywają.
      </p>`)
    : emptyState('Za mało wpisów z godzinami, żeby policzyć przerwy.');

  const covBy = new Map<number, any>((coverage.results ?? []).map((x: any) => [x.group_id, x]));
  const tygodni = Math.max(1, dniZakresu / 7);
  // Najpierw dane, potem HTML: status grup czytaja dwa miejsca, lista nizej
  // i silnik wnioskow na gorze ekranu.
  const grupyStatus = (rules.results ?? []).map((r: any) => {
    // Norma jest tygodniowa, wiec przy dluzszym zakresie porownujemy srednia na tydzien.
    const naTydzien = (covBy.get(r.group_id)?.days ?? 0) / tygodni;
    const need = r.min_days_per_week ?? 0;
    return { ...r, naTydzien, need, ok: naTydzien >= need };
  });
  const gaps = grupyStatus.map((r: any) => {
    const color = r.ok ? 'var(--ok)' : r.severity === 'critical' ? 'var(--bad)' : 'var(--warn)';
    return `<li>
      <div class="item-content"><div class="item-inner" style="display:block;padding:10px 0">
        <div style="display:flex;justify-content:space-between;gap:8px">
          <b style="font-size:14px">${esc(r.name)}</b>
          <span style="color:${color};font-weight:700;white-space:nowrap">${pl(r.naTydzien, 1)} z ${r.need} dni/tydz.</span>
        </div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">daje: ${esc(r.provides ?? '')}</div>
        ${!r.ok && r.rationale ? `<div style="font-size:12px;color:${color};margin-top:4px">${esc(r.rationale)}</div>` : ''}
      </div></div>
    </li>`;
  }).join('');

  const breachList = (breaches.results ?? []).length
    ? `<div class="list simple-list"><ul>${(breaches.results ?? []).map((b: any) =>
        `<li><span>${esc(b.food_name)}</span><span style="color:${b.level === 'forbidden' ? 'var(--bad)' : 'var(--warn)'}">${b.level === 'forbidden' ? 'zakazane' : 'limit'} &middot; ${b.n}x</span></li>`
      ).join('')}</ul></div>`
    : emptyState('Żadnych naruszeń w tym zakresie.');

  // Stolce po datach: czyta to wykres trendu nizej oraz sekcja stresu, ktora
  // oglada kazdy dzien z czterema przesunieciami.
  const stolceWgDat = new Map<string, number[]>();
  for (const s of stolceDat.results ?? []) {
    if (!stolceWgDat.has(s.date)) stolceWgDat.set(s.date, []);
    stolceWgDat.get(s.date)!.push(s.bristol);
  }

  /*
   * Stolec w czasie: srednia dnia na sztywnej skali 0 do 7 z pasmem 3 do 4.
   * Rozklad slupkowy nizej mowi „jakie byly", ten wykres mowi „kiedy", a przy
   * leczeniu jelita kierunek zmiany jest wazniejszy niz rozklad.
   */
  const stolceDniSeria: Array<{ date: string; v: number }> = [...stolceWgDat.entries()]
    .filter(([data]) => data >= o.od && data <= o.do)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, b]) => ({ date: data, v: b.reduce((x, y) => x + y, 0) / b.length }));
  const stolceTrend = stolceDniSeria.length >= 2
    ? `<div style="font-size:12px;color:var(--muted);margin-bottom:4px">Postać w czasie, pasmo prawidłowe 3 do 4</div>
       ${slupkowy(
         dniZakresu > 92 ? zwinDoTygodni(stolceDniSeria, 'srednia') : stolceDniSeria.map((x) => ({ etykieta: etykietaDnia(x.date), v: x.v })),
         { pasmo: { min: 3, max: 4 }, skala: { min: 0, max: 7 }, format: (v) => `Bristol ${v.toFixed(1).replace('.', ',')}` }
       )}
       <p class="hint" style="margin:6px 0 14px">
         Słupek to średnia z wpisów dnia w skali Bristol: niski to zaparcie, wysoki to biegunka,
         zielony mieści się w paśmie prawidłowym. Dni bez wpisu nie mają słupka.
       </p>`
    : '';

  const stolceLista = stolce.results ?? [];
  const stolceRazem = stolceLista.reduce((a: number, s: any) => a + s.n, 0);
  const zdrowiaHtml = (objawy.results ?? []).length || stolceRazem
    ? card(`
      ${stolceRazem ? stolceTrend : ''}
      ${stolceRazem ? `
        <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Stolce, skala Bristol (${stolceRazem} wpisów)</div>
        <div style="display:flex;gap:4px;align-items:flex-end;height:56px;margin-bottom:14px">
          ${[1, 2, 3, 4, 5, 6, 7].map((b) => {
            const n = stolceLista.find((s: any) => s.bristol === b)?.n ?? 0;
            const h = stolceRazem ? Math.round((n / stolceRazem) * 44) : 0;
            // 3 i 4 to postac prawidlowa, 1 i 2 to zaparcie, 6 i 7 biegunka.
            const kolor = b === 3 || b === 4 ? 'var(--ok)' : b <= 2 ? 'var(--warn)' : 'var(--bad)';
            return `<div style="flex:1;text-align:center">
              <div style="height:${Math.max(h, n ? 4 : 1)}px;background:${n ? kolor : 'var(--hairline)'};border-radius:3px 3px 0 0"></div>
              <div style="font-size:10px;color:var(--muted);margin-top:3px">${b}</div>
              <div style="font-size:11px;font-weight:600">${n || ''}</div>
            </div>`;
          }).join('')}
        </div>` : ''}
      ${(objawy.results ?? []).length
        ? `<div style="font-size:12px;color:var(--muted);margin-bottom:4px">Objawy</div>
           ${(objawy.results ?? []).map((s: any) =>
             `<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0">
                <span>${esc(s.kind)}</span><span style="color:var(--muted)">${s.n}x, średnio ${pl(s.srednia ?? 0, 1)}/10</span>
              </div>`).join('')}`
        : '<p class="hint" style="margin:0">Żadnych objawów w tym zakresie.</p>'}`)
    : emptyState('Brak wpisów o objawach i stolcu.');

  /*
   * Stres wobec stolca, cztery przesuniecia zamiast jednego.
   *
   * Stres uderza w jelito dwoma roznymi drogami, o roznym czasie reakcji, wiec
   * pojedyncza kolumna musi jedna z nich przegapic:
   *
   *   - Przyspieszenie okreznicy idzie przez CRF w skali minut i godzin. Widac
   *     je TEGO SAMEGO dnia jako parcie i stolec luzniejszy.
   *   - Twardosc dziala zupelnie inaczej. Stolec oddany dzis powstal z jedzenia
   *     sprzed jednej do trzech dob, a to, ile stracil wody, zalezy od calego
   *     czasu spedzonego w okreznicy. Zaparcie po napietym dniu wychodzi wiec
   *     NAZAJUTRZ albo dwa dni pozniej, nie tego wieczoru.
   *
   * Kolumna „dzien przed" jest kontrola i jest tu celowo. Jesli koreluje tak
   * samo mocno jak „nazajutrz", to albo zaleznosc jest pozorna, albo dziala
   * odwrotnie, czyli to zly dzien jelitowy nakreca stres. Osobno istnieje
   * napiecie wyprzedzajace, gdy jelito reaguje na dzien, ktory dopiero ma
   * nadejsc, i wtedy ta kolumna tez sie odezwie.
   *
   * Srodek skali, czyli 4 i 5, nie wchodzi do zadnej grupy. Porownanie ma
   * odpowiadac na pytanie „czy dni napiete roznia sie od spokojnych", a dzien
   * przecietny nie jest ani jednym, ani drugim i tylko rozmyclby obie strony.
   */
  const stresLista = (stresDni.results ?? []) as Array<{ date: string; level: number; powod: string | null }>;
  const sredniStres = stresLista.length
    ? stresLista.reduce((a, s) => a + s.level, 0) / stresLista.length
    : 0;

  const podsumuj = (dni: string[], przesuniecie: number) => {
    const b = dni.flatMap((d) => stolceWgDat.get(shiftDate(d, przesuniecie)) ?? []);
    return {
      ile: b.length,
      naDzien: dni.length ? b.length / dni.length : 0,
      twarde: b.filter((x) => x <= 2).length,
      srednia: b.length ? b.reduce((a, x) => a + x, 0) / b.length : 0,
    };
  };

  const napiete = stresLista.filter((s) => s.level >= 6).map((s) => s.date);
  const spokojne = stresLista.filter((s) => s.level <= 3).map((s) => s.date);
  const MIN_DNI = 3;

  const LAGI: Array<[number, string]> = [
    [-1, 'dzień przed'],
    [0, 'tego dnia'],
    [1, 'nazajutrz'],
    [2, 'dwa dni po'],
  ];

  const komorka = (dni: string[], lag: number) => {
    const w = podsumuj(dni, lag);
    if (!w.ile) return `<td style="text-align:right;color:var(--muted)">–</td>`;
    // Pasmo prawidlowe to 3 i 4. Ponizej zaparcie, powyzej biegunka, wiec
    // odchylenie w kazda strone dostaje ten sam kolor ostrzegawczy.
    const kolor = w.srednia < 3 || w.srednia > 5 ? 'var(--warn)' : 'var(--ok)';
    return `<td style="text-align:right;white-space:nowrap">
      <b style="color:${kolor}">${pl(w.srednia, 1)}</b>
      <div style="font-size:11px;color:var(--muted)">${w.twarde} z ${w.ile} twarde</div>
    </td>`;
  };

  const porownanie = napiete.length >= MIN_DNI && spokojne.length >= MIN_DNI
    ? `<div style="overflow-x:auto"><table class="data-table" style="width:100%;font-size:13px">
        <thead><tr>
          <th>Stolce</th>
          <th style="text-align:right">po dniu napiętym<br><span style="font-weight:400;color:var(--muted)">${napiete.length} dni</span></th>
          <th style="text-align:right">po dniu spokojnym<br><span style="font-weight:400;color:var(--muted)">${spokojne.length} dni</span></th>
        </tr></thead>
        <tbody>${LAGI.map(([lag, opis]) => `<tr>
          <td>${opis}</td>${komorka(napiete, lag)}${komorka(spokojne, lag)}
        </tr>`).join('')}</tbody>
      </table></div>
      <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-top:10px">
        <span style="color:var(--muted)">Stolców na dzień</span>
        <b>${pl(podsumuj(napiete, 0).naDzien, 1)} kontra ${pl(podsumuj(spokojne, 0).naDzien, 1)}</b>
      </div>
      <p class="hint" style="margin:10px 0 0">
        Liczba u góry komórki to średnia postać stolca w skali Bristol, pasmo prawidłowe to 3 do 4.
        Wiersze to opóźnienie: napięcie przyspiesza jelito w ciągu godzin, czyli tego samego dnia,
        ale twardość powstaje inaczej. Stolec oddany dziś to jedzenie sprzed jednej do trzech dób,
        więc zaparcie po napiętym dniu wychodzi nazajutrz albo dwa dni później.
        Wiersz „dzień przed" jest kontrolą: jeśli odzywa się tak samo mocno jak „nazajutrz",
        to albo zależność jest pozorna, albo działa odwrotnie i to zły dzień jelitowy nakręca stres.
      </p>`
    : `<p class="hint" style="margin:0">
        Za mało dni, żeby porównywać. Potrzeba minimum ${MIN_DNI} dni napiętych i ${MIN_DNI} spokojnych,
        jest ${napiete.length} i ${spokojne.length}. Do tego czasu tabela niżej pokazuje surowe dni
        i nic nie uśrednia.
      </p>`;

  const dzienPoDniu = stresLista.length && dniZakresu <= 31
    ? `<div style="overflow-x:auto;margin-top:12px"><table class="data-table" style="width:100%;font-size:13px">
        <thead><tr><th>Dzień</th><th style="text-align:right">stres</th><th>tego dnia</th><th>nazajutrz</th><th>dwa dni po</th></tr></thead>
        <tbody>${stresLista.map((s) => {
          const kolorStres = s.level >= 6 ? 'var(--bad)' : s.level >= 4 ? 'var(--warn)' : 'var(--ok)';
          const bristole = (lag: number) => (stolceWgDat.get(shiftDate(s.date, lag)) ?? []).join(', ') || '–';
          return `<tr>
            <td><a href="/day/${s.date}">${s.date.slice(8)}.${s.date.slice(5, 7)}</a>${s.powod ? ` <span style="color:var(--muted);font-size:11px">${esc(s.powod)}</span>` : ''}</td>
            <td style="text-align:right;color:${kolorStres};font-weight:600">${s.level}</td>
            <td>${bristole(0)}</td>
            <td>${bristole(1)}</td>
            <td>${bristole(2)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`
    : '';

  const medytacjaWiersz = medytacja
    ? `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:12px">
        <span style="font-size:13px;color:var(--muted)">Medytacja z zegarka</span>
        <b style="font-size:15px">${medytacja.dniZPraktyka} z ${medytacja.dniZDanymi} dni${
          medytacja.dniZPraktyka ? `<span style="font-size:13px;font-weight:400;color:var(--muted)">, średnio ${pl(medytacja.sredniaMin, 0)} min</span>` : ''
        }</b>
      </div>`
    : '';

  const stresHtml = stresLista.length
    ? card(`
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:12px">
        <span style="font-size:13px;color:var(--muted)">Wpisany stres, średnia</span>
        <b style="font-size:19px">${pl(sredniStres, 1)}<span style="font-size:13px;font-weight:400;color:var(--muted)">/10 z ${stresLista.length} dni</span></b>
      </div>
      ${medytacjaWiersz}
      ${porownanie}
      ${dzienPoDniu}`)
    : medytacja
      // Wiersz medytacji nie moze znikac razem z brakiem wpisow o stresie:
      // zegarek mierzy praktyke niezaleznie od tego, czy wieczorny wpis powstal.
      ? card(`${medytacjaWiersz}
          <p class="hint" style="margin:0">Żadnego wpisu o stresie w tym zakresie. Wpisuje się go wieczorem, w zakładce Dopisz.</p>`)
      : emptyState('Żadnego wpisu o stresie w tym zakresie. Wpisuje się go wieczorem, w zakładce Dopisz.');

  /*
   * Plan treningowy NIE zalezy od wybranego zakresu i to jest celowe. Reszta
   * ekranu odpowiada na pytanie „jak bylo", ten kawalek na „co dzisiaj", a to
   * drugie zawsze liczy sie z ostatnich 60 dob, niezaleznie od tego, co akurat
   * ustawione jest w filtrze. Inaczej wybranie roku zmienialoby zalecenie na
   * dzis, co nie mialoby zadnego sensu.
   */
  const dzis = todayWarsaw();
  const [zegarekPlan, treningiPlan] = await Promise.all([
    db.prepare(
      `SELECT date, hrv_noc, hrv, rhr, sen_min, kroki FROM watch WHERE date BETWEEN ? AND ? ORDER BY date`
    ).bind(shiftDate(dzis, -59), dzis).all<DobaZegarka & { kroki: number | null }>(),
    db.prepare(
      `SELECT date, typ_apple, minuty, kcal FROM workouts WHERE date BETWEEN ? AND ? ORDER BY date`
    ).bind(shiftDate(dzis, -59), dzis).all<TreningWpis>(),
  ]);

  const plan = ulozPlan(zegarekPlan.results ?? [], treningiPlan.results ?? [], dzis);

  /*
   * Wnioski i rekomendacje: pierwsza sekcja ekranu. Makra, stolec, stres,
   * przerwy i wykluczenia licza sie z wybranego zakresu, bo o nie pyta filtr.
   * Sen, ruch i regeneracja ida z ostatnich tygodni niezaleznie od filtra,
   * z tego samego powodu co plan treningowy: odpowiadaja na „co teraz robic",
   * a wybranie roku w filtrze nie moze zmieniac dzisiejszej rady.
   */
  const doby60 = zegarekPlan.results ?? [];
  const sen14 = doby60
    .filter((x): x is typeof x & { sen_min: number } => typeof x.sen_min === 'number')
    .slice(-14).map((x) => x.sen_min);
  const kroki30 = doby60
    .filter((x) => x.date >= shiftDate(dzis, -29) && typeof x.kroki === 'number')
    .map((x) => Number(x.kroki)).sort((a, b) => a - b);
  const krokiMediana = kroki30.length >= 7
    ? (kroki30[Math.floor((kroki30.length - 1) / 2)] + kroki30[Math.ceil((kroki30.length - 1) / 2)]) / 2
    : null;
  const stolcePoLagach = (dni: string[]) =>
    dni.flatMap((data) => [1, 2].flatMap((lag) => stolceWgDat.get(shiftDate(data, lag)) ?? []));

  const wnioski = ulozWnioski({
    dniZakresu,
    dniZWpisami: lista.length,
    srednie: {
      kcal: srednia('kcal'), protein_g: srednia('protein_g'), fat_g: srednia('fat_g'),
      carbs_g: srednia('carbs_g'), fiber_g: srednia('fiber_g'),
    },
    cel: (m) => t.get(m),
    przerwy: przerwy.przerwy ? { dni: przerwy.dni, dniPonizejProgu: przerwy.dniPonizejProgu } : null,
    minGapH: minGap,
    zakazane: (breaches.results ?? [])
      .filter((b: any) => b.level === 'forbidden')
      .map((b: any) => ({ nazwa: b.food_name, n: b.n })),
    grupyPonizej: grupyStatus
      .filter((g: any) => !g.ok)
      .map((g: any) => ({ nazwa: g.name, naTydzien: g.naTydzien, celDni: g.need, krytyczna: g.severity === 'critical' })),
    bristole: (stolceDat.results ?? [])
      .filter((s: any) => s.date >= o.od && s.date <= o.do)
      .map((s: any) => Number(s.bristol)),
    stres: stresLista.length ? { dni: stresLista.length, srednia: sredniStres, napiete: napiete.length } : null,
    medytacja,
    stresStolec: napiete.length && spokojne.length
      ? { poNapietych: stolcePoLagach(napiete), poSpokojnych: stolcePoLagach(spokojne) }
      : null,
    sen14,
    krokiMediana,
    gotowosc: doby60.length ? plan.gotowosc : null,
  });

  const KOLOR_WNIOSKU: Record<Wniosek['poziom'], string> = {
    zrob: 'var(--warn)', uwaga: 'var(--muted)', ok: 'var(--ok)',
  };
  const wnioskiHtml = wnioski.length
    ? card(wnioski.map((w, i) => `
        <div style="display:flex;gap:10px;padding:8px 0${i ? ';border-top:1px solid var(--hairline)' : ''}">
          <div style="width:4px;border-radius:2px;background:${KOLOR_WNIOSKU[w.poziom]};flex:0 0 4px"></div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">
              <b style="font-size:14px">${esc(w.tytul)}</b>
              <span style="font-size:11px;color:var(--muted);white-space:nowrap">${esc(w.obszar)}</span>
            </div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px">${esc(w.opis)}</div>
          </div>
        </div>`).join('') + `
        <p class="hint" style="margin:10px 0 0">
          Bursztyn to rzecz do zrobienia, szary to obserwacja, zielony to obszar, który działa.
          Każda liczba w opisie pochodzi z sekcji niżej na tym ekranie, więc da się ją sprawdzić.
          To podpowiedzi liczone regułami, nie porada lekarska.
        </p>`)
    : emptyState('Za mało danych w tym zakresie, żeby cokolwiek doradzać.');

  const KOLOR_ZALECENIA: Record<Zalecenie, string> = {
    sila: 'var(--ok)',
    interwaly: 'var(--bad)',
    cardio: 'var(--accent, #14B8A6)',
    mobilnosc: 'var(--muted)',
    odpoczynek: 'var(--warn)',
    zrobione: 'var(--muted)',
  };

  const kolorGotowosci = plan.gotowosc.stan === 'zielona' ? 'var(--ok)'
    : plan.gotowosc.stan === 'zolta' ? 'var(--warn)' : 'var(--bad)';

  const liczbaGotowosci = (etykieta: string, wartosc: string, dopisek = '') => `
    <div>
      <div style="font-size:12px;color:var(--muted)">${etykieta}</div>
      <b style="font-size:17px">${wartosc}</b>
      ${dopisek ? `<div style="font-size:11px;color:var(--muted)">${dopisek}</div>` : ''}
    </div>`;

  const g = plan.gotowosc;
  const tyg = plan.tydzien;

  const planHtml = (zegarekPlan.results ?? []).length
    ? card(`
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:10px">
        <span style="font-size:13px;color:var(--muted)">Gotowość</span>
        <b style="font-size:19px;color:${kolorGotowosci};text-transform:capitalize">${g.stan}</b>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">
        ${liczbaGotowosci('HRV 7 dni', g.hrv7 === null ? '–' : `${pl(g.hrv7, 1)} ms`,
          g.hrvDolnaGranica === null ? 'brak progu' : `granica ${pl(g.hrvDolnaGranica, 1)}`)}
        ${liczbaGotowosci('Tętno spocz.', g.rhr7 === null ? '–' : `${pl(g.rhr7, 0)}`,
          g.rhrDelta === null ? '' : `${g.rhrDelta >= 0 ? '+' : ''}${pl(g.rhrDelta, 1)} wobec normy`)}
        ${liczbaGotowosci('Niedobór snu', g.dlugSnuMin === null ? '–' : `${pl(g.dlugSnuMin / 60, 1)} h`, 'z 3 dób')}
      </div>
      ${g.powody.length
        ? `<div style="font-size:12px;color:${kolorGotowosci};margin-bottom:12px">${g.powody.map(esc).join('<br>')}</div>`
        : `<div style="font-size:12px;color:var(--ok);margin-bottom:12px">Wszystkie trzy sygnały w Twojej normie.</div>`}

      <div style="border-top:1px solid var(--hairline);padding-top:10px;margin-bottom:10px;font-size:12px;color:var(--muted)">
        Ten tydzień: siła ${tyg.silaDni} dni, aerobowo ${tyg.aerobMin} min,
        intensywnie ${tyg.intensywneSesje} ${tyg.intensywneSesje === 1 ? 'sesja' : 'sesji'},
        ${tyg.dniZRzedu} ${tyg.dniZRzedu === 1 ? 'dzień' : 'dni'} z rzędu bez przerwy
      </div>

      ${plan.dni.map((d, i) => {
        const dow = DAY_NAMES[new Date(`${d.date}T12:00:00Z`).getUTCDay()];
        const kolor = KOLOR_ZALECENIA[d.zalecenie];
        return `<div style="display:flex;gap:10px;padding:8px 0${i ? ';border-top:1px solid var(--hairline)' : ''}">
          <div style="width:4px;border-radius:2px;background:${kolor};flex:0 0 4px"></div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">
              <b style="font-size:14px;color:${kolor}">${esc(d.tytul)}</b>
              <span style="font-size:12px;color:var(--muted);white-space:nowrap">
                ${i === 0 ? 'dziś' : `${dow.slice(0, 3)} ${d.date.slice(8)}.${d.date.slice(5, 7)}`}
              </span>
            </div>
            ${i === 0 || d.zalecenie !== plan.dni[i - 1].zalecenie
              ? `<div style="font-size:12px;color:var(--muted);margin-top:2px">${esc(d.opis)}</div>`
              : ''}
          </div>
        </div>`;
      }).join('')}

      <p class="hint" style="margin:10px 0 0">
        Dzisiejsze zalecenie liczy się z pomiarów. Kolejne dni to szkielet tygodnia przy założeniu,
        że wykonasz poprzednie i że gotowość się nie zmieni, więc jutro przelicz je od nowa.
        <a href="#norma">Skąd te liczby ›</a>
      </p>`)
    : emptyState('Brak danych z zegarka z ostatnich 60 dni, więc nie ma z czego liczyć gotowości.');

  // Sekcje zegarka: byly osobnym ekranem pod /zegarek, teraz sa czescia tego.
  const zegarekHtml = await sekcjeZegarka(db, o, dniZakresu);

  const przycisk = (wartosc: string, label: string) =>
    `<a href="/statystyki?zakres=${wartosc}" class="button button-small ${o.zakres === wartosc ? 'button-fill' : ''}">${label}</a>`;

  const content = `
    <div class="block" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
      ${ZAKRESY.map(([w, l]) => przycisk(w, l)).join('')}
    </div>

    <div class="block">
      <!-- Formularz wlasnego zakresu zwiniety domyslnie: na telefonie dwa pola
           daty i przycisk zjadaly pol ekranu, a uzywa sie ich rzadko. Zakres
           wlasny w adresie otwiera blok, zeby bylo widac, co jest ustawione. -->
      <details${o.zakres === 'wlasny' ? ' open' : ''}>
        <summary class="ocena-summary">Własny zakres dat ›</summary>
        <form method="GET" action="/statystyki" class="stats-filtr" style="margin-top:8px">
          <div class="field">
            <label class="field-label" for="st-od">Od</label>
            <input type="date" id="st-od" name="od" value="${esc(o.od)}">
          </div>
          <div class="field">
            <label class="field-label" for="st-do">Do</label>
            <input type="date" id="st-do" name="do" value="${esc(o.do)}">
          </div>
          <button type="submit" class="button button-small">Pokaż</button>
        </form>
      </details>
      <p class="hint" style="margin:6px 0 0">
        ${esc(o.od)} do ${esc(o.do)}, ${dniZakresu} dni${phase ? `, faza: ${esc(phase.name)}` : ''}
      </p>
    </div>

    ${blockTitle('Wnioski i rekomendacje', 'liczone z Twoich danych')}
    ${wnioskiHtml}

    ${blockTitle('Trening na najbliższe dni', 'z ostatnich 60 dób, niezależnie od filtra')}
    ${planHtml}

    ${blockTitle('Ile tego jest')}
    ${kompletnosc}

    ${blockTitle('Przerwy między podejściami', `cel: min. ${minGap} h`)}
    ${przerwyHtml}

    ${blockTitle('Makro', poTygodniach ? 'średnie tygodniowe' : 'dzień po dniu')}
    ${wykresyMakro}
    ${card(table)}

    ${blockTitle('Pokrycie grup produktów')}
    <div class="list media-list" style="margin:0"><ul>${gaps || emptyState('Brak reguł.')}</ul></div>

    ${blockTitle('Naruszenia wykluczeń')}
    ${breachList}

    ${blockTitle('Objawy i stolce')}
    ${zdrowiaHtml}

    ${blockTitle('Stres a stolec', 'dzień napięty kontra spokojny')}
    ${stresHtml}

    ${zegarekHtml}
  `;

  return c.html(page({ title: 'Statystyki', tab: 'stats', header: 'Statystyki', content }));
});

export default stats;
