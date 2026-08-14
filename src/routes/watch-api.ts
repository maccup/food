import { Hono } from 'hono';
import { Env } from '../types';

/**
 * Wsad z aplikacji iOS. Jedyny endpoint, ktory nie chodzi na ciasteczku sesji,
 * tylko na tokenie: telefon nie ma gdzie przechowywac sesji przegladarki,
 * a logowanie haslem w aplikacji oznaczaloby trzymanie hasla na urzadzeniu.
 * Sprawdzenie tokenu siedzi w authMiddleware, nie tutaj.
 *
 * Scalanie, nie nadpisywanie. Kazda kolumna idzie przez COALESCE, wiec dzien,
 * ktorego aplikacja nie zna, zostaje z wartoscia z eksportu XML i odwrotnie.
 * Dwa kanaly widza troche co innego (HealthKit oddaje mniej historii niz plik
 * eksportu) i zwykle nadpisanie kasowaloby dane przy kazdej synchronizacji.
 *
 * Konsekwencja, ktora trzeba znac: bledna wartosc raz zapisana NIE da sie
 * wyzerowac przez wyslanie null, bo COALESCE ja zostawi. Do poprawki trzeba
 * UPDATE recznie. Uznane za mniejsze zlo niz ciche kasowanie historii.
 */
const watchApi = new Hono<{ Bindings: Env }>();

/** Kolumny, ktore aplikacja moze przyslac. Reszta pol w JSON jest ignorowana. */
const KOLUMNY = [
  'hrv_noc', 'hrv', 'hrv_pomiarow', 'rhr',
  'sen_min', 'sen_gleboki_min', 'sen_rem_min', 'sen_budzenia_min', 'sen_lozko_min', 'zasniecie',
  'temperatura', 'oddech', 'spo2', 'tetno_srednie', 'tetno_max', 'tetno_marsz', 'cardio_recovery',
  'kroki', 'kcal_aktywne', 'kcal_bazowe', 'min_ruchu', 'dystans_km', 'pietra', 'stanie_h',
  'swiatlo_min', 'medytacja_min', 'medytacja_sesji',
  'treningi', 'trening_min', 'trening_kcal',
  'vo2max', 'waga', 'tkanka_tluszczowa', 'masa_beztluszczowa',
  'cisnienie_sys', 'cisnienie_dia',
] as const;

const DATA_OK = /^\d{4}-\d{2}-\d{2}$/;

function liczbaAlbo(v: unknown): number | string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string') return v;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

interface TreningZTelefonu {
  date?: unknown;
  start?: unknown;
  typ?: unknown;
  minuty?: unknown;
  kcal?: unknown;
}

watchApi.post('/api/watch', async (c) => {
  let body: { days?: Array<Record<string, unknown>>; treningi?: TreningZTelefonu[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Body nie jest poprawnym JSON' }, 400);
  }

  const days = body?.days;
  if (!Array.isArray(days) || days.length === 0) {
    return c.json({ error: 'Brak pola days albo puste' }, 400);
  }
  if (days.length > 200) {
    return c.json({ error: `Za duzo dni naraz: ${days.length}, maksimum 200` }, 400);
  }

  const zapytania = [];
  const odrzucone: string[] = [];
  let pol = 0;

  for (const day of days) {
    const date = String(day?.date ?? '');
    if (!DATA_OK.test(date)) {
      odrzucone.push(`zla data: ${JSON.stringify(day?.date)}`);
      continue;
    }

    const wartosci = KOLUMNY.map((k) => liczbaAlbo(day[k]));
    pol += wartosci.filter((v) => v !== null).length;

    const ustaw = KOLUMNY.map((k) => `${k} = COALESCE(excluded.${k}, watch.${k})`).join(', ');

    zapytania.push(
      c.env.DB.prepare(
        `INSERT INTO watch (date, ${KOLUMNY.join(', ')}, zrodlo, imported_at)
         VALUES (?, ${KOLUMNY.map(() => '?').join(', ')}, 'ios', datetime('now'))
         ON CONFLICT(date) DO UPDATE SET
           ${ustaw}, zrodlo = 'ios', imported_at = datetime('now')`
      ).bind(date, ...wartosci)
    );
  }

  // Liczba dni musi byc zdjeta ZANIM do kolejki dojda treningi, inaczej
  // odpowiedz melduje wiecej dob, niz telefon przyslal.
  const dniZapisane = zapytania.length;

  /*
   * Treningi ida osobno, bo to inna ziarnistosc: kilka sesji na dobe, kazda
   * z rodzajem. Bez rodzaju plan treningowy nie ma z czego liczyc, czy w tym
   * tygodniu byla juz sila, wiec ten kawalek nie jest ozdoba.
   * Klucz naturalny to data, rodzaj i godzina startu, wiec powtorna wysylka
   * tego samego okna niczego nie dubluje.
   */
  let treningow = 0;
  for (const t of body?.treningi ?? []) {
    const date = String(t?.date ?? '');
    const typ = String(t?.typ ?? '');
    if (!DATA_OK.test(date) || !typ) {
      odrzucone.push(`zly trening: ${JSON.stringify(t)}`);
      continue;
    }
    zapytania.push(
      c.env.DB.prepare(
        `INSERT INTO workouts (date, start, typ_apple, minuty, kcal, zrodlo)
         VALUES (?, ?, ?, ?, ?, 'ios')
         ON CONFLICT(date, typ_apple, start) DO UPDATE SET
           minuty = excluded.minuty, kcal = excluded.kcal, zrodlo = 'ios'`
      ).bind(date, t?.start ? String(t.start) : null, typ, liczbaAlbo(t?.minuty), liczbaAlbo(t?.kcal))
    );
    treningow++;
  }

  if (!zapytania.length) {
    return c.json({ error: 'Zaden dzien nie przeszedl walidacji', odrzucone }, 400);
  }

  await c.env.DB.batch(zapytania);

  return c.json({
    ok: true,
    dni: dniZapisane,
    treningow,
    pol,
    odrzucone,
    // Aplikacja pokazuje to w logu, zeby bylo widac, ze serwer faktycznie zapisal
    // te daty, ktore telefon wyslal, a nie ciche NULL-e.
    zakres: { od: String(days[0]?.date ?? ''), do: String(days[days.length - 1]?.date ?? '') },
  });
});

/** Co serwer juz ma. Aplikacja pyta o to przed wysylka, zeby pokazac roznice. */
watchApi.get('/api/watch/status', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT MAX(date) AS ostatni_dzien, COUNT(*) AS dni,
            (SELECT MAX(imported_at) FROM watch) AS ostatnia_synchronizacja,
            (SELECT COUNT(*) FROM watch WHERE zrodlo = 'ios') AS z_aplikacji
     FROM watch`
  ).first();

  return c.json(row ?? {});
});

export default watchApi;
