-- Slownik produktow, mapowanie skladow z hfood i wykluczenia.
--
-- Zrodla regul:
--   food_list.md                     czarna lista i listy dozwolonych
--   Diagnostyka/Dieta_obecna_ranking.md   rankingi A, B, C, D
--   Konsultacje/2026-08-03_Sidor-Baginska_gastrolog.md  fermentowane odpadaja do 15.09
--
-- Aliasy pochodza z prawdziwych skladow menu 14 do 16.08, nie z nazw wymyslonych.
-- Pozycje oznaczone ignored = 1 to przyprawy, sol, woda i fragmenty, ktore
-- catering rozdziela przecinkiem ("Oregano, suszone"). Nie sa bledem parsera,
-- tylko ich formatem, i celowo nie trafiaja do slownika.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- PRODUKTY
-- group_id wg food_groups z seed.sql
-- ---------------------------------------------------------------------------

INSERT OR REPLACE INTO foods (id, name, group_id, fodmap, fodmap_note, fermented, histamine, fiber_type, processed_meat, refined_oil, notes) VALUES
  -- warzywa korzeniowe i skrobiowe
  (1,  'marchew',              2, 'low',      NULL,        0, 'low',      'soluble',   0, 0, 'Gotowana wiaze wode i zmiekcza stolec'),
  (2,  'burak',                2, 'low',      NULL,        0, 'low',      'soluble',   0, 0, NULL),
  (3,  'dynia',                2, 'low',      NULL,        0, 'low',      'soluble',   0, 0, NULL),
  (4,  'pietruszka korzen',    2, 'low',      NULL,        0, 'low',      'soluble',   0, 0, NULL),
  (5,  'seler korzeniowy',     2, 'moderate', 'mannitol',  0, 'low',      'mixed',     0, 0, 'Niskie FODMAP do ok. 75 g, wyzej mannitol'),
  (6,  'ziemniaki',           10, 'low',      NULL,        0, 'low',      'mixed',     0, 0, NULL),
  (7,  'bataty',              10, 'low',      NULL,        0, 'low',      'soluble',   0, 0, 'Niskie FODMAP do ok. 75 g'),
  -- zielone liscie: kluczowe przy homocysteinie
  (8,  'szpinak',              1, 'low',      NULL,        0, 'moderate', 'mixed',     0, 0, 'Foliany. Homocysteina 19,20 przy MTHFR'),
  (9,  'pietruszka liscie',    1, 'low',      NULL,        0, 'low',      'mixed',     0, 0, 'Foliany'),
  (10, 'jarmuz',              1, 'low',      NULL,        0, 'low',      'mixed',     0, 0, 'Foliany'),
  -- warzywa pozostale
  (11, 'pomidor',             NULL, 'low',    NULL,        0, 'moderate', 'mixed',     0, 0, NULL),
  (12, 'przecier pomidorowy', NULL, 'low',    NULL,        0, 'moderate', 'soluble',   0, 0, NULL),
  (13, 'ogorek',              NULL, 'low',    NULL,        0, 'low',      'insoluble', 0, 0, NULL),
  (14, 'papryka',             NULL, 'low',    NULL,        0, 'low',      'mixed',     0, 0, NULL),
  (15, 'cukinia',             NULL, 'low',    NULL,        0, 'low',      'soluble',   0, 0, NULL),
  (16, 'fasolka szparagowa',  NULL, 'low',    NULL,        0, 'low',      'mixed',     0, 0, 'Niskie FODMAP do ok. 75 g'),
  (17, 'kukurydza',           NULL, 'moderate','GOS',      0, 'low',      'insoluble', 0, 0, 'Do ok. 75 g konserwowej'),
  (18, 'baklazan',            NULL, 'low',    NULL,        0, 'low',      'mixed',     0, 0, NULL),
  (19, 'brokuly',             17, 'moderate', 'fruktany',  0, 'low',      'mixed',     0, 0, 'Rozyczki niskie do 75 g, lodygi wysokie'),
  -- salaty surowe
  (20, 'salata',              20, 'low',      NULL,        0, 'low',      'insoluble', 0, 0, 'Forma surowa. Blonnik znikomy, wiec dopuszczalne'),
  (21, 'cykoria radicchio',   20, 'low',      NULL,        0, 'low',      'insoluble', 0, 0, NULL),
  (22, 'roszponka',           20, 'low',      NULL,        0, 'low',      'insoluble', 0, 0, NULL),
  -- bialko zwierzece
  (23, 'piers z kurczaka',     9, 'low',      NULL,        0, 'low',      'none',      0, 0, NULL),
  (24, 'piers z indyka',       9, 'low',      NULL,        0, 'low',      'none',      0, 0, NULL),
  (25, 'wieprzowina',          3, 'low',      NULL,        0, 'moderate', 'none',      0, 0, NULL),
  (26, 'wolowina',             3, 'low',      NULL,        0, 'moderate', 'none',      0, 0, 'Zrodlo cynku i zelaza hemowego'),
  (27, 'watrobka',             3, 'low',      NULL,        0, 'moderate', 'none',      0, 0, 'Zelazo, B12, cholina'),
  (28, 'jaja',                 8, 'low',      NULL,        0, 'low',      'none',      0, 0, NULL),
  (29, 'tunczyk',              4, 'low',      NULL,        0, 'high',     'none',      0, 0, 'Rtec, maks. raz w tygodniu'),
  (30, 'dorsz',                5, 'low',      NULL,        0, 'low',      'none',      0, 0, NULL),
  (31, 'losos',                4, 'low',      NULL,        0, 'moderate', 'none',      0, 0, NULL),
  (32, 'szproty',              4, 'low',      NULL,        0, 'high',     'none',      0, 0, 'Wedzone. Odsaczyc olej przy elastazie 151'),
  (33, 'tofu',                NULL, 'low',    NULL,        0, 'low',      'none',      0, 0, 'Twarde tofu jest niskofermentujace, FODMAP zostaja w serwatce'),
  (34, 'tempeh',              NULL, 'low',    NULL,        1, 'moderate', 'mixed',     0, 0, 'Soja fermentowana, oligosacharydy juz rozlozone'),
  -- mieso przetworzone: pozycja onkologiczna, nie FODMAP
  (35, 'boczek wedzony',      18, 'low',      NULL,        0, 'high',     'none',      1, 0, 'Azotyny'),
  (36, 'kielbasa',            18, 'low',      NULL,        0, 'high',     'none',      1, 0, 'Azotyny'),
  (37, 'parowki',             18, 'low',      NULL,        0, 'high',     'none',      1, 0, 'Azotyny'),
  -- nabial bez laktozy
  (38, 'mleko bez laktozy',   13, 'low',      NULL,        0, 'low',      'none',      0, 0, NULL),
  (39, 'jogurt bez laktozy',  13, 'low',      NULL,        0, 'moderate', 'none',      0, 0, NULL),
  (40, 'twarog bez laktozy',  13, 'low',      NULL,        0, 'moderate', 'none',      0, 0, NULL),
  (41, 'ser dojrzewajacy',    13, 'low',      NULL,        0, 'high',     'none',      0, 0, 'Gouda, parmezan, camembert, feta. Sladowa laktoza, ale histamina wysoka'),
  (42, 'mozzarella',          13, 'low',      NULL,        0, 'moderate', 'none',      0, 0, NULL),
  (43, 'kefir',               14, 'moderate', 'laktoza',   1, 'high',     'none',      0, 0, 'Odpada do 15.09'),
  (44, 'skyr',                13, 'moderate', 'laktoza',   1, 'moderate', 'none',      0, 0, 'Maks. 1 porcja dziennie'),
  -- kasze, ryz, skrobie
  (45, 'ryz',                 11, 'low',      NULL,        0, 'low',      'none',      0, 0, 'Trawiony w jelicie cienkim, minimum materialu dla bakterii'),
  (46, 'ryz brazowy',         11, 'low',      NULL,        0, 'low',      'insoluble', 0, 0, 'Kwas fitynowy, na liscie do omijania'),
  (47, 'kasza gryczana',      11, 'low',      NULL,        0, 'low',      'mixed',     0, 0, NULL),
  (48, 'kasza jaglana',       11, 'low',      NULL,        0, 'low',      'mixed',     0, 0, NULL),
  (49, 'kasza kukurydziana',  11, 'low',      NULL,        0, 'low',      'mixed',     0, 0, NULL),
  (50, 'komosa ryzowa',       11, 'low',      NULL,        0, 'low',      'mixed',     0, 0, 'Niskie FODMAP do ok. 150 g po ugotowaniu'),
  (51, 'platki owsiane',      11, 'moderate', 'fruktany',  0, 'low',      'soluble',   0, 0, 'Do 50 g suchych na porcje. Beta-glukan to dobry blonnik rozpuszczalny'),
  (52, 'maka ryzowa',         11, 'low',      NULL,        0, 'low',      'none',      0, 0, NULL),
  (53, 'skrobia',             11, 'low',      NULL,        0, 'low',      'none',      0, 0, 'Kukurydziana, ziemniaczana, z tapioki'),
  (54, 'maniok',              11, 'low',      NULL,        0, 'low',      'none',      0, 0, NULL),
  (55, 'pieczywo bezglutenowe',11,'low',      NULL,        0, 'low',      'mixed',     0, 0, NULL),
  (56, 'makaron bezglutenowy',11, 'low',      NULL,        0, 'low',      'none',      0, 0, NULL),
  (57, 'rostii',              10, 'low',      NULL,        0, 'low',      'mixed',     0, 0, 'Placki ziemniaczane, smazone'),
  (58, 'pszenica',            11, 'high',     'fruktany',  0, 'low',      'mixed',     0, 0, 'Czarna lista'),
  (59, 'chleb zytni',         11, 'high',     'fruktany',  1, 'moderate', 'mixed',     0, 0, 'Zyto to fruktany. Czarna lista'),
  -- tluszcze
  (60, 'oliwa z oliwek',       7, 'low',      NULL,        0, 'low',      'none',      0, 0, 'Jedyny tluszcz roslinny dodawany na zimno, ktory ma tu sens'),
  (61, 'olej rzepakowy',      19, 'low',      NULL,        0, 'low',      'none',      0, 1, 'Rafinowany. Czarna lista, ale jest w 13 z 45 dan cateringu'),
  (62, 'maslo roslinne',      19, 'low',      NULL,        0, 'low',      'none',      0, 1, 'Margaryna. Czarna lista, ale jest w 14 z 45 dan'),
  (63, 'smietana roslinna',   19, 'low',      NULL,        0, 'low',      'none',      0, 1, 'Zwykle na oleju rafinowanym plus emulgatory'),
  (64, 'majonez',             19, 'low',      NULL,        0, 'moderate', 'none',      0, 1, 'Olej rafinowany'),
  (65, 'maslo',               NULL,'low',     NULL,        0, 'low',      'none',      0, 0, 'Do 20 g dziennie'),
  (66, 'mleko kokosowe',      NULL,'low',     NULL,        0, 'low',      'none',      0, 0, NULL),
  -- orzechy i nasiona
  (67, 'migdaly',             15, 'moderate', 'GOS',       0, 'moderate', 'insoluble', 0, 0, 'Niskie FODMAP do 10 sztuk'),
  (68, 'orzechy wloskie',     15, 'low',      NULL,        0, 'low',      'insoluble', 0, 0, NULL),
  (69, 'orzechy arachidowe',  15, 'low',      NULL,        0, 'moderate', 'insoluble', 0, 0, NULL),
  (70, 'nerkowce',            15, 'high',     'GOS',       0, 'moderate', 'insoluble', 0, 0, 'Wysokofermentujace'),
  (71, 'pistacje',            15, 'high',     'GOS',       0, 'moderate', 'insoluble', 0, 0, 'Wysokofermentujace'),
  (72, 'pestki dyni',         15, 'low',      NULL,        0, 'low',      'insoluble', 0, 0, 'Mielic, inaczej przechodza w calosci'),
  (73, 'slonecznik',          15, 'low',      NULL,        0, 'low',      'insoluble', 0, 0, 'Mielic'),
  (74, 'sezam',               15, 'low',      NULL,        0, 'moderate', 'insoluble', 0, 0, 'Tylko jako posypka'),
  (75, 'nasiona chia',        15, 'low',      NULL,        0, 'low',      'mixed',     0, 0, 'Moczyc. Bardzo duzo blonnika na porcje'),
  (76, 'siemie lniane',       15, 'low',      NULL,        0, 'low',      'mixed',     0, 0, 'Mielic swiezo, inaczej przechodzi w calosci'),
  (77, 'kokos',               15, 'low',      NULL,        0, 'low',      'insoluble', 0, 0, 'Wiorki i platki'),
  (78, 'maslo orzechowe',     15, 'low',      NULL,        0, 'moderate', 'insoluble', 0, 0, NULL),
  (79, 'tahini',              15, 'low',      NULL,        0, 'moderate', 'insoluble', 0, 0, NULL),
  -- owoce
  (80, 'jagody',              12, 'low',      NULL,        0, 'low',      'mixed',     0, 0, NULL),
  (81, 'maliny',              12, 'low',      NULL,        0, 'moderate', 'mixed',     0, 0, NULL),
  (82, 'truskawki',           12, 'low',      NULL,        0, 'moderate', 'mixed',     0, 0, NULL),
  (83, 'borowki',             12, 'low',      NULL,        0, 'low',      'mixed',     0, 0, NULL),
  (84, 'porzeczki',           12, 'low',      NULL,        0, 'moderate', 'mixed',     0, 0, NULL),
  (85, 'kiwi zielone',         6, 'low',      NULL,        0, 'low',      'soluble',   0, 0, 'Jedyny owoc z powtorzonymi badaniami klinicznymi na zaparcie'),
  (86, 'banan',               NULL,'moderate','fruktany',  0, 'moderate', 'soluble',   0, 0, 'Dojrzaly ma duzo wiecej fruktanow niz lekko zielony'),
  (87, 'melon',               NULL,'low',     NULL,        0, 'low',      'mixed',     0, 0, 'Niskie FODMAP do ok. 120 g'),
  (88, 'awokado',             NULL,'moderate','sorbitol',  0, 'high',     'mixed',     0, 0, 'Maks. cwiartka na raz'),
  (89, 'jablko',              NULL,'high',    'fruktoza i sorbitol', 0, 'low', 'mixed',0, 0, 'Czarna lista'),
  (90, 'mango',               NULL,'high',    'fruktoza',  0, 'low',      'mixed',     0, 0, 'Czarna lista'),
  -- FODMAP bomby
  (91, 'czosnek',             NULL,'high',    'fruktany',  0, 'low',      'none',      0, 0, 'Czarna lista. W menu hfood nie wystapil ani razu'),
  (92, 'cebula',              NULL,'high',    'fruktany',  0, 'low',      'none',      0, 0, 'Czarna lista. W menu hfood nie wystapila ani razu'),
  (93, 'kalafior',            17, 'high',     'mannitol',  0, 'low',      'mixed',     0, 0, 'Czarna lista'),
  (94, 'brukselka',           17, 'high',     'fruktany',  0, 'low',      'mixed',     0, 0, 'Czarna lista'),
  (95, 'szparagi',            NULL,'high',    'fruktany',  0, 'low',      'mixed',     0, 0, 'Czarna lista'),
  (96, 'pieczarki',           NULL,'high',    'mannitol',  0, 'moderate', 'mixed',     0, 0, 'Czarna lista'),
  (97, 'groszek',             16, 'high',     'GOS',       0, 'low',      'mixed',     0, 0, NULL),
  (98, 'ciecierzyca',         16, 'high',     'GOS',       0, 'low',      'mixed',     0, 0, NULL),
  (99, 'soczewica',           16, 'high',     'GOS',       0, 'low',      'mixed',     0, 0, NULL),
  (100,'seler naciowy',       NULL,'high',    'mannitol',  0, 'low',      'insoluble', 0, 0, 'Powyzej pol lodygi'),
  -- fermentowane, odpadaja do 15.09
  (101,'ogorki kiszone',      14, 'moderate', NULL,        1, 'high',     'insoluble', 0, 0, 'Fermentujacy substrat plus histamina'),
  (102,'sok z kiszonej kapusty',14,'high',    NULL,        1, 'high',     'none',      0, 0, 'Fermentujacy substrat w plynie, czyli duza dawka naraz'),
  (103,'kimchi',              14, 'moderate', NULL,        1, 'high',     'mixed',     0, 0, NULL),
  (104,'oliwki',              14, 'low',      NULL,        1, 'high',     'mixed',     0, 0, 'Solanka, histamina'),
  (105,'kapary',              14, 'low',      NULL,        1, 'high',     'mixed',     0, 0, 'Solanka, histamina'),
  -- napoje i dodatki
  (106,'kawa',                NULL,'low',     NULL,        0, 'moderate', 'none',      0, 0, 'CYP1A2 posredni metabolizer. Limit 2 do 3 dziennie, do 14:00'),
  (107,'kakao',               NULL,'low',     NULL,        0, 'moderate', 'mixed',     0, 0, NULL),
  (108,'syrop klonowy',       NULL,'low',     NULL,        0, 'low',      'none',      0, 0, NULL),
  (109,'miod',                NULL,'high',    'fruktoza',  0, 'low',      'none',      0, 0, 'Wiecej fruktozy niz glukozy. Czarna lista'),
  (110,'imbir',               NULL,'low',     NULL,        0, 'low',      'none',      0, 0, 'Prokinetyk naturalny. Dziala na zoladek, nie na jelito cienkie'),
  (111,'bulion warzywny',     NULL,'low',     NULL,        0, 'moderate', 'none',      0, 0, 'Sprawdzic sklad pod katem cebuli i czosnku'),
  (112,'ocet',                NULL,'low',     NULL,        0, 'high',     'none',      0, 0, NULL),
  (113,'sok z cytrusow',      NULL,'low',     NULL,        0, 'moderate', 'none',      0, 0, NULL),
  (114,'napoj roslinny',      NULL,'low',     NULL,        0, 'low',      'none',      0, 0, 'Ryzowy, migdalowy, kokosowy'),
  (115,'sos sojowy',          NULL,'low',     NULL,        1, 'high',     'none',      0, 0, 'Fermentowany, histamina'),
  (116,'algi morskie',        NULL,'low',     NULL,        0, 'moderate', 'mixed',     0, 0, 'Ladunek jodu, maks. 2 razy w tygodniu');

-- ---------------------------------------------------------------------------
-- MAPOWANIE ALIASOW ZE SKLADOW HFOOD
-- ---------------------------------------------------------------------------

INSERT INTO food_aliases (alias, food_id, ignored) VALUES
  ('marchew', 1, 0), ('burak', 2, 0), ('sok z buraka', 2, 0), ('dynia', 3, 0),
  ('pietruszka', 4, 0), ('pietruszka korzeń', 4, 0), ('pietruszka korzen', 4, 0),
  ('seler korzeniowy', 5, 0), ('ziemniaki', 6, 0), ('bataty', 7, 0),
  ('szpinak', 8, 0), ('pietruszka liście', 9, 0), ('jarmuż', 10, 0),
  ('pomidor', 11, 0), ('pomidory', 11, 0), ('przecier pomidorowy', 12, 0),
  ('koncentrat pomidorowy', 12, 0), ('ogórek', 13, 0), ('papryka', 14, 0),
  ('cukinia', 15, 0), ('fasolka szparagowa', 16, 0), ('fasola szparagowa', 16, 0),
  ('kukurydza', 17, 0), ('bakłażan', 18, 0), ('brokuły', 19, 0),
  ('sałata lodowa', 20, 0), ('sałata fryzyjska', 20, 0), ('sałata rzymska', 20, 0),
  ('cykoria radicchio', 21, 0), ('roszponka', 22, 0), ('rukola', 22, 0),
  ('pierś z kurczaka', 23, 0), ('pierś z indyka', 24, 0), ('wieprzowina', 25, 0),
  ('jaja', 28, 0), ('jaja kurze', 28, 0), ('tuńczyk w sosie własnym', 29, 0),
  ('szproty wędzone', 32, 0), ('tofu', 33, 0), ('tempeh', 34, 0),
  ('boczek wędzony', 35, 0), ('kiełbasa wieprzowa', 36, 0),
  ('mleko bez laktozy 1,5 %', 38, 0), ('napój ryżowy', 114, 0),
  ('mleko migdałowe', 114, 0), ('jogurt naturalny bez laktozy 2,5%', 39, 0),
  ('jogurt naturalny', 39, 0), ('twaróg półtłusty bez laktozy', 40, 0),
  ('twaróg chudy bez laktozy', 40, 0), ('ser camembert bez laktozy', 41, 0),
  ('ser gouda bez laktozy', 41, 0), ('ser typu "feta" bez laktozy', 41, 0),
  ('ser parmezan', 41, 0), ('wegańska feta', 41, 0), ('ser wegański', 41, 0),
  ('mozzarella bez laktozy', 42, 0), ('wegańska mozzarella', 42, 0),
  ('ryż', 45, 0), ('kasza gryczana', 47, 0), ('kasza jaglana', 48, 0),
  ('kasza kukurydziana', 49, 0), ('komosa ryżowa', 50, 0),
  ('płatki owsiane bezglutenowe', 51, 0), ('mąka ryżowa', 52, 0),
  ('mąka gryczana', 52, 0), ('skrobia kukurydziana', 53, 0),
  ('skrobia ziemniaczana', 53, 0), ('skrobia ziemniaczna', 53, 0),
  ('mąka ziemniaczana', 53, 0), ('skrobia z tapioki', 53, 0), ('maniok', 54, 0),
  ('chleb bezglutenowy', 55, 0), ('bezglutenowy chleb rustykalny', 55, 0),
  ('chleb owsiany', 55, 0), ('bułka szkolna', 55, 0),
  ('bułka tarta bezglutenowa', 55, 0), ('wafle ryżowe', 55, 0),
  ('bezglutenowy makaron', 56, 0), ('makaron bezglutenowy ryżowo-kukurydziany', 56, 0),
  ('makaron', 56, 0), ('rostii', 57, 0),
  ('oliwa z oliwek', 60, 0), ('olej rzepakowy', 61, 0), ('masło roślinne', 62, 0),
  ('śmietana roślinna', 63, 0), ('śmietanka roślinna', 63, 0), ('majonez', 64, 0),
  ('masło', 65, 0), ('mleko kokosowe', 66, 0), ('mleczko kokosowe', 66, 0),
  ('migdały', 67, 0), ('płatki migdałowe', 67, 0), ('orzechy włoskie', 68, 0),
  ('orzechy arachidowe', 69, 0), ('dynia pestki', 72, 0), ('pestki dyni', 72, 0),
  ('słonecznik nasiona', 73, 0), ('słonecznik', 73, 0),
  ('sezam biały łuskany', 74, 0), ('nasiona chia', 75, 0),
  ('siemię lniane', 76, 0), ('wiórki kokosowe', 77, 0), ('płatki kokosowe', 77, 0),
  ('masło orzechowe 100%', 78, 0), ('tahini', 79, 0),
  ('jagody', 80, 0), ('maliny', 81, 0), ('truskawki', 82, 0), ('truskawka', 82, 0),
  ('borówki', 83, 0), ('porzeczki', 84, 0), ('kiwi', 85, 0), ('banan', 86, 0),
  ('melon', 87, 0), ('awokado', 88, 0),
  ('ogórki kiszone', 101, 0), ('ogórek kiszony', 101, 0), ('oliwki', 104, 0),
  ('kapary', 105, 0), ('kawa rozpuszczalna', 106, 0), ('kakao 16%', 107, 0),
  ('czekolada gorzka', 107, 0), ('syrop klonowy', 108, 0), ('imbir', 110, 0),
  ('imbir, korzeń', 110, 0), ('bulion warzywny', 111, 0),
  ('ocet balsamiczny', 112, 0), ('ocet winny biały', 112, 0), ('ocet ryżowy', 112, 0),
  ('sok z cytryn', 113, 0), ('sok z limonki', 113, 0), ('sos sojowy', 115, 0),
  ('teriyaki sos', 115, 0), ('pędy bambusa', NULL, 1), ('pesto zielone', 60, 0),
  ('chrzan tarty', NULL, 1), ('ketchup', 12, 0), ('płatki drożdzowe nieaktywne', NULL, 1),
  -- przyprawy, sol, woda i fragmenty rozdzielone przecinkiem przez catering
  ('sól himalajska', NULL, 1), ('sól', NULL, 1), ('pieprz czarny', NULL, 1),
  ('pieprz biały', NULL, 1), ('pieprz cayenne', NULL, 1), ('pieprz cytrynowy', NULL, 1),
  ('woda', NULL, 1), ('stewia', NULL, 1), ('drożdże', NULL, 1),
  ('proszek do pieczenia', NULL, 1), ('wanilia mielona', NULL, 1),
  ('curry', NULL, 1), ('kurkuma', NULL, 1), ('kurkuma, mielona', NULL, 1),
  ('cynamon', NULL, 1), ('kardamon', NULL, 1), ('kmin rzymski', NULL, 1),
  ('kminek', NULL, 1), ('kumin', NULL, 1), ('kolendra', NULL, 1),
  ('garam masala', NULL, 1), ('chili', NULL, 1), ('mielona papryka chili', NULL, 1),
  ('papryka ostra chili czerwona', NULL, 1), ('papryka ostra', NULL, 1),
  ('papryka mielona', NULL, 1), ('papryka słodka wędzona', NULL, 1),
  ('liść laurowy', NULL, 1), ('ziele angielskie', NULL, 1),
  ('majeranek', NULL, 1), ('oregano', NULL, 1), ('bazylia', NULL, 1),
  ('tymianek', NULL, 1), ('rozmaryn', NULL, 1), ('zioła prowansalskie', NULL, 1),
  ('koper ogrodowy', NULL, 1), ('czarnuszka', NULL, 1), ('mięta zielona', NULL, 1),
  ('gałka muszkatołowa', NULL, 1), ('mak niebieski', NULL, 1),
  ('skórka z cytryny', NULL, 1), ('cytryna', 113, 0), ('przyprawa chińska', NULL, 1),
  ('czubryca', NULL, 1), ('sok z cytryn ', NULL, 1),
  -- fragmenty: catering pisze "Oregano, suszone" i "Kukurydza, konserwowa"
  ('suszone', NULL, 1), ('suszony', NULL, 1), ('suszona', NULL, 1),
  ('mielona', NULL, 1), ('mielony', NULL, 1), ('słodka', NULL, 1),
  ('konserwowa', NULL, 1), ('nasiona', NULL, 1), ('30%', NULL, 1),
  ('świeża', NULL, 1), ('korzeń', NULL, 1)
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id, ignored = excluded.ignored;

-- ---------------------------------------------------------------------------
-- WYKLUCZENIA I LIMITY
-- ---------------------------------------------------------------------------

INSERT OR REPLACE INTO restrictions (id, food_id, group_id, level, reason, source, date_from, date_to, status, max_amount) VALUES
  -- bezterminowo, niezaleznie od metanu
  (1,  91,  NULL, 'forbidden', 'FODMAP bomba, fruktany', 'food_list.md, czarna lista', '2026-08-03', NULL, 'active', NULL),
  (2,  92,  NULL, 'forbidden', 'FODMAP bomba, fruktany', 'food_list.md, czarna lista', '2026-08-03', NULL, 'active', NULL),
  (3,  93,  NULL, 'forbidden', 'Mannitol', 'food_list.md, czarna lista', '2026-08-03', NULL, 'active', NULL),
  (4,  95,  NULL, 'forbidden', 'Fruktany', 'food_list.md, czarna lista', '2026-08-03', NULL, 'active', NULL),
  (5,  NULL, 18,  'forbidden', 'Mieso przetworzone, azotyny. To nie jest kwestia SIBO, tylko onkologiczna', 'food_list.md plus Dieta_obecna_ranking.md ranking D', '2026-08-03', NULL, 'active', NULL),
  (6,  58,  NULL, 'forbidden', 'Pszenica, fruktany', 'food_list.md, czarna lista', '2026-08-03', NULL, 'active', NULL),
  (7,  109, NULL, 'forbidden', 'Wiecej fruktozy niz glukozy, czyli fruktoza niewchlonieta w jelicie cienkim', 'Dieta_obecna_ranking.md ranking C', '2026-08-03', NULL, 'active', NULL),
  (8,  46,  NULL, 'limit',     'Kwas fitynowy', 'food_list.md, lista do omijania', '2026-08-03', NULL, 'active', 'rzadko'),
  -- na czas leczenia metanu, do kontrolnego testu
  (9,  94,  NULL, 'forbidden', 'Fruktany', 'Dieta_obecna_ranking.md ranking C', '2026-08-03', '2026-09-15', 'active', NULL),
  (10, 96,  NULL, 'forbidden', 'Mannitol', 'Dieta_obecna_ranking.md ranking C', '2026-08-03', '2026-09-15', 'active', NULL),
  (11, 89,  NULL, 'forbidden', 'Fruktoza plus sorbitol, jedno z najsilniejszych zrodel objawow', 'Dieta_obecna_ranking.md ranking C', '2026-08-03', '2026-09-15', 'active', NULL),
  (12, 90,  NULL, 'forbidden', 'Fruktoza', 'Dieta_obecna_ranking.md ranking C', '2026-08-03', '2026-09-15', 'active', NULL),
  (13, 97,  NULL, 'forbidden', 'GOS', 'Dieta_obecna_ranking.md ranking C', '2026-08-03', '2026-09-15', 'active', NULL),
  (14, 98,  NULL, 'forbidden', 'GOS, jeden z najsilniejszych fermentujacych skladnikow', 'Dieta_obecna_ranking.md ranking B', '2026-08-03', '2026-09-15', 'active', NULL),
  (15, 99,  NULL, 'forbidden', 'GOS', 'Dieta_obecna_ranking.md', '2026-08-03', '2026-09-15', 'active', NULL),
  (16, 100, NULL, 'limit',     'Mannitol powyzej pol lodygi', 'Dieta_obecna_ranking.md ranking B', '2026-08-03', '2026-09-15', 'active', 'mala ilosc, tylko do gotowania'),
  (17, 70,  NULL, 'forbidden', 'Wysokofermentujace', 'Dieta_obecna_ranking.md ranking B', '2026-08-03', '2026-09-15', 'active', NULL),
  (18, 71,  NULL, 'forbidden', 'Wysokofermentujace', 'Dieta_obecna_ranking.md ranking B', '2026-08-03', '2026-09-15', 'active', NULL),
  -- fermentowane: decyzja z 05.08, wracaja pojedynczo przy rozszerzaniu
  (19, NULL, 14,  'forbidden', 'Laktoza i fermentujacy substrat sa paliwem dla przerostu, zywe kultury i tak gina od neomycyny, a produkty fermentowane to bogate zrodlo histaminy', 'Sidor-Baginska 2026-08-03, dopytanie 05.08', '2026-08-03', '2026-09-15', 'active', NULL),
  (20, 102, NULL, 'forbidden', 'Fermentujacy substrat w plynie, czyli duza dawka naraz, plus ladunek histaminy. Najsilniejsza pozycja na liscie', 'Dieta_obecna_ranking.md ranking C', '2026-08-03', '2026-09-15', 'active', NULL),
  (21, 59,  NULL, 'forbidden', 'Zyto to fruktany', 'Dieta_obecna_ranking.md ranking C', '2026-08-03', '2026-09-15', 'active', NULL),
  -- limity ilosciowe
  (22, 61,  NULL, 'limit',     'Olej rafinowany. Nie da sie tego ominac wyborem menu, jest w 13 z 45 dan cateringu', 'food_list.md, czarna lista tluszczow', '2026-08-03', NULL, 'active', 'stały koszt cateringu'),
  (23, 62,  NULL, 'limit',     'Margaryna. Jest w 14 z 45 dan cateringu', 'food_list.md, czarna lista tluszczow', '2026-08-03', NULL, 'active', 'stały koszt cateringu'),
  (24, 63,  NULL, 'limit',     'Zwykle na oleju rafinowanym', 'food_list.md', '2026-08-03', NULL, 'active', NULL),
  (25, 64,  NULL, 'limit',     'Olej rafinowany', 'food_list.md', '2026-08-03', NULL, 'active', NULL),
  (26, 86,  NULL, 'limit',     'Dojrzaly ma znacznie wiecej fruktanow niz lekko zielony', 'Dieta_obecna_ranking.md ranking B', '2026-08-03', NULL, 'active', '1 sztuka, lekko niedojrzaly'),
  (27, 88,  NULL, 'limit',     'Sorbitol', 'Dieta_obecna_ranking.md ranking B', '2026-08-03', NULL, 'active', 'maks. cwiartka na raz'),
  (28, 106, NULL, 'limit',     'CYP1A2 posredni metabolizer. Do tego 1 Chemex dziennie poza cateringiem', 'genetic_snp_actionable.csv, rs762551', '2026-08-03', NULL, 'active', '2 do 3 dziennie, do 14:00'),
  (29, 29,  NULL, 'limit',     'Rtec', 'zasada ogolna', '2026-08-03', NULL, 'active', 'maks. raz w tygodniu'),
  (30, 75,  NULL, 'limit',     'Bardzo duzo blonnika na jedna porcje. Wlasna obserwacja: wiecej blonnika to twardszy stolec', 'Analiza 2026-08-09', '2026-08-03', '2026-09-15', 'active', 'nie wiecej niz raz dziennie'),
  (31, NULL, 20,  'limit',     'Surowe. Nie chodzi o sam produkt, tylko o forme w tym okresie', 'food_list.md, uwaga z 02.08', '2026-08-03', '2026-09-15', 'active', 'male ilosci'),
  (32, 44,  NULL, 'limit',     'Laktoza ok. 4 g na 100 g', 'Dieta_obecna_ranking.md ranking B', '2026-08-03', NULL, 'active', 'maks. 1 porcja dziennie'),
  -- preferowane
  (33, 60,  NULL, 'prefer',    'Jedyny tluszcz roslinny dodawany na zimno, ktory ma tu sens', 'Dieta_obecna_ranking.md ranking A', '2026-08-03', NULL, 'active', NULL),
  (34, 85,  NULL, 'prefer',    'Jedyny owoc z powtorzonymi badaniami klinicznymi na zaparcie', 'Dieta_obecna_ranking.md ranking A', '2026-08-03', NULL, 'active', '2 sztuki dziennie'),
  (35, 110, NULL, 'prefer',    'Prokinetyk naturalny', 'Dieta_obecna_ranking.md ranking A', '2026-08-03', NULL, 'active', NULL),
  (36, NULL, 1,   'prefer',    'Foliany. Homocysteina 19,20 przy MTHFR compound het', 'Dieta_obecna_ranking.md, sekcja o brakach', '2026-08-03', NULL, 'active', NULL),
  (37, NULL, 2,   'prefer',    'Blonnik rozpuszczalny, wiaze wode i zmiekcza stolec przy wolnym pasazu', 'Dieta_obecna_ranking.md ranking A', '2026-08-03', NULL, 'active', NULL),
  (38, NULL, 3,   'prefer',    'Cynk i zelazo hemowe, brakujace w obecnej diecie', 'Dieta_obecna_ranking.md, sekcja o brakach', '2026-08-03', NULL, 'active', NULL);
