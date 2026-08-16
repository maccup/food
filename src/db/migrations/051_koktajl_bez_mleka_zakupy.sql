-- 051: koktajl kakaowy w wersji Maćka, plus braki tygodnia 17 do 23.08 na liste zakupow
--
-- Koktajl: sam skyr, mrozone owoce i kakao. Mleko wypada, bo bylo tam wylacznie
-- po to, zeby dalo sie to pic przez slomke, a nie dlatego, ze cokolwiek wnosilo.
-- Bez mleka wychodzi gesta miska do lyzki, nie napoj.
-- Skyr caly kubek 330 g, bo tyle ma opakowanie i reszta i tak by sie zmarnowala.
--
-- Makra: skyr 63 kcal/100 g (B 10,7 T 0,2 W 4,0) x 3,3; kakao naturalne
-- odtluszczone 228 kcal/100 g (B 19,6 T 13,7 W 57,9 bl 37) x 0,07; mieszanka
-- mrozona 150 g w proporcji truskawki 80, maliny 40, borowki 30, bo progi Monash
-- na porcje to 150 g, 60 g i 40 g i przy tym podziale zadna nie zjada limitu drugiej.
-- Razem 288 kcal, B 37,9, T 2,3, W 32,6, bl 7,5.
--
-- Laktoza: 330 g skyru to ok. 13 g, czyli caly dzienny przydzial nabialu z laktoza.
-- Limit "maks. 1 porcja dziennie" (restrictions) jest spelniony, ale drugiego
-- twarogu ani skyru tego samego dnia juz nie ma.

UPDATE meal_templates SET
  ingredients = 'skyr 330 g, kakao 7 g, truskawki 80 g, maliny 40 g, borówki 30 g',
  kcal = 288, protein_g = 37.9, fat_g = 2.3, carbs_g = 32.6, fiber_g = 7.5
WHERE name = 'Koktajl kakaowy na skyrze';

-- Braki pokrycia grup w tygodniu 17 do 23.08, policzone po zaimportowaniu pudelek.
-- Kiwi 1 dzien na 7 wymaganych, zielone liscie 1 na 5, oliwa 3 na 5. Catering
-- nie wozi tego w takiej czestotliwosci i nigdy nie bedzie, wiec to jest stala
-- pozycja przegladu, nie wyjatek. Do tego 21 do 24.08 nie ma dostaw w ogole.

-- Kiwi, zielone liscie i oliwa wisza na liscie od wczesniej pod nazwami grup,
-- wiec dokladam tylko dwa konkretne produkty na zielone liscie. Porownanie
-- musi ignorowac wielkosc liter, inaczej "kiwi zielone" dubluje "Kiwi zielone".

INSERT INTO shopping (label, note, added_on)
SELECT * FROM (
  SELECT 'szpinak świeży' AS label, 'zielone liście 1/5 w tygodniu 17-23.08, do jajecznicy albo na ciepło' AS note, '2026-08-16' AS added_on
  UNION ALL SELECT 'rukola', 'zielone liście, dodatek do pudełka', '2026-08-16'
) nowe
WHERE NOT EXISTS (
  SELECT 1 FROM shopping s WHERE lower(s.label) = lower(nowe.label) AND s.bought = 0
);
