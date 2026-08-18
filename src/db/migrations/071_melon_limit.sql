-- Melon: limit do konca low FODMAP. Dokumentacja mowila o nim od 17.08
-- ("II sniadanie z melonem lepiej pominac albo zjesc bez melona", kalendarz
-- decyzji w stan_aktualny), ale slownik nie mial reguly, wiec silnik milczal
-- i danie z melonem przeszlo przeglad bez flagi (wykryte 18.08 przy 27.08).
-- Odwracalne: DELETE FROM restrictions WHERE id = 81.

INSERT INTO restrictions (id, food_id, group_id, level, reason, source, date_from, date_to, status, max_amount) VALUES
  (81, 87, NULL, 'limit', 'Wysokie FODMAP (fruktoza, fruktany rosnace z dojrzaloscia); catering wsadza go do satatek owocowych mimo linii low FODMAP', 'Diagnostyka/2026-08-09_hfood_low_fodmap_analiza.md, sekcja 2 i kalendarz decyzji 19.08', '2026-08-18', '2026-09-14', 'active', 'pomijac na talerzu albo do 90 g')
ON CONFLICT(id) DO NOTHING;
