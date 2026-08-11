-- food.cupial.eu, schemat bazy
-- D1 (SQLite). Uruchamianie: npm run db:schema (zdalnie) albo db:schema:local
--
-- Zasada: tabele trzymaja zdarzenia i liczby. Narracja, wnioski i decyzje
-- zostaja w repo Longevity Agent w plikach markdown.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- PROTOKOL: fazy leczenia i cele makro
-- ---------------------------------------------------------------------------

-- Okresy protokolu. Kazdy posilek i objaw przypisuje sie do fazy po dacie,
-- zeby porownania "przed i po" nie wymagaly recznego tagowania.
CREATE TABLE IF NOT EXISTS phases (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  date_from   TEXT NOT NULL,
  date_to     TEXT,
  diet_type   TEXT,            -- lekkostrawna | low_fodmap | rozszerzanie | brak
  notes       TEXT
);

-- Cele makro obowiazujace w danej fazie, ze zrodlem zalecenia.
CREATE TABLE IF NOT EXISTS targets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  phase_id    INTEGER NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
  metric      TEXT NOT NULL,   -- kcal | protein_g | fat_g | carbs_g | fiber_g
  min_value   REAL,
  max_value   REAL,
  source      TEXT,
  UNIQUE(phase_id, metric)
);

-- ---------------------------------------------------------------------------
-- SLOWNIK PRODUKTOW
-- ---------------------------------------------------------------------------

-- Grupy sluzace do liczenia "czego w diecie brakuje". Kolumna provides mowi,
-- po co ta grupa jest w diecie, zeby brak dalo sie opisac po ludzku.
CREATE TABLE IF NOT EXISTS food_groups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  provides    TEXT,
  examples    TEXT   -- podpowiedz produktow przy braku grupy
);

-- Lista zakupow. Sekcja "czego brakuje" konczy sie czynnoscia, nie informacja.
CREATE TABLE IF NOT EXISTS shopping (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  food_id   INTEGER REFERENCES foods(id) ON DELETE CASCADE,
  label     TEXT NOT NULL,
  note      TEXT,
  added_on  TEXT NOT NULL DEFAULT (date('now')),
  bought    INTEGER NOT NULL DEFAULT 0,
  bought_on TEXT
);
CREATE INDEX IF NOT EXISTS idx_shopping_open ON shopping(bought, added_on);

CREATE TABLE IF NOT EXISTS foods (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL UNIQUE,
  group_id        INTEGER REFERENCES food_groups(id) ON DELETE SET NULL,
  fodmap          TEXT NOT NULL DEFAULT 'unknown',  -- low | moderate | high | unknown
  fodmap_note     TEXT,                             -- mannitol | fruktany | GOS | sorbitol | laktoza
  fermented       INTEGER NOT NULL DEFAULT 0,
  histamine       TEXT,                             -- low | moderate | high
  fiber_type      TEXT,                             -- soluble | insoluble | mixed | none
  processed_meat  INTEGER NOT NULL DEFAULT 0,
  refined_oil     INTEGER NOT NULL DEFAULT 0,
  notes           TEXT
);

-- Mapowanie surowych stringow ze skladow hfood na produkt kanoniczny.
-- food_id NULL oznacza "nierozpoznane, do przejrzenia". Bez tej kolejki
-- silnik wykluczen po cichu przepuszczalby kazdy nowy skladnik.
CREATE TABLE IF NOT EXISTS food_aliases (
  alias       TEXT PRIMARY KEY,
  food_id     INTEGER REFERENCES foods(id) ON DELETE SET NULL,
  first_seen  TEXT NOT NULL DEFAULT (date('now')),
  times_seen  INTEGER NOT NULL DEFAULT 1,
  ignored     INTEGER NOT NULL DEFAULT 0   -- 1 = swiadomie bez mapowania (sol, pieprz, woda)
);

CREATE INDEX IF NOT EXISTS idx_food_aliases_unmapped
  ON food_aliases(food_id) WHERE food_id IS NULL AND ignored = 0;

-- ---------------------------------------------------------------------------
-- ZASADY
-- ---------------------------------------------------------------------------

-- Wykluczenia i limity. To ta tabela odpowiada pozniej na pytanie
-- "czy ten produkt mi szkodzi": status przechodzi active -> testing ->
-- cleared albo confirmed_trigger.
CREATE TABLE IF NOT EXISTS restrictions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  food_id     INTEGER REFERENCES foods(id) ON DELETE CASCADE,
  group_id    INTEGER REFERENCES food_groups(id) ON DELETE CASCADE,
  level       TEXT NOT NULL,   -- forbidden | limit | prefer
  reason      TEXT NOT NULL,
  source      TEXT,
  date_from   TEXT NOT NULL,
  date_to     TEXT,            -- NULL = bezterminowo
  status      TEXT NOT NULL DEFAULT 'active',  -- active | testing | cleared | confirmed_trigger
  max_amount  TEXT,
  CHECK (food_id IS NOT NULL OR group_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_restrictions_food ON restrictions(food_id);

-- Ile razy w tygodniu dana grupa ma sie pojawic. Zrodlo regul:
-- Dieta_obecna_ranking.md, sekcja "Czego w tej diecie brakuje".
CREATE TABLE IF NOT EXISTS coverage_rules (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id            INTEGER NOT NULL REFERENCES food_groups(id) ON DELETE CASCADE,
  min_days_per_week   INTEGER,
  min_portions_per_day REAL,
  severity            TEXT NOT NULL DEFAULT 'important',  -- critical | important | nice
  rationale           TEXT,
  active_from         TEXT,
  active_to           TEXT
);

-- ---------------------------------------------------------------------------
-- DZIENNIK JEDZENIA
-- ---------------------------------------------------------------------------

-- Zamowienia cateringowe. Jeden wiersz na zamowienie, bo kolejne nie moze
-- nadpisywac poprzedniego, a dni bez dostawy naleza do konkretnego okresu,
-- nie do kalendarza w ogolnosci. Status (aktywne, planowane, zakonczone)
-- wynika z dat i nie ma osobnej kolumny.
CREATE TABLE IF NOT EXISTS catering_orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  provider    TEXT NOT NULL DEFAULT 'hfood',
  order_id    TEXT NOT NULL,
  diet_id     TEXT,
  date_from   TEXT NOT NULL,
  date_to     TEXT,
  no_delivery TEXT,   -- zakresy po przecinku, "2026-08-21..2026-08-24"
  notes       TEXT
);
CREATE INDEX IF NOT EXISTS idx_catering_okres ON catering_orders(date_from, date_to);

-- sitting = ktore z trzech okien jedzenia (1: ok. 09:00, 2: ok. 14:00, 3: ok. 18:30).
-- Przerwy 4 do 5 h miedzy oknami sa jedynym narzedziem na motoryke po rezygnacji
-- z prokinetyku, wiec sa czescia modelu, nie kosmetyka.
--
-- stan: plan | zjedzony | pominiety. Domyslnie 'zjedzony', bo wpis robiony
-- recznie albo przez czat powstaje po jedzeniu. Catering wpisywany z gory
-- dostaje 'plan' i przechodzi w 'zjedzony' odhaczeniem w widoku dnia.
-- Jedna flaga boolowska tego nie unosla: "pominalem" i "dopiero bedzie"
-- to dwa rozne stany, a mialy tam ta sama wartosc. Patrz migracja 019.
CREATE TABLE IF NOT EXISTS meals (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  date            TEXT NOT NULL,
  eaten_at        TEXT,            -- godzina POCZATKU jedzenia
  duration_min    INTEGER,         -- ile trwalo. NULL = nieznane, przerwa liczy sie wtedy z default_meal_min
  slot            TEXT NOT NULL,   -- sniadanie | ii_sniadanie | obiad | podwieczorek | kolacja | inne
  sitting         INTEGER,
  source          TEXT NOT NULL,   -- hfood | dom | restauracja
  external_id     TEXT,            -- dishScheduleId z hfood
  name            TEXT NOT NULL,
  ingredients_raw TEXT,
  kcal            REAL,
  protein_g       REAL,
  fat_g           REAL,
  carbs_g         REAL,
  fiber_g         REAL,
  weight_g        REAL,
  stan            TEXT NOT NULL DEFAULT 'zjedzony'
                    CHECK (stan IN ('plan', 'zjedzony', 'pominiety')),
  eaten_fraction  REAL NOT NULL DEFAULT 1.0,
  -- 1 = makra podane na oko, np. posilek w restauracji opisany z pamieci
  estimated       INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Na dany dzien i slot przypada dokladnie jedno pudelko z cateringu.
-- Klucz celowo bez external_id: po wymianie dania w panelu identyfikator
-- sie zmienia, a to ma nadpisac istniejacy wiersz, nie dolozyc drugi.
CREATE UNIQUE INDEX IF NOT EXISTS idx_meals_hfood
  ON meals(date, slot) WHERE source = 'hfood';
CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);

CREATE TABLE IF NOT EXISTS meal_foods (
  meal_id     INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  food_id     INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  amount_note TEXT,
  PRIMARY KEY (meal_id, food_id)
);

-- ---------------------------------------------------------------------------
-- OBJAWY
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS symptoms (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  date      TEXT NOT NULL,
  time      TEXT,
  kind      TEXT NOT NULL,   -- gazy | wzdecia | bol | przelewanie | zgaga | inne
  severity  INTEGER,         -- 0 do 10
  notes     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_symptoms_date ON symptoms(date);

CREATE TABLE IF NOT EXISTS stools (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  time        TEXT,
  bristol     INTEGER NOT NULL,   -- 1 do 7
  straining   INTEGER,
  incomplete  INTEGER,
  floating    INTEGER,
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (bristol BETWEEN 1 AND 7)
);

CREATE INDEX IF NOT EXISTS idx_stools_date ON stools(date);

-- Jeden wiersz na dobe, bo stres wpisuje sie wieczorem za caly dzien.
-- Osobna tabela, a nie symptoms z kind = 'stres': patrz migracja 025.
CREATE TABLE IF NOT EXISTS stress (
  date       TEXT PRIMARY KEY,
  level      INTEGER NOT NULL,   -- 0 do 10, ta sama skala co symptoms.severity
  powod      TEXT,               -- praca | pieniadze | relacje | zdrowie | studia | sen | inne
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (level BETWEEN 0 AND 10)
);

-- ---------------------------------------------------------------------------
-- TESTOWANIE PRODUKTOW (rozszerzanie diety od 15.09)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS trials (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  food_id       INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  planned_date  TEXT,
  tested_date   TEXT,
  amount        TEXT,
  window_hours  INTEGER NOT NULL DEFAULT 48,
  verdict       TEXT,          -- ok | podejrzany | szkodzi | nierozstrzygniete
  verdict_note  TEXT,
  status        TEXT NOT NULL DEFAULT 'planned'   -- planned | running | done
);

-- ---------------------------------------------------------------------------
-- SUPLEMENTY I LEKI
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS supplements (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  brand     TEXT,
  kind      TEXT,             -- suplement | lek | blonnik | probiotyk
  dose      TEXT,
  purpose   TEXT,
  status    TEXT NOT NULL DEFAULT 'active',  -- active | paused | planned | discontinued
  rx        INTEGER NOT NULL DEFAULT 0,
  notes     TEXT,
  source    TEXT
);

-- Rozklad dnia. Rozdzielony od supplements, bo ten sam preparat potrafi
-- zmieniac pore i dawke miedzy fazami (np. FIBEgastrin 1 saszetka do 17.08,
-- potem 2 saszetki do 14.09, potem 1 przewlekle).
CREATE TABLE IF NOT EXISTS supplement_schedule (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  supplement_id INTEGER NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  time_of_day   TEXT NOT NULL,
  with_meal     TEXT,          -- na_czczo | sniadanie | obiad | kolacja | przed_snem
  days          TEXT NOT NULL DEFAULT 'daily',  -- daily albo lista: pon,wt,sr,czw,pt,sob
  amount        TEXT,
  date_from     TEXT NOT NULL,
  date_to       TEXT,
  notes         TEXT
);

CREATE INDEX IF NOT EXISTS idx_supp_sched_supp ON supplement_schedule(supplement_id);

CREATE TABLE IF NOT EXISTS supplement_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id   INTEGER REFERENCES supplement_schedule(id) ON DELETE SET NULL,
  supplement_id INTEGER NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,
  taken         INTEGER NOT NULL DEFAULT 1,
  taken_at      TEXT,
  notes         TEXT,
  UNIQUE(schedule_id, date)
);

CREATE INDEX IF NOT EXISTS idx_supp_log_date ON supplement_log(date);

-- ---------------------------------------------------------------------------
-- WIDOKI: jedno miejsce liczenia, zeby UI i eksport CSV nie rozjechaly sie
-- ---------------------------------------------------------------------------

-- Makra dnia w rozbiciu na stan. Kalendarz pokazuje tez plan, reszta aplikacji
-- tylko fakty, ale liczone musi byc w jednym miejscu, inaczej sie rozjedzie.
DROP VIEW IF EXISTS v_day_macros;
CREATE VIEW v_day_macros AS
SELECT
  m.date,
  m.stan,
  ROUND(SUM(COALESCE(m.kcal, 0)      * m.eaten_fraction), 1) AS kcal,
  ROUND(SUM(COALESCE(m.protein_g, 0) * m.eaten_fraction), 1) AS protein_g,
  ROUND(SUM(COALESCE(m.fat_g, 0)     * m.eaten_fraction), 1) AS fat_g,
  ROUND(SUM(COALESCE(m.carbs_g, 0)   * m.eaten_fraction), 1) AS carbs_g,
  ROUND(SUM(COALESCE(m.fiber_g, 0)   * m.eaten_fraction), 1) AS fiber_g,
  COUNT(*) AS meals_count,
  SUM(CASE WHEN m.estimated = 1 THEN 1 ELSE 0 END) AS meals_estimated,
  SUM(CASE WHEN m.kcal IS NULL THEN 1 ELSE 0 END)  AS meals_without_macros
FROM meals m
GROUP BY m.date, m.stan;

DROP VIEW IF EXISTS v_day_totals;
CREATE VIEW v_day_totals AS
SELECT date, kcal, protein_g, fat_g, carbs_g, fiber_g,
       meals_count, meals_estimated, meals_without_macros
FROM v_day_macros
WHERE stan = 'zjedzony';

-- Ktora grupa produktow pojawila sie ktorego dnia i ile razy.
DROP VIEW IF EXISTS v_group_coverage;
CREATE VIEW v_group_coverage AS
SELECT
  m.date,
  g.id   AS group_id,
  g.code AS group_code,
  g.name AS group_name,
  g.provides,
  COUNT(DISTINCT m.id) AS meals_with_group
FROM meals m
JOIN meal_foods mf ON mf.meal_id = m.id
JOIN foods f       ON f.id = mf.food_id
JOIN food_groups g ON g.id = f.group_id
WHERE m.stan = 'zjedzony'
GROUP BY m.date, g.id;

-- Posilki naruszajace aktywne wykluczenie albo limit, z powodem.
DROP VIEW IF EXISTS v_restriction_breaches;
CREATE VIEW v_restriction_breaches AS
SELECT
  m.date,
  m.id      AS meal_id,
  m.slot,
  m.name    AS meal_name,
  f.id      AS food_id,
  f.name    AS food_name,
  r.level,
  r.reason,
  r.source,
  r.max_amount,
  m.stan
FROM meals m
JOIN meal_foods mf  ON mf.meal_id = m.id
JOIN foods f        ON f.id = mf.food_id
JOIN restrictions r ON (r.food_id = f.id OR r.group_id = f.group_id)
WHERE r.status IN ('active', 'testing')
  AND r.level IN ('forbidden', 'limit')
  AND m.date >= r.date_from
  AND (r.date_to IS NULL OR m.date <= r.date_to);

-- Faza obowiazujaca danego dnia, razem z sumami i celami.
DROP VIEW IF EXISTS v_day_vs_targets;
CREATE VIEW v_day_vs_targets AS
SELECT
  d.date,
  p.id   AS phase_id,
  p.name AS phase_name,
  t.metric,
  t.min_value,
  t.max_value,
  CASE t.metric
    WHEN 'kcal'      THEN d.kcal
    WHEN 'protein_g' THEN d.protein_g
    WHEN 'fat_g'     THEN d.fat_g
    WHEN 'carbs_g'   THEN d.carbs_g
    WHEN 'fiber_g'   THEN d.fiber_g
  END AS actual
FROM v_day_totals d
JOIN phases p  ON d.date >= p.date_from AND (p.date_to IS NULL OR d.date <= p.date_to)
JOIN targets t ON t.phase_id = p.id;
