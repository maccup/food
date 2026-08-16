-- 054: audyt pochodzenia regul, 16.08.2026
--
-- Maciej zakwestionowal, skad biora sie zakazy i pasmo tluszczu. Przeszedlem
-- wszystkie 61 aktywnych regul do dokumentu zrodlowego. Reguly, ktore mialy
-- pokrycie w zaleceniu lekarza (low FODMAP do 14.09) albo w Monash, zostaja
-- bez zmian. Ponizej jest to, co pokrycia nie mialo.
--
-- Pasmo tluszczu 80 do 100 g nie jest w bazie, tylko w dokumentacji. Zmiana
-- z bramki dobowej na srednia tygodniowa jest w hfood.md i w analizie.

-- ---------------------------------------------------------------------------
-- 1. Grupowy zakaz produktow fermentowanych (regula 19) traci moc
-- ---------------------------------------------------------------------------
-- Powstal 05.08 z pytania o kefir i zostal rozciagniety na cala grupe. Pole
-- source mowilo wprost "Lekarka o fermentach nie mowila". Trzy uzasadnienia
-- nie trzymaly sie calej grupy:
--   laktoza    - nie ma jej w oliwkach, kaparach, jogurcie roslinnym, tempehu
--   zywe kultury gina od neomycyny - to argument za bezuzytecznoscia, nie za
--                szkodliwoscia, a produkty ze sloika i tak sa pasteryzowane
--   histamina  - ten sam argument uznano 15.08 za slaby przy sosie sojowym
--                (regula 61) i zjechal on wtedy z zakazu na limit
--
-- Kosztowala cztery dania w trzech dniach cateringu, w tym omlet owsiany
-- 19.08 z najwyzszym bialkiem tygodnia, i blokowala skyr, czyli baze koktajlu
-- wpisanego 16.08 jako zamiennik pudelka.
--
-- Regula zostaje w tabeli ze statusem 'cleared', bo historii nie przepisujemy.

UPDATE restrictions SET status = 'cleared' WHERE id = 19;

-- Zostaje to, co ma zywe kultury i realny ladunek fermentujacego substratu.
-- Sok z kiszonej kapusty ma juz wlasna regule 20, wiec go tu nie ma.
INSERT INTO restrictions (food_id, level, reason, source, date_from, date_to, status) VALUES
  (43,  'forbidden', 'Zywe kultury, laktoza 5 do 8 g na szklanke i wysoka histamina naraz. To jest ten produkt, o ktorym powstala pierwotna decyzja z 05.08',
        'Decyzja repo i pacjenta 05.08.2026, zawezona audytem 16.08.2026', '2026-08-16', '2026-09-14', 'active'),
  (101, 'forbidden', 'Kiszonka z zywymi kulturami, wysoka histamina, moderate FODMAP',
        'Decyzja repo i pacjenta 05.08.2026, zawezona audytem 16.08.2026', '2026-08-16', '2026-09-14', 'active'),
  (103, 'forbidden', 'Kiszonka z zywymi kulturami, wysoka histamina, do tego czosnek i cebula w skladzie',
        'Decyzja repo i pacjenta 05.08.2026, zawezona audytem 16.08.2026', '2026-08-16', '2026-09-14', 'active');

-- Reszta grupy schodzi na limit. Fermentacja jest tu etapem produkcji, a nie
-- zywa kultura w porcji, i zaden z tych produktow nie niesie laktozy.
INSERT INTO restrictions (food_id, level, reason, source, date_from, date_to, status, max_amount) VALUES
  (104, 'limit', 'Solanka i histamina. Bez laktozy i bez zywych kultur, wiec dodatek do dania jest do przyjecia, porcja nie',
        'Audyt regul 16.08.2026', '2026-08-16', '2026-09-14', 'active', 'dodatek do dania, nie baza'),
  (105, 'limit', 'Solanka i histamina, tak samo jak oliwki. W praktyce zawsze wystepuja jako dodatek smakowy',
        'Audyt regul 16.08.2026', '2026-08-16', '2026-09-14', 'active', 'dodatek do dania, nie baza'),
  (142, 'limit', 'Jogurt roslinny pasteryzowany, bez laktozy i bez zywych kultur. Zostaje sama etykieta "fermentowany", ktora sama w sobie niczego nie dowodzi',
        'Audyt regul 16.08.2026', '2026-08-16', '2026-09-14', 'active', 'skladnik dania, nie osobna porcja'),
  (34,  'limit', 'Soja fermentowana, oligosacharydy juz rozlozone. food_list.md wymienia tempeh jako wyjatek od zakazu soi, wiec zakaz grupowy byl sprzeczny z wlasna lista',
        'food_list.md, sekcja Soja, plus audyt regul 16.08.2026', '2026-08-16', '2026-09-14', 'active', 'okazjonalnie, ok. 100 g'),
  (150, 'limit', 'Jogurt krowi, wiec laktoza. Powod jest laktozowy, nie fermentacyjny',
        'Audyt regul 16.08.2026', '2026-08-16', NULL, 'active', 'lyzka do dania, nie porcja');

-- Skyr i ayran mialy limit dopiero od 16.09, bo do tego czasu lapal je zakaz
-- grupowy. Po jego zdjeciu limit musi obowiazywac od zaraz, bo powodem jest
-- laktoza, a ta nie czeka do wrzesnia.
UPDATE restrictions SET date_from = '2026-08-16',
  max_amount = 'ok. 150 g na porcje, powyzej laktoza przekracza prog Monash',
  source = 'Dieta_obecna_ranking.md ranking B, przesuniete audytem 16.08.2026'
WHERE id = 32;

UPDATE restrictions SET date_from = '2026-08-16',
  source = 'Etykieta produktu, decyzja 12.08.2026, przesuniete audytem 16.08.2026'
WHERE id = 55;

-- ---------------------------------------------------------------------------
-- 2. Warzywa surowe: koniec limitu razem z koncem antybiotyku
-- ---------------------------------------------------------------------------
-- Limit siegal 14.09, czyli konca low FODMAP. Ale low FODMAP nie zabrania
-- surowego, zabrania konkretnych weglowodanow. Jedyna podstawa dla formy
-- surowej byla "dieta lekkostrawna" z zalecenia gastrologa z 03.08, a ta
-- obowiazuje wylacznie na 14 dni antybiotyku, ktory konczy sie 17.08
-- (probiotyk lekarka wyznaczyla od 18.08).

UPDATE restrictions SET date_to = '2026-08-17',
  reason = 'Surowe. Podstawa jest "dieta lekkostrawna" zalecona na 14 dni antybiotyku, a nie low FODMAP. Konczy sie razem z antybiotykiem 17.08',
  source = 'Konsultacje/2026-08-03_Sidor-Baginska_gastrolog.md, korekta audytem 16.08.2026'
WHERE id = 31;

-- ---------------------------------------------------------------------------
-- 3. Elastaza wyczyszczona z uzasadnien
-- ---------------------------------------------------------------------------
-- Gastrolog odrzucila elastaze 151 jako nieistotna klinicznie 15.05.2026,
-- repo potwierdzilo to 10.08 przy odstawianiu karczocha i Essentiale.
-- Dwie reguly nadal powolywaly sie na nia jako na wspolpodstawe.

UPDATE restrictions SET reason = 'Pszenica, fruktany' WHERE id = 43;
UPDATE restrictions SET reason = 'Laktoza w bazie smietankowej' WHERE id = 48;

-- ---------------------------------------------------------------------------
-- 4. Reguly bez wpisanego zrodla
-- ---------------------------------------------------------------------------
UPDATE restrictions SET source = 'EFSA i FDA, zalecenia dotyczace rteci w rybach drapieznych'
WHERE id = 29;

-- ---------------------------------------------------------------------------
-- 5. Miod: zakaz bezterminowy bez podstawy
-- ---------------------------------------------------------------------------
-- Powodem jest nadmiar fruktozy nad glukoza, czyli powod czysto FODMAP,
-- a te wygasaja 14.09. food_list.md wymienia miod w sekcji "Cukry naturalne
-- (z umiarem)", wiec zakaz bezterminowy byl sprzeczny z wlasna lista.

UPDATE restrictions SET date_to = '2026-09-14' WHERE id = 7;
