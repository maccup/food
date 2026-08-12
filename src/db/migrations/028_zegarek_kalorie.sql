-- 028: przemiana podstawowa, VO2max, waga i tetno marszowe
--
-- Bez `kcal_bazowe` sama liczba kalorii aktywnych nie odpowiada na jedyne
-- pytanie, ktore ma tu sens: czy jestem na deficycie. Aktywne to tylko dodatek
-- ponad spoczynek, a spoczynek to okolo dwie trzecie calego wydatku.
--
-- UWAGA NA PRECYZJE, i to nie jest zastrzezenie kosmetyczne. `kcal_bazowe`
-- z Apple NIE JEST POMIAREM. To wzor z wieku, wzrostu, masy i plci, wiec bledna
-- masa w profilu przesuwa cala kolumne. Kalorie aktywne sa szacunkiem z tetna
-- i ruchu i przy sile potrafia sie mylic o kilkadziesiat procent. Bilans z tych
-- dwoch liczb ma wartosc jako TREND, nie jako wynik: jedynym twardym
-- sprawdzianem deficytu zostaje zmiana masy ciala w czasie.
--
-- Dlatego wchodzi tez `waga`. Bez niej ekran pokazywalby deficyt, ktorego nie
-- da sie zweryfikowac, a to najszybsza droga do trzymania sie liczby zamiast
-- rzeczywistosci.
--
-- VO2max, bo to najsilniejszy pojedynczy predyktor smiertelnosci ogolnej sposrod
-- wszystkiego, co ten zegarek liczy, i jedyna metryka tutaj, ktora mowi o
-- kondycji w skali lat, a nie doby. Zmienia sie miesiacami, wiec nie odpala
-- zadnego sygnalu dziennego.

ALTER TABLE watch ADD COLUMN kcal_bazowe  INTEGER;  -- przemiana podstawowa, wzor Apple, nie pomiar
ALTER TABLE watch ADD COLUMN vo2max       REAL;     -- ml/kg/min
ALTER TABLE watch ADD COLUMN waga         REAL;     -- kg, z wagi laczonej ze Zdrowiem
ALTER TABLE watch ADD COLUMN tetno_marsz  INTEGER;  -- srednie tetno podczas marszu
