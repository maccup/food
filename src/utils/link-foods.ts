/**
 * Dopasowanie skladu posilku do slownika produktow.
 *
 * Ta sama sciezka dla cateringu, kuchni i restauracji, bo inaczej wykluczenia
 * odzywaja sie tylko przy jednym zrodle. Wczesniej ten kod stal w czterech
 * kopiach i tylko import z hfood liczyl times_seen.
 */

import { parseIngredients, stripQuantity } from './ingredients';

export type Dopasowanie =
  /** Alias widziany pierwszy raz, wpisany do kolejki nierozpoznanych. */
  | { kind: 'nowy'; alias: string }
  /** Alias znany, ale swiadomie bez produktu (przyprawy, woda). */
  | { kind: 'bez_produktu'; alias: string; ignored: boolean }
  | { kind: 'produkt'; alias: string; foodId: number };

/**
 * Szuka aliasu doslownie, a gdy nie ma, jeszcze raz bez ilosci.
 * Wersja bez ilosci nie tworzy nowego wpisu w slowniku: "maslo 7 g" ma
 * wskazac maslo, a nie wyladowac w kolejce do przejrzenia.
 */
export async function resolveAlias(
  db: D1Database,
  alias: string,
  liczOdslony = false
): Promise<Dopasowanie> {
  const szukaj = (a: string) =>
    db.prepare(`SELECT alias, food_id, ignored FROM food_aliases WHERE alias = ?`)
      .bind(a).first<{ alias: string; food_id: number | null; ignored: number }>();

  let row = await szukaj(alias);

  if (!row) {
    const bezIlosci = stripQuantity(alias);
    if (bezIlosci && bezIlosci !== alias) row = await szukaj(bezIlosci);
  }

  if (!row) {
    await db.prepare(`INSERT INTO food_aliases (alias, food_id, times_seen) VALUES (?, NULL, 1)`)
      .bind(alias).run();
    return { kind: 'nowy', alias };
  }

  if (liczOdslony) {
    await db.prepare(`UPDATE food_aliases SET times_seen = times_seen + 1 WHERE alias = ?`)
      .bind(row.alias).run();
  }

  if (row.food_id === null) {
    return { kind: 'bez_produktu', alias, ignored: row.ignored === 1 };
  }
  return { kind: 'produkt', alias, foodId: row.food_id };
}

export interface WynikPowiazania {
  /** Aliasy bez produktu, poza tymi swiadomie ignorowanymi (przyprawy, woda). */
  nierozpoznane: string[];
  /** Aliasy widziane pierwszy raz. */
  nowe: number;
  /** Utworzone powiazania posilek z produktem. */
  polaczone: number;
}

/**
 * Przepisuje sklad posilku na powiazania z produktami. Buduje od zera, bo
 * danie moglo sie zmienic.
 */
export async function linkMealFoods(
  db: D1Database,
  mealId: number,
  tekst: string | null | undefined,
  liczOdslony = false
): Promise<WynikPowiazania> {
  await db.prepare(`DELETE FROM meal_foods WHERE meal_id = ?`).bind(mealId).run();

  const wynik: WynikPowiazania = { nierozpoznane: [], nowe: 0, polaczone: 0 };
  if (!tekst) return wynik;

  for (const ing of parseIngredients(tekst)) {
    const hit = await resolveAlias(db, ing.alias, liczOdslony);

    if (hit.kind === 'produkt') {
      await db.prepare(
        `INSERT OR IGNORE INTO meal_foods (meal_id, food_id, amount_note) VALUES (?, ?, ?)`
      ).bind(mealId, hit.foodId, ing.nested ? 'skladnik produktu zlozonego' : null).run();
      wynik.polaczone++;
      continue;
    }

    if (hit.kind === 'nowy') wynik.nowe++;
    if (hit.kind === 'nowy' || !hit.ignored) wynik.nierozpoznane.push(hit.alias);
  }

  return wynik;
}
