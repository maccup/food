# Health Sync: aplikacja iOS

Czyta Apple Health na telefonie i wysyła dobowe podsumowania do `/api/watch`
w tej samej aplikacji, która trzyma dziennik jedzenia. Dane idą **telefon →
Twój worker → Twoja baza D1**. Żadnej firmy trzeciej po drodze.

Jeden ekran, jeden przycisk **Synchronizuj**, do klikania raz dziennie.
Nie ma odczytu w tle i to jest decyzja, nie brak: odczyt w tle milknie po
wymuszonym zamknięciu aplikacji i nie działa, dopóki telefon nie zostanie raz
odblokowany po restarcie, więc dokładałby dwa ciche tryby awarii do listy poniżej.

## Pierwsze uruchomienie

```bash
cd ios
xcodegen generate        # tworzy HealthSync.xcodeproj z project.yml
open HealthSync.xcodeproj
```

W Xcode:

1. Zakładka **Signing & Capabilities**, zespół MPR.

   Jeżeli status pokaże **„Failed Registering Bundle Identifier"**, automat Xcode
   nie potrafi utworzyć wpisu i trzeba go zrobić ręcznie w portalu Apple:
   Identifiers → **+** → App IDs → App, Description bez polskich znaków,
   Bundle ID **Explicit** równy `PRODUCT_BUNDLE_IDENTIFIER` z `project.yml`,
   z uprawnień zaznaczone **wyłącznie HealthKit**. Potem w Xcode **Try Again**.

   Komunikat mówi „identifier not available", więc wygląda na zajętą nazwę,
   ale zmiana nazwy nic nie daje. Problem jest po stronie rejestracji, nie nazwy.
2. Podłącz iPhone, wybierz go jako cel, **Run**.
3. Na telefonie: Ustawienia → Ogólne → VPN i zarządzanie urządzeniem, zaufaj profilowi.
4. W aplikacji ikona koła zębatego, wklej token z sekretu `WATCH_TOKEN`.
5. **Synchronizuj**. iOS zapyta o zgody Health, zaznacz wszystko.

`.xcodeproj` **nie jest w repo**, bo to artefakt generowany z `project.yml`.
Po każdym pobraniu zmian uruchom `xcodegen generate` ponownie.

Ikona powstaje z `zrodlo-ikony.svg` (poza katalogiem źródeł, żeby nie wylądowała
w gotowej aplikacji). Po zmianie:

```bash
rsvg-convert -w 1024 -h 1024 zrodlo-ikony.svg -o HealthSync/Assets.xcassets/AppIcon.appiconset/ikona1024.png
```

## Przypomnienie

Ustawienia → Przypominaj codziennie, domyślnie 9:00. Sen domyka się dopiero po
pobudce i dojeżdża z zegarka z opóźnieniem, więc wcześniejsza godzina wysyłałaby
niepełną dobę.

Nie ma jednego powtarzalnego wyzwalacza, tylko **14 pojedynczych przypomnień**
planowanych naprzód. Powtarzalny przypominałby także w dniu, w którym
synchronizacja już się odbyła, a powiadomienie o rzeczy zrobionej uczy ignorować
powiadomienia. Po każdej udanej synchronizacji cały zestaw jest przestawiany
i dzisiejszy dzień wypada.

**Świadome ograniczenie:** aplikacja nieotwierana przez 14 dni przestaje
przypominać. Od tego jest drugi czujnik, niezależny od telefonu: panel webowy
pokazuje „Zegarek nie synchronizowany od N dni".

Stopka w ustawieniach podaje, ile przypomnień faktycznie czeka w kolejce iOS.
Zero przy włączonym przełączniku znaczy, że zgoda została cofnięta w systemie.

## Skąd biorą się liczby

Cała agregacja siedzi w `CzytnikZdrowia.swift` i musi dawać **identyczne wyniki
co `scripts/import-watch.mjs`**, który parsuje eksport XML. Historia w bazie
(3838 dni) pochodzi z tamtego kanału i rozjazd wyglądałby jak zmiana w organizmie,
a nie jak zmiana metody. Trzy reguły przepisane stamtąd co do joty:

| Reguła | Dlaczego |
|---|---|
| **Mediana, nie średnia** | Zegarek regularnie wypuszcza pojedynczy odczyt dwa razy wyższy od reszty. Średnia z kilkunastu pomiarów skacze przez to o kilkanaście procent |
| **Sumy per źródło, brane maksimum** | iPhone w kieszeni i zegarek na ręku liczą te same kroki równolegle. Zsumowanie daje niemal podwójny wynik |
| **Sen do dnia pobudki** | Noc z 11 na 12 sierpnia to wiersz 12.08, bo tego dnia chodzisz niewyspany |

HRV nocne (`hrv_noc`) to mediana z odczytów przed 8:00. W nocy nie ma ruchu,
kawy ani rozmowy, więc zostaje sam układ autonomiczny i dopiero ta liczba jest
porównywalna między dobami.

## Medytacja

Dni bez praktyki zapisują się jako **0, nie NULL**, dla każdej doby w oknie.
NULL znaczy „nie wiem", a wtedy porównanie „dni z praktyką kontra bez" nie ma
grupy kontrolnej i mierzenie tego traci sens.

## Scalanie, nie nadpisywanie

Serwer wstawia każdą kolumnę przez `COALESCE(excluded.x, watch.x)`. HealthKit
oddaje mniej historii niż plik eksportu, więc zwykłe nadpisanie kasowałoby
starsze dane przy każdej synchronizacji.

**Konsekwencja do zapamiętania:** błędnej wartości nie da się wyzerować,
wysyłając null. Do poprawki trzeba `UPDATE` ręcznie.

Kolumna `zrodlo` mówi, co zapisało wiersz: `export` albo `ios`.

## Okno kroczące

Domyślnie wysyłane jest **30 dni wstecz**, nie „od ostatniej synchronizacji".
Zegarek dosyła pomiary z opóźnieniem, a sen potrafi dojechać po południu.
Wysyłanie samego wczoraj gubiłoby te dosyłki bezpowrotnie. Zapis jest
idempotentny, więc powtórka nic nie kosztuje.

## Gdy przestanie działać

Wszystkie trzy awarie dają ten sam objaw: **ciszę, nie błąd**.

1. **Certyfikat wygasa po roku.** Aplikacja przestaje się otwierać. Podłącz telefon, Run.
2. **Cofnięta zgoda HealthKit.** Dziennik pokaże `0 probek` przy każdej metryce.
   Ustawienia → Prywatność → Zdrowie → Health Sync.
3. **Zmieniony token.** Dziennik pokaże `401: Zly token`.

Dlatego panel w aplikacji webowej pokazuje **„Zegarek nie synchronizowany od N dni"**,
gdy ostatnia doba w bazie jest starsza niż wczorajsza.

Dziennik na ekranie loguje liczbę próbek dla każdej metryki osobno, kod odpowiedzi
serwera i pełną treść odpowiedzi. Przycisk **Kopiuj** wrzuca całość do schowka.
Przy każdym problemie to jest pierwsza rzecz do przysłania.

## Co zbiera

Mediana z doby: HRV (dobowe i nocne), tętno spoczynkowe, oddech, SpO2,
temperatura nadgarstka, VO2max, waga, tętno marszowe, cardio recovery,
tkanka tłuszczowa, masa beztłuszczowa, ciśnienie.

Maksimum ze źródeł: kroki, kalorie aktywne i podstawowe, minuty ruchu,
dystans, piętra, czas w świetle dziennym.

Reszta: fazy snu i czas w łóżku, godzina zaśnięcia, tętno średnie i maksymalne,
godziny ze wstaniem, medytacja, treningi (liczba, minuty, kalorie).
