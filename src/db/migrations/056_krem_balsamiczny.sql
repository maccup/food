-- 056: krem balsamiczny
--
-- Z importu 19.08. To zageszczony ocet balsamiczny z cukrem, uzywany jako
-- polewa. Idzie za octem (112), bo mechanizm jest ten sam, a ilosc cukru
-- w polewie na salatke jest sladowa. Bez wlasnej reguly.

INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('krem balsamiczny', 112, '2026-08-16')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id, ignored = 0;
