-- 039: czekolada mleczna merci
--
-- Osobny wiersz, nie alias do 130 (czekolada gorzka 85%), i to nie jest
-- pedanteria: gorzka nie ma zadnego ograniczenia, wiec podpiecie merci pod nia
-- zrobiloby z tego produktu pozycje NIEWIDZIALNA dla silnika wykluczen.
-- To dwa rozne produkty: gorzka ma 46 g tluszczu i sladowy cukier, merci ma
-- 44 g cukru i LAKTOZE wymieniona jako osobny skladnik, obok mleka pelnego
-- w proszku 16,7 procent i maslanki w proszku.
--
-- Makra z etykiety, na 100 g: 570 kcal, T 37,4 (nasycone 16,7), W 47,0
-- (cukry 44,3), B 9,8, sol 0,15. Blonnika producent nie podaje.
--
-- LIMIT, nie zakaz, i porcja jest w nim nazwana. W 25 g laktozy jest rzedu
-- 2 do 3 g, czyli ponizej progu Monash, wiec zakaz bylby nieproporcjonalny.
-- Problemem robi sie dopiero tabliczka, nie dwie kostki.

INSERT INTO foods (id, name, group_id, fodmap, fermented, notes) VALUES
  (155, 'czekolada mleczna merci', NULL, 'moderate', 0,
   'Storck, 570 kcal/100 g, T 37,4, W 47 (cukry 44,3), B 9,8. Laktoza jako osobny skladnik plus mleko pelne w proszku 16,7 i maslanka. Orzechy laskowe 15, migdaly 5')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, fodmap = excluded.fodmap, notes = excluded.notes;

INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('czekolada mleczna merci', 155, '2026-08-13'),
  ('merci', 155, '2026-08-13'),
  ('czekolada mleczna', 155, '2026-08-13')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id;

INSERT INTO restrictions (food_id, level, reason, source, date_from, date_to, status, max_amount)
SELECT 155, 'limit',
  'Laktoza wymieniona jako osobny skladnik, obok mleka w proszku. W 25 g to ok. 2 do 3 g, czyli ponizej progu Monash, ale tabliczka juz nie',
  'Etykieta produktu, decyzja 13.08.2026', '2026-08-13', NULL, 'active', '25 g, czyli dwie kostki'
WHERE NOT EXISTS (SELECT 1 FROM restrictions WHERE food_id = 155);
