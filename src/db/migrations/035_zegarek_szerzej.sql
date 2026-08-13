-- 035: kolumny pod aplikacje iOS, w tym medytacja
--
-- Do tej pory `watch` zapelnial sie wylacznie recznym eksportem XML ze Zdrowia,
-- wiec zakres kolumn byl ograniczony do tego, co warto bylo parsowac z 6,5 mln
-- rekordow. Aplikacja czyta HealthKit bezposrednio i koszt dolozenia metryki
-- jest zerowy, wiec wchodzi szerszy zestaw.
--
-- MEDYTACJA to powod, dla ktorego ta migracja powstala teraz: Maciek zaczyna
-- praktyke 13.08.2026 i chce widziec, czy odklada sie ona na HRV i tetnie
-- spoczynkowym. Zeby to kiedykolwiek dalo sie sprawdzic, dni bez medytacji
-- musza byc zapisane jako ZERO, a nie jako NULL. NULL znaczy „nie wiem",
-- a wtedy porownanie „dni z praktyka kontra bez" nie ma grupy kontrolnej.
-- Aplikacja wysyla 0 dla kazdej doby, ktora obejrzala.
--
-- `swiatlo_min` nie jest ozdoba. Maciek unika slonca i bierze D3 5000 IU
-- bezterminowo, wiec czas w swietle dziennym jest jedyna metryka, ktora te
-- decyzje w ogole opisuje liczba. Przy okazji to najsilniejszy zewnetrzny
-- regulator rytmu dobowego, czyli tego samego, co sen i MMC.
--
-- `zrodlo` mowi, co zapisalo wiersz: 'export' albo 'ios'. Bez tego przy
-- pierwszej rozbieznosci miedzy eksportem a aplikacja nie da sie ustalic,
-- ktora liczba jest z ktorego kanalu, a rozbieznosci beda, bo HealthKit
-- i XML nie zawsze widza to samo.

ALTER TABLE watch ADD COLUMN medytacja_min      INTEGER;  -- suma sesji Uwaznosci, minuty
ALTER TABLE watch ADD COLUMN medytacja_sesji    INTEGER;  -- ile osobnych sesji tego dnia
ALTER TABLE watch ADD COLUMN treningi           INTEGER;  -- liczba treningow (HKWorkout)
ALTER TABLE watch ADD COLUMN trening_min        INTEGER;
ALTER TABLE watch ADD COLUMN trening_kcal       INTEGER;
ALTER TABLE watch ADD COLUMN dystans_km         REAL;     -- marsz i bieg lacznie
ALTER TABLE watch ADD COLUMN pietra             INTEGER;  -- pietra wejscia
ALTER TABLE watch ADD COLUMN stanie_h           INTEGER;  -- godziny ze wstaniem
ALTER TABLE watch ADD COLUMN swiatlo_min        INTEGER;  -- czas w swietle dziennym
ALTER TABLE watch ADD COLUMN sen_lozko_min      INTEGER;  -- czas w lozku, do liczenia efektywnosci snu
ALTER TABLE watch ADD COLUMN tetno_srednie      INTEGER;
ALTER TABLE watch ADD COLUMN tetno_max          INTEGER;
ALTER TABLE watch ADD COLUMN tkanka_tluszczowa  REAL;     -- ulamek, 0,115 to 11,5 procent
ALTER TABLE watch ADD COLUMN masa_beztluszczowa REAL;     -- kg
ALTER TABLE watch ADD COLUMN cisnienie_sys      INTEGER;
ALTER TABLE watch ADD COLUMN cisnienie_dia      INTEGER;
ALTER TABLE watch ADD COLUMN cardio_recovery    REAL;     -- spadek tetna w minute po wysilku
ALTER TABLE watch ADD COLUMN zrodlo             TEXT;     -- 'export' albo 'ios'

UPDATE watch SET zrodlo = 'export' WHERE zrodlo IS NULL;
