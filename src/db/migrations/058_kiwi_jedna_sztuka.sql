-- 058: kiwi jako jedna sztuka
--
-- Szablon 8 nazywal sie "Kiwi zielone, 2 sztuki" i mial makra za dwa owoce.
-- Nazwa przyszla z pola examples grupy kiwi, gdzie "2 sztuki" oznacza CEL
-- DZIENNY z reguly 34 ('2 sztuki dziennie'), a nie porcje w jednym podejsciu.
-- Maciej je zwykle jedno naraz, wiec przy odhaczeniu dzien dostawal podwojne
-- kalorie i podwojny blonnik. Szablon nie byl jeszcze uzyty ani razu
-- (times_used = 0), wiec nie ma zadnego wpisu do skorygowania wstecz.
--
-- Makra jak w recznych wpisach z 10.08 i 14.08, ktore Maciej sam wprowadzil:
-- 45,8 kcal i 2,3 g blonnika na sztuke. Dwa kiwi to dwa dotkniecia.

UPDATE meal_templates SET
  name = 'Kiwi zielone, 1 sztuka',
  kcal = 45.8, protein_g = 0.8, fat_g = 0.4, carbs_g = 9.0, fiber_g = 2.3
WHERE id = 8;

-- Wpis z 16.08 powstal przez odhaczenie grupy w sekcji o brakach, czyli przed
-- poprawka w gaps.ts, i wyladowal bez zadnych makr.

UPDATE meals SET
  name = 'Kiwi zielone, 1 sztuka',
  kcal = 45.8, protein_g = 0.8, fat_g = 0.4, carbs_g = 9.0, fiber_g = 2.3
WHERE id = 93;
