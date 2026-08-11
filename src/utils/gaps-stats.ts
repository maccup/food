/**
 * Przerwy miedzy podejsciami do jedzenia.
 *
 * Jedna implementacja dla widoku dnia i dla statystyk. Dwie kopie tego samego
 * algorytmu rozjechalyby sie przy pierwszej zmianie regul, a to najwazniejsza
 * liczba w tej bazie: po rezygnacji z prokinetyku czyste przerwy sa jedynym
 * narzedziem antynawrotowym, wiec musza znaczyc to samo wszedzie.
 */

import { hhmmToMinutes } from '../views/ui';

export interface PosilekDoPrzerw {
  id: number;
  sitting: number | null;
  eaten_at: string | null;
  duration_min: number | null;
  kcal: number | null;
  stan: string;
}

export interface RegulyPrzerw {
  /** Ponizej tylu kalorii pozycja nie przerywa przerwy. Woda i czarne espresso. */
  progKcal: number;
  /** Ile trwa posilek, gdy nie podano. */
  domyslneTrwanie: number;
}

/**
 * Przerwa przed kazdym posilkiem, ktory otwiera nowe podejscie, w minutach.
 *
 * Klucz mapy to id posilku, przed ktorym przerwa wystapila. Posilki w tym samym
 * podejsciu (deser, kawa po obiedzie) nie generuja przerwy miedzy soba, tylko
 * przesuwaja koniec podejscia. Wpisy poza podejsciami (`sitting` 0 albo NULL)
 * licza sie osobno, kazdy z wlasnym kluczem.
 *
 * Lista musi byc posortowana po godzinie.
 */
export function przerwyDnia(
  lista: PosilekDoPrzerw[],
  reguly: RegulyPrzerw
): Map<number, number> {
  const liczySie = (m: PosilekDoPrzerw) =>
    Boolean(m.eaten_at) && m.stan === 'zjedzony' && (m.kcal ?? 0) >= reguly.progKcal;
  const podejscie = (m: PosilekDoPrzerw) => (m.sitting ? `s${m.sitting}` : `m${m.id}`);
  const koniec = (m: PosilekDoPrzerw) =>
    hhmmToMinutes(m.eaten_at!) + (m.duration_min ?? reguly.domyslneTrwanie);

  const out = new Map<number, number>();
  let poprzedniKoniec: number | null = null;
  let poprzednieId: string | null = null;

  for (const m of lista) {
    if (!liczySie(m)) continue;

    if (poprzedniKoniec !== null && podejscie(m) !== poprzednieId) {
      out.set(m.id, hhmmToMinutes(m.eaten_at!) - poprzedniKoniec);
    }

    poprzedniKoniec =
      podejscie(m) === poprzednieId ? Math.max(poprzedniKoniec ?? 0, koniec(m)) : koniec(m);
    poprzednieId = podejscie(m);
  }

  return out;
}

/**
 * Koniec ostatniego podejscia tego dnia, w minutach od polnocy, albo null,
 * gdy nic sie jeszcze nie liczy.
 *
 * To ten sam „ostatni kes", od ktorego `przerwyDnia` mierzy przerwe: pozycje
 * ponizej progu kalorycznego sa pomijane, a deser i kawa w tym samym podejsciu
 * przesuwaja koniec do przodu. Dzieki temu godzina „najwczesniej mozesz zjesc"
 * w panelu i przerwa wypisana przy posilku nie moga podac dwoch roznych liczb.
 *
 * Lista musi byc posortowana po godzinie.
 */
export function koniecOstatniegoPodejscia(
  lista: PosilekDoPrzerw[],
  reguly: RegulyPrzerw
): number | null {
  let koniec: number | null = null;

  for (const m of lista) {
    if (!m.eaten_at || m.stan !== 'zjedzony' || (m.kcal ?? 0) < reguly.progKcal) continue;
    const k = hhmmToMinutes(m.eaten_at) + (m.duration_min ?? reguly.domyslneTrwanie);
    if (koniec === null || k > koniec) koniec = k;
  }

  return koniec;
}

export interface StatystykaPrzerw {
  /** Dni, w ktorych byla co najmniej jedna przerwa do policzenia. */
  dni: number;
  /** Liczba policzonych przerw. */
  przerwy: number;
  /** Srednia przerwa w minutach. */
  srednia: number;
  /** Najkrotsza przerwa w calym zakresie. */
  najkrotsza: number | null;
  /** Ile przerw zeszlo ponizej progu. */
  ponizejProgu: number;
  /** W ilu dniach zdarzyla sie chociaz jedna taka przerwa. */
  dniPonizejProgu: number;
}

/**
 * Przerwy z wielu dni naraz. Posilki przychodza jednym zapytaniem po calym
 * zakresie i sa tu grupowane po dacie, bo przerwa nie przechodzi przez polnoc:
 * noc jest najdluzsza przerwa doby i liczenie jej razem z dziennymi zaklamaloby
 * kazda srednia.
 */
export function statystykaPrzerw(
  lista: Array<PosilekDoPrzerw & { date: string }>,
  reguly: RegulyPrzerw,
  progMinut: number
): StatystykaPrzerw {
  const poDacie = new Map<string, Array<PosilekDoPrzerw & { date: string }>>();
  for (const m of lista) {
    if (!poDacie.has(m.date)) poDacie.set(m.date, []);
    poDacie.get(m.date)!.push(m);
  }

  let suma = 0;
  let przerwy = 0;
  let dni = 0;
  let najkrotsza: number | null = null;
  let ponizejProgu = 0;
  let dniPonizejProgu = 0;

  for (const dzien of poDacie.values()) {
    const wynik = przerwyDnia(dzien, reguly);
    if (wynik.size === 0) continue;

    dni++;
    let krotkaTegoDnia = false;
    for (const minuty of wynik.values()) {
      przerwy++;
      suma += minuty;
      if (najkrotsza === null || minuty < najkrotsza) najkrotsza = minuty;
      if (minuty < progMinut) {
        ponizejProgu++;
        krotkaTegoDnia = true;
      }
    }
    if (krotkaTegoDnia) dniPonizejProgu++;
  }

  return {
    dni,
    przerwy,
    srednia: przerwy ? Math.round(suma / przerwy) : 0,
    najkrotsza,
    ponizejProgu,
    dniPonizejProgu,
  };
}
