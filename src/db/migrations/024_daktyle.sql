-- 2026-08-11
-- Daktyle do slownika, z limitem na czas fazy antybiotykowej.
--
-- Monash: daktyl suszony jest wysoko FODMAP juz przy 2 sztukach, fruktany
-- plus nadmiar fruktozy nad glukoza. Jedna sztuka miesci sie w progu niskim,
-- wiec to limit, nie zakaz: sensowny deser na jeden kes, zly jako przekaska
-- „garsc daktyli". Limit wygasa razem z reszta ograniczen fazy, 14.09.2026.
--
-- Bez grupy pokryciowej: daktyl to cukier z blonnikiem, nie zrodlo, ktore
-- ma sie pojawiac w tygodniowej normie jak jagody czy warzywa lisciaste.

INSERT INTO foods (id, name, group_id, fodmap, fermented, notes) VALUES
  (133, 'daktyle', NULL, 'high', 0,
   'Medjool jedna sztuka to około 24 g miąższu, 66 kcal, W 15,0 prawie w całości cukry, błonnik 1,6. Odmiana deglet noor jest mniejsza, około 8 g. Monash: 1 sztuka niska, od 2 sztuk wysoko FODMAP (fruktany plus nadmiar fruktozy nad glukozą).')
ON CONFLICT(id) DO UPDATE SET name = excluded.name, fodmap = excluded.fodmap, notes = excluded.notes;

INSERT INTO food_aliases (alias, food_id, first_seen) VALUES
  ('daktyle', 133, '2026-08-11'),
  ('daktyl', 133, '2026-08-11'),
  ('daktyl z migdałem', 133, '2026-08-11')
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id;

INSERT INTO restrictions (food_id, level, reason, source, date_from, date_to, status, max_amount)
SELECT 133, 'limit',
  'Fruktany plus nadmiar fruktozy nad glukozą. Jedna sztuka mieści się w progu Monash, dwie już nie',
  'Monash FODMAP, aplikacja 2026', '2026-08-11', '2026-09-14', 'active', '1 sztuka dziennie'
WHERE NOT EXISTS (SELECT 1 FROM restrictions WHERE food_id = 133);
