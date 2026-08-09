-- 2026-08-09
-- Pierwotny indeks obejmowal external_id, przez co wymiana dania w panelu hfood
-- dokladala drugi wiersz na ten sam slot zamiast nadpisac istniejacy.
-- Bezpieczne do puszczenia na zywej bazie tylko dopoki nie ma duplikatow.

DROP INDEX IF EXISTS idx_meals_hfood;

CREATE UNIQUE INDEX IF NOT EXISTS idx_meals_hfood
  ON meals(date, slot) WHERE source = 'hfood';
