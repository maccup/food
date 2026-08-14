-- 042: matcha jako produkt slownikowy
--
-- Matcha byla codziennym napojem, a w slowniku jej nie bylo, wiec dla silnika
-- wykluczen nie istniala. Kawa siedzi tam od poczatku i ma limit "do 14:00",
-- matcha niesie te sama kofeine (2 g to ok. 60 do 70 mg), tylko wolniej
-- uwalniana przez L-teanine. Bez wiersza w foods nie da sie tego kiedykolwiek
-- ograniczyc ani nawet policzyc.
--
-- Grupa NULL, tak jak kawa: to napar, nie kategoria pokrycia tygodniowego.
-- Zadnego ograniczenia tu nie dokladam, bo takiej decyzji nie bylo.
--
-- Makra sproszkowanego liscia na 100 g, wartosci typowe dla matchy
-- ceremonialnej: 300 kcal, B 30, T 5, W 39, blonnik 38. Porcja 2 g to 6 kcal.

INSERT INTO foods (id, name, group_id, fodmap, fermented, histamine, fiber_type, notes) VALUES
  (156, 'matcha', NULL, 'low', 0, 'low', 'insoluble',
   'Sproszkowany lisc zielonej herbaty. 300 kcal/100 g, B 30, T 5, W 39, blonnik 38. Porcja 2 g = ok. 65 mg kofeiny')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, fodmap = excluded.fodmap, notes = excluded.notes;

INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('matcha', 156, '2026-08-14'),
  ('herbata matcha', 156, '2026-08-14')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id;
