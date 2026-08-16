-- 059: szablony dla pozostalych grup z regula pokrycia
--
-- Po poprawce w gaps.ts odhaczenie grupy w sekcji o brakach bierze makra
-- z szablonu, ktorego pole ingredients rowna sie nazwie produktu z tej grupy.
-- Kiwi taki szablon mialo, pozostalych szesc grup nie, wiec dalej wpadalyby
-- do dziennika z pustymi kaloriami.
--
-- Porcje sa moje, dobrane jako typowe, nie zmierzone u Macka. Makra z USDA
-- FoodData Central dla surowca w podanej gramaturze. Do skorygowania, gdy
-- poda realne ilosci: wystarczy zmienic wiersz w meal_templates.
--
-- Pole ingredients musi doslownie rownac sie nazwie w tabeli foods, bo po tym
-- idzie dopasowanie. Stad 'szpinak', a nie 'szpinak swiezy'.
--
-- Osobne INSERT-y zamiast jednego UNION ALL, bo D1 odrzuca compound SELECT
-- z taka liczba czlonow ("too many terms in compound SELECT").

INSERT INTO meal_templates (name, ingredients, slot, source, kcal, protein_g, fat_g, carbs_g, fiber_g, estimated)
SELECT 'Szpinak, garść 60 g', 'szpinak', 'inne', 'dom', 14.0, 1.7, 0.2, 1.3, 1.3, 1
WHERE NOT EXISTS (SELECT 1 FROM meal_templates WHERE lower(ingredients) = 'szpinak');

INSERT INTO meal_templates (name, ingredients, slot, source, kcal, protein_g, fat_g, carbs_g, fiber_g, estimated)
SELECT 'Oliwa z oliwek, łyżka 10 g', 'oliwa z oliwek', 'inne', 'dom', 88.0, 0.0, 10.0, 0.0, 0.0, 1
WHERE NOT EXISTS (SELECT 1 FROM meal_templates WHERE lower(ingredients) = 'oliwa z oliwek');

INSERT INTO meal_templates (name, ingredients, slot, source, kcal, protein_g, fat_g, carbs_g, fiber_g, estimated)
SELECT 'Łosoś, porcja 150 g', 'łosoś', 'obiad', 'dom', 312.0, 30.0, 20.0, 0.0, 0.0, 1
WHERE NOT EXISTS (SELECT 1 FROM meal_templates WHERE lower(ingredients) = 'łosoś');

INSERT INTO meal_templates (name, ingredients, slot, source, kcal, protein_g, fat_g, carbs_g, fiber_g, estimated)
SELECT 'Wołowina, porcja 150 g', 'wołowina', 'obiad', 'dom', 264.0, 30.0, 15.0, 0.0, 0.0, 1
WHERE NOT EXISTS (SELECT 1 FROM meal_templates WHERE lower(ingredients) = 'wołowina');

INSERT INTO meal_templates (name, ingredients, slot, source, kcal, protein_g, fat_g, carbs_g, fiber_g, estimated)
SELECT 'Marchew gotowana, porcja 150 g', 'marchew', 'inne', 'dom', 53.0, 1.2, 0.3, 12.3, 4.5, 1
WHERE NOT EXISTS (SELECT 1 FROM meal_templates WHERE lower(ingredients) = 'marchew');

INSERT INTO meal_templates (name, ingredients, slot, source, kcal, protein_g, fat_g, carbs_g, fiber_g, estimated)
SELECT 'Ziemniaki gotowane, porcja 200 g', 'ziemniaki', 'obiad', 'dom', 174.0, 4.0, 0.2, 36.4, 3.6, 1
WHERE NOT EXISTS (SELECT 1 FROM meal_templates WHERE lower(ingredients) = 'ziemniaki');

-- Kiwi: bialko 0,8 bylo moja zaokraglona wartoscia, a w recznych wpisach
-- Macka z 10.08 i 14.08 stoi 0,9 za USDA. Rownamy do jego liczby.
UPDATE meal_templates SET protein_g = 0.9 WHERE id = 8;
UPDATE meals SET protein_g = 0.9 WHERE id = 93;
