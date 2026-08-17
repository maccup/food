-- Alias dla ryzu wazonego po ugotowaniu. Szablon "Ryz na mleku bez laktozy"
-- (17.08.2026) podaje gramature po ugotowaniu, bo wazy sie to, co jest na
-- talerzu. Parser zdejmuje ilosc ("250 g"), ale zostawalo "ryz bialy
-- ugotowany", ktorego w slowniku nie bylo: istnial tylko doslowny alias
-- cateringu "ryz bialy ugotowany 130 g". Bez tego aliasu skladnik ladowalby
-- w kolejce nierozpoznanych przy kazdym uzyciu szablonu.
-- Odwracalne: DELETE FROM food_aliases WHERE alias = 'ryż biały ugotowany'.

INSERT INTO food_aliases (alias, food_id, ignored)
SELECT 'ryż biały ugotowany', id, 0 FROM foods WHERE name = 'ryż'
AND NOT EXISTS (SELECT 1 FROM food_aliases WHERE alias = 'ryż biały ugotowany');
