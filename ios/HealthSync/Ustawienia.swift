import Foundation
import Security

/// Adres serwera i token.
///
/// Token idzie do Keychain, nie do UserDefaults. UserDefaults leza w kopii
/// zapasowej w czytelnej postaci, a ten token daje prawo zapisu do bazy
/// zdrowotnej. Adres serwera zostaje w UserDefaults, bo nie jest sekretem.
@MainActor
final class Ustawienia: ObservableObject {
    private static let kluczAdres = "adresSerwera"
    private static let kluczOkno = "dniWstecz"
    private static let kluczOstatnia = "ostatniaSynchronizacja"
    private static let kluczPrzypomnienie = "przypomnienieWlaczone"
    private static let kluczGodzina = "przypomnienieGodzina"
    /*
     * Nazwa uslugi w Keychain zostaje z czasow, gdy aplikacja nazywala sie
     * Zdrowie. Zmiana tego ciagu to nie kosmetyka, tylko utrata zapisanego
     * tokenu i konieczne wklejanie go od nowa.
     */
    private static let uslugaKeychain = "eu.cupial.zdrowie.token"

    @Published var adres: String {
        didSet { UserDefaults.standard.set(adres, forKey: Self.kluczAdres) }
    }

    /// Ile dni wstecz wysylac przy kazdym kliknieciu.
    ///
    /// Okno kroczace, nie „od ostatniej synchronizacji". Zegarek dosyla pomiary
    /// z opoznieniem, czasem kilkugodzinnym, a sen potrafi dojechac po poludniu.
    /// Wysylanie samego wczoraj gubiloby te dosylki na zawsze, bo zapis jest
    /// idempotentny i ponowne przeslanie tego samego dnia nic nie kosztuje.
    @Published var dniWstecz: Int {
        didSet { UserDefaults.standard.set(dniWstecz, forKey: Self.kluczOkno) }
    }

    @Published var ostatniaSynchronizacja: Date? {
        didSet {
            UserDefaults.standard.set(ostatniaSynchronizacja?.timeIntervalSince1970 ?? 0,
                                      forKey: Self.kluczOstatnia)
        }
    }

    @Published var token: String {
        didSet { Self.zapiszToken(token) }
    }

    @Published var przypomnienieWlaczone: Bool {
        didSet { UserDefaults.standard.set(przypomnienieWlaczone, forKey: Self.kluczPrzypomnienie) }
    }

    /// Sama godzina ma znaczenie, data jest nosnikiem dla DatePickera.
    @Published var przypomnienieGodzina: Date {
        didSet {
            UserDefaults.standard.set(przypomnienieGodzina.timeIntervalSince1970,
                                      forKey: Self.kluczGodzina)
        }
    }

    init() {
        let d = UserDefaults.standard
        adres = d.string(forKey: Self.kluczAdres) ?? "https://food.cupial.eu"
        let okno = d.integer(forKey: Self.kluczOkno)
        dniWstecz = okno > 0 ? okno : 30
        let ts = d.double(forKey: Self.kluczOstatnia)
        ostatniaSynchronizacja = ts > 0 ? Date(timeIntervalSince1970: ts) : nil
        token = Self.wczytajToken() ?? ""
        przypomnienieWlaczone = d.bool(forKey: Self.kluczPrzypomnienie)
        let g = d.double(forKey: Self.kluczGodzina)
        // Domyslnie 9:00. Sen domyka sie dopiero po pobudce i dosyla z zegarka
        // z opoznieniem, wiec przypominanie o 6 rano wysylaloby niepelna dobe.
        przypomnienieGodzina = g > 0
            ? Date(timeIntervalSince1970: g)
            : Calendar.current.date(bySettingHour: 9, minute: 0, second: 0, of: Date()) ?? Date()
    }

    var gotowe: Bool {
        !token.isEmpty && URL(string: adres) != nil && adres.hasPrefix("https://")
    }

    var zsynchronizowanoDzis: Bool {
        guard let d = ostatniaSynchronizacja else { return false }
        return Calendar.current.isDateInToday(d)
    }

    // MARK: - Keychain

    private static func zapiszToken(_ wartosc: String) {
        let zapytanie: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: uslugaKeychain,
        ]
        SecItemDelete(zapytanie as CFDictionary)

        guard !wartosc.isEmpty, let dane = wartosc.data(using: .utf8) else { return }

        var nowy = zapytanie
        nowy[kSecValueData as String] = dane
        nowy[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(nowy as CFDictionary, nil)
    }

    private static func wczytajToken() -> String? {
        let zapytanie: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: uslugaKeychain,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var wynik: AnyObject?
        guard SecItemCopyMatching(zapytanie as CFDictionary, &wynik) == errSecSuccess,
              let dane = wynik as? Data else { return nil }
        return String(data: dane, encoding: .utf8)
    }
}
