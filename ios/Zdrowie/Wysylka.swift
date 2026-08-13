import Foundation

/// Wysylka do `/api/watch`.
///
/// Dni ida paczkami, bo serwer stoi na D1, a jeden request ma twardy limit
/// zapytan do bazy. Paczka po 50 dni miesci sie z zapasem, a przy oknie
/// 30-dniowym i tak zwykle wychodzi jedna.
///
/// Kazdy krok melduje sie w dzienniku z kodem odpowiedzi i trescia, bo to
/// jedyny material do naprawy, gdy synchronizacja przestanie dzialac.
struct Wysylka {
    let adres: String
    let token: String

    enum Blad: LocalizedError {
        case zlyAdres(String)
        case odrzucone(Int, String)

        var errorDescription: String? {
            switch self {
            case .zlyAdres(let a): return "Adres nie jest poprawny: \(a)"
            case .odrzucone(let kod, let tresc): return "Serwer odpowiedzial \(kod): \(tresc)"
            }
        }
    }

    private static let wielkoscPaczki = 50

    func wyslij(_ dni: [Dzien], log: @escaping (String, Dziennik.Waga) -> Void) async throws -> Int {
        guard let baza = URL(string: adres.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            throw Blad.zlyAdres(adres)
        }
        let cel = baza.appendingPathComponent("api/watch")

        var zapisanych = 0
        let paczki = stride(from: 0, to: dni.count, by: Self.wielkoscPaczki).map {
            Array(dni[$0..<min($0 + Self.wielkoscPaczki, dni.count)])
        }

        for (i, paczka) in paczki.enumerated() {
            let cialo: [String: Any] = ["days": paczka.map { $0.slownik() }]
            let dane = try JSONSerialization.data(withJSONObject: cialo)

            var zadanie = URLRequest(url: cel)
            zadanie.httpMethod = "POST"
            zadanie.setValue("application/json", forHTTPHeaderField: "Content-Type")
            zadanie.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            zadanie.httpBody = dane
            zadanie.timeoutInterval = 60

            log("Paczka \(i + 1) z \(paczki.count): \(paczka.count) dni, \(dane.count) bajtow", .info)

            let (odpowiedz, meta) = try await URLSession.shared.data(for: zadanie)
            let kod = (meta as? HTTPURLResponse)?.statusCode ?? 0
            let tresc = String(data: odpowiedz, encoding: .utf8) ?? "(nieczytelna odpowiedz)"

            guard (200..<300).contains(kod) else {
                log("Serwer odrzucil paczke \(i + 1), kod \(kod): \(tresc)", .blad)
                throw Blad.odrzucone(kod, tresc)
            }

            log("Serwer przyjal: \(tresc)", .ok)
            if let json = try? JSONSerialization.jsonObject(with: odpowiedz) as? [String: Any],
               let n = json["dni"] as? Int {
                zapisanych += n
            }
        }

        return zapisanych
    }

    /// Co serwer ma teraz. Wolane przed wysylka, zeby w logu zostal stan przed i po.
    func status(log: @escaping (String, Dziennik.Waga) -> Void) async {
        guard let baza = URL(string: adres.trimmingCharacters(in: .whitespacesAndNewlines)) else { return }
        var zadanie = URLRequest(url: baza.appendingPathComponent("api/watch/status"))
        zadanie.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        zadanie.timeoutInterval = 30
        do {
            let (dane, meta) = try await URLSession.shared.data(for: zadanie)
            let kod = (meta as? HTTPURLResponse)?.statusCode ?? 0
            let tresc = String(data: dane, encoding: .utf8) ?? ""
            log("Stan serwera (\(kod)): \(tresc)", kod == 200 ? .info : .blad)
        } catch {
            log("Nie udalo sie odpytac serwera: \(error.localizedDescription)", .blad)
        }
    }
}
