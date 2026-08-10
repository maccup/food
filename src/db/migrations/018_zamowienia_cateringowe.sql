-- 2026-08-10
-- Zamowienia cateringowe jako tabela.
--
-- Numer zamowienia i numer diety byly pojedynczymi kluczami w `settings`, wiec
-- kolejne zamowienie nadpisywalo poprzednie i historia znikala. Dni bez dostawy
-- byly globalne, choc naleza do konkretnego okresu: przerwa 21-24.08 dotyczy
-- tego zamowienia, nie kalendarza w ogolnosci.
--
-- Przy okazji: `hfood_order_id` i `hfood_order_diet_id` nie byly uzywane nigdzie
-- w kodzie. Import przyjmuje wklejony JSON i o numerze zamowienia nie wie.
-- To byly notatki udajace konfiguracje, wiec ich miejsce jest w danych.
--
-- Statusu (aktywne, planowane, zakonczone) nie ma jako kolumny, bo wynika z dat.
-- Osobna flaga byla by kolejnym polem do recznego przestawiania i zapominania.

CREATE TABLE IF NOT EXISTS catering_orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  provider    TEXT NOT NULL DEFAULT 'hfood',
  order_id    TEXT NOT NULL,
  diet_id     TEXT,
  date_from   TEXT NOT NULL,
  date_to     TEXT,
  -- Zakresy po przecinku, format "2026-08-21..2026-08-24". Ten sam parser
  -- co wczesniej dla `no_delivery_dates`, patrz parseNoDeliveryDates().
  no_delivery TEXT,
  notes       TEXT
);

CREATE INDEX IF NOT EXISTS idx_catering_okres ON catering_orders(date_from, date_to);

INSERT INTO catering_orders (provider, order_id, diet_id, date_from, date_to, no_delivery, notes)
SELECT 'hfood', '896800', '1115494', '2026-08-14', '2026-09-30',
       '2026-08-21..2026-08-24, 2026-09-11..2026-09-14',
       'Przeniesione z ustawien migracja 018. Dieta low FODMAP, 5 posilkow dziennie.'
WHERE NOT EXISTS (SELECT 1 FROM catering_orders WHERE order_id = '896800');

DELETE FROM settings WHERE key IN ('hfood_order_id', 'hfood_order_diet_id', 'no_delivery_dates');
