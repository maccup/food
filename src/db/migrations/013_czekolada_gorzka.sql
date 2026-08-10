-- 2026-08-10
-- "czekolada 85%" wskazywala na kakao, wiec w rozkladzie dnia kostka czekolady
-- wyswietlala sie jako "kakao". Kakao nie ma tluszczu ani cukru, czekolada ma
-- oba, a to one decyduja przy elastazie 151. Wlasny produkt, wlasne liczby.

PRAGMA foreign_keys = ON;

INSERT INTO foods (id, name, group_id, fodmap, fodmap_note, fermented, histamine, fiber_type, processed_meat, refined_oil, notes) VALUES
  (130, 'czekolada gorzka 85%', NULL, 'low', NULL, 0, 'moderate', 'insoluble', 0, 0,
   '592 kcal / 100 g, tłuszcz 46 g. Duża kostka to ok. 10 g, czyli ok. 4,6 g tłuszczu')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, fodmap = excluded.fodmap, histamine = excluded.histamine,
  notes = excluded.notes;

UPDATE food_aliases SET food_id = 130
WHERE alias IN ('czekolada 85%', 'czekolada gorzka 85%', 'kostka czekolady 85%');
