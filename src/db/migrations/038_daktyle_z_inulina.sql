-- 038: daktyle z kremem pistacjowym, czyli daktyle z dodana inulina
--
-- Etykieta z 13.08: daktyle suszone 83%, BLONNIK Z KORZENIA CYKORII, pistacje 4%,
-- tluszcz kokosowy, aromat, sol. Makra na 100 g: 324 kcal, T 3,3, W 62 (w tym
-- cukry 61), blonnik 17, B 2,8, sol 0,79.
--
-- Osobny produkt, nie alias do 133, bo to nie jest ta sama ekspozycja.
-- Same daktyle maja ok. 8 g blonnika na 100 g. Tutaj jest 17, a roznica to
-- blonnik z cykorii, czyli INULINA. Inulina to czysty fruktan i jeden
-- z najsilniej fermentujacych skladnikow, jakie istnieja. Produkt sprzedawany
-- jako „z blonnikiem" jest wiec przy IMO gorszy niz sam daktyl, a nie lepszy,
-- i to jest dokladnie ten przypadek, w ktorym nazwa na opakowaniu myli.
--
-- DWA WIERSZE OGRANICZEN, nie jeden z regula w tekscie:
--   do 17.08  limit, jedna sztuka, tak samo jak zwykle daktyle
--   od 18.08  zakaz, bo rusza low FODMAP i inulina wypada w calosci
-- Zakodowane datami, bo silnik i tak filtruje po zakresie, a upychanie
-- „od 18.08 wcale" w max_amount robi z pola opisowego druga regule.

INSERT INTO foods (id, name, group_id, fodmap, fermented, notes) VALUES
  (154, 'daktyle z kremem pistacjowym', NULL, 'high', 0,
   'True Fruits, 324 kcal/100 g, W 62 (cukry 61), blonnik 17, B 2,8. Sztuka ok. 8 g. Blonnik z cykorii, czyli inulina, dodany ponad to, co jest w daktylu')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, fodmap = excluded.fodmap, notes = excluded.notes;

INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('daktyle z kremem pistacjowym', 154, '2026-08-13'),
  ('daktyle z pistacjami', 154, '2026-08-13'),
  ('błonnik z cykorii', 154, '2026-08-13'),
  ('inulina', 154, '2026-08-13')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id;

INSERT INTO restrictions (food_id, level, reason, source, date_from, date_to, status, max_amount)
SELECT 154, 'limit',
  'Fruktany plus nadmiar fruktozy nad glukoza, jak w zwyklym daktylu, a do tego inulina z cykorii dosypana osobno',
  'Etykieta produktu, Monash FODMAP, decyzja 13.08.2026', '2026-08-13', '2026-08-17', 'active', '1 sztuka dziennie'
WHERE NOT EXISTS (SELECT 1 FROM restrictions WHERE food_id = 154 AND level = 'limit');

INSERT INTO restrictions (food_id, level, reason, source, date_from, date_to, status, max_amount)
SELECT 154, 'forbidden',
  'Inulina z cykorii to czysty fruktan, jeden z najsilniej fermentujacych skladnikow. Na diecie low FODMAP wypada w calosci, niezaleznie od liczby sztuk',
  'Monash FODMAP, decyzja 13.08.2026', '2026-08-18', '2026-09-14', 'active', NULL
WHERE NOT EXISTS (SELECT 1 FROM restrictions WHERE food_id = 154 AND level = 'forbidden');
