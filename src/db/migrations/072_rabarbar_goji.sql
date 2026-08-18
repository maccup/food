-- Dwa skladniki z dan wstawionych podczas przegladu 18.08 (jaglanka
-- z rabarbarem 25.08, pudding chia 27.08, chlebek malinowy 26.08).
-- Rabarbar: pelnoprawny produkt, low FODMAP. Jagody goji: posypka
-- kilkugramowa, idzie na ignored jak inne dekoracje.
-- Odwracalne: DELETE food 176, UPDATE aliasow na NULL.

INSERT INTO foods (id, name, group_id, fodmap, fodmap_note, fermented, histamine, fiber_type, processed_meat, refined_oil, notes) VALUES
  (176, 'rabarbar', NULL, 'low', NULL, 0, 'low', 'mixed', 0, 0, 'Low FODMAP; w cateringu jako mus')
ON CONFLICT(id) DO NOTHING;

UPDATE food_aliases SET food_id = 176 WHERE alias = 'rabarbar';
UPDATE food_aliases SET ignored = 1 WHERE alias = 'jagody goji';
