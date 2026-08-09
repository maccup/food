-- 2026-08-09, naprawa migracji 011.
--
-- 011 wstawila chleb bialkowy na id 123, a to id od migracji 007 nalezalo do
-- edamame. ON CONFLICT(id) DO UPDATE nadpisal produkt zamiast wstawic nowy,
-- wiec bowl z dean&david z 09.08 pokazywal chleb zamiast edamame.
--
-- Chleb przenosi sie na wolne 129, edamame wraca w wersji z 007.
-- Powiazania meal_foods same wracaja do porzadku, bo wskazuja na id 123.

PRAGMA foreign_keys = ON;

-- foods.name jest UNIQUE, wiec najpierw 123 wraca na edamame, dopiero potem
-- chleb wchodzi na 129. Odwrotna kolejnosc wywala sie na duplikacie nazwy.
UPDATE foods SET
  name = 'edamame', group_id = 16, fodmap = 'low', fodmap_note = 'GOS powyzej 90 g',
  fermented = 0, histamine = 'low', fiber_type = 'mixed', processed_meat = 0, refined_oil = 0,
  notes = 'Niskie FODMAP do ok. 90 g, powyzej GOS'
WHERE id = 123;

INSERT INTO foods (id, name, group_id, fodmap, fodmap_note, fermented, histamine, fiber_type, processed_meat, refined_oil, notes) VALUES
  (129, 'chleb białkowy z ziarnami oleistymi', 11, 'moderate',
   'skład nieodczytany, izolat sojowy i gluten pszenny prawdopodobne',
   0, 'low', 'mixed', 0, 0,
   '268 kcal / 100 g, tłuszcz 11 g, błonnik 6,8 g, białko 23 g. Porcja 35 g')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, group_id = excluded.group_id, fodmap = excluded.fodmap,
  fodmap_note = excluded.fodmap_note, notes = excluded.notes;

UPDATE food_aliases SET food_id = 129 WHERE food_id = 123 AND alias IN
  ('chleb białkowy', 'chleb bialkowy', 'chleb proteinowy', 'eiweissbrot', 'kromka chleba białkowego');

UPDATE restrictions SET food_id = 129 WHERE id = 45;
