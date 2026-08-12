-- 031: espresso jako alias kawy
--
-- „espresso" bez slowa „kawa" nie mialo aliasu, wiec kazde takie wpisanie
-- przechodzilo obok limitu kofeiny. Limit brzmi „2 do 3 dziennie, do 14:00"
-- i istnieje po to, zeby pilnowac snu, wiec akurat ten produkt nie moze byc
-- dla silnika wykluczen niewidzialny.
--
-- Alias do 106, nie nowy wiersz: espresso to porcja kawy, a nie inny produkt,
-- i ma sie liczyc do tego samego dziennego limitu co Chemex.

INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('espresso', 106, '2026-08-12'),
  ('kawa espresso', 106, '2026-08-12'),
  ('podwójne espresso', 106, '2026-08-12'),
  ('kawa czarna', 106, '2026-08-12')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id;
