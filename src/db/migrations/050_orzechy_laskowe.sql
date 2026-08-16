-- 050: orzechy laskowe, musztarda ostra, agar
--
-- Kolejka nierozpoznanych po imporcie 16.08 (dni 17 do 20.08).
--
-- Orzechy laskowe wchodza z salatki z indykiem, ktora 20.08 zastapila sernik
-- ze stewia. Monash: niskie FODMAP do ok. 10 sztuk (15 g), powyzej 30 g rosna
-- fruktany i GOS. To ten sam profil co migdaly (id 67), wiec ten sam zapis:
-- grupa "Orzechy i nasiona", fodmap 'moderate', bez ograniczenia, bo w daniach
-- cateringu orzechy sa dodatkiem kilkunastogramowym, a nie porcja.
--
-- Musztarda ostra to ta sama musztarda co id 146, tylko inna nazwa w skladzie.
-- Sam alias, bez nowego produktu, inaczej wykluczenia rozjezdzaja sie na dwa wiersze.
--
-- Agar to zelujacy dodatek techniczny z alg, uzywany w gramach na porcje.
-- Nie ma wlasnej roli w wykluczeniach, wiec alias ignorowany, jak przyprawy.

INSERT INTO foods (id, name, group_id, fodmap, fodmap_note, fermented, histamine, fiber_type, notes) VALUES
  (162, 'orzechy laskowe', 15, 'moderate', 'fruktany, GOS', 0, 'low', 'mixed',
   'Monash: niskie FODMAP do ok. 10 sztuk (15 g), powyzej 30 g fruktany i GOS')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, group_id = excluded.group_id, fodmap = excluded.fodmap, notes = excluded.notes;

INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('orzechy laskowe', 162, '2026-08-16'),
  ('musztarda ostra', 146, '2026-08-16')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id;

INSERT INTO food_aliases (alias, food_id, ignored, first_seen) VALUES
  ('agar', NULL, 1, '2026-08-15')
ON CONFLICT(alias) DO UPDATE SET ignored = 1;
