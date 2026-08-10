-- Stan posilku zamiast flagi eaten.
--
-- Flaga `eaten` obslugiwala dwie rozne rzeczy naraz: "pominalem ten posilek"
-- i "ten posilek dopiero bedzie". Dopoki zamowienie mialo trzy dni naprzod,
-- roznica nie bolala. Przy siedmiu dniach wpisanych z gory kazde ustawienie
-- bylo zle: eaten = 1 kazalo statystykom liczyc przyszlosc jako przezyta,
-- eaten = 0 kasowalo te dni z kalendarza, bo v_day_totals filtruje po eaten.
--
-- Stany:
--   plan      posilek zaplanowany, jeszcze nie zjedzony. Nie liczy sie do sum.
--   zjedzony  liczy sie wszedzie: sumy dnia, pokrycie grup, przerwy, statystyki.
--   pominiety pudelko przyszlo, nie zjadl. Nie liczy sie do sum, ale ma byc widoczne.

-- schema.sql ma na tej kolumnie CHECK. Tutaj go nie ma, bo SQLite nie dokłada
-- CHECK przez ALTER, a przebudowa tabeli meals z kluczem obcym z meal_foods
-- jest przy tej korzysci nieproporcjonalnie ryzykowna. Wartosci pilnuje aplikacja.
ALTER TABLE meals ADD COLUMN stan TEXT NOT NULL DEFAULT 'zjedzony';

UPDATE meals SET stan = CASE WHEN eaten = 1 THEN 'zjedzony' ELSE 'pominiety' END;

-- Catering wpisany z gory na dni, ktore jeszcze nie nastapily.
UPDATE meals SET stan = 'plan'
WHERE source = 'hfood' AND eaten_at IS NULL AND date > '2026-08-10';

-- Widoki trzymaja referencje do kolumny, wiec najpierw znikaja one. SQLite
-- sprawdza przy ALTER TABLE cala definicje schematu, wiec leci tez
-- v_day_vs_targets, ktory sam nie zna kolumny eaten, ale stoi na v_day_totals.
DROP VIEW IF EXISTS v_day_vs_targets;
DROP VIEW IF EXISTS v_day_totals;
DROP VIEW IF EXISTS v_group_coverage;
DROP VIEW IF EXISTS v_restriction_breaches;

ALTER TABLE meals DROP COLUMN eaten;

-- Makra dnia w rozbiciu na stan. Jedno miejsce liczenia dla kalendarza
-- (ktory pokazuje tez plan) i dla v_day_totals (ktore pokazuje tylko fakty).
CREATE VIEW v_day_macros AS
SELECT
  m.date,
  m.stan,
  ROUND(SUM(COALESCE(m.kcal, 0)      * m.eaten_fraction), 1) AS kcal,
  ROUND(SUM(COALESCE(m.protein_g, 0) * m.eaten_fraction), 1) AS protein_g,
  ROUND(SUM(COALESCE(m.fat_g, 0)     * m.eaten_fraction), 1) AS fat_g,
  ROUND(SUM(COALESCE(m.carbs_g, 0)   * m.eaten_fraction), 1) AS carbs_g,
  ROUND(SUM(COALESCE(m.fiber_g, 0)   * m.eaten_fraction), 1) AS fiber_g,
  COUNT(*) AS meals_count,
  SUM(CASE WHEN m.estimated = 1 THEN 1 ELSE 0 END) AS meals_estimated,
  SUM(CASE WHEN m.kcal IS NULL THEN 1 ELSE 0 END)  AS meals_without_macros
FROM meals m
GROUP BY m.date, m.stan;

CREATE VIEW v_day_totals AS
SELECT date, kcal, protein_g, fat_g, carbs_g, fiber_g,
       meals_count, meals_estimated, meals_without_macros
FROM v_day_macros
WHERE stan = 'zjedzony';

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
WHERE m.stan = 'zjedzony'
GROUP BY m.date, g.id;

CREATE VIEW v_day_vs_targets AS
SELECT
  d.date,
  p.id   AS phase_id,
  p.name AS phase_name,
  t.metric,
  t.min_value,
  t.max_value,
  CASE t.metric
    WHEN 'kcal'      THEN d.kcal
    WHEN 'protein_g' THEN d.protein_g
    WHEN 'fat_g'     THEN d.fat_g
    WHEN 'carbs_g'   THEN d.carbs_g
    WHEN 'fiber_g'   THEN d.fiber_g
  END AS actual
FROM v_day_totals d
JOIN phases p  ON d.date >= p.date_from AND (p.date_to IS NULL OR d.date <= p.date_to)
JOIN targets t ON t.phase_id = p.id;

CREATE VIEW v_restriction_breaches AS
SELECT
  m.date,
  m.id      AS meal_id,
  m.slot,
  m.name    AS meal_name,
  f.id      AS food_id,
  f.name    AS food_name,
  r.level,
  r.reason,
  r.source,
  r.max_amount,
  m.stan
FROM meals m
JOIN meal_foods mf  ON mf.meal_id = m.id
JOIN foods f        ON f.id = mf.food_id
JOIN restrictions r ON (r.food_id = f.id OR r.group_id = f.group_id)
WHERE r.status IN ('active', 'testing')
  AND r.level IN ('forbidden', 'limit')
  AND m.date >= r.date_from
  AND (r.date_to IS NULL OR m.date <= r.date_to);
