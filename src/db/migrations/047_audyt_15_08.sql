-- 047: naprawa dziur w silniku wykluczen i falszywych zrodel, audyt 15.08.2026
--
-- Zrodlo: szesc niezaleznych audytow uruchomionych 15.08.2026 na trzech modelach.
-- Kazde ustalenie ponizej zostalo potwierdzone zapytaniem do tej bazy, a nie
-- przepisane z raportu. Decyzje 1, 2 i 3 zatwierdzil Maciej 15.08.

-- ---------------------------------------------------------------------------
-- 1. Zakaz fermentow przeciekal na cztery produkty
-- ---------------------------------------------------------------------------
-- Regula id 19 jest GRUPOWA (group_id = 14), a widok v_restriction_breaches
-- laczy restrykcje wylacznie po `food_id` albo `group_id`. Kolumna
-- `foods.fermented` nie bierze udzialu w wykluczeniach w ogole. Skutek:
-- produkt z fermented = 1 i group_id NULL przechodzil jako czysty.
--
-- Praktyczny koszt: 19.08 odrzucilem omlet za jogurt roslinny, a tego samego
-- dnia przepuscilem koreanskie pulpeciki z sosem sojowym. Ta sama kategoria,
-- dwa rozne wyniki, bo jeden produkt siedzial w grupie, a drugi nie.

UPDATE foods SET group_id = 14 WHERE id IN (34, 142, 150);
  -- 34 tempeh, 142 jogurt roslinny, 150 sos jogurtowy: zywe kultury, ta sama
  -- kategoria co kefir, wiec ten sam zakaz do 15.09.

-- Sos sojowy celowo NIE trafia do grupy 14. Z trzech powodow zakazu
-- (laktoza, zywe kultury, histamina) spelnia wylacznie trzeci: jest
-- pasteryzowany, nie ma laktozy i wchodzi lyzka, nie porcja. Dostaje `limit`,
-- czyli ten sam poziom co ayran i skyr po 15.09.
INSERT INTO restrictions (food_id, group_id, level, reason, source, date_from, status, max_amount)
VALUES (115, NULL, 'limit',
        'Fermentowany, ale pasteryzowany i bez laktozy. Zostaje sama histamina, a ta przy braku objawow skornych i katarowych jest slabym argumentem. Lyzka do dania, nie porcja',
        'Audyt 15.08.2026, decyzja repo', '2026-08-15', 'active', 'lyzka do dania, nie codziennie');

-- ---------------------------------------------------------------------------
-- 2. Skyr i ayran lezaly poza zakazem przez pomylke w klasyfikacji
-- ---------------------------------------------------------------------------
-- Skyr mial group_id = 13 („Nabial bez laktozy"), a jego wlasna restrykcja
-- w tym samym wierszu podawala powod „Laktoza ok. 4 g na 100 g". Sprzecznosc
-- w jednym rekordzie. Ayran nie mial grupy wcale.
--
-- Oba sa fermentowanym nabialem z laktoza, czyli dokladnie tym, czym jest
-- kefir. Kefir mial `forbidden`, one `limit`, i nie stala za tym zadna decyzja.
-- Maciej potwierdzil 15.08, ze zakaz fermentow zostaje do 15.09, wiec
-- rozstrzygniecie idzie w strone spojnosci, nie w strone rozluznienia.

UPDATE foods SET group_id = 14 WHERE id IN (44, 149);   -- skyr, ayran

-- Ich wlasne limity nie znikaja, tylko wchodza w zycie po koncu zakazu.
-- Dzieki temu 16.09 skyr i ayran wracaja od razu z wlasciwa porcja,
-- bez potrzeby pamietania o tym recznie.
UPDATE restrictions SET date_from = '2026-09-16' WHERE id IN (32, 55);

-- ---------------------------------------------------------------------------
-- 3. Wafle ryzowe byly w bazie tym samym produktem co pieczywo bezglutenowe
-- ---------------------------------------------------------------------------
-- Alias „wafle ryzowe" wskazywal na produkt 55 „pieczywo bezglutenowe"
-- w grupie kasz i ryzu, bez zadnej restrykcji. Pozycja z listy „OMIJAC"
-- w food_list.md byla dla silnika niewidzialna, mimo ze 16.08 posluzyla
-- za powod wymiany dania.
--
-- Poziom `limit`, nie `forbidden`, bo food_list.md rozdziela „OMIJAC"
-- od „CZARNEJ LISTY", a wafle sa w tej pierwszej.

INSERT INTO foods (id, name, group_id, fodmap, fodmap_note, fermented, histamine, fiber_type, processed_meat, refined_oil, notes) VALUES
  (158, 'wafle ryzowe', 11, 'low', NULL, 0, 'low', 'insoluble', 0, 0,
   'Lista OMIJAC w food_list.md: wysoki indeks glikemiczny, zero sytosci, blonnik nierozpuszczalny')
ON CONFLICT(id) DO UPDATE SET name = excluded.name, notes = excluded.notes;

UPDATE food_aliases SET food_id = 158 WHERE alias IN ('wafle ryżowe', 'wafle ryzowe');
INSERT INTO food_aliases (alias, food_id, first_seen) VALUES ('wafel ryżowy', 158, '2026-08-15')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id;

INSERT INTO restrictions (food_id, group_id, level, reason, source, date_from, status, max_amount)
VALUES (158, NULL, 'limit',
        'Blonnik nierozpuszczalny bez sytosci przy zaparciu z metanem, wysoki IG. Lista OMIJAC, nie czarna lista',
        'food_list.md, lista OMIJAC', '2026-08-15', 'active', 'nie kupowac, w pudelku tolerowac');

-- ---------------------------------------------------------------------------
-- 4. Falszywe zrodla w polach `source`
-- ---------------------------------------------------------------------------
-- Cel tluszczowy powolywal sie na elastaze 151 we wszystkich trzech fazach.
-- W notatce Piotrowskiego z 21.05 powodem jest „kierunek srodziemnomorski
-- /longevity", a elastaze gastrolog odrzucila jako klinicznie nieistotna
-- 15.05. Repo powtorzylo to 10.08, odstawiajac karczoch i Essentiale
-- wlasnie dlatego, ze trzustka jest w porzadku.
UPDATE targets SET source = 'Piotrowski 2026-05-21: kierunek srodziemnomorski/longevity. NIE elastaza, ta przeslanka odrzucona 15.08.2026'
WHERE metric = 'fat_g';

-- Cel bialkowy powolywal sie na „metionina a homocysteina". Homocysteina
-- wzrosla 13,70 na 19,20 dokladnie wtedy, gdy bialko ZMNIEJSZONO po 21.05,
-- a jedyna zmienna, ktora w tym oknie zniknela, byl pelny B-complex.
UPDATE targets SET source = 'Zapotrzebowanie przy treningu silowym, 1,6 do 1,9 g/kg przy 83 kg. Watek metioniny odrzucony 15.08.2026: bialko spadlo, a homocysteina wzrosla'
WHERE metric = 'protein_g';

-- Zakaz fermentow byl podpisany nazwiskiem lekarki. W cytacie jej zalecen
-- nie ma o fermentach ani slowa, a korespondencja z 04 i 05.08 dotyczy
-- wylacznie guaru. To jest decyzja repo i pacjenta, i tak ma byc zapisana.
-- Przy okazji data: notatka z konsultacji mowi 15.09, baza miala 14.09.
UPDATE restrictions
SET source = 'Decyzja repo i pacjenta 05.08.2026. Powody: laktoza, zywe kultury gina od neomycyny, histamina. Lekarka o fermentach nie mowila, wyznaczyla tylko probiotyk od 18.08',
    date_to = '2026-09-15'
WHERE id = 19;
