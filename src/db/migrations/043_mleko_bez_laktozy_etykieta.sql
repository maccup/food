-- 043: mleko bez laktozy, makra z etykiety zamiast szacunku
--
-- Do 14.08.2026 wpisy liczone byly z zalozenia "1,5 procent, czyli okolo
-- 47 kcal i 3,4 g bialka na 100 ml". Etykieta produktu, ktory Maciek faktycznie
-- kupuje (Carrefour bez laktozy), mowi 44 kcal, B 3,0, T 1,5, W 4,7. Roznica na
-- szklance jest mala, ale to jest jedyny skladnik, ktory wchodzi codziennie do
-- matchy po obiedzie i do kawy, wiec szacunek nie ma tu czego robic.
--
-- Notatka idzie tez do seed-foods.sql, bo seed nadpisuje kolumne notes.
--
-- Przeliczone wiersze dziennika, wylacznie zrodlo "dom":
--   56, 63, 72  kawa z mlekiem 50 ml
--   87          matcha 2 g na mleku 315 ml
-- Wiersz 79 (latte 450 ml) zostaje bez zmian: to lokal, nie to mleko.

UPDATE foods
SET notes = 'Carrefour bez laktozy, etykieta 14.08.2026: 44 kcal/100 ml, T 1,5 (nasycone 1,0), W 4,7 (cukry 4,7), B 3,0, sol 0,10'
WHERE id = 38;

UPDATE meals
SET kcal = 24, protein_g = 1.7, fat_g = 0.8, carbs_g = 2.4,
    notes = 'Mleko bez laktozy 50 ml z etykiety: 22 kcal (B 1,5 T 0,8 W 2,4). Kawa czarna ok. 2 kcal. Przeliczone 14.08.2026 z etykiety Carrefour, wczesniej szacunek 47 kcal/100 ml'
WHERE id IN (56, 63, 72);

UPDATE meals
SET kcal = 144.6, protein_g = 10.1, fat_g = 4.8, carbs_g = 15.6, fiber_g = 0.8,
    notes = 'Rozbicie: mleko bez laktozy Carrefour 315 ml = 138,6 kcal (B 9,5 T 4,7 W 14,8) z etykiety 44 kcal/100 ml, matcha 2 g = 6 kcal (B 0,6 T 0,1 W 0,8 bl 0,8) przy 300 kcal/100 g. Stala pozycja po obiedzie, 14:30 do 15:00'
WHERE id = 87;

UPDATE meal_templates
SET kcal = 144.6, protein_g = 10.1, fat_g = 4.8, carbs_g = 15.6, fiber_g = 0.8
WHERE id = 7;
