-- 2026-08-09
-- Posilek spoza cateringu czesto nie ma znanych makr: restauracja, obiad u kogos,
-- cokolwiek opisane z pamieci. Takie wpisy maja byc mozliwe, ale dzien musi
-- pokazywac, ze czesc liczb jest szacowana albo brakuje jej calkiem,
-- zamiast po cichu zaniżać sumy przez SUM ignorujacy NULL-e.

ALTER TABLE meals ADD COLUMN estimated INTEGER NOT NULL DEFAULT 0;

DROP VIEW IF EXISTS v_day_totals;
CREATE VIEW v_day_totals AS
SELECT
  m.date,
  ROUND(SUM(COALESCE(m.kcal, 0)      * m.eaten_fraction), 1) AS kcal,
  ROUND(SUM(COALESCE(m.protein_g, 0) * m.eaten_fraction), 1) AS protein_g,
  ROUND(SUM(COALESCE(m.fat_g, 0)     * m.eaten_fraction), 1) AS fat_g,
  ROUND(SUM(COALESCE(m.carbs_g, 0)   * m.eaten_fraction), 1) AS carbs_g,
  ROUND(SUM(COALESCE(m.fiber_g, 0)   * m.eaten_fraction), 1) AS fiber_g,
  COUNT(*) AS meals_count,
  SUM(CASE WHEN m.estimated = 1 THEN 1 ELSE 0 END) AS meals_estimated,
  SUM(CASE WHEN m.kcal IS NULL THEN 1 ELSE 0 END)  AS meals_without_macros
FROM meals m
WHERE m.eaten = 1
GROUP BY m.date;
