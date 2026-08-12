-- 027: dane z Apple Watch, jeden wiersz na dobe
--
-- Dane wchodza WSADEM z recznego eksportu ze Zdrowia, nie synchronizacja. Bylo
-- to decyzja o prywatnosci: automat wymagalby oddania calego HealthKit obcej
-- aplikacji, a analiza i tak jest wsteczna, wiec czas rzeczywisty niczego nie
-- zmienia. Import jest idempotentny (upsert po dacie), wiec kolejny eksport
-- mozna wgrac na wierzch poprzedniego bez czyszczenia czegokolwiek.
--
-- Osobna tabela, nie kolumny w istniejacych. Zegarek mierzy dobe niezaleznie od
-- tego, czy tego dnia cokolwiek wpisales, wiec wiersz tu istnieje takze dla dni
-- bez posilkow. Doklejenie tego do `stress` zwiazaloby pomiar z samoocena i
-- kazdy dzien bez wpisu o stresie zgubilby HRV.
--
-- HRV trzymane dwa razy i to nie jest duplikat:
--   hrv_noc  mediana pomiarow z 00:00-08:00. To jest ta liczba, ktora cos znaczy,
--            bo w nocy nie ma ruchu, kawy ani rozmowy, wiec zostaje sam uklad
--            autonomiczny.
--   hrv      mediana z calej doby. Trzymana jako kontrola: gdy rozjezdza sie
--            mocno z nocna, to znaczy, ze dzien byl nierowny, a nie ze noc byla
--            zla.
-- Mediana, nie srednia, bo zegarek regularnie wypuszcza pojedynczy odczyt dwa
-- razy wyzszy od reszty i srednia z jedenastu pomiarow potrafi przez to skoczyc
-- o kilkanascie procent.
--
-- Sen przypisany do DNIA POBUDKI. Noc z 11 na 12 sierpnia to wiersz 12.08, bo
-- tego dnia chodzisz niewyspany, nie poprzedniego.

CREATE TABLE IF NOT EXISTS watch (
  date             TEXT PRIMARY KEY,
  hrv_noc          REAL,     -- mediana SDNN 00:00-08:00, ms
  hrv              REAL,     -- mediana SDNN z calej doby, ms
  hrv_pomiarow     INTEGER,  -- ile odczytow zlozylo sie na dobe, czyli jakosc danych
  rhr              INTEGER,  -- tetno spoczynkowe, uderzenia na minute
  sen_min          INTEGER,  -- sen glowny: gleboki + REM + lekki, bez wybudzen
  sen_gleboki_min  INTEGER,
  sen_rem_min      INTEGER,
  sen_budzenia_min INTEGER,
  zasniecie        TEXT,     -- HH:MM, poczatek pierwszej fazy snu
  temperatura      REAL,     -- nadgarstek podczas snu, stopnie Celsjusza
  oddech           REAL,     -- oddechow na minute
  spo2             REAL,     -- wysycenie tlenem, ulamek (0,97 to 97 procent)
  kroki            INTEGER,
  kcal_aktywne     INTEGER,
  min_ruchu        INTEGER,
  imported_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_watch_date ON watch(date);
