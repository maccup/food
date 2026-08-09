import { Hono } from 'hono';
import { Env } from '../types';
import { esc, todayWarsaw } from '../views/ui';

const gaps = new Hono<{ Bindings: Env }>();

export interface DayGap {
  group_id: number;
  name: string;
  provides: string | null;
  examples: string | null;
  severity: string;
  needDays: number;
  daysThisWeek: number;
  todayCovered: boolean;
  onShoppingList: boolean;
}

/**
 * Czego brakuje dzisiaj.
 *
 * Tydzień odpowiada na pytanie "jak było", ten widok na pytanie "co zrobić
 * jeszcze dzisiaj". Dlatego liczy dwie rzeczy naraz: czy grupa pojawiła się
 * dziś, i ile dni w tym tygodniu już ma, bo reguła jest tygodniowa.
 */
export async function loadDayGaps(db: D1Database, date: string, weekStart: string): Promise<DayGap[]> {
  const [rules, today, week, shopping] = await Promise.all([
    db.prepare(
      `SELECT r.group_id, r.min_days_per_week, r.severity, g.name, g.provides, g.examples
       FROM coverage_rules r JOIN food_groups g ON g.id = r.group_id
       WHERE (r.active_from IS NULL OR r.active_from <= ?) AND (r.active_to IS NULL OR r.active_to >= ?)
       ORDER BY CASE r.severity WHEN 'critical' THEN 1 WHEN 'important' THEN 2 ELSE 3 END, g.name`
    ).bind(date, date).all<any>(),
    db.prepare(`SELECT group_id FROM v_group_coverage WHERE date = ?`).bind(date).all<any>(),
    db.prepare(
      `SELECT group_id, COUNT(DISTINCT date) AS days FROM v_group_coverage
       WHERE date BETWEEN ? AND ? GROUP BY group_id`
    ).bind(weekStart, date).all<any>(),
    db.prepare(
      `SELECT s.food_id, f.group_id FROM shopping s
       LEFT JOIN foods f ON f.id = s.food_id WHERE s.bought = 0`
    ).all<any>(),
  ]);

  const todaySet = new Set((today.results ?? []).map((r: any) => r.group_id));
  const weekBy = new Map<number, number>((week.results ?? []).map((r: any) => [r.group_id, r.days]));
  const shopSet = new Set((shopping.results ?? []).map((r: any) => r.group_id).filter(Boolean));

  return (rules.results ?? []).map((r: any) => ({
    group_id: r.group_id,
    name: r.name,
    provides: r.provides,
    examples: r.examples,
    severity: r.severity,
    needDays: r.min_days_per_week ?? 0,
    daysThisWeek: weekBy.get(r.group_id) ?? 0,
    todayCovered: todaySet.has(r.group_id),
    onShoppingList: shopSet.has(r.group_id),
  }));
}

export function renderGaps(list: DayGap[], date: string, shoppingOpen: any[]): string {
  const missing = list.filter((g) => !g.todayCovered);
  const done = list.filter((g) => g.todayCovered);

  const row = (g: DayGap) => {
    const behind = g.daysThisWeek < g.needDays;
    const color =
      !behind ? 'var(--ok)' : g.severity === 'critical' ? 'var(--bad)' : 'var(--warn)';

    return `<li>
      <div class="item-content"><div class="item-inner" style="display:block;padding:12px 0">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">
          <b>${esc(g.name)}</b>
          <span style="color:${color};font-weight:700;white-space:nowrap;font-size:13px">
            ${g.daysThisWeek} z ${g.needDays} dni
          </span>
        </div>
        ${g.examples ? `<div style="font-size:13px;margin-top:3px">${esc(g.examples)}</div>` : ''}
        <div style="font-size:12px;color:var(--muted);margin-top:2px">daje: ${esc(g.provides ?? '')}</div>

        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <form method="POST" action="/braki/zjedzone" style="flex:1 1 150px">
            <input type="hidden" name="group_id" value="${g.group_id}">
            <input type="hidden" name="date" value="${date}">
            <button type="submit" class="button button-small button-fill" style="width:100%">Zjedzone dzisiaj</button>
          </form>
          ${
            g.onShoppingList
              ? `<span class="flag info" style="align-self:center">na liście zakupów</span>`
              : `<form method="POST" action="/zakupy/dodaj" style="flex:1 1 150px">
                  <input type="hidden" name="group_id" value="${g.group_id}">
                  <input type="hidden" name="date" value="${date}">
                  <button type="submit" class="button button-small" style="width:100%">Do kupienia</button>
                </form>`
          }
        </div>
      </div></div>
    </li>`;
  };

  const shoppingHtml = shoppingOpen.length
    ? `<div class="list" style="margin:0"><ul>
        ${shoppingOpen.map((s: any) => `<li>
          <div class="item-content"><div class="item-inner" style="padding:6px 0">
            <form method="POST" action="/zakupy/kupione">
              <input type="hidden" name="id" value="${s.id}">
              <input type="hidden" name="date" value="${date}">
              <label class="check" style="min-height:48px">
                <input type="checkbox" name="bought" value="1" onchange="this.form.submit()">
                <span>
                  <b>${esc(s.label)}</b>
                  ${s.note ? `<span style="display:block;font-size:12px;color:var(--muted)">${esc(s.note)}</span>` : ''}
                </span>
              </label>
            </form>
          </div></div>
        </li>`).join('')}
      </ul></div>`
    : '';

  return `
    ${
      missing.length
        ? `<div class="list" style="margin:0"><ul>${missing.map(row).join('')}</ul></div>`
        : `<div style="padding:18px 16px;text-align:center;color:var(--ok);font-size:14px">
             Wszystkie grupy z reguł pojawiły się dzisiaj.
           </div>`
    }
    ${
      done.length
        ? `<div style="padding:10px 16px 0;font-size:12px;color:var(--muted)">
             Dzisiaj już było: ${done.map((g) => esc(g.name.toLowerCase())).join(', ')}
           </div>`
        : ''
    }
    ${shoppingHtml ? `<div style="padding:16px 16px 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)">Do kupienia</div>${shoppingHtml}` : ''}
    <div class="block">
      <form method="POST" action="/zakupy/dodaj" style="display:grid;grid-template-columns:1fr auto;gap:8px">
        <input type="hidden" name="date" value="${date}">
        <input type="text" name="label" placeholder="Dopisz coś do kupienia" required>
        <button type="submit" class="button">Dodaj</button>
      </form>
    </div>`;
}

/** Odhaczenie grupy jako zjedzonej: zapisuje realny posiłek, żeby reguły to zobaczyły. */
gaps.post('/braki/zjedzone', async (c) => {
  const b = await c.req.parseBody();
  const groupId = Number(b.group_id);
  const date = String(b.date || todayWarsaw());

  const group = await c.env.DB.prepare(`SELECT name, examples FROM food_groups WHERE id = ?`)
    .bind(groupId).first<{ name: string; examples: string | null }>();

  // Bierzemy pierwszy produkt z tej grupy, ktory nie jest aktualnie zakazany.
  const food = await c.env.DB.prepare(
    `SELECT f.id, f.name FROM foods f
     WHERE f.group_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM restrictions r
         WHERE (r.food_id = f.id OR r.group_id = f.group_id)
           AND r.level = 'forbidden' AND r.status = 'active'
           AND ? >= r.date_from AND (r.date_to IS NULL OR ? <= r.date_to)
       )
     ORDER BY f.id LIMIT 1`
  ).bind(groupId, date, date).first<{ id: number; name: string }>();

  const inserted = await c.env.DB.prepare(
    `INSERT INTO meals (date, slot, sitting, source, name, ingredients_raw, estimated, notes)
     VALUES (?, 'inne', 0, 'dom', ?, ?, 1, 'dopisane z sekcji o brakach')
     RETURNING id`
  ).bind(
    date,
    group?.name ? `Dodatek: ${group.name.toLowerCase()}` : 'Dodatek',
    group?.examples ?? null
  ).first<{ id: number }>();

  if (inserted && food) {
    await c.env.DB.prepare(`INSERT OR IGNORE INTO meal_foods (meal_id, food_id) VALUES (?, ?)`)
      .bind(inserted.id, food.id).run();
  }

  return c.redirect(`/day/${date}`);
});

gaps.post('/zakupy/dodaj', async (c) => {
  const b = await c.req.parseBody();
  const date = String(b.date || todayWarsaw());
  const groupId = b.group_id ? Number(b.group_id) : null;

  if (groupId) {
    const g = await c.env.DB.prepare(`SELECT name, examples FROM food_groups WHERE id = ?`)
      .bind(groupId).first<{ name: string; examples: string | null }>();
    const food = await c.env.DB.prepare(`SELECT id FROM foods WHERE group_id = ? ORDER BY id LIMIT 1`)
      .bind(groupId).first<{ id: number }>();

    await c.env.DB.prepare(`INSERT INTO shopping (food_id, label, note) VALUES (?, ?, ?)`)
      .bind(food?.id ?? null, g?.name ?? 'Do kupienia', g?.examples ?? null).run();
  } else {
    const label = String(b.label || '').trim();
    if (label) {
      await c.env.DB.prepare(`INSERT INTO shopping (label) VALUES (?)`).bind(label).run();
    }
  }

  return c.redirect(`/day/${date}`);
});

gaps.post('/zakupy/kupione', async (c) => {
  const b = await c.req.parseBody();
  const date = String(b.date || todayWarsaw());

  await c.env.DB.prepare(`UPDATE shopping SET bought = 1, bought_on = date('now') WHERE id = ?`)
    .bind(Number(b.id)).run();

  return c.redirect(`/day/${date}`);
});

export default gaps;
