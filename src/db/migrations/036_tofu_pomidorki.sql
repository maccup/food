-- 036: aliasy z kolacji 13.08
--
-- Zadnych nowych produktow, same formy zapisu, ktorych slownik nie znal.
-- „tofu naturalne" i „pomidorki koktajlowe" to sposob, w jaki Maciek pisze
-- naturalnie, a stripQuantity zdejmuje ilosc, nie przymiotnik.

INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('tofu naturalne', 33, '2026-08-13'),
  ('tofu twarde', 33, '2026-08-13'),
  ('pomidorki koktajlowe', 11, '2026-08-13'),
  ('pomidorki', 11, '2026-08-13'),
  ('rzodkiew', 135, '2026-08-13'),
  ('seler', 100, '2026-08-13')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id;
