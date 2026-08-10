-- 2026-08-10
-- Grupy w ustawieniach.
--
-- Sekcja "Okna jedzenia i catering" trzymala w jednym plaskim formularzu trzy
-- niezalezne tematy: godziny podejsc, zasady liczenia przerw i tozsamosc
-- zamowienia cateringowego. Przy dziewieciu polach pod rzad nie widac, ktore
-- z nich zaleza od siebie, a godziny okien i prog przerwy zalezec musza.
--
-- Grupa jest kolumna, nie kolejnoscia sortowania, bo ekran ma renderowac jeden
-- zwijany blok na grupe. Domyslne "inne" zostaje dla kluczy dodanych pozniej:
-- nowy klucz bez przypisania wyladuje w bloku "Pozostale", a nie zniknie.

ALTER TABLE settings ADD COLUMN grupa TEXT NOT NULL DEFAULT 'inne';

UPDATE settings SET grupa = 'okna'    WHERE key IN ('sitting_1_time', 'sitting_2_time', 'sitting_3_time');
UPDATE settings SET grupa = 'przerwy' WHERE key IN ('min_gap_hours', 'gap_kcal_prog', 'default_meal_min');
