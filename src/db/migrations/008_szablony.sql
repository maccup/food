-- 2026-08-09
-- Szablony posilkow. Rzeczy powtarzalne (kawa, owsianka, kiwi) maja byc
-- jednym dotknieciem, nie kazdorazowym rozpisywaniem skladu i zgadywaniem makr.
--
-- Sklad w szablonie jest wazniejszy niz makra: to po nim dzialaja wykluczenia
-- i pokrycie grup. Makra moga byc szacowane, sklad ma byc dokladny.

CREATE TABLE IF NOT EXISTS meal_templates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  ingredients TEXT,
  slot        TEXT NOT NULL DEFAULT 'inne',
  source      TEXT NOT NULL DEFAULT 'dom',
  kcal        REAL, protein_g REAL, fat_g REAL, carbs_g REAL, fiber_g REAL,
  estimated   INTEGER NOT NULL DEFAULT 1,
  times_used  INTEGER NOT NULL DEFAULT 0,
  last_used   TEXT,
  archived    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_templates_uzycie ON meal_templates(archived, times_used DESC);

-- Start: to, co juz bylo wpisywane, plus warianty, ktore realnie wystepuja.
-- Makra kawy sa male, ale nie zerowe, a mleko w latte to juz konkretna pozycja.
INSERT INTO meal_templates (id, name, ingredients, slot, source, kcal, protein_g, fat_g, carbs_g, fiber_g) VALUES
  (1, 'Espresso',                        'kawa',                    'inne',       'restauracja',   3, 0.2, 0,   0,  0),
  (2, 'Podwójne espresso',               'kawa',                    'inne',       'restauracja',   6, 0.4, 0,   0,  0),
  (3, 'Cappuccino',                      'kawa, mleko',             'inne',       'restauracja',  80, 4,   3,   6,  0),
  (4, 'Duże latte, mleko bez laktozy',   'kawa, mleko bez laktozy', 'inne',       'restauracja', 150, 8,   5.5, 12, 0),
  (5, 'Małe latte, mleko bez laktozy',   'kawa, mleko bez laktozy', 'inne',       'restauracja',  95, 5,   3.5,  8, 0),
  (6, 'Chemex, 20 g kawy',               'kawa',                    'inne',       'dom',           5, 0.3, 0,   0,  0),
  (7, 'Matcha 2,5 g z mlekiem bez laktozy', 'matcha, mleko bez laktozy', 'inne',  'dom',         110, 6,   4,   9,  1),
  (8, 'Kiwi zielone, 2 sztuki',          'kiwi zielone',            'inne',       'dom',          85, 1.6, 0.8, 18, 4),
  (9, 'Owsianka bazowa',                 'płatki owsiane, mleko bez laktozy',      'sniadanie', 'dom', 330, 14, 6, 52, 6),
  (10,'Owsianka z dodatkami',            'płatki owsiane, skyr, banan, czekolada 85%, masło', 'sniadanie', 'dom', 650, 26, 20, 85, 10),
  (11,'Jajecznica z 3 jaj na maśle',     'jaja, masło',             'sniadanie',  'dom',         330, 20,  27,  1,  0),
  (12,'FIBEgastrin w wodzie',            NULL,                      'inne',       'dom',          18,  0,   0,  4,  4)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, ingredients = excluded.ingredients, slot = excluded.slot,
  source = excluded.source, kcal = excluded.kcal, protein_g = excluded.protein_g,
  fat_g = excluded.fat_g, carbs_g = excluded.carbs_g, fiber_g = excluded.fiber_g;

INSERT INTO food_aliases (alias, food_id, ignored) VALUES
  ('mleko bez laktozy', 38, 0),
  ('matcha', 106, 0)
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id;
