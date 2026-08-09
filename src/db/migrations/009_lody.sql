-- 2026-08-09
-- Lody rzemieslnicze. Pistacje sa na czarnej liscie jako wysokofermentujace,
-- a smietankowa baza to laktoza, wiec pozycja odzywa sie z dwoch stron.
INSERT INTO foods (id, name, group_id, fodmap, fodmap_note, fermented, histamine, fiber_type, processed_meat, refined_oil, notes) VALUES
  (128, 'lody smietankowe', 13, 'moderate', 'laktoza', 0, 'moderate', 'none', 0, 0, 'Baza mleczno-smietankowa. Rzemieslnicze maja wiecej tluszczu niz przemyslowe')
ON CONFLICT(id) DO UPDATE SET name = excluded.name, notes = excluded.notes;

INSERT INTO food_aliases (alias, food_id, ignored) VALUES
  ('lody', 128, 0), ('lody śmietankowe', 128, 0), ('lody rzemieślnicze', 128, 0),
  ('pistacje', 71, 0), ('pasta pistacjowa', 71, 0)
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id;

INSERT INTO restrictions (id, food_id, group_id, level, reason, source, date_from, date_to, status, max_amount) VALUES
  (48, 128, NULL, 'limit', 'Laktoza w bazie smietankowej, do tego ladunek tluszczu w jednej porcji przy elastazie 151', 'food_list.md, nabial', '2026-08-03', NULL, 'active', 'jedna galka')
ON CONFLICT(id) DO UPDATE SET reason = excluded.reason, max_amount = excluded.max_amount;
