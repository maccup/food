-- 2026-08-10
-- Czas trwania posilku.
--
-- Przerwa miedzy posilkami liczyla sie jako roznica godzin rozpoczecia, czyli
-- zawyzala prawdziwa przerwe o czas trwania poprzedniego posilku. Przy posilku
-- jedzonym godzine to godzina bledu na najwazniejszej liczbie w calej bazie.
--
-- Faza III MMC wraca dopiero po oproznieniu zoladka, wiec dla jelita posilek
-- jedzony godzine to godzinny wlew, a nie zdarzenie punktowe. Zeby policzyc
-- to poprawnie, trzeba znac oba konce: eaten_at zostaje POCZATKIEM, dochodzi
-- czas trwania. Przerwa = start nastepnego - (start poprzedniego + trwanie).
--
-- 30 minut jako wartosc domyslna i jako uzupelnienie wpisow sprzed tej zmiany,
-- decyzja Macieja z 10.08. Kolumna zostaje nullowalna, zeby dalo sie odroznic
-- "nie podano" od "podano 30", ale po tej migracji nulli w bazie nie ma.

ALTER TABLE meals ADD COLUMN duration_min INTEGER;

UPDATE meals SET duration_min = 30 WHERE duration_min IS NULL;

INSERT INTO settings (key, value, label, hint, kind, sort) VALUES
  ('default_meal_min', '30', 'Domyślny czas posiłku',
   'W minutach. Podstawia się tam, gdzie nie podałeś, ile posiłek trwał. Przerwa liczy się od ostatniego kęsa, bo fala oczyszczająca rusza dopiero po opróżnieniu żołądka',
   'number', 9)
ON CONFLICT(key) DO NOTHING;
