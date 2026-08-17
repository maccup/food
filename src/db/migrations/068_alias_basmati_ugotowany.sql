-- Alias dla basmati wazonego po ugotowaniu, jak 066 dla ryzu bialego.
-- Szablon "Ryz na mleku bez laktozy" od 17.08.2026 wieczorem uzywa basmati,
-- bo taki ryz Maciek faktycznie gotuje.
-- Odwracalne: DELETE FROM food_aliases WHERE alias = 'ryż basmati ugotowany'.

INSERT INTO food_aliases (alias, food_id, ignored)
SELECT 'ryż basmati ugotowany', id, 0 FROM foods WHERE name = 'ryż'
AND NOT EXISTS (SELECT 1 FROM food_aliases WHERE alias = 'ryż basmati ugotowany');
