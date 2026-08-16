-- 060: slownik po kolacji w restauracji 16.08
--
-- Cztery pozycje z kolejki nierozpoznanych. Trzy z nich to realne produkty,
-- a nie przyprawy, wiec brak mapowania oznaczal, ze silnik wykluczen ich
-- nie widzial.

-- Smietana kremowka. Do tej pory slownik znal tylko smietane roslinna (63),
-- wiec zwykla, czyli ta z laktoza, przechodzila bez slowa. Idzie za mlekiem
-- krowim (143), bo mechanizm jest ten sam.
INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('śmietana', 143, '2026-08-16'),
  ('kwaśna śmietana', 143, '2026-08-16'),
  ('śmietana kremówka', 143, '2026-08-16')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id, ignored = 0;

-- Panierka to maka pszenna i bulka tarta, czyli pszenica (58), zakaz
-- bezterminowy. Bez tych aliasow kazdy kotlet panierowany, ryba w piwnej
-- panierce i kazde nuggetsy przechodzily przez silnik czyste.
INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('bułka tarta', 58, '2026-08-16'),
  ('panierka', 58, '2026-08-16'),
  ('maka pszenna', 58, '2026-08-16'),
  ('mąka pszenna', 58, '2026-08-16')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id, ignored = 0;

-- Etykieta konkretnego produktu, ta sama rzecz co mleko bez laktozy (38).
INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('mleko bez laktozy carrefour 315 ml', 38, '2026-08-16')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id, ignored = 0;

-- Przyprawa, do zignorowania. Catering pisze "koper ogrodowy", restauracje
-- pisza "koperek".
INSERT INTO food_aliases (alias, food_id, ignored, first_seen) VALUES
  ('koperek', NULL, 1, '2026-08-16')
ON CONFLICT(alias) DO UPDATE SET ignored = 1, food_id = NULL;

-- Druga tura, po rozbiciu skladu schabowego na czesci skladowe.
INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('schab wieprzowy', 25, '2026-08-16'),
  ('kotlet schabowy panierowany', 25, '2026-08-16'),
  ('kotlet schabowy', 25, '2026-08-16'),
  ('młode ziemniaki', 6, '2026-08-16')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id, ignored = 0;
