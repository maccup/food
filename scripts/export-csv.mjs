#!/usr/bin/env node
// Zrzuca baze do plikow CSV w repo "Longevity Agent", zeby dane mialy historie
// w gicie, dawaly sie otworzyc w Excelu i byly czytelne offline.
//
// Uruchomienie: npm run export
// Sciezka docelowa z .dev.vars (LONGEVITY_REPO), bo zawiera spacje.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const WRANGLER = './node_modules/.bin/wrangler';

const QUERIES = {
  'food_meals.csv': `
    SELECT m.date, m.slot, m.sitting, m.source, m.name, m.kcal, m.protein_g, m.fat_g,
           m.carbs_g, m.fiber_g, m.weight_g, m.eaten, m.eaten_fraction, m.estimated,
           m.eaten_at, m.notes, m.ingredients_raw
    FROM meals m ORDER BY m.date, m.sitting, m.slot`,
  'food_day_totals.csv': `
    SELECT d.*, p.name AS phase
    FROM v_day_totals d
    LEFT JOIN phases p ON d.date >= p.date_from AND (p.date_to IS NULL OR d.date <= p.date_to)
    ORDER BY d.date`,
  'food_symptoms.csv': `
    SELECT 'objaw' AS typ, date, time, kind AS szczegol, severity AS nasilenie, notes
    FROM symptoms
    UNION ALL
    SELECT 'stolec', date, time, 'bristol ' || bristol,
           NULL, TRIM(COALESCE(CASE WHEN straining THEN 'parcie ' END,'') ||
                      COALESCE(CASE WHEN incomplete THEN 'niepelne ' END,'') ||
                      COALESCE(CASE WHEN floating THEN 'plywajacy' END,''))
    FROM stools
    ORDER BY date, time`,
  'food_restrictions.csv': `
    SELECT COALESCE(f.name, g.name) AS produkt, r.level, r.status, r.reason, r.max_amount,
           r.date_from, r.date_to, r.source
    FROM restrictions r
    LEFT JOIN foods f ON f.id = r.food_id
    LEFT JOIN food_groups g ON g.id = r.group_id
    ORDER BY r.status, r.level, produkt`,
  'food_trials.csv': `
    SELECT f.name AS produkt, t.planned_date, t.tested_date, t.amount, t.window_hours,
           t.status, t.verdict, t.verdict_note
    FROM trials t JOIN foods f ON f.id = t.food_id
    ORDER BY COALESCE(t.tested_date, t.planned_date)`,
  'food_breaches.csv': `
    SELECT date, slot, meal_name, food_name, level, reason
    FROM v_restriction_breaches WHERE eaten = 1 ORDER BY date, slot`,
  'food_supplements.csv': `
    SELECT s.name, s.brand, s.kind, s.dose, s.purpose, s.status, s.rx,
           sc.time_of_day, sc.with_meal, sc.days, sc.amount, sc.date_from, sc.date_to
    FROM supplements s
    LEFT JOIN supplement_schedule sc ON sc.supplement_id = s.id
    ORDER BY s.status, s.name, sc.time_of_day`,
};

function repoPath() {
  const vars = existsSync('.dev.vars') ? readFileSync('.dev.vars', 'utf8') : '';
  const line = vars.split('\n').find((l) => l.startsWith('LONGEVITY_REPO='));
  if (!line) {
    console.error('Brak LONGEVITY_REPO w .dev.vars');
    process.exit(1);
  }
  return line.slice('LONGEVITY_REPO='.length).trim();
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';
}

const target = join(repoPath(), 'CSV_Analysis');
if (!existsSync(target)) mkdirSync(target, { recursive: true });

let written = 0;
for (const [file, sql] of Object.entries(QUERIES)) {
  const out = execFileSync(
    WRANGLER,
    ['d1', 'execute', 'food', '--remote', '--json', '--command', sql.replace(/\s+/g, ' ').trim()],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );

  const json = JSON.parse(out.slice(out.indexOf('[')));
  const rows = json[0]?.results ?? [];
  writeFileSync(join(target, file), toCsv(rows), 'utf8');
  console.log(`${file.padEnd(26)} ${String(rows.length).padStart(5)} wierszy`);
  written++;
}

console.log(`\nZapisano ${written} plikow do ${target}`);
