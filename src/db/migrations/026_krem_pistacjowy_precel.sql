-- 026: krem pistacjowy jako osobny produkt, precel jako pieczywo pszenne
--
-- Precel byl dla silnika wykluczen NIEWIDZIALNY. Pszenica jest zakazana od
-- 03.08 przez food 120, ale dopasowanie idzie wylacznie przez aliasy, a zadnego
-- na „precel" nie bylo. Wpis z 12.08 przeszedl bez sladu, mimo ze to ten sam
-- produkt co croissant. Alias do 120, nie nowy wiersz: to jest pszenne pieczywo
-- i ma dzielic z croissantem jedno wykluczenie, a nie miec wlasne.
--
-- Krem pistacjowy dostaje wlasny wiersz zamiast aliasu do „pistacje" (71).
-- Pistacje sa zakazane do 14.09 jako wysokofermentujace i to jest sluszne dla
-- garsci orzechow. Lyzeczka kremu to ten sam fruktan w dawce kilkukrotnie
-- mniejszej, za to z cukrem, wiec „zakazane" zawyzaloby sprawe, a alias do 71
-- nie pozwolilby tego rozroznic. Ta sama zasada, ktora trzyma osobno „dzem"
-- (118) i owoce: przetwor to inny produkt niz surowiec.
--
-- group_id celowo puste. Grupa 15 to orzechy i nasiona, liczona do pokrycia
-- tygodniowego. Lyzeczka slodkiego kremu nie jest porcja orzechow i nie moze
-- odhaczac tej grupy, bo pokrycie zaczeloby klamac.

INSERT INTO foods (id, name, group_id, fodmap, fermented, notes) VALUES
  (134, 'krem pistacjowy', NULL, 'high', 0,
   'Przetwor: pasta pistacjowa z cukrem i olejem, ok. 570 kcal/100 g. Fruktany i GOS jak w pistacjach, ale dawka na lyzeczke kilkukrotnie mniejsza niz garsc orzechow.')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, group_id = excluded.group_id, fodmap = excluded.fodmap, notes = excluded.notes;

INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('krem pistacjowy', 134, '2026-08-12'),
  ('krem pistacjowy 10 g', 134, '2026-08-12'),
  ('pasta pistacjowa', 134, '2026-08-12'),
  ('precel', 120, '2026-08-12'),
  ('precel 80 g', 120, '2026-08-12'),
  ('precle', 120, '2026-08-12')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id;

INSERT INTO restrictions (food_id, level, reason, source, date_from, date_to, status, max_amount)
SELECT 134, 'limit',
  'Fruktany i GOS z pistacji, do tego cukier. Lyzeczka miesci sie w progu, lyzka to juz porcja orzechow zakazanych do 14.09',
  'Monash FODMAP, aplikacja 2026', '2026-08-12', '2026-09-14', 'active', 'łyżeczka dziennie'
WHERE NOT EXISTS (SELECT 1 FROM restrictions WHERE food_id = 134);

-- Posilki 70 i 71 weszly przed dodaniem aliasow, wiec ich powiazania trzeba
-- dopisac recznie. Bez tego oba zostalyby poza silnikiem wykluczen na zawsze.
INSERT INTO meal_foods (meal_id, food_id, amount_note)
SELECT 70, 134, '10 g' WHERE NOT EXISTS (SELECT 1 FROM meal_foods WHERE meal_id = 70 AND food_id = 134);
INSERT INTO meal_foods (meal_id, food_id, amount_note)
SELECT 71, 120, '80 g' WHERE NOT EXISTS (SELECT 1 FROM meal_foods WHERE meal_id = 71 AND food_id = 120);
