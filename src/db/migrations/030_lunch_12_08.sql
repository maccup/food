-- 030: rzodkiewka, sos orzechowy i pasta serowa
--
-- Dwa z tych aliasow leza w kolejce nierozpoznanych od 10.08 z pustym food_id,
-- czyli przechodza przez silnik wykluczen bez sladu. To ta sama klasa bledu co
-- „precel" w migracji 026 i 15 warzyw znalezionych 10.08.
--
-- Sos orzechowy dostaje LIMIT, nie zakaz i nie wolna reke. Same orzeszki
-- arachidowe sa nisko fermentujace i do 30 g nie robia problemu, ale gotowy sos
-- satay prawie zawsze ma cebule i czosnek, a te dwie rzeczy sa u Macka zakazane
-- bez konca. Nie wiem, co jest w tym konkretnym sloiku, wiec zapis mowi wprost,
-- ze sklad jest niesprawdzony, zamiast udawac jedno albo drugie.
--
-- Pasta serowa paprykowa bez grupy: to przetwor, a nie porcja nabialu, wiec nie
-- moze odhaczac tygodniowego pokrycia grupy 13.

INSERT INTO foods (id, name, group_id, fodmap, fermented, notes) VALUES
  (135, 'rzodkiewka', 20, 'low', 0,
   'Surowe warzywo korzeniowe, nisko fermentujace. 16 kcal/100 g'),
  (136, 'sos orzechowy satay', NULL, 'high', 0,
   'Ok. 300 kcal/100 g, T 22, B 10, W 14. Sklad tego sloika NIESPRAWDZONY: gotowe sosy satay maja zwykle cebule i czosnek'),
  (137, 'pasta serowa paprykowa', NULL, 'moderate', 0,
   'Przetwor serowy z papryka, ok. 250 kcal/100 g. Sklad niesprawdzony, czesc past ma czosnek')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, group_id = excluded.group_id, fodmap = excluded.fodmap, notes = excluded.notes;

INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('rzodkiewka', 135, '2026-08-12'),
  ('rzodkiewki', 135, '2026-08-12'),
  ('sos orzechowy', 136, '2026-08-12'),
  ('sos fistaszkowy', 136, '2026-08-12'),
  ('sos satay', 136, '2026-08-12'),
  ('sos orzechowy 60 g', 136, '2026-08-10'),
  ('pasta serowa', 137, '2026-08-12'),
  ('pasta serowa paprykowa', 137, '2026-08-12'),
  ('pasta serowa paprykowa 20 g', 137, '2026-08-10')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id;

INSERT INTO restrictions (food_id, level, reason, source, date_from, date_to, status, max_amount)
SELECT 136, 'limit',
  'Same orzeszki arachidowe sa nisko fermentujace, ale gotowy sos satay prawie zawsze ma cebule i czosnek, zakazane bez konca. Sklad tego sloika niesprawdzony',
  'Monash FODMAP, decyzja 12.08.2026', '2026-08-12', NULL, 'active', 'lyzka do sprawdzenia skladu'
WHERE NOT EXISTS (SELECT 1 FROM restrictions WHERE food_id = 136);
