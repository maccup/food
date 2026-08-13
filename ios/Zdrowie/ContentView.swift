import SwiftUI

struct ContentView: View {
    @StateObject private var ustawienia = Ustawienia()
    @StateObject private var dziennik = Dziennik()
    @State private var pracuje = false
    @State private var ostatniWynik: String?
    @State private var pokazUstawienia = false

    private let czytnik = CzytnikZdrowia()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                naglowek
                Divider()
                dziennikWidok
            }
            .navigationTitle("Zdrowie")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { pokazUstawienia = true } label: { Image(systemName: "gearshape") }
                }
            }
            .sheet(isPresented: $pokazUstawienia) {
                UstawieniaWidok(ustawienia: ustawienia)
            }
        }
    }

    private var naglowek: some View {
        VStack(spacing: 12) {
            if let wynik = ostatniWynik {
                Text(wynik)
                    .font(.callout)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal)
            }

            Button(action: synchronizuj) {
                HStack {
                    if pracuje {
                        ProgressView().tint(.white)
                    } else {
                        Image(systemName: "arrow.triangle.2.circlepath")
                    }
                    Text(pracuje ? "Zbieram dane…" : "Synchronizuj")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
            }
            .buttonStyle(.borderedProminent)
            .disabled(pracuje || !ustawienia.gotowe)
            .padding(.horizontal)

            if !ustawienia.gotowe {
                Text("Najpierw wpisz token w ustawieniach")
                    .font(.footnote)
                    .foregroundStyle(.orange)
            }

            HStack(spacing: 16) {
                Text("Okno: \(ustawienia.dniWstecz) dni")
                if let d = ustawienia.ostatniaSynchronizacja {
                    Text("Ostatnio: \(d.formatted(date: .abbreviated, time: .shortened))")
                } else {
                    Text("Jeszcze nie synchronizowano")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 16)
    }

    private var dziennikWidok: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Dziennik").font(.headline)
                Spacer()
                if !dziennik.wpisy.isEmpty {
                    Button("Kopiuj") {
                        UIPasteboard.general.string = dziennik.doSkopiowania
                    }
                    .font(.caption)
                    Button("Wyczyść") { dziennik.wyczysc() }
                        .font(.caption)
                }
            }
            .padding(.horizontal)
            .padding(.top, 12)

            ScrollViewReader { scroll in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 2) {
                        ForEach(dziennik.wpisy) { wpis in
                            Text(wpis.tekst)
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(kolor(wpis.waga))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .id(wpis.id)
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                }
                .onChange(of: dziennik.wpisy.count) {
                    if let ostatni = dziennik.wpisy.last {
                        withAnimation { scroll.scrollTo(ostatni.id, anchor: .bottom) }
                    }
                }
            }
        }
    }

    private func kolor(_ w: Dziennik.Waga) -> Color {
        switch w {
        case .ok: return .green
        case .uwaga: return .orange
        case .blad: return .red
        case .info: return .secondary
        }
    }

    private func synchronizuj() {
        pracuje = true
        ostatniWynik = nil
        dziennik.wyczysc()

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
                    ostatniWynik = "Nie udało się uzyskać zgód"
                    pracuje = false
                }
                return
            }

            let dni = await czytnik.zbierz(dniWstecz: ustawienia.dniWstecz, log: zapisz)

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
                    ostatniWynik = "Brak danych do wysłania"
                    pracuje = false
                }
                return
            }

            do {
                let n = try await wysylka.wyslij(zPolami, log: zapisz)
                await wysylka.status(log: zapisz)
                await MainActor.run {
                    ustawienia.ostatniaSynchronizacja = Date()
                    ostatniWynik = "Zapisano \(n) dni"
                    pracuje = false
                }
                zapisz("Gotowe", .ok)
            } catch {
                zapisz("Wysylka nieudana: \(error.localizedDescription)", .blad)
                await MainActor.run {
                    ostatniWynik = "Wysyłka nieudana, szczegóły w dzienniku"
                    pracuje = false
                }
            }
        }
    }
}

struct UstawieniaWidok: View {
    @ObservedObject var ustawienia: Ustawienia
    @Environment(\.dismiss) private var zamknij

    var body: some View {
        NavigationStack {
            Form {
                Section("Serwer") {
                    TextField("https://food.cupial.eu", text: $ustawienia.adres)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                }
                Section {
                    SecureField("Token", text: $ustawienia.token)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } header: {
                    Text("Token")
                } footer: {
                    Text("Ten sam ciąg, który siedzi w sekrecie WATCH_TOKEN na serwerze. Zapisywany w Keychain, nie w kopii zapasowej.")
                }
                Section {
                    Stepper("Wysyłaj \(ustawienia.dniWstecz) dni wstecz",
                            value: $ustawienia.dniWstecz, in: 1...180, step: 1)
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
        }
    }
}
