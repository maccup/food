import SwiftUI
import UserNotifications

struct ContentView: View {
    @StateObject private var ustawienia = Ustawienia()
    @StateObject private var dziennik = Dziennik()
    @State private var pracuje = false
    @State private var ostatniWynik: Wynik?
    @State private var stanSerwera: Wysylka.Stan?
    @State private var pokazUstawienia = false
    @State private var pokazDziennik = false

    private let czytnik = CzytnikZdrowia()

    /// Wynik ostatniego kliniecia, do pokazania nad przyciskiem.
    enum Wynik {
        case udane(Int)
        case nieudane(String)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    kartaStanu
                    przyciskSynchronizuj
                    if !ustawienia.gotowe { brakTokenu }
                    kartaDziennika
                }
                .padding(.horizontal)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Health Sync")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { pokazUstawienia = true } label: {
                        Image(systemName: "gearshape.fill")
                    }
                }
            }
            .sheet(isPresented: $pokazUstawienia) {
                UstawieniaWidok(ustawienia: ustawienia)
            }
            .task {
                // Przypomnienia przestawiamy przy kazdym otwarciu, bo zestaw
                // jest skonczony i to jest moment na jego odnowienie.
                await Powiadomienia.przestaw(
                    wlaczone: ustawienia.przypomnienieWlaczone,
                    godzina: ustawienia.przypomnienieGodzina,
                    zsynchronizowanoDzis: ustawienia.zsynchronizowanoDzis
                )
                if ustawienia.gotowe && stanSerwera == nil {
                    stanSerwera = await Wysylka(adres: ustawienia.adres, token: ustawienia.token)
                        .status(log: { _, _ in })
                }
            }
        }
    }

    // MARK: - Karta stanu

    private var kartaStanu: some View {
        VStack(spacing: 16) {
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(swiatlo.kolor.opacity(0.15))
                        .frame(width: 56, height: 56)
                    Image(systemName: swiatlo.ikona)
                        .font(.system(size: 26, weight: .semibold))
                        .foregroundStyle(swiatlo.kolor)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(swiatlo.tytul)
                        .font(.headline)
                    Text(swiatlo.podtytul)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }

            if let s = stanSerwera {
                Divider()
                HStack(spacing: 0) {
                    liczba("\(s.dni)", "dób w bazie")
                    Divider().frame(height: 34)
                    liczba(String(s.ostatniDzien.suffix(5)), "ostatnia doba")
                    Divider().frame(height: 34)
                    liczba("\(ustawienia.dniWstecz)", "okno wysyłki")
                }
            }
        }
        .padding(18)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func liczba(_ wartosc: String, _ opis: String) -> some View {
        VStack(spacing: 2) {
            Text(wartosc)
                .font(.system(.title3, design: .rounded).weight(.semibold))
                .monospacedDigit()
            Text(opis)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    /// Jedno zdanie o tym, czy dane sa swieze. Kolor i ikona ida za trescia.
    private var swiatlo: (ikona: String, kolor: Color, tytul: String, podtytul: String) {
        if pracuje {
            return ("arrow.triangle.2.circlepath", .accentColor, "Zbieram dane",
                    "Czytam Apple Health i wysyłam dobowe podsumowania.")
        }
        switch ostatniWynik {
        case .nieudane(let powod):
            return ("exclamationmark.triangle.fill", .red, "Nie udało się", powod)
        case .udane(let n):
            return ("checkmark.circle.fill", .green, "Zapisano \(n) dób",
                    "Serwer przyjął wszystko, szczegóły w dzienniku.")
        case nil:
            break
        }
        guard let d = ustawienia.ostatniaSynchronizacja else {
            return ("moon.zzz.fill", .secondary, "Jeszcze nie synchronizowano",
                    "Kliknij Synchronizuj, żeby wysłać ostatnie \(ustawienia.dniWstecz) dni.")
        }
        let dni = Calendar.current.dateComponents([.day],
                                                  from: Calendar.current.startOfDay(for: d),
                                                  to: Calendar.current.startOfDay(for: Date())).day ?? 0
        switch dni {
        case 0:
            return ("checkmark.circle.fill", .green, "Zsynchronizowano dziś",
                    "O \(d.formatted(date: .omitted, time: .shortened)). Na dziś zrobione.")
        case 1:
            return ("clock.fill", .accentColor, "Ostatnio wczoraj",
                    "Wczorajsza doba domyka się dopiero po pobudce, więc teraz jest dobry moment.")
        default:
            return ("exclamationmark.triangle.fill", .orange, "Cisza od \(dni) dni",
                    "Ostatnio \(d.formatted(date: .abbreviated, time: .shortened)). Im dłużej, tym większa dziura w wykresach.")
        }
    }

    // MARK: - Przycisk

    private var przyciskSynchronizuj: some View {
        Button(action: synchronizuj) {
            HStack(spacing: 10) {
                if pracuje {
                    ProgressView().tint(.white)
                } else {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 20, weight: .semibold))
                }
                Text(pracuje ? "Zbieram dane…" : "Synchronizuj")
                    .font(.headline)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.roundedRectangle(radius: 16))
        .disabled(pracuje || !ustawienia.gotowe)
    }

    private var brakTokenu: some View {
        HStack(spacing: 10) {
            Image(systemName: "key.fill").foregroundStyle(.orange)
            Text("Najpierw wpisz token w ustawieniach")
                .font(.footnote)
            Spacer(minLength: 0)
            Button("Otwórz") { pokazUstawienia = true }
                .font(.footnote.weight(.semibold))
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    // MARK: - Dziennik

    private var kartaDziennika: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { pokazDziennik.toggle() }
            } label: {
                HStack {
                    Image(systemName: "list.bullet.rectangle")
                        .foregroundStyle(.secondary)
                    Text("Dziennik")
                        .font(.headline)
                    if !dziennik.wpisy.isEmpty {
                        Text("\(dziennik.wpisy.count)")
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2)
                            .background(Color(.tertiarySystemFill))
                            .clipShape(Capsule())
                    }
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.secondary)
                        .rotationEffect(.degrees(pokazDziennik ? 0 : -90))
                }
                .padding(16)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if pokazDziennik {
                Divider().padding(.leading, 16)

                if dziennik.wpisy.isEmpty {
                    Text("Pusto. Dziennik zapełnia się przy synchronizacji i pokazuje liczbę próbek dla każdej metryki osobno.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .padding(16)
                } else {
                    ScrollViewReader { scroll in
                        ScrollView {
                            LazyVStack(alignment: .leading, spacing: 6) {
                                ForEach(dziennik.wpisy) { wpis in
                                    HStack(alignment: .top, spacing: 8) {
                                        Image(systemName: ikona(wpis.waga))
                                            .font(.caption2)
                                            .foregroundStyle(kolor(wpis.waga))
                                            .frame(width: 14)
                                        Text(wpis.tekst)
                                            .font(.system(.caption, design: .monospaced))
                                            .foregroundStyle(wpis.waga == .info ? .secondary : .primary)
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                    }
                                    .id(wpis.id)
                                }
                            }
                            .padding(16)
                        }
                        .frame(maxHeight: 320)
                        .onChange(of: dziennik.wpisy.count) {
                            if let ostatni = dziennik.wpisy.last {
                                withAnimation { scroll.scrollTo(ostatni.id, anchor: .bottom) }
                            }
                        }
                    }

                    Divider().padding(.leading, 16)
                    HStack(spacing: 18) {
                        Button {
                            UIPasteboard.general.string = dziennik.doSkopiowania
                        } label: {
                            Label("Kopiuj", systemImage: "doc.on.doc")
                        }
                        Button(role: .destructive) { dziennik.wyczysc() } label: {
                            Label("Wyczyść", systemImage: "trash")
                        }
                        Spacer()
                    }
                    .font(.footnote.weight(.medium))
                    .padding(16)
                }
            }
        }
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func kolor(_ w: Dziennik.Waga) -> Color {
        switch w {
        case .ok: return .green
        case .uwaga: return .orange
        case .blad: return .red
        case .info: return .secondary
        }
    }

    private func ikona(_ w: Dziennik.Waga) -> String {
        switch w {
        case .ok: return "checkmark.circle.fill"
        case .uwaga: return "exclamationmark.circle.fill"
        case .blad: return "xmark.octagon.fill"
        case .info: return "info.circle"
        }
    }

    // MARK: - Synchronizacja

    private func synchronizuj() {
        pracuje = true
        ostatniWynik = nil
        dziennik.wyczysc()
        pokazDziennik = true

        Task {
            let zapisz: (String, Dziennik.Waga) -> Void = { tekst, waga in
                Task { @MainActor in dziennik.dopisz(tekst, waga) }
            }

            zapisz("Start, okno \(ustawienia.dniWstecz) dni", .info)

            let wysylka = Wysylka(adres: ustawienia.adres, token: ustawienia.token)
            await wysylka.status(log: zapisz)

            do {
                try await czytnik.poprosOZgode()
                zapisz("Zgody HealthKit potwierdzone", .ok)
            } catch {
                zapisz("Zgody HealthKit: \(error.localizedDescription)", .blad)
                await MainActor.run {
                    ostatniWynik = .nieudane("Apple Health nie dał zgody na odczyt.")
                    pracuje = false
                }
                return
            }

            let (dni, sesje) = await czytnik.zbierz(dniWstecz: ustawienia.dniWstecz, log: zapisz)

            let zPolami = dni.filter { !$0.pola.isEmpty }
            zapisz("Zebrano \(dni.count) dni, z czego \(zPolami.count) ma jakiekolwiek dane", .info)

            /*
             * Wysylamy tylko dni z danymi. Pusty dzien to zwykle dzien, w ktorym
             * zegarek lezal na ladowarce, a nie doba bez zycia. Wyslanie samych
             * zer nadpisaloby to, co juz jest w bazie z eksportu XML.
             */
            guard !zPolami.isEmpty else {
                zapisz("Nie ma czego wysylac", .uwaga)
                await MainActor.run {
                    ostatniWynik = .nieudane("Apple Health nie oddało żadnych danych z tego okna.")
                    pracuje = false
                }
                return
            }

            do {
                let n = try await wysylka.wyslij(zPolami, sesje: sesje, log: zapisz)
                let stan = await wysylka.status(log: zapisz)
                await MainActor.run {
                    ustawienia.ostatniaSynchronizacja = Date()
                    stanSerwera = stan
                    ostatniWynik = .udane(n)
                    pracuje = false
                }
                zapisz("Gotowe", .ok)
                // Dzisiejsze przypomnienie jest juz niepotrzebne.
                await Powiadomienia.przestaw(
                    wlaczone: ustawienia.przypomnienieWlaczone,
                    godzina: ustawienia.przypomnienieGodzina,
                    zsynchronizowanoDzis: true
                )
            } catch {
                zapisz("Wysylka nieudana: \(error.localizedDescription)", .blad)
                await MainActor.run {
                    ostatniWynik = .nieudane("Serwer nie przyjął danych, powód w dzienniku.")
                    pracuje = false
                }
            }
        }
    }
}

struct UstawieniaWidok: View {
    @ObservedObject var ustawienia: Ustawienia
    @Environment(\.dismiss) private var zamknij
    @State private var zgodaNaPowiadomienia: UNAuthorizationStatus = .notDetermined
    @State private var zaplanowanych = 0

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("https://food.cupial.eu", text: $ustawienia.adres)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                } header: {
                    Label("Serwer", systemImage: "server.rack")
                }

                Section {
                    SecureField("Token", text: $ustawienia.token)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } header: {
                    Label("Token", systemImage: "key.fill")
                } footer: {
                    Text("Ten sam ciąg, który siedzi w sekrecie WATCH_TOKEN na serwerze. Zapisywany w Keychain, nie w kopii zapasowej.")
                }

                Section {
                    Toggle("Przypominaj codziennie", isOn: $ustawienia.przypomnienieWlaczone)
                    if ustawienia.przypomnienieWlaczone {
                        DatePicker("O godzinie", selection: $ustawienia.przypomnienieGodzina,
                                   displayedComponents: .hourAndMinute)
                    }
                } header: {
                    Label("Przypomnienie", systemImage: "bell.fill")
                } footer: {
                    Text(stopkaPowiadomien)
                }

                Section {
                    Stepper("Wysyłaj \(ustawienia.dniWstecz) dni wstecz",
                            value: $ustawienia.dniWstecz, in: 1...180, step: 1)
                } header: {
                    Label("Okno", systemImage: "calendar")
                } footer: {
                    Text("Okno kroczące. Zegarek dosyła pomiary z opóźnieniem, a sen potrafi dojechać po południu, więc wysyłanie samego wczoraj gubiłoby te dosyłki. Ponowne przesłanie tego samego dnia nic nie psuje.")
                }
            }
            .navigationTitle("Ustawienia")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Gotowe") { zamknij() }
                }
            }
            .task { await odswiezStanPowiadomien() }
            .onChange(of: ustawienia.przypomnienieWlaczone) { _, wlaczone in
                Task {
                    if wlaczone { _ = await Powiadomienia.poprosOZgode() }
                    await przestawIOdswiez()
                }
            }
            .onChange(of: ustawienia.przypomnienieGodzina) { _, _ in
                Task { await przestawIOdswiez() }
            }
        }
    }

    /// Mowi prawde o tym, czy przypomnienie zadziala, a nie tylko czy jest
    /// wlaczone w aplikacji. Zgoda cofnieta w Ustawieniach iOS jest cicha.
    private var stopkaPowiadomien: String {
        guard ustawienia.przypomnienieWlaczone else {
            return "Bez przypomnienia synchronizacja zależy od tego, czy sobie przypomnisz. Panel na serwerze i tak odezwie się po dwóch dobach ciszy."
        }
        switch zgodaNaPowiadomienia {
        case .denied:
            return "iOS blokuje powiadomienia dla tej aplikacji. Ustawienia → Powiadomienia → Health Sync."
        case .authorized, .provisional, .ephemeral:
            return "Zaplanowanych przypomnień: \(zaplanowanych). Dzień, w którym zsynchronizujesz wcześniej, wypada sam. Zestaw odnawia się przy każdym otwarciu aplikacji."
        default:
            return "iOS jeszcze nie zapytał o zgodę na powiadomienia."
        }
    }

    private func przestawIOdswiez() async {
        await Powiadomienia.przestaw(
            wlaczone: ustawienia.przypomnienieWlaczone,
            godzina: ustawienia.przypomnienieGodzina,
            zsynchronizowanoDzis: ustawienia.zsynchronizowanoDzis
        )
        await odswiezStanPowiadomien()
    }

    private func odswiezStanPowiadomien() async {
        zgodaNaPowiadomienia = await Powiadomienia.stanZgody()
        zaplanowanych = await Powiadomienia.ileZaplanowanych()
    }
}
