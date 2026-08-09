import { Hono } from 'hono';
import { Env } from '../types';
import { page, card, blockTitle, esc } from '../views/ui';
import { listSettings } from '../utils/settings';

const settings = new Hono<{ Bindings: Env }>();

const METRIC_LABEL: Record<string, string> = {
  kcal: 'Kalorie', protein_g: 'Białko', fat_g: 'Tłuszcz', carbs_g: 'Węgle', fiber_g: 'Błonnik',
};

const WITH_MEAL_OPTIONS: Array<[string, string]> = [
  ['', 'bez wskazania'],
  ['na_czczo', 'na czczo'],
  ['sniadanie', 'do śniadania'],
  ['obiad', 'do obiadu'],
  ['kolacja', 'do kolacji'],
  ['przed_snem', 'przed snem'],
];

const KIND_OPTIONS: Array<[string, string]> = [
  ['suplement', 'suplement'], ['lek', 'lek'], ['blonnik', 'błonnik'], ['probiotyk', 'probiotyk'],
];

const STATUS_OPTIONS: Array<[string, string]> = [
  ['active', 'biorę'], ['planned', 'zaplanowane'], ['paused', 'wstrzymane'], ['discontinued', 'odstawione'],
];

const sel = (options: Array<[string, string]>, current: string | null, name: string, style = '') =>
  `<select name="${name}" style="${style}">${options
    .map(([v, l]) => `<option value="${v}" ${String(current ?? '') === v ? 'selected' : ''}>${l}</option>`)
    .join('')}</select>`;

function toNumberOrNull(value: unknown): number | null {
  const s = String(value ?? '').replace(',', '.').trim();
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

settings.get('/ustawienia', async (c) => {
  const db = c.env.DB;

  const [general, phases, targets, supplements, schedule, rules] = await Promise.all([
    listSettings(db),
    db.prepare(`SELECT * FROM phases ORDER BY date_from`).all<any>(),
    db.prepare(`SELECT * FROM targets ORDER BY phase_id, metric`).all<any>(),
    db.prepare(
      `SELECT * FROM supplements
       ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'planned' THEN 2 WHEN 'paused' THEN 3 ELSE 4 END, name`
    ).all<any>(),
    db.prepare(
      `SELECT s.*, sup.name AS supplement_name FROM supplement_schedule s
       JOIN supplements sup ON sup.id = s.supplement_id
       ORDER BY s.date_from, s.time_of_day`
    ).all<any>(),
    db.prepare(
      `SELECT r.*, g.name AS group_name FROM coverage_rules r JOIN food_groups g ON g.id = r.group_id
       ORDER BY CASE r.severity WHEN 'critical' THEN 1 WHEN 'important' THEN 2 ELSE 3 END`
    ).all<any>(),
  ]);

  const generalHtml = `<form method="POST" action="/ustawienia/ogolne">
    ${general.map((s) => `<div style="margin-bottom:14px">
      <label style="font-size:13px;font-weight:600">${esc(s.label)}</label>
      ${s.hint ? `<div style="font-size:12px;color:var(--muted);margin:2px 0 4px">${esc(s.hint)}</div>` : ''}
      <input type="${s.kind === 'time' ? 'time' : s.kind === 'number' ? 'number' : 'text'}"
             name="${esc(s.key)}" value="${esc(s.value)}"
             style="width:100%;padding:10px;font-size:15px">
    </div>`).join('')}
    <button type="submit" class="button button-fill">Zapisz ustawienia</button>
  </form>`;

  const targetsByPhase = new Map<number, any[]>();
  for (const t of targets.results ?? []) {
    if (!targetsByPhase.has(t.phase_id)) targetsByPhase.set(t.phase_id, []);
    targetsByPhase.get(t.phase_id)!.push(t);
  }

  const phasesHtml = (phases.results ?? []).map((p: any) => card(`
      <form method="POST" action="/ustawienia/faza">
        <input type="hidden" name="id" value="${p.id}">
        <input type="text" name="name" value="${esc(p.name)}" style="width:100%;padding:8px;font-weight:600;margin-bottom:8px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <label style="font-size:12px;color:var(--muted)">od
            <input type="date" name="date_from" value="${esc(p.date_from)}" style="width:100%;padding:8px"></label>
          <label style="font-size:12px;color:var(--muted)">do
            <input type="date" name="date_to" value="${esc(p.date_to ?? '')}" style="width:100%;padding:8px"></label>
        </div>
        <table style="width:100%;font-size:13px;margin-bottom:10px">
          <tr><th style="text-align:left;font-weight:600">Cel</th><th style="width:70px">min</th><th style="width:70px">maks</th></tr>
          ${(targetsByPhase.get(p.id) ?? []).map((t: any) => `<tr>
            <td>${esc(METRIC_LABEL[t.metric] ?? t.metric)}</td>
            <td><input type="text" inputmode="decimal" name="target_min_${t.id}" value="${t.min_value ?? ''}" style="width:100%;padding:5px;text-align:right"></td>
            <td><input type="text" inputmode="decimal" name="target_max_${t.id}" value="${t.max_value ?? ''}" style="width:100%;padding:5px;text-align:right"></td>
          </tr>`).join('')}
        </table>
        <button type="submit" class="button button-small button-fill">Zapisz fazę i cele</button>
      </form>`)).join('');

  const scheduleBySupp = new Map<number, any[]>();
  for (const s of schedule.results ?? []) {
    if (!scheduleBySupp.has(s.supplement_id)) scheduleBySupp.set(s.supplement_id, []);
    scheduleBySupp.get(s.supplement_id)!.push(s);
  }

  const suppHtml = (supplements.results ?? []).map((s: any) => card(`
      <form method="POST" action="/ustawienia/suplement" style="margin-bottom:12px">
        <input type="hidden" name="id" value="${s.id}">
        <div style="display:grid;grid-template-columns:1fr 120px;gap:8px;margin-bottom:8px">
          <input type="text" name="name" value="${esc(s.name)}" style="padding:10px;font-weight:600">
          ${sel(STATUS_OPTIONS, s.status, 'status', 'padding:10px')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <input type="text" name="brand" value="${esc(s.brand ?? '')}" placeholder="marka" style="padding:10px">
          <input type="text" name="dose" value="${esc(s.dose ?? '')}" placeholder="dawka" style="padding:10px">
        </div>
        <input type="text" name="purpose" value="${esc(s.purpose ?? '')}" placeholder="po co to biorę" style="width:100%;padding:10px;margin-bottom:8px">
        <textarea name="notes" rows="2" placeholder="notatka" style="width:100%;padding:10px;margin-bottom:8px">${esc(s.notes ?? '')}</textarea>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          ${sel(KIND_OPTIONS, s.kind, 'kind', 'padding:8px;font-size:13px')}
          <label style="font-size:13px;display:flex;gap:6px;align-items:center;min-height:44px">
            <input type="checkbox" name="rx" value="1" ${s.rx ? 'checked' : ''}> na receptę</label>
          <button type="submit" class="button button-small button-fill" style="margin-left:auto">Zapisz</button>
        </div>
      </form>

      <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px">Kiedy brać</div>
      ${(scheduleBySupp.get(s.id) ?? []).map((sc: any) => `
        <form method="POST" action="/ustawienia/rozklad" style="border-top:1px solid rgba(0,0,0,.08);padding-top:8px;margin-bottom:8px">
          <input type="hidden" name="id" value="${sc.id}">
          <div style="display:grid;grid-template-columns:96px 1fr;gap:6px;margin-bottom:6px">
            <input type="time" name="time_of_day" value="${esc(sc.time_of_day)}" style="padding:8px;font-size:14px">
            <input type="text" name="amount" value="${esc(sc.amount ?? '')}" placeholder="ile" style="padding:8px;font-size:14px">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
            ${sel(WITH_MEAL_OPTIONS, sc.with_meal, 'with_meal', 'padding:8px;font-size:13px')}
            <input type="text" name="days" value="${esc(sc.days)}" placeholder="daily albo pon,wt,sr" style="padding:8px;font-size:13px">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
            <input type="date" name="date_from" value="${esc(sc.date_from)}" style="padding:8px;font-size:13px">
            <input type="date" name="date_to" value="${esc(sc.date_to ?? '')}" style="padding:8px;font-size:13px">
          </div>
          <div style="display:flex;gap:8px">
            <button type="submit" name="action" value="save" class="button button-small button-fill" style="flex:1">Zapisz porę</button>
            <button type="submit" name="action" value="delete" class="button button-small" style="color:var(--bad)">Usuń</button>
          </div>
        </form>`).join('') || '<div style="font-size:12px;color:var(--muted);margin-bottom:6px">Brak wpisów w rozkładzie dnia.</div>'}

      <form method="POST" action="/ustawienia/rozklad" style="display:grid;grid-template-columns:96px 1fr auto;gap:6px;margin-top:10px">
        <input type="hidden" name="supplement_id" value="${s.id}">
        <input type="hidden" name="action" value="create">
        <input type="time" name="time_of_day" value="09:00" style="padding:8px;font-size:14px">
        <input type="text" name="amount" placeholder="ile, np. 1 kapsułka" style="padding:8px;font-size:14px">
        <button type="submit" class="button button-small button-fill">Dodaj</button>
      </form>
    `)).join('');

  const rulesHtml = (rules.results ?? []).map((r: any) => card(`
      <form method="POST" action="/ustawienia/regula">
        <input type="hidden" name="id" value="${r.id}">
        <div style="font-weight:600;margin-bottom:6px">${esc(r.group_name)}</div>
        <div style="display:grid;grid-template-columns:96px 1fr auto;gap:8px;align-items:center">
          <input type="number" name="min_days" min="0" max="7" value="${r.min_days_per_week ?? 0}" style="padding:8px;text-align:center">
          ${sel([['critical', 'krytyczne'], ['important', 'ważne'], ['nice', 'miłe']], r.severity, 'severity', 'padding:8px;font-size:13px')}
          <button type="submit" class="button button-small button-fill">Zapisz</button>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">dni w tygodniu, w których ta grupa ma się pojawić</div>
      </form>`)).join('');

  const content = `
    ${blockTitle('Okna jedzenia i catering')}
    ${card(generalHtml)}

    ${blockTitle('Fazy protokołu i cele makro')}
    ${phasesHtml}

    ${blockTitle('Suplementy i rozkład dnia')}
    ${card(`
      <form method="POST" action="/ustawienia/suplement" style="display:grid;grid-template-columns:1fr auto;gap:8px">
        <input type="hidden" name="id" value="new">
        <input type="text" name="name" placeholder="Nazwa nowego preparatu" required style="padding:10px">
        <button type="submit" class="button button-fill">Dodaj</button>
      </form>`)}
    ${suppHtml}

    ${blockTitle('Reguły braków')}
    ${rulesHtml}
  `;

  return c.html(page({ title: 'Ustawienia', tab: 'settings', header: 'Ustawienia', content }));
});

settings.post('/ustawienia/ogolne', async (c) => {
  const body = await c.req.parseBody();
  for (const [key, value] of Object.entries(body)) {
    await c.env.DB.prepare(`UPDATE settings SET value = ? WHERE key = ?`).bind(String(value), key).run();
  }
  return c.redirect('/ustawienia');
});

settings.post('/ustawienia/faza', async (c) => {
  const b = await c.req.parseBody();

  await c.env.DB.prepare(`UPDATE phases SET name = ?, date_from = ?, date_to = ? WHERE id = ?`)
    .bind(String(b.name), String(b.date_from), String(b.date_to || '') || null, Number(b.id)).run();

  // Pola celow nazywaja sie target_min_<id> i target_max_<id>. Kolumna wybierana
  // po prefiksie, nigdy sklejana z danych z formularza.
  for (const [key, value] of Object.entries(b)) {
    if (key.startsWith('target_min_')) {
      const id = Number(key.slice('target_min_'.length));
      if (id) await c.env.DB.prepare(`UPDATE targets SET min_value = ? WHERE id = ?`).bind(toNumberOrNull(value), id).run();
    } else if (key.startsWith('target_max_')) {
      const id = Number(key.slice('target_max_'.length));
      if (id) await c.env.DB.prepare(`UPDATE targets SET max_value = ? WHERE id = ?`).bind(toNumberOrNull(value), id).run();
    }
  }

  return c.redirect('/ustawienia');
});

settings.post('/ustawienia/suplement', async (c) => {
  const b = await c.req.parseBody();

  if (String(b.id) === 'new') {
    await c.env.DB.prepare(`INSERT INTO supplements (name, kind, status) VALUES (?, 'suplement', 'planned')`)
      .bind(String(b.name || 'Bez nazwy')).run();
    return c.redirect('/ustawienia');
  }

  await c.env.DB.prepare(
    `UPDATE supplements SET name = ?, brand = ?, kind = ?, dose = ?, purpose = ?, notes = ?, status = ?, rx = ?
     WHERE id = ?`
  ).bind(
    String(b.name), String(b.brand || '') || null, String(b.kind || 'suplement'),
    String(b.dose || '') || null, String(b.purpose || '') || null, String(b.notes || '') || null,
    String(b.status || 'active'), b.rx === '1' ? 1 : 0, Number(b.id)
  ).run();

  return c.redirect('/ustawienia');
});

settings.post('/ustawienia/rozklad', async (c) => {
  const b = await c.req.parseBody();
  const action = String(b.action || 'save');

  if (action === 'delete') {
    await c.env.DB.prepare(`DELETE FROM supplement_schedule WHERE id = ?`).bind(Number(b.id)).run();
  } else if (action === 'create') {
    await c.env.DB.prepare(
      `INSERT INTO supplement_schedule (supplement_id, time_of_day, amount, days, date_from)
       VALUES (?, ?, ?, 'daily', date('now'))`
    ).bind(Number(b.supplement_id), String(b.time_of_day || '09:00'), String(b.amount || '') || null).run();
  } else {
    await c.env.DB.prepare(
      `UPDATE supplement_schedule SET time_of_day = ?, amount = ?, with_meal = ?, days = ?, date_from = ?, date_to = ?
       WHERE id = ?`
    ).bind(
      String(b.time_of_day), String(b.amount || '') || null, String(b.with_meal || '') || null,
      String(b.days || 'daily'), String(b.date_from), String(b.date_to || '') || null, Number(b.id)
    ).run();
  }

  return c.redirect('/ustawienia');
});

settings.post('/ustawienia/regula', async (c) => {
  const b = await c.req.parseBody();
  await c.env.DB.prepare(`UPDATE coverage_rules SET min_days_per_week = ?, severity = ? WHERE id = ?`)
    .bind(Number(b.min_days), String(b.severity), Number(b.id)).run();
  return c.redirect('/ustawienia');
});

export default settings;
