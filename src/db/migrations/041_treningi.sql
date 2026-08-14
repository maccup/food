-- Pojedyncze treningi, nie tylko ich liczba.
--
-- Kolumny `treningi`, `trening_min` i `trening_kcal` w `watch` mowia, ile
-- bylo aktywnosci, ale nie mowia JAKIEJ. Przy medianie czterech treningow
-- dziennie wiekszosc to spacery, wiec bez rodzaju nie da sie odpowiedziec na
-- pytanie „czy w tym tygodniu byla juz sila", a od tego zalezy kazda sensowna
-- rekomendacja treningowa.
--
-- `typ_apple` trzymamy SUROWY, prosto z HealthKit, bez tlumaczenia na wlasne
-- kategorie. Kategorie zmieniaja sie razem z pomyslem na trening, a surowy typ
-- jest faktem i nie wymaga migracji, gdy pomysl sie zmieni. Klasyfikacja
-- siedzi w `src/utils/trening.ts`, w jednym miejscu dla wszystkich kanalow.

CREATE TABLE IF NOT EXISTS workouts (
  id         INTEGER PRIMARY KEY,
  date       TEXT NOT NULL,           -- doba rozpoczecia, lokalnie
  start      TEXT,                    -- HH:MM, tylko do odsiania duplikatow
  typ_apple  TEXT NOT NULL,           -- HKWorkoutActivityType bez przedrostka
  minuty     REAL,
  kcal       REAL,
  zrodlo     TEXT NOT NULL DEFAULT 'export',
  UNIQUE(date, typ_apple, start)
);

CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date);
