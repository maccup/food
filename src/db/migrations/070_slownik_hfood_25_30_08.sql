-- Slownik po imporcie hfood 25-30.08 (przeglad 18.08.2026): 25 skladnikow
-- w kolejce nierozpoznanych. Produkty istotne dostaja wiersz w foods i alias,
-- mieszanki przypraw o nieznanym skladzie (pasta curry, przyprawa gyros)
-- dodatkowo limit do konca low FODMAP, bo gotowe mieszanki zwykle zawieraja
-- czosnek i cebule, a catering skladu mieszanki nie publikuje.
-- Przyprawy i artefakty parsera ida na ignored = 1.
-- Odwracalne: DELETE nowych id, UPDATE aliasow z powrotem na NULL.

INSERT INTO foods (id, name, group_id, fodmap, fodmap_note, fermented, histamine, fiber_type, processed_meat, refined_oil, notes) VALUES
  (167, 'brama (ryba)',            5, 'low',  NULL, 0, 'low',      'none',      0, 0, 'Filet bez skory z cateringu hfood; ryba chuda, liczy sie do grupy ryb'),
  (168, 'pasta curry',          NULL, 'high', 'gotowa mieszanka, zwykle czosnek i szalotka', 0, 'low', 'none', 0, 0, 'Sklad cateringu nieznany'),
  (169, 'przyprawa gyros',      NULL, 'high', 'mieszanka, zwykle czosnek i cebula w proszku', 0, 'low', 'none', 0, 0, 'Sklad cateringu nieznany'),
  (170, 'olej kokosowy',          19, 'low',  NULL, 0, 'low',      'none',      0, 1, 'Tluszcz nasycony; w cateringu ilosci deserowe'),
  (171, 'tortilla kukurydziana',  11, 'low',  NULL, 0, 'low',      'none',      0, 0, NULL),
  (172, 'mąka kukurydziana',      11, 'low',  NULL, 0, 'low',      'none',      0, 0, NULL),
  (173, 'mąka uniwersalna bezglutenowa', 11, 'low', NULL, 0, 'low', 'none',     0, 0, 'Nazwa cateringu; w daniach [BG] to mieszanka bezglutenowa'),
  (174, 'pomarańcza',           NULL, 'low',  NULL, 0, 'low',      'soluble',   0, 0, 'Cytrus, low FODMAP w porcji'),
  (175, 'kapusta pekińska',       17, 'low',  'lagodniejsza niz biala', 0, 'low', 'insoluble', 0, 0, NULL)
ON CONFLICT(id) DO NOTHING;

-- Mieszanki przypraw: limit do konca low FODMAP, bo czosnku w nich nie widac,
-- ale zwykle w nich jest. Pojedyncze wystapienie ma byc widoczne na liscie
-- naruszen, zeby dalo sie powiazac z ewentualnymi wzdeciami.
INSERT INTO restrictions (id, food_id, group_id, level, reason, source, date_from, date_to, status, max_amount) VALUES
  (79, 168, NULL, 'limit', 'Gotowa pasta curry: zwykle czosnek i szalotka, skladu catering nie publikuje', 'przeglad hfood 18.08.2026', '2026-08-18', '2026-09-14', 'active', 'sporadycznie, obserwowac wzdecia'),
  (80, 169, NULL, 'limit', 'Przyprawa gyros: zwykle czosnek i cebula w proszku, skladu catering nie publikuje', 'przeglad hfood 18.08.2026', '2026-08-18', '2026-09-14', 'active', 'sporadycznie, obserwowac wzdecia')
ON CONFLICT(id) DO NOTHING;

-- Mapowania kolejki nierozpoznanych (wiersze juz istnieja z food_id NULL).
UPDATE food_aliases SET food_id = 1   WHERE alias = 'marchewka mini';
UPDATE food_aliases SET food_id = 170 WHERE alias = 'olej kokosowy';
UPDATE food_aliases SET food_id = 167 WHERE alias = 'ryba brama filet bez skóry';
UPDATE food_aliases SET food_id = 77  WHERE alias = 'chipsy kokosowe';
UPDATE food_aliases SET food_id = 175 WHERE alias = 'kapusta pekińska';
UPDATE food_aliases SET food_id = 119 WHERE alias = 'kiełki rzodkiewki';
UPDATE food_aliases SET food_id = 23  WHERE alias = 'mięso z kurczaka';
UPDATE food_aliases SET food_id = 172 WHERE alias = 'mąka kukurydziana';
UPDATE food_aliases SET food_id = 51  WHERE alias = 'mąka owsiana bezgluteniwa';
UPDATE food_aliases SET food_id = 173 WHERE alias = 'mąka uniwersalna';
UPDATE food_aliases SET food_id = 151 WHERE alias = 'młoda kapusta biała';
UPDATE food_aliases SET food_id = 61  WHERE alias = 'olej roślinny';
UPDATE food_aliases SET food_id = 168 WHERE alias = 'pasta curry';
UPDATE food_aliases SET food_id = 55  WHERE alias = 'pieczywo chrupkie bezglutenowe';
UPDATE food_aliases SET food_id = 174 WHERE alias = 'pomarańcza';
UPDATE food_aliases SET food_id = 11  WHERE alias = 'pomidory krojone';
UPDATE food_aliases SET food_id = 169 WHERE alias = 'przyprawa gyros';
UPDATE food_aliases SET food_id = 171 WHERE alias = 'tortilla kukurydziana';

-- Przyprawy, dodatki techniczne i artefakty parsera.
UPDATE food_aliases SET ignored = 1 WHERE alias IN
  ('kolendra suszona', 'baza z białka roślinnego', 'błonnik owsiany',
   'drożdze piekarskie', 'suche', 'limonka', 'liść lubczyku suszony');
