import Foundation
import UserNotifications

/// Codzienne przypomnienie o kliknieciu Synchronizuj.
///
/// ZASADA: nie uzywamy jednego powtarzalnego wyzwalacza, tylko planujemy
/// `zapas` pojedynczych przypomnien na kolejne dni. Powtarzalny wyzwalacz
/// przypominalby takze w dniu, w ktorym synchronizacja juz sie odbyla, a
/// powiadomienie o rzeczy zrobionej uczy ignorowac powiadomienia.
/// Przy takim ukladzie po kazdej udanej synchronizacji przestawiamy caly
/// zestaw i dzisiejszy dzien po prostu wypada.
///
/// OGRANICZENIE swiadome: jesli aplikacja nie zostanie otwarta przez `zapas`
/// dni, przypomnienia sie koncza. Od tego jest drugi, niezalezny czujnik:
/// panel w aplikacji webowej pokazuje „Zegarek nie synchronizowany od N dni".
/// Ktos, kto zignorowal czternascie powiadomien, nie zareaguje na pietnaste.
enum Powiadomienia {
    private static let identyfikator = "przypomnienie-synchronizacji"
    private static let zapas = 14

    static func poprosOZgode() async -> Bool {
        (try? await UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    static func stanZgody() async -> UNAuthorizationStatus {
        await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    /// Kasuje stary zestaw i planuje nowy od najblizszego dnia, w ktorym
    /// przypomnienie ma jeszcze sens.
    static func przestaw(wlaczone: Bool, godzina: Date, zsynchronizowanoDzis: Bool) async {
        let centrum = UNUserNotificationCenter.current()
        centrum.removePendingNotificationRequests(
            withIdentifiers: (0..<zapas).map { "\(identyfikator)-\($0)" }
        )
        guard wlaczone else { return }

        let kalendarz = Calendar.current
        let hm = kalendarz.dateComponents([.hour, .minute], from: godzina)
        guard let h = hm.hour, let m = hm.minute else { return }

        let tresc = UNMutableNotificationContent()
        tresc.title = "Health Sync"
        tresc.body = "Wyślij wczorajszą dobę: HRV, sen i tętno czekają na telefonie."
        tresc.sound = .default

        // Dzisiejsze przypomnienie odpada, gdy godzina juz minela albo gdy
        // synchronizacja tego dnia sie odbyla.
        let dzis = kalendarz.startOfDay(for: Date())
        let dzisiejszaGodzina = kalendarz.date(bySettingHour: h, minute: m, second: 0, of: dzis)
        let pierwszyDzien = (zsynchronizowanoDzis || (dzisiejszaGodzina.map { $0 <= Date() } ?? true)) ? 1 : 0

        for i in 0..<zapas {
            guard let dzien = kalendarz.date(byAdding: .day, value: pierwszyDzien + i, to: dzis),
                  let kiedy = kalendarz.date(bySettingHour: h, minute: m, second: 0, of: dzien)
            else { continue }

            let wyzwalacz = UNCalendarNotificationTrigger(
                dateMatching: kalendarz.dateComponents([.year, .month, .day, .hour, .minute], from: kiedy),
                repeats: false
            )
            let zadanie = UNNotificationRequest(
                identifier: "\(identyfikator)-\(i)",
                content: tresc,
                trigger: wyzwalacz
            )
            try? await centrum.add(zadanie)
        }
    }

    /// Ile przypomnien faktycznie czeka w kolejce systemu. Do pokazania
    /// w ustawieniach, bo inaczej „wlaczone" nie znaczy „zadziala".
    static func ileZaplanowanych() async -> Int {
        await UNUserNotificationCenter.current().pendingNotificationRequests()
            .filter { $0.identifier.hasPrefix(identyfikator) }
            .count
    }
}
