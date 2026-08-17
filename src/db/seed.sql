-- food.cupial.eu, dane startowe: protokół, cele, grupy produktów, suplementy
--
-- Źródła, wszystkie z repo "Longevity Agent":
--   Konsultacje/2026-08-03_Sidor-Baginska_gastrolog.md   fazy, daty, rozkład dnia
--   Konsultacje/2026-05-21_Piotrowski.md                 cele makro
--   Diagnostyka/2026-08-09_hfood_low_fodmap_analiza.md   cele błonnika i białka, okna jedzenia
--   Diagnostyka/Dieta_obecna_ranking.md                  sekcja "Czego w tej diecie brakuje"
--   CSV_Analysis/supplement_inventory.csv                stan preparatów
--
-- Jawne id plus ON CONFLICT DO UPDATE. Celowo NIE "INSERT OR REPLACE":
-- REPLACE kasuje wiersz i wstawia nowy, a przy kluczach obcych z ON DELETE CASCADE
-- zabralby ze soba powiazane dane. Ten plik ma byc bezpieczny do puszczenia
-- na zywej bazie w kazdej chwili.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- FAZY
-- ---------------------------------------------------------------------------

INSERT INTO phases (id, name, date_from, date_to, diet_type, notes) VALUES
  (1, 'Antybiotyk: Xifaxan i neomycyna', '2026-08-03', '2026-08-17', 'lekkostrawna',
      'Rifaksymina 1600 mg na dobę plus neomycyna 1000 mg na dobę, 14 dni. Diety restrykcyjnej w trakcie się nie stosuje.'),
  (2, 'Low FODMAP', '2026-08-18', '2026-09-14', 'low_fodmap',
      'Miesiąc low FODMAP plus Sanprobi IBS. Bez prokinetyku, decyzja pacjenta z 09.08.'),
  (3, 'Rozszerzanie diety', '2026-09-15', NULL, 'rozszerzanie',
      'Pojedyncze wprowadzanie produktów z obserwacją 48 h.')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, date_from = excluded.date_from, date_to = excluded.date_to,
  diet_type = excluded.diet_type, notes = excluded.notes;

-- ---------------------------------------------------------------------------
-- CELE MAKRO
-- Te same w każdej fazie. Błonnik z własnej obserwacji o twardości stolca,
-- białko z zapotrzebowania przy treningu siłowym. Przesłanki elastazy 151
-- i metioniny odrzucone audytem 15.08.2026 (migracja 047); źródła niżej
-- muszą się zgadzać z migracjami, inaczej db:seed je cofnie.
--
-- Tłuszcz NIE ma celu i to jest decyzja, nie przeoczenie (17.08.2026,
-- migracja 064): pasmo 80-100 g było jedną linijką od dietetyka bez
-- uzasadnienia, a lipidogram z 03.08 przy diecie powyżej 100 g/dobę wyszedł
-- rekordowy. Id 3, 8, 13 zostają wolne po skasowanych wierszach fat_g.
-- ---------------------------------------------------------------------------

INSERT INTO targets (id, phase_id, metric, min_value, max_value, source) VALUES
  (1,  1, 'kcal',      2300, 2700, 'zamówienie hfood 2500 kcal'),
  (2,  1, 'protein_g',  130,  160, 'Zapotrzebowanie przy treningu silowym, 1,6 do 1,9 g/kg przy 83 kg. Watek metioniny odrzucony 15.08.2026: bialko spadlo, a homocysteina wzrosla'),
  (4,  1, 'carbs_g',    250,  350, 'Piotrowski 2026-05-21: więcej węglowodanów'),
  (5,  1, 'fiber_g',     20,   30, 'Analiza 2026-08-09. Własna obserwacja: więcej błonnika to twardszy stolec'),
  (6,  2, 'kcal',      2300, 2700, 'zamówienie hfood 2500 kcal'),
  (7,  2, 'protein_g',  130,  160, 'Zapotrzebowanie przy treningu silowym, 1,6 do 1,9 g/kg przy 83 kg. Watek metioniny odrzucony 15.08.2026: bialko spadlo, a homocysteina wzrosla'),
  (9,  2, 'carbs_g',    250,  350, 'Piotrowski 2026-05-21'),
  (10, 2, 'fiber_g',     20,   30, 'Analiza 2026-08-09. Do tego PHGG 10 g z FIBEgastrinu'),
  (11, 3, 'kcal',      2300, 2700, 'zamówienie hfood 2500 kcal'),
  (12, 3, 'protein_g',  130,  160, 'Zapotrzebowanie przy treningu silowym, 1,6 do 1,9 g/kg przy 83 kg. Watek metioniny odrzucony 15.08.2026: bialko spadlo, a homocysteina wzrosla'),
  (14, 3, 'carbs_g',    250,  350, 'Piotrowski 2026-05-21'),
  (15, 3, 'fiber_g',     20,   30, 'v_day_totals liczy błonnik z jedzenia, a PHGG dokłada 5 g z góry. Własna obserwacja: więcej błonnika to więcej twardych grudek. Bez prokinetyku górnej granicy nie podnosimy automatycznie od 15.09, najwcześniej po ocenie dziennika 15.10.')
ON CONFLICT(id) DO UPDATE SET
  phase_id = excluded.phase_id, metric = excluded.metric,
  min_value = excluded.min_value, max_value = excluded.max_value, source = excluded.source;

-- ---------------------------------------------------------------------------
-- GRUPY PRODUKTÓW
-- Kolumna provides mówi, po co ta grupa jest w diecie. Dzięki temu brak
-- opisuje się po ludzku: "0 dni z zielonymi liśćmi, czyli brak folianów".
-- ---------------------------------------------------------------------------

INSERT INTO food_groups (id, code, name, provides) VALUES
  (1,  'zielone_liscie',     'Zielone warzywa liściaste',        'foliany'),
  (2,  'warzywa_korzeniowe', 'Warzywa korzeniowe gotowane',      'błonnik rozpuszczalny'),
  (3,  'czerwone_mieso',     'Czerwone mięso i wątróbka',        'cynk, żelazo hemowe, B12'),
  (4,  'ryby_tluste',        'Ryby tłuste',                      'omega-3 EPA i DHA, witamina D'),
  (5,  'ryby_chude',         'Ryby chude',                       'białko lekkostrawne, jod'),
  (6,  'kiwi',               'Kiwi zielone',                     'motoryka jelit'),
  (7,  'oliwa',              'Oliwa extra virgin',               'tłuszcz jednonienasycony, polifenole'),
  (8,  'jaja',               'Jaja',                             'pełny aminogram, cholina'),
  (9,  'drob',               'Drób',                             'chude białko'),
  (10, 'ziemniaki',          'Ziemniaki i bataty',               'skrobia, potas'),
  (11, 'kasze_ryz',          'Kasze, ryż i skrobie',             'węglowodany niskofermentujące'),
  (12, 'owoce_jagodowe',     'Owoce jagodowe',                   'polifenole, niskie FODMAP'),
  (13, 'nabial_bezlaktozowy','Nabiał bez laktozy',               'wapń, białko'),
  (14, 'fermentowane',       'Produkty fermentowane i kiszonki', 'probiotyki, ale teraz wykluczone'),
  (15, 'orzechy_nasiona',    'Orzechy i nasiona',                'tłuszcze, magnez, cynk'),
  (16, 'straczki',           'Strączki',                         'białko roślinne, ale wysokie FODMAP'),
  (17, 'warzywa_kapustne',   'Warzywa kapustne',                 'glukozynolany, ale gazotwórcze'),
  (18, 'mieso_przetworzone', 'Mięso przetworzone',               'nic, pozycja onkologiczna'),
  (19, 'oleje_rafinowane',   'Oleje rafinowane i tłuszcze utwardzone', 'nic'),
  (20, 'salaty_surowe',      'Sałaty i warzywa surowe',          'błonnik nierozpuszczalny')
ON CONFLICT(id) DO UPDATE SET
  code = excluded.code, name = excluded.name, provides = excluded.provides;

-- ---------------------------------------------------------------------------
-- REGUŁY POKRYCIA, czyli "czego w diecie brakuje"
-- Źródło: Dieta_obecna_ranking.md, sekcja "Czego w tej diecie brakuje", 7 pozycji
-- ---------------------------------------------------------------------------

INSERT INTO coverage_rules (id, group_id, min_days_per_week, min_portions_per_day, severity, rationale, active_from, active_to) VALUES
  (1, 1,  5, NULL, 'critical',
      'Homocysteina 19,20 przy MTHFR compound het. Foliany z jedzenia to podstawowa droga, TMG jest tylko szlakiem pomocniczym. Zielonych liści nie było w żadnym z 6 zamówień.', '2026-08-03', NULL),
  (2, 6,  7,    2, 'critical',
      'Jedyny produkt spożywczy z powtórzonymi badaniami klinicznymi na zaparcie, niskofermentujący. Po rezygnacji z prokinetyku 09.08 to jedno z dwóch narzędzi na motorykę.', '2026-08-03', NULL),
  (3, 2,  4, NULL, 'important',
      'Burak, dynia i batat wiążą wodę i zmiękczają stolec przy wolnym pasażu. Mają zastąpić kalafior i brukselkę.', '2026-08-03', NULL),
  (4, 3,  2, NULL, 'important',
      'Brak źródła cynku i żelaza hemowego. Cynk ma znaczenie przy deficycie testosteronu i treningu siłowym.', '2026-08-03', NULL),
  (5, 4,  2, NULL, 'important',
      'Omega-3 z jedzenia, nie tylko z Osavi.', '2026-08-03', NULL),
  (6, 7,  5, NULL, 'important',
      'Jedyny tłuszcz roślinny dodawany na zimno, który ma tu sens. Zero sztuk w sześciu zamówieniach.', '2026-08-03', NULL),
  (7, 10, 3, NULL, 'nice',
      'Brak źródła skrobi poza ryżem i kaszami. Ziemniak gotowany jest niskofermentujący i daje potas.', '2026-08-03', NULL)
ON CONFLICT(id) DO UPDATE SET
  group_id = excluded.group_id, min_days_per_week = excluded.min_days_per_week,
  min_portions_per_day = excluded.min_portions_per_day, severity = excluded.severity,
  rationale = excluded.rationale, active_from = excluded.active_from, active_to = excluded.active_to;

-- ---------------------------------------------------------------------------
-- SUPLEMENTY I LEKI
-- Stan potwierdzony przez pacjenta 03.08 po resecie z maja.
-- ---------------------------------------------------------------------------

INSERT INTO supplements (id, name, brand, kind, dose, purpose, status, rx, notes, source) VALUES
  (1,  'Xifaxan 400 mg',      'Alfasigma',   'lek',       '2 tabletki', 'eradykacja przerostu metanogenów', 'active',       1, 'Kurs 14 dni, ostatnia dawka 17.08 rano', 'Sidor-Bagińska 2026-08-03'),
  (2,  'Neomycinum 250 mg',   'TZF',         'lek',       '2 tabletki', 'eradykacja przerostu metanogenów', 'active',       1, 'Odstawić przy szumie w uszach, pogorszeniu słuchu albo zawrotach głowy', 'Sidor-Bagińska 2026-08-03'),
  (3,  'FIBEgastrin',         NULL,          'blonnik',   '1 saszetka, 5 g PHGG', 'zagęszczenie stolca, odbudowa flory', 'active', 0, 'Częściowo hydrolizowana guma guar. Badanie Furnari 2010.', 'Sidor-Bagińska 2026-08-03 plus decyzja pacjenta 05.08'),
  (4,  'TMG 1000 mg',         'NOW Foods',   'suplement', '1 tabletka', 'homocysteina, szlak BHMT', 'active',              0, 'Zastąpił B12 i cały B-complex. Zapauzowane przez pacjenta na czas kursu antybiotyku 03 do 17.08.2026, żeby nie mieszać zmiennych w trakcie leczenia. Wraca 18.08 i zostaje na stałe: odstawienie B-complexu w maju podniosło homocysteinę z 13,70 na 19,20, a TMG nie było tego przyczyną.', 'Piotrowski 2026-05-21'),
  (5,  'Karczoch 600 mg',     'Medica Herbs','suplement', '1 kapsułka', 'trawienie tłuszczu, wzdęcia', 'paused',           0, 'Nie wraca 18.08, decyzja pacjenta z 10.08.2026. Kupiony 21.05 pod trawienie tłuszczu przy elastazie 151 i pod wzdęcia: pierwszy cel gastrolog odrzuciła 15.05 jako klinicznie nieistotny, drugi wyjaśnił test oddechowy z 02.08, czyli metan leczony antybiotykiem. ALT 23, AST 31, GGT 11, ALP 68, bilirubina 0,90, a w kale z 28.04 kulki tłuszczu „pojedyncze" i włókna mięsne nieobecne. Wyciąg z liścia karczocha ma dane w dyspepsji czynnościowej i w IBS, więc jest bez podstaw teraz, a nie bez podstaw w ogóle: jedyna droga powrotu to pojedynczy testowany element na 2 tygodnie z dziennikiem, najwcześniej od 15.09 i tylko jeśli wróci wzdęcie albo pływający, tłustawy stolec.', 'Piotrowski 2026-05-21'),
  (6,  'Essentiale Max',      'Sanofi',      'suplement', '1 kapsułka', 'fosfatydylocholina, emulsja tłuszczu', 'discontinued', 0, 'Odstawiony na stałe decyzją pacjenta z 10.08.2026, bez drogi powrotu: cel pokrywał się z karczochem, a dane w tym wskazaniu są najsłabsze z trójki karczoch, Essentiale, TUDCA, z której TUDCA już wypadła. Kupiony 21.05 pod trawienie tłuszczu przy elastazie 151 i pod wzdęcia: pierwszy cel gastrolog odrzuciła 15.05 jako klinicznie nieistotny, drugi wyjaśnił test oddechowy z 02.08, czyli metan leczony antybiotykiem. ALT 23, AST 31, GGT 11, ALP 68, bilirubina 0,90, a w kale z 28.04 kulki tłuszczu „pojedyncze" i włókna mięsne nieobecne.', 'Piotrowski 2026-05-21'),
  (7,  'Super Omega 2900 mg', 'Osavi',       'suplement', '2 łyżeczki', 'omega-3 EPA i DHA', 'active',                     0, 'Postać płynna, cytrynowa', 'Piotrowski 2026-05-21'),
  (8,  'Witamina D3 + K2',    'Nutri-Well',  'suplement', '1 tabletka', 'witamina D 5000 IU', 'active',                    0, 'Dawki nie obniżamy, pacjent unika słońca', 'protokół własny'),
  (9,  'Kreatyna',            NULL,          'suplement', '2 x 5 g',    'siła, masa mięśniowa', 'active',                  0, 'Pierwsza porcja na czczo, druga do obiadu. Hamuje syntezę endogenną, czyli działa w kierunku obniżenia homocysteiny. Dawki nie obniżamy, tylko dzielimy: przy 10 g naraz biegunka u 55,6%, przy 2 x 5 g u 28,6% (Ostojic i Ahmetovic 2008, Res Sports Med).', 'protokół własny'),
  (10, 'Codeage Methylfolate B Complex+', 'Codeage', 'suplement', '1 kapsułka', 'metylofolian, B12, B6', 'active',         0, 'Wznowiony 03.08 po skoku homocysteiny z 13,70 na 19,20. Pół dawki, bo powodem odstawienia była wysoka B12.', 'Analiza panelu 2026-08-03'),
  (11, 'Clomid 25 mg',        NULL,          'lek',       '1 tabletka', 'oś podwzgórze, przysadka, jądra', 'active',       1, 'Poniedziałek do soboty, niedziela wolna. Przesunięty na 22:30 na czas antybiotyku.', 'protokół własny'),
  (12, 'Sanprobi IBS',        'Sanprobi',    'probiotyk', '1 kapsułka', 'odbudowa flory po antybiotyku', 'planned',        0, 'Start 18.08, cztery tygodnie. Nie zaczynać w trakcie antybiotyku, neomycyna go zabije. Opakowanie to 20 kapsułek, czyli dokupić do 05.09.', 'Sidor-Bagińska 2026-08-03'),
  (13, 'Forlax 10 g',         'Ipsen',       'lek',       '1 saszetka', 'makrogol, zmiękczenie stolca', 'paused',          0, 'Wyłącznie ratunkowo: dwa dni bez wypróżnienia albo wyraźnie twardszy stolec przez dwa dni z rzędu', 'Sidor-Bagińska 2026-08-03, korekta 03.08'),
  (14, 'Prukalopryd (Resolor)', NULL,        'lek',       '2 mg',       'prokinetyk, pasaż jelita', 'discontinued',        1, 'Decyzja pacjenta z 09.08: recepty nie będzie. Temat wraca przy ocenie dziennika 15.10.2026, jeśli objawy się nie ruszą.', 'Decyzja pacjenta 2026-08-09'),
  (15, 'Predox (itopryd)',    NULL,          'lek',       '50 mg',      'prokinetyk żołądkowy', 'discontinued',            1, 'Nie brać, odrzucony decyzją pacjenta z 09.08.2026, a to, że leży kupiony, nie jest argumentem. Dwa powody: zły odcinek przewodu pokarmowego, bo działa na opróżnianie żołądka, a nie na pasaż jelita grubego, oraz podnoszenie prolaktyny, która 03.08 wyszła 601 mIU/l.', 'Analiza 2026-08-03'),
  (16, 'Tlenek magnezu',      NULL,          'suplement', '500 mg 3x dziennie', 'motoryka jelit, sen', 'paused',           0, 'Włączyć tylko wtedy, gdy w oknie 25 do 31.08.2026, przy PHGG 10 g dziennie, stolec nadal będzie w przewadze Bristol 1 do 2, wtedy start 01.09. Kontrola nerek niepotrzebna, kreatynina 1,05 mg/dl i eGFR powyżej 90 w 04.2026, ostrożność dotyczy niewydolności nerek i wieku podeszłego.', 'Mori 2019, J Neurogastroenterol Motil'),
  (17, 'Babka jajowata',      'Zielarnia',   'blonnik',   '1 łyżeczka, ok. 5 g', 'błonnik żelujący', 'planned',            0, 'Zalecona 25.03.2026, nigdy nie kupiona. Przy FIBEgastrinie 10 g dziennie na razie zbędna.', 'Piotrowski 2026-03-25')
-- status CELOWO poza lista aktualizowanych kolumn. Wstrzymanie i wznowienie
-- preparatu robi sie w aplikacji (POST /suplementy/status), wiec status w bazie
-- jest zawsze nowszy niz w tym pliku. Gdy tu byl, kazde db:seed po cichu
-- cofalo decyzje kliniczna: pauza TMG, karczocha i Essentiale na czas
-- antybiotyku wrocilaby do 'active'. restrictions w seed-foods.sql maja
-- to samo wylaczenie od poczatku. Wartosci status ponizej dzialaja tylko
-- przy pierwszym wstawieniu, czyli na pustej bazie.
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, brand = excluded.brand, kind = excluded.kind, dose = excluded.dose,
  purpose = excluded.purpose, rx = excluded.rx,
  notes = excluded.notes, source = excluded.source;

-- ---------------------------------------------------------------------------
-- ROZKŁAD DNIA
-- Źródło: Konsultacje/2026-08-03_Sidor-Baginska_gastrolog.md, tabela "Rozkład dnia"
-- Okna jedzenia: 09:00, 14:00, 18:30, czyli trzy podejścia zamiast pięciu posiłków
-- ---------------------------------------------------------------------------

INSERT INTO supplement_schedule (id, supplement_id, time_of_day, with_meal, days, amount, date_from, date_to, notes) VALUES
  (1,  9,  '07:00', 'na_czczo',  'daily', '5 g',         '2026-08-03', NULL,         NULL),
  (2,  1,  '08:00', NULL,        'daily', '2 tabletki',  '2026-08-03', '2026-08-17', 'Odstęp 30 minut do neomycyny'),
  (3,  2,  '08:30', NULL,        'daily', '2 tabletki',  '2026-08-03', '2026-08-17', 'Posiłek 15 do 30 minut później'),
  (4,  3,  '09:00', 'sniadanie', 'daily', '1 saszetka',  '2026-08-05', '2026-08-17', 'W 200 do 250 ml wody, popić drugą szklanką'),
  (5,  10, '09:00', 'sniadanie', 'daily', '1 kapsułka',  '2026-08-03', NULL,         NULL),
  (6,  8,  '09:00', 'sniadanie', 'daily', '1 tabletka',  '2026-08-03', NULL,         'Z tłuszczem'),
  (7,  7,  '09:00', 'sniadanie', 'daily', '2 łyżeczki',  '2026-08-03', NULL,         NULL),
  -- Karczoch wstrzymany, Essentiale odstawiony, ale okna zostaja bezterminowe,
  -- bo oba stany siedza w supplements.status i status sam gatuje liste dnia.
  -- Okno trzyma pory i dawki gotowe, gdyby karczoch wrocil jako test od 15.09.
  (8,  5,  '09:00', 'sniadanie', 'daily', '1 kapsułka',  '2026-08-03', NULL,         NULL),
  (9,  6,  '09:00', 'sniadanie', 'daily', '1 kapsułka',  '2026-08-03', NULL,         NULL),
  (10, 5,  '14:00', 'obiad',     'daily', '1 kapsułka',  '2026-08-03', NULL,         'Tylko jeśli posiłek tłusty'),
  (11, 4,  '18:30', 'kolacja',   'daily', '1 tabletka',  '2026-08-18', NULL,         'TMG wraca po kursie antybiotyku. Do 17.08 zapauzowane przez pacjenta.'),
  (12, 1,  '20:00', NULL,        'daily', '2 tabletki',  '2026-08-03', '2026-08-16', 'Ostatnia dawka kursu wypadła 17.08 rano, wieczorem 17.08 już nic'),
  (13, 2,  '20:30', NULL,        'daily', '2 tabletki',  '2026-08-03', '2026-08-16', 'Ostatnia dawka kursu wypadła 17.08 rano, wieczorem 17.08 już nic'),
  (14, 11, '22:30', NULL,        'pon,wt,sr,czw,pt,sob', '1 tabletka', '2026-08-03', NULL, 'Niedziela wolna. Odstęp 2 h od neomycyny.'),
  (15, 3,  '09:00', 'sniadanie', 'daily', '1 saszetka',  '2026-08-18', '2026-09-14', 'Faza 2: dwie saszetki dziennie, rano i wieczorem'),
  (16, 3,  '18:30', 'kolacja',   'daily', '1 saszetka',  '2026-08-18', '2026-09-14', 'Faza 2: druga saszetka. Przy nasileniu gazów zostać przy jednej.'),
  (17, 12, '09:00', 'sniadanie', 'daily', '1 kapsułka',  '2026-08-18', '2026-09-14', 'Cztery tygodnie'),
  (18, 3,  '09:00', 'sniadanie', 'daily', '1 saszetka',  '2026-09-15', NULL,         'Przewlekle, zalecenie lekarki'),
  (19, 9,  '14:00', 'obiad',     'daily', '5 g',         '2026-08-10', NULL,         'Druga porcja tej samej dawki, doczepiona do drugiego podejścia do jedzenia, nie jako osobne zdarzenie.')
ON CONFLICT(id) DO UPDATE SET
  supplement_id = excluded.supplement_id, time_of_day = excluded.time_of_day,
  with_meal = excluded.with_meal, days = excluded.days, amount = excluded.amount,
  date_from = excluded.date_from, date_to = excluded.date_to, notes = excluded.notes;

-- Makra jednej dawki. Osobnym blokiem, a nie w liscie kolumn wyzej, bo zero
-- przy tabletce i NULL przy dawce niesprawdzonej to dwie rozne rzeczy, a przy
-- dwudziestu wierszach kolumna zer czytalaby sie jak literowka.
-- Widok v_day_supplement_macros trzyma te liczby OSOBNO od v_day_totals,
-- bo pasma fazy sa ustawione na jedzenie. Patrz migracja 044.
UPDATE supplement_schedule SET kcal = 0, protein_g = 0, fat_g = 0, carbs_g = 0, fiber_g = 0;
UPDATE supplement_schedule SET kcal = 83, fat_g = 9.2 WHERE id = 7;          -- omega, 2 lyzeczki oleju
UPDATE supplement_schedule SET kcal = 10, fiber_g = 5 WHERE id IN (4, 15, 16, 18);  -- FIBEgastrin, 5 g PHGG

UPDATE supplements SET macros_note = 'SZACUNEK: 2 lyzeczki to ok. 10 ml, olej rybi 0,92 g/ml, czyli 9,2 g tluszczu i 83 kcal. Do zastapienia etykieta Osavi' WHERE id = 7;
UPDATE supplements SET macros_note = 'Saszetka to 5 g PHGG: blonnik 5 g, 10 kcal przy 2 kcal na gram blonnika rozpuszczalnego' WHERE id = 3;
UPDATE supplements SET macros_note = 'Monohydrat nie jest zrodlem energii, etykieta podaje 0 kcal' WHERE id = 9;
