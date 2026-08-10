import { Env } from '../types';

export interface Setting {
  key: string;
  value: string | null;
  label: string;
  hint: string | null;
  kind: string;
  sort: number;
  grupa: string;
}

export interface CateringOrder {
  id: number;
  provider: string;
  order_id: string;
  diet_id: string | null;
  date_from: string;
  date_to: string | null;
  no_delivery: string | null;
  notes: string | null;
}

export async function loadSettings(db: D1Database): Promise<Map<string, string>> {
  const rows = await db.prepare(`SELECT key, value FROM settings`).all<{ key: string; value: string | null }>();
  return new Map((rows.results ?? []).map((r) => [r.key, r.value ?? '']));
}

export async function listSettings(db: D1Database): Promise<Setting[]> {
  const rows = await db.prepare(`SELECT * FROM settings ORDER BY grupa, sort, key`).all<Setting>();
  return rows.results ?? [];
}

export async function listCateringOrders(db: D1Database): Promise<CateringOrder[]> {
  const rows = await db.prepare(
    `SELECT * FROM catering_orders ORDER BY date_from DESC, id DESC`
  ).all<CateringOrder>();
  return rows.results ?? [];
}

/** Godziny trzech okien jedzenia, z ustawień. */
export function sittingTimes(s: Map<string, string>): Record<number, string> {
  return {
    1: s.get('sitting_1_time') || '09:00',
    2: s.get('sitting_2_time') || '14:00',
    3: s.get('sitting_3_time') || '18:30',
  };
}

/**
 * Zakresy dni bez dostawy, zapisane jako "2026-08-21..2026-08-24, 2026-09-11..2026-09-14".
 * Pojedyncza data też jest dozwolona.
 */
export function parseNoDeliveryDates(raw: string | undefined): Set<string> {
  const out = new Set<string>();
  if (!raw) return out;

  for (const chunk of raw.split(',')) {
    const part = chunk.trim();
    if (!part) continue;

    const [from, to] = part.split('..').map((x) => x.trim());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) continue;

    if (!to) {
      out.add(from);
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) continue;

    const d = new Date(`${from}T12:00:00Z`);
    const end = new Date(`${to}T12:00:00Z`);
    // Bezpiecznik na odwrocony zakres i literowke typu 2026-08-21..2027-08-24
    let guard = 0;
    while (d <= end && guard++ < 400) {
      out.add(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }

  return out;
}

/**
 * Dni bez dostawy ze wszystkich zamówień naraz.
 *
 * Zakresy należą do zamówienia, nie do kalendarza: przerwa 21 do 24.08 dotyczy
 * tego konkretnego okresu i po jego zakończeniu nie ma prawa oznaczać kolejnego.
 * Skleja wszystkie, bo zamówienia się nie nakładają, a gdyby kiedyś się nałożyły,
 * suma przerw jest właściwą odpowiedzią.
 */
export async function loadNoDelivery(db: D1Database): Promise<Set<string>> {
  const orders = await listCateringOrders(db);
  const out = new Set<string>();
  for (const o of orders) {
    for (const d of parseNoDeliveryDates(o.no_delivery ?? undefined)) out.add(d);
  }
  return out;
}
