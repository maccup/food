-- 048: dwie herbaty ziolowe Zielarnia jako szablony, plus ziola z ich skladu
--
-- Sa pite regularnie, a w slowniku nie bylo ani jednego skladnika, wiec dla
-- silnika wykluczen te napary nie istnialy. To samo, co bylo z matcha (042).
--
-- SEN: meczennica cielista ziele, lawenda kwiat, mieta pieprzowa lisc,
--      mniszek lekarski korzen, melisa lisc. 100 g, Zielarnia / zielarzpolski.pl.
-- BRZUCH SPOKOJNY ("I.B.S."): mieta pieprzowa lisc, prawoslaz lisc, anyz owoc,
--      kurkuma klacze, oman korzen, chmiel szyszki. Ten sam producent.
--
-- Klinicznie licza sie trzy skladniki, wszystkie z tego samego powodu: fruktany.
--
--  * mniszek lekarski korzen. Monash przetestowal herbate z mniszka: mocny
--    napar (powyzej 3 minut) na 250 ml jest wysoki we fruktany, slaby jest niski.
--    Instrukcja z opakowania mowi 15 minut, czyli mocny napar.
--  * oman korzen (Inula helenium). Najbogatsze zrodlo inuliny wsrod ziol,
--    19 do 44 % suchej masy korzenia, w zaleznosci od pory zbioru.
--  * anyz owoc. Monash nie badal anyzu osobno; badal kopr wloski, ktory jest
--    wysoki we fruktany juz przy 180 ml slabego naparu. Anyz to inna roslina
--    o podobnym profilu, wiec zostaje 'unknown', a nie zgadywane 'high'.
--
-- Ilosc, bo ona rozstrzyga: lyzka mieszanki to ok. 2 g, pojedyncze ziolo ma
-- w niej 0,3 do 0,4 g, przy 20 do 40 % inuliny daje to ok. 0,1 g fruktanow
-- na kubek. Prog Monash dla porcji niskiej to ok. 0,3 g. Dlatego zadnego
-- ograniczenia tu nie ma: taka porcja miesci sie ponizej progu, a proporcje
-- mieszanki nie sa deklarowane, wiec dokladniej sie nie da. Gdyby objawy
-- wskazaly inaczej, wiersz w restrictions dokladamy wtedy, nie na zapas.
--
-- Reszta ziol idzie jako aliasy ignorowane, tak samo jak przyprawy: nie maja
-- wlasnej roli w wykluczeniach, a bez wpisu wracalyby do kolejki nierozpoznanych
-- przy kazdym kubku.

INSERT INTO foods (id, name, group_id, fodmap, fodmap_note, fermented, histamine, fiber_type, notes) VALUES
  (159, 'mniszek lekarski korzeń', NULL, 'high', 'fruktany', 0, 'low', 'soluble',
   'Inulina. Monash: mocny napar (powyzej 3 min) na 250 ml wysoki we fruktany, slaby niski. W mieszance SEN ok. 0,4 g na kubek'),
  (160, 'oman korzeń', NULL, 'high', 'fruktany', 0, 'low', 'soluble',
   'Inula helenium, 19 do 44 % inuliny w suchym korzeniu, najbogatsze zrodlo wsrod ziol. W mieszance BRZUCH SPOKOJNY ok. 0,3 g na kubek'),
  (161, 'anyż', NULL, 'unknown', 'fruktany', 0, 'low', 'soluble',
   'Monash nie badal anyzu. Kopr wloski, roslina o podobnym profilu, jest wysoki we fruktany juz przy 180 ml slabego naparu')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, fodmap = excluded.fodmap, fodmap_note = excluded.fodmap_note, notes = excluded.notes;

INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('mniszek lekarski korzeń', 159, '2026-08-16'),
  ('mniszek lekarski', 159, '2026-08-16'),
  ('oman korzeń', 160, '2026-08-16'),
  ('oman', 160, '2026-08-16'),
  ('anyż', 161, '2026-08-16'),
  ('anyż owoc', 161, '2026-08-16')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id;

INSERT INTO food_aliases (alias, food_id, ignored, first_seen) VALUES
  ('męczennica', NULL, 1, '2026-08-16'),
  ('lawenda', NULL, 1, '2026-08-16'),
  ('mięta pieprzowa', NULL, 1, '2026-08-16'),
  ('melisa', NULL, 1, '2026-08-16'),
  ('prawoślaz', NULL, 1, '2026-08-16'),
  ('chmiel', NULL, 1, '2026-08-16')
ON CONFLICT(alias) DO UPDATE SET ignored = 1;

-- Szablony. Kcal 0 swiadomie: napar z suszu nie niesie mierzalnej energii,
-- a imbir zostaje w dzbanku, wiec z 5 g plastrow (ok. 4 kcal) do kubka
-- przechodzi mniej niz 2 kcal. Zero to nie brak danych, tylko wynik.
-- Slot 'inne', jak kawa, bo napar nie nalezy do zadnego podejscia.

INSERT INTO meal_templates (name, ingredients, slot, source, kcal, protein_g, fat_g, carbs_g, fiber_g, estimated)
SELECT * FROM (
  SELECT 'Herbata SEN z imbirem' AS name,
         'męczennica, lawenda, mięta pieprzowa, mniszek lekarski korzeń, melisa, imbir świeży 5 g, woda' AS ingredients,
         'inne' AS slot, 'dom' AS source, 0 AS kcal, 0 AS protein_g, 0 AS fat_g, 0 AS carbs_g, 0 AS fiber_g, 1 AS estimated
  UNION ALL SELECT 'Herbata SEN',
         'męczennica, lawenda, mięta pieprzowa, mniszek lekarski korzeń, melisa, woda',
         'inne', 'dom', 0, 0, 0, 0, 0, 1
  UNION ALL SELECT 'Herbata Brzuch Spokojny z imbirem',
         'mięta pieprzowa, prawoślaz, anyż, kurkuma, oman korzeń, chmiel, imbir świeży 5 g, woda',
         'inne', 'dom', 0, 0, 0, 0, 0, 1
  UNION ALL SELECT 'Herbata Brzuch Spokojny',
         'mięta pieprzowa, prawoślaz, anyż, kurkuma, oman korzeń, chmiel, woda',
         'inne', 'dom', 0, 0, 0, 0, 0, 1
) nowe
WHERE NOT EXISTS (SELECT 1 FROM meal_templates t WHERE t.name = nowe.name);
