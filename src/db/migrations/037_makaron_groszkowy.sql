-- 037: makaron z maki z zielonego groszku
--
-- Osobny wiersz, nie alias do groszku (97), z tego samego powodu co ryz czarny
-- w migracji 034: za miesiac w statystykach ma byc widac, ktory produkt
-- faktycznie byl jedzony, a makaron i garsc groszku to inna porcja i inne makra.
--
-- Poziom ZAKAZ do 14.09, identycznie jak groszek, ciecierzyca i soczewica.
-- Powod jest ten sam i nie oslabia go forma: maka z zielonego groszku to caly
-- groszek zmielony, wiec GOS zostaje w calosci. Odwrotnie niz izolat bialka
-- grochu, ktory jest nisko FODMAP wlasnie dlatego, ze GOS zostaje w odpadzie.
--
-- Makra z etykiety fotografowanej 13.08: 100 g PO UGOTOWANIU to 178 kcal,
-- B 11, T 0,8, W 28, blonnik 7,1. Sucha masa to 345 kcal i 11,9 g blonnika
-- na 100 g. Roznica jest dwukrotna, wiec przy kazdym wpisie trzeba wiedziec,
-- ktora wage podano.

INSERT INTO foods (id, name, group_id, fodmap, fermented, notes) VALUES
  (153, 'makaron z zielonego groszku', 16, 'high', 0,
   'Po ugotowaniu 178 kcal/100 g, B 11, T 0,8, W 28, blonnik 7,1. Sucha masa 345 kcal i blonnik 11,9')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, group_id = excluded.group_id, fodmap = excluded.fodmap, notes = excluded.notes;

INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('makaron z zielonego groszku', 153, '2026-08-13'),
  ('makaron z groszku', 153, '2026-08-13'),
  ('makaron groszkowy', 153, '2026-08-13')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id;

INSERT INTO restrictions (food_id, level, reason, source, date_from, date_to, status, max_amount)
SELECT 153, 'forbidden',
  'GOS. Maka z zielonego groszku to caly groszek zmielony, wiec GOS zostaje w calosci, inaczej niz w izolacie bialka grochu',
  'Monash FODMAP, analogia do produktow 97-99, decyzja 13.08.2026', '2026-08-13', '2026-09-14', 'active', NULL
WHERE NOT EXISTS (SELECT 1 FROM restrictions WHERE food_id = 153);
