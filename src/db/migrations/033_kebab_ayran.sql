-- 033: kebab, yufka, ayran i poprawka klasyfikacji jogurtu roslinnego
--
-- Kolacja 12.08 na miescie. Zadnego z tych skladnikow slownik nie znal, wiec
-- caly posilek bylby dla silnika wykluczen niewidzialny.
--
-- „Bulka yufka" idzie aliasem do 120, a nie nowym wierszem: to placek pszenny,
-- czyli ten sam zakaz co croissant, i nie ma powodu, zeby zakaz dublowac.
--
-- „Kebab wolowy" do grupy 18. Mieso z pionowego rozna jest formowane
-- i doprawione przemyslowo, czyli przetworzone, niezaleznie od tego, ze
-- surowcem jest wolowina. Gdyby to byly plastry pieczeni, produkt bylby inny.
--
-- AYRAN: dostaje LIMIT, nie zakaz, i to jest decyzja, nie odczyt.
-- Slownik nie ma tu spojnej reguly, tylko liste: kefir (43) jest w grupie 14
-- i zakazany, ale jogurt bez laktozy (39), skyr (44) i ser dojrzewajacy (41)
-- leza w 13 i sa dozwolone, choc wszystkie sa fermentowane. Ayran to
-- rozcienczony solony jogurt, wiec lezy dokladnie miedzy jogurtem a kefirem
-- i nie da sie go przypisac po samej definicji. Do tego laktoza: 2,6 g cukrow
-- na 100 ml to ok. 6,5 g na kubek 250 ml, czyli powyzej progu Monash, tak samo
-- jak przy skyr i twarogu Speisequark, ktore tez maja limit, a nie zakaz.
--
-- Przy okazji poprawka wlasnego bledu z migracji 032: „jogurt roslinny"
-- wpisalem do grupy 14, czyli pod zakaz do 14.09, uzasadniajac to zywymi
-- kulturami. To bylo niespojne, bo tym samym argumentem trzeba by zakazac
-- jogurtu bez laktozy, ktory od poczatku lezy w 13 i jest dozwolony. Jogurt
-- roslinny naturalny to jogurt zestalony, wiec idzie za 39, nie za kefirem.
-- Skutek: sniadanie 19.08 przestaje byc naruszeniem.

INSERT INTO foods (id, name, group_id, fodmap, fermented, notes) VALUES
  (148, 'kebab wolowy', 18, 'low', 0,
   'Mieso z pionowego rozna, formowane i doprawiane przemyslowo. Ok. 220 kcal/100 g, B 22, T 14'),
  (149, 'ayran', NULL, 'moderate', 1,
   'Napoj z jogurtu, wody i soli. Etykieta haydi: 38 kcal/100 ml, B 2,0, T 2,0, W 2,6, sol 0,77 g'),
  (150, 'sos jogurtowy', NULL, 'moderate', 1,
   'Jogurt krowi, wiec laktoza. Bez czosnku, potwierdzone przy wpisie 12.08'),
  (151, 'kapusta biala', 17, 'moderate', 0,
   'Surowa w kebabie. Warzywo kapustne, u Monash umiarkowane od ok. 100 g')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, group_id = excluded.group_id,
  fodmap = excluded.fodmap, fermented = excluded.fermented, notes = excluded.notes;

INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('kebab wołowy', 148, '2026-08-12'),
  ('kebab', 148, '2026-08-12'),
  ('mięso kebab', 148, '2026-08-12'),
  ('ayran', 149, '2026-08-12'),
  ('sos jogurtowy', 150, '2026-08-12'),
  ('kapusta biała', 151, '2026-08-12'),
  ('kapusta', 151, '2026-08-12'),
  -- Yufka to placek pszenny, wiec ten sam produkt co reszta pieczywa pszennego.
  ('bułka yufka', 120, '2026-08-12'),
  ('yufka', 120, '2026-08-12')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id;

INSERT INTO restrictions (food_id, level, reason, source, date_from, date_to, status, max_amount)
SELECT 149, 'limit',
  'Laktoza ok. 6,5 g na kubek 250 ml, powyzej progu Monash, tak samo jak skyr. Fermentowany, ale rozcienczony jogurt, wiec lzejszy niz kefir, ktory jest zakazany do 14.09',
  'Etykieta produktu, decyzja 12.08.2026', '2026-08-12', NULL, 'active', 'maks. 1 kubek, nie codziennie'
WHERE NOT EXISTS (SELECT 1 FROM restrictions WHERE food_id = 149);

-- Poprawka klasyfikacji z 032, opis wyzej.
UPDATE foods SET group_id = NULL,
  notes = 'Jogurt zestalony, wiec idzie za jogurtem bez laktozy (39), nie za kefirem. Fermentowany, ale poza grupa 14; klasyfikacja poprawiona 12.08'
WHERE id = 142;
