/**
 * Dlaczego kalendarz maluje dzien na taki kolor, a nie inny.
 *
 * Regula stala wczesniej w `calendar.ts` jako kilka linii w petli rysujacej
 * kratki, wiec dalo sie ja zobaczyc wylacznie jako kolor. Widok dnia liczyl
 * swoje paski wedlug innego progu i nie mowil ani slowa o tym, ktore
 * odchylenie zmienia kolor w kalendarzu. Teraz licza to same funkcje.
 *
 * Kalendarz patrzy **tylko na tluszcz i blonnik**, i to nie jest przeoczenie:
 * tluszcz przy elastazie 151, blonnik przez wlasna obserwacje, ze wiecej
 * blonnika to twardszy stolec. Kalorie, bialko i wegle maja paski na widoku
 * dnia, ale nie zmieniaja koloru kratki.
 */

export type PoziomDnia = 'ok' | 'warn' | 'bad';

/** Makra, ktore decyduja o kolorze kratki w kalendarzu. */
export const MAKRA_KALENDARZA = [
  { key: 'fat_g', label: 'Tłuszcz', unit: 'g' },
  { key: 'fiber_g', label: 'Błonnik', unit: 'g' },
];

/** Pozostale makra: widac je na paskach, ale koloru dnia nie ruszaja. */
export const MAKRA_POZOSTALE = [
  { key: 'kcal', label: 'Kalorie', unit: 'kcal' },
  { key: 'protein_g', label: 'Białko', unit: 'g' },
  { key: 'carbs_g', label: 'Węgle', unit: 'g' },
];

export interface Cel {
  min_value: number | null;
  max_value: number | null;
}

export interface Odchylenie {
  key: string;
  label: string;
  unit: string;
  wartosc: number;
  min: number | null;
  max: number | null;
  kierunek: 'poniżej' | 'powyżej';
  /** Odchylenie przekracza 10 procent granicy, czyli przewaza kolor kratki. */
  duze: boolean;
}

/**
 * Odchylenia od pasma fazy dla podanej listy makr.
 *
 * Prog 10 procent jest ten sam, ktorego uzywal kalendarz od poczatku, i ten sam,
 * po ktorym pasek na widoku dnia robi sie czerwony zamiast zoltego. Jedno miejsce,
 * zeby nie moglo sie rozjechac na dwa rozne „poza pasmem".
 */
export function odchylenia(
  totals: Record<string, any> | null,
  cel: (metric: string) => Cel | undefined,
  makra: Array<{ key: string; label: string; unit: string }>
): Odchylenie[] {
  if (!totals) return [];
  const out: Odchylenie[] = [];

  for (const m of makra) {
    const t = cel(m.key);
    if (!t) continue;

    const wartosc = Number(totals[m.key] ?? 0);
    const min = t.min_value;
    const max = t.max_value;

    if (min !== null && wartosc < min) {
      out.push({ ...m, wartosc, min, max, kierunek: 'poniżej', duze: wartosc < min * 0.9 });
    } else if (max !== null && wartosc > max) {
      out.push({ ...m, wartosc, min, max, kierunek: 'powyżej', duze: wartosc > max * 1.1 });
    }
  }

  return out;
}

/**
 * Kolor kratki. Zakazany produkt bije wszystko, bo to jedyna rzecz na tej liscie,
 * ktora jest decyzja, a nie wynikiem. Zolty zapala sie dopiero przy odchyleniu
 * powyzej 10 procent: kazde przekroczenie pasma o gram malowaloby caly miesiac.
 */
export function poziomDnia(zakazane: number, odchyleniaKalendarza: Odchylenie[]): PoziomDnia {
  if (zakazane > 0) return 'bad';
  if (odchyleniaKalendarza.some((o) => o.duze)) return 'warn';
  return 'ok';
}

/** „Tłuszcz 25 g, pasmo 80 do 100 g" w jednym zdaniu. */
export function opisOdchylenia(o: Odchylenie, pl: (n: number, d?: number) => string): string {
  const pasmo =
    o.min !== null && o.max !== null
      ? `pasmo ${pl(o.min, 0)} do ${pl(o.max, 0)} ${o.unit}`
      : o.min !== null
        ? `minimum ${pl(o.min, 0)} ${o.unit}`
        : `maksimum ${pl(o.max ?? 0, 0)} ${o.unit}`;

  return `${o.label} ${pl(o.wartosc, 0)} ${o.unit}, ${o.kierunek} celu fazy, ${pasmo}`;
}
