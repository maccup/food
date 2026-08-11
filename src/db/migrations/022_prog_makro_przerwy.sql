-- 2026-08-11
-- Przerwe przerywa naplyw skladnikow odzywczych, nie liczba kalorii.
--
-- Migracja 010 postawila prog wylacznie na kaloriach i opisala go zdaniem
-- „woda i czarne espresso nie wygaszaja fali oczyszczajacej jelito, kawa
-- z mlekiem juz tak". Mechanizm tego zdania nie realizowal: kawa z 50 ml mleka
-- to 26 kcal, czyli ponizej progu 30, wiec aplikacja przepuszczala ja jako
-- neutralna, wbrew wlasnemu opisowi.
--
-- Fale oczyszczajaca (MMC) wygasza glownie tluszcz i bialko, przez hamulec
-- jelitowy i cholecystokinine. 50 ml mleka to 1,9 g bialka i 0,8 g tluszczu,
-- czyli dokladnie ten bodziec, tylko rozlozony na male kalorie. Czarne espresso
-- ma 0,2 g bialka i zero tluszczu i faktycznie nie rusza motoryki.
--
-- Dlatego prog jest teraz podwojny i wystarczy przekroczyc jeden z dwoch.
-- Nie jest to druga flaga obok pierwszej: to jedno pojecie „co przerywa przerwe"
-- opisane dwiema wielkosciami, bo jedna go nie opisuje.
--
-- Historia nie wymaga migracji danych: przerwy nie sa nigdzie zapisane, licza
-- sie przy kazdym wyswietleniu z `meals`, wiec statystyki wsteczne przelicza
-- sie same wedlug nowej reguly. Decyzja Maćka z 11.08.2026.

INSERT INTO settings (key, value, label, hint, kind, sort, grupa) VALUES
  ('gap_makro_prog', '1', 'Próg białka i tłuszczu przerwania przerwy',
   'W gramach, białko plus tłuszcz razem. Pozycja przerywa przerwę, gdy przekroczy ten próg ALBO próg kaloryczny powyżej. Fala oczyszczająca gaśnie od składników odżywczych, nie od samych kalorii: kawa z 50 ml mleka ma tylko 26 kcal, ale 1,9 g białka i 0,8 g tłuszczu',
   'number', 9, 'przerwy')
ON CONFLICT(key) DO UPDATE SET label = excluded.label, hint = excluded.hint, kind = excluded.kind, sort = excluded.sort, grupa = excluded.grupa;

UPDATE settings SET
  hint = 'Pozycje poniżej tylu kalorii nie przerywają przerwy, o ile nie przekroczą też progu białka i tłuszczu poniżej. Woda, herbata i czarne espresso nie wygaszają fali oczyszczającej jelito'
WHERE key = 'gap_kcal_prog';

-- Domyslny czas posilku zjezdza o jedno miejsce nizej, zeby oba progi przerwania
-- staly obok siebie, a nie byly rozdzielone innym polem.
UPDATE settings SET sort = 10 WHERE key = 'default_meal_min';
