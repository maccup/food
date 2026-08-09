import { Hono } from 'hono';
import { Env } from '../types';
import { page, card, blockTitle, emptyState, esc, todayWarsaw, prettyDate, shiftDate } from '../views/ui';

const supplements = new Hono<{ Bindings: Env }>();

const DAY_CODES = ['nie', 'pon', 'wt', 'sr', 'czw', 'pt', 'sob'];

function dayCode(date: string): string {
  return DAY_CODES[new Date(`${date}T12:00:00Z`).getUTCDay()];
}

supplements.get('/suplementy', async (c) => {
  const db = c.env.DB;
  const date = c.req.query('date') ?? todayWarsaw();
  const code = dayCode(date);

  // Dopasowanie dnia tygodnia po pelnym tokenie miedzy przecinkami.
  // LIKE '%pon%' bylby pulapka, bo 'pon' jest podciagiem innych slow.
  const schedule = await db.prepare(
    `SELECT s.id, s.time_of_day, s.with_meal, s.amount, s.notes,
            sup.id AS supplement_id, sup.name, sup.kind, sup.rx, sup.purpose,
            l.taken AS logged
     FROM supplement_schedule s
     JOIN supplements sup ON sup.id = s.supplement_id
     LEFT JOIN supplement_log l ON l.schedule_id = s.id AND l.date = ?
     WHERE ? >= s.date_from AND (s.date_to IS NULL OR ? <= s.date_to)
       AND (s.days = 'daily' OR (',' || s.days || ',') LIKE ('%,' || ? || ',%'))
     ORDER BY s.time_of_day, sup.name`
  ).bind(date, date, date, code).all<any>();

  const all = await db.prepare(
    `SELECT id, name, brand, kind, dose, purpose, status, rx, notes, source
     FROM supplements
     ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'planned' THEN 2 WHEN 'paused' THEN 3 ELSE 4 END, name`
  ).all<any>();

  const byTime = new Map<string, any[]>();
  for (const row of schedule.results ?? []) {
    if (!byTime.has(row.time_of_day)) byTime.set(row.time_of_day, []);
    byTime.get(row.time_of_day)!.push(row);
  }

  const takenCount = (schedule.results ?? []).filter((r: any) => r.logged === 1).length;
  const total = (schedule.results ?? []).length;

  const todayHtml = total
    ? [...byTime.entries()].map(([time, rows]) => `
        <div class="sitting-head"><span class="sitting-time">${esc(time)}</span>
          <span class="sitting-gap">${rows[0].with_meal ? esc(String(rows[0].with_meal).replace('_', ' ')) : ''}</span></div>
        <div class="list media-list" style="margin:0"><ul>
          ${rows.map((r: any) => `<li>
            <div class="item-content"><div class="item-inner" style="display:block;padding:10px 0">
              <form method="POST" action="/suplementy/wziete" style="display:flex;gap:10px;align-items:flex-start">
                <input type="hidden" name="schedule_id" value="${r.id}">
                <input type="hidden" name="supplement_id" value="${r.supplement_id}">
                <input type="hidden" name="date" value="${date}">
                <input type="checkbox" name="taken" value="1" ${r.logged === 1 ? 'checked' : ''}
                       onchange="this.form.submit()" style="margin-top:3px;width:20px;height:20px">
                <div style="flex:1">
                  <div style="font-weight:600${r.logged === 1 ? ';opacity:.5;text-decoration:line-through' : ''}">${esc(r.name)}</div>
                  <div style="font-size:12px;color:var(--muted)">${esc(r.amount ?? '')}${r.rx ? ' &middot; na receptę' : ''}${r.purpose ? ` &middot; ${esc(r.purpose)}` : ''}</div>
                  ${r.notes ? `<div style="font-size:12px;color:var(--warn);margin-top:2px">${esc(r.notes)}</div>` : ''}
                </div>
              </form>
            </div></div>
          </li>`).join('')}
        </ul></div>`).join('')
    : emptyState('Nic do wzięcia tego dnia.');

  const statusLabel: Record<string, string> = {
    active: 'biorę', planned: 'zaplanowane', paused: 'wstrzymane', discontinued: 'odstawione',
  };
  const statusColor: Record<string, string> = {
    active: 'var(--ok)', planned: 'var(--warn)', paused: 'var(--muted)', discontinued: 'var(--bad)',
  };

  const allHtml = `<div class="list media-list" style="margin:0"><ul>
    ${(all.results ?? []).map((s: any) => `<li>
      <div class="item-content"><div class="item-inner" style="display:block;padding:10px 0">
        <div style="display:flex;justify-content:space-between;gap:8px">
          <b>${esc(s.name)}</b>
          <form method="POST" action="/suplementy/status" style="margin:0">
            <input type="hidden" name="id" value="${s.id}">
            <select name="status" onchange="this.form.submit()" style="font-size:12px;padding:2px 4px;color:${statusColor[s.status]};font-weight:600">
              ${Object.entries(statusLabel).map(([k, v]) => `<option value="${k}" ${s.status === k ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </form>
        </div>
        <div style="font-size:12px;color:var(--muted)">${esc(s.brand ?? '')}${s.dose ? ` &middot; ${esc(s.dose)}` : ''}${s.purpose ? ` &middot; ${esc(s.purpose)}` : ''}</div>
        ${s.notes ? `<div style="font-size:12px;margin-top:4px">${esc(s.notes)}</div>` : ''}
        ${s.source ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">źródło: ${esc(s.source)}</div>` : ''}
      </div></div>
    </li>`).join('')}
  </ul></div>`;

  const content = `
    <div class="block" style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
      <a href="/suplementy?date=${shiftDate(date, -1)}" class="button button-small">‹</a>
      <div style="text-align:center">
        <div style="font-weight:700">${esc(prettyDate(date))}</div>
        <div style="font-size:12px;color:var(--muted)">wzięte ${takenCount} z ${total}</div>
      </div>
      <a href="/suplementy?date=${shiftDate(date, 1)}" class="button button-small">›</a>
    </div>

    ${blockTitle('Co brać dzisiaj')}
    ${todayHtml}

    ${blockTitle('Cały protokół', 'status zmieniasz listą po prawej')}
    ${allHtml}
  `;

  return c.html(page({ title: 'Suplementy', tab: 'supplements', header: 'Suplementy', content }));
});

supplements.post('/suplementy/wziete', async (c) => {
  const b = await c.req.parseBody();
  const date = String(b.date || todayWarsaw());
  const scheduleId = Number(b.schedule_id);
  const supplementId = Number(b.supplement_id);
  const taken = b.taken === '1' ? 1 : 0;

  if (taken) {
    await c.env.DB.prepare(
      `INSERT INTO supplement_log (schedule_id, supplement_id, date, taken, taken_at)
       VALUES (?, ?, ?, 1, datetime('now'))
       ON CONFLICT(schedule_id, date) DO UPDATE SET taken = 1, taken_at = datetime('now')`
    ).bind(scheduleId, supplementId, date).run();
  } else {
    await c.env.DB.prepare(`DELETE FROM supplement_log WHERE schedule_id = ? AND date = ?`)
      .bind(scheduleId, date).run();
  }

  return c.redirect(`/suplementy?date=${date}`);
});

supplements.post('/suplementy/status', async (c) => {
  const b = await c.req.parseBody();
  await c.env.DB.prepare(`UPDATE supplements SET status = ? WHERE id = ?`)
    .bind(String(b.status), Number(b.id)).run();
  return c.redirect('/suplementy');
});

export default supplements;
