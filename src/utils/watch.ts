/**
 * Dane z zegarka: definicje metryk, norma liczona z wlasnej historii i sygnaly.
 *
 * Jedno miejsce, bo czytaja to dwa ekrany (dzien i statystyki), a rozjazd progu
 * miedzy nimi znaczylby, ze ten sam dzien raz jest w normie, a raz poza.
 *
 * NORMA JEST WLASNA, nie populacyjna. HRV zdrowych doroslych rozciaga sie od
 * kilkunastu do ponad stu milisekund, wiec „norma z podrecznika" nie mowi nic o
 * konkretnym czlowieku. Znaczenie ma dopiero to, czy dzisiejsza liczba odstaje
 * od wlasnych ostatnich miesiecy, i tak licza sie tu progi.
 */

export interface WatchRow {
  date: string;
  hrv_noc: number | null;
  hrv: number | null;
  hrv_pomiarow: number | null;
  rhr: number | null;
  sen_min: number | null;
  sen_gleboki_min: number | null;
  sen_rem_min: number | null;
  sen_budzenia_min: number | null;
  zasniecie: string | null;
  temperatura: number | null;
  oddech: number | null;
  spo2: number | null;
  kroki: number | null;
  kcal_aktywne: number | null;
  min_ruchu: number | null;
  kcal_bazowe: number | null;
  vo2max: number | null;
  waga: number | null;
  tetno_marsz: number | null;
}

export interface Bilans {
  spalone: number;
  zjedzone: number;
  /** Zjedzone minus spalone. Ujemne znaczy deficyt. */
  saldo: number;
  /** Przemiana podstawowa uzyta w rachunku. */
  bazowe: number;
  aktywne: number;
  /** Czy przemiana podstawowa pochodzi z wzoru Apple, czy z ustawienia. Widoczne w UI, bo zmienia wynik o setki kcal. */
  bazoweZZegarka: boolean;
}

/**
 * Bilans doby.
 *
 * Zwraca null dla doby niekompletnej, i to jest istota tej funkcji, a nie
 * zabezpieczenie na wszelki wypadek. Przemiana podstawowa narasta przez cala
 * dobe, wiec o poludniu wynosi polowe tego, co wyniesie wieczorem. Bilans dnia
 * dzisiejszego pokazywalby gigantyczna nadwyzke przy kazdym sniadaniu i uczyl
 * ignorowac te liczbe.
 */
export function bilans(
  zjedzone: number | null | undefined,
  w: WatchRow | null | undefined,
  kompletna: boolean,
  bmrWlasny?: number | null
): Bilans | null {
  if (!kompletna || !w || typeof zjedzone !== 'number' || !zjedzone) return null;

  /*
   * Wlasna przemiana podstawowa wygrywa z liczba z zegarka, gdy jest ustawiona.
   * Apple liczy ja ze wzoru na masie i wieku, wiec nie wie nic o skladzie ciala,
   * a roznica wobec rachunku z masy beztluszczowej siega u Macka 250 kcal na
   * dobe. Przy deficycie rzedu 400 kcal to nie jest korekta, tylko polowa wyniku.
   */
  const wlasna = typeof bmrWlasny === 'number' && bmrWlasny > 0 ? bmrWlasny : null;
  const bazowe = wlasna ?? w.kcal_bazowe;
  if (typeof bazowe !== 'number') return null;

  const aktywne = w.kcal_aktywne ?? 0;
  const spalone = bazowe + aktywne;
  return { spalone, zjedzone, saldo: zjedzone - spalone, bazowe, aktywne, bazoweZZegarka: wlasna === null };
}

/*
 * Bilans opisujemy ZDANIEM, nie liczba ze znakiem, i nie uzywamy slow „deficyt",
 * „nadwyzka" ani „saldo".
 *
 * Powod jest konkretny: „deficyt 150 kcal" plus „−0,14 kg" to dwa zaprzeczenia
 * w jednej linijce i za kazdym razem trzeba sie zastanowic, czy to znaczy chudne,
 * czy tyje. Maciek pytal o to dwa razy pod rzad, wiec ekran byl po prostu zle
 * napisany. Zdanie „jesz o 150 kcal mniej, niz spalasz" czyta sie raz.
 *
 * Nie wracac do wersji z „deficytem", nawet gdyby byla krotsza.
 */
export function zdanieBilansu(saldo: number): string {
  const v = Math.abs(Math.round(saldo));
  if (v < 50) return 'Jesz mniej więcej tyle, ile spalasz';
  return saldo < 0
    ? `Jesz o ${v} kcal mniej, niż spalasz`
    : `Jesz o ${v} kcal więcej, niż spalasz`;
}

export function zdanieMasy(kgTydzien: number): string {
  const v = Math.abs(kgTydzien);
  if (v < 0.05) return 'W tym tempie masa ciała stoi w miejscu';
  const liczba = v.toFixed(2).replace('.', ',');
  return kgTydzien < 0
    ? `W tym tempie chudniesz ${liczba} kg na tydzień`
    : `W tym tempie tyjesz ${liczba} kg na tydzień`;
}

/**
 * Ile kilogramow tygodniowo oznacza takie dzienne saldo.
 *
 * 7700 kcal na kilogram to przelicznik przyjety powszechnie i jednoczesnie
 * uproszczony: pochodzi z energii czystego tluszczu, a realny ubytek masy to
 * zawsze mieszanka tluszczu, wody i tkanki beztluszczowej. Sluzy do
 * oszacowania rzedu wielkosci, nie do prognozy.
 */
export const KCAL_NA_KILOGRAM = 7700;

export function kgNaTydzien(sredniedzienne: number): number {
  return (sredniedzienne * 7) / KCAL_NA_KILOGRAM;
}

/** Ktora strona skali jest gorsza. Decyduje o kolorze i o tym, ktory ogon lapie sygnal. */
export type Kierunek = 'wyzej' | 'nizej';

export interface Metryka {
  key: keyof WatchRow;
  label: string;
  /** Nazwa na wiersz w widoku dnia, gdzie na pelna nie ma miejsca. Trzymana tu, a nie w widoku, zeby istniala jedna. */
  krotko: string;
  /** 'wyzej' znaczy, ze wyzej jest lepiej, wiec sygnal lapie dolny ogon. */
  kierunek: Kierunek;
  format: (v: number) => string;
  /** Po co to trzymamy, jednym zdaniem, jezykiem bez zargonu. */
  poCo: string;
  /** Co znaczy odchylenie w zla strone. Puste dla metryk czysto opisowych. */
  sygnal?: string;
}

const liczba = (v: number, cyfry = 0) =>
  v.toFixed(cyfry).replace('.', ',').replace(/,0$/, '');

const godziny = (min: number) =>
  `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')}`;

/*
 * Kolejnosc jest kolejnoscia wagi dla naszego pytania, nie kolejnoscia z
 * aplikacji Zdrowie. Pierwsze trzy odpowiadaja na „czy organizm byl wczoraj
 * obciazony", reszta jest kontekstem.
 */
export const METRYKI: Metryka[] = [
  {
    key: 'hrv_noc',
    label: 'HRV w nocy',
    krotko: 'HRV',
    kierunek: 'wyzej',
    format: (v) => `${liczba(v, 1)} ms`,
    poCo:
      'Odstępy między uderzeniami serca nigdy nie są równe, a HRV mierzy tę nierówność. ' +
      'Im większa, tym mocniej pracuje nerw błędny, czyli ta część układu nerwowego, ' +
      'która uspokaja organizm i rozkręca trawienie. To ten sam nerw, który steruje ruchami jelita.',
    sygnal:
      'Spadek poniżej Twojej normy znaczy, że organizm był w trybie mobilizacji, ' +
      'a nie regeneracji. Właśnie wtedy jelito zwalnia.',
  },
  {
    key: 'rhr',
    label: 'Tętno spoczynkowe',
    krotko: 'tętno',
    kierunek: 'nizej',
    format: (v) => `${liczba(v)} /min`,
    poCo:
      'Ile razy serce bije na minutę, gdy nic nie robisz. Rośnie przy infekcji, ' +
      'niedospaniu, alkoholu i długim obciążeniu.',
    sygnal:
      'Wzrost o kilka uderzeń ponad Twoją normę to najprostszy sygnał, ' +
      'że coś się dzieje, zanim jeszcze cokolwiek poczujesz.',
  },
  {
    key: 'sen_min',
    label: 'Sen',
    krotko: 'sen',
    kierunek: 'wyzej',
    format: godziny,
    poCo:
      'Sam sen, bez wybudzeń i bez leżenia w łóżku. Krótka noc podnosi tętno ' +
      'i obniża HRV następnego dnia, więc bez tej liczby nie da się odróżnić stresu od niewyspania.',
    sygnal: 'Noc poniżej Twojej normy tłumaczy większość jednodniowych spadków HRV.',
  },
  {
    key: 'temperatura',
    label: 'Temperatura nadgarstka',
    krotko: 'temperatura',
    kierunek: 'nizej',
    format: (v) => `${liczba(v, 2)} °C`,
    poCo:
      'Zegarek mierzy ją przez całą noc, więc łapie wahania za małe, żeby je poczuć.',
    sygnal:
      'Wzrost ponad Twoją normę wyprzedza infekcję zwykle o dobę. ' +
      'Przy antybiotyku i problemach jelitowych to warto wiedzieć wcześniej.',
  },
  {
    key: 'oddech',
    label: 'Oddechy podczas snu',
    krotko: 'oddech',
    kierunek: 'nizej',
    format: (v) => `${liczba(v, 1)} /min`,
    poCo: 'Ile razy oddychasz na minutę we śnie.',
    sygnal: 'Przyspieszenie idzie zwykle w parze ze wzrostem temperatury i tętna.',
  },
  {
    key: 'sen_gleboki_min',
    label: 'Sen głęboki',
    krotko: 'sen głęboki',
    kierunek: 'wyzej',
    format: (v) => `${liczba(v)} min`,
    poCo: 'Faza, w której organizm najmocniej się regeneruje. Waha się mocno z nocy na noc, więc pojedyncza liczba niewiele znaczy.',
  },
  {
    key: 'sen_rem_min',
    label: 'REM',
    krotko: 'REM',
    kierunek: 'wyzej',
    format: (v) => `${liczba(v)} min`,
    poCo: 'Faza snu związana z przetwarzaniem emocji. Skraca ją alkohol i późna kolacja.',
  },
  {
    key: 'kroki',
    label: 'Kroki',
    krotko: 'kroki',
    kierunek: 'wyzej',
    format: (v) => liczba(v),
    poCo: 'Ruch to niezależny czynnik przyspieszający pracę jelita, więc dzień bez kroków tłumaczy część zaparć bez udziału stresu.',
  },
  {
    key: 'kcal_aktywne',
    label: 'Kalorie aktywne',
    krotko: 'aktywne',
    kierunek: 'wyzej',
    format: (v) => `${liczba(v)} kcal`,
    poCo:
      'Wydatek ponad spoczynek, czyli to, co dołożył ruch. Zegarek liczy go z tętna i ruchu, ' +
      'więc przy sile i noszeniu ciężarów potrafi się pomylić o kilkadziesiąt procent.',
  },
  {
    key: 'kcal_bazowe',
    label: 'Przemiana podstawowa',
    krotko: 'bazowe',
    kierunek: 'wyzej',
    format: (v) => `${liczba(v)} kcal`,
    poCo:
      'Ile organizm spala leżąc bez ruchu. To NIE jest pomiar, tylko wzór z wieku, wzrostu, ' +
      'masy i płci, więc nieaktualna waga w profilu iPhone przesuwa całą kolumnę.',
  },
  {
    key: 'min_ruchu',
    label: 'Minuty ćwiczeń',
    krotko: 'ćwiczenia',
    kierunek: 'wyzej',
    format: (v) => `${liczba(v)} min`,
    poCo: 'Czas, przez który tętno trzymało poziom co najmniej żwawego marszu.',
  },
  {
    key: 'vo2max',
    label: 'VO2max',
    krotko: 'VO2max',
    kierunek: 'wyzej',
    format: (v) => `${liczba(v, 1)} ml/kg/min`,
    poCo:
      'Ile tlenu organizm potrafi zużyć przy maksymalnym wysiłku. Ze wszystkiego, co ten zegarek liczy, ' +
      'to najsilniejszy pojedynczy wskaźnik przewidujący długość życia. Zmienia się miesiącami, nie dobami, ' +
      'więc nie ma sensu patrzeć na pojedynczy dzień.',
  },
  {
    key: 'spo2',
    label: 'Wysycenie tlenem',
    krotko: 'tlen',
    kierunek: 'wyzej',
    format: (v) => `${liczba(v * 100, 1)} %`,
    poCo: 'Ile tlenu niesie krew. Spadki w nocy chodzą w parze z bezdechem sennym.',
  },
  {
    key: 'tetno_marsz',
    label: 'Tętno w marszu',
    krotko: 'tętno marsz',
    kierunek: 'nizej',
    format: (v) => `${liczba(v)} /min`,
    poCo: 'Tętno przy zwykłym chodzeniu. Spada, gdy rośnie wydolność, więc czyta się je razem z VO2max.',
  },
];

/** Metryki, ktore moga odpalic sygnal „na co zwrocic uwage". Reszta jest opisowa. */
export const METRYKI_SYGNALOWE = METRYKI.filter((m) => m.sygnal);

export interface Norma {
  n: number;
  mediana: number;
  p10: number;
  p90: number;
}

/*
 * Ponizej trzydziestu dni norma nie powstaje w ogole. Przy dziesieciu dniach
 * decyle sa szumem i kazdy trzeci dzien wygladalby na nietypowy, co po tygodniu
 * nauczyloby ignorowac wszystkie ostrzezenia.
 */
export const MIN_DNI_NORMY = 30;

function decyl(posortowane: number[], p: number): number {
  const i = (posortowane.length - 1) * p;
  const dol = Math.floor(i);
  const gora = Math.ceil(i);
  return posortowane[dol] + (posortowane[gora] - posortowane[dol]) * (i - dol);
}

export function norma(wartosci: number[]): Norma | null {
  const v = wartosci.filter((x) => x !== null && Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length < MIN_DNI_NORMY) return null;
  return { n: v.length, mediana: decyl(v, 0.5), p10: decyl(v, 0.1), p90: decyl(v, 0.9) };
}

export function normy(dni: WatchRow[]): Map<string, Norma> {
  const out = new Map<string, Norma>();
  for (const m of METRYKI) {
    const n = norma(dni.map((d) => d[m.key] as number).filter((x): x is number => typeof x === 'number'));
    if (n) out.set(m.key, n);
  }
  return out;
}

export type Stan = 'ok' | 'poza';

/** Czy wartosc wypadla poza norme po zlej stronie. Odchylenie w dobra strone nie jest problemem. */
export function stan(m: Metryka, wartosc: number, n: Norma | undefined): Stan {
  if (!n) return 'ok';
  return m.kierunek === 'wyzej'
    ? wartosc < n.p10 ? 'poza' : 'ok'
    : wartosc > n.p90 ? 'poza' : 'ok';
}

export interface Sygnal {
  metryka: Metryka;
  wartosc: number;
  norma: Norma;
}

/** Co w danym dniu odstaje po zlej stronie. Pusta lista znaczy dzien typowy. */
export function sygnaly(dzien: WatchRow | null, n: Map<string, Norma>): Sygnal[] {
  if (!dzien) return [];
  const out: Sygnal[] = [];
  for (const m of METRYKI_SYGNALOWE) {
    const v = dzien[m.key];
    const nm = n.get(m.key as string);
    if (typeof v === 'number' && nm && stan(m, v, nm) === 'poza') {
      out.push({ metryka: m, wartosc: v, norma: nm });
    }
  }
  return out;
}

/** Odchylenie od mediany w procentach, do krotkiego dopisku obok liczby. */
export function odchylenie(wartosc: number, n: Norma | undefined): string {
  if (!n || !n.mediana) return '';
  const p = Math.round((wartosc / n.mediana - 1) * 100);
  return p === 0 ? 'w normie' : `${p > 0 ? '+' : '−'}${Math.abs(p)}%`;
}
