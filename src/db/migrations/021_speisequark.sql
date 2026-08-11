-- 2026-08-11, sniadanie: skyr zastapiony twarogiem Speisequark 20% z Lidla.
--
-- To nie jest to samo co "twarog bez laktozy" (id 40), wiec nie da sie go tam
-- wpisac bez klamstwa w danych. Speisequark to zwykly twarog, jeden skladnik,
-- laktoza w calosci zostaje.
--
-- Etykieta Milbona, opakowanie 250 g, na 100 g: 98 kcal, B 11,0, T 4,4
-- (nasycone 2,9), W 3,6, w tym cukry 3,6 czyli laktoza, sol 0,10.
-- Zrodlo: openfoodfacts, wpis producenta 20816575.
--
-- Porcja 200 g to 7,2 g laktozy. Skyr 250 g miał ok. 10 g, wiec zamiana
-- obniza ladunek, ale nadal jest daleko powyzej progu Monash (1 g na porcje).
-- Dlatego reguła jest identyczna jak przy skyrze: limit, jedna porcja dziennie.
-- Zakazu nie ma, bo twarog przy tym protokole to glowne zrodlo bialka rano.

PRAGMA foreign_keys = ON;

INSERT INTO foods (id, name, group_id, fodmap, fodmap_note, fermented, histamine, fiber_type, processed_meat, refined_oil, notes) VALUES
  (131, 'twaróg Speisequark 20%', 13, 'moderate', 'laktoza', 1, 'moderate', 'none', 0, 0,
   '98 kcal / 100 g, B 11,0, T 4,4 (nasycone 2,9), W 3,6 w tym cukry 3,6 czyli laktoza, sól 0,10. Skład: twaróg, jeden składnik. Milbona, opakowanie 250 g')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, group_id = excluded.group_id, fodmap = excluded.fodmap,
  fodmap_note = excluded.fodmap_note, fermented = excluded.fermented,
  histamine = excluded.histamine, fiber_type = excluded.fiber_type, notes = excluded.notes;

-- Produkt bez aliasu jest dla silnika wykluczen niewidzialny, patrz CLAUDE.md.
INSERT INTO food_aliases (alias, food_id, ignored) VALUES
  ('twaróg speisequark 20%', 131, 0),
  ('twaróg speisequark',     131, 0),
  ('speisequark 20%',        131, 0),
  ('speisequark',            131, 0)
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id, ignored = excluded.ignored;

INSERT INTO restrictions (food_id, group_id, level, reason, source, date_from, date_to, status, max_amount)
SELECT 131, NULL, 'limit',
   'Laktoza 3,6 g na 100 g, czyli 7,2 g w porcji 200 g. Mniej niż skyr, ale nadal wielokrotnie powyżej progu Monash',
   'Etykieta Milbona odczytana 11.08.2026', '2026-08-11', NULL, 'active', 'maks. 1 porcja dziennie'
WHERE NOT EXISTS (SELECT 1 FROM restrictions WHERE food_id = 131);
