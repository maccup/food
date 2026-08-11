-- 025: stres dnia jako jedna liczba na dobe
--
-- Jeden wiersz na dzien, `date` jako klucz glowny. To nie jest oszczednosc,
-- tylko model: stres wpisuje sie wieczorem za caly dzien, a nie w momencie,
-- w ktorym sie pojawia. Wpisy „w chwili zdarzenia" bylyby dokladniejsze i
-- jednoczesnie bezuzyteczne, bo w stresie nikt nie siega po telefon, wiec
-- dziura w danych wypadlaby dokladnie w dniach, ktore sa najciekawsze.
--
-- Jelito reaguje na stres w skali godzin i doby, nie minut, wiec dokladniejsza
-- rozdzielczosc nic by nie dodala. Za to lag jest realny: napiecie z poniedzialku
-- widac czesto we wtorek rano, dlatego statystyki zestawiaja stres dnia ze
-- stolcami tego dnia ORAZ nastepnego.
--
-- Skala 0 do 10, ta sama co `symptoms.severity`, zeby dwie liczby na tym samym
-- ekranie nie znaczyly czego innego.
--
-- Osobna tabela, a nie `symptoms` z kind = 'stres': objawy sa zdarzeniami z
-- godzina i moze ich byc kilka dziennie, stres jest ocena calej doby. Wrzucenie
-- go do objawow zafalszowaloby kazda statystyke objawow, bo „ile razy bolal
-- brzuch" zaczeloby zawierac dni bez zadnego objawu jelitowego.

CREATE TABLE IF NOT EXISTS stress (
  date       TEXT PRIMARY KEY,
  level      INTEGER NOT NULL,   -- 0 do 10
  powod      TEXT,               -- praca | pieniadze | relacje | zdrowie | studia | sen | inne
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (level BETWEEN 0 AND 10)
);
