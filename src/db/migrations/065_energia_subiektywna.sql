-- Subiektywna ocena naladowania baterii, do konfrontacji z algorytmem
-- z utils/bateria.ts. Prosba Macka z 17.08.2026: "moglibysmy to konfrontowac
-- pomiedzy algorytmem a subiektywna ocena".
--
-- Jeden wiersz na dobe, jak stress: ocena dotyczy dnia, nie chwili, a zapis
-- jest upsertem, wiec poprawka nadpisuje zamiast dokladac. Skala 0 do 10,
-- ta sama co stress.level i symptoms.severity, zeby liczby na jednym ekranie
-- znaczyly to samo. Algorytm mowi w procentach, porownanie mnozy ocene
-- przez 10 i to jest jedyne miejsce tego przelicznika.
--
-- Tabela tylko dodaje sie do schematu, wiec migracja idzie PRZED kodem.
-- Odwracalne: DROP TABLE energy.

CREATE TABLE IF NOT EXISTS energy (
  date       TEXT PRIMARY KEY,
  level      INTEGER NOT NULL,   -- 0 do 10, ta sama skala co stress.level
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (level BETWEEN 0 AND 10)
);
