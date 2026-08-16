-- 049: domowy koktajl kakaowy na skyrze jako szablon
--
-- Zastepuje "Koktajl kawowo-bananowy" z cateringu (16.08, II sniadanie).
-- Odrzucony przez Macka 16.08: stewia i kawa rozpuszczalna. Do tego caly banan,
-- czyli pozycja, ktora ten sam dokument analizy wymienia jako realne
-- rozminiecie cateringu z deklaracja low FODMAP.
--
-- Dobor pod dzien 16.08, nie pod ogolna zdrowotnosc:
--  * tluszcz. Dzien stal na 100,2 g przy pasmie 80 do 100. Pudelko dawalo 11 g,
--    ten koktajl daje 5,7 g, wiec dzien schodzi na 94,9 g. To byl jedyny powod,
--    dla ktorego w menu wygral wtedy koktajl z banana, i tu jest zalatwiony lepiej.
--  * bialko. Dzien mial 130,4 g, czyli dolna krawedz pasma 130 do 160.
--    Skyr 250 g dokłada 21 g wiecej niz pudelko.
--  * blonnik. Dzien mial 26,6 g przy pasmie 20 do 30, wiec skladniki dobrane tak,
--    zeby dolozyc 5 g, a nie 10. Stad 7 g kakao, a nie 15, i zero platkow i chia.
--  * truskawki, a nie maliny czy borowki. Monash: truskawki niskie FODMAP do 150 g,
--    maliny do 60 g, borowki do 40 g. Przy 120 g tylko truskawki mieszcza sie
--    z zapasem. Wszystkie trzy sa w zamrazarce, wiec to wybor, nie koniecznosc.
--
-- Makra: skyr 63 kcal/100 g (B 10,7 T 0,2 W 4,0), mleko bez laktozy Carrefour
-- 44 kcal/100 ml z etykiety (B 3,0 T 1,5 W 4,7), kakao naturalne odtluszczone
-- 228 kcal/100 g (B 19,6 T 13,7 W 57,9 bl 37), truskawki 32 kcal/100 g
-- (B 0,7 T 0,3 W 7,7 bl 2,0). Razem 322 kcal, B 36,4, T 5,7, W 35,1, bl 5,0.
--
-- Skyr 250 g to ok. 10 g laktozy i wchodzi w limit "maks. 1 porcja dziennie".
-- Ta sama porcja siedzi w szablonie "Owsianka z dodatkami", wiec to nie jest
-- nowa decyzja. Dwa te szablony tego samego dnia lamia limit.

INSERT INTO meal_templates (name, ingredients, slot, source, kcal, protein_g, fat_g, carbs_g, fiber_g, estimated)
SELECT * FROM (
  SELECT 'Koktajl kakaowy na skyrze' AS name,
         'skyr 250 g, mleko bez laktozy 250 ml, kakao 7 g, truskawki 120 g' AS ingredients,
         'ii_sniadanie' AS slot, 'dom' AS source,
         322 AS kcal, 36.4 AS protein_g, 5.7 AS fat_g, 35.1 AS carbs_g, 5.0 AS fiber_g, 1 AS estimated
) nowe
WHERE NOT EXISTS (SELECT 1 FROM meal_templates t WHERE t.name = nowe.name);
