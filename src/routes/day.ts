import { Hono } from 'hono';
import { Env } from '../types';
import {
  page, card, blockTitle, emptyState, esc, pl, flag, macroBar,
  SLOT_LABEL, todayWarsaw, shiftDate, prettyDate, nowMinutesWarsaw, daysBetween,
} from '../views/ui';
import { dashboard } from '../views/dashboard';
import { loadSettings, sittingTimes, parseNoDeliveryDates } from '../utils/settings';

const day = new Hono<{ Bindings: Env }>();

const MACROS = [
  { key: 'kcal', label: 'Kalorie', unit: 'kcal' },
  { key: 'protein_g', label: 'Białko', unit: 'g' },
  { key: 'fat_g', label: 'Tłuszcz', unit: 'g' },
  { key: 'carbs_g', label: 'Węgle', unit: 'g' },
  { key: 'fiber_g', label: 'Błonnik', unit: 'g' },
];

interface MealRow {
  id: number; slot: string; sitting: number | null; source: string; name: string;
  kcal: number | null; protein_g: number | null; fat_g: number | null;
  carbs_g: number | null; fiber_g: number | null; fiber: number | null;
  eaten: number; eaten_fraction: number; estimated: number; notes: string | null;
}

export async function renderDay(c: any, date: string) {
  const db = c.env.DB;

  const [totals, phase, meals, breaches, symptoms, stools] = await Promise.all([
    db.prepare(`SELECT * FROM v_day_totals WHERE date = ?`).bind(date).first<any>(),
    db.prepare(
      `SELECT * FROM phases WHERE ? >= date_from AND (date_to IS NULL OR ? <= date_to) LIMIT 1`
    ).bind(date, date).first<any>(),
    db.prepare(
      `SELECT id, slot, sitting, source, name, kcal, protein_g, fat_g, carbs_g, fiber_g,
              eaten, eaten_fraction, estimated, notes
       FROM meals WHERE date = ?
       ORDER BY COALESCE(sitting, 9),
         CASE slot WHEN 'sniadanie' THEN 1 WHEN 'ii_sniadanie' THEN 2 WHEN 'obiad' THEN 3
                   WHEN 'podwieczorek' THEN 4 WHEN 'kolacja' THEN 5 ELSE 6 END, id`
    ).bind(date).all<MealRow>(),
    db.prepare(
      `SELECT meal_id, meal_name, food_name, level, reason, max_amount FROM v_restriction_breaches WHERE date = ?`
    ).bind(date).all<any>(),
    db.prepare(`SELECT * FROM symptoms WHERE date = ? ORDER BY COALESCE(time,'99:99')`).bind(date).all<any>(),
    db.prepare(`SELECT * FROM stools WHERE date = ? ORDER BY COALESCE(time,'99:99')`).bind(date).all<any>(),
  ]);

  const targets = phase
    ? await db.prepare(`SELECT metric, min_value, max_value FROM targets WHERE phase_id = ?`)
        .bind(phase.id).all<any>()
    : { results: [] };

  const targetBy = new Map<string, any>((targets.results ?? []).map((t: any) => [t.metric, t]));

  const settings = await loadSettings(db);
  const times = sittingTimes(settings);
  const isToday = date === todayWarsaw();

  const dayCode = ['nie', 'pon', 'wt', 'sr', 'czw', 'pt', 'sob'][new Date(`${date}T12:00:00Z`).getUTCDay()];
  const supps = await db.prepare(
    `SELECT s.id, s.time_of_day, sup.name, l.taken
     FROM supplement_schedule s
     JOIN supplements sup ON sup.id = s.supplement_id
     LEFT JOIN supplement_log l ON l.schedule_id = s.id AND l.date = ?
     WHERE ? >= s.date_from AND (s.date_to IS NULL OR ? <= s.date_to)
       AND (s.days = 'daily' OR (',' || s.days || ',') LIKE ('%,' || ? || ',%'))
     ORDER BY s.time_of_day`
  ).bind(date, date, date, dayCode).all<any>();

  const suppRows = supps.results ?? [];
  const nowMin = isToday ? nowMinutesWarsaw() : null;
  const nextSupp = suppRows.find((r: any) => {
    if (r.taken === 1) return false;
    if (nowMin === null) return true;
    const [h, m] = String(r.time_of_day).split(':').map(Number);
    return h * 60 + (m || 0) >= nowMin;
  }) ?? suppRows.find((r: any) => r.taken !== 1);

  const overdueSupps = nowMin === null ? 0 : suppRows.filter((r: any) => {
    if (r.taken === 1) return false;
    const [h, m] = String(r.time_of_day).split(':').map(Number);
    return h * 60 + (m || 0) < nowMin;
  }).length;
  const breachBy = new Map<number, any[]>();
  for (const b of breaches.results ?? []) {
    if (!breachBy.has(b.meal_id)) breachBy.set(b.meal_id, []);
    breachBy.get(b.meal_id)!.push(b);
  }

  const macroHtml = MACROS.map((m) => {
    const t = targetBy.get(m.key);
    return macroBar({
      key: m.key,
      label: m.label,
      actual: totals ? Number(totals[m.key]) : 0,
      min: t?.min_value ?? null,
      max: t?.max_value ?? null,
      unit: m.unit,
    });
  }).join('');

  const caveats: string[] = [];
  if (totals?.meals_without_macros > 0)
    caveats.push(`${totals.meals_without_macros} posiłek bez podanych makr, sumy są zaniżone`);
  if (totals?.meals_estimated > 0)
    caveats.push(`${totals.meals_estimated} posiłek z makrami na oko`);

  const bySitting = new Map<number, MealRow[]>();
  for (const m of meals.results ?? []) {
    const s = m.sitting ?? 9;
    if (!bySitting.has(s)) bySitting.set(s, []);
    bySitting.get(s)!.push(m);
  }

  // Najblizsza przerwa w dostawach w ciagu dwoch tygodni. Planowanie, nie retrospekcja.
  const noDelivery = parseNoDeliveryDates(settings.get('no_delivery_dates'));
  let nextGap: { from: string; days: number } | null = null;
  for (let i = 0; i <= 14; i++) {
    const probe = shiftDate(date, i);
    if (noDelivery.has(probe) && !noDelivery.has(shiftDate(probe, -1))) {
      nextGap = { from: probe, days: i };
      break;
    }
  }

  const panel = dashboard({
    date,
    isToday,
    nowMinutes: nowMin,
    phaseName: phase?.name ?? null,
    phaseEnd: phase?.date_to ?? null,
    daysLeft: phase?.date_to ? Math.max(0, daysBetween(date, phase.date_to)) : null,
    totals: totals ?? null,
    targets: targetBy,
    sittingTimes: times,
    mealsBySitting: new Map(
      [...bySitting.entries()].map(([s, list]) => [
        s,
        { total: list.length, eaten: list.filter((m) => m.eaten).length },
      ])
    ),
    supplementsTotal: suppRows.length,
    supplementsTaken: suppRows.filter((r: any) => r.taken === 1).length,
    nextSupplement: nextSupp ? { time: nextSupp.time_of_day, name: nextSupp.name } : null,
    overdueSupplements: overdueSupps,
    forbiddenToday: (breaches.results ?? [])
      .filter((b: any) => b.level === 'forbidden')
      .map((b: any) => ({ food_name: b.food_name, meal_name: b.meal_name ?? '' })),
    minGapHours: Number(settings.get('min_gap_hours') || 4),
    nextDeliveryGap: nextGap,
  });

  const mealsHtml = (meals.results ?? []).length
    ? [...bySitting.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([sitting, list]) => {
          const time = times[sitting] ?? 'poza oknami';
          const kcal = list.reduce((a, m) => a + (m.eaten ? (m.kcal ?? 0) * m.eaten_fraction : 0), 0);
          return `<section><div class="sitting-head">
              <span class="sitting-time">${sitting <= 3 ? `Podejście ${sitting}, ${time}` : 'Poza oknami'}</span>
              <span class="sitting-gap">${pl(kcal, 0)} kcal</span>
            </div>
            <div class="list media-list" style="margin:0">
              <ul>${list.map((m) => mealItem(m, breachBy.get(m.id) ?? [])).join('')}</ul>
            </div></section>`;
        })
        .join('')
    : emptyState('Brak posiłków tego dnia. Menu z cateringu wjeżdża importem, a wszystko poza nim dopisujesz w zakładce Dopisz.');

  const eventsHtml =
    (symptoms.results?.length ?? 0) + (stools.results?.length ?? 0) === 0
      ? emptyState('Brak wpisów o objawach i stolcu.')
      : `<div class="list simple-list"><ul>
          ${(symptoms.results ?? []).map((s: any) =>
            `<li><span>${esc(s.time ?? '')} ${esc(s.kind)}${s.notes ? `, ${esc(s.notes)}` : ''}</span><span style="color:var(--muted)">${s.severity ?? '?'}/10</span></li>`
          ).join('')}
          ${(stools.results ?? []).map((s: any) =>
            `<li><span>${esc(s.time ?? '')} stolec${s.incomplete ? ', niepełne wypróżnienie' : ''}${s.floating ? ', pływający' : ''}</span><span style="color:var(--muted)">Bristol ${s.bristol}</span></li>`
          ).join('')}
        </ul></div>`;

  const content = `
    ${panel}

    <div class="block" style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
      <a href="/day/${shiftDate(date, -1)}" class="button button-small">‹ poprzedni</a>
      <div style="text-align:center">
        <div style="font-weight:700">${esc(prettyDate(date))}</div>
        <div style="font-size:12px;color:var(--muted)">${phase ? esc(phase.diet_type ?? '') : 'poza fazami protokołu'}</div>
      </div>
      <a href="/day/${shiftDate(date, 1)}" class="button button-small">następny ›</a>
    </div>

    ${blockTitle('Makro wobec celu')}
    ${totals
      ? card(macroHtml + (caveats.length ? `<div style="margin-top:10px;font-size:12px;color:var(--warn)">${caveats.map(esc).join('<br>')}</div>` : ''))
      : emptyState('Nic jeszcze nie zjedzone tego dnia, więc nie ma czego porównywać z celem.')}

    ${blockTitle('Posiłki')}
    <div class="cols">${mealsHtml}</div>

    ${blockTitle('Objawy i stolec')}
    ${eventsHtml}

    <div class="block"><a href="/log?date=${date}" class="button button-fill">Dopisz posiłek, objaw albo stolec</a></div>
  `;

  return page({
    title: prettyDate(date),
    tab: isToday ? 'today' : undefined,
    header: isToday ? 'Dziś' : esc(prettyDate(date)),
    content,
  });
}

function mealItem(m: MealRow, breaches: any[]): string {
  const forbidden = breaches.filter((b) => b.level === 'forbidden');
  const limits = breaches.filter((b) => b.level === 'limit');

  const chips = [
    ...forbidden.map((b) => flag('forbidden', b.food_name)),
    ...limits.map((b) => flag('limit', b.food_name)),
    m.estimated ? flag('info', 'na oko') : '',
    m.source !== 'hfood' ? flag('info', m.source) : '',
    m.eaten_fraction < 1 ? flag('info', `zjedzone ${Math.round(m.eaten_fraction * 100)}%`) : '',
  ]
    .filter(Boolean)
    .join('');

  const macros = m.kcal === null
    ? '<span style="color:var(--warn)">bez makr</span>'
    : `${pl(m.kcal, 0)} kcal &middot; B ${pl(m.protein_g)} &middot; T ${pl(m.fat_g)} &middot; W ${pl(m.carbs_g)} &middot; bł ${pl(m.fiber_g)}`;

  return `<li class="${m.eaten ? '' : 'meal-skipped'}">
    <div class="item-content">
      <div class="item-inner" style="display:block;padding-top:10px;padding-bottom:10px">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">${esc(SLOT_LABEL[m.slot] ?? m.slot)}</div>
        <div class="item-title" style="white-space:normal;font-weight:600;line-height:1.35">${esc(m.name)}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">${macros}</div>
        ${chips ? `<div style="margin-top:6px">${chips}</div>` : ''}
        <form method="POST" action="/meal/${m.id}/eaten" style="margin-top:8px;display:flex;gap:8px;align-items:center">
          <label style="font-size:13px;display:flex;gap:6px;align-items:center">
            <input type="checkbox" name="eaten" value="1" ${m.eaten ? 'checked' : ''} onchange="this.form.submit()">
            zjedzone
          </label>
          <select name="fraction" onchange="this.form.submit()" style="font-size:13px;padding:2px 6px">
            ${[1, 0.75, 0.5, 0.25].map((f) =>
              `<option value="${f}" ${Math.abs(m.eaten_fraction - f) < 0.01 ? 'selected' : ''}>${f === 1 ? 'całość' : `${f * 100}%`}</option>`
            ).join('')}
          </select>
        </form>
      </div>
    </div>
  </li>`;
}

day.get('/', async (c) => renderDay(c, todayWarsaw()).then((html) => c.html(html)));

day.get('/day/:date', async (c) => {
  const date = c.req.param('date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.redirect('/');
  return c.html(await renderDay(c, date));
});

day.post('/meal/:id/eaten', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.parseBody();
  const eaten = body.eaten === '1' ? 1 : 0;
  const fraction = Number(body.fraction ?? 1) || 1;

  const row = await c.env.DB.prepare(`SELECT date FROM meals WHERE id = ?`).bind(id).first<{ date: string }>();
  await c.env.DB.prepare(`UPDATE meals SET eaten = ?, eaten_fraction = ? WHERE id = ?`)
    .bind(eaten, fraction, id).run();

  return c.redirect(`/day/${row?.date ?? todayWarsaw()}`);
});

export default day;
