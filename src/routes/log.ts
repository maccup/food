import { Hono } from 'hono';
import { Env } from '../types';
import { page, card, blockTitle, esc, todayWarsaw, SLOT_LABEL } from '../views/ui';
import { parseIngredients } from '../utils/ingredients';

const log = new Hono<{ Bindings: Env }>();

const SITTING_BY_SLOT: Record<string, number> = {
  sniadanie: 1, ii_sniadanie: 1, obiad: 2, podwieczorek: 3, kolacja: 3, inne: 0,
};

function numOrNull(v: FormDataEntryValue | undefined): number | null {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

log.get('/log', async (c) => {
  const date = c.req.query('date') ?? todayWarsaw();
  const saved = c.req.query('ok');

  const slotOptions = Object.entries(SLOT_LABEL)
    .map(([k, v]) => `<option value="${k}"${k === 'obiad' ? ' selected' : ''}>${v}</option>`)
    .join('');

  const content = `
    ${saved ? `<div class="block"><div style="background:#dcfce7;color:#15803d;padding:10px 14px;border-radius:10px;font-size:14px">Zapisane: ${esc(saved)}</div></div>` : ''}

    ${blockTitle('Posiłek', 'makra możesz zostawić puste')}
    ${card(`
      <form method="POST" action="/log/meal">
        <input type="hidden" name="date" value="${date}">
        <div class="list no-hairlines" style="margin:0">
          <ul>
            <li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
              <input type="text" name="name" placeholder="Co to było, np. Pad thai z kurczakiem" required>
            </div></div></li>
            <li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
              <textarea name="ingredients" rows="3" placeholder="Co w tym było, po przecinku: makaron ryżowy, kurczak, orzechy arachidowe, sos sojowy"></textarea>
            </div></div></li>
          </ul>
        </div>
        <p style="font-size:12px;color:var(--muted);margin:4px 2px 12px">
          Opis składników jest ważniejszy niż makra. Po nim aplikacja sprawdza wykluczenia i pokrycie grup,
          nawet jeśli nie znasz żadnej liczby.
        </p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <label style="font-size:13px">Posiłek
            <select name="slot" style="width:100%;padding:8px;margin-top:4px">${slotOptions}</select>
          </label>
          <label style="font-size:13px">Skąd
            <select name="source" style="width:100%;padding:8px;margin-top:4px">
              <option value="restauracja">restauracja</option>
              <option value="dom">dom</option>
            </select>
          </label>
          <label style="font-size:13px">Data
            <input type="date" name="date_override" value="${date}" style="width:100%;padding:8px;margin-top:4px">
          </label>
          <label style="font-size:13px">Godzina
            <input type="time" name="time" style="width:100%;padding:8px;margin-top:4px">
          </label>
        </div>

        <div style="font-size:13px;font-weight:600;margin-bottom:6px">Makra, jeśli je znasz albo chcesz strzelić</div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:10px">
          ${[['kcal', 'kcal'], ['protein_g', 'białko'], ['fat_g', 'tłuszcz'], ['carbs_g', 'węgle'], ['fiber_g', 'błonnik']]
            .map(([n, l]) => `<label style="font-size:11px;color:var(--muted)">${l}
              <input type="text" inputmode="decimal" name="${n}" placeholder="?" style="width:100%;padding:6px;margin-top:2px;font-size:14px">
            </label>`).join('')}
        </div>

        <label style="font-size:13px;display:flex;gap:8px;align-items:center;margin-bottom:12px">
          <input type="checkbox" name="estimated" value="1" checked>
          Makra podane na oko
        </label>

        <button type="submit" class="button button-fill">Zapisz posiłek</button>
      </form>
    `)}

    ${blockTitle('Objaw')}
    ${card(`
      <form method="POST" action="/log/symptom">
        <input type="hidden" name="date" value="${date}">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
          <label style="font-size:13px">Rodzaj
            <select name="kind" style="width:100%;padding:8px;margin-top:4px">
              ${['gazy', 'wzdecia', 'bol', 'przelewanie', 'zgaga', 'inne']
                .map((k) => `<option value="${k}">${k === 'wzdecia' ? 'wzdęcia' : k === 'bol' ? 'ból' : k}</option>`).join('')}
            </select>
          </label>
          <label style="font-size:13px">Nasilenie 0 do 10
            <input type="number" name="severity" min="0" max="10" value="5" style="width:100%;padding:8px;margin-top:4px">
          </label>
          <label style="font-size:13px">Godzina
            <input type="time" name="time" style="width:100%;padding:8px;margin-top:4px">
          </label>
        </div>
        <input type="text" name="notes" placeholder="Notatka, opcjonalnie" style="width:100%;padding:8px;margin-bottom:10px">
        <button type="submit" class="button button-fill">Zapisz objaw</button>
      </form>
    `)}

    ${blockTitle('Stolec', 'skala Bristolska 1 do 7')}
    ${card(`
      <form method="POST" action="/log/stool">
        <input type="hidden" name="date" value="${date}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <label style="font-size:13px">Typ
            <select name="bristol" style="width:100%;padding:8px;margin-top:4px">
              <option value="1">1, twarde grudki, zaparcie</option>
              <option value="2">2, grudkowaty, zbity</option>
              <option value="3">3, z pęknięciami, norma</option>
              <option value="4" selected>4, gładki i miękki, ideał</option>
              <option value="5">5, miękkie kawałki</option>
              <option value="6">6, papkowaty, biegunka</option>
              <option value="7">7, wodnisty</option>
            </select>
          </label>
          <label style="font-size:13px">Godzina
            <input type="time" name="time" style="width:100%;padding:8px;margin-top:4px">
          </label>
        </div>
        <div style="display:flex;gap:16px;font-size:13px;margin-bottom:10px;flex-wrap:wrap">
          <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="straining" value="1"> parcie</label>
          <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="incomplete" value="1"> niepełne</label>
          <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="floating" value="1"> pływający</label>
        </div>
        <button type="submit" class="button button-fill">Zapisz stolec</button>
      </form>
    `)}
  `;

  return c.html(page({ title: 'Dopisz', tab: 'log', header: 'Dopisz', content }));
});

log.post('/log/meal', async (c) => {
  const b = await c.req.parseBody();
  const date = String(b.date_override || b.date || todayWarsaw());
  const slot = String(b.slot || 'inne');
  const ingredients = String(b.ingredients || '').trim() || null;

  const inserted = await c.env.DB.prepare(
    `INSERT INTO meals (date, eaten_at, slot, sitting, source, name, ingredients_raw,
       kcal, protein_g, fat_g, carbs_g, fiber_g, estimated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  )
    .bind(
      date,
      String(b.time || '') || null,
      slot,
      SITTING_BY_SLOT[slot] ?? 0,
      String(b.source || 'dom'),
      String(b.name || 'Bez nazwy'),
      ingredients,
      numOrNull(b.kcal), numOrNull(b.protein_g), numOrNull(b.fat_g),
      numOrNull(b.carbs_g), numOrNull(b.fiber_g),
      b.estimated === '1' ? 1 : 0
    )
    .first<{ id: number }>();

  // Ten sam parser co przy imporcie z cateringu, wiec wykluczenia dzialaja
  // tak samo dla obiadu w restauracji, jak dla pudelka.
  if (inserted && ingredients) {
    for (const ing of parseIngredients(ingredients)) {
      const alias = await c.env.DB.prepare(`SELECT food_id FROM food_aliases WHERE alias = ?`)
        .bind(ing.alias).first<{ food_id: number | null }>();

      if (!alias) {
        await c.env.DB.prepare(`INSERT INTO food_aliases (alias, food_id) VALUES (?, NULL)`).bind(ing.alias).run();
        continue;
      }
      if (alias.food_id === null) continue;

      await c.env.DB.prepare(`INSERT OR IGNORE INTO meal_foods (meal_id, food_id) VALUES (?, ?)`)
        .bind(inserted.id, alias.food_id).run();
    }
  }

  return c.redirect(`/day/${date}`);
});

log.post('/log/symptom', async (c) => {
  const b = await c.req.parseBody();
  const date = String(b.date || todayWarsaw());
  await c.env.DB.prepare(`INSERT INTO symptoms (date, time, kind, severity, notes) VALUES (?, ?, ?, ?, ?)`)
    .bind(date, String(b.time || '') || null, String(b.kind || 'inne'), numOrNull(b.severity), String(b.notes || '') || null)
    .run();
  return c.redirect(`/day/${date}`);
});

log.post('/log/stool', async (c) => {
  const b = await c.req.parseBody();
  const date = String(b.date || todayWarsaw());
  await c.env.DB.prepare(
    `INSERT INTO stools (date, time, bristol, straining, incomplete, floating) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(date, String(b.time || '') || null, Number(b.bristol || 4),
      b.straining === '1' ? 1 : 0, b.incomplete === '1' ? 1 : 0, b.floating === '1' ? 1 : 0)
    .run();
  return c.redirect(`/day/${date}`);
});

export default log;
