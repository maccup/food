-- 2026-08-09
-- Prog kaloryczny, powyzej ktorego pozycja przerywa przerwe miedzy posilkami.
--
-- Fala oczyszczajaca jelito cienkie wygasza sie po naplywie kalorii, a nie
-- od samego przelkniecia czegokolwiek. Woda jej nie przerywa, czarne espresso
-- (3 kcal) praktycznie tez nie. Cappuccino i latte to 80 do 150 kcal, czyli
-- normalny posilek plynny, i te przerywaja.
--
-- Osobno: kawa NIE spowalnia motoryki. Pobudza aktywnosc okreznicy przez
-- odruch zoladkowo-okrezniczy, co przy fenotypie zaparciowym jest plusem.
-- To dwa rozne mechanizmy i wczesniejsza wersja tego dokumentu je mieszala.
INSERT INTO settings (key, value, label, hint, kind, sort) VALUES
  ('gap_kcal_prog', '30', 'Próg kaloryczny przerwania przerwy',
   'Pozycje poniżej tylu kalorii nie przerywają przerwy między posiłkami. Woda i czarne espresso nie wygaszają fali oczyszczającej jelito, kawa z mlekiem już tak',
   'number', 8)
ON CONFLICT(key) DO NOTHING;
