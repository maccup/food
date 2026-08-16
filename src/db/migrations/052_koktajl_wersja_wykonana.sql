-- 052: koktajl kakaowy, gramatura faktycznie odwazona 16.08
--
-- Poprzednie wersje (049, 051) byly moim wyliczeniem pod pasma dnia. Ta jest
-- tym, co realnie weszlo do blendera, wiec zastepuje tamta bez dyskusji:
-- szablon ma odtwarzac posilek, a nie plan posilku.
--
-- Owoce wszystkie mrozone, razem 95 g zamiast planowanych 150 g. Kazda pozycja
-- daleko pod progiem Monash na porcje (truskawki 150 g, maliny 60 g, borowki 40 g),
-- wiec mieszanka nie zbliza sie do zadnego limitu.
--
-- Kakao 10 g zamiast 7 g, czyli o 1 g wiecej blonnika i o 6 kcal.
--
-- Makra: skyr 63 kcal/100 g (B 10,7 T 0,2 W 4,0); kakao naturalne odtluszczone
-- 228 kcal/100 g (B 19,6 T 13,7 W 57,9 bl 37); truskawki 32 kcal/100 g (bl 2,0);
-- maliny 52 kcal/100 g (bl 6,5); borowki 57 kcal/100 g (bl 2,4).
-- Razem 271 kcal, B 38,1, T 2,5, W 28,5, bl 7,1.

UPDATE meal_templates SET
  ingredients = 'skyr 330 g, kakao 10 g, truskawki 50 g, maliny 32 g, borówki 13 g',
  kcal = 271, protein_g = 38.1, fat_g = 2.5, carbs_g = 28.5, fiber_g = 7.1
WHERE name = 'Koktajl kakaowy na skyrze';
