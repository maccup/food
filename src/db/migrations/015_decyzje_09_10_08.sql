-- 2026-08-10
-- Dociagniecie protokolu w bazie do decyzji z 09 i 10.08.2026.
--
-- 1. Zadnych badan kontrolnych w najblizszych miesiacach: ani testu oddechowego,
--    ani manometrii, ani krwi. Wszedzie, gdzie warunkiem byl "test kontrolny
--    14 do 18.09", wchodzi ocena dziennika 15.10.2026.
-- 2. Kreatyna: ta sama dawka, dwie porcje. Ostojic i Ahmetovic 2008 (Res Sports
--    Med): biegunka u 55,6% przy 10 g naraz i u 28,6% przy 2 x 5 g. Dawki nie
--    obnizamy, bo metaanaliza Xu 2024 (Front Nutr) objela 2,2 do 20 g na dobe
--    i nie wykazala, zeby dawka modyfikowala efekt poznawczy, a to jest tu cel.
-- 3. Magnez: randomizowane dane dotycza TLENKU magnezu 0,5 g trzy razy dziennie
--    (Mori 2019, J Neurogastroenterol Motil: poprawa u 70,6% wobec 25% na
--    placebo, skala Bristolska p < 0,001, pasaz krotszy o 19,1 h). Dla cytrynianu
--    400 mg takiego badania nie ma, wiec preparat i dawka sie zmieniaja.
-- 4. TMG, karczoch i Essentiale: pacjent sam zapauzowal je na czas antybiotyku
--    03 do 17.08, w interfejsie aplikacji. Pauza istniala tylko jako stan bazy,
--    teraz jest zapisana w danych.
-- 5. Restrykcje low FODMAP konczyly sie 15.09, czyli w pierwszym dniu fazy
--    rozszerzania. restrictions.ts uznaje regule za wygasla dopiero przy
--    date_to < today, wiec 15.09 obowiazywala jeszcze pelna lista.
-- 6. Blonnik w fazie rozszerzania: 20 do 30 g, tyle samo co w low FODMAP.
-- 7. Po rezygnacji z prokinetyku narzedzi na motoryke sa dwa, nie trzy.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- 1. BADANIA KONTROLNE WYKRESLONE
-- ---------------------------------------------------------------------------

UPDATE phases SET
  notes = 'Pojedyncze wprowadzanie produktów z obserwacją 48 h.'
WHERE id = 3;

UPDATE supplements SET
  notes = 'Decyzja pacjenta z 09.08: recepty nie będzie. Temat wraca przy ocenie dziennika 15.10.2026, jeśli objawy się nie ruszą.'
WHERE id = 14;

UPDATE supplements SET
  notes = 'Nie brać, odrzucony decyzją pacjenta z 09.08.2026, a to, że leży kupiony, nie jest argumentem. Dwa powody: zły odcinek przewodu pokarmowego, bo działa na opróżnianie żołądka, a nie na pasaż jelita grubego, oraz podnoszenie prolaktyny, która 03.08 wyszła 601 mIU/l.'
WHERE id = 15;

-- ---------------------------------------------------------------------------
-- 2. KREATYNA: TA SAMA DAWKA, DWIE PORCJE
-- ---------------------------------------------------------------------------

UPDATE supplements SET
  dose = '2 x 5 g',
  notes = 'Pierwsza porcja na czczo, druga do obiadu. Hamuje syntezę endogenną, czyli działa w kierunku obniżenia homocysteiny. Dawki nie obniżamy, tylko dzielimy: przy 10 g naraz biegunka u 55,6%, przy 2 x 5 g u 28,6% (Ostojic i Ahmetovic 2008, Res Sports Med).'
WHERE id = 9;

UPDATE supplement_schedule SET amount = '5 g' WHERE id = 1;

INSERT INTO supplement_schedule (id, supplement_id, time_of_day, with_meal, days, amount, date_from, date_to, notes) VALUES
  (19, 9, '14:00', 'obiad', 'daily', '5 g', '2026-08-10', NULL,
      'Druga porcja tej samej dawki, doczepiona do drugiego podejścia do jedzenia, nie jako osobne zdarzenie.')
ON CONFLICT(id) DO UPDATE SET
  supplement_id = excluded.supplement_id, time_of_day = excluded.time_of_day,
  with_meal = excluded.with_meal, days = excluded.days, amount = excluded.amount,
  date_from = excluded.date_from, date_to = excluded.date_to, notes = excluded.notes;

-- ---------------------------------------------------------------------------
-- 3. MAGNEZ: TLENEK, NIE CYTRYNIAN, I DAWKA Z BADANIA
-- ---------------------------------------------------------------------------

UPDATE supplements SET
  name = 'Tlenek magnezu',
  brand = NULL,
  dose = '500 mg 3x dziennie',
  source = 'Mori 2019, J Neurogastroenterol Motil',
  notes = 'Włączyć tylko wtedy, gdy w oknie 25 do 31.08.2026, przy PHGG 10 g dziennie, stolec nadal będzie w przewadze Bristol 1 do 2, wtedy start 01.09. Kontrola nerek niepotrzebna, kreatynina 1,05 mg/dl i eGFR powyżej 90 w 04.2026, ostrożność dotyczy niewydolności nerek i wieku podeszłego.'
WHERE id = 16;

-- ---------------------------------------------------------------------------
-- 4. TMG, KARCZOCH I ESSENTIALE: PAUZA NA CZAS ANTYBIOTYKU
--
-- TMG wraca 18.08 i zostaje w protokole, wiec status = 'active', a niebranie go
-- do 17.08 zapisuje okno harmonogramu. Status ma mowic o tym, czy preparat jest
-- w protokole, a nie o tym, kiedy sie go bierze. Zapytania w day.ts i
-- supplements.ts respektuja date_from i date_to, wiec okno wystarcza.
--
-- Karczoch i Essentiale zostaja 'paused', bo decyzja o powrocie 18.08 nalezy do
-- Macieja. Ich okna zostaja bezterminowe, zeby 18.08 wystarczylo przelaczenie
-- statusu na "biore" i nic wiecej.
-- ---------------------------------------------------------------------------

UPDATE supplements SET
  status = 'active',
  notes = 'Zastąpił B12 i cały B-complex. Zapauzowane przez pacjenta na czas kursu antybiotyku 03 do 17.08.2026, żeby nie mieszać zmiennych w trakcie leczenia. Wraca 18.08 i zostaje na stałe: odstawienie B-complexu w maju podniosło homocysteinę z 13,70 na 19,20, a TMG nie było tego przyczyną.'
WHERE id = 4;

UPDATE supplement_schedule SET
  date_from = '2026-08-18',
  notes = 'TMG wraca po kursie antybiotyku. Do 17.08 zapauzowane przez pacjenta.'
WHERE id = 11;

UPDATE supplements SET
  notes = 'Druga dawka do obiadu, jeśli posiłek tłusty. Zapauzowane przez pacjenta na czas kursu antybiotyku 03 do 17.08.2026, żeby nie mieszać zmiennych w trakcie leczenia. Decyzja o powrocie przypada na 18.08 i należy do Macieja: brak wskazania przy ALT 23, GGT 11, ALP 68 i bilirubinie 0,90, a przyczyną gazów okazał się 02.08 przerost metanogenów, który leczy antybiotyk.'
WHERE id = 5;

UPDATE supplements SET
  notes = 'Synergia z karczochem. Zapauzowane przez pacjenta na czas kursu antybiotyku 03 do 17.08.2026, żeby nie mieszać zmiennych w trakcie leczenia. Decyzja o powrocie przypada na 18.08 i należy do Macieja: brak wskazania przy ALT 23, GGT 11, ALP 68 i bilirubinie 0,90, a przyczyną gazów okazał się 02.08 przerost metanogenów, który leczy antybiotyk.'
WHERE id = 6;

-- Okna karczocha i Essentiale (id 8, 9, 10) zostaja bezterminowe. Pauza to
-- odpowiedz na pytanie "czy to jest w protokole", wiec mieszka w status i tylko
-- tam. Gdyby okna byly domkniete 17.08, przelaczenie statusu na 'active' 18.08
-- nic by nie pokazalo i trzeba by grzebac w Ustawieniach. Bezterminowy wiersz
-- przy statusie 'paused' nie jest wiszacy, bo status go gatuje.
UPDATE supplement_schedule SET date_to = NULL, notes = NULL WHERE id IN (8, 9);

UPDATE supplement_schedule SET date_to = NULL, notes = 'Tylko jeśli posiłek tłusty' WHERE id = 10;

-- ---------------------------------------------------------------------------
-- 5. RESTRYKCJE: KONIEC 14.09, NIE 15.09
-- Bezterminowych (date_to IS NULL) nie ruszamy.
-- ---------------------------------------------------------------------------

UPDATE restrictions SET date_to = '2026-09-14' WHERE date_to = '2026-09-15';

-- ---------------------------------------------------------------------------
-- 6. BLONNIK W FAZIE ROZSZERZANIA
-- ---------------------------------------------------------------------------

UPDATE targets SET
  min_value = 20,
  max_value = 30,
  source = 'v_day_totals liczy błonnik z jedzenia, a PHGG dokłada 5 g z góry. Własna obserwacja: więcej błonnika to więcej twardych grudek. Bez prokinetyku górnej granicy nie podnosimy automatycznie od 15.09, najwcześniej po ocenie dziennika 15.10.'
WHERE id = 15;

-- ---------------------------------------------------------------------------
-- 7. NARZEDZIA NA MOTORYKE: DWA, NIE TRZY
-- ---------------------------------------------------------------------------

UPDATE coverage_rules SET
  rationale = 'Jedyny produkt spożywczy z powtórzonymi badaniami klinicznymi na zaparcie, niskofermentujący. Po rezygnacji z prokinetyku 09.08 to jedno z dwóch narzędzi na motorykę.'
WHERE id = 2;
