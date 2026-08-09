import { Hono } from 'hono';
import { Env } from '../types';
import { page, blockTitle, esc, pl, todayWarsaw } from '../views/ui';
import { loadSettings, parseNoDeliveryDates } from '../utils/settings';

const calendar = new Hono<{ Bindings: Env }>();

const MONTHS = [
  'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień',
];

function monthShift(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

calendar.get('/kalendarz', async (c) => {
  const db = c.env.DB;
  const today = todayWarsaw();
  const month = c.req.query('m') ?? today.slice(0, 7);
  const [year, mon] = month.split('-').map(Number);

  const first = new Date(Date.UTC(year, mon - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, '0')}`;

  const settings = await loadSettings(db);
  const noDelivery = parseNoDeliveryDates(settings.get('no_delivery_dates'));

  const [totals, breaches, events, phases, targets] = await Promise.all([
    db.prepare(`SELECT * FROM v_day_totals WHERE date BETWEEN ? AND ?`).bind(monthStart, monthEnd).all<any>(),
    db.prepare(
      `SELECT date, SUM(CASE WHEN level = 'forbidden' THEN 1 ELSE 0 END) AS forbidden, COUNT(*) AS total
       FROM v_restriction_breaches WHERE date BETWEEN ? AND ? AND eaten = 1 GROUP BY date`
    ).bind(monthStart, monthEnd).all<any>(),
    db.prepare(
      `SELECT date, COUNT(*) AS n FROM (
         SELECT date FROM symptoms WHERE date BETWEEN ?1 AND ?2
         UNION ALL SELECT date FROM stools WHERE date BETWEEN ?1 AND ?2
       ) GROUP BY date`
    ).bind(monthStart, monthEnd).all<any>(),
    db.prepare(`SELECT * FROM phases ORDER BY date_from`).all<any>(),
    db.prepare(`SELECT phase_id, metric, min_value, max_value FROM targets`).all<any>(),
  ]);

  const totalsBy = new Map<string, any>((totals.results ?? []).map((t: any) => [t.date, t]));
  const breachBy = new Map<string, any>((breaches.results ?? []).map((b: any) => [b.date, b]));
  const eventBy = new Map<string, number>((events.results ?? []).map((e: any) => [e.date, e.n]));

  const phaseFor = (date: string) =>
    (phases.results ?? []).find((p: any) => date >= p.date_from && (!p.date_to || date <= p.date_to));

  const targetFor = (phaseId: number, metric: string) =>
    (targets.results ?? []).find((t: any) => t.phase_id === phaseId && t.metric === metric);

  // Poniedzialek pierwszy, bo tak wyglada kalendarz w Polsce.
  const offset = (first.getUTCDay() + 6) % 7;
  const cells: string[] = [];

  for (let i = 0; i < offset; i++) cells.push('<div class="cal-cell cal-empty"></div>');

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const t = totalsBy.get(date);
    const b = breachBy.get(date);
    const ev = eventBy.get(date) ?? 0;
    const phase = phaseFor(date);
    const isToday = date === today;
    const isFuture = date > today;

    let cls = 'cal-none';
    let hint = 'brak wpisów';

    if (noDelivery.has(date)) {
      cls = 'cal-gap';
      hint = 'przerwa w dostawach';
    } else if (t) {
      const fat = targetFor(phase?.id, 'fat_g');
      const fiber = targetFor(phase?.id, 'fiber_g');
      const outside =
        (fat && (t.fat_g > (fat.max_value ?? 1e9) * 1.1 || t.fat_g < (fat.min_value ?? 0) * 0.9)) ||
        (fiber && (t.fiber_g > (fiber.max_value ?? 1e9) * 1.1 || t.fiber_g < (fiber.min_value ?? 0) * 0.9));

      if (b?.forbidden > 0) { cls = 'cal-bad'; hint = `${b.forbidden} zakazane`; }
      else if (outside) { cls = 'cal-warn'; hint = 'makro poza pasmem'; }
      else { cls = 'cal-ok'; hint = 'w normie'; }
    } else if (isFuture) {
      cls = 'cal-future';
      hint = 'jeszcze przed nami';
    }

    cells.push(`<a href="/day/${date}" class="cal-cell ${cls} ${isToday ? 'cal-today' : ''}" title="${esc(hint)}">
      <span class="cal-num">${d}</span>
      ${t ? `<span class="cal-kcal">${pl(t.kcal, 0)}</span>` : '<span class="cal-kcal">&nbsp;</span>'}
      <span class="cal-dots">${b?.forbidden ? '<i class="dot bad"></i>' : ''}${ev ? '<i class="dot ev"></i>' : ''}</span>
    </a>`);
  }

  const monthTotals = (totals.results ?? []);
  const avg = (k: string) =>
    monthTotals.length ? monthTotals.reduce((a: number, x: any) => a + Number(x[k]), 0) / monthTotals.length : 0;

  const phaseBar = (phases.results ?? [])
    .filter((p: any) => !(p.date_to && p.date_to < monthStart) && p.date_from <= monthEnd)
    .map((p: any) => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0">
        <span>${esc(p.name)}</span>
        <span style="color:var(--muted)">${esc(p.date_from)} do ${esc(p.date_to ?? 'bezterminowo')}</span>
      </div>`).join('');

  const content = `
    <div class="block" style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
      <a href="/kalendarz?m=${monthShift(month, -1)}" class="button button-small">‹</a>
      <div style="text-align:center">
        <div style="font-weight:700;text-transform:capitalize">${MONTHS[mon - 1]} ${year}</div>
        <div style="font-size:12px;color:var(--muted)">${monthTotals.length} dni z danymi</div>
      </div>
      <a href="/kalendarz?m=${monthShift(month, 1)}" class="button button-small">›</a>
    </div>

    <div class="block" style="margin-top:4px">
      <div class="cal-head">${['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'].map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="cal-grid">${cells.join('')}</div>
      <div class="cal-legend">
        <span><i class="sw cal-ok"></i> w normie</span>
        <span><i class="sw cal-warn"></i> makro poza pasmem</span>
        <span><i class="sw cal-bad"></i> coś zakazanego</span>
        <span><i class="sw cal-gap"></i> przerwa w dostawach</span>
        <span><i class="sw cal-none"></i> brak wpisów</span>
      </div>
    </div>

    ${monthTotals.length ? blockTitle('Średnia z miesiąca') + `<div class="block">
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;text-align:center">
        ${[['kcal', 'kcal'], ['protein_g', 'białko'], ['fat_g', 'tłuszcz'], ['carbs_g', 'węgle'], ['fiber_g', 'błonnik']]
          .map(([k, l]) => `<div><div style="font-size:17px;font-weight:700">${pl(avg(k), 0)}</div>
            <div style="font-size:11px;color:var(--muted)">${l}</div></div>`).join('')}
      </div></div>` : ''}

    ${phaseBar ? blockTitle('Fazy protokołu') + `<div class="block">${phaseBar}</div>` : ''}
  `;

  return c.html(page({ title: 'Kalendarz', tab: 'calendar', header: 'Kalendarz', content }));
});

export default calendar;
