# Food App

Prywatna aplikacja do kontroli jedzenia, objawów i suplementów. Jeden użytkownik.
Produkcja: https://food.cupial.eu (domena podpieta 2026-08-09, certyfikat aktywny).
Adres zapasowy Cloudflare: https://food-55c.pages.dev

Kontekst medyczny, decyzje i narracja żyją w osobnym repo:
`~/Library/CloudStorage/GoogleDrive-maciej@cupial.eu/My Drive/Prywatne/Medycyna/Longevity Agent`.
**Ta baza trzyma zdarzenia i liczby, tamte pliki markdown trzymają wnioski.** Nie mieszać.

## Wdrożenia: bez pytania

**Skończoną zmianę wdrażaj od razu na produkcję. Nie pytaj o zgodę.** To stałe pozwolenie
Maćka z 11.08.2026 i dotyczy wyłącznie tego repozytorium. Globalna zasada „żadnego wdrożenia
bez wyraźnej zgody w bieżącej rozmowie" z `~/.claude/CLAUDE.md` obowiązuje wszędzie indziej
dalej, w szczególności w Calendesk.

Powód, dla którego to jest bezpieczne akurat tutaj: aplikacja ma jednego użytkownika, którym
jest właściciel repozytorium, nie obsługuje płatności ani cudzych danych, a wycofanie zmiany
to jeden `wrangler pages deployment` wstecz.

Co się przez to **nie** zmienia:

- Kolejność zostaje: `npx tsc --noEmit` bez nowych błędów, render lokalny na kopii produkcji,
  dopiero potem `npm run deploy`. „Bez pytania" znaczy bez pytania, nie bez sprawdzenia.
- Po wdrożeniu weryfikacja na żywym adresie, po zawartości, nie po tym, że polecenie
  nie krzyknęło.
- **Migracje bazy dalej idą przed wdrożeniem kodu** i dalej mają być odwracalne.
- Raport po fakcie mówi, co jest już na produkcji, a nie pyta, czy wysłać.

## Stack

| Warstwa | Technologia |
|---|---|
| Runtime | Cloudflare Pages (Functions + statyki), konto **Private** |
| Framework | Hono (TypeScript) |
| Baza | Cloudflare D1, `food`, id `3cb98a94-de79-47a1-a29b-52c559143d68` |
| Frontend | HTML renderowany na serwerze + HTMX, własny arkusz stylów |
| Auth | hasło, sesja na ciasteczku podpisanym HMAC, 7 dni |

Wzorzec skopiowany z `~/Projects/priv/training`. Obowiązują te same zasady:
bez SPA, bez Reacta, bez bundlera, widoki to funkcje TS zwracające stringi HTML,
system fonts, żadnych ozdobników. To narzędzie, nie portfolio.

**Framework7 został usunięty 2026-08-09.** To biblioteka do udawania natywnej
aplikacji na telefonie i to ona blokowała sensowny widok na dużym ekranie.
Klasy w widokach (`.card`, `.list`, `.block-title`, `.item-content`) zostały
te same, definiuje je teraz `public/css/food-theme.css`. Nie dodawać jej z powrotem.

## Nawigacja

Jedna lista `NAV` w `src/views/layout.ts` obsługuje trzy miejsca: pasek na telefonie,
menu boczne i ekran „Więcej".

| | Co |
|---|---|
| Górny pasek, każdy ekran | 🗓️ Kalendarz, 🚫 Wykluczenia, ⚙️ Ustawienia, 🌙 motyw |
| Pasek na telefonie (`tab: true`) | Dziś, Statystyki, Dopisz, Suple, **Więcej** |
| Za „Więcej" (`tab: false`) | Kalendarz, Zakupy, Wykluczenia, Ustawienia |
| Menu boczne od 1024 px | wszystko naraz, **bez** pozycji „Więcej" (`hub: true`) |

**Liczby kolumn nie ma w arkuszu.** Pasek to `grid-auto-flow: column` z `grid-auto-columns:
minmax(0, 1fr)`, więc bierze ją z długości `NAV`. Wcześniej stało tam `repeat(5, 1fr)` i każda
zmiana nawigacji wymagała pamiętania o drugim pliku.

Kolejność w pasku to **kolejność czytania dnia**: najpierw stan (Dziś), potem spojrzenie wstecz
(Statystyki), dopiero potem dwie akcje (Dopisz, Suple). **Kalendarza w pasku nie ma celowo**:
siedzi jako ikona w górnym pasku, więc jest pod ręką z każdego ekranu, nie tylko z dolnego.
Zakupy zeszły za „Więcej". Oba ustawienia na prośbę Maćka 11.08.2026.

Górny pasek mieści **cztery ikony po 44 px**, co na 402 px zostawia ok. 186 px na tytuł.
Najdłuższy nagłówek to pełna data („niedziela, 9.08.2026") i przy 19 px gubiła końcówkę roku,
dlatego poniżej 440 px tytuł schodzi do 17 px. Piąta ikona nie zmieści się bez zabrania
miejsca tytułowi albo zejścia poniżej progu dotyku.

### Wciecie na pasek stanu

**Metatag viewport nie ma `viewport-fit=cover` i nie wolno go tam wracać.** Ta wartość każe
stronie rysować się pod paskiem stanu telefonu i dopiero wtedy `env(safe-area-inset-top)`
zwraca jego wysokość. W zwykłej karcie przeglądarki nic z tego nie wynika: pasek stanu rysuje
przeglądarka, a strona dostawała ok. 65 px pustki nad nagłówkiem, która niczego nie zasłaniała.
Chrome na iOS pokazywał to najwyraźniej, Safari nie.

Warunek `@media (display-mode: standalone)` na `.topbar` był próbą obejścia i **nie zadziałał**,
naprawę robi dopiero usunięcie `cover`. Bez niego system sam odsuwa okno strony spod paska stanu,
a wszystkie `env(safe-area-inset-*)` zwracają zero. `apple-mobile-web-app-status-bar-style` idzie
z tym w parze na `default`, bo `black-translucent` ma sens wyłącznie przy `cover`.

## Statystyki

`/statystyki` zastąpiło `/week`, które liczyło na sztywno siedem dni wstecz. `/week`
przekierowuje, żeby nie psuć zakładek.

- Zakres siedzi w adresie (`?zakres=7|30|miesiac|rok` albo `?od=&do=`), więc da się go wysłać i zapisać.
- Filtr dat ma klasę `.stats-filtr`, nie siatkę w atrybucie `style`. `1fr` to `minmax(auto, 1fr)`,
  a natywne `input[type=date]` ma dużą szerokość minimalną: dwa pola plus przycisk rozpychały
  siatkę ponad szerokość ekranu i **rosła szerokość całej strony**, więc nagłówki sekcji, tabela
  makro i przycisk „Pokaż" wyjeżdżały poza prawą krawędź. Każda siatka z polem daty potrzebuje
  `minmax(0, 1fr)`.
- **Do 14 dni tabela idzie dzień po dniu, powyżej zwija się w tygodnie.** 365 wierszy nikt nie
  czyta, a średnia tygodniowa jest właściwą jednostką, bo reguły pokrycia grup są tygodniowe.
- **Pierwsza liczba na ekranie to kompletność danych** („2 z 4 dni"). Średnia z trzech dni wygląda
  identycznie jak średnia z trzydziestu, więc bez tej liczby reszta ekranu wprowadza w błąd.
- Przerwy liczy `statystykaPrzerw()` z `utils/gaps-stats.ts`, ta sama funkcja co widok dnia.
  **Grupowanie po dacie jest konieczne**: noc to najdłuższa przerwa doby i wliczona do średniej
  zakłamałaby ją całkowicie.

## Dlaczego kalendarz zaznacza dzień

Regułę koloru kratki liczy `utils/day-status.ts` i **korzystają z niej dwa ekrany**: kalendarz
zamienia jej wynik w kolor, widok dnia wypisuje go słowami w bloku „Dlaczego kalendarz to
zaznacza". Wcześniej reguła siedziała w pętli rysującej kratki, więc dawało się ją zobaczyć
wyłącznie jako kolor, a widok dnia liczył swoje paski według innego progu.

- **Kolor ustawiają tylko dwie rzeczy**: produkt z listy zakazanych (czerwony) oraz tłuszcz
  albo błonnik odchylone o **ponad 10 procent** od pasma fazy (żółty).
- **Kalendarz patrzy tylko na tłuszcz i błonnik** i to jest decyzja kliniczna: tłuszcz przy
  elastazie 151, błonnik przez obserwację, że więcej błonnika to twardszy stolec. Kalorie,
  białko i węgle mają paski na widoku dnia, ale koloru nie ruszają.
- **Limity nie kolorują dnia i nie mogą zacząć.** `v_restriction_breaches` zgłasza każde
  wystąpienie produktu z limitem, a nie przekroczenie limitu, więc kawa, banan czy surowa
  sałata pojawiają się prawie codziennie. Pomalowanie tego na żółto zrobiłoby żółty miesiąc.
  Blok na widoku dnia je wypisuje i mówi wprost, że koloru nie zmieniają.
- Limity są zbierane po produkcie („kawa, 2 razy"), zakazane rozbite po posiłku, bo przy
  limicie liczy się dzienna suma, a przy zakazanym to, który posiłek go przyniósł.
- **Karta na górze widoku dnia pokazuje oba powody**, nie sam czerwony. Miała wyłącznie pasek
  zakazanych składników, więc dzień żółty z powodu tłuszczu albo błonnika wyglądał w karcie
  na czysty (`warnToday` w `dashboard.ts`).
- **Próg jest jeden i liczy go `stanMakro()`.** Ten sam rachunek stał wcześniej osobno
  w pasku `macroBar`, w wielkich liczbach panelu i w kolorze kratki. Trzy kopie jednego progu
  to trzy okazje, żeby jedna zaczęła mówić co innego. Nie dopisywać czwartej.

## Kalendarz

Kratka niesie **kolor stanu, znak, kropkę i obwódkę** i każdy z nich odpowiada na inne pytanie.
Legenda musi tłumaczyć wszystkie cztery, inaczej ekran jest ładny i nieczytelny (tak było
do 11.08.2026: sześć kwadracików koloru wobec dziesięciu sygnałów w siatce).

- **Stany dnia stoją w tablicy `STANY` w `calendar.ts`**: klasa, znak i zdanie legendy razem.
  Znak („!", „×") idzie do HTML jako `<sup>`, nie do arkusza jako `content`, bo legenda
  musi pokazać dokładnie ten sam glif, a `content` nie da się odczytać z drugiego miejsca.
- **Próbka w legendzie jest miniaturą prawdziwej kratki**, ze znakiem w środku i obrysem
  `box-shadow: inset`. Kwadracik 11 px w kolorze `#dcfce7` był na jasnym tle niewidoczny,
  a obrys przez `border` zjadałby kreskowane ramki `.cal-plan` i `.cal-none`.
- **Jeden rodzaj kropki, jedno znaczenie**: wpis o objawie albo stolcu tego dnia. Czerwona
  kropka „coś zakazanego" została usunięta, bo powtarzała czerwone tło i znak „×", czyli
  ten sam fakt był na kratce trzy razy.
- Każda kratka ma `aria-label` ze złożonym opisem dnia, więc treść siatki da się przeczytać
  bez rozróżniania kolorów.

## Układ responsywny

Jeden HTML, dwa układy, decyduje CSS:

| Szerokość | Co się dzieje |
|---|---|
| do 768 px | jedna kolumna, dolna nawigacja z pozycjami `tab: true` |
| 768 do 1023 px | szersze marginesy, siatki dwukolumnowe, większe komórki kalendarza |
| od 1024 px | boczne menu ze wszystkimi pozycjami, dolny pasek znika, panel dzieli się na wiersze i kafelki, `.cols` układa sekcje obok siebie |

Klasa `.cols` to `auto-fit` z minimum 330 px, więc dwie sekcje zajmują całą
szerokość, a trzy podejścia do jedzenia trafiają w trzy kolumny. Nie wpisywać
tam sztywnej liczby kolumn.

**Konto Cloudflare podaje się przez `CLOUDFLARE_ACCOUNT_ID` w skryptach npm.**
Konfiguracja Pages nie przyjmuje `account_id`, a na tym profilu wrangler widzi
dwa konta i bez tego nic nie ruszy nieinteraktywnie.

## Model danych

```
phases ──< targets                     fazy protokołu i cele makro
food_groups ──< foods ──< food_aliases słownik i mapowanie składów z hfood
             └──< coverage_rules       ile dni w tygodniu dana grupa ma się pojawić
foods ──< restrictions                 wykluczenia, limity, preferencje
      └──< trials                      testowanie produktu przy rozszerzaniu
meals ──< meal_foods                   dziennik, powiązany ze słownikiem
symptoms, stools                       objawy
supplements ──< supplement_schedule ──< supplement_log
```

Widoki SQL są **jedynym** miejscem liczenia sum: `v_day_macros`, `v_day_totals`,
`v_group_coverage`, `v_restriction_breaches`, `v_day_vs_targets`. UI i eksport CSV
czytają z nich, żeby nie mogły się rozjechać. `v_day_totals` stoi na `v_day_macros`
i różni się od niego jednym warunkiem: bierze tylko posiłki zjedzone.

### Stan posiłku

`meals.stan` ma trzy wartości i to jest model, nie flaga:

| Stan | Znaczy | Liczy się do sum |
|---|---|---|
| `plan` | pudełko zamówione, dzień jeszcze nie nastąpił | nie |
| `zjedzony` | faktycznie zjedzone | tak, wszędzie |
| `pominiety` | pudełko przyszło, nie zjadł | nie |

Wcześniej była tu jedna flaga `eaten` i obsługiwała dwie różne rzeczy naraz.
Przy cateringu wpisanym na siedem dni naprzód każde ustawienie było złe:
`eaten = 1` kazało statystykom liczyć przyszłość jako przeżytą, `eaten = 0`
kasowało te dni z kalendarza. Migracja `019`. **Nie dokładać czwartej wartości
ani drugiej flagi obok**: jeśli pojawia się nowy przypadek, nazwać go stanem.

Kalendarz jest jedynym ekranem, który pokazuje `plan`: dzień z samym planem
dostaje `cal-plan` i kalorie z planu. Średnia miesiąca i „dni z wpisami"
liczą wyłącznie `zjedzony`.

### Rzeczy, które łatwo zepsuć

- `food_aliases.food_id IS NULL AND ignored = 0` to kolejka nierozpoznanych składników.
  Widać ją na `/restrictions`. **Bez niej silnik wykluczeń po cichu przepuszcza
  każdy nowy składnik z cateringu.** Po każdym imporcie sprawdzić, czy jest pusta.
- **Produkt bez ani jednego aliasu jest dla silnika wykluczeń niewidzialny.**
  Dopasowanie idzie wyłącznie przez `food_aliases`, nazwa z `foods` nie jest
  sprawdzana. 10.08.2026 okazało się, że 15 produktów zakazanych (czosnek, cebula,
  kalafior, szparagi, groszek i dalej) nie miało aliasu, więc nigdy nie mogły zostać
  zgłoszone. Każdy produkt ma teraz alias równy swojej nazwie. Po dodaniu produktu
  do `foods` dodać alias, inaczej wykluczenie jest martwe.
- Indeks `idx_meals_hfood` jest na `(date, slot)` bez `external_id`. Po wymianie
  dania w panelu identyfikator się zmienia, a import ma **nadpisać** wiersz, nie dołożyć drugi.
- Import nie rusza `stan`, `eaten_fraction` ani `notes` przy aktualizacji istniejącego
  wiersza. To wpisy użytkownika, nie dane z cateringu. Nowy wiersz na dzień z przyszłości
  dostaje `stan = 'plan'`, bo domyślne `zjedzony` byłoby wtedy kłamstwem.
- `estimated = 1` oznacza makra na oko. `kcal IS NULL` oznacza brak makr.
  `v_day_totals` liczy oba i pokazuje w UI, zamiast po cichu zaniżać sumy.
- Dni tygodnia w `supplement_schedule.days` dopasowuje się pełnym tokenem:
  `(',' || days || ',') LIKE ('%,' || :dzien || ',%')`. `LIKE '%pon%'` to pułapka.
- **`supplements.status` jest własnością aplikacji, nie seeda.** Wstrzymanie
  i wznowienie preparatu robi się listą na `/suplementy`, więc status w bazie
  jest zawsze nowszy niż w `seed.sql` i dlatego jest wyłączony z jego
  `ON CONFLICT DO UPDATE`. Wartości statusu w seedzie działają tylko przy
  pierwszym wstawieniu, czyli na pustej bazie. Bez tego wyłączenia `npm run db:seed`
  po cichu cofał decyzje kliniczne: pauza TMG, karczocha i Essentiale na czas
  antybiotyku wróciłaby do `active`, a nic w interfejsie by o tym nie powiedziało.
  `restrictions` w `seed-foods.sql` mają to samo wyłączenie od początku.
  Uwaga na resztę: pozostałe kolumny `supplements` oraz cały `supplement_schedule`
  seed **nadal nadpisuje**, a Ustawienia pozwalają je edytować. Zmianę dawki, pory
  albo okna zrobioną w interfejsie trzeba dopisać migracją i seedem, bo inaczej
  przepadnie przy najbliższym `db:seed`.
- **`status` i okno harmonogramu odpowiadają na dwa różne pytania. Nie mieszać ich.**
  `supplements.status` mówi, **czy preparat jest w protokole**.
  `supplement_schedule.date_from` i `date_to` mówią, **w jakim okresie się go bierze**.
  Zapytania w `day.ts` i `supplements.ts` sprawdzają jedno i drugie, więc preparat
  wchodzi na listę dnia tylko wtedy, gdy ma status inny niż `paused` i `discontinued`
  **oraz** dany dzień mieści się w oknie.
  - Chwilowe odstawienie to odpowiedź na pierwsze pytanie, więc siedzi **wyłącznie
    w `status`**. Okno zostaje bezterminowe. Wtedy powrót to jedno kliknięcie na
    `/suplementy` i nic więcej.
  - Okno domyka się tylko wtedy, gdy preparat ma **z góry znany koniec**: kurs
    antybiotyku do 17.08, probiotyk do 14.09, faza z inną dawką.
  - Okno przesuwa się w przód wtedy, gdy **data powrotu jest znana**, jak TMG od 18.08.
    Wtedy status zostaje `active`, bo preparat jest w protokole, tylko jeszcze nie teraz.
  - Bezterminowy wiersz przy statusie `paused` **nie jest wiszący**, bo status go gatuje.
    Zasada „nie zostawiaj wierszy bezterminowych" dotyczy okien z ustaloną datą końca,
    nie pauz. Domknięcie okna pauzą zamienia działający przełącznik w instrukcję obsługi.
- **`date_to` w `restrictions` to dzień włącznie.** `restrictions.ts` uznaje regułę
  za wygasłą dopiero przy `date_to < today`, a `v_restriction_breaches` łapie
  `m.date <= r.date_to`. Reguła, która ma przestać obowiązywać z początkiem nowej
  fazy, dostaje `date_to` równe **ostatniemu dniu fazy poprzedniej**, nie
  pierwszemu dniu nowej. Pomyłka o jeden dzień tu nie krzyczy, tylko trzyma
  pełną listę wykluczeń jeszcze jeden dzień.
- **Wiersz „Możesz zjeść" wiąże dwie godziny i mówi, która wygrała.** Pokazywał wyłącznie
  godzinę okna z ustawień, więc przy zjedzonym późno śniadaniu twierdził, że pora na obiad,
  choć przerwa jeszcze nie minęła, a użytkownik nie miał jak odróżnić schematu od rachunku.
  Bierze późniejszą z dwóch: okna z ustawień i „koniec ostatniego kęsa plus `min_gap_hours`".
  Drugi wiersz zawsze wypisuje powód. Koniec ostatniego podejścia liczy
  `koniecOstatniegoPodejscia()` z `utils/gaps-stats.ts`, ta sama funkcja i te same reguły
  progu kalorycznego co przerwy przy posiłkach, żeby dwie liczby nie mogły się rozjechać.
- **Przerwę przerywa napływ składników odżywczych, nie liczba kalorii.** `przerywaPrzerwe()`
  w `utils/gaps-stats.ts` ma **dwa progi i wystarczy przekroczyć jeden**: `gap_kcal_prog`
  (kalorie) albo `gap_makro_prog` (białko plus tłuszcz w gramach, domyślnie 1 g). To nie jest
  flaga obok flagi, tylko jedno pojęcie opisane dwiema wielkościami, bo sama kaloryka go nie
  opisuje: falę oczyszczającą gasi głównie tłuszcz i białko, przez hamulec jelitowy.
  Do 11.08.2026 stał tu sam próg kaloryczny i **aplikacja przeczyła własnemu opisowi**: kawa
  z 50 ml mleka ma 26 kcal, czyli poniżej progu 30, więc przechodziła jako neutralna, choć
  podpowiedź przy polu mówiła wprost, że kawa z mlekiem przerywa. Migracja 022.
  Warunek ma **jedną kopię**: czytają go `przerwyDnia`, `koniecOstatniegoPodejscia` i znacznik
  „nie przerywa przerwy" przy posiłku. Znacznik miał wcześniej wpisane na sztywno „30 kcal"
  i kłamał po każdej zmianie progu w Ustawieniach.
  Przerwy nie są nigdzie zapisane, liczą się przy każdym wyświetleniu, więc zmiana reguły
  przelicza też dni wsteczne. Nie ma tu migracji danych i nie wolno takiej dopisywać.
- **Przerwa dzieli podejścia, nie wiersze.** `przerwyDnia()` w `utils/gaps-stats.ts` grupuje
  posiłki po kolumnie `sitting` i liczy przerwę od końca ostatniego liczącego się posiłku
  poprzedniego podejścia. Deser i kawa po obiedzie to osobne pozycje w tym samym podejściu,
  więc nie mogą produkować przerwy zerowej z ostrzeżeniem. Wpisy poza podejściami
  (`sitting` 0 albo NULL) zostają osobnymi zdarzeniami, każdy z własnym kluczem.
  **Ta funkcja ma jedną kopię** i korzystają z niej widok dnia oraz statystyki: dwie
  implementacje rozjechałyby się przy pierwszej zmianie reguł, a to najważniejsza liczba w bazie.
- **Ustawienia mają grupy, nie jedną płaską listę.** `settings.grupa` decyduje,
  w którym zwijanym bloku pole się pojawi (`okna`, `przerwy`). Nowy klucz bez
  przypisania trafia do bloku „Pozostałe" i nie znika z ekranu.
- **Blok „Okna jedzenia" pokazuje rachunek, nie sam wynik.** Przy oknach 08:00 i 13:00 stało
  tam samo „4 h 30 ✓" i brakujące pół godziny wyglądało na błąd aplikacji. To `default_meal_min`:
  przerwa liczy się od **końca** posiłku. Każdy wiersz wypisuje teraz „08:00 plus 30 min,
  czyli koniec 08:30, do 13:00". Nagłówek bloku dostaje krótkie podsumowanie z osobnej funkcji
  `podsumowanieOkien()`, bo w `<summary>` mieści się jedna linia.
- **Godziny okien i próg przerwy muszą do siebie pasować, a to dwa niezależne pola.**
  Blok „Okna jedzenia" wylicza przerwy między oknami przy obecnym `default_meal_min`
  i oznacza te poniżej `min_gap_hours`. 09:00 / 14:00 / 18:30 mieści się w progu 4 h
  tylko przy posiłku 30-minutowym; przy 60 minutach druga przerwa spada do 3 h 30.
  To odczyt, nie blokada zapisu.

## Zamówienia cateringowe

`catering_orders`, jeden wiersz na zamówienie. Numery zamówienia i diety siedziały
wcześniej w `settings`, więc kolejne zamówienie nadpisywało poprzednie, a dni bez
dostawy były globalne, choć należą do konkretnego okresu.

- **Status wynika z dat**, nie z kolumny: `date_to < dziś` to zakończone,
  `date_from > dziś` to planowane, reszta to aktywne. Osobna flaga byłaby kolejnym
  polem do ręcznego przestawiania.
- **Dni bez dostawy czyta `loadNoDelivery()`** z `utils/settings.ts`, która skleja
  zakresy ze wszystkich zamówień. Parser zakresów (`parseNoDeliveryDates`) się nie zmienił.
- Numery zamówienia i diety są **notatką, nie konfiguracją**: import przyjmuje
  wklejony JSON i sam z nich nie korzysta. Służą do trafienia pod właściwy adres w panelu.

## Import z hfood

`POST /api/import/hfood` przyjmuje surowy JSON z panelu cateringu i robi całą
normalizację po stronie serwera. Krok w przeglądarce jest głupi: pobierz i prześlij dalej.

Panel: https://zamowienie.hfood.pl/panelklienta/moja-dieta (Angular na REST API)

```
GET  /api/orders/{orderId}                            deliveryDays z orderDayId
GET  /api/diets/dietetic-menu/order-diet/{orderDietId}?menuDateAsString=&orderDayId=
PUT  /api/diets/select-dish/{dishScheduleId}/order-day-meal/{orderDayMealId}
token: localStorage.cateringCustomerPanelAppData.token
```

Menu z wyborem publikuje się około 7 dni naprzód, wymiana zamyka się 2 dni przed
dostawą o 12:00. Dlatego przeglądu nie da się zrobić raz na cały okres,
trzeba wracać co tydzień. Kryteria doboru posiłków: patrz
`Diagnostyka/2026-08-09_hfood_low_fodmap_analiza.md` w repo Longevity Agent.

## Pusta godzina znaczy „teraz", ale tylko dzisiaj

`godzinaWpisu()` w `src/views/ui.ts` to jedyne miejsce, gdzie zapada ta decyzja.
Używają jej trzy trasy: `/log/meal`, `/log/symptom` i `/log/stool`. Wcześniej
każda z nich zapisywała `NULL`, więc stolec dopisany w biegu lądował w bazie bez
godziny i wypadał z porządku dnia (`ORDER BY COALESCE(time,'99:99')` spycha go
na koniec listy, niezależnie od tego, kiedy naprawdę był).

Zegar podstawia się **wyłącznie dla dnia dzisiejszego**. Przy wpisie wstecz
„teraz" nic nie znaczy i wpis dostałby godzinę, o której nic się nie wydarzyło,
więc tam nadal zostaje pusto. Zegar czyta się w strefie Europe/Warsaw, nie z UTC:
`created_at` w bazie jest w UTC i w sierpniu różni się o dwie godziny.

## Wpisywanie posiłków przez czat

Maciej często wrzuca w rozmowie zdjęcie menu albo opis tego, co zjadł, zamiast
wypełniać formularz. Wtedy:

1. **Oszacuj makra z typowych porcji**, nie z jego oceny. Sprawdzone 09.08:
   tłuszcz zaniżał pięciokrotnie, białko trzykrotnie. Jeśli lokal podaje
   białko na tablicy albo w menu, to jedyna twarda liczba, użyj jej.
2. **Skład wpisz dokładnie**, bo to po nim działają wykluczenia. Makra mogą
   być szacowane, skład nie.
3. **Gramatura idzie do składu, źródło liczb do `notes`.** Każdy składnik
   z wagą albo liczbą sztuk („pierś z kurczaka 140 g", „kiwi 75 g"), a w notatce
   skąd wzięły się makra i co przyjęto tam, gdzie nie było etykiety. Sprawdzian
   jest jeden: **czy z samego składu da się odtworzyć wpisane makra.** Audyt
   z 10.08 pokazał, że przy wpisach bez gramatury się nie da, a wtedy nie wiadomo
   ani czy liczba jest dobra, ani jak ją poprawić po nowych danych.
4. **Jeden posiłek to jedna pozycja, deser to druga.** Nie sklejać dania
   głównego z deserem ani z kawą w jeden wiersz, nawet gdy to samo podejście.
   Wspólne podejście oznacza się kolumną `sitting`, nie łączeniem nazw.
5. Zapisz przez `POST /log/meal` albo `POST /meal/:id` na produkcji.
6. **Sprawdź kolejkę nierozpoznanych składników.** Jeśli coś doszło, dopisz
   alias migracją, potem przepisz posiłek, żeby przeliczył powiązania.
7. **Jeśli pozycja się powtarza, zrób z niej szablon.** `npm run audit` ma
   sekcję „kandydaci na szablony": wszystko wpisane ręcznie dwa razy lub
   więcej, co nie ma jeszcze pozycji jednym dotknięciem. To jest ta lista
   do cyklicznego uzupełniania, nie trzeba jej pamiętać.

Szablony żyją w `meal_templates`, dodawanie jednym dotknięciem jest
w zakładce Dopisz, edycja w Ustawieniach. Wariantów nie skracamy:
„duże latte" i „małe latte" to dwie pozycje, bo różnią się o 55 kcal.

## Przegląd danych, uruchamiany na żądanie

Aplikacja nie ocenia, tylko zbiera. Ocenę robi Claude, na żądanie, hasłem
w rodzaju „zrób przegląd jedzenia" albo „sprawdź moje makra".

```bash
npm run audit            # ostatnie 14 dni, raport tekstowy
npm run audit -- 30      # inny zakres
npm run audit -- 14 json # surowe dane
```

`scripts/audit.mjs` wyciąga w jednym miejscu: sumy dzień po dniu z liczbą
posiłków szacowanych i bez makr, cele bieżącej fazy, pełne składy posiłków
wpisanych ręcznie, naruszenia wykluczeń, pokrycie grup wobec reguł,
składniki nierozpoznane przez słownik, odhaczone suplementy, objawy i stolce,
otwarte testy produktów i listę zakupów.

### Co z tym zrobić, kolejność

1. **Najpierw wiarygodność, potem ocena.** Kolumny `naOko` i `bezMakr` mówią,
   ile dnia jest zgadywane. Ocenianie makr dnia złożonego z szacunków jest
   ocenianiem szacunków. Posiłki wpisane ręcznie przeliczyć z typowych porcji
   i poprawić przez `/meal/:id/edit`.
2. **Kolejka nierozpoznanych składników.** Jeśli nie jest pusta, reguły
   pracują na niepełnym składzie i naruszenia są zaniżone. Dopisać aliasy
   migracją w `src/db/migrations/`, potem przepisać dotknięte posiłki, żeby
   przeliczyły powiązania.
3. **Naruszenia wykluczeń.** Zakazy przed limitami. Sprawdzić w repo
   „Longevity Agent", czy reguła nadal obowiązuje, bo część wygasa 15.09.
4. **Pokrycie grup.** Raport przelicza regułę tygodniową na zadany zakres.
5. **Suplementy i objawy.** Po decyzji z 09.08 o braku badań kontrolnych
   objawy i stolec są jedynym miernikiem skuteczności leczenia.

### Skąd brać oceny kliniczne

Nie z pamięci. Źródła w repo `Longevity Agent`:
`Konsultacje/2026-08-03_Sidor-Baginska_gastrolog.md` (leczenie, fazy, wykluczenia),
`Konsultacje/2026-05-21_Piotrowski.md` (cele makro),
`Diagnostyka/Dieta_obecna_ranking.md` (rankingi produktów),
`food_list.md` (czarna lista), `Diagnostyka/2026-08-09_hfood_low_fodmap_analiza.md`
(kryteria doboru posiłków).

**Współpraca z dietetykiem zakończona w sierpniu 2026.**
`Konsultacje/2026-05-21_Piotrowski.md` zostaje ważnym źródłem celów makro i tak
zostaje zapisany w `targets.source` oraz `supplements.source`, bo pochodzenie
liczby się nie zmienia. Nie ma natomiast nikogo, do kogo odsyła się otwarte
pytania dietetyczne, więc nie generować zadań w rodzaju „dopytać dietetyka".

## Komendy

```bash
npm run dev            # localhost:8789, lokalne D1
npm test               # testy parsera składów
npm run deploy         # Cloudflare Pages
npm run db:schema      # schemat na zdalne D1
npm run db:seed        # dane startowe i słownik produktów
npm run export         # 7 plików CSV do Longevity Agent/CSV_Analysis
```

Migracje SQL: `src/db/migrations/`, uruchamiane ręcznie przez
`wrangler d1 execute food --remote --file=...`. Wariant `--file` bywa odrzucany
przez API (błąd uwierzytelnienia 10000), wtedy treść migracji idzie w `--command`.

**Wdrożenia tej aplikacji nie wymagają pytania.** Decyzja Maćka z 10.08.2026:
„wdrażaj, nie pytaj, odpowiadasz za poprawne działanie produkcji". Dotyczy wyłącznie
tego repozytorium, globalna zasada „żadnego wdrożenia bez zgody" obowiązuje wszędzie
indziej bez zmian. Warunek jest jeden i twardy: **każde wdrożenie sprawdzone na żywym
adresie**, nie w logach i nie na kodzie. Migracja bazy idzie zaraz po wdrożeniu kodu,
nie przed, bo stary kod pracuje do przełączenia deploymentu i wtedy przerwa jest
sekundowa zamiast kilkudziesięciosekundowej.

Hasło: `wrangler pages secret put PASSWORD --project-name=food` oraz `.dev.vars` lokalnie.

## Uwaga o lokalnym D1

`wrangler d1 execute --local` i `wrangler pages dev` trafiają w tę samą bazę
tylko wtedy, gdy `--d1=DB=<database_id>`, nie `--d1=DB=food`. Wrangler kluczuje
lokalne bazy po identyfikatorze, nie po nazwie. Skrypt `dev` ma to już poprawnie.
