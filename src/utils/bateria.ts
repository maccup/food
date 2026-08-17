import { WatchRow, Norma } from './watch';
import { POTRZEBA_SNU_MIN, Zalecenie } from './trening';

/**
 * Bateria dnia: jeden procent odpowiadajacy na pytanie „z jakim zapasem
 * energii wstalem". Ten sam pomysl co „recovery" Whoopa i „body battery"
 * Garmina, tylko policzony jawnie: kazdy skladnik ma wage, wartosc i zdanie,
 * wiec liczbe da sie rozlozyc z powrotem na czesci.
 *
 * To jest SZACUNEK z nocy, nie pomiar energii. Trzy skladniki bazowe wazone:
 *
 *   sen    40   ile snu wobec potrzeby (450 min, ta sama stala co plan
 *               treningowy w trening.ts, jego mediana z 60 dni to 453)
 *   HRV    35   pozycja nocnej mediany wobec wlasnej normy 180 dni
 *   tetno  25   jak wyzej, tylko ze zla strona jest gora
 *
 * Od sredniej wazonej odchodza obciazenia z WCZORAJ: mocny trening, ktory
 * trzeba odrobic, dlugi ciag dni bez przerwy i wpisany wieczorem stres.
 * Obciazenia sa odejmowane, nie wazone, bo odpowiadaja na inne pytanie:
 * baza mowi, jak organizm sie zregenerowal, obciazenia mowia, ile z tej
 * regeneracji jest juz zarezerwowane.
 *
 * Skladnik bez danych wypada, a wagi pozostalych rosna proporcjonalnie.
 * Bez ani jednego skladnika bazowego baterii nie ma (null), bo procent
 * z samych obciazen bylby zgadywaniem ubranym w liczbe.
 */

export interface SkladnikBaterii {
  nazwa: string;
  /** 0 do 100 dla skladnikow bazowych, ujemne punkty dla obciazen. */
  wartosc: number;
  /** Zdanie z liczbami zrodlowymi, do wypisania pod procentem. */
  opis: string;
  typ: 'baza' | 'obciazenie';
}

export interface Bateria {
  procent: number;
  poziom: 'wysoki' | 'sredni' | 'niski';
  skladniki: SkladnikBaterii[];
  /** Czego zabraklo do pelnego rachunku, jezykiem uzytkownika. */
  braki: string[];
}

const godz = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')}`;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Pozycja wartosci wobec wlasnej normy, w skali 0 do 100.
 *
 * Kotwice: zly decyl daje 30, mediana 75, dobry decyl 100. Mediana celowo
 * NIE daje setki: typowy dzien ma byc dobry, ale ma zostawac widoczna
 * przestrzen na dzien naprawde swietny, inaczej skala klamie w obie strony.
 * Ponizej zlego decyla zjazd jest liniowy do zera przy odchyleniu o kolejna
 * szerokosc pasma p10-p90, zeby fatalna noc nie wygladala jak przecietna.
 */
function pozycja(v: number, n: Norma, kierunek: 'wyzej' | 'nizej'): number {
  const [zly, dobry] = kierunek === 'wyzej' ? [n.p10, n.p90] : [n.p90, n.p10];
  const szer = Math.abs(dobry - zly) || 1;
  const doDobrego = kierunek === 'wyzej' ? v - n.mediana : n.mediana - v;
  const doZlego = kierunek === 'wyzej' ? v - zly : zly - v;

  if (doDobrego >= 0) {
    const gora = Math.abs(dobry - n.mediana) || 1;
    return clamp(75 + (doDobrego / gora) * 25, 75, 100);
  }
  if (doZlego >= 0) {
    const dol = Math.abs(n.mediana - zly) || 1;
    return clamp(30 + (doZlego / dol) * 45, 30, 75);
  }
  return clamp(30 + (doZlego / szer) * 30, 0, 30);
}

export function policzBaterie(dane: {
  doba: WatchRow;
  normy: Map<string, Norma>;
  /** Stres wpisany POPRZEDNIEGO dnia, 0 do 10, null gdy brak wpisu. */
  stresWczoraj: number | null;
  /** Dni z trescia treningowa z rzedu, liczone do wczoraj wlacznie. */
  dniZRzedu: number;
  /** Czy wczoraj byla sesja intensywna (prog z trening.ts). */
  intensywnaWczoraj: boolean;
}): Bateria | null {
  const baza: Array<{ waga: number; s: SkladnikBaterii }> = [];
  const braki: string[] = [];

  if (typeof dane.doba.sen_min === 'number') {
    const score = clamp((dane.doba.sen_min / POTRZEBA_SNU_MIN) * 100, 0, 100);
    baza.push({
      waga: 40,
      s: {
        nazwa: 'Sen', wartosc: Math.round(score), typ: 'baza',
        opis: `${godz(dane.doba.sen_min)} z potrzebnych ${godz(POTRZEBA_SNU_MIN)}`,
      },
    });
  } else braki.push('bez pomiaru snu');

  const hrv = dane.doba.hrv_noc ?? dane.doba.hrv;
  const nHrv = dane.normy.get('hrv_noc');
  if (typeof hrv === 'number' && nHrv) {
    baza.push({
      waga: 35,
      s: {
        nazwa: 'HRV w nocy', wartosc: Math.round(pozycja(hrv, nHrv, 'wyzej')), typ: 'baza',
        opis: `${hrv.toFixed(1).replace('.', ',')} ms przy Twojej medianie ${nHrv.mediana.toFixed(1).replace('.', ',')}`,
      },
    });
  } else braki.push(typeof hrv === 'number' ? 'HRV bez normy (za mało historii)' : 'bez pomiaru HRV');

  const nRhr = dane.normy.get('rhr');
  if (typeof dane.doba.rhr === 'number' && nRhr) {
    baza.push({
      waga: 25,
      s: {
        nazwa: 'Tętno spoczynkowe', wartosc: Math.round(pozycja(dane.doba.rhr, nRhr, 'nizej')), typ: 'baza',
        opis: `${Math.round(dane.doba.rhr)}/min przy Twojej medianie ${Math.round(nRhr.mediana)}`,
      },
    });
  } else braki.push(typeof dane.doba.rhr === 'number' ? 'tętno bez normy' : 'bez pomiaru tętna');

  if (!baza.length) return null;

  const wagi = baza.reduce((a, x) => a + x.waga, 0);
  let procent = baza.reduce((a, x) => a + x.s.wartosc * (x.waga / wagi), 0);

  const obciazenia: SkladnikBaterii[] = [];
  if (dane.intensywnaWczoraj) {
    obciazenia.push({
      nazwa: 'Wczorajszy trening', wartosc: -10, typ: 'obciazenie',
      opis: 'intensywna sesja do odrobienia',
    });
  }
  if (dane.dniZRzedu >= 4) {
    obciazenia.push({
      nazwa: 'Ciąg bez przerwy', wartosc: -5, typ: 'obciazenie',
      opis: `${dane.dniZRzedu} dni treningu z rzędu`,
    });
  }
  if (dane.stresWczoraj !== null && dane.stresWczoraj >= 5) {
    obciazenia.push({
      nazwa: 'Wczorajszy stres', wartosc: dane.stresWczoraj >= 7 ? -15 : -8, typ: 'obciazenie',
      opis: `wpisane ${dane.stresWczoraj}/10`,
    });
  }

  procent = clamp(procent + obciazenia.reduce((a, o) => a + o.wartosc, 0), 5, 100);
  const p = Math.round(procent);

  return {
    procent: p,
    poziom: p >= 70 ? 'wysoki' : p >= 45 ? 'sredni' : 'niski',
    skladniki: [...baza.map((x) => x.s), ...obciazenia],
    braki,
  };
}

/** Jedno zdanie akcji do poziomu. Wypisywane tylko dla dnia dzisiejszego. */
export const ZDANIE_BATERII: Record<Bateria['poziom'], string> = {
  wysoki: 'Dobry dzień na pełny trening i trudne rzeczy.',
  sredni: 'Zwykły dzień: objętość tak, szczyty niekoniecznie.',
  niski: 'Organizm na rezerwie: przesuń intensywny wysiłek, wieczorem połóż się wcześniej.',
};

/**
 * Jedna rekomendacja na dzien, liczona PO wpisaniu oceny subiektywnej.
 * Zastepuje w widoku ogolne zdanie ZDANIE_BATERII, zeby ekran nie mowil
 * dwoch rzeczy naraz.
 *
 * Regula kierunku: ocena moze zalecenie wylacznie OBNIZYC, nigdy podbic.
 * Zmeczony czlowiek z dobra noca to normalne zjawisko (stres, praca, dzien
 * bez slonca) i wtedy wygrywa czlowiek. Odwrotnie nie: dobre samopoczucie
 * przy zlej nocy to najczestszy sposob, w jaki ludzie wchodza w przetrenowanie,
 * wiec entuzjazm nie odblokowuje intensywnosci, ktorej zabronila noc.
 */
export function rekomendacjaDnia(
  procent: number,
  ocena: number,
  plan: { zalecenie: Zalecenie; tytul: string } | null
): string {
  const efekt = Math.min(procent, ocena * 10);
  // Zrodlo decyzji wypisujemy tylko przy rozjezdzie: gdy oba mowia to samo,
  // dopisek bylby szumem.
  const zrodlo = ocena * 10 < procent - 15
    ? ' Decyduje Twoja ocena, nie algorytm.'
    : procent < ocena * 10 - 15
      ? ' Decyduje noc, nie samopoczucie.'
      : '';

  if (plan?.zalecenie === 'zrobione') {
    return efekt < 45
      ? 'Trening dziś już był i więcej nie dokładaj. Wieczorem najwyżej spacer, światło gaszone 30 minut wcześniej.'
      : 'Trening dziś już był. Reszta dnia zwyczajnie, bez drugiej sesji.';
  }
  if (efekt < 45) {
    return `Regeneracja zamiast planu: spacer albo mobilność, bez ciężarów i interwałów, wieczorem połóż się wcześniej.${zrodlo}`;
  }
  if (efekt < 70) {
    return plan && (plan.zalecenie === 'sila' || plan.zalecenie === 'interwaly')
      ? `Zejdź z intensywności: zamiast „${plan.tytul}" spokojne cardio albo dłuższy spacer.${zrodlo}`
      : `Zwykły dzień: ${plan ? `„${plan.tytul}" z planu wystarczy` : 'utrzymaj rytm'}, nic ponad to.${zrodlo}`;
  }
  return plan
    ? `Jedziesz z planem: ${plan.tytul.toLowerCase()}. Dobry dzień też na trudne rzeczy poza treningiem.`
    : 'Pełna bateria: dobry dzień na trening i trudne rzeczy.';
}
