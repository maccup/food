/**
 * Rekomendacja treningowa na najblizsze dni.
 *
 * Zrodla regul, bo kazda liczba w tym pliku ma pochodzenie:
 *
 * 1. HRV: srednia KROCZACA z 7 dni wobec wlasnej linii bazowej, z progiem
 *    SWC = 0,5 x odchylenie standardowe (Plews i Buchheit). Pojedyncza doba
 *    jest za bardzo zaszumiona, zeby cokolwiek na niej opierac: korelacje
 *    z formą widac dopiero od 3 do 4 dni usrednienia. Ponizej dolnej granicy
 *    SWC schodzi sie z intensywnoscia, w granicy i powyzej mozna cisnac.
 *
 * 2. Tetno spoczynkowe: wzrost o 3 do 5 uderzen ponad wlasna baze to sygnal
 *    ostrzegawczy, 5 i wiecej to podstawa do zejscia z objetosci, a utrzymanie
 *    sie takiego stanu przez kilka dni jest jednym z pewniejszych wczesnych
 *    znakow przetrenowania.
 *
 * 3. Struktura tygodnia: WHO 2020 mowi 150 do 300 minut umiarkowanego wysilku
 *    tygodniowo i sila w co najmniej 2 dniach. To jest PODLOGA dla populacji,
 *    nie cel dla Macka: przy VO2max 64,5 i trzech sesjach silowych tygodniowo
 *    minimum WHO nie jest wiazace. Wiazace jest co innego, patrz CELE nizej.
 *
 * CZEGO TU NIE MA i dlaczego: stosunku obciazenia ostrego do przewleklego
 * (ACWR). Metryka jest szeroko podwazona, przeglady nie znajduja podstaw do
 * opierania na niej decyzji treningowych, a jej wlasnosci statystyczne
 * utrudniaja interpretacje. Zamiast tego liczymy zwykla objetosc tygodniowa
 * i dni z rzedu bez przerwy, co jest proste i nie udaje precyzji, ktorej nie ma.
 *
 * OGRANICZENIE, ktore trzeba znac: Apple Watch podaje SDNN ze spotowych
 * pomiarow, a nie ciagly rMSSD jak pierscien. To inny wskaznik i jego wartosci
 * nie sa porownywalne z historia z Oury. Dlatego linia bazowa liczy sie
 * WYLACZNIE z okna biezacego, nigdy z lat z pierscieniem.
 */

export interface DobaZegarka {
  date: string;
  hrv_noc: number | null;
  hrv: number | null;
  rhr: number | null;
  sen_min: number | null;
}

export interface TreningWpis {
  date: string;
  typ_apple: string;
  minuty: number | null;
  kcal: number | null;
}

export type Kategoria = 'sila' | 'cardio' | 'spacer' | 'mobilnosc' | 'inne';

const KATEGORIE: Record<string, Kategoria> = {
  TraditionalStrengthTraining: 'sila',
  FunctionalStrengthTraining: 'sila',
  CoreTraining: 'sila',
  HighIntensityIntervalTraining: 'cardio',
  Running: 'cardio',
  Cycling: 'cardio',
  Swimming: 'cardio',
  Rowing: 'cardio',
  Elliptical: 'cardio',
  StairClimbing: 'cardio',
  Stairs: 'cardio',
  MixedCardio: 'cardio',
  CrossTraining: 'cardio',
  Hiking: 'cardio',
  Tennis: 'cardio',
  Dance: 'cardio',
  Walking: 'spacer',
  Yoga: 'mobilnosc',
  MindAndBody: 'mobilnosc',
  Pilates: 'mobilnosc',
  Flexibility: 'mobilnosc',
  Cooldown: 'mobilnosc',
};

export function kategoria(typApple: string): Kategoria {
  return KATEGORIE[typApple] ?? 'inne';
}

/**
 * Cele tygodniowe skalibrowane do jego danych z 06 i 07.2026, nie do sredniej
 * populacji. W tamtym okresie wychodzilo okolo 3 sesji silowych tygodniowo,
 * duzo spacerow i rower jako dojazd, a wysilku naprawde intensywnego prawie
 * wcale: cztery biegi na dwa i pol miesiaca. Stad jedyny cel podniesiony
 * ponad to, co juz robi, dotyczy intensywnosci.
 */
const CELE = {
  silaDni: 3,
  aerobMin: 150,
  /** Sesje o intensywnosci energetycznej powyzej progu, tygodniowo. */
  intensywneSesje: 1,
  /** Dni z rzedu z trescia treningowa, po ktorych wchodzi przerwa. */
  maxDniZRzedu: 6,
};

/**
 * Prog wysilku intensywnego: 8 kcal na minute. Przy 83 kg odpowiada to mniej
 * wiecej 7 MET, czyli dolnej granicy tego, co wytyczne nazywaja wysilkiem
 * intensywnym. Liczymy z kalorii, a nie z rodzaju treningu, bo „bieganie"
 * bywa truchtem, a „rower" bywa dojazdem do sklepu.
 */
const PROG_INTENSYWNY_KCAL_MIN = 8;

/** Sen uznawany za pokryty. Jego wlasna mediana z ostatnich 60 dni to 453 min. */
const POTRZEBA_SNU_MIN = 450;

const OKNO_BAZY = 60;
const OKNO_KROCZACE = 7;

export interface Gotowosc {
  stan: 'zielona' | 'zolta' | 'czerwona';
  hrv7: number | null;
  hrvBaza: number | null;
  hrvDolnaGranica: number | null;
  rhr7: number | null;
  rhrBaza: number | null;
  rhrDelta: number | null;
  dlugSnuMin: number | null;
  powody: string[];
  /** Ile dob w oknie bazowym mialo pomiar HRV. Ponizej 20 nie ufamy progowi. */
  podstawaDni: number;
}

const srednia = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

function odchylenie(v: number[]): number | null {
  if (v.length < 2) return null;
  const s = srednia(v)!;
  return Math.sqrt(v.reduce((a, x) => a + (x - s) ** 2, 0) / (v.length - 1));
}

/** Srednie kroczace z okna, po jednej na kazdy dzien, ktory ma pelne okno. */
function kroczaca(wartosci: Array<number | null>, okno: number): number[] {
  const wynik: number[] = [];
  for (let i = okno - 1; i < wartosci.length; i++) {
    const kawalek = wartosci.slice(i - okno + 1, i + 1).filter((x): x is number => x !== null);
    // Polowa okna wystarczy: zegarek nie mierzy HRV co noc i czekanie na
    // komplet oznaczaloby brak jakiegokolwiek progu przez wiekszosc czasu.
    if (kawalek.length >= Math.ceil(okno / 2)) wynik.push(srednia(kawalek)!);
  }
  return wynik;
}

export function policzGotowosc(doby: DobaZegarka[]): Gotowosc {
  const okno = doby.slice(-OKNO_BAZY);
  const powody: string[] = [];

  // HRV nocne przed dobowym: w nocy nie ma ruchu, kawy ani rozmowy, wiec
  // zostaje sam uklad autonomiczny i dopiero to jest porownywalne.
  const hrvSeria = okno.map((d) => d.hrv_noc ?? d.hrv ?? null);
  const podstawaDni = hrvSeria.filter((x) => x !== null).length;

  const ostatnie7 = hrvSeria.slice(-OKNO_KROCZACE).filter((x): x is number => x !== null);
  const hrv7 = ostatnie7.length >= 3 ? srednia(ostatnie7) : null;

  const wszystkieKroczace = kroczaca(hrvSeria, OKNO_KROCZACE);
  const hrvBaza = wszystkieKroczace.length ? srednia(wszystkieKroczace) : null;
  const sd = odchylenie(wszystkieKroczace);
  // SWC to polowa odchylenia standardowego serii kroczacej, nie serii dobowej.
  const hrvDolnaGranica = hrvBaza !== null && sd !== null ? hrvBaza - 0.5 * sd : null;

  const rhrSeria = okno.map((d) => d.rhr ?? null);
  const rhr7 = srednia(rhrSeria.slice(-OKNO_KROCZACE).filter((x): x is number => x !== null));
  const rhrBaza = srednia(rhrSeria.filter((x): x is number => x !== null));
  const rhrDelta = rhr7 !== null && rhrBaza !== null ? rhr7 - rhrBaza : null;

  // Dlug snu z trzech dob. Jedna krotka noc to zdarzenie, trzy to stan.
  const ostatnie3 = okno.slice(-3).map((d) => d.sen_min).filter((x): x is number => x !== null);
  const dlugSnuMin = ostatnie3.length
    ? ostatnie3.reduce((a, s) => a + Math.max(0, POTRZEBA_SNU_MIN - s), 0)
    : null;

  const hrvNisko = hrv7 !== null && hrvDolnaGranica !== null && podstawaDni >= 20 && hrv7 < hrvDolnaGranica;
  const rhrPodniesione = rhrDelta !== null && rhrDelta >= 3;
  const rhrWysokie = rhrDelta !== null && rhrDelta >= 5;
  const senZaKrotki = dlugSnuMin !== null && dlugSnuMin >= 180;

  if (hrvNisko) powody.push(`HRV z 7 dni (${hrv7!.toFixed(1)} ms) poniżej Twojej granicy ${hrvDolnaGranica!.toFixed(1)} ms`);
  if (rhrWysokie) powody.push(`tętno spoczynkowe wyżej o ${rhrDelta!.toFixed(1)} uderzenia niż zwykle`);
  else if (rhrPodniesione) powody.push(`tętno spoczynkowe podniesione o ${rhrDelta!.toFixed(1)} uderzenia`);
  if (senZaKrotki) powody.push(`niedobór snu z 3 dób: ${Math.round(dlugSnuMin! / 60 * 10) / 10} h`);
  if (podstawaDni < 20) powody.push(`za mało pomiarów HRV (${podstawaDni} z 60 dób), próg jeszcze niepewny`);

  /*
   * Czerwona wymaga DWOCH niezaleznych sygnalow albo jednego bardzo mocnego.
   * Samo nizsze HRV potrafi wyjsc z jednej gorszej nocy albo z alkoholu i nie
   * jest powodem, zeby odwolywac trening. Dopiero zbieznosc z tetnem albo
   * z niedoborem snu opisuje organizm, ktory nie odrobil.
   */
  const sygnaly = [hrvNisko, rhrWysokie, senZaKrotki].filter(Boolean).length;
  const stan: Gotowosc['stan'] =
    sygnaly >= 2 || (rhrDelta !== null && rhrDelta >= 7) ? 'czerwona'
    : sygnaly === 1 || rhrPodniesione ? 'zolta'
    : 'zielona';

  return { stan, hrv7, hrvBaza, hrvDolnaGranica, rhr7, rhrBaza, rhrDelta, dlugSnuMin, powody, podstawaDni };
}

export interface PodsumowanieTygodnia {
  silaDni: number;
  aerobMin: number;
  intensywneSesje: number;
  dniBezTreningu: number;
  dniZRzedu: number;
  odOstatniejSily: number | null;
}

/** Dzien tygodnia liczony od poniedzialku, bez zaleznosci od strefy czasowej. */
function poniedzialekTygodnia(data: string): string {
  const d = new Date(`${data}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function podsumujTydzien(treningi: TreningWpis[], dzis: string): PodsumowanieTygodnia {
  const start = poniedzialekTygodnia(dzis);
  const wTygodniu = treningi.filter((t) => t.date >= start && t.date <= dzis);

  const silaDni = new Set(wTygodniu.filter((t) => kategoria(t.typ_apple) === 'sila').map((t) => t.date)).size;

  /*
   * Do minut aerobowych wchodzi cardio w calosci, a spacer dopiero od 20 minut
   * ciaglych. Wytyczne licza marsz jako wysilek umiarkowany, ale trzyminutowy
   * odcinek do przystanku nim nie jest, a takich zegarek zapisuje najwiecej.
   */
  const aerobMin = wTygodniu.reduce((a, t) => {
    const k = kategoria(t.typ_apple);
    const m = t.minuty ?? 0;
    if (k === 'cardio') return a + m;
    if (k === 'spacer' && m >= 20) return a + m;
    return a;
  }, 0);

  const intensywneSesje = wTygodniu.filter((t) =>
    t.kcal !== null && t.minuty !== null && t.minuty >= 15 && t.kcal / t.minuty >= PROG_INTENSYWNY_KCAL_MIN
  ).length;

  // Dzien „z trescia" to sila, cardio albo dluzsza mobilnosc. Sam spacer nie
  // przerywa przerwy, bo chodzenie nie jest obciazeniem wymagajacym odrobienia.
  const zTrescia = new Set(
    treningi.filter((t) => {
      const k = kategoria(t.typ_apple);
      return k === 'sila' || k === 'cardio' || (k === 'mobilnosc' && (t.minuty ?? 0) >= 30);
    }).map((t) => t.date)
  );

  let dniZRzedu = 0;
  for (let i = 0; ; i++) {
    const d = przesun(dzis, -i);
    if (!zTrescia.has(d)) break;
    dniZRzedu++;
    if (dniZRzedu > 30) break;
  }

  const dniTygodnia: string[] = [];
  for (let d = start; d <= dzis; d = przesun(d, 1)) dniTygodnia.push(d);
  const dniBezTreningu = dniTygodnia.filter((d) => !zTrescia.has(d)).length;

  const dniSily = [...new Set(treningi.filter((t) => kategoria(t.typ_apple) === 'sila').map((t) => t.date))].sort();
  const ostatniaSila = dniSily.length ? dniSily[dniSily.length - 1] : null;
  const odOstatniejSily = ostatniaSila ? roznicaDni(ostatniaSila, dzis) : null;

  return { silaDni, aerobMin: Math.round(aerobMin), intensywneSesje, dniBezTreningu, dniZRzedu, odOstatniejSily };
}

function przesun(data: string, o: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + o);
  return d.toISOString().slice(0, 10);
}

function roznicaDni(od: string, doDnia: string): number {
  return Math.round(
    (Date.parse(`${doDnia}T12:00:00Z`) - Date.parse(`${od}T12:00:00Z`)) / 86400000
  );
}

export type Zalecenie = 'sila' | 'cardio' | 'interwaly' | 'mobilnosc' | 'odpoczynek';

export interface DzienPlanu {
  date: string;
  zalecenie: Zalecenie;
  tytul: string;
  opis: string;
  /** `pomiar` tylko dla dzisiaj. Dalsze dni to szkielet, nie prognoza. */
  podstawa: 'pomiar' | 'szkielet';
}

const OPISY: Record<Zalecenie, { tytul: string; opis: string }> = {
  sila: {
    tytul: 'Trening siłowy',
    opis: '45 do 60 minut, duże wzorce ruchu, ciężary bliskie roboczych. Siła utrzymuje masę mięśniową, a ta jest najmocniej związana ze śmiertelnością ogólną spośród wszystkiego, co da się wytrenować.',
  },
  cardio: {
    tytul: 'Spokojne cardio',
    opis: '45 do 60 minut na tyle wolno, żeby dało się mówić pełnymi zdaniami. To buduje bazę tlenową bez dokładania obciążenia do odrobienia.',
  },
  interwaly: {
    tytul: 'Interwały',
    opis: 'Rozgrzewka, potem 4 razy po 4 minuty mocno, z 3 minutami luzu między. To jedyny bodziec, który realnie podnosi VO2max, a VO2max jest pojedynczo najsilniejszym predyktorem długowieczności.',
  },
  mobilnosc: {
    tytul: 'Mobilność albo spacer',
    opis: 'Joga, rozciąganie albo dłuższy spacer. Ruch bez obciążenia, które trzeba potem odrabiać.',
  },
  odpoczynek: {
    tytul: 'Odpoczynek',
    opis: 'Bez treningu. Spacer i tak się liczy, ale nic, co podnosi tętno na dłużej.',
  },
};

export interface Plan {
  gotowosc: Gotowosc;
  tydzien: PodsumowanieTygodnia;
  dni: DzienPlanu[];
}

/**
 * Kolejnosc regul jest istotna i idzie od najmocniejszej do najslabszej:
 * najpierw to, co zabrania, potem to, czego brakuje, na koncu wypelniacz.
 */
export function ulozPlan(doby: DobaZegarka[], treningi: TreningWpis[], dzis: string, ile = 7): Plan {
  const gotowosc = policzGotowosc(doby);
  const tydzien = podsumujTydzien(treningi, dzis);

  const dni: DzienPlanu[] = [];
  // Kopie licznikow, zeby symulacja kolejnych dni nie psula podsumowania.
  let silaDni = tydzien.silaDni;
  let aerobMin = tydzien.aerobMin;
  let intensywne = tydzien.intensywneSesje;
  let zRzedu = tydzien.dniZRzedu;
  let odSily = tydzien.odOstatniejSily;

  for (let i = 0; i < ile; i++) {
    const data = przesun(dzis, i);
    // Poniedzialek zeruje liczniki tygodniowe, bo tydzien liczy sie od niego.
    if (i > 0 && data === poniedzialekTygodnia(data)) {
      silaDni = 0;
      aerobMin = 0;
      intensywne = 0;
    }

    let zalecenie: Zalecenie;
    let powod: string;

    if (i === 0 && gotowosc.stan === 'czerwona') {
      zalecenie = 'odpoczynek';
      powod = 'Organizm nie odrobił: ' + gotowosc.powody.join(', ') + '.';
    } else if (zRzedu >= CELE.maxDniZRzedu) {
      zalecenie = 'odpoczynek';
      powod = `${zRzedu} dni z rzędu z treningiem. Przerwa nie jest nagrodą, tylko częścią bodźca.`;
    } else if (i === 0 && gotowosc.stan === 'zolta') {
      zalecenie = 'cardio';
      powod = 'Jeden sygnał odbiega od Twojej normy: ' + gotowosc.powody.join(', ') + '. Objętość tak, intensywność nie.';
    } else if (silaDni < CELE.silaDni && (odSily === null || odSily >= 2)) {
      zalecenie = 'sila';
      powod = `Siła ${silaDni} z ${CELE.silaDni} dni w tym tygodniu, od ostatniej ${odSily === null ? 'dawno' : `${odSily} dni`}.`;
    } else if (intensywne < CELE.intensywneSesje && gotowosc.stan === 'zielona') {
      zalecenie = 'interwaly';
      powod = 'W tym tygodniu nie było jeszcze nic naprawdę intensywnego, a to najsłabszy punkt Twojego tygodnia.';
    } else if (aerobMin < CELE.aerobMin) {
      zalecenie = 'cardio';
      powod = `Aerobowo ${aerobMin} z ${CELE.aerobMin} minut w tym tygodniu.`;
    } else if (silaDni < CELE.silaDni) {
      zalecenie = 'sila';
      powod = `Siła ${silaDni} z ${CELE.silaDni} dni, ale od ostatniej minął dopiero ${odSily} dzień, więc dopiero po przerwie.`;
    } else {
      zalecenie = 'mobilnosc';
      powod = 'Cele tygodnia pokryte. Wszystko ponad to jest dodatkiem, nie obowiązkiem.';
    }

    dni.push({
      date: data,
      zalecenie,
      tytul: OPISY[zalecenie].tytul,
      opis: `${powod} ${OPISY[zalecenie].opis}`,
      podstawa: i === 0 ? 'pomiar' : 'szkielet',
    });

    // Symulacja nastepnego dnia: zakladamy, ze zalecenie zostalo wykonane.
    if (zalecenie === 'odpoczynek') {
      zRzedu = 0;
    } else {
      zRzedu++;
      if (zalecenie === 'sila') { silaDni++; odSily = 0; }
      else if (odSily !== null) odSily++;
      if (zalecenie === 'cardio') aerobMin += 50;
      if (zalecenie === 'interwaly') { intensywne++; aerobMin += 35; }
    }
  }

  return { gotowosc, tydzien, dni };
}
