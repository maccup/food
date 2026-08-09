-- 2026-08-09
-- Chleb ze zdjęcia etykiety (Lidl, napis "mit Ölsaaten").
-- Odczytana tabela wartości: 268 kcal, tłuszcz 11,0 g, węglowodany 15,8 g,
-- błonnik 6,8 g, białko 23,0 g na 100 g. Porcja producenta 35 g.
--
-- 23 g białka na 100 g wyklucza żytni i pełnoziarnisty. To chleb białkowy.
-- Składu na zdjęciu nie da się odczytać, więc produkt wchodzi jako limit,
-- nie jako dozwolony i nie jako zakazany. Chleby białkowe stoją zwykle na
-- izolacie sojowym i glutenie pszennym, ale to jest wniosek z makro, nie
-- odczytana etykieta.

PRAGMA foreign_keys = ON;

INSERT INTO foods (id, name, group_id, fodmap, fodmap_note, fermented, histamine, fiber_type, processed_meat, refined_oil, notes) VALUES
  (123, 'chleb białkowy z ziarnami oleistymi', 11, 'moderate',
   'skład nieodczytany, izolat sojowy i gluten pszenny prawdopodobne',
   0, 'low', 'mixed', 0, 0,
   '268 kcal / 100 g, tłuszcz 11 g, błonnik 6,8 g, białko 23 g. Porcja 35 g')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, group_id = excluded.group_id, fodmap = excluded.fodmap,
  fodmap_note = excluded.fodmap_note, notes = excluded.notes;

INSERT INTO food_aliases (alias, food_id, ignored) VALUES
  ('chleb białkowy', 123, 0), ('chleb bialkowy', 123, 0),
  ('chleb proteinowy', 123, 0), ('eiweissbrot', 123, 0),
  ('kromka chleba białkowego', 123, 0),
  ('dżem malinowy', 118, 0), ('konfitura malinowa', 118, 0)
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id, ignored = excluded.ignored;

INSERT INTO restrictions (id, food_id, group_id, level, reason, source, date_from, date_to, status, max_amount) VALUES
  (45, 123, NULL, 'limit',
   'Skład z etykiety nieodczytany. Przy takim profilu makro baza chleba to izolat sojowy plus gluten pszenny, a pszenica jest na czarnej liście',
   'zdjęcie etykiety 09.08.2026, tabela wartości odżywczych', '2026-08-09', NULL, 'active',
   'jedna kromka dziennie, do czasu odczytania składu')
ON CONFLICT(id) DO UPDATE SET
  food_id = excluded.food_id, level = excluded.level, reason = excluded.reason,
  source = excluded.source, max_amount = excluded.max_amount, status = excluded.status;
