# Food App

Prywatna aplikacja do kontroli jedzenia, objawów i suplementów. Jeden użytkownik.
Produkcja: https://food.cupial.eu (fallback: https://food-55c.pages.dev)

Kontekst medyczny, decyzje i narracja żyją w osobnym repo:
`~/Library/CloudStorage/GoogleDrive-maciej@cupial.eu/My Drive/Prywatne/Medycyna/Longevity Agent`.
**Ta baza trzyma zdarzenia i liczby, tamte pliki markdown trzymają wnioski.** Nie mieszać.

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

## Układ responsywny

Jeden HTML, dwa układy, decyduje CSS:

| Szerokość | Co się dzieje |
|---|---|
| do 768 px | jedna kolumna, dolna nawigacja z 5 pozycjami |
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

Widoki SQL są **jedynym** miejscem liczenia sum: `v_day_totals`, `v_group_coverage`,
`v_restriction_breaches`, `v_day_vs_targets`. UI i eksport CSV czytają z nich,
żeby nie mogły się rozjechać.

### Rzeczy, które łatwo zepsuć

- `food_aliases.food_id IS NULL AND ignored = 0` to kolejka nierozpoznanych składników.
  Widać ją na `/restrictions`. **Bez niej silnik wykluczeń po cichu przepuszcza
  każdy nowy składnik z cateringu.** Po każdym imporcie sprawdzić, czy jest pusta.
- Indeks `idx_meals_hfood` jest na `(date, slot)` bez `external_id`. Po wymianie
  dania w panelu identyfikator się zmienia, a import ma **nadpisać** wiersz, nie dołożyć drugi.
- Import nie rusza `eaten`, `eaten_fraction` ani `notes`. To wpisy użytkownika,
  nie dane z cateringu.
- `estimated = 1` oznacza makra na oko. `kcal IS NULL` oznacza brak makr.
  `v_day_totals` liczy oba i pokazuje w UI, zamiast po cichu zaniżać sumy.
- Dni tygodnia w `supplement_schedule.days` dopasowuje się pełnym tokenem:
  `(',' || days || ',') LIKE ('%,' || :dzien || ',%')`. `LIKE '%pon%'` to pułapka.

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
`wrangler d1 execute food --remote --file=...`.

Hasło: `wrangler pages secret put PASSWORD --project-name=food` oraz `.dev.vars` lokalnie.

## Uwaga o lokalnym D1

`wrangler d1 execute --local` i `wrangler pages dev` trafiają w tę samą bazę
tylko wtedy, gdy `--d1=DB=<database_id>`, nie `--d1=DB=food`. Wrangler kluczuje
lokalne bazy po identyfikatorze, nie po nazwie. Skrypt `dev` ma to już poprawnie.
