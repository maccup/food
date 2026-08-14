import Foundation

/// Dziennik pracy aplikacji.
///
/// To nie jest ozdoba ekranu. Aplikacja dziala na jednym urzadzeniu, do ktorego
/// nie mam dostepu, wiec kiedy synchronizacja przestanie dzialac, jedynym
/// materialem do naprawy bedzie to, co tu wyladuje. Dlatego log zapisuje
/// KONKRETY: ile probek zwrocil kazdy typ, ktore typy zwrocily zero, jaki kod
/// odpowiedzi dal serwer i co dokladnie odpowiedzial.
///
/// „Zero probek" i „blad zapytania" wygladaja na ekranie tak samo, czyli jak
/// brak danych, wiec sa rozrozniane w tekscie wpisu.
@MainActor
final class Dziennik: ObservableObject {
    enum Waga: String {
        case info = "  "
        case ok = "OK"
        case uwaga = "!!"
        case blad = "XX"
    }

    struct Wpis: Identifiable {
        let id = UUID()
        let czas: Date
        let waga: Waga
        let tekst: String
    }

    @Published private(set) var wpisy: [Wpis] = []

    private static let format: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss"
        return f
    }()

    func dopisz(_ tekst: String, _ waga: Waga = .info) {
        wpisy.append(Wpis(czas: Date(), waga: waga, tekst: tekst))
    }

    func wyczysc() {
        wpisy.removeAll()
    }

    /// Cala tresc jednym stringiem, do wyslania mi, gdy cos nie zadziala.
    var doSkopiowania: String {
        wpisy
            .map { "\(Dziennik.format.string(from: $0.czas)) \($0.waga.rawValue) \($0.tekst)" }
            .joined(separator: "\n")
    }
}
