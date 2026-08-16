-- 061: sandacz i kurki
--
-- Z kolacji w restauracji 16.08.
--
-- Sandacz to ryba chuda (ok. 0,8 g tluszczu na 100 g), wiec grupa 5 razem
-- z dorszem, a NIE grupa 4 "Ryby tluste". To rozroznienie ma znaczenie, bo
-- regula pokrycia dotyczy tylko ryb tlustych i sandacz jej nie domyka.
--
-- Kurki: Monash ma przebadane boczniaki (nisko) i pieczarki (wysoko,
-- mannitol). Kurek w bazie Monash nie ma, wiec nie da sie powiedziec, po
-- ktorej sa stronie. Wpisuje 'unknown' zamiast zgadywac. Grzyby lesne jako
-- rodzina nie sa jednorodne: mannitol w pieczarce jest wysoki, w boczniaku
-- go praktycznie nie ma.

INSERT INTO foods (name, group_id, fodmap, fodmap_note, fermented, histamine, fiber_type, portion_role, notes) VALUES
  ('sandacz', 5, 'low', NULL, 0, 'low', 'none', 'porcja',
   'Ryba chuda, ok. 84 kcal i 0,8 g tluszczu na 100 g. Nie liczy sie do pokrycia ryb tlustych'),
  ('kurki', NULL, 'unknown', NULL, 0, 'moderate', 'insoluble', 'dodatek',
   'Monash nie ma kurek w bazie. Pieczarka jest wysoko FODMAP przez mannitol, boczniak nisko, wiec rodzina grzybow nie rozstrzyga. Traktowac jako niewiadoma i obserwowac objawy')
ON CONFLICT(name) DO NOTHING;

INSERT INTO food_aliases (alias, food_id, first_seen)
SELECT 'sandacz', id, '2026-08-16' FROM foods WHERE name = 'sandacz'
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id, ignored = 0;

INSERT INTO food_aliases (alias, food_id, first_seen)
SELECT 'filet z sandacza', id, '2026-08-16' FROM foods WHERE name = 'sandacz'
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id, ignored = 0;

INSERT INTO food_aliases (alias, food_id, first_seen)
SELECT 'kurki', id, '2026-08-16' FROM foods WHERE name = 'kurki'
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id, ignored = 0;
