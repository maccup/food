-- food.cupial.eu, dane startowe: protokol, cele, grupy produktow, suplementy
--
-- Zrodla, wszystkie z repo "Longevity Agent":
--   Konsultacje/2026-08-03_Sidor-Baginska_gastrolog.md   fazy, daty, rozklad dnia
--   Konsultacje/2026-05-21_Piotrowski.md                 cele makro
--   Diagnostyka/2026-08-09_hfood_low_fodmap_analiza.md   cele blonnika i bialka, okna jedzenia
--   Diagnostyka/Dieta_obecna_ranking.md                  sekcja "Czego w tej diecie brakuje"
--   CSV_Analysis/supplement_inventory.csv                stan preparatow
--
-- Jawne id, zeby ponowne uruchomienie nie duplikowalo wierszy.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- FAZY
-- ---------------------------------------------------------------------------

INSERT OR REPLACE INTO phases (id, name, date_from, date_to, diet_type, notes) VALUES
  (1, 'Antybiotyk: Xifaxan i neomycyna', '2026-08-03', '2026-08-17', 'lekkostrawna',
      'Rifaksymina 1600 mg/d plus neomycyna 1000 mg/d, 14 dni. Diety restrykcyjnej w trakcie sie nie stosuje.'),
  (2, 'Low FODMAP', '2026-08-18', '2026-09-14', 'low_fodmap',
      'Miesiac low FODMAP plus Sanprobi IBS. Bez prokinetyku, decyzja pacjenta z 09.08.'),
  (3, 'Rozszerzanie diety', '2026-09-15', NULL, 'rozszerzanie',
      'Pojedyncze wprowadzanie produktow z obserwacja 48 h. Po kontrolnym tescie oddechowym 14 do 18.09.');

-- ---------------------------------------------------------------------------
-- CELE MAKRO
-- Te same w kazdej fazie. Tluszcz to zalecenie Piotrowskiego, blonnik i bialko
-- wynikaja z analizy z 09.08: elastaza 151, wlasna obserwacja o blonniku,
-- oraz uwaga gastrolog o metioninie i homocysteinie.
-- ---------------------------------------------------------------------------

INSERT OR REPLACE INTO targets (id, phase_id, metric, min_value, max_value, source) VALUES
  (1,  1, 'kcal',      2300, 2700, 'zamowienie hfood 2500 kcal'),
  (2,  1, 'protein_g',  130,  160, 'Piotrowski 2026-05-21: mniej bialka; gastrolog 2026-05-15: metionina a homocysteina'),
  (3,  1, 'fat_g',       80,  100, 'Piotrowski 2026-05-21; elastaza trzustkowa 151 ug/g'),
  (4,  1, 'carbs_g',    250,  350, 'Piotrowski 2026-05-21: wiecej weglowodanow'),
  (5,  1, 'fiber_g',     20,   30, 'Analiza 2026-08-09; wlasna obserwacja: wiecej blonnika to twardszy stolec'),
  (6,  2, 'kcal',      2300, 2700, 'zamowienie hfood 2500 kcal'),
  (7,  2, 'protein_g',  130,  160, 'Piotrowski 2026-05-21'),
  (8,  2, 'fat_g',       80,  100, 'Piotrowski 2026-05-21; elastaza 151'),
  (9,  2, 'carbs_g',    250,  350, 'Piotrowski 2026-05-21'),
  (10, 2, 'fiber_g',     20,   30, 'Analiza 2026-08-09; do tego PHGG 10 g z FIBEgastrinu'),
  (11, 3, 'kcal',      2300, 2700, 'zamowienie hfood 2500 kcal'),
  (12, 3, 'protein_g',  130,  160, 'Piotrowski 2026-05-21'),
  (13, 3, 'fat_g',       80,  100, 'Piotrowski 2026-05-21; elastaza 151'),
  (14, 3, 'carbs_g',    250,  350, 'Piotrowski 2026-05-21'),
  (15, 3, 'fiber_g',     25,   35, 'Przy rozszerzaniu gorna granica rosnie');

-- ---------------------------------------------------------------------------
-- GRUPY PRODUKTOW
-- Kolumna provides mowi, po co ta grupa jest w diecie. Dzieki temu brak
-- opisuje sie po ludzku, np. "0 dni z zielonymi liscmi, czyli brak folianow".
-- ---------------------------------------------------------------------------

INSERT OR REPLACE INTO food_groups (id, code, name, provides) VALUES
  (1,  'zielone_liscie',     'Zielone warzywa lisciaste',        'foliany'),
  (2,  'warzywa_korzeniowe', 'Warzywa korzeniowe gotowane',      'blonnik rozpuszczalny'),
  (3,  'czerwone_mieso',     'Czerwone mieso i watrobka',        'cynk, zelazo hemowe, B12'),
  (4,  'ryby_tluste',        'Ryby tluste',                      'omega-3 EPA i DHA, witamina D'),
  (5,  'ryby_chude',         'Ryby chude',                       'bialko lekkostrawne, jod'),
  (6,  'kiwi',               'Kiwi zielone',                     'motoryka jelit'),
  (7,  'oliwa',              'Oliwa extra virgin',               'tluszcz jednonienasycony, polifenole'),
  (8,  'jaja',               'Jaja',                             'pelny aminogram, cholina'),
  (9,  'drob',               'Drob',                             'chude bialko'),
  (10, 'ziemniaki',          'Ziemniaki i bataty',               'skrobia, potas'),
  (11, 'kasze_ryz',          'Kasze i ryz',                      'weglowodany niskofermentujace'),
  (12, 'owoce_jagodowe',     'Owoce jagodowe',                   'polifenole, niskie FODMAP'),
  (13, 'nabial_bezlaktozowy','Nabial bez laktozy',               'wapn, bialko'),
  (14, 'fermentowane',       'Produkty fermentowane i kiszonki', 'probiotyki, ale teraz wykluczone'),
  (15, 'orzechy_nasiona',    'Orzechy i nasiona',                'tluszcze, magnez, cynk'),
  (16, 'straczki',           'Straczki',                         'bialko roslinne, ale wysokie FODMAP'),
  (17, 'warzywa_kapustne',   'Warzywa kapustne',                 'glukozynolany, ale gazotworcze'),
  (18, 'mieso_przetworzone', 'Mieso przetworzone',               'nic, pozycja onkologiczna'),
  (19, 'oleje_rafinowane',   'Oleje rafinowane i tluszcze roslinne utwardzone', 'nic'),
  (20, 'salaty_surowe',      'Salaty i warzywa surowe',          'blonnik nierozpuszczalny');

-- ---------------------------------------------------------------------------
-- REGULY POKRYCIA, czyli "czego w diecie brakuje"
-- Zrodlo: Dieta_obecna_ranking.md, sekcja "Czego w tej diecie brakuje" (7 pozycji)
-- ---------------------------------------------------------------------------

INSERT OR REPLACE INTO coverage_rules (id, group_id, min_days_per_week, min_portions_per_day, severity, rationale, active_from, active_to) VALUES
  (1, 1,  5, NULL, 'critical',
      'Homocysteina 19,20 przy MTHFR compound het. Foliany z jedzenia to podstawowa droga, TMG jest tylko szlakiem pomocniczym. Zielonych lisci nie bylo w zadnym z 6 zamowien.', '2026-08-03', NULL),
  (2, 6,  7,    2, 'critical',
      'Jedyny produkt spozywczy z powtorzonymi badaniami klinicznymi na zaparcie, niskofermentujacy. Po rezygnacji z prokinetyku 09.08 to jedno z trzech narzedzi na motoryke.', '2026-08-03', NULL),
  (3, 2,  4, NULL, 'important',
      'Burak, dynia, batat wiaza wode i zmiekczaja stolec przy wolnym pasazu. Maja zastapic kalafior i brukselke.', '2026-08-03', NULL),
  (4, 3,  2, NULL, 'important',
      'Brak zrodla cynku i zelaza hemowego. Cynk ma znaczenie przy deficycie testosteronu i treningu silowym.', '2026-08-03', NULL),
  (5, 4,  2, NULL, 'important',
      'Omega-3 z jedzenia, nie tylko z Osavi.', '2026-08-03', NULL),
  (6, 7,  5, NULL, 'important',
      'Jedyny tluszcz roslinny dodawany na zimno, ktory ma tu sens. Zero sztuk w szesciu zamowieniach.', '2026-08-03', NULL),
  (7, 10, 3, NULL, 'nice',
      'Brak zrodla skrobi poza ryzem i kaszami. Ziemniak gotowany jest niskofermentujacy i daje potas.', '2026-08-03', NULL);

-- ---------------------------------------------------------------------------
-- SUPLEMENTY I LEKI
-- Stan potwierdzony przez pacjenta 03.08 po resecie z maja.
-- ---------------------------------------------------------------------------

INSERT OR REPLACE INTO supplements (id, name, brand, kind, dose, purpose, status, rx, notes, source) VALUES
  (1,  'Xifaxan 400 mg',      'Alfasigma',   'lek',       '2 tabletki', 'eradykacja przerostu metanogenow', 'active',       1, 'Kurs 14 dni, ostatnia dawka 17.08 rano', 'Sidor-Baginska 2026-08-03'),
  (2,  'Neomycinum 250 mg',   'TZF',         'lek',       '2 tabletki', 'eradykacja przerostu metanogenow', 'active',       1, 'Odstawic przy szumie w uszach, pogorszeniu sluchu lub zawrotach glowy', 'Sidor-Baginska 2026-08-03'),
  (3,  'FIBEgastrin',         NULL,          'blonnik',   '1 saszetka 5 g PHGG', 'zageszczenie stolca, odbudowa flory', 'active', 0, 'Czesciowo hydrolizowana guma guar. Badanie Furnari 2010.', 'Sidor-Baginska 2026-08-03 plus decyzja pacjenta 05.08'),
  (4,  'TMG 1000 mg',         'NOW Foods',   'suplement', '1 tabletka', 'homocysteina, szlak BHMT', 'active',              0, 'Zastapil B12 i B-complex', 'Piotrowski 2026-05-21'),
  (5,  'Karczoch 600 mg',     'Medica Herbs','suplement', '1 kapsulka', 'trawienie tluszczu, wzdecia', 'active',           0, 'Druga dawka do obiadu, jesli posilek tlusty', 'Piotrowski 2026-05-21'),
  (6,  'Essentiale Max',      'Sanofi',      'suplement', '1 kapsulka', 'fosfatydylocholina, emulsja tluszczu', 'active',  0, 'Synergia z karczochem', 'Piotrowski 2026-05-21'),
  (7,  'Super Omega 2900 mg', 'Osavi',       'suplement', '2 lyzeczki', 'omega-3 EPA i DHA', 'active',                     0, 'Postac plynna, cytrynowa', 'Piotrowski 2026-05-21'),
  (8,  'Witamina D3 + K2',    'Nutri-Well',  'suplement', '1 tabletka', 'witamina D 5000 IU', 'active',                    0, 'Dawki nie obnizamy, pacjent unika slonca', 'protokol wlasny'),
  (9,  'Kreatyna',            NULL,          'suplement', '10 g',       'sila, masa miesniowa', 'active',                  0, 'Na czczo. Hamuje synteze endogenna, czyli dziala w kierunku obnizenia homocysteiny', 'protokol wlasny'),
  (10, 'Codeage Methylfolate B Complex+', 'Codeage', 'suplement', '1 kapsulka', 'metylofolian, B12, B6', 'active',         0, 'Wznowiony 03.08 po skoku homocysteiny z 13,70 na 19,20. Pol dawki, bo powodem odstawienia byla wysoka B12.', 'Analiza panelu 2026-08-03'),
  (11, 'Clomid 25 mg',        NULL,          'lek',       '1 tabletka', 'os podwzgorze przysadka jadra', 'active',         1, 'Poniedzialek do soboty, niedziela wolna. Przesuniety na 22:30 na czas antybiotyku.', 'protokol wlasny'),
  (12, 'Sanprobi IBS',        'Sanprobi',    'probiotyk', '1 kapsulka', 'odbudowa flory po antybiotyku', 'planned',        0, 'Start 18.08, 4 tygodnie. Nie zaczynac w trakcie antybiotyku, neomycyna go zabije. Jedno opakowanie to 20 kapsulek, czyli dokupic do 05.09.', 'Sidor-Baginska 2026-08-03'),
  (13, 'Forlax 10 g',         'Ipsen',       'lek',       '1 saszetka', 'makrogol, zmiekczenie stolca', 'paused',          0, 'Wylacznie ratunkowo: 2 dni bez wyproznienia albo wyraznie twardszy stolec przez 2 dni z rzedu', 'Sidor-Baginska 2026-08-03, korekta 03.08'),
  (14, 'Prukalopryd (Resolor)', NULL,        'lek',       '2 mg',       'prokinetyk, pasaz jelita', 'discontinued',        1, 'DECYZJA PACJENTA 09.08: recepty nie bedzie. Temat wraca tylko przy dodatnim tescie kontrolnym 14 do 18.09.', 'Decyzja pacjenta 2026-08-09'),
  (15, 'Predox (itopryd)',    NULL,          'lek',       '50 mg',      'prokinetyk zoladkowy', 'discontinued',            1, 'Nie brac. Zly odcinek przewodu pokarmowego, podnosi prolaktyne.', 'Analiza 2026-08-03'),
  (16, 'Magnez cytrynian',    'NOW Foods',   'suplement', '400 mg',     'motoryka jelit, sen', 'paused',                   0, 'Wraca tylko jesli po 25.08 stolec bedzie twardy (Bristol 1 do 2) przez 3 dni z rzedu', 'Analiza 2026-08-09'),
  (17, 'Babka jajowata',      'Zielarnia',   'blonnik',   '1 lyzeczka ok. 5 g', 'blonnik zelujacy', 'planned',             0, 'Zalecona 25.03.2026, nigdy nie kupiona. Przy FIBEgastrinie 10 g dziennie na razie zbedna.', 'Piotrowski 2026-03-25');

-- ---------------------------------------------------------------------------
-- ROZKLAD DNIA
-- Zrodlo: Konsultacje/2026-08-03_Sidor-Baginska_gastrolog.md, tabela "Rozklad dnia"
-- Okna jedzenia: 09:00, 14:00, 18:30 (trzy podejscia zamiast pieciu posilkow)
-- ---------------------------------------------------------------------------

INSERT OR REPLACE INTO supplement_schedule (id, supplement_id, time_of_day, with_meal, days, amount, date_from, date_to, notes) VALUES
  (1,  9,  '07:00', 'na_czczo',  'daily', '10 g',        '2026-08-03', NULL,         NULL),
  (2,  1,  '08:00', NULL,        'daily', '2 tabletki',  '2026-08-03', '2026-08-17', 'Odstep 30 minut do neomycyny'),
  (3,  2,  '08:30', NULL,        'daily', '2 tabletki',  '2026-08-03', '2026-08-17', 'Posilek 15 do 30 minut pozniej'),
  (4,  3,  '09:00', 'sniadanie', 'daily', '1 saszetka',  '2026-08-05', '2026-08-17', 'W 200 do 250 ml wody, popic druga szklanka'),
  (5,  10, '09:00', 'sniadanie', 'daily', '1 kapsulka',  '2026-08-03', NULL,         NULL),
  (6,  8,  '09:00', 'sniadanie', 'daily', '1 tabletka',  '2026-08-03', NULL,         'Z tluszczem'),
  (7,  7,  '09:00', 'sniadanie', 'daily', '2 lyzeczki',  '2026-08-03', NULL,         NULL),
  (8,  5,  '09:00', 'sniadanie', 'daily', '1 kapsulka',  '2026-08-03', NULL,         NULL),
  (9,  6,  '09:00', 'sniadanie', 'daily', '1 kapsulka',  '2026-08-03', NULL,         NULL),
  (10, 5,  '14:00', 'obiad',     'daily', '1 kapsulka',  '2026-08-03', NULL,         'Tylko jesli posilek tlusty'),
  (11, 4,  '18:30', 'kolacja',   'daily', '1 tabletka',  '2026-08-03', NULL,         NULL),
  (12, 1,  '20:00', NULL,        'daily', '2 tabletki',  '2026-08-03', '2026-08-17', NULL),
  (13, 2,  '20:30', NULL,        'daily', '2 tabletki',  '2026-08-03', '2026-08-17', NULL),
  (14, 11, '22:30', NULL,        'pon,wt,sr,czw,pt,sob', '1 tabletka', '2026-08-03', NULL, 'Niedziela wolna. Odstep 2 h od neomycyny.'),
  (15, 3,  '09:00', 'sniadanie', 'daily', '1 saszetka',  '2026-08-18', '2026-09-14', 'Faza 2: dwie saszetki dziennie, rano i wieczorem'),
  (16, 3,  '18:30', 'kolacja',   'daily', '1 saszetka',  '2026-08-18', '2026-09-14', 'Faza 2: druga saszetka. Przy nasileniu gazow zostac przy jednej.'),
  (17, 12, '09:00', 'sniadanie', 'daily', '1 kapsulka',  '2026-08-18', '2026-09-14', 'Cztery tygodnie'),
  (18, 3,  '09:00', 'sniadanie', 'daily', '1 saszetka',  '2026-09-15', NULL,         'Przewlekle, zalecenie lekarki');
