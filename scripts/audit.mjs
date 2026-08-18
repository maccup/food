#!/usr/bin/env node
/**
 * Zrzut danych do przeglądu. Nie ocenia, tylko wyciąga wszystko, czego
 * potrzeba do oceny, w jednym miejscu i w czytelnej formie.
 *
 * Ocenę robi Claude na podstawie tego zrzutu plus dokumentów klinicznych
 * z repo "Longevity Agent". Procedura: patrz CLAUDE.md, sekcja "Przegląd danych".
 *
 * Uruchomienie:
 *   npm run audit              ostatnie 14 dni
 *   npm run audit -- 30        ostatnie 30 dni
 *   npm run audit -- 7 json    surowy JSON zamiast raportu
 */

import { execFileSync } from 'node:child_process';

const WRANGLER = './node_modules/.bin/wrangler';
const DNI = Number(process.argv[2]) || 14;
const FORMAT = process.argv[3] === 'json' ? 'json' : 'tekst';

function q(sql) {
  const out = execFileSync(
    WRANGLER,
    ['d1', 'execute', 'food', '--remote', '--json', '--command', sql.replace(/\s+/g, ' ').trim()],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env } }
  );
  const m = out.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (!m) return [];
  return JSON.parse(m[0])[0]?.results ?? [];
}

const OD = `date('now', '-${DNI} days')`;

const dane = {
  zakres: `ostatnie ${DNI} dni`,

  // 1. Czy sumy w ogole sa wiarygodne. Posilek na oko albo bez makr psuje dzien.
  dni: q(`
    SELECT d.date, d.kcal, d.protein_g, d.fat_g, d.carbs_g, d.fiber_g,
           d.meals_count, d.meals_estimated, d.meals_without_macros,
           p.name AS faza,
           (SELECT COUNT(*) FROM meals m WHERE m.date = d.date AND m.source = 'hfood') AS z_cateringu,
           (SELECT COUNT(*) FROM meals m WHERE m.date = d.date AND m.source != 'hfood') AS wpisane_recznie
    FROM v_day_totals d
    LEFT JOIN phases p ON d.date >= p.date_from AND (p.date_to IS NULL OR d.date <= p.date_to)
    WHERE d.date >= ${OD} ORDER BY d.date DESC`),

  // 2. Cele obowiazujace w biezacej fazie, zeby nie trzeba bylo ich pamietac.
  cele: q(`
    SELECT p.name AS faza, t.metric, t.min_value, t.max_value, t.source
    FROM targets t JOIN phases p ON p.id = t.phase_id
    WHERE date('now') >= p.date_from AND (p.date_to IS NULL OR date('now') <= p.date_to)`),

  // 3. Posilki wpisane recznie z pelnym skladem. To one wymagaja weryfikacji,
  //    bo makra sa szacowane, a sklad wpisywany wlasnym slownictwem.
  wpisane_recznie: q(`
    SELECT id, date, eaten_at, slot, source, name, kcal, protein_g, fat_g, carbs_g, fiber_g,
           estimated, stan, eaten_fraction, notes, ingredients_raw
    FROM meals WHERE source != 'hfood' AND date >= ${OD}
    ORDER BY date DESC, COALESCE(eaten_at, '99:99')`),

  // 4. Co zjedzone wbrew wykluczeniom.
  naruszenia: q(`
    SELECT date, slot, meal_name, food_name, level, reason
    FROM v_restriction_breaches WHERE date >= ${OD} AND stan = 'zjedzony'
    ORDER BY date DESC, level DESC`),

  // 5. Pokrycie grup wobec regul. Bierze caly zakres, wiec przy 14 dniach
  //    dziel przez dwa, zeby porownac z regula tygodniowa.
  pokrycie: q(`
    SELECT g.name AS grupa, g.provides AS daje, r.min_days_per_week AS wymagane_dni_tyg,
           r.severity AS waga,
           (SELECT COUNT(DISTINCT v.date) FROM v_group_coverage v
            WHERE v.group_id = g.id AND v.date >= ${OD}) AS dni_z_grupa
    FROM coverage_rules r JOIN food_groups g ON g.id = r.group_id
    ORDER BY CASE r.severity WHEN 'critical' THEN 1 WHEN 'important' THEN 2 ELSE 3 END`),

  // 6. Skladniki, ktorych slownik nie zna, czyli niewidoczne dla regul.
  nierozpoznane: q(`
    SELECT alias, times_seen, first_seen FROM food_aliases
    WHERE food_id IS NULL AND ignored = 0 ORDER BY times_seen DESC, alias`),

  // 7. Czy suplementy sa faktycznie brane.
  suplementy: q(`
    SELECT s.date, COUNT(*) AS zaplanowane,
           SUM(CASE WHEN l.taken = 1 THEN 1 ELSE 0 END) AS wziete
    FROM (SELECT DISTINCT date FROM meals WHERE date >= ${OD}) AS s
    JOIN supplement_schedule sc
      ON s.date >= sc.date_from AND (sc.date_to IS NULL OR s.date <= sc.date_to)
    JOIN supplements sup ON sup.id = sc.supplement_id AND sup.status NOT IN ('paused', 'discontinued')
    LEFT JOIN supplement_log l ON l.schedule_id = sc.id AND l.date = s.date
    GROUP BY s.date ORDER BY s.date DESC`),

  // 8. Objawy i stolec, jedyny miernik skutecznosci po decyzji o braku badan.
  objawy: q(`SELECT date, time, kind, severity, notes FROM symptoms WHERE date >= ${OD} ORDER BY date DESC, time`),
  stolce: q(`SELECT date, time, bristol, straining, incomplete, floating FROM stools WHERE date >= ${OD} ORDER BY date DESC, time`),

  // 9. Otwarte testy produktow przy rozszerzaniu diety.
  testy: q(`
    SELECT f.name AS produkt, t.planned_date, t.tested_date, t.amount, t.status, t.verdict
    FROM trials t JOIN foods f ON f.id = t.food_id ORDER BY t.status, t.id DESC`),

  // Kandydaci na szablony: to samo wpisywane recznie wiecej niz raz,
  // a nie ma jeszcze pozycji jednym dotknieciem. Stad bierze sie cykliczne
  // uzupelnianie listy szablonow.
  kandydaci_na_szablony: q(`
    SELECT m.name, COUNT(*) AS ile, MAX(m.date) AS ostatnio,
           ROUND(AVG(m.kcal), 0) AS srednio_kcal
    FROM meals m
    WHERE m.source != 'hfood'
      AND NOT EXISTS (SELECT 1 FROM meal_templates t WHERE t.archived = 0 AND lower(t.name) = lower(m.name))
    GROUP BY lower(m.name) HAVING COUNT(*) >= 2
    ORDER BY ile DESC, ostatnio DESC`),

  szablony: q(`
    SELECT name, times_used, last_used, kcal FROM meal_templates
    WHERE archived = 0 ORDER BY times_used DESC, name`),
};

if (FORMAT === 'json') {
  console.log(JSON.stringify(dane, null, 1));
  process.exit(0);
}

const nl = () => console.log('');
const sek = (t) => { nl(); console.log('='.repeat(72)); console.log(t.toUpperCase()); console.log('='.repeat(72)); };

console.log(`PRZEGLĄD DANYCH, ${dane.zakres}`);

sek('cele w bieżącej fazie');
for (const c of dane.cele) console.log(`  ${c.metric.padEnd(10)} ${String(c.min_value).padStart(5)} do ${String(c.max_value).padEnd(6)} ${c.source ?? ''}`);

sek('dzień po dniu');
console.log('  data        kcal     B     T     W    bł  posiłków  naOko  bezMakr  catering/ręcznie');
for (const d of dane.dni) {
  console.log(
    `  ${d.date}  ${String(d.kcal).padStart(6)}${String(d.protein_g).padStart(6)}${String(d.fat_g).padStart(6)}` +
    `${String(d.carbs_g).padStart(6)}${String(d.fiber_g).padStart(6)}${String(d.meals_count).padStart(10)}` +
    `${String(d.meals_estimated).padStart(7)}${String(d.meals_without_macros).padStart(9)}   ${d.z_cateringu}/${d.wpisane_recznie}`
  );
}
if (!dane.dni.length) console.log('  (brak dni z danymi)');

sek('posiłki wpisane ręcznie, do weryfikacji makr');
for (const m of dane.wpisane_recznie) {
  console.log(`  [${m.id}] ${m.date} ${m.eaten_at ?? '--:--'} ${m.slot} (${m.source})${m.estimated ? '  MAKRA NA OKO' : ''}`);
  console.log(`        ${m.name}`);
  console.log(`        ${m.kcal ?? '?'} kcal | B ${m.protein_g ?? '?'} | T ${m.fat_g ?? '?'} | W ${m.carbs_g ?? '?'} | bł ${m.fiber_g ?? '?'}`);
  if (m.ingredients_raw) console.log(`        skład: ${m.ingredients_raw}`);
  if (m.notes) console.log(`        notatka: ${m.notes}`);
}
if (!dane.wpisane_recznie.length) console.log('  (brak)');

sek('naruszenia wykluczeń, produkty faktycznie zjedzone');
for (const b of dane.naruszenia) {
  console.log(`  ${b.date} ${b.level === 'forbidden' ? 'ZAKAZ ' : 'limit '} ${b.food_name}`);
  console.log(`        w: ${b.meal_name}`);
  console.log(`        ${b.reason}`);
}
if (!dane.naruszenia.length) console.log('  (żadnych)');

sek(`pokrycie grup, ${DNI} dni`);
for (const p of dane.pokrycie) {
  const oczek = Math.round(((p.wymagane_dni_tyg ?? 0) * DNI) / 7);
  const brak = p.dni_z_grupa < oczek;
  console.log(`  ${brak ? 'BRAK ' : '  ok '} ${String(p.grupa).padEnd(34)} ${p.dni_z_grupa} z ${oczek} dni (${p.waga}), daje: ${p.daje ?? ''}`);
}

sek('składniki nierozpoznane, niewidoczne dla reguł');
for (const u of dane.nierozpoznane) console.log(`  ${u.times_seen}x  ${u.alias}   (od ${u.first_seen})`);
if (!dane.nierozpoznane.length) console.log('  (wszystko rozpoznane)');

sek('suplementy, wzięte z zaplanowanych');
for (const s of dane.suplementy) console.log(`  ${s.date}  ${s.wziete ?? 0} z ${s.zaplanowane}`);
if (!dane.suplementy.length) console.log('  (brak danych)');

sek('objawy i stolec');
for (const s of dane.objawy) console.log(`  ${s.date} ${s.time ?? '--:--'} ${s.kind} ${s.severity ?? '?'}/10 ${s.notes ?? ''}`);
for (const s of dane.stolce) {
  const cechy = [s.straining && 'parcie', s.incomplete && 'niepełne', s.floating && 'pływający'].filter(Boolean).join(', ');
  console.log(`  ${s.date} ${s.time ?? '--:--'} stolec Bristol ${s.bristol} ${cechy}`);
}
if (!dane.objawy.length && !dane.stolce.length) console.log('  (brak wpisów, a to jedyny miernik skuteczności po decyzji o braku badań)');

sek('szablony i kandydaci na szablony');
for (const t of dane.szablony) console.log(`  ${String(t.times_used).padStart(3)}x  ${t.name}${t.kcal ? `  (${Math.round(t.kcal)} kcal)` : ''}`);
if (dane.kandydaci_na_szablony.length) {
  console.log('  --- powtarza sie, a nie ma szablonu:');
  for (const k of dane.kandydaci_na_szablony) console.log(`  ${String(k.ile).padStart(3)}x  ${k.name}  (srednio ${k.srednio_kcal ?? '?'} kcal, ostatnio ${k.ostatnio})`);
} else {
  console.log('  --- brak nowych kandydatow');
}

sek('testy produktów');
for (const t of dane.testy) console.log(`  ${t.status.padEnd(8)} ${t.produkt} ${t.amount ?? ''} ${t.verdict ? `→ ${t.verdict}` : ''}`);
if (!dane.testy.length) console.log('  (brak testów)');
