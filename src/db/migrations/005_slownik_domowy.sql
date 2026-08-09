-- 2026-08-09
-- Słownik produktów zbudowany był ze składów cateringu, więc znał tylko jego
-- słownictwo. Pierwsze dwa posiłki wpisane ręcznie pokazały lukę: z jedenastu
-- składników aplikacja rozpoznała jeden.
--
-- Najpoważniejsze przeoczenie: **kimchi**, produkt fermentowany wykluczony
-- do 15.09, przeszło bez ostrzeżenia w trakcie antybiotykoterapii.
--
-- Kolejka nierozpoznanych składników zadziałała dokładnie tak, jak miała:
-- pokazała, czego brakuje, zamiast po cichu przepuścić.

PRAGMA foreign_keys = ON;

-- Produkty, których nie było w menu cateringu, a pojawiają się w domu
-- i w restauracji.
INSERT INTO foods (id, name, group_id, fodmap, fodmap_note, fermented, histamine, fiber_type, processed_meat, refined_oil, notes) VALUES
  (117, 'figi',           12, 'high',     'fruktany i fruktoza', 0, 'low',      'mixed',     0, 0, 'Suszone są znacznie gorsze niż świeże. Dwie sztuki to już wyraźna dawka'),
  (118, 'dżem',           NULL,'high',    'fruktoza',            0, 'low',      'none',      0, 0, '"70% owoców" znaczy tylko tyle, że cukier pochodzi z zagęszczonych owoców'),
  (119, 'kiełki',         20, 'low',      NULL,                  0, 'moderate', 'insoluble', 0, 0, 'Surowe. W tym okresie forma jest problemem, nie sam produkt'),
  (120, 'croissant',      11, 'high',     'fruktany',            0, 'low',      'mixed',     0, 0, 'Pszenica plus ok. 14 g tłuszczu na sztukę'),
  (121, 'makaron pszenny',11, 'high',     'fruktany',            0, 'low',      'mixed',     0, 0, 'Makaron w ramenie i pierogach azjatyckich jest pszenny, nie bezglutenowy'),
  (122, 'wieprzowina chashu', 3, 'low',   NULL,                  0, 'high',     'none',      0, 0, 'Ramen: ok. 20 do 25 g tłuszczu w porcji z chashu')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, group_id = excluded.group_id, fodmap = excluded.fodmap,
  fodmap_note = excluded.fodmap_note, fermented = excluded.fermented,
  histamine = excluded.histamine, fiber_type = excluded.fiber_type, notes = excluded.notes;

-- Mapowanie słownictwa domowego i restauracyjnego na produkty kanoniczne.
INSERT INTO food_aliases (alias, food_id, ignored) VALUES
  ('jajko', 28, 0), ('jajka', 28, 0),
  ('skyr', 44, 0),
  ('płatki owsiane', 51, 0), ('owsianka', 51, 0),
  ('kimchi', 103, 0),
  ('kostka czekolady 85%', 107, 0), ('czekolada 85%', 107, 0), ('czekolada gorzka 85%', 107, 0),
  ('bulion', 111, 0),
  ('figi', 117, 0), ('figi x2', 117, 0), ('figa', 117, 0),
  ('dżem', 118, 0), ('dżem 70%', 118, 0), ('dzem', 118, 0),
  ('kiełki', 119, 0), ('kielki', 119, 0),
  ('croissant', 120, 0), ('rogalik', 120, 0),
  ('gyoza', 120, 0), ('gyoza z kurczakiem', 120, 0), ('goyza', 120, 0),
  ('ramen', 121, 0), ('makaron pszenny', 121, 0),
  ('chashu', 122, 0), ('wieprzowina chashu', 122, 0),
  ('masło', 65, 0), ('maslo', 65, 0),
  ('kurczak', 23, 0), ('indyk', 24, 0), ('wołowina', 26, 0), ('wolowina', 26, 0),
  ('kawa', 106, 0), ('oliwa', 60, 0), ('imbir świeży', 110, 0),
  ('kiwi zielone', 85, 0), ('kiwi', 85, 0),
  ('szpinak', 8, 0), ('jarmuż', 10, 0), ('natka pietruszki', 9, 0),
  ('ryż biały', 45, 0), ('ryż basmati', 45, 0), ('ryż jaśminowy', 45, 0)
ON CONFLICT(alias) DO UPDATE SET food_id = excluded.food_id, ignored = excluded.ignored;

-- Nowe wykluczenia i limity dla tych produktów.
INSERT INTO restrictions (id, food_id, group_id, level, reason, source, date_from, date_to, status, max_amount) VALUES
  (40, 117, NULL, 'forbidden', 'Fruktany plus fruktoza. Suszone figi to jedno z mocniejszych źródeł objawów', 'Monash, kategoria wysokich FODMAP', '2026-08-03', '2026-09-15', 'active', NULL),
  (41, 118, NULL, 'limit',     'Cukier z zagęszczonych owoców to nadal fruktoza niewchłonięta w jelicie cienkim', 'Dieta_obecna_ranking.md ranking C', '2026-08-03', NULL, 'active', 'łyżeczka, nie łyżka'),
  (42, 119, NULL, 'forbidden', 'Surowe. Ranking C wymienia kiełki wprost, chodzi o formę w tym okresie', 'Dieta_obecna_ranking.md ranking C', '2026-08-03', '2026-09-15', 'active', NULL),
  (43, 120, NULL, 'forbidden', 'Pszenica. Do tego ok. 14 g tłuszczu na sztukę przy elastazie 151', 'food_list.md, czarna lista', '2026-08-03', NULL, 'active', NULL),
  (44, 121, NULL, 'forbidden', 'Pszenica, fruktany', 'food_list.md, czarna lista', '2026-08-03', NULL, 'active', NULL)
ON CONFLICT(id) DO UPDATE SET
  food_id = excluded.food_id, level = excluded.level, reason = excluded.reason,
  source = excluded.source, date_from = excluded.date_from, date_to = excluded.date_to,
  max_amount = excluded.max_amount;
