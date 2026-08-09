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

const TABS: Array<[string, string, string]> = [
  ['posilek', '🍽️', 'Posiłek'],
  ['objaw', '😖', 'Objaw'],
  ['stolec', '🚽', 'Stolec'],
];

log.get('/log', async (c) => {
  const date = c.req.query('date') ?? todayWarsaw();
  const co = TABS.some(([k]) => k === c.req.query('co')) ? c.req.query('co')! : 'posilek';

  const slotOptions = Object.entries(SLOT_LABEL)
    .map(([k, v]) => `<option value="${k}"${k === 'obiad' ? ' selected' : ''}>${v}</option>`)
    .join('');

  // Jeden formularz naraz. Wczesniej wszystkie trzy wisialy pod soba i trzeba
  // bylo przewijac obok dwoch, ktorych sie akurat nie wypelnia.
  const segmented = `<div class="segmented">
    ${TABS.map(([k, icon, label]) =>
      `<a href="/log?co=${k}&date=${date}" class="${co === k ? 'active' : ''}"${co === k ? ' aria-current="page"' : ''}>
        <span class="seg-icon" aria-hidden="true">${icon}</span>${label}
      </a>`).join('')}
  </div>`;

  const dateBar = `<div class="block" style="margin-top:8px">
    <label class="field-label" for="glob-date">Dzień, do którego dopisujesz</label>
    <input type="date" id="glob-date" value="${date}"
           onchange="location.href='/log?co=${co}&date=' + this.value">
  </div>`;

  const posilek = `
    ${blockTitle('Posiłek', 'makra możesz zostawić puste')}
    ${card(`
      <form method="POST" action="/log/meal" class="form-narrow">
        <input type="hidden" name="date" value="${date}">

        <div class="field">
          <label class="field-label" for="meal-name">Co to było</label>
          <input type="text" id="meal-name" name="name" placeholder="np. Pad thai z kurczakiem" required>
        </div>

        <div class="field">
          <label class="field-label" for="meal-ing">Składniki, po przecinku</label>
          <textarea id="meal-ing" name="ingredients" rows="3" placeholder="makaron ryżowy, kurczak, orzechy arachidowe, sos sojowy"></textarea>
        </div>
        <p class="hint">
          Składniki są ważniejsze niż makra. To po nich aplikacja sprawdza wykluczenia
          i pokrycie grup, nawet jeśli nie znasz żadnej liczby.
        </p>

        <div class="grid-2">
          <div class="field">
            <label class="field-label" for="meal-slot">Posiłek</label>
            <select id="meal-slot" name="slot">${slotOptions}</select>
          </div>
          <div class="field">
            <label class="field-label" for="meal-source">Skąd</label>
            <select id="meal-source" name="source">
              <option value="restauracja">restauracja</option>
              <option value="dom">dom</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="meal-time">Godzina</label>
            <input type="time" id="meal-time" name="time">
          </div>
        </div>

        <div class="subhead">Makra, jeśli je znasz albo chcesz strzelić</div>
        <div class="grid-5">
          ${[['kcal', 'kcal'], ['protein_g', 'białko'], ['fat_g', 'tłuszcz'], ['carbs_g', 'węgle'], ['fiber_g', 'błonnik']]
            .map(([n, l]) => `<div class="field">
              <label class="field-label" for="m-${n}">${l}</label>
              <input type="text" inputmode="decimal" id="m-${n}" name="${n}" placeholder="?">
            </div>`).join('')}
        </div>

        <label class="check" style="margin-bottom:14px">
          <input type="checkbox" name="estimated" value="1" checked>
          Makra podane na oko
        </label>

        <button type="submit" class="button button-fill" style="width:100%">Zapisz posiłek</button>
      </form>
    `)}`;

  const objaw = `
    ${blockTitle('Objaw')}
    ${card(`
      <form method="POST" action="/log/symptom" class="form-narrow">
        <input type="hidden" name="date" value="${date}">
        <div class="field">
          <label class="field-label" for="s-kind">Rodzaj</label>
          <select id="s-kind" name="kind">
            ${['gazy', 'wzdecia', 'bol', 'przelewanie', 'zgaga', 'inne']
              .map((k) => `<option value="${k}">${k === 'wzdecia' ? 'wzdęcia' : k === 'bol' ? 'ból' : k}</option>`).join('')}
          </select>
        </div>
        <div class="grid-2">
          <div class="field">
            <label class="field-label" for="s-sev">Nasilenie, 0 do 10</label>
            <input type="number" id="s-sev" name="severity" min="0" max="10" value="5">
          </div>
          <div class="field">
            <label class="field-label" for="s-time">Godzina</label>
            <input type="time" id="s-time" name="time">
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="s-note">Notatka</label>
          <input type="text" id="s-note" name="notes" placeholder="opcjonalnie">
        </div>
        <button type="submit" class="button button-fill" style="width:100%">Zapisz objaw</button>
      </form>
    `)}`;

  const stolec = `
    ${blockTitle('Stolec', 'skala Bristolska 1 do 7')}
    ${card(`
      <form method="POST" action="/log/stool" class="form-narrow">
        <input type="hidden" name="date" value="${date}">
        <div class="field">
          <label class="field-label" for="st-type">Typ</label>
          <select id="st-type" name="bristol">
            <option value="1">1, twarde grudki, zaparcie</option>
            <option value="2">2, grudkowaty, zbity</option>
            <option value="3">3, z pęknięciami, norma</option>
            <option value="4" selected>4, gładki i miękki, ideał</option>
            <option value="5">5, miękkie kawałki</option>
            <option value="6">6, papkowaty, biegunka</option>
            <option value="7">7, wodnisty</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label" for="st-time">Godzina</label>
          <input type="time" id="st-time" name="time">
        </div>
        <div class="check-row">
          <label class="check"><input type="checkbox" name="straining" value="1"> parcie</label>
          <label class="check"><input type="checkbox" name="incomplete" value="1"> niepełne</label>
          <label class="check"><input type="checkbox" name="floating" value="1"> pływający</label>
        </div>
        <button type="submit" class="button button-fill" style="width:100%">Zapisz stolec</button>
      </form>
    `)}`;

  const content = `
    ${segmented}
    ${dateBar}
    ${co === 'posilek' ? posilek : co === 'objaw' ? objaw : stolec}
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
  //
  // Gdy skladnikow nie podano, parsujemy nazwe. Przy prostych pozycjach
  // ("Kawa espresso", "Kiwi") nazwa JEST skladem, a wpisywanie jej drugi raz
  // to praca dla aplikacji, nie dla czlowieka. Bez tego taki posilek byl
  // dla regul niewidzialny i limit kofeiny sie nie odzywal.
  const doParsowania = ingredients ?? String(b.name || '');
  if (inserted && doParsowania) {
    for (const ing of parseIngredients(doParsowania)) {
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
