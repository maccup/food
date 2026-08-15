-- 045: dodatek to nie porcja
--
-- Reguly pokrycia licza DNI, w ktorych grupa sie pojawila, i do 15.08.2026
-- liczyly kazde wystapienie tak samo. Skutek: natka pietruszki posypana na
-- krem pomidorowy zaliczala dzien "zielonych warzyw lisciastych" identycznie
-- jak miska szpinaku. Tydzien 10 do 16.08 wygladal na 4 z 5 dni, choc szpinak
-- byl w dwoch dniach, a pozostale dwa to byla posypka z pudelka.
--
-- Rozroznienie siedzi na produkcie, nie na posilku, bo to cecha skladnika
-- w tym cateringu: natka jest tam zawsze posypka. Gdyby kiedys pojawil sie
-- produkt raz jako porcja, raz jako dodatek, wtedy dopiero warto to przeniesc
-- na `meal_foods`. Nie robic tego z gory.
--
-- Wartosci sa dwie i maja nazwy, nie flage: 'porcja' liczy sie do pokrycia,
-- 'dodatek' nie. Produkt zostaje w swojej grupie i dalej dziala na nim silnik
-- wykluczen, zmienia sie tylko to, czy zalicza dzien.
--
-- Ocene, ktory nowy skladnik jest czym, robi Claude przy komendzie /hfood,
-- bo z samej nazwy skladu regula tego nie wyczyta.

ALTER TABLE foods ADD COLUMN portion_role TEXT NOT NULL DEFAULT 'porcja';

UPDATE foods SET portion_role = 'dodatek' WHERE id = 9;   -- pietruszka liście, posypka

DROP VIEW IF EXISTS v_group_coverage;
CREATE VIEW v_group_coverage AS
SELECT
  m.date,
  g.id   AS group_id,
  g.code AS group_code,
  g.name AS group_name,
  g.provides,
  COUNT(DISTINCT m.id) AS meals_with_group
FROM meals m
JOIN meal_foods mf ON mf.meal_id = m.id
JOIN foods f       ON f.id = mf.food_id
JOIN food_groups g ON g.id = f.group_id
WHERE m.stan = 'zjedzony' AND f.portion_role = 'porcja'
GROUP BY m.date, g.id;
