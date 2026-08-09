-- 2026-08-09, produkty z bowli restauracyjnych
-- Kolejny wsad slownictwa, ktorego catering nie uzywa.

INSERT INTO foods (id, name, group_id, fodmap, fodmap_note, fermented, histamine, fiber_type, processed_meat, refined_oil, notes) VALUES
  (123, 'edamame',            16, 'low',      'GOS powyzej 90 g', 0, 'low',      'mixed',     0, 0, 'Niskie FODMAP do ok. 90 g, powyzej GOS'),
  (124, 'dymka',              NULL,'moderate','fruktany w bialej czesci', 0, 'low', 'mixed',  0, 0, 'Zielone szczypiory sa niskie FODMAP, biala cebulka juz nie. W restauracji nie wiadomo, ktora czesc'),
  (125, 'zurawina suszona',   12, 'moderate', 'fruktoza',         0, 'low',      'mixed',     0, 0, 'Prawie zawsze doslodzana'),
  (126, 'kurczak roslinny',   NULL,'low',     NULL,               0, 'low',      'none',      0, 0, 'Bialko grochu albo soi, produkt przetworzony'),
  (127, 'sos jogurtowy roslinny', 19,'low',   NULL,               0, 'low',      'none',      0, 1, 'Zwykle na oleju rafinowanym')
ON CONFLICT(id) DO UPDATE SET name = excluded.name, group_id = excluded.group_id,
  fodmap = excluded.fodmap, fodmap_note = excluded.fodmap_note, notes = excluded.notes;

INSERT INTO food_aliases (alias, food_id, ignored) VALUES
  ('edamame', 123, 0),
  ('dymka', 124, 0), ('cebula dymka', 124, 0), ('szczypior', 124, 0), ('frühlingszwiebeln', 124, 0), ('spring onions', 124, 0),
  ('żurawina', 125, 0), ('zurawina', 125, 0), ('cranberries', 125, 0),
  ('kurczak roślinny', 126, 0), ('planted chicken', 126, 0), ('planted.chicken', 126, 0),
  ('sos sałatkowy', 127, 0), ('sos jogurtowy roślinny', 127, 0),
  ('płatki migdałowe', 67, 0), ('chipsy migdałowe', 67, 0), ('migdały', 67, 0),
  ('płatki nerkowca', 70, 0), ('nerkowce', 70, 0), ('cashew', 70, 0),
  ('komosa ryżowa', 50, 0), ('quinoa', 50, 0),
  ('sałata', 20, 0), ('ogórek', 13, 0)
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id, ignored = excluded.ignored;

INSERT INTO restrictions (id, food_id, group_id, level, reason, source, date_from, date_to, status, max_amount) VALUES
  (45, 123, NULL, 'limit', 'Niskie FODMAP tylko do ok. 90 g, powyzej GOS', 'Monash', '2026-08-03', '2026-09-15', 'active', 'do 90 g'),
  (46, 124, NULL, 'limit', 'Biala cebulka to fruktany. W restauracji nie wiadomo, ktora czesc trafila do miski', 'food_list.md, czarna lista cebuli', '2026-08-03', '2026-09-15', 'active', 'tylko zielone szczypiory'),
  (47, 125, NULL, 'limit', 'Suszona i prawie zawsze doslodzana, czyli fruktoza', 'Dieta_obecna_ranking.md ranking B', '2026-08-03', '2026-09-15', 'active', 'garstka')
ON CONFLICT(id) DO UPDATE SET food_id = excluded.food_id, level = excluded.level,
  reason = excluded.reason, source = excluded.source, date_to = excluded.date_to, max_amount = excluded.max_amount;
