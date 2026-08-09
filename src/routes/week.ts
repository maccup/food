import { Hono } from 'hono';
import { Env } from '../types';
import { page, card, blockTitle, emptyState, esc, pl, todayWarsaw, shiftDate, DAY_NAMES } from '../views/ui';

const week = new Hono<{ Bindings: Env }>();

week.get('/week', async (c) => {
  const db = c.env.DB;
  const end = c.req.query('end') ?? todayWarsaw();
  const start = shiftDate(end, -6);

  const [totals, phase, coverage, rules, breaches] = await Promise.all([
    db.prepare(`SELECT * FROM v_day_totals WHERE date BETWEEN ? AND ? ORDER BY date`).bind(start, end).all<any>(),
    db.prepare(`SELECT * FROM phases WHERE ? >= date_from AND (date_to IS NULL OR ? <= date_to) LIMIT 1`)
      .bind(end, end).first<any>(),
    db.prepare(
      `SELECT group_id, group_code, group_name, provides, COUNT(DISTINCT date) AS days
       FROM v_group_coverage WHERE date BETWEEN ? AND ? GROUP BY group_id`
    ).bind(start, end).all<any>(),
    db.prepare(
      `SELECT r.group_id, r.min_days_per_week, r.severity, r.rationale, g.name, g.provides
       FROM coverage_rules r JOIN food_groups g ON g.id = r.group_id
       WHERE (r.active_from IS NULL OR r.active_from <= ?) AND (r.active_to IS NULL OR r.active_to >= ?)
       ORDER BY CASE r.severity WHEN 'critical' THEN 1 WHEN 'important' THEN 2 ELSE 3 END`
    ).bind(end, start).all<any>(),
    db.prepare(
      `SELECT food_name, level, COUNT(*) AS n FROM v_restriction_breaches
       WHERE date BETWEEN ? AND ? AND eaten = 1
       GROUP BY food_name, level ORDER BY level DESC, n DESC`
    ).bind(start, end).all<any>(),
  ]);

  const targets = phase
    ? await db.prepare(`SELECT metric, min_value, max_value FROM targets WHERE phase_id = ?`).bind(phase.id).all<any>()
    : { results: [] };
  const t = new Map<string, any>((targets.results ?? []).map((x: any) => [x.metric, x]));

  const cell = (value: number, metric: string) => {
    const spec = t.get(metric);
    if (!spec) return `<td style="text-align:right">${pl(value, 0)}</td>`;
    const bad =
      (spec.min_value !== null && value < spec.min_value * 0.9) ||
      (spec.max_value !== null && value > spec.max_value * 1.1);
    const warn =
      !bad &&
      ((spec.min_value !== null && value < spec.min_value) ||
        (spec.max_value !== null && value > spec.max_value));
    const color = bad ? 'var(--bad)' : warn ? 'var(--warn)' : 'var(--ok)';
    // Znak obok liczby, bo sam odcien to za malo przy dalonizmie i w slonecu.
    const low = (spec.min_value !== null && value < spec.min_value);
    const mark = bad || warn ? (low ? '↓' : '↑') : '';
    return `<td style="text-align:right;color:${color};font-weight:600;white-space:nowrap">${pl(value, 0)}<span style="font-size:11px">${mark}</span></td>`;
  };

  const rows = (totals.results ?? []).map((d: any) => {
    const dow = DAY_NAMES[new Date(`${d.date}T12:00:00Z`).getUTCDay()].slice(0, 3);
    return `<tr>
      <td><a href="/day/${d.date}">${dow} ${d.date.slice(8)}.${d.date.slice(5, 7)}</a></td>
      ${cell(d.kcal, 'kcal')}${cell(d.protein_g, 'protein_g')}${cell(d.fat_g, 'fat_g')}${cell(d.carbs_g, 'carbs_g')}${cell(d.fiber_g, 'fiber_g')}
    </tr>`;
  }).join('');

  const avg = (key: string) => {
    const list = totals.results ?? [];
    return list.length ? list.reduce((a: number, d: any) => a + Number(d[key]), 0) / list.length : 0;
  };

  const table = (totals.results ?? []).length
    ? `<div style="overflow-x:auto"><table class="data-table" style="width:100%;font-size:13px">
        <thead><tr><th>Dzień</th><th style="text-align:right">kcal</th><th style="text-align:right">B</th><th style="text-align:right">T</th><th style="text-align:right">W</th><th style="text-align:right">bł</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="border-top:2px solid rgba(0,0,0,.15)">
          <td><b>średnia</b></td>
          ${cell(avg('kcal'), 'kcal')}${cell(avg('protein_g'), 'protein_g')}${cell(avg('fat_g'), 'fat_g')}${cell(avg('carbs_g'), 'carbs_g')}${cell(avg('fiber_g'), 'fiber_g')}
        </tr></tfoot>
      </table></div>`
    : emptyState('Brak danych z tego tygodnia.');

  const covBy = new Map<number, any>((coverage.results ?? []).map((x: any) => [x.group_id, x]));
  const gaps = (rules.results ?? []).map((r: any) => {
    const got = covBy.get(r.group_id)?.days ?? 0;
    const need = r.min_days_per_week ?? 0;
    const ok = got >= need;
    const color = ok ? 'var(--ok)' : r.severity === 'critical' ? 'var(--bad)' : 'var(--warn)';
    return `<li>
      <div class="item-content"><div class="item-inner" style="display:block;padding:10px 0">
        <div style="display:flex;justify-content:space-between;gap:8px">
          <b style="font-size:14px">${esc(r.name)}</b>
          <span style="color:${color};font-weight:700;white-space:nowrap">${got} z ${need} dni</span>
        </div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">daje: ${esc(r.provides ?? '')}</div>
        ${!ok && r.rationale ? `<div style="font-size:12px;color:${color};margin-top:4px">${esc(r.rationale)}</div>` : ''}
      </div></div>
    </li>`;
  }).join('');

  const breachList = (breaches.results ?? []).length
    ? `<div class="list simple-list"><ul>${(breaches.results ?? []).map((b: any) =>
        `<li><span>${esc(b.food_name)}</span><span style="color:${b.level === 'forbidden' ? 'var(--bad)' : 'var(--warn)'}">${b.level === 'forbidden' ? 'zakazane' : 'limit'} &middot; ${b.n}x</span></li>`
      ).join('')}</ul></div>`
    : emptyState('Żadnych naruszeń w tym tygodniu.');

  const content = `
    <div class="block" style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
      <a href="/week?end=${shiftDate(end, -7)}" class="button button-small">‹ tydzień</a>
      <div style="font-size:13px;text-align:center">${start} do ${end}<br><span style="color:var(--muted);font-size:12px">${phase ? esc(phase.name) : ''}</span></div>
      <a href="/week?end=${shiftDate(end, 7)}" class="button button-small">tydzień ›</a>
    </div>

    ${blockTitle('Makro dzień po dniu')}
    ${card(table)}

    ${blockTitle('Czego brakuje', 'pokrycie grup produktów')}
    <div class="list media-list" style="margin:0"><ul>${gaps || emptyState('Brak reguł.')}</ul></div>

    ${blockTitle('Naruszenia wykluczeń')}
    ${breachList}
  `;

  return c.html(page({ title: 'Tydzień', tab: 'week', header: 'Tydzień', content }));
});

export default week;
