-- 2026-08-10
-- Karczoch i Essentiale nie wracaja 18.08. Decyzja pacjenta z 10.08.2026.
--
-- Oba kupione 21.05 pod dwa cele i oba cele wyparowaly: trawienie tluszczu przy
-- elastazie 151 gastrolog odrzucila 15.05 jako klinicznie nieistotne, a wzdecia
-- wyjasnil test oddechowy z 02.08, czyli metan, leczony antybiotykiem.
--
-- Dwa rozne statusy, bo to dwa rozne stany, zgodnie z rozgraniczeniem w CLAUDE.md:
--   Essentiale 'discontinued', bo nie ma zdefiniowanej drogi powrotu.
--   Karczoch 'paused', bo ma dokladnie jedna: test pojedynczego elementu od 15.09.
-- Okien harmonogramu (id 8, 9, 10) nie domykamy w zadnym z tych przypadkow.
-- Status gatuje liste dnia sam, a bezterminowe okno trzyma pory i dawki gotowe
-- na wypadek powrotu.

PRAGMA foreign_keys = ON;

UPDATE supplements SET
  status = 'paused',
  notes = 'Nie wraca 18.08, decyzja pacjenta z 10.08.2026. Kupiony 21.05 pod trawienie tłuszczu przy elastazie 151 i pod wzdęcia: pierwszy cel gastrolog odrzuciła 15.05 jako klinicznie nieistotny, drugi wyjaśnił test oddechowy z 02.08, czyli metan leczony antybiotykiem. ALT 23, AST 31, GGT 11, ALP 68, bilirubina 0,90, a w kale z 28.04 kulki tłuszczu „pojedyncze" i włókna mięsne nieobecne. Wyciąg z liścia karczocha ma dane w dyspepsji czynnościowej i w IBS, więc jest bez podstaw teraz, a nie bez podstaw w ogóle: jedyna droga powrotu to pojedynczy testowany element na 2 tygodnie z dziennikiem, najwcześniej od 15.09 i tylko jeśli wróci wzdęcie albo pływający, tłustawy stolec.'
WHERE id = 5;

UPDATE supplements SET
  status = 'discontinued',
  notes = 'Odstawiony na stałe decyzją pacjenta z 10.08.2026, bez drogi powrotu: cel pokrywał się z karczochem, a dane w tym wskazaniu są najsłabsze z trójki karczoch, Essentiale, TUDCA, z której TUDCA już wypadła. Kupiony 21.05 pod trawienie tłuszczu przy elastazie 151 i pod wzdęcia: pierwszy cel gastrolog odrzuciła 15.05 jako klinicznie nieistotny, drugi wyjaśnił test oddechowy z 02.08, czyli metan leczony antybiotykiem. ALT 23, AST 31, GGT 11, ALP 68, bilirubina 0,90, a w kale z 28.04 kulki tłuszczu „pojedyncze" i włókna mięsne nieobecne.'
WHERE id = 6;
