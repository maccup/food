-- Aliasy pod szablony z ekstra zamowienia flexi 21.08.2026 (przerwa w dostawach):
-- panel pisze "kukurydza, konserwowa" i feta bez cudzyslowow, slownik ich nie znal.
INSERT OR IGNORE INTO food_aliases (alias, food_id, ignored) VALUES
  ('kukurydza konserwowa', 17, 0),
  ('ser typu feta bez laktozy', 41, 0);
