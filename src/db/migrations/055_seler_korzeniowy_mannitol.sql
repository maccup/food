-- 055: seler korzeniowy, brakujaca regula mannitolowa
--
-- Wyszlo przy weryfikacji wtorku 18.08, ktory Maciej wybral sam. Seler
-- korzeniowy mial w bazie wylacznie regule 'prefer' (grupa Warzywa korzeniowe
-- gotowane, blonnik rozpuszczalny) i ani jednej reguly ograniczajacej, mimo ze
-- pole fodmap mowi 'moderate'. Silnik wykluczen przepuszczal go bez slowa,
-- a dokument hfood dwa razy wymienial zupe krem z selera 18.08 jako pozycje
-- FODMAP w linii sprzedawanej jako low FODMAP.
--
-- Monash: niska porcja to 75 g, powyzej rosnie mannitol. Regula 'prefer'
-- zostaje, bo dotyczy calej grupy i innego mechanizmu (blonnik rozpuszczalny
-- przy wolnym pasazu). Te dwie reguly nie stoja w sprzecznosci: seler jest
-- dobry w porcji i problematyczny w misce zupy.

INSERT INTO restrictions (food_id, level, reason, source, date_from, date_to, status, max_amount)
SELECT id, 'limit',
  'Mannitol powyzej porcji Monash. W zupie krem seler jest baza, a nie dodatkiem, wiec porcja idzie znacznie powyzej progu',
  'Monash FODMAP, uzupelnienie po weryfikacji 18.08.2026', '2026-08-16', '2026-09-14', 'active',
  '75 g, powyzej mannitol'
FROM foods WHERE name = 'seler korzeniowy';
