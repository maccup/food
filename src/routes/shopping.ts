import { Hono } from 'hono';
import { Env } from '../types';
import { page, card, blockTitle, emptyState, esc, todayWarsaw, shiftDate, prettyDate } from '../views/ui';
import { loadWeekGaps } from './gaps';

/**
 * Lista zakupow.
 *
 * Wczesniej byla doklejka na dole sekcji o brakach w widoku dnia: bez adresu,
 * bez pozycji w menu, widoczna dopiero po przewinieciu calego dnia. Lista, ktora
 * ma dzialac w sklepie, musi byc jednym dotknieciem z paska, a nie znaleziskiem.
 */
const shopping = new Hono<{ Bindings: Env }>();

/** Dokad wrocic po zapisie. Ten sam formularz dziala z dnia i z listy zakupow. */
function powrot(b: Record<string, unknown>): string {
  const wroc = String(b.wroc || '');
  if (wroc === 'zakupy') return '/zakupy';
  return `/day/${String(b.date || todayWarsaw())}`;
}

shopping.get('/zakupy', async (c) => {
  const db = c.env.DB;
  const date = todayWarsaw();
  const dow = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  const weekStart = shiftDate(date, -dow);

  const [otwarte, kupione, braki] = await Promise.all([
    db.prepare(
      `SELECT id, label, note, added_on FROM shopping WHERE bought = 0 ORDER BY added_on, id`
    ).all<any>(),
    db.prepare(
      `SELECT id, label, note, bought_on FROM shopping WHERE bought = 1
       ORDER BY bought_on DESC, id DESC LIMIT 30`
    ).all<any>(),
    loadWeekGaps(db, date, weekStart),
  ]);

  const pozycja = (s: any) => `<li>
    <div class="item-content"><div class="item-inner" style="padding:6px 0">
      <form method="POST" action="/zakupy/kupione">
        <input type="hidden" name="id" value="${s.id}">
        <input type="hidden" name="wroc" value="zakupy">
        <label class="check" style="min-height:48px">
          <input type="checkbox" name="bought" value="1" onchange="this.form.submit()">
          <span>
            <b>${esc(s.label)}</b>
            ${s.note ? `<span style="display:block;font-size:12px;color:var(--muted)">${esc(s.note)}</span>` : ''}
          </span>
        </label>
      </form>
    </div></div>
  </li>`;

  const listaHtml = (otwarte.results ?? []).length
    ? `<div class="list" style="margin:0"><ul>${(otwarte.results ?? []).map(pozycja).join('')}</ul></div>`
    : emptyState('Lista pusta. Podpowiedzi poniżej biorą się z grup, których w tym tygodniu brakuje.');

  /*
   * Podpowiedzi z regul pokrycia. Sedno przeniesienia: wczesniej te propozycje
   * zylly tylko w widoku dnia, wiec lista zakupow nigdy sama sie nie zapelniala.
   * Pokazujemy tylko to, czego w tym tygodniu zabraknie PO doliczeniu pudelek
   * z cateringu i czego nie ma juz na liscie. Bez tego warunku lista kazala
   * kupowac ryby w dniu, w ktorym pudelko z tunczykiem czekalo na jutro.
   */
  const doPodpowiedzi = braki
    .filter((g) => g.brakuje > 0 && !g.onShoppingList)
    .sort((a, b) =>
      (a.severity === 'critical' ? 0 : a.severity === 'important' ? 1 : 2) -
      (b.severity === 'critical' ? 0 : b.severity === 'important' ? 1 : 2)
    );

  const podpowiedziHtml = doPodpowiedzi.length
    ? `<div class="list" style="margin:0"><ul>${doPodpowiedzi.map((g) => `<li>
        <div class="item-content"><div class="item-inner" style="display:block;padding:10px 0">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">
            <b>${esc(g.name)}</b>
            <span style="color:${g.severity === 'critical' ? 'var(--bad)' : 'var(--warn)'};
                         font-weight:700;white-space:nowrap;font-size:13px">${g.dniZjedzone + g.dniPlan} z ${g.need} dni</span>
          </div>
          ${g.examples ? `<div style="font-size:13px;margin-top:3px">${esc(g.examples)}</div>` : ''}
          <form method="POST" action="/zakupy/dodaj" style="margin-top:8px">
            <input type="hidden" name="group_id" value="${g.group_id}">
            <input type="hidden" name="wroc" value="zakupy">
            <button type="submit" class="button button-small button-fill" style="width:100%">Dopisz do listy</button>
          </form>
        </div></div>
      </li>`).join('')}</ul></div>`
    : emptyState('Wszystkie grupy z reguł mają w tym tygodniu swoje dni.');

  const kupioneHtml = (kupione.results ?? []).length
    ? `<div class="list simple-list"><ul>${(kupione.results ?? []).map((s: any) => `<li>
        <span>${esc(s.label)}</span>
        <form method="POST" action="/zakupy/cofnij" style="display:flex;gap:8px;align-items:center">
          <input type="hidden" name="id" value="${s.id}">
          <span style="color:var(--muted);font-size:12px">${esc(s.bought_on ?? '')}</span>
          <button type="submit" class="button button-small">cofnij</button>
        </form>
      </li>`).join('')}</ul></div>`
    : emptyState('Nic jeszcze nie odhaczone.');

  const content = `
    ${blockTitle('Do kupienia', `${(otwarte.results ?? []).length} pozycji`)}
    ${listaHtml}

    <div class="block">
      <form method="POST" action="/zakupy/dodaj">
        <input type="hidden" name="wroc" value="zakupy">
        <div class="field">
          <label class="field-label" for="shop-add">Dopisz</label>
          <div style="display:grid;grid-template-columns:1fr auto;gap:8px">
            <input type="text" name="label" id="shop-add" placeholder="np. kiwi zielone" required>
            <button type="submit" class="button button-fill">Dodaj</button>
          </div>
        </div>
      </form>
    </div>

    ${blockTitle('Podpowiedzi', 'czego brakuje w tym tygodniu')}
    ${podpowiedziHtml}

    ${blockTitle('Kupione')}
    <details>
      <summary style="cursor:pointer;list-style:none;padding:10px 16px;font-size:13px;color:var(--muted)">
        Pokaż ostatnie 30 pozycji
      </summary>
      ${kupioneHtml}
    </details>
  `;

  return c.html(page({
    title: 'Zakupy',
    tab: 'shopping',
    header: 'Zakupy',
    right: `<span style="font-size:12px;color:var(--muted)">${esc(prettyDate(date))}</span>`,
    content,
  }));
});

shopping.post('/zakupy/dodaj', async (c) => {
  const b = await c.req.parseBody();
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

  return c.redirect(powrot(b as any));
});

shopping.post('/zakupy/kupione', async (c) => {
  const b = await c.req.parseBody();

  await c.env.DB.prepare(`UPDATE shopping SET bought = 1, bought_on = date('now') WHERE id = ?`)
    .bind(Number(b.id)).run();

  return c.redirect(powrot(b as any));
});

/** Odhaczenie przez pomylke ma dac sie cofnac, inaczej pozycja przepada. */
shopping.post('/zakupy/cofnij', async (c) => {
  const b = await c.req.parseBody();

  await c.env.DB.prepare(`UPDATE shopping SET bought = 0, bought_on = NULL WHERE id = ?`)
    .bind(Number(b.id)).run();

  return c.redirect('/zakupy');
});

export default shopping;
