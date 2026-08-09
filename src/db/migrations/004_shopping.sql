-- 2026-08-09
-- Lista zakupów. Sekcja "czego brakuje" ma się kończyć czynnością, a nie
-- samą informacją: albo odhaczam, że zjadłem, albo dopisuję do kupienia.

CREATE TABLE IF NOT EXISTS shopping (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  food_id   INTEGER REFERENCES foods(id) ON DELETE CASCADE,
  label     TEXT NOT NULL,          -- wpisane ręcznie albo nazwa produktu ze słownika
  note      TEXT,
  added_on  TEXT NOT NULL DEFAULT (date('now')),
  bought    INTEGER NOT NULL DEFAULT 0,
  bought_on TEXT
);

CREATE INDEX IF NOT EXISTS idx_shopping_open ON shopping(bought, added_on);

-- Przykładowe produkty pokazywane przy braku danej grupy. Kolumna trzyma
-- nazwy ze słownika, żeby podpowiedź nie była wymyślona w kodzie widoku.
ALTER TABLE food_groups ADD COLUMN examples TEXT;

UPDATE food_groups SET examples = 'szpinak, jarmuż, natka pietruszki' WHERE code = 'zielone_liscie';
UPDATE food_groups SET examples = 'burak, marchew, dynia' WHERE code = 'warzywa_korzeniowe';
UPDATE food_groups SET examples = 'wołowina, wątróbka' WHERE code = 'czerwone_mieso';
UPDATE food_groups SET examples = 'łosoś, sardynki, makrela' WHERE code = 'ryby_tluste';
UPDATE food_groups SET examples = 'dorsz, mintaj' WHERE code = 'ryby_chude';
UPDATE food_groups SET examples = 'kiwi zielone, 2 sztuki' WHERE code = 'kiwi';
UPDATE food_groups SET examples = 'oliwa extra virgin, na zimno' WHERE code = 'oliwa';
UPDATE food_groups SET examples = 'ziemniaki, bataty' WHERE code = 'ziemniaki';
UPDATE food_groups SET examples = 'jaja' WHERE code = 'jaja';
UPDATE food_groups SET examples = 'borówki, maliny, truskawki' WHERE code = 'owoce_jagodowe';
