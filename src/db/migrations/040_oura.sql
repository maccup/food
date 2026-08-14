-- Dane z pierscienia Oura, noszonego 02.2020 do 22.02.2026.
--
-- Oura pisala do Apple Health tylko siedem typow (tetno, kroki, kalorie, sen,
-- oddech, medytacja, waga), wiec eksport XML nie zawiera ani HRV, ani
-- odchylenia temperatury, ani zadnego z wynikow dobowych. Te dane siedza
-- wylacznie w archiwum CSV z panelu Oura i stad ta migracja.
--
-- ZASADA: metryka niezgodna definicyjnie dostaje WLASNA kolumne, nie doklada
-- sie do istniejacej. Wrzucenie jednego do drugiego dawaloby wykres, na ktorym
-- zmiana urzadzenia wyglada jak zmiana w organizmie. Dwa przypadki:
--
--   HRV: Oura raportuje rMSSD, Apple Watch SDNN. To dwa rozne wskazniki
--   zmiennosci, oba w milisekundach i o innych wartosciach typowych, wiec
--   `hrv` (SDNN) zostaje puste w latach z pierscieniem, a rMSSD ma `hrv_rmssd`.
--
--   Temperatura: Oura podaje ODCHYLENIE od wlasnej linii bazowej w stopniach,
--   Apple bezwzgledna temperature nadgarstka. Minus 0,13 z Oura i 35,2 z
--   zegarka nie moga stac w jednej kolumnie.

ALTER TABLE watch ADD COLUMN hrv_rmssd              REAL;  -- ms, srednia nocna z Oura
ALTER TABLE watch ADD COLUMN tetno_min              REAL;  -- najnizsze tetno nocne
ALTER TABLE watch ADD COLUMN tetno_sen              REAL;  -- srednie tetno podczas snu
ALTER TABLE watch ADD COLUMN temperatura_odchylenie REAL;  -- stopnie wzgledem linii bazowej
ALTER TABLE watch ADD COLUMN spo2_noc               REAL;  -- %, srednia z nocy
ALTER TABLE watch ADD COLUMN zaburzenia_oddechu     REAL;  -- indeks BDI z Oura
ALTER TABLE watch ADD COLUMN sen_efektywnosc        REAL;  -- %, sen do czasu w lozku
ALTER TABLE watch ADD COLUMN sen_latencja_min       REAL;  -- minuty od polozenia sie do zasniecia
ALTER TABLE watch ADD COLUMN oura_sen_wynik         REAL;  -- 0 do 100
ALTER TABLE watch ADD COLUMN oura_gotowosc_wynik    REAL;  -- 0 do 100
ALTER TABLE watch ADD COLUMN oura_aktywnosc_wynik   REAL;  -- 0 do 100
ALTER TABLE watch ADD COLUMN stres_min              REAL;  -- minuty doby oznaczone jako stres
ALTER TABLE watch ADD COLUMN regeneracja_min        REAL;  -- minuty doby oznaczone jako regeneracja
ALTER TABLE watch ADD COLUMN odpornosc              TEXT;  -- poziom resilience, slowo z Oura
ALTER TABLE watch ADD COLUMN wiek_naczyniowy        REAL;  -- lata, cardiovascular age
