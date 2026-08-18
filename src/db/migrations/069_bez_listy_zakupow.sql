-- Lista zakupow usunieta w calosci. Decyzja Macka 18.08.2026: "bede kupowal,
-- po prostu patrzac na to, co powinienem dodatkowo jesc". Ekran /zakupy,
-- pozycja w nawigacji, przycisk "Do kupienia" przy brakach i sekcja w audycie
-- wylatuja razem z ta migracja; sekcja "czego brakuje" zostaje i to ona jest
-- odpowiedzia na pytanie, co dokupic.
--
-- W tabeli bylo 9 wierszy (4 otwarte) - tresc typu "kiwi", bez wartosci
-- historycznej. Odwracalne przez ponowne CREATE TABLE (definicja w historii
-- git schema.sql), dane przepadaja swiadomie.

DROP INDEX IF EXISTS idx_shopping_open;
DROP TABLE IF EXISTS shopping;
