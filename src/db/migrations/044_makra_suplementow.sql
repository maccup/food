-- 044: makra suplementow, liczone osobno od jedzenia
--
-- Do 14.08.2026 kcal i makra istnialy wylacznie w tabeli meals, a suplementy
-- nie mialy gdzie ich trzymac. Przy plynnej omedze (ok. 9 g tluszczu) i PHGG
-- (5 g blonnika na saszetke) oznaczalo to, ze dwie najwazniejsze liczby dnia,
-- czyli te same dwie, ktore koloruja kratke w kalendarzu, mialy codzienny
-- niewidoczny dodatek.
--
-- DWIE SUMY, NIE JEDNA. Makra suplementow NIE wchodza do v_day_totals ani do
-- koloru dnia i nie wolno ich tam wpuscic. Pasma fazy sa ustawione na jedzenie:
-- cel blonnika 20 do 30 g ma w zrodle wprost napisane, ze PHGG dokłada swoje
-- 5 g z gory. Doklejenie suplementow do sumy jedzenia przesuneloby kazdy dzien
-- wzgledem celu, ktory tego dodatku juz nie oczekuje.
--
-- Makra siedza na supplement_schedule, nie na supplements, bo jeden wiersz
-- harmonogramu odpowiada dokladnie jednej dawce w supplement_log (przez
-- schedule_id). Kreatyna ma dwa wiersze po 5 g, FIBEgastrin w fazie 2 dwie
-- saszetki o roznych porach: przy makrach na produkcie trzeba by je mnozyc
-- przez cos, czego w bazie nie ma.
--
-- Licza sie wylacznie dawki faktycznie odhaczone (taken = 1), tak samo jak
-- w jedzeniu licza sie posilki ze stanem "zjedzony".

ALTER TABLE supplement_schedule ADD COLUMN kcal      REAL;
ALTER TABLE supplement_schedule ADD COLUMN protein_g REAL;
ALTER TABLE supplement_schedule ADD COLUMN fat_g     REAL;
ALTER TABLE supplement_schedule ADD COLUMN carbs_g   REAL;
ALTER TABLE supplement_schedule ADD COLUMN fiber_g   REAL;
ALTER TABLE supplements ADD COLUMN macros_note TEXT;

-- NULL w kcal znaczy "nie sprawdzone", zero znaczy "sprawdzone i nieistotne".
-- Bez tego rozroznienia widok pokazywalby zero tak samo pewnie w obu wypadkach.
UPDATE supplement_schedule SET kcal = 0, protein_g = 0, fat_g = 0, carbs_g = 0, fiber_g = 0;

-- Osavi Super Omega, 2 lyzeczki, czyli ok. 10 ml oleju rybiego.
-- SZACUNEK z gestosci oleju 0,92 g/ml i 9 kcal na gram tluszczu, do zamiany
-- na etykiete producenta.
UPDATE supplement_schedule SET kcal = 83, fat_g = 9.2 WHERE id = 7;
UPDATE supplements SET macros_note = 'SZACUNEK: 2 lyzeczki to ok. 10 ml, olej rybi 0,92 g/ml, czyli 9,2 g tluszczu i 83 kcal. Do zastapienia etykieta Osavi' WHERE id = 7;

-- FIBEgastrin, 1 saszetka, 5 g PHGG. Blonnik rozpuszczalny liczy sie
-- w UE po 2 kcal na gram, weglowodanow przyswajalnych saszetka nie wnosi.
UPDATE supplement_schedule SET kcal = 10, fiber_g = 5 WHERE id IN (4, 15, 16, 18);
UPDATE supplements SET macros_note = 'Saszetka to 5 g PHGG: blonnik 5 g, 10 kcal przy 2 kcal na gram blonnika rozpuszczalnego' WHERE id = 3;

-- Kreatyna nie idzie na energie, etykiety podaja 0 kcal. Zostaje zero jawnie.
UPDATE supplements SET macros_note = 'Monohydrat nie jest zrodlem energii, etykieta podaje 0 kcal' WHERE id = 9;

DROP VIEW IF EXISTS v_day_supplement_macros;
CREATE VIEW v_day_supplement_macros AS
SELECT
  l.date,
  ROUND(SUM(COALESCE(sc.kcal, 0)), 1)      AS kcal,
  ROUND(SUM(COALESCE(sc.protein_g, 0)), 1) AS protein_g,
  ROUND(SUM(COALESCE(sc.fat_g, 0)), 1)     AS fat_g,
  ROUND(SUM(COALESCE(sc.carbs_g, 0)), 1)   AS carbs_g,
  ROUND(SUM(COALESCE(sc.fiber_g, 0)), 1)   AS fiber_g,
  COUNT(*)                                  AS doses,
  SUM(CASE WHEN sc.kcal IS NULL THEN 1 ELSE 0 END) AS doses_without_macros
FROM supplement_log l
LEFT JOIN supplement_schedule sc ON sc.id = l.schedule_id
WHERE l.taken = 1
GROUP BY l.date;
