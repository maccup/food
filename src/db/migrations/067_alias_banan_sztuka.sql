-- Sprzatanie po luce parsera z 17.08.2026: "banan 1 sztuka" nie trafil
-- w slownik, bo lista jednostek znala "szt/sztuki/sztuk", ale nie "sztuka"
-- (poprawione w src/utils/ingredients.ts razem z ta migracja). Wpis w kolejce
-- nierozpoznanych zostal po skasowanym posilku; zamiast go kasowac, mapujemy
-- na banana, zeby kazde przyszle "banan 1 sztuka" bylo widoczne od razu,
-- takze w starszych wpisach przy ewentualnym przeliczeniu.
-- Odwracalne: UPDATE food_aliases SET food_id = NULL WHERE alias = 'banan 1 sztuka'.

UPDATE food_aliases
SET food_id = (SELECT id FROM foods WHERE name = 'banan')
WHERE alias = 'banan 1 sztuka' AND food_id IS NULL;
