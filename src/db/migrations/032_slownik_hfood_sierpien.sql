-- 032: skladniki cateringu, ktorych silnik wykluczen nie widzial
--
-- Przeglad hfood 12.08 pokazal 20 skladnikow w wybranym menu 14-20.08 lezacych
-- w kolejce nierozpoznanych, czyli przechodzacych przez wykluczenia bez sladu.
-- To ta sama klasa bledu co 15 warzyw z 10.08 i „precel" z 026: produkt bez
-- aliasu jest dla silnika niewidzialny.
--
-- Trzy pozycje z tej dwudziestki to nie kosmetyka:
--
-- 1. „mleko" (19.08 podwieczorek) to mleko krowie, nie „mleko bez laktozy",
--    ktore catering pisze pelna nazwa. Grupa 13 nazywa sie „Nabial bez laktozy",
--    wiec nowy produkt do niej nie nalezy i dostaje wlasny limit, tak samo jak
--    skyr i twarog Speisequark.
-- 2. „jogurt roslinny naturalny" (19.08 sniadanie) to produkt z zywymi
--    kulturami, czyli grupa 14, czyli zakaz do 14.09. Roslinny nie znaczy
--    niefermentowany, a powodem zakazu jest histamina i substrat, nie laktoza.
-- 3. „boczniak ostrygowaty" (18.08 kolacja) jest u Monash NISKO FODMAP i tym
--    rozni sie od pieczarki (96, high, mannitol). Zapisane wprost, zeby przy
--    kolejnym przegladzie nie wyciac go przez podobienstwo nazwy.

INSERT INTO foods (id, name, group_id, fodmap, fermented, notes) VALUES
  (138, 'boczniak ostrygowaty', NULL, 'low', 0,
   'Nisko FODMAP wg Monash do ok. 75 g, inaczej niz pieczarka, ktora ma mannitol'),
  (139, 'serek wiejski bez laktozy', 13, 'low', 0,
   'Ok. 100 kcal/100 g, B 12. Liczy sie do pokrycia grupy 13'),
  (140, 'mak', 15, 'low', 0,
   'Nasiona, blonnik gownie nierozpuszczalny. Porcje w daniach sa male'),
  (141, 'babka plesznik', NULL, 'low', 0,
   'Psyllium, blonnik ROZPUSZCZALNY, czyli ten wlasciwy przy zaparciu z metanem'),
  (142, 'jogurt roslinny', 14, 'low', 1,
   'Zywe kultury, wiec produkt fermentowany mimo braku nabialu'),
  (143, 'mleko krowie', NULL, 'high', 0,
   'Laktoza ok. 4,8 g na 100 ml. To NIE jest to samo co produkt 38'),
  (144, 'maka bezglutenowa', 11, 'low', 0,
   'Mieszanka skrobiowa, zwykle ryz z kukurydza i tapioka'),
  (145, 'chrzan', NULL, 'low', 0, 'Korzen, porcje w dipach rzedu 10 g'),
  (146, 'musztarda', NULL, 'low', 0, 'Nisko FODMAP w porcji do lyzki'),
  (147, 'olej sezamowy', NULL, 'low', 0,
   'Tloczony, nie rafinowany, wiec poza czarna lista tluszczow')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, group_id = excluded.group_id,
  fodmap = excluded.fodmap, fermented = excluded.fermented, notes = excluded.notes;

INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('boczniak ostrygowaty', 138, '2026-08-12'),
  ('boczniaki', 138, '2026-08-12'),
  ('serek wiejski bez laktozy', 139, '2026-08-12'),
  ('serek wiejski', 139, '2026-08-12'),
  ('mak', 140, '2026-08-12'),
  ('babka płesznik', 141, '2026-08-12'),
  ('babka plesznik', 141, '2026-08-12'),
  ('jogurt roślinny naturalny', 142, '2026-08-12'),
  ('jogurt roślinny', 142, '2026-08-12'),
  ('mleko', 143, '2026-08-12'),
  ('mleko krowie', 143, '2026-08-12'),
  ('mąka bezglutenowa', 144, '2026-08-12'),
  ('chrzan', 145, '2026-08-12'),
  ('musztarda', 146, '2026-08-12'),
  ('olej sezamowy', 147, '2026-08-12'),
  -- Do produktow, ktore juz sa. Catering pisze mieso mielone opisowo.
  ('mięso wieprzowe mielone', 25, '2026-08-12'),
  ('wieprzowina mielona', 25, '2026-08-12'),
  ('wołowina mielona', 26, '2026-08-12'),
  ('indyk mięso mielone', 24, '2026-08-12'),
  ('papryka czerwona', 14, '2026-08-12'),
  ('bułka ryżowo-kukurydziana z ziarnami', 55, '2026-08-12'),
  ('placki ziemniaczane', 6, '2026-08-12'),
  ('sos pomidorowy', 12, '2026-08-12'),
  ('ogórki', 13, '2026-08-12'),
  -- Wpisy reczne z gramatura: stripQuantity zdejmuje jedna ilosc z przodu
  -- i jedna z tylu, wiec te formy nie trafialy w slownik i zostawaly sierotami.
  ('chleb białkowy 2 kromki 90 g', 129, '2026-08-10'),
  ('dżem truskawkowy 20 g', 118, '2026-08-10'),
  ('jajka 1,5 sztuki 75 g', 28, '2026-08-10'),
  ('makaron pszenny ugotowany 120 g', 121, '2026-08-10'),
  ('marchew gotowana 80 g', 1, '2026-08-10'),
  ('mleko bez laktozy 1,5% 50 ml', 38, '2026-08-10'),
  ('papryka czerwona 50 g', 14, '2026-08-10'),
  ('ryż biały ugotowany 130 g', 45, '2026-08-10'),
  ('seler naciowy gotowany 50 g', 100, '2026-08-10'),
  ('ser żółty plastry 50 g', 41, '2026-08-10'),
  ('łosoś wędzony na zimno 100 g', 31, '2026-08-10')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id;

-- Przyprawy i dodatki techniczne. Nie sa produktem, ktory cokolwiek zmienia
-- w tej diecie, a siedza w kolejce i zaslaniaja te skladniki, ktore zmieniaja.
UPDATE food_aliases SET ignored = 1
WHERE food_id IS NULL
  AND alias IN ('soda oczyszczona', 'pieprz ziołowy', 'sól morska', 'przyprawy',
                'cukier', 'konserwowe', 'serek śmietankowy');

-- Mleko krowie: laktoza, ten sam mechanizm co przy skyr i twarogu Speisequark.
INSERT INTO restrictions (food_id, level, reason, source, date_from, date_to, status, max_amount)
SELECT 143, 'limit',
  'Laktoza ok. 4,8 g na 100 ml, wielokrotnie powyzej progu Monash. Catering ma wersje bez laktozy, wiec zwykle mleko jest tu wyjatkiem, nie regula',
  'Monash FODMAP, przeglad hfood 12.08.2026', '2026-08-12', NULL, 'active', 'sladowe ilosci w daniu'
WHERE NOT EXISTS (SELECT 1 FROM restrictions WHERE food_id = 143);

-- Babka plesznik: jedyny skladnik w tym cateringu, ktory pracuje na pasaz.
INSERT INTO restrictions (food_id, level, reason, source, date_from, date_to, status, max_amount)
SELECT 141, 'prefer',
  'Blonnik rozpuszczalny, ten sam mechanizm co PHGG. Przy IMO z zaparciem to dokladnie ta frakcja, ktorej ma byc wiecej',
  'Analiza 2026-08-09, sekcja 3', '2026-08-12', NULL, 'active', NULL
WHERE NOT EXISTS (SELECT 1 FROM restrictions WHERE food_id = 141);
