-- 2026-08-09, korekty po pierwszym przegladzie danych
--
-- 1. Gyoza byla zmapowana na 'croissant', bo oba sa z pszenicy. Reguly
--    dzialaly, ale w raporcie ramen mial "ZAKAZ croissant", co jest mylace.
--    Teraz wskazuje na 'pszenica', czyli na to, co faktycznie jest problemem.
-- 2. Kielki wypadaly dwa razy: raz z reguly dla salat surowych, raz z wlasnej.
--    Zostaje wlasna, bardziej konkretna.

UPDATE food_aliases SET food_id = 58 WHERE alias IN ('gyoza', 'gyoza z kurczakiem', 'goyza');
UPDATE food_aliases SET food_id = 58 WHERE alias IN ('croissant', 'rogalik');
UPDATE foods SET name = 'croissant i pieczywo pszenne' WHERE id = 120;
UPDATE foods SET group_id = NULL WHERE id = 119;
