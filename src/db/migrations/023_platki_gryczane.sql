-- 2026-08-11
-- Platki gryczane jako osobny produkt, nie „kasza gryczana".
--
-- Maciek je od 10.08 platki gryczane Sielanoczka („chlopja greczniewyje",
-- niewymagajace gotowania, opakowanie 400 g, etykieta ze zdjecia z 11.08),
-- a wpisy mowily „kasza gryczana", bo platkow nie bylo w slowniku. To nie
-- kosmetyka nazwy: platki sa rozgniecione i wstepnie obrobione termicznie,
-- wiec skrobia jest bardziej zelatynizowana i odpowiedz glikemiczna wyzsza
-- niz z calej kaszy. Przy fazie antybiotykowej to rozroznienie ma znaczenie.
--
-- Kalorycznie prawie to samo (330 kcal/100 g suchych wobec 343 dla kaszy),
-- wiec korekta makr w istniejacych wpisach jest w granicach szumu szacowania.
-- FODMAP niski, tak jak kasza gryczana, prog Monash to okolo 100 g ugotowanych.

INSERT INTO foods (id, name, group_id, fodmap, fermented, notes) VALUES
  (132, 'płatki gryczane', 11, 'low', 0,
   'Sielanoczka, „хлопья гречневые", niewymagające gotowania, opakowanie 400 g. Etykieta ze zdjęcia 11.08.2026: 330 kcal/100 g suchych, B 12,6, T 3,3, W 60,4, błonnik 10. Zalewane wrzątkiem 1 część płatków na 2 części wody, po ugotowaniu około 110 kcal/100 g. Jedna czubata łyżka ugotowanych to około 30 g, czyli około 10 g suchych.')
ON CONFLICT(id) DO UPDATE SET name = excluded.name, group_id = excluded.group_id, fodmap = excluded.fodmap, notes = excluded.notes;

INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('płatki gryczane', 132, '2026-08-10'),
  ('platki gryczane', 132, '2026-08-10'),
  ('płatki gryczane niewymagające gotowania', 132, '2026-08-10'),
  ('хлопья гречневые', 132, '2026-08-11')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id;

-- Wpis z 10.08 zostawil nierozpoznany alias, bo produkt nie istnial. Teraz istnieje.
UPDATE food_aliases SET food_id = 132 WHERE alias = 'kasza gryczana ugotowana 125 g';
