-- 062: przywrócenie zera laktozy do 14.09 włącznie + korekta końca wieczornych dawek antybiotyku.
--
-- Audyt 16.08 (migracja 054) zamienił zero laktozy z decyzji 09.08 (plan od zera, pkt 4.4)
-- na limity, nie flagując konfliktu. Decyzja Maćka 17.08: wraca zero laktozy do końca fazy
-- probiotycznej. Neomycyna obniża aktywność laktazy w rąbku szczoteczkowym, więc okno
-- po kursie 03-17.08 to najgorszy moment na laktozę. Reintrodukcja mleka od 15.09.
--
-- Mechanika: NOWE wiersze forbidden z datą końca, obok bezterminowych limitów Monash.
-- Limity zostają nietknięte i przejmują rolę z powrotem 15.09, gdy forbidden wygaśnie.
-- Mleko bez laktozy zostaje dozwolone: argument laktazowy go nie dotyczy, a klauzula
-- "dla prostoty reguły" z pkt 4.4 dotyczyła zakupów domowych, nie opłaconego cateringu.

INSERT INTO restrictions (id, food_id, group_id, level, reason, source, date_from, date_to, status, max_amount) VALUES
  (72, 44,  NULL, 'forbidden', 'Zero laktozy do 14.09 włącznie: neomycyna obniża laktazę, okno po kursie 03-17.08', 'Plan od zera pkt 4.4 (09.08); przywrócone 17.08 po audycie', '2026-08-17', '2026-09-14', 'active', NULL),
  (73, 131, NULL, 'forbidden', 'Zero laktozy do 14.09 włącznie: neomycyna obniża laktazę, okno po kursie 03-17.08', 'Plan od zera pkt 4.4 (09.08); przywrócone 17.08 po audycie', '2026-08-17', '2026-09-14', 'active', NULL),
  (74, 143, NULL, 'forbidden', 'Zero laktozy do 14.09 włącznie: neomycyna obniża laktazę, okno po kursie 03-17.08', 'Plan od zera pkt 4.4 (09.08); przywrócone 17.08 po audycie', '2026-08-17', '2026-09-14', 'active', NULL),
  (75, 149, NULL, 'forbidden', 'Zero laktozy do 14.09 włącznie: neomycyna obniża laktazę, okno po kursie 03-17.08', 'Plan od zera pkt 4.4 (09.08); przywrócone 17.08 po audycie', '2026-08-17', '2026-09-14', 'active', NULL),
  (76, 128, NULL, 'forbidden', 'Zero laktozy do 14.09 włącznie: neomycyna obniża laktazę, okno po kursie 03-17.08', 'Plan od zera pkt 4.4 (09.08); przywrócone 17.08 po audycie', '2026-08-17', '2026-09-14', 'active', NULL),
  (77, 155, NULL, 'forbidden', 'Zero laktozy do 14.09 włącznie: laktoza wymieniona w składzie jako osobny składnik', 'Plan od zera pkt 4.4 (09.08); przywrócone 17.08 po audycie', '2026-08-17', '2026-09-14', 'active', NULL),
  (78, 150, NULL, 'forbidden', 'Zero laktozy do 14.09 włącznie: baza z jogurtu krowiego', 'Plan od zera pkt 4.4 (09.08); przywrócone 17.08 po audycie', '2026-08-17', '2026-09-14', 'active', NULL);

-- Ostatnia dawka antybiotyków była 17.08 RANO (dawka 28 z 28). Wieczorne wiersze
-- z date_to = 17.08 pokazywałyby dziś wieczorem dawkę, której nie ma.
UPDATE supplement_schedule SET date_to = '2026-08-16' WHERE id IN (12, 13);
