import { Hono } from 'hono';
import { Env } from '../types';
import { page, card, blockTitle, esc, todayWarsaw, prettyDate, SLOT_LABEL } from '../views/ui';
import { stripHtml } from '../utils/ingredients';
import { linkMealFoods } from '../utils/link-foods';
import { STANY } from './day';

const meal = new Hono<{ Bindings: Env }>();

const SITTING_BY_SLOT: Record<string, number> = {
  sniadanie: 1, ii_sniadanie: 1, obiad: 2, podwieczorek: 3, kolacja: 3, inne: 0,
};

function numOrNull(v: unknown): number | null {
  const s = String(v ?? '').replace(',', '.').trim();
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

meal.get('/meal/:id/edit', async (c) => {
  const id = Number(c.req.param('id'));
  const m = await c.env.DB.prepare(`SELECT * FROM meals WHERE id = ?`).bind(id).first<any>();
  if (!m) return c.redirect('/');

  const macro = (name: string, label: string, value: number | null) =>
    `<div class="field">
      <label class="field-label" for="e-${name}">${label}</label>
      <input type="text" inputmode="decimal" id="e-${name}" name="${name}" value="${value ?? ''}" placeholder="?">
    </div>`;

  const content = `
    <div class="block" style="margin-top:10px">
      <a href="/day/${esc(m.date)}" class="button button-small">‹ ${esc(prettyDate(m.date))}</a>
    </div>

    ${blockTitle('Edycja posiłku', esc(m.source))}
    ${card(`
      <form method="POST" action="/meal/${id}" class="form-narrow">
        <div class="field">
          <label class="field-label" for="e-name">Co to było</label>
          <input type="text" id="e-name" name="name" value="${esc(m.name)}" required>
        </div>

        <div class="field">
          <label class="field-label" for="e-ing">Składniki, po przecinku</label>
          <textarea id="e-ing" name="ingredients" rows="3">${esc(stripHtml(m.ingredients_raw ?? ''))}</textarea>
        </div>
        <p class="hint">Zmiana składników przelicza wykluczenia i pokrycie grup dla tego dnia.</p>

        <div class="grid-2">
          <div class="field">
            <label class="field-label" for="e-slot">Posiłek</label>
            <select id="e-slot" name="slot">
              ${Object.entries(SLOT_LABEL).map(([k, v]) =>
                `<option value="${k}" ${m.slot === k ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="e-source">Skąd</label>
            <select id="e-source" name="source">
              ${['hfood', 'dom', 'restauracja'].map((s) =>
                `<option value="${s}" ${m.source === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="e-date">Data</label>
            <input type="date" id="e-date" name="date" value="${esc(m.date)}">
          </div>
          <div class="field">
            <label class="field-label" for="e-time">Początek</label>
            <input type="time" id="e-time" name="eaten_at" value="${esc(m.eaten_at ?? '')}">
          </div>
          <div class="field">
            <label class="field-label" for="e-dur">Ile trwał, min</label>
            <input type="text" inputmode="numeric" id="e-dur" name="duration_min" value="${m.duration_min ?? ''}" placeholder="30">
          </div>
        </div>
        <p class="hint">Przerwa liczy się od ostatniego kęsa, nie od pierwszego. Puste pole znaczy 30 minut.</p>

        <div class="subhead">Makra</div>
        <div class="grid-5">
          ${macro('kcal', 'kcal', m.kcal)}
          ${macro('protein_g', 'białko', m.protein_g)}
          ${macro('fat_g', 'tłuszcz', m.fat_g)}
          ${macro('carbs_g', 'węgle', m.carbs_g)}
          ${macro('fiber_g', 'błonnik', m.fiber_g)}
        </div>

        <label class="check">
          <input type="checkbox" name="estimated" value="1" ${m.estimated ? 'checked' : ''}>
          Makra podane na oko
        </label>
        <div class="field" style="margin-top:14px">
          <label class="field-label" for="e-stan">Stan</label>
          <select id="e-stan" name="stan">
            ${STANY.map(([v, l]) => `<option value="${v}" ${m.stan === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>

        <div class="field">
          <label class="field-label" for="e-frac">Ile zjedzone</label>
          <select id="e-frac" name="eaten_fraction">
            ${[1, 0.75, 0.5, 0.25].map((f) =>
              `<option value="${f}" ${Math.abs(Number(m.eaten_fraction) - f) < 0.01 ? 'selected' : ''}>${f === 1 ? 'całość' : `${f * 100}%`}</option>`).join('')}
          </select>
        </div>

        <div class="field">
          <label class="field-label" for="e-notes">Notatka</label>
          <input type="text" id="e-notes" name="notes" value="${esc(m.notes ?? '')}" placeholder="opcjonalnie">
        </div>

        <button type="submit" class="button button-fill" style="width:100%;margin-top:6px">Zapisz zmiany</button>
      </form>
    `)}

    ${m.source === 'hfood' ? `<div class="block"><p class="hint" style="margin:0">
      To pudełko z cateringu. Kolejny import menu nadpisze nazwę, skład i makra,
      ale zostawi stan, zjedzoną część i notatkę.
    </p></div>` : ''}

    ${blockTitle('Usuń')}
    ${card(`
      <form method="POST" action="/meal/${id}/delete"
            onsubmit="return confirm('Usunąć ten posiłek na dobre?')">
        <p style="margin:0 0 12px;font-size:13px;color:var(--muted)">
          Znika posiłek razem z powiązaniami do produktów. Sumy dnia i pokrycie grup przeliczą się same.
        </p>
        <button type="submit" class="button" style="color:var(--bad);width:100%">Usuń posiłek</button>
      </form>
    `)}
  `;

  return c.html(page({ title: 'Edycja posiłku', tab: 'today', header: 'Edycja posiłku', content }));
});

meal.post('/meal/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const b = await c.req.parseBody();
  const date = String(b.date || todayWarsaw());
  const slot = String(b.slot || 'inne');
  const ingredients = String(b.ingredients || '').trim() || null;

  await c.env.DB.prepare(
    `UPDATE meals SET date = ?, eaten_at = ?, duration_min = ?, slot = ?, sitting = ?, source = ?, name = ?,
       ingredients_raw = ?, kcal = ?, protein_g = ?, fat_g = ?, carbs_g = ?, fiber_g = ?,
       stan = ?, eaten_fraction = ?, estimated = ?, notes = ?
     WHERE id = ?`
  ).bind(
    date,
    String(b.eaten_at || '') || null,
    numOrNull(b.duration_min),
    slot,
    SITTING_BY_SLOT[slot] ?? 0,
    String(b.source || 'dom'),
    String(b.name || 'Bez nazwy'),
    ingredients,
    numOrNull(b.kcal), numOrNull(b.protein_g), numOrNull(b.fat_g),
    numOrNull(b.carbs_g), numOrNull(b.fiber_g),
    STANY.some(([v]) => v === b.stan) ? String(b.stan) : 'zjedzony',
    Number(b.eaten_fraction ?? 1) || 1,
    b.estimated === '1' ? 1 : 0,
    String(b.notes || '') || null,
    id
  ).run();

  // Brak skladnikow nie znaczy brak informacji: przy prostych pozycjach
  // nazwa jest skladem. Patrz komentarz w log.ts.
  await linkMealFoods(c.env.DB, id, ingredients ?? String(b.name || ''));

  return c.redirect(`/day/${date}`);
});

meal.post('/meal/:id/delete', async (c) => {
  const id = Number(c.req.param('id'));
  const row = await c.env.DB.prepare(`SELECT date FROM meals WHERE id = ?`).bind(id).first<{ date: string }>();

  await c.env.DB.prepare(`DELETE FROM meals WHERE id = ?`).bind(id).run();

  return c.redirect(`/day/${row?.date ?? todayWarsaw()}`);
});

export default meal;
