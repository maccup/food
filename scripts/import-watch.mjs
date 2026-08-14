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
 *
 * UWAGA na drugi kanal. Aplikacja iOS pisze do tej samej tabeli przez
 * `/api/watch`, ale SCALA (COALESCE), a ten skrypt NADPISUJE cala kolumne,
 * takze pusta wartoscia. Przepuszczenie starego eksportu po synchronizacji
 * z telefonu skasowaloby to, czego eksport nie zawiera. Import z pliku robimy
 * wiec na historii, a biezace doby zostawiamy aplikacji.
 */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const local = argv.includes('--local');
/** Buduje SQL i zatrzymuje sie przed zapisem, do sprawdzenia co poleci. */
const naSucho = argv.includes('--dry');
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
  [`${Q}HeartRateRecoveryOneMinute`]: 'cardio_recovery',
  [`${Q}BodyFatPercentage`]: 'tkanka_tluszczowa',
  [`${Q}LeanBodyMass`]: 'masa_beztluszczowa',
  [`${Q}BloodPressureSystolic`]: 'cisnienie_sys',
  [`${Q}BloodPressureDiastolic`]: 'cisnienie_dia',
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
  [`${Q}TimeInDaylight`]: 'swiatlo_min',
  [`${Q}DistanceWalkingRunning`]: 'dystans_km',
  [`${Q}FlightsClimbed`]: 'pietra',
};

const FAZY = {
  HKCategoryValueSleepAnalysisAsleepDeep: 'gleboki',
  HKCategoryValueSleepAnalysisAsleepREM: 'rem',
  HKCategoryValueSleepAnalysisAsleepCore: 'lekki',
  /*
   * NIE jest to synonim lekkiego snu i nie wolno tego tak liczyc.
   * Oura zapisuje AsleepUnspecified jako parasol nad tymi samymi minutami,
   * ktore osobno opisuje jako Core i Deep, wiec zsumowanie z reszta liczy je
   * podwojnie. Zarazem dla starszych danych (zegarek sprzed iOS 16, Sleep
   * Cycle) to jedyna dostepna faza i nie da sie jej po prostu wyrzucic.
   * Rozstrzygniecie jest przy zapisie: liczy sie tylko wtedy, gdy noc nie ma
   * ani jednej fazy szczegolowej.
   */
  HKCategoryValueSleepAnalysisAsleepUnspecified: 'nieokreslony',
  HKCategoryValueSleepAnalysisAwake: 'budzenia',
  HKCategoryValueSleepAnalysisInBed: 'lozko',
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
    dni.set(d, {
      pomiary: {}, zrodla: {}, senZrodla: {},
      // Tetno liczymy w locie, nie tablica probek: samych odczytow pulsu jest
      // 1,46 mln i trzymanie ich w pamieci nie ma po co istniec, skoro
      // potrzebujemy tylko sredniej i maksimum.
      tetno: null, medytacja: null, stanie: 0, trening: null,
    });
  }
  return dni.get(d);
};

/** Pierwsza sesja medytacji w calym eksporcie, patrz zerowanie przy zapisie. */
let pierwszaMedytacja = null;
/** Dzien trwajacego <Workout>, zeby dopiac do niego <WorkoutStatistics>. */
let otwartyTrening = null;
/** Wiersz trwajacego treningu w tabeli `workouts`, do dopisania kalorii. */
let otwartyWiersz = null;
/** Pojedyncze treningi z rodzajem, do osobnej tabeli. */
const treningi = [];

console.error(`czytam ${plik}`);
let n = 0;

const rl = createInterface({
  input: createReadStream(plik, { encoding: 'utf8' }),
  crlfDelay: Infinity,
});

for await (const linia of rl) {
  /*
   * Trening to nie <Record>, tylko <Workout> z zagniezdzonym
   * <WorkoutStatistics>, ktore niesie spalone kalorie. Plik idzie linia po
   * linii, wiec zapamietujemy dzien otwartego treningu i dopinamy do niego
   * kolejna linie ze statystyka.
   */
  if (linia.includes('<Workout ')) {
    const start = atr(linia, 'startDate');
    const minuty = Number(atr(linia, 'duration'));
    if (start) {
      otwartyTrening = start.slice(0, 10);
      const d = dzien(otwartyTrening);
      d.trening ??= { liczba: 0, minuty: 0, kcal: 0 };
      d.trening.liczba += 1;
      const dlugosc = Number.isFinite(minuty) && atr(linia, 'durationUnit') === 'min' ? minuty : null;
      if (dlugosc !== null) d.trening.minuty += dlugosc;

      // Osobny wiersz na kazdy trening, bo bez rodzaju nie da sie powiedziec,
      // czy w tygodniu byla sila. Typ zostaje surowy, jak przyszedl z Apple.
      const typ = (atr(linia, 'workoutActivityType') ?? '').replace('HKWorkoutActivityType', '');
      if (typ) {
        otwartyWiersz = { date: otwartyTrening, start: start.slice(11, 16), typ, minuty: dlugosc, kcal: 0 };
        treningi.push(otwartyWiersz);
      }
    }
    continue;
  }
  if (linia.includes('<WorkoutStatistics ')) {
    if (otwartyTrening && atr(linia, 'type') === `${Q}ActiveEnergyBurned`) {
      const kcal = Number(atr(linia, 'sum'));
      if (Number.isFinite(kcal)) {
        dzien(otwartyTrening).trening.kcal += kcal;
        if (otwartyWiersz) otwartyWiersz.kcal += kcal;
      }
    }
    continue;
  }
  if (linia.includes('</Workout>')) {
    otwartyTrening = null;
    otwartyWiersz = null;
    continue;
  }

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
    /*
     * Odcinki trzymamy OSOBNO DLA KAZDEGO ZRODLA i przy zapisie bierzemy
     * jedno, tak samo jak przy krokach. Pierscien i zegarek opisuja te sama
     * noc rownolegle i wlasnymi fazami, wiec sumowanie wszystkiego dawalo
     * noce po czternascie godzin: 707 z 1739 nocy w bazie mialo ponad
     * jedenascie. Scalanie przedzialow tego nie rozwiazuje, bo te same
     * minuty jedno zrodlo nazywa lekkim snem, a drugie glebokim.
     */
    const zrodloSnu = atr(linia, 'sourceName') ?? '?';
    const s = (d.senZrodla[zrodloSnu] ??= { fazy: {}, zasniecie: null });
    s.fazy[faza] = (s.fazy[faza] ?? 0) + minuty;
    if (faza !== 'budzenia' && faza !== 'lozko' && (s.zasniecie === null || start < s.zasniecie)) {
      s.zasniecie = start;
    }
  } else if (typ === `${Q}HeartRate`) {
    const v = Number(atr(linia, 'value'));
    if (!Number.isFinite(v)) continue;
    const d = dzien(data);
    d.tetno ??= { suma: 0, n: 0, max: 0 };
    d.tetno.suma += v;
    d.tetno.n += 1;
    if (v > d.tetno.max) d.tetno.max = v;
  } else if (typ === 'HKCategoryTypeIdentifierMindfulSession') {
    const koniec = atr(linia, 'endDate');
    if (!koniec) continue;
    const minuty = (czas(koniec) - czas(start)) / 60000;
    if (!Number.isFinite(minuty) || minuty <= 0) continue;
    const d = dzien(data);
    d.medytacja ??= { minuty: 0, sesji: 0 };
    d.medytacja.minuty += minuty;
    d.medytacja.sesji += 1;
    if (pierwszaMedytacja === null || data < pierwszaMedytacja) pierwszaMedytacja = data;
  } else if (typ === 'HKCategoryTypeIdentifierAppleStandHour') {
    if (atr(linia, 'value') === 'HKCategoryValueAppleStandHourStood') dzien(data).stanie += 1;
  }
}

console.error(`przetworzono ${n} rekordow, ${dni.size} dni`);

const KOLUMNY = [
  'date', 'hrv_noc', 'hrv', 'hrv_pomiarow', 'rhr', 'sen_min', 'sen_gleboki_min',
  'sen_rem_min', 'sen_budzenia_min', 'sen_lozko_min', 'zasniecie',
  'temperatura', 'oddech', 'spo2',
  'kroki', 'kcal_aktywne', 'min_ruchu', 'kcal_bazowe', 'vo2max', 'waga', 'tetno_marsz',
  'tetno_srednie', 'tetno_max', 'dystans_km', 'pietra', 'stanie_h', 'swiatlo_min',
  'cardio_recovery', 'medytacja_min', 'medytacja_sesji',
  'treningi', 'trening_min', 'trening_kcal',
  'tkanka_tluszczowa', 'masa_beztluszczowa', 'cisnienie_sys', 'cisnienie_dia',
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
  const naj = (k, cyfry = 0) => {
    const z = d.zrodla[k];
    if (!z) return null;
    return Math.round(Math.max(...Object.values(z)) * 10 ** cyfry) / 10 ** cyfry;
  };
  /*
   * Sen wlasciwy jednego zrodla. Fazy szczegolowe wygrywaja z parasolem:
   * `nieokreslony` wchodzi do rachunku dopiero, gdy nie ma zadnej z nich.
   */
  const senWlasciwy = (fazy) => {
    const szczegolowe = ['gleboki', 'rem', 'lekki'].reduce((a, f) => a + (fazy[f] ?? 0), 0);
    return szczegolowe > 0 ? szczegolowe : (fazy.nieokreslony ?? 0);
  };

  // Jedno zrodlo na noc: to, ktore zapisalo najwiecej snu wlasciwego.
  const sen = Object.values(d.senZrodla).reduce(
    (naj, kandydat) => (naj === null || senWlasciwy(kandydat.fazy) > senWlasciwy(naj.fazy) ? kandydat : naj),
    null
  ) ?? { fazy: {}, zasniecie: null };

  const s = (f) => (sen.fazy[f] ? Math.round(sen.fazy[f]) : null);
  const glowny = senWlasciwy(sen.fazy);

  /*
   * Medytacja: zero zapisujemy JAWNIE, ale dopiero od dnia pierwszej sesji
   * w eksporcie. Wczesniej zegarek tego nie mierzyl, wiec zero znaczyloby
   * „nie medytowal", a prawda jest „nie wiadomo". Od tamtej daty brak wpisu
   * to juz realny dzien bez praktyki i tak ma sie liczyc, bo inaczej
   * porownanie dni z praktyka i bez nie ma grupy kontrolnej.
   */
  const medytowalKiedykolwiek = pierwszaMedytacja !== null && data >= pierwszaMedytacja;
  const medMin = d.medytacja ? Math.round(d.medytacja.minuty) : (medytowalKiedykolwiek ? 0 : null);
  const medSesji = d.medytacja ? d.medytacja.sesji : (medytowalKiedykolwiek ? 0 : null);

  const w = [
    data, m('hrv_noc'), m('hrv'), (d.pomiary.hrv ?? []).length || null, m('rhr', 0),
    glowny ? Math.round(glowny) : null, s('gleboki'), s('rem'), s('budzenia'), s('lozko'),
    sen.zasniecie ? sen.zasniecie.slice(11, 16) : null,
    m('temperatura', 2), m('oddech'), m('spo2', 3),
    naj('kroki'), naj('kcal_aktywne'), naj('min_ruchu'),
    naj('kcal_bazowe'), m('vo2max', 2), m('waga', 1), m('tetno_marsz', 0),
    d.tetno ? Math.round(d.tetno.suma / d.tetno.n) : null,
    d.tetno ? Math.round(d.tetno.max) : null,
    naj('dystans_km', 2), naj('pietra'), d.stanie || null, naj('swiatlo_min'),
    m('cardio_recovery'), medMin, medSesji,
    d.trening ? d.trening.liczba : null,
    d.trening ? Math.round(d.trening.minuty) : null,
    d.trening?.kcal ? Math.round(d.trening.kcal) : null,
    m('tkanka_tluszczowa', 3), m('masa_beztluszczowa', 1),
    m('cisnienie_sys', 0), m('cisnienie_dia', 0),
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

/*
 * Treningi ida do wlasnej tabeli, jeden wiersz na sesje. Klucz naturalny to
 * data, rodzaj i godzina startu, wiec powtorzony import nie zdubluje niczego,
 * a poprawiona dlugosc albo kaloryka nadpisze poprzedni odczyt.
 */
for (let i = 0; i < treningi.length; i += 200) {
  const partia = treningi.slice(i, i + 200).map((t) =>
    `(${sql(t.date)},${sql(t.start)},${sql(t.typ)},${sql(t.minuty)},${sql(t.kcal || null)},'export')`
  );
  kawalki.push(
    `INSERT INTO workouts (date, start, typ_apple, minuty, kcal, zrodlo) VALUES\n${partia.join(',\n')}\n` +
    `ON CONFLICT(date, typ_apple, start) DO UPDATE SET minuty = excluded.minuty, kcal = excluded.kcal;`
  );
}

const wyjscie = join(tmpdir(), 'watch-import.sql');
writeFileSync(wyjscie, kawalki.join('\n\n'));
console.error(`${wiersze.length} dni i ${treningi.length} treningow do zapisu, ${kawalki.length} zapytan, plik ${wyjscie}`);

if (naSucho) {
  console.error('--dry: nic nie zapisane');
  process.exit(0);
}

execFileSync(
  'npx',
  ['wrangler', 'd1', 'execute', 'food', local ? '--local' : '--remote', '--yes', `--file=${wyjscie}`],
  { stdio: 'inherit', env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: 'fdde32a072754a917c3e8206d585d1dd' } }
);
