-- 046: ananas jako produkt slownikowy
--
-- Wyszedl z kolejki nierozpoznanych przy imporcie 15.08: jest w jaglance
-- kokosowo-migdalowej (19.08 sniadanie) i w granoli z 18.08. Bez wiersza
-- w foods silnik wykluczen go nie widzi, wiec dzien wyglada na czysty,
-- choc nikt tego owocu nie sprawdzil.
--
-- Grupa NULL, tak jak banan i melon: owoc spoza kategorii pokrycia tygodniowego.
--
-- Monash: swiezy ananas niski FODMAP do ok. 140 g na porcje, powyzej rosnie
-- fruktoza. W skladach cateringu jest zwyklym skladnikiem deseru, wiec porcja
-- miesci sie w progu. Bez ograniczenia, bo takiej decyzji nie bylo, ale
-- histamina 'moderate': ananas jest liberatorem histaminy, a to jest watek
-- otwarty od eozynofilii 9,9% z 08.2026.
--
-- food_list.md dopuszcza go wprost ("tylko swiezy, bromelaina"). Suszony
-- i w syropie to inna pozycja i gdyby sie pojawil, wymaga osobnego wiersza.

INSERT INTO foods (id, name, group_id, fodmap, fodmap_note, fermented, histamine, fiber_type, processed_meat, refined_oil, notes) VALUES
  (157, 'ananas', NULL, 'low', NULL, 0, 'moderate', 'mixed', 0, 0,
   'Swiezy niski FODMAP do ok. 140 g (Monash), powyzej fruktoza. Bromelaina. Liberator histaminy')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, fodmap = excluded.fodmap, histamine = excluded.histamine, notes = excluded.notes;

INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('ananas', 157, '2026-08-15')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id;
