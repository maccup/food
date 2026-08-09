import { Hono } from 'hono';
import { Env } from '../types';
import { page, card, blockTitle, emptyState, esc, todayWarsaw, flag } from '../views/ui';

const restrictions = new Hono<{ Bindings: Env }>();

const STATUS_LABEL: Record<string, string> = {
  active: 'wykluczone',
  testing: 'w teście',
  cleared: 'sprawdzone, nie szkodzi',
  confirmed_trigger: 'potwierdzone, szkodzi',
};

restrictions.get('/restrictions', async (c) => {
  const db = c.env.DB;
  const today = todayWarsaw();

  const [rules, unmapped, trials] = await Promise.all([
    db.prepare(
      `SELECT r.id, r.level, r.reason, r.source, r.date_from, r.date_to, r.status, r.max_amount,
              COALESCE(f.name, g.name) AS what, f.id AS food_id, f.fodmap_note
       FROM restrictions r
       LEFT JOIN foods f ON f.id = r.food_id
       LEFT JOIN food_groups g ON g.id = r.group_id
       ORDER BY CASE r.status WHEN 'active' THEN 1 WHEN 'testing' THEN 2 WHEN 'confirmed_trigger' THEN 3 ELSE 4 END,
                CASE r.level WHEN 'forbidden' THEN 1 WHEN 'limit' THEN 2 ELSE 3 END, what`
    ).all<any>(),
    db.prepare(
      `SELECT alias, times_seen FROM food_aliases WHERE food_id IS NULL AND ignored = 0
       ORDER BY times_seen DESC, alias LIMIT 100`
    ).all<any>(),
    db.prepare(
      `SELECT t.id, t.planned_date, t.tested_date, t.amount, t.status, t.verdict, t.verdict_note,
              f.name AS food_name, f.id AS food_id
       FROM trials t JOIN foods f ON f.id = t.food_id
       ORDER BY CASE t.status WHEN 'running' THEN 1 WHEN 'planned' THEN 2 ELSE 3 END,
                COALESCE(t.planned_date, t.tested_date)`
    ).all<any>(),
  ]);

  const foods = await db.prepare(
    `SELECT f.id, f.name FROM foods f
     JOIN restrictions r ON r.food_id = f.id AND r.status = 'active' AND r.level = 'forbidden'
     GROUP BY f.id ORDER BY f.name`
  ).all<any>();

  const group = (status: string) => (rules.results ?? []).filter((r: any) => r.status === status);

  const ruleList = (rows: any[]) =>
    rows.length
      ? `<div class="list media-list" style="margin:0"><ul>${rows.map((r: any) => {
          const expired = r.date_to && r.date_to < today;
          return `<li><div class="item-content"><div class="item-inner" style="display:block;padding:10px 0">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">
              <b>${esc(r.what ?? '?')}</b>
              ${flag(r.level, r.level === 'forbidden' ? 'zakaz' : r.level === 'limit' ? 'limit' : 'preferowane')}
            </div>
            <div style="font-size:12px;color:var(--muted);margin-top:3px">${esc(r.reason)}</div>
            ${r.max_amount ? `<div style="font-size:12px;margin-top:2px">ile można: ${esc(r.max_amount)}</div>` : ''}
            <div style="font-size:11px;color:var(--muted);margin-top:3px">
              ${r.date_to ? `do ${esc(r.date_to)}${expired ? ', termin minął' : ''}` : 'bezterminowo'}
              ${r.source ? ` &middot; ${esc(r.source)}` : ''}
            </div>
          </div></div></li>`;
        }).join('')}</ul></div>`
      : emptyState('Pusto.');

  const trialsHtml = (trials.results ?? []).length
    ? `<div class="list media-list" style="margin:0"><ul>${(trials.results ?? []).map((t: any) => `
        <li><div class="item-content"><div class="item-inner" style="display:block;padding:10px 0">
          <div style="display:flex;justify-content:space-between;gap:8px">
            <b>${esc(t.food_name)}</b>
            <span style="font-size:12px;color:var(--muted)">${t.status === 'planned' ? `plan ${esc(t.planned_date ?? '')}` : t.status === 'running' ? 'trwa' : esc(t.verdict ?? 'zakończony')}</span>
          </div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${esc(t.amount ?? '')}</div>
          ${t.status !== 'done' ? `
            <form method="POST" action="/trials/${t.id}/verdict" style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
              <button name="verdict" value="ok" class="button button-small" style="color:var(--ok)">nie szkodzi</button>
              <button name="verdict" value="podejrzany" class="button button-small" style="color:var(--warn)">podejrzany</button>
              <button name="verdict" value="szkodzi" class="button button-small" style="color:var(--bad)">szkodzi</button>
            </form>` : t.verdict_note ? `<div style="font-size:12px;margin-top:4px">${esc(t.verdict_note)}</div>` : ''}
        </div></div></li>`).join('')}</ul></div>`
    : emptyState('Żadnych testów. Rozszerzanie diety startuje 15.09, wtedy to się zapełni.');

  const content = `
    ${blockTitle('Test produktu', 'jeden produkt naraz, obserwacja 48 h')}
    ${card(`
      <form method="POST" action="/trials" style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end">
        <label style="font-size:13px">Produkt do sprawdzenia
          <select name="food_id" style="width:100%;padding:8px;margin-top:4px">
            ${(foods.results ?? []).map((f: any) => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}
          </select>
        </label>
        <button type="submit" class="button button-fill">Zacznij</button>
        <label style="font-size:13px;grid-column:1 / -1">Ile i kiedy
          <input type="text" name="amount" placeholder="np. pół szklanki, jutro na śniadanie" style="width:100%;padding:8px;margin-top:4px">
        </label>
      </form>
    `)}
    ${trialsHtml}

    ${blockTitle('Wykluczone i limitowane')}
    ${ruleList(group('active'))}

    ${group('testing').length ? blockTitle('W teście') + ruleList(group('testing')) : ''}
    ${group('cleared').length ? blockTitle('Sprawdzone, nie szkodzą') + ruleList(group('cleared')) : ''}
    ${group('confirmed_trigger').length ? blockTitle('Potwierdzone, szkodzą') + ruleList(group('confirmed_trigger')) : ''}

    ${blockTitle('Nierozpoznane składniki', `${(unmapped.results ?? []).length} pozycji`)}
    ${(unmapped.results ?? []).length
      ? card(`<p style="font-size:13px;margin:0 0 8px">Te składniki pojawiły się w jedzeniu, ale nie ma ich jeszcze w słowniku,
          więc reguły ich nie sprawdzają. Dopóki lista jest pusta, silnik wykluczeń widzi wszystko.</p>
          <div style="font-size:13px;line-height:1.9">${(unmapped.results ?? []).map((u: any) =>
            `<span class="flag info">${esc(u.alias)} &middot; ${u.times_seen}x</span>`).join('')}</div>`)
      : card('<p style="margin:0;font-size:13px;color:var(--ok)">Wszystkie składniki rozpoznane. Reguły widzą pełny skład.</p>')}
  `;

  return c.html(page({ title: 'Wykluczenia', tab: 'restrictions', header: 'Wykluczenia', content }));
});

restrictions.post('/trials', async (c) => {
  const b = await c.req.parseBody();
  const foodId = Number(b.food_id);

  await c.env.DB.prepare(
    `INSERT INTO trials (food_id, planned_date, tested_date, amount, status)
     VALUES (?, ?, ?, ?, 'running')`
  ).bind(foodId, todayWarsaw(), todayWarsaw(), String(b.amount || '') || null).run();

  await c.env.DB.prepare(`UPDATE restrictions SET status = 'testing' WHERE food_id = ? AND status = 'active'`)
    .bind(foodId).run();

  return c.redirect('/restrictions');
});

restrictions.post('/trials/:id/verdict', async (c) => {
  const id = Number(c.req.param('id'));
  const b = await c.req.parseBody();
  const verdict = String(b.verdict);

  const trial = await c.env.DB.prepare(`SELECT food_id FROM trials WHERE id = ?`).bind(id).first<{ food_id: number }>();

  await c.env.DB.prepare(`UPDATE trials SET status = 'done', verdict = ?, tested_date = COALESCE(tested_date, ?) WHERE id = ?`)
    .bind(verdict, todayWarsaw(), id).run();

  // Werdykt wraca do wykluczenia, zeby lista "czy mi szkodzi" byla jednym zrodlem prawdy.
  if (trial) {
    const newStatus = verdict === 'ok' ? 'cleared' : verdict === 'szkodzi' ? 'confirmed_trigger' : 'active';
    await c.env.DB.prepare(`UPDATE restrictions SET status = ? WHERE food_id = ? AND status = 'testing'`)
      .bind(newStatus, trial.food_id).run();
  }

  return c.redirect('/restrictions');
});

export default restrictions;
