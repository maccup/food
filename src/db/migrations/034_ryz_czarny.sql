-- 034: ryz czarny, watrobka drobiowa, zurawina
--
-- Ryz czarny to ryz pelnoziarnisty z nienaruszona okrywa, czyli ten sam
-- profil co ryz brazowy (46): kwas fitynowy i blonnik nierozpuszczalny.
-- Dostaje wiec ten sam poziom co brazowy, czyli LIMIT, a nie zakaz.
-- Osobny wiersz zamiast aliasu do 46, bo to inna odmiana i za miesiac
-- w statystykach ma byc widac, ktory z nich faktycznie jadl.
--
-- „zurawina suszona" i „watrobka drobiowa" istnialy jako produkty, ale bez
-- aliasu w tej formie, ktora Maciek pisze naturalnie. Produkt bez aliasu
-- jest dla silnika wykluczen niewidzialny, a zurawina ma limit.

INSERT INTO foods (id, name, group_id, fodmap, fermented, notes) VALUES
  (152, 'ryz czarny', 11, 'low', 0,
   'Pelnoziarnisty, ok. 130 kcal/100 g po ugotowaniu. Ten sam profil co ryz brazowy')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, group_id = excluded.group_id, fodmap = excluded.fodmap, notes = excluded.notes;

INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('ryż czarny', 152, '2026-08-13'),
  ('ryz czarny', 152, '2026-08-13'),
  ('wątróbka drobiowa', 27, '2026-08-13'),
  ('wątróbka z kurczaka', 27, '2026-08-13'),
  ('żurawina suszona', 125, '2026-08-13'),
  ('żurawina', 125, '2026-08-13'),
  ('surówka z selera', 5, '2026-08-13'),
  ('placki z cukinii', 15, '2026-08-13')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id;

INSERT INTO restrictions (food_id, level, reason, source, date_from, date_to, status, max_amount)
SELECT 152, 'limit', 'Kwas fitynowy, tak samo jak ryz brazowy',
  'Analogia do produktu 46, decyzja 13.08.2026', '2026-08-13', NULL, 'active', NULL
WHERE NOT EXISTS (SELECT 1 FROM restrictions WHERE food_id = 152);
