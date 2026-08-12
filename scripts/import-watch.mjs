#!/usr/bin/env node
/**
 * Import eksportu Apple Health do tabeli `watch`.
 *
 *   npm run watch:import                       (domyslnie ~/Downloads/apple_health_export/export.xml)
 *   npm run watch:import -- /sciezka/export.xml
 *   npm run watch:import -- --local            (do lokalnej kopii bazy zamiast produkcji)
 *
 * Eksport ze Zdrowia ma kilka gigabajtow, wiec plik idzie linia po linii i nic
 * poza licznikami dobowymi nie ląduje w pamieci. Kazdy `Record` siedzi w jednej
 * linii, a atrybuty czytamy wyrazeniem, nie parserem XML: pelny parser na 2,8 GB
 * kosztuje minuty i pamiec, a i tak potrzebujemy czterech atrybutow.
 *
 * Import jest idempotentny. Kolejny eksport wgrywa sie na wierzch poprzedniego
 * (upsert po dacie), wiec nie trzeba niczego czyscic ani pilnowac, od kiedy
 * dogrywac. Dni, ktorych nowy eksport nie zawiera, zostaja nietkniete.
 */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const local = argv.includes('--local');
const plik = argv.find((a) => !a.startsWith('--'))
  ?? join(homedir(), 'Downloads', 'apple_health_export', 'export.xml');

const Q = 'HKQuantityTypeIdentifier';

/** Pomiary usredniane po dobie. Mediana, nie srednia, patrz migracja 027. */
const MEDIANA = {
  [`${Q}HeartRateVariabilitySDNN`]: 'hrv',
  [`${Q}RestingHeartRate`]: 'rhr',
  [`${Q}RespiratoryRate`]: 'oddech',
  [`${Q}OxygenSaturation`]: 'spo2',
  [`${Q}AppleSleepingWristTemperature`]: 'temperatura',
  [`${Q}VO2Max`]: 'vo2max',
  [`${Q}BodyMass`]: 'waga',
  [`${Q}WalkingHeartRateAverage`]: 'tetno_marsz',
};

/*
 * Sumy dobowe zbierane OSOBNO DLA KAZDEGO ZRODLA, a na koncu bierzemy najwyzsza,
 * nie sume. iPhone w kieszeni i zegarek na regu licza te same kroki rownolegle,
 * wiec zwykle zsumowanie daje niemal podwojony wynik.
 */
const SUMA = {
  [`${Q}StepCount`]: 'kroki',
  [`${Q}ActiveEnergyBurned`]: 'kcal_aktywne',
  [`${Q}AppleExerciseTime`]: 'min_ruchu',
  [`${Q}BasalEnergyBurned`]: 'kcal_bazowe',
};

const FAZY = {
  HKCategoryValueSleepAnalysisAsleepDeep: 'gleboki',
  HKCategoryValueSleepAnalysisAsleepREM: 'rem',
  HKCategoryValueSleepAnalysisAsleepCore: 'lekki',
  HKCategoryValueSleepAnalysisAsleepUnspecified: 'lekki',
  HKCategoryValueSleepAnalysisAwake: 'budzenia',
};

const atr = (linia, nazwa) => {
  const i = linia.indexOf(` ${nazwa}="`);
  if (i < 0) return null;
  const od = i + nazwa.length + 3;
  const do_ = linia.indexOf('"', od);
  return do_ < 0 ? null : linia.slice(od, do_);
};

/*
 * Apple zapisuje czas jako „2026-08-12 01:35:43 +0200", czego Date.parse nie
 * przyjmuje: potrzebuje T zamiast spacji i dwukropka w przesunieciu strefy.
 * Bez tej zamiany kazdy odcinek snu wychodzil NaN i cala kolumna snu byla pusta,
 * a import konczyl sie sukcesem, wiec bledu nie bylo widac az do zapytania.
 */
const czas = (s) =>
  Date.parse(`${s.slice(0, 10)}T${s.slice(11, 19)}${s.slice(20, 23)}:${s.slice(23, 25)}`);

const mediana = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const p = (s.length - 1) / 2;
  return (s[Math.floor(p)] + s[Math.ceil(p)]) / 2;
};

const dni = new Map();
const dzien = (d) => {
  if (!dni.has(d)) {
    dni.set(d, { pomiary: {}, zrodla: {}, sen: {}, zasniecie: null });
  }
  return dni.get(d);
};

console.error(`czytam ${plik}`);
let n = 0;

const rl = createInterface({
  input: createReadStream(plik, { encoding: 'utf8' }),
  crlfDelay: Infinity,
});

for await (const linia of rl) {
  if (!linia.includes('<Record ')) continue;
  const typ = atr(linia, 'type');
  if (!typ) continue;
  const start = atr(linia, 'startDate');
  if (!start) continue;
  if (++n % 1_000_000 === 0) console.error(`  ${n / 1_000_000} mln rekordow`);

  const data = start.slice(0, 10);

  if (MEDIANA[typ]) {
    const v = Number(atr(linia, 'value'));
    if (!Number.isFinite(v)) continue;
    const d = dzien(data);
    const klucz = MEDIANA[typ];
    (d.pomiary[klucz] ??= []).push(v);
    // HRV nocne osobno: w nocy nie ma ruchu, kawy ani rozmowy, wiec zostaje
    // sam uklad autonomiczny i dopiero ta liczba jest porownywalna miedzy dobami.
    if (klucz === 'hrv' && Number(start.slice(11, 13)) < 8) {
      (d.pomiary.hrv_noc ??= []).push(v);
    }
  } else if (SUMA[typ]) {
    const v = Number(atr(linia, 'value'));
    if (!Number.isFinite(v)) continue;
    const d = dzien(data);
    const klucz = SUMA[typ];
    const zrodlo = atr(linia, 'sourceName') ?? '?';
    ((d.zrodla[klucz] ??= {})[zrodlo] ??= 0);
    d.zrodla[klucz][zrodlo] += v;
  } else if (typ === 'HKCategoryTypeIdentifierSleepAnalysis') {
    const faza = FAZY[atr(linia, 'value')];
    const koniec = atr(linia, 'endDate');
    if (!faza || !koniec) continue;
    // Doba snu przypisana do dnia POBUDKI, czyli po dacie konca odcinka.
    const d = dzien(koniec.slice(0, 10));
    const minuty = (czas(koniec) - czas(start)) / 60000;
    if (!Number.isFinite(minuty) || minuty <= 0) continue;
    d.sen[faza] = (d.sen[faza] ?? 0) + minuty;
    if (faza !== 'budzenia' && (d.zasniecie === null || start < d.zasniecie)) {
      d.zasniecie = start;
    }
  }
}

console.error(`przetworzono ${n} rekordow, ${dni.size} dni`);

const KOLUMNY = [
  'date', 'hrv_noc', 'hrv', 'hrv_pomiarow', 'rhr', 'sen_min', 'sen_gleboki_min',
  'sen_rem_min', 'sen_budzenia_min', 'zasniecie', 'temperatura', 'oddech', 'spo2',
  'kroki', 'kcal_aktywne', 'min_ruchu', 'kcal_bazowe', 'vo2max', 'waga', 'tetno_marsz',
];

const sql = (v) => (v === null || v === undefined ? 'NULL'
  : typeof v === 'number' ? String(Math.round(v * 1000) / 1000)
  : `'${String(v).replace(/'/g, "''")}'`);

const wiersze = [];
for (const [data, d] of [...dni.entries()].sort()) {
  const m = (k, cyfry = 1) => {
    const v = mediana(d.pomiary[k] ?? []);
    return v === null ? null : Math.round(v * 10 ** cyfry) / 10 ** cyfry;
  };
  const naj = (k) => {
    const z = d.zrodla[k];
    return z ? Math.round(Math.max(...Object.values(z))) : null;
  };
  const s = (f) => (d.sen[f] ? Math.round(d.sen[f]) : null);
  const glowny = ['gleboki', 'rem', 'lekki'].reduce((a, f) => a + (d.sen[f] ?? 0), 0);

  const w = [
    data, m('hrv_noc'), m('hrv'), (d.pomiary.hrv ?? []).length || null, m('rhr', 0),
    glowny ? Math.round(glowny) : null, s('gleboki'), s('rem'), s('budzenia'),
    d.zasniecie ? d.zasniecie.slice(11, 16) : null,
    m('temperatura', 2), m('oddech'), m('spo2', 3),
    naj('kroki'), naj('kcal_aktywne'), naj('min_ruchu'),
    naj('kcal_bazowe'), m('vo2max', 2), m('waga', 1), m('tetno_marsz', 0),
  ];
  // Dzien bez ani jednego pomiaru poza data nie ma po co zajmowac wiersza.
  if (w.slice(1).every((x) => x === null)) continue;
  wiersze.push(`(${w.map(sql).join(',')})`);
}

const AKTUALIZUJ = KOLUMNY.slice(1)
  .map((k) => `${k} = excluded.${k}`)
  .concat("imported_at = datetime('now')")
  .join(', ');

const kawalki = [];
for (let i = 0; i < wiersze.length; i += 200) {
  kawalki.push(
    `INSERT INTO watch (${KOLUMNY.join(', ')}) VALUES\n${wiersze.slice(i, i + 200).join(',\n')}\n` +
    `ON CONFLICT(date) DO UPDATE SET ${AKTUALIZUJ};`
  );
}

const wyjscie = join(tmpdir(), 'watch-import.sql');
writeFileSync(wyjscie, kawalki.join('\n\n'));
console.error(`${wiersze.length} dni do zapisu, ${kawalki.length} zapytan, plik ${wyjscie}`);

execFileSync(
  'npx',
  ['wrangler', 'd1', 'execute', 'food', local ? '--local' : '--remote', '--yes', `--file=${wyjscie}`],
  { stdio: 'inherit', env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: 'fdde32a072754a917c3e8206d585d1dd' } }
);
