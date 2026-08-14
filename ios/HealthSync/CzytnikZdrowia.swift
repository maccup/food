import Foundation
import HealthKit

/// Pojedyncza sesja treningowa z rodzajem. Bez rodzaju plan treningowy nie ma
/// z czego policzyc, czy w tym tygodniu byla juz sila, a wiekszosc zapisanych
/// „treningow" to spacery.
struct TreningWyslany {
    let data: String
    let start: String
    let typ: String
    let minuty: Double
    let kcal: Double?

    func slownik() -> [String: Any] {
        var s: [String: Any] = ["date": data, "start": start, "typ": typ, "minuty": minuty]
        if let k = kcal { s["kcal"] = k }
        return s
    }
}

/// Jedna doba gotowa do wyslania. Klucze odpowiadaja kolumnom tabeli `watch`.
struct Dzien {
    let data: String
    var pola: [String: Double] = [:]
    /// Godzina zasniecia jako HH:MM. Jedyne pole tekstowe.
    var zasniecie: String?

    func slownik() -> [String: Any] {
        var s: [String: Any] = ["date": data]
        for (k, v) in pola { s[k] = v }
        if let z = zasniecie { s["zasniecie"] = z }
        return s
    }
}

/// Odczyt z HealthKit i skladanie dobowych podsumowan.
///
/// ZASADA NADRZEDNA: te liczby musza wychodzic identycznie jak ze skryptu
/// `scripts/import-watch.mjs`, ktory parsuje eksport XML. Historia w bazie
/// pochodzi z tamtego kanalu i gdyby aplikacja liczyla inaczej, wykres
/// rozjechalby sie dokladnie w dniu przejscia z jednego zrodla na drugie,
/// a wygladaloby to jak zmiana w organizmie. Stad trzy reguly przepisane
/// stamtad co do joty:
///
/// 1. MEDIANA, nie srednia. Zegarek regularnie wypuszcza pojedynczy odczyt
///    dwa razy wyzszy od reszty i srednia z kilkunastu pomiarow skacze przez
///    to o kilkanascie procent.
/// 2. Sumy dobowe zbierane OSOBNO DLA KAZDEGO ZRODLA, a na koncu brane
///    MAKSIMUM, nie suma. iPhone w kieszeni i zegarek na regu licza te same
///    kroki rownolegle, wiec zsumowanie daje niemal podwojony wynik.
/// 3. Sen przypisany do DNIA POBUDKI, czyli po dacie KONCA odcinka.
final class CzytnikZdrowia {
    private let store = HKHealthStore()
    private let kalendarz = Calendar.current

    // MARK: - Definicje metryk

    /// Pomiary usredniane mediana po dobie.
    private static let mediana: [(HKQuantityTypeIdentifier, String, HKUnit, Int)] = [
        (.heartRateVariabilitySDNN, "hrv", .secondUnit(with: .milli), 1),
        (.restingHeartRate, "rhr", tetno, 0),
        (.respiratoryRate, "oddech", tetno, 1),
        (.oxygenSaturation, "spo2", .percent(), 3),
        (.appleSleepingWristTemperature, "temperatura", .degreeCelsius(), 2),
        // Dwie cyfry, nie jedna: historia z eksportu XML ma 64.54, a nie 64.5,
        // i przy jednej cyfrze co drugi dzien rozjezdzal sie na styku kanalow.
        (.vo2Max, "vo2max", HKUnit(from: "ml/kg*min"), 2),
        (.bodyMass, "waga", .gramUnit(with: .kilo), 1),
        (.walkingHeartRateAverage, "tetno_marsz", tetno, 0),
        (.heartRateRecoveryOneMinute, "cardio_recovery", tetno, 1),
        (.bodyFatPercentage, "tkanka_tluszczowa", .percent(), 3),
        (.leanBodyMass, "masa_beztluszczowa", .gramUnit(with: .kilo), 1),
        (.bloodPressureSystolic, "cisnienie_sys", .millimeterOfMercury(), 0),
        (.bloodPressureDiastolic, "cisnienie_dia", .millimeterOfMercury(), 0),
    ]

    /// Sumy dobowe: zbierane per zrodlo, brane maksimum.
    private static let sumy: [(HKQuantityTypeIdentifier, String, HKUnit, Int)] = [
        (.stepCount, "kroki", .count(), 0),
        (.activeEnergyBurned, "kcal_aktywne", .kilocalorie(), 0),
        (.basalEnergyBurned, "kcal_bazowe", .kilocalorie(), 0),
        (.appleExerciseTime, "min_ruchu", .minute(), 0),
        (.distanceWalkingRunning, "dystans_km", .meterUnit(with: .kilo), 2),
        (.flightsClimbed, "pietra", .count(), 0),
        (.timeInDaylight, "swiatlo_min", .minute(), 0),
    ]

    private static let tetno = HKUnit.count().unitDivided(by: .minute())

    /// Wszystko, o co prosimy o zgode. Zgoda na odczyt jest per typ i brak
    /// jednego typu nie blokuje pozostalych, wiec lista moze byc szeroka.
    private var typyDoOdczytu: Set<HKObjectType> {
        var t = Set<HKObjectType>()
        for (id, _, _, _) in Self.mediana + Self.sumy {
            if let q = HKQuantityType.quantityType(forIdentifier: id) { t.insert(q) }
        }
        if let hr = HKQuantityType.quantityType(forIdentifier: .heartRate) { t.insert(hr) }
        for id in [HKCategoryTypeIdentifier.sleepAnalysis, .mindfulSession, .appleStandHour] {
            if let c = HKCategoryType.categoryType(forIdentifier: id) { t.insert(c) }
        }
        t.insert(HKObjectType.workoutType())
        return t
    }

    // MARK: - Zgody

    func poprosOZgode() async throws {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw Blad.brakHealthKit
        }
        try await store.requestAuthorization(toShare: [], read: typyDoOdczytu)
    }

    enum Blad: LocalizedError {
        case brakHealthKit
        case brakTypu(String)

        var errorDescription: String? {
            switch self {
            case .brakHealthKit:
                return "To urzadzenie nie udostepnia Apple Health"
            case .brakTypu(let t):
                return "System nie zna typu \(t), prawdopodobnie za stara wersja iOS"
            }
        }
    }

    // MARK: - Zbieranie

    func zbierz(dniWstecz: Int, log: @escaping (String, Dziennik.Waga) -> Void)
        async -> (dni: [Dzien], sesje: [TreningWyslany]) {
        var sesje: [TreningWyslany] = []
        let dzisPoczatek = kalendarz.startOfDay(for: Date())
        guard let od = kalendarz.date(byAdding: .day, value: -(dniWstecz - 1), to: dzisPoczatek),
              let doKonca = kalendarz.date(byAdding: .day, value: 1, to: dzisPoczatek) else {
            log("Nie udalo sie policzyc zakresu dat", .blad)
            return ([], [])
        }

        var dni: [String: Dzien] = [:]
        for i in 0..<dniWstecz {
            if let d = kalendarz.date(byAdding: .day, value: i, to: od) {
                let klucz = Self.klucz(d)
                dni[klucz] = Dzien(data: klucz)
            }
        }

        let okres = HKQuery.predicateForSamples(withStart: od, end: doKonca, options: [.strictStartDate])

        // 1. Mediany
        for (id, kolumna, jednostka, cyfry) in Self.mediana {
            guard let typ = HKQuantityType.quantityType(forIdentifier: id) else {
                log("Pominieto \(kolumna): system nie zna tego typu", .uwaga)
                continue
            }
            do {
                let probki = try await probkiIlosciowe(typ: typ, predykat: okres)
                var poDniach: [String: [Double]] = [:]
                var nocne: [String: [Double]] = [:]
                for p in probki {
                    let k = Self.klucz(p.startDate)
                    let v = p.quantity.doubleValue(for: jednostka)
                    poDniach[k, default: []].append(v)
                    // HRV nocne osobno: w nocy nie ma ruchu, kawy ani rozmowy,
                    // wiec zostaje sam uklad autonomiczny i dopiero ta liczba
                    // jest porownywalna miedzy dobami.
                    if kolumna == "hrv", kalendarz.component(.hour, from: p.startDate) < 8 {
                        nocne[k, default: []].append(v)
                    }
                }
                for (k, wartosci) in poDniach {
                    guard dni[k] != nil, let m = Self.mediana(wartosci) else { continue }
                    dni[k]?.pola[kolumna] = Self.zaokr(m, cyfry)
                    if kolumna == "hrv" {
                        dni[k]?.pola["hrv_pomiarow"] = Double(wartosci.count)
                    }
                }
                for (k, wartosci) in nocne {
                    guard dni[k] != nil, let m = Self.mediana(wartosci) else { continue }
                    dni[k]?.pola["hrv_noc"] = Self.zaokr(m, cyfry)
                }
                log("\(kolumna): \(probki.count) probek, \(poDniach.count) dni", probki.isEmpty ? .uwaga : .ok)
            } catch {
                /*
                 * „Authorization not determined" to nie awaria, tylko typ, na
                 * ktory nikt nie odpowiedzial w oknie zgod, bo nie ma z czego
                 * czytac (cisnienie: zero pomiarow w calej historii). Bez tego
                 * rozroznienia dziennik pokazywalby dwa czerwone bledy przy
                 * kazdej synchronizacji i przestalbys je czytac.
                 */
                let nieokreslone = (error as NSError).code == HKError.errorAuthorizationNotDetermined.rawValue
                log("\(kolumna): \(nieokreslone ? "brak zgody, pewnie brak danych tego typu" : "BLAD zapytania, \(error.localizedDescription)")",
                    nieokreslone ? .uwaga : .blad)
            }
        }

        // 2. Sumy dobowe, maksimum ze zrodel
        for (id, kolumna, jednostka, cyfry) in Self.sumy {
            guard let typ = HKQuantityType.quantityType(forIdentifier: id) else {
                log("Pominieto \(kolumna): system nie zna tego typu", .uwaga)
                continue
            }
            do {
                let poDniach = try await sumyPerZrodlo(typ: typ, od: od, doKonca: doKonca,
                                                       jednostka: jednostka)
                for (k, najwyzsza) in poDniach {
                    guard dni[k] != nil else { continue }
                    dni[k]?.pola[kolumna] = Self.zaokr(najwyzsza, cyfry)
                }
                log("\(kolumna): \(poDniach.count) dni", poDniach.isEmpty ? .uwaga : .ok)
            } catch {
                log("\(kolumna): BLAD zapytania, \(error.localizedDescription)", .blad)
            }
        }

        // 3. Tetno srednie i maksymalne
        if let typ = HKQuantityType.quantityType(forIdentifier: .heartRate) {
            do {
                let probki = try await probkiIlosciowe(typ: typ, predykat: okres)
                var poDniach: [String: [Double]] = [:]
                for p in probki {
                    poDniach[Self.klucz(p.startDate), default: []].append(p.quantity.doubleValue(for: Self.tetno))
                }
                for (k, w) in poDniach where dni[k] != nil && !w.isEmpty {
                    dni[k]?.pola["tetno_srednie"] = Self.zaokr(w.reduce(0, +) / Double(w.count), 0)
                    dni[k]?.pola["tetno_max"] = Self.zaokr(w.max() ?? 0, 0)
                }
                log("tetno: \(probki.count) probek, \(poDniach.count) dni", probki.isEmpty ? .uwaga : .ok)
            } catch {
                log("tetno: BLAD zapytania, \(error.localizedDescription)", .blad)
            }
        }

        // 4. Sen
        if let typ = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) {
            do {
                let probki = try await probkiKategorii(typ: typ, predykat: okres)
                /*
                 * Fazy zbierane OSOBNO DLA KAZDEGO ZRODLA, a na koncu brane
                 * jedno, tak samo jak przy sumach dobowych. Dwa urzadzenia
                 * opisujace te sama noc wlasnymi fazami dawaly po zsumowaniu
                 * noce po czternascie godzin. Scalanie przedzialow nie pomaga,
                 * bo te same minuty jedno zrodlo nazywa lekkim snem, a drugie
                 * glebokim.
                 */
                var poZrodlach: [String: [String: [String: Double]]] = [:]
                var zasnieciaZrodel: [String: [String: Date]] = [:]
                for p in probki {
                    // Doba snu przypisana do dnia POBUDKI, czyli po dacie konca.
                    let k = Self.klucz(p.endDate)
                    let minuty = p.endDate.timeIntervalSince(p.startDate) / 60
                    guard minuty > 0 else { continue }
                    guard let faza = Self.fazaSnu(p.value) else { continue }
                    let zrodlo = p.sourceRevision.source.name
                    poZrodlach[k, default: [:]][zrodlo, default: [:]][faza, default: 0] += minuty
                    if faza != "budzenia" && faza != "lozko" {
                        let dotychczas = zasnieciaZrodel[k]?[zrodlo]
                        if dotychczas == nil || p.startDate < dotychczas! {
                            zasnieciaZrodel[k, default: [:]][zrodlo] = p.startDate
                        }
                    }
                }

                var fazy: [String: [String: Double]] = [:]
                var zasniecia: [String: Date] = [:]
                for (k, zrodla) in poZrodlach {
                    guard let najlepsze = zrodla.max(by: {
                        Self.senWlasciwy($0.value) < Self.senWlasciwy($1.value)
                    }) else { continue }
                    fazy[k] = najlepsze.value
                    zasniecia[k] = zasnieciaZrodel[k]?[najlepsze.key]
                }

                for (k, f) in fazy where dni[k] != nil {
                    let glowny = Self.senWlasciwy(f)
                    if glowny > 0 { dni[k]?.pola["sen_min"] = Self.zaokr(glowny, 0) }
                    if let v = f["gleboki"] { dni[k]?.pola["sen_gleboki_min"] = Self.zaokr(v, 0) }
                    if let v = f["rem"] { dni[k]?.pola["sen_rem_min"] = Self.zaokr(v, 0) }
                    if let v = f["budzenia"] { dni[k]?.pola["sen_budzenia_min"] = Self.zaokr(v, 0) }
                    if let v = f["lozko"] { dni[k]?.pola["sen_lozko_min"] = Self.zaokr(v, 0) }
                    if let z = zasniecia[k] { dni[k]?.zasniecie = Self.godzina(z) }
                }
                log("sen: \(probki.count) odcinkow, \(fazy.count) nocy", probki.isEmpty ? .uwaga : .ok)
            } catch {
                log("sen: BLAD zapytania, \(error.localizedDescription)", .blad)
            }
        }

        // 5. Medytacja.
        //
        // Zero zapisujemy JAWNIE dla kazdej doby w oknie. Gdyby dzien bez
        // praktyki zostawal pusty, baza nie odroznilaby „nie medytowal" od
        // „nie wiem", a wtedy porownanie dni z praktyka i bez nie ma grupy
        // kontrolnej i cale mierzenie tego jest bez sensu.
        if let typ = HKCategoryType.categoryType(forIdentifier: .mindfulSession) {
            do {
                let probki = try await probkiKategorii(typ: typ, predykat: okres)
                for k in dni.keys {
                    dni[k]?.pola["medytacja_min"] = 0
                    dni[k]?.pola["medytacja_sesji"] = 0
                }
                var laczne = 0.0
                for p in probki {
                    let k = Self.klucz(p.startDate)
                    guard dni[k] != nil else { continue }
                    let minuty = p.endDate.timeIntervalSince(p.startDate) / 60
                    guard minuty > 0 else { continue }
                    dni[k]?.pola["medytacja_min", default: 0] += minuty
                    dni[k]?.pola["medytacja_sesji", default: 0] += 1
                    laczne += minuty
                }
                for k in dni.keys {
                    if let v = dni[k]?.pola["medytacja_min"] {
                        dni[k]?.pola["medytacja_min"] = Self.zaokr(v, 0)
                    }
                }
                log("medytacja: \(probki.count) sesji, \(Int(laczne)) min lacznie", .ok)
            } catch {
                log("medytacja: BLAD zapytania, \(error.localizedDescription)", .blad)
            }
        }

        // 6. Godziny ze wstaniem
        if let typ = HKCategoryType.categoryType(forIdentifier: .appleStandHour) {
            do {
                let probki = try await probkiKategorii(typ: typ, predykat: okres)
                var poDniach: [String: Double] = [:]
                for p in probki where p.value == HKCategoryValueAppleStandHour.stood.rawValue {
                    poDniach[Self.klucz(p.startDate), default: 0] += 1
                }
                for (k, v) in poDniach where dni[k] != nil {
                    dni[k]?.pola["stanie_h"] = v
                }
                log("stanie: \(poDniach.count) dni", poDniach.isEmpty ? .uwaga : .ok)
            } catch {
                log("stanie: BLAD zapytania, \(error.localizedDescription)", .blad)
            }
        }

        // 7. Treningi
        do {
            let treningi = try await treningi(predykat: okres)
            var liczba: [String: Double] = [:]
            var minuty: [String: Double] = [:]
            var kcal: [String: Double] = [:]
            for t in treningi {
                let k = Self.klucz(t.startDate)
                liczba[k, default: 0] += 1
                minuty[k, default: 0] += t.duration / 60
                let spalone = t.statistics(for: HKQuantityType(.activeEnergyBurned))?
                    .sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0
                kcal[k, default: 0] += spalone
            }
            for (k, v) in liczba where dni[k] != nil {
                dni[k]?.pola["treningi"] = v
                dni[k]?.pola["trening_min"] = Self.zaokr(minuty[k] ?? 0, 0)
                if let c = kcal[k], c > 0 { dni[k]?.pola["trening_kcal"] = Self.zaokr(c, 0) }
            }

            // Kazda sesja osobno, z rodzajem. Sumy dobowe wyzej zostaja,
            // bo odpowiadaja na inne pytanie: ile bylo, a nie czego.
            sesje = treningi.compactMap { t in
                let typ = Self.nazwaTypu(t.workoutActivityType)
                guard !typ.isEmpty else { return nil }
                return TreningWyslany(
                    data: Self.klucz(t.startDate),
                    start: Self.godzina(t.startDate),
                    typ: typ,
                    minuty: Self.zaokr(t.duration / 60, 1),
                    kcal: t.statistics(for: HKQuantityType(.activeEnergyBurned))?
                        .sumQuantity()?.doubleValue(for: .kilocalorie()).rounded()
                )
            }
            log("treningi: \(treningi.count) w oknie, \(liczba.count) dni, \(sesje.count) z rodzajem", .ok)
        } catch {
            log("treningi: BLAD zapytania, \(error.localizedDescription)", .blad)
        }

        return (dni.values.sorted { $0.data < $1.data }, sesje)
    }

    // MARK: - Zapytania

    private func probkiIlosciowe(typ: HKQuantityType, predykat: NSPredicate) async throws -> [HKQuantitySample] {
        try await withCheckedThrowingContinuation { dalej in
            let q = HKSampleQuery(sampleType: typ, predicate: predykat,
                                  limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, wynik, blad in
                if let blad { dalej.resume(throwing: blad); return }
                dalej.resume(returning: (wynik as? [HKQuantitySample]) ?? [])
            }
            store.execute(q)
        }
    }

    private func probkiKategorii(typ: HKCategoryType, predykat: NSPredicate) async throws -> [HKCategorySample] {
        try await withCheckedThrowingContinuation { dalej in
            let q = HKSampleQuery(sampleType: typ, predicate: predykat,
                                  limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, wynik, blad in
                if let blad { dalej.resume(throwing: blad); return }
                dalej.resume(returning: (wynik as? [HKCategorySample]) ?? [])
            }
            store.execute(q)
        }
    }

    private func treningi(predykat: NSPredicate) async throws -> [HKWorkout] {
        try await withCheckedThrowingContinuation { dalej in
            let q = HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: predykat,
                                  limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, wynik, blad in
                if let blad { dalej.resume(throwing: blad); return }
                dalej.resume(returning: (wynik as? [HKWorkout]) ?? [])
            }
            store.execute(q)
        }
    }

    /// Suma dobowa per zrodlo, zwracane maksimum. Patrz regula 2 w naglowku.
    private func sumyPerZrodlo(typ: HKQuantityType, od: Date, doKonca: Date,
                               jednostka: HKUnit) async throws -> [String: Double] {
        try await withCheckedThrowingContinuation { dalej in
            let predykat = HKQuery.predicateForSamples(withStart: od, end: doKonca,
                                                       options: [.strictStartDate])
            let q = HKStatisticsCollectionQuery(
                quantityType: typ,
                quantitySamplePredicate: predykat,
                options: [.cumulativeSum, .separateBySource],
                anchorDate: kalendarz.startOfDay(for: od),
                intervalComponents: DateComponents(day: 1)
            )
            q.initialResultsHandler = { [weak self] _, kolekcja, blad in
                guard let self else { dalej.resume(returning: [:]); return }
                if let blad { dalej.resume(throwing: blad); return }
                guard let kolekcja else { dalej.resume(returning: [:]); return }

                var wynik: [String: Double] = [:]
                kolekcja.enumerateStatistics(from: od, to: doKonca) { statystyka, _ in
                    guard let zrodla = statystyka.sources, !zrodla.isEmpty else { return }
                    var najwyzsza = 0.0
                    for z in zrodla {
                        let v = statystyka.sumQuantity(for: z)?.doubleValue(for: jednostka) ?? 0
                        najwyzsza = max(najwyzsza, v)
                    }
                    guard najwyzsza > 0 else { return }
                    wynik[Self.klucz(statystyka.startDate)] = najwyzsza
                }
                dalej.resume(returning: wynik)
            }
            store.execute(q)
        }
    }

    // MARK: - Pomocnicze

    private static let kluczFormat: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    private static let godzinaFormat: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    /*
     * Nazwy MUSZA byc takie same jak w eksporcie XML, czyli nazwa przypadku
     * HKWorkoutActivityType bez przedrostka. Klasyfikacja na sile, cardio
     * i reszte siedzi po stronie serwera i dopasowuje sie wlasnie do tych
     * napisow, wiec inna pisownia oznacza cichy trening bez kategorii.
     * Switch zamiast tablicy z surowymi numerami: kompilator sprawdza nazwy,
     * a numery trzeba byloby przepisac z dokumentacji i uwierzyc.
     */
    private static func nazwaTypu(_ t: HKWorkoutActivityType) -> String {
        switch t {
        case .traditionalStrengthTraining: return "TraditionalStrengthTraining"
        case .functionalStrengthTraining: return "FunctionalStrengthTraining"
        case .coreTraining: return "CoreTraining"
        case .highIntensityIntervalTraining: return "HighIntensityIntervalTraining"
        case .running: return "Running"
        case .cycling: return "Cycling"
        case .swimming: return "Swimming"
        case .rowing: return "Rowing"
        case .elliptical: return "Elliptical"
        case .stairClimbing: return "StairClimbing"
        case .stairs: return "Stairs"
        case .mixedCardio: return "MixedCardio"
        case .crossTraining: return "CrossTraining"
        case .hiking: return "Hiking"
        case .tennis: return "Tennis"
        case .walking: return "Walking"
        case .yoga: return "Yoga"
        case .mindAndBody: return "MindAndBody"
        case .pilates: return "Pilates"
        case .flexibility: return "Flexibility"
        case .cooldown: return "Cooldown"
        case .underwaterDiving: return "UnderwaterDiving"
        default: return "Other"
        }
    }

    private static func klucz(_ d: Date) -> String { kluczFormat.string(from: d) }
    private static func godzina(_ d: Date) -> String { godzinaFormat.string(from: d) }

    private static func mediana(_ w: [Double]) -> Double? {
        guard !w.isEmpty else { return nil }
        let s = w.sorted()
        let p = Double(s.count - 1) / 2
        return (s[Int(p.rounded(.down))] + s[Int(p.rounded(.up))]) / 2
    }

    private static func zaokr(_ v: Double, _ cyfry: Int) -> Double {
        let m = pow(10.0, Double(cyfry))
        return (v * m).rounded() / m
    }

    private static func fazaSnu(_ wartosc: Int) -> String? {
        switch HKCategoryValueSleepAnalysis(rawValue: wartosc) {
        case .asleepDeep: return "gleboki"
        case .asleepREM: return "rem"
        case .asleepCore: return "lekki"
        /*
         * NIE jest to synonim lekkiego snu. Oura zapisuje asleepUnspecified
         * jako parasol nad tymi samymi minutami, ktore osobno opisuje jako
         * Core i Deep, wiec doliczenie go do reszty liczy je podwojnie:
         * na tym polegly 707 z 1739 nocy w bazie, pokazujac ponad 11 godzin.
         * Zarazem dla starszych zapisow to jedyna dostepna faza, wiec liczy
         * sie wtedy, gdy noc nie ma ani jednej fazy szczegolowej.
         */
        case .asleepUnspecified: return "nieokreslony"
        case .awake: return "budzenia"
        case .inBed: return "lozko"
        default: return nil
        }
    }

    /// Sen wlasciwy nocy. Fazy szczegolowe wygrywaja z parasolem.
    private static func senWlasciwy(_ fazy: [String: Double]) -> Double {
        let szczegolowe = (fazy["gleboki"] ?? 0) + (fazy["rem"] ?? 0) + (fazy["lekki"] ?? 0)
        return szczegolowe > 0 ? szczegolowe : (fazy["nieokreslony"] ?? 0)
    }
}
