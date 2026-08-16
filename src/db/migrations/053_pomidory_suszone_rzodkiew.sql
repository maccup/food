-- 053: pomidory suszone i rzodkiew biala
--
-- Kolejka nierozpoznanych po zmianie sniadania 18.08 na paste jajeczna.
--
-- Pomidory suszone to nie jest ten sam produkt co pomidor (id 11). Suszenie
-- zageszcza fruktany: Monash daje niska porcje ok. 4 polowek (8 g), powyzej
-- rosnie fruktan. W tym daniu sa dodatkiem smakowym, nie skladnikiem porcji,
-- wiec portion_role 'dodatek'. Grupa NULL, jak swiezy pomidor.
--
-- Rzodkiew biala (daikon) to warzywo surowe, wiec grupa 20 razem z rzodkiewka
-- i salatami, i tym samym wpada pod istniejace ograniczenie 'limit' na surowe
-- w tym okresie. Monash: niska FODMAP. Rola 'porcja', bo w tym daniu stanowi
-- baze warzywna, a nie posypke.

INSERT INTO foods (id, name, group_id, fodmap, fodmap_note, fermented, histamine, fiber_type, portion_role, notes) VALUES
  (163, 'pomidory suszone', NULL, 'moderate', 'fruktany', 0, 'high', 'mixed', 'dodatek',
   'Monash: nisko FODMAP do ok. 4 polowek (8 g), powyzej fruktany. Suszone pomidory to takze zrodlo histaminy'),
  (164, 'rzodkiew biała', 20, 'low', NULL, 0, 'low', 'mixed', 'porcja',
   'Daikon. Monash nisko FODMAP. Surowa, wiec obejmuje ja limit na warzywa surowe')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, group_id = excluded.group_id, fodmap = excluded.fodmap,
  portion_role = excluded.portion_role, notes = excluded.notes;

INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('pomidory suszone', 163, '2026-08-16'),
  ('rzodkiew biała', 164, '2026-08-16')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id;
