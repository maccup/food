-- 029: wlasna przemiana podstawowa zamiast wzoru Apple
--
-- Apple liczy `BasalEnergyBurned` ze wzoru na masie, wzroscie, wieku i plci i
-- wychodzi mu okolo 2100 kcal. Wlasne pomiary skladu ciala mowia co innego:
--
--   DEXA Lunar iDXA, 18.05.2023, masa beztluszczowa 68,8 kg  ->  1842 kcal
--   BIA Fitdays, 02.2026, masa beztluszczowa 73,2 kg         ->  1951 kcal
--
-- Roznica siega 250 kcal na dobe, czyli okolo 1,7 kg roznicy w prognozie masy
-- na miesiac. To nie jest szczegol, tylko caly wynik: przy deficycie rzedu 400
-- kcal blad tej wielkosci decyduje o tym, czy redukcja w ogole zachodzi.
--
-- Puste pole znaczy „uzyj liczby z zegarka" i to jest ustawienie domyslne.
-- Aplikacja NIE PODSTAWIA zadnej z powyzszych liczb sama, bo wybor miedzy DEXA
-- a BIA to decyzja o tym, ktoremu badaniu ufamy, a nie szczegol techniczny.
-- Te same dane pokazuja zreszta, ze metody sie rozjezdzaja: 18.05.2023 DEXA dala
-- 15,4 procent tkanki tluszczowej, a skan Styku tego samego dnia 19,9 procent.

INSERT INTO settings (key, value, label, hint, kind, grupa, sort) VALUES (
  'bmr_kcal',
  '',
  'Własna przemiana podstawowa',
  'Ile spalasz na dobę w spoczynku, w kcal. Puste znaczy: bierz liczbę z zegarka. Apple liczy ją ze wzoru z masy i wieku i zwykle zawyża wobec pomiaru składu ciała. DEXA z 2023 daje 1842, waga BIA z 2026 daje 1951, zegarek około 2100.',
  'number',
  'przerwy',
  20
) ON CONFLICT(key) DO NOTHING;
