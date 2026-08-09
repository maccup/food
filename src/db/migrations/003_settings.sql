-- 2026-08-09
-- Ustawienia, które do tej pory były zaszyte w kodzie: godziny okien jedzenia,
-- identyfikatory zamówienia w hfood, dni bez dostawy. Wszystkie są rzeczą,
-- która zmienia się przy każdym nowym zamówieniu cateringu, więc nie mogą
-- wymagać deployu.

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT,
  label TEXT NOT NULL,
  hint  TEXT,
  kind  TEXT NOT NULL DEFAULT 'text',  -- text | time | number | dates
  sort  INTEGER NOT NULL DEFAULT 0
);

INSERT INTO settings (key, value, label, hint, kind, sort) VALUES
  ('sitting_1_time', '09:00', 'Pierwsze podejście', 'Śniadanie i drugie śniadanie razem', 'time', 1),
  ('sitting_2_time', '14:00', 'Drugie podejście', 'Obiad', 'time', 2),
  ('sitting_3_time', '18:30', 'Trzecie podejście', 'Podwieczorek i kolacja razem', 'time', 3),
  ('min_gap_hours',  '4',     'Minimalna przerwa między podejściami', 'W godzinach. Poniżej tej wartości aplikacja ostrzega, bo fala oczyszczająca jelito nie zdąży ruszyć', 'number', 4),
  ('hfood_order_id', '896800', 'Numer zamówienia hfood', 'Z adresu w panelu cateringu, potrzebny do importu', 'text', 5),
  ('hfood_order_diet_id', '1115494', 'Numer diety w zamówieniu', 'Też z panelu cateringu', 'text', 6),
  ('no_delivery_dates', '2026-08-21..2026-08-24, 2026-09-11..2026-09-14', 'Dni bez dostawy', 'Zakresy po przecinku, format 2026-08-21..2026-08-24. Kalendarz oznaczy je jako przerwę, a nie jako brak wpisu', 'dates', 7)
ON CONFLICT(key) DO NOTHING;
