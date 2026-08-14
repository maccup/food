#!/usr/bin/env node
/**
 * Import archiwum CSV z panelu Oura do tabeli `watch`.
 *
 *   npm run oura:import                  (domyslna sciezka do Oura_Archive)
 *   npm run oura:import -- /sciezka
 *   npm run oura:import -- --dry         (buduje SQL i nie zapisuje)
 *   npm run oura:import -- --local
 *
 * Pierscien byl noszony od 02.2020 do 22.02.2026. Do Apple Health wysylal
 * tylko siedem typow, wiec eksport XML nie ma z niego HRV, temperatury ani
 * zadnego wyniku dobowego. Te dane sa wylacznie tutaj.
 *
 * SEN JEST NADPISYWANY dla dni z pierscienia i to jest cel, nie skutek uboczny.
 * Odcinki snu w eksporcie XML nakladaja sie (kilka zrodel opisuje te sama noc,
 * a importer sumuje minuty bez scalania), przez co 707 z 1739 nocy w bazie
 * pokazywalo ponad 11 godzin snu. Archiwum Oura ma jeden wiersz na noc
 * z rozlacznymi fazami, wiec dla swojego okresu jest zrodlem wiarygodnym.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const local = argv.includes('--local');
const naSucho = argv.includes('--dry');
const katalog = argv.find((a) => !a.startsWith('--'))
  ?? join(homedir(), 'Library', 'CloudStorage', 'GoogleDrive-maciej@cupial.eu',
          'My Drive', 'Prywatne', 'Medycyna', 'Longevity Agent', 'Oura_Archive');

/**
 * CSV z Oury: separator to srednik, pola bywaja w cudzyslowie, a w srodku
 * siedzi JSON z przecinkami. Wlasny czytnik zamiast biblioteki, bo caly
 * potrzebny zakres to cudzyslowy i podwojony cudzyslow w srodku.
 */
function czytaj(plik) {
  const tekst = readFileSync(join(katalog, plik), 'utf8');
  const wiersze = [];
  let pole = '';
  let biezacy = [];
  let wCudzyslowie = false;
  /*
   * Cudzyslow otwiera cytowanie TYLKO na poczatku pola. Bez tego warunku
   * `{"average": 98.465}` rozbierane jest na kawalki i wychodzi z tego
   * `{average: 98.465}`, czyli napis, ktorego JSON.parse nie przyjmuje,
   * a cala kolumna SpO2 wychodzi pusta bez jednego bledu po drodze.
   */
  let poczatekPola = true;

  for (let i = 0; i < tekst.length; i++) {
    const z = tekst[i];
    if (wCudzyslowie) {
      if (z === '"') {
        if (tekst[i + 1] === '"') { pole += '"'; i++; } else { wCudzyslowie = false; }
      } else pole += z;
      continue;
    }
    if (z === '"' && poczatekPola) { wCudzyslowie = true; poczatekPola = false; }
    else if (z === ';') { biezacy.push(pole); pole = ''; poczatekPola = true; }
    else if (z === '\n') {
      biezacy.push(pole); wiersze.push(biezacy);
      biezacy = []; pole = ''; poczatekPola = true;
    }
    else if (z !== '\r') { pole += z; poczatekPola = false; }
  }
  if (pole !== '' || biezacy.length) { biezacy.push(pole); wiersze.push(biezacy); }

  const naglowki = wiersze.shift();
  return wiersze
    .filter((w) => w.length === naglowki.length)
    .map((w) => Object.fromEntries(naglowki.map((n, i) => [n, w[i]])));
}

const liczba = (v) => {
  if (v === undefined || v === null || v === '' || v === 'null') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const minuty = (sekundy) => {
  const n = liczba(sekundy);
  return n === null ? null : Math.round(n / 60);
};
const zaokr = (v, cyfry) => (v === null ? null : Math.round(v * 10 ** cyfry) / 10 ** cyfry);

const dni = new Map();
const dzien = (d) => {
  if (!dni.has(d)) dni.set(d, { date: d });
  return dni.get(d);
};

// 1. Sen. Jedna noc na dobe: bierzemy najdluzszy odcinek typu long_sleep,
//    bo drzemki maja wlasne wiersze i nie sa noca.
const noce = new Map();
for (const r of czytaj('sleepmodel.csv')) {
  if (r.type !== 'long_sleep' || !r.day) continue;
  const dlugosc = liczba(r.total_sleep_duration) ?? 0;
  const poprzednia = noce.get(r.day);
  if (!poprzednia || dlugosc > (liczba(poprzednia.total_sleep_duration) ?? 0)) {
    noce.set(r.day, r);
  }
}
for (const [data, r] of noce) {
  const d = dzien(data);
  d.sen_min = minuty(r.total_sleep_duration);
  d.sen_gleboki_min = minuty(r.deep_sleep_duration);
  d.sen_rem_min = minuty(r.rem_sleep_duration);
  d.sen_budzenia_min = minuty(r.awake_time);
  d.sen_lozko_min = minuty(r.time_in_bed);
  d.sen_efektywnosc = liczba(r.efficiency);
  d.sen_latencja_min = minuty(r.latency);
  d.hrv_rmssd = liczba(r.average_hrv);
  d.tetno_min = liczba(r.lowest_heart_rate);
  d.tetno_sen = zaokr(liczba(r.average_heart_rate), 1);
  d.oddech = zaokr(liczba(r.average_breath), 1);
  // Godzina lokalna prosto z napisu, tak samo jak w imporcie XML.
  d.zasniecie = r.bedtime_start ? r.bedtime_start.slice(11, 16) : null;
}

// 2. Wyniki dobowe
for (const r of czytaj('dailysleep.csv')) {
  if (r.day) dzien(r.day).oura_sen_wynik = liczba(r.score);
}
for (const r of czytaj('dailyreadiness.csv')) {
  if (!r.day) continue;
  const d = dzien(r.day);
  d.oura_gotowosc_wynik = liczba(r.score);
  d.temperatura_odchylenie = liczba(r.temperature_deviation);
}
for (const r of czytaj('dailyactivity.csv')) {
  if (r.day) dzien(r.day).oura_aktywnosc_wynik = liczba(r.score);
}
for (const r of czytaj('dailycardiovascularage.csv')) {
  if (r.day) dzien(r.day).wiek_naczyniowy = liczba(r.vascular_age);
}
for (const r of czytaj('dailyresilience.csv')) {
  if (r.day && r.level) dzien(r.day).odpornosc = r.level;
}
for (const r of czytaj('dailystress.csv')) {
  if (!r.day) continue;
  const d = dzien(r.day);
  d.stres_min = minuty(r.stress_high);
  d.regeneracja_min = minuty(r.recovery_high);
}
for (const r of czytaj('dailyspo2.csv')) {
  if (!r.day) continue;
  const d = dzien(r.day);
  d.zaburzenia_oddechu = liczba(r.breathing_disturbance_index);
  // Pole to maly JSON: {"average": 98.465}
  try {
    const s = JSON.parse(r.spo2_percentage || '{}');
    d.spo2_noc = zaokr(liczba(s.average), 2);
  } catch { /* pusty albo uszkodzony wpis, zostaje null */ }
}

const KOLUMNY = [
  'date',
  'sen_min', 'sen_gleboki_min', 'sen_rem_min', 'sen_budzenia_min', 'sen_lozko_min',
  'zasniecie', 'sen_efektywnosc', 'sen_latencja_min',
  'hrv_rmssd', 'tetno_min', 'tetno_sen', 'oddech',
  'temperatura_odchylenie', 'spo2_noc', 'zaburzenia_oddechu',
  'oura_sen_wynik', 'oura_gotowosc_wynik', 'oura_aktywnosc_wynik',
  'stres_min', 'regeneracja_min', 'odpornosc', 'wiek_naczyniowy',
];

const sql = (v) => (v === null || v === undefined ? 'NULL'
  : typeof v === 'number' ? String(Math.round(v * 1000) / 1000)
  : `'${String(v).replace(/'/g, "''")}'`);

const wiersze = [];
for (const [, d] of [...dni.entries()].sort()) {
  const w = KOLUMNY.map((k) => d[k] ?? null);
  if (w.slice(1).every((x) => x === null)) continue;
  wiersze.push(`(${w.map(sql).join(',')})`);
}

/*
 * COALESCE, nie zwykle nadpisanie: archiwum ma dni bez pomiaru (pierscien
 * na ladowarce), a puste pole nie moze kasowac tego, co przyszlo z zegarka.
 * Wartosc niepusta nadpisuje, wiec noce z pierscienia i tak zastapia zawyzone
 * sumy snu z eksportu XML, i o to chodzi.
 */
const AKTUALIZUJ = KOLUMNY.slice(1)
  .map((k) => `${k} = COALESCE(excluded.${k}, ${k})`)
  .concat("imported_at = datetime('now')")
  .join(', ');

const kawalki = [];
for (let i = 0; i < wiersze.length; i += 200) {
  kawalki.push(
    `INSERT INTO watch (${KOLUMNY.join(', ')}) VALUES\n${wiersze.slice(i, i + 200).join(',\n')}\n` +
    `ON CONFLICT(date) DO UPDATE SET ${AKTUALIZUJ};`
  );
}

const wyjscie = join(tmpdir(), 'oura-import.sql');
writeFileSync(wyjscie, kawalki.join('\n\n'));
console.error(`${wiersze.length} dni do zapisu, ${kawalki.length} zapytan, plik ${wyjscie}`);

if (naSucho) {
  console.error('--dry: nic nie zapisane');
  process.exit(0);
}

execFileSync(
  'npx',
  ['wrangler', 'd1', 'execute', 'food', local ? '--local' : '--remote', '--yes', `--file=${wyjscie}`],
  { stdio: 'inherit', env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: 'fdde32a072754a917c3e8206d585d1dd' } }
);
