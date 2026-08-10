import { Hono } from 'hono';
import { Env, MealSlot } from '../types';
import { linkMealFoods } from '../utils/link-foods';
import { todayWarsaw } from '../views/ui';

const importRoutes = new Hono<{ Bindings: Env }>();

/**
 * Krok w przegladarce ma byc glupi: pobierz JSON z panelu hfood i przeslij dalej.
 * Cala normalizacja siedzi tutaj, zeby dala sie testowac bez przegladarki.
 *
 * Oczekiwany ksztalt:
 * {
 *   "days": [
 *     { "date": "2026-08-14", "menu": <odpowiedz z /api/diets/dietetic-menu/...> }
 *   ]
 * }
 */

const SLOT_BY_NAME: Record<string, MealSlot> = {
  'sniadanie': 'sniadanie',
  'ii sniadanie': 'ii_sniadanie',
  'obiad': 'obiad',
  'podwieczorek': 'podwieczorek',
  'kolacja': 'kolacja',
};

/** Trzy okna jedzenia zamiast pieciu posilkow: 09:00, 14:00, 18:30. */
const SITTING_BY_SLOT: Record<MealSlot, number> = {
  sniadanie: 1,
  ii_sniadanie: 1,
  obiad: 2,
  podwieczorek: 3,
  kolacja: 3,
  inne: 0,
};

/** "Śniadanie" i "II Śniadanie" na klucz bez polskich znakow i wielkosci liter. */
function slotFromName(name: string): MealSlot {
  const key = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/\s+/g, ' ')
    .trim();
  return SLOT_BY_NAME[key] ?? 'inne';
}

/** Makra przychodza jako polskie stringi: "520,8". */
function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

interface ImportStats {
  days: number;
  mealsInserted: number;
  mealsUpdated: number;
  mealsSkipped: number;
  aliasesNew: number;
  aliasesUnmapped: number;
  linksCreated: number;
  warnings: string[];
}

importRoutes.post('/api/import/hfood', async (c) => {
  const body = await c.req.json<{ days?: Array<{ date?: string; menu?: any }> }>();
  const days = body?.days;

  if (!Array.isArray(days) || days.length === 0) {
    return c.json({ error: 'Brak pola days albo puste' }, 400);
  }

  const stats: ImportStats = {
    days: 0,
    mealsInserted: 0,
    mealsUpdated: 0,
    mealsSkipped: 0,
    aliasesNew: 0,
    aliasesUnmapped: 0,
    linksCreated: 0,
    warnings: [],
  };

  // Liczymy rozne skladniki, nie wystapienia. Ten sam "olej rzepakowy"
  // w pieciu daniach to jedna pozycja do zmapowania, nie piec.
  const unmapped = new Set<string>();

  for (const day of days) {
    const date = day?.date;
    const meals = day?.menu?.dietVariantMeals;

    if (!date || !Array.isArray(meals)) {
      stats.warnings.push(`Dzien bez daty albo bez dietVariantMeals: ${date ?? '(brak daty)'}`);
      continue;
    }
    stats.days++;

    for (const dvm of meals) {
      const slot = slotFromName(String(dvm?.name ?? ''));
      if (slot === 'inne') {
        stats.warnings.push(`${date}: nieznany posilek "${dvm?.name}"`);
      }

      const dishes = Array.isArray(dvm?.dishes) ? dvm.dishes : [];
      const chosen = dishes.find((d: any) => d?.selected) ?? dishes.find((d: any) => d?.defaultDish);

      // Menu jeszcze nieopublikowane: pozycja istnieje, ale bez dania.
      if (!chosen?.dish?.dishName) {
        stats.mealsSkipped++;
        continue;
      }

      const dish = chosen.dish;
      const externalId = chosen.dishScheduleId ? String(chosen.dishScheduleId) : null;

      const existing = await c.env.DB.prepare(
        `SELECT id, external_id FROM meals WHERE date = ? AND slot = ? AND source = 'hfood'`
      )
        .bind(date, slot)
        .first<{ id: number; external_id: string | null }>();

      const values = [
        dish.dishName,
        dish.ingredientsName ?? null,
        num(dish.calories_kcal),
        num(dish.protein),
        num(dish.fat),
        num(dish.carbohydrates),
        num(dish.fiber),
        num(dish.weight),
        externalId,
      ];

      let mealId: number;

      if (existing) {
        // stan, eaten_fraction i notes celowo nietkniete: to sa jego wpisy,
        // a nie dane z cateringu. Wymiana dania w panelu nie cofa odhaczenia.
        await c.env.DB.prepare(
          `UPDATE meals SET name = ?, ingredients_raw = ?, kcal = ?, protein_g = ?,
             fat_g = ?, carbs_g = ?, fiber_g = ?, weight_g = ?, external_id = ?
           WHERE id = ?`
        )
          .bind(...values, existing.id)
          .run();
        mealId = existing.id;
        stats.mealsUpdated++;
      } else {
        // Menu importuje sie na kilka dni naprzod, wiec pudelko na jutro jest
        // planem, nie faktem. Domyslne 'zjedzony' z kolumny dotyczy wpisow
        // robionych po jedzeniu i tutaj byloby klamstwem.
        const inserted = await c.env.DB.prepare(
          `INSERT INTO meals (date, slot, sitting, source, name, ingredients_raw,
             kcal, protein_g, fat_g, carbs_g, fiber_g, weight_g, external_id, stan)
           VALUES (?, ?, ?, 'hfood', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           RETURNING id`
        )
          .bind(
            date,
            slot,
            SITTING_BY_SLOT[slot],
            values[0],
            values[1],
            values[2],
            values[3],
            values[4],
            values[5],
            values[6],
            values[7],
            values[8],
            date > todayWarsaw() ? 'plan' : 'zjedzony'
          )
          .first<{ id: number }>();

        if (!inserted) {
          stats.warnings.push(`${date} ${slot}: nie udalo sie zapisac posilku`);
          continue;
        }
        mealId = inserted.id;
        stats.mealsInserted++;
      }

      // Sklad budujemy od zera, bo danie moglo sie zmienic.
      const powiazania = await linkMealFoods(c.env.DB, mealId, dish.ingredientsName, true);
      stats.aliasesNew += powiazania.nowe;
      stats.linksCreated += powiazania.polaczone;
      for (const a of powiazania.nierozpoznane) unmapped.add(a);
    }
  }

  stats.aliasesUnmapped = unmapped.size;

  return c.json(stats);
});

/** Skladniki czekajace na przypisanie do produktu kanonicznego. */
importRoutes.get('/api/import/unmapped', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT alias, times_seen, first_seen FROM food_aliases
     WHERE food_id IS NULL AND ignored = 0
     ORDER BY times_seen DESC, alias`
  ).all();

  return c.json({ count: rows.results.length, aliases: rows.results });
});

export default importRoutes;
