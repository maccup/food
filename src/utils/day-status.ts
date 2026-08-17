/**
 * Dlaczego kalendarz maluje dzien na taki kolor, a nie inny.
 *
 * Regula stala wczesniej w `calendar.ts` jako kilka linii w petli rysujacej
 * kratki, wiec dalo sie ja zobaczyc wylacznie jako kolor. Widok dnia liczyl
 * swoje paski wedlug innego progu i nie mowil ani slowa o tym, ktore
 * odchylenie zmienia kolor w kalendarzu. Teraz licza to same funkcje.
 *
 * Kalendarz patrzy **tylko na blonnik**, i to nie jest przeoczenie: jedyna
 * regula makro z podstawa jest wlasna obserwacja, ze wiecej blonnika to
 * twardszy stolec. Tluszcz kolorowal kratke do 17.08.2026 i wypadl decyzja
 * Macka (migracja 064): pasmo 80-100 g bylo jedna linijka od dietetyka bez
 * uzasadnienia, lipidogram z 03.08 wyszedl rekordowy przy diecie powyzej
 * 100 g/dobe, a przeslanke elastazy odrzucil juz audyt 15.08 (migracja 047).
 * Kalorie, bialko, tluszcz i wegle maja paski na widoku dnia, ale nie
 * zmieniaja koloru kratki.
 */

export type PoziomDnia = 'ok' | 'warn' | 'bad';

/** Makra, ktore decyduja o kolorze kratki w kalendarzu. */
export const MAKRA_KALENDARZA = [
  { key: 'fiber_g', label: 'Błonnik', unit: 'g' },
];

/** Pozostale makra: widac je na paskach, ale koloru dnia nie ruszaja. */
export const MAKRA_POZOSTALE = [
  { key: 'kcal', label: 'Kalorie', unit: 'kcal' },
  { key: 'protein_g', label: 'Białko', unit: 'g' },
  { key: 'fat_g', label: 'Tłuszcz', unit: 'g' },
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
 * Jak makro stoi wobec pasma fazy: w normie, poza pasmem, poza pasmem o ponad 10 procent.
 *
 * Ten sam rachunek stal wczesniej w trzech miejscach osobno: w pasku `macroBar`,
 * w wielkich liczbach panelu dnia i w kolorze kratki kalendarza. Trzy kopie
 * jednego progu to trzy okazje, zeby jedna z nich zaczela mowic co innego.
 */
export function stanMakro(wartosc: number, cel?: Cel | null): PoziomDnia {
  if (!cel) return 'ok';
  if (cel.min_value !== null && wartosc < cel.min_value * 0.9) return 'bad';
  if (cel.max_value !== null && wartosc > cel.max_value * 1.1) return 'bad';
  if (cel.min_value !== null && wartosc < cel.min_value) return 'warn';
  if (cel.max_value !== null && wartosc > cel.max_value) return 'warn';
  return 'ok';
}

/** Odchylenia od pasma fazy dla podanej listy makr. */
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

    const stan = stanMakro(wartosc, t);
    if (stan === 'ok') continue;

    out.push({
      ...m, wartosc, min, max,
      kierunek: min !== null && wartosc < min ? 'poniżej' : 'powyżej',
      duze: stan === 'bad',
    });
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
