import { Hono } from 'hono';
import { Env } from '../types';
import { page, card, blockTitle, esc, todayWarsaw, godzinaWpisu, terazWarsaw, SLOT_LABEL } from '../views/ui';
import { linkMealFoods } from '../utils/link-foods';

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
  ['stres', '🧠', 'Stres'],
];

/**
 * Kotwice skali stresu. Bez nich „6" znaczy co innego w poniedzialek niz w
 * piatek, a cala wartosc tej liczby polega na tym, ze da sie ja porownac
 * z ta sprzed miesiaca. Opisane co drugi stopien, bo opisanie wszystkich
 * jedenastu i tak nikt nie przeczyta.
 */
const STRES_OPISY: Record<number, string> = {
  0: 'spokój, nic nie wisiało',
  2: 'lekkie napięcie',
  4: 'zauważalne, ale odpuszczało',
  6: 'wyraźne, trudno było odłożyć',
  8: 'bardzo duże, wracało w myślach',
  10: 'nie dało się normalnie funkcjonować',
};

export const STRES_POWODY = ['praca', 'pieniądze', 'relacje', 'zdrowie', 'studia', 'sen', 'inne'];

log.get('/log', async (c) => {
  const date = c.req.query('date') ?? todayWarsaw();
  const db = c.env.DB;
  const co = TABS.some(([k]) => k === c.req.query('co')) ? c.req.query('co')! : 'posilek';

  // Edycja to ten sam formularz z wypelnionymi polami, nie osobny ekran.
  // Drugi formularz o tych samych polach rozjechalby sie przy pierwszej zmianie,
  // a tu chodzi o poprawienie literowki, nie o inny rodzaj wpisu.
  const edytujId = co === 'objaw' || co === 'stolec' ? Number(c.req.query('edytuj')) || null : null;
  const edytowany = edytujId
    ? await db.prepare(
        `SELECT * FROM ${co === 'objaw' ? 'symptoms' : 'stools'} WHERE id = ?`
      ).bind(edytujId).first<any>()
    : null;

  // Stres nie ma trybu edycji, bo ma jeden wiersz na dobe. Wejscie w zakladke
  // pokazuje to, co juz wpisane za ten dzien, a zapis nadpisuje.
  const stres = co === 'stres'
    ? await db.prepare(`SELECT * FROM stress WHERE date = ?`).bind(date).first<any>()
    : null;

  const slotOptions = Object.entries(SLOT_LABEL)
    .map(([k, v]) => `<option value="${k}"${k === 'obiad' ? ' selected' : ''}>${v}</option>`)
    .join('');

  // Jeden formularz naraz. Wczesniej wszystkie trzy wisialy pod soba i trzeba
  // bylo przewijac obok dwoch, ktorych sie akurat nie wypelnia.
  // Szablony: rzeczy powtarzalne jednym dotknieciem, najczesciej jedzone na
  // poczatku. Czestosc liczy sie z DZIENNIKA po nazwie, nie z licznika
  // `times_used`: posilki dopisywane przez czat i import laduja w `meals`
  // bez dotykania licznika, wiec sam licznik klamal o realnych nawykach.
  // Licznik zostaje jako rozstrzygniecie remisow, bo widzi uzycia szablonu
  // sprzed ewentualnej zmiany nazwy.
  const szablony = co === 'posilek'
    ? (await db.prepare(
        `SELECT t.id, t.name, t.kcal, t.slot,
                (SELECT COUNT(*) FROM meals m
                 WHERE m.name = t.name COLLATE NOCASE AND m.stan = 'zjedzony') AS uzycia
         FROM meal_templates t
         WHERE t.archived = 0
         ORDER BY uzycia DESC, t.times_used DESC, t.last_used DESC, t.name LIMIT 20`
      ).all<any>()).results ?? []
    : [];

  const szybkie = szablony.length
    ? `${blockTitle('Szybkie dodanie', 'jedno dotknięcie')}
       <div class="block">
         <div class="chips">
           ${szablony.map((t: any) => `
             <form method="POST" action="/log/szablon/${t.id}" style="display:contents">
               <input type="hidden" name="date" value="${date}">
               <button type="submit" class="chip">
                 <span>${esc(t.name)}</span>
                 ${t.kcal ? `<span class="chip-kcal">${Math.round(t.kcal)}</span>` : ''}
               </button>
             </form>`).join('')}
         </div>
       </div>`
    : '';

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
            <label class="field-label" for="meal-time">Początek</label>
            <input type="time" id="meal-time" name="time">
          </div>
          <div class="field">
            <label class="field-label" for="meal-dur">Ile trwał, min</label>
            <input type="text" inputmode="numeric" id="meal-dur" name="duration_min" placeholder="30">
          </div>
        </div>
        <p class="hint">Przerwa liczy się od ostatniego kęsa, nie od pierwszego, bo fala oczyszczająca rusza dopiero po opróżnieniu żołądka. Puste pole znaczy 30 minut.</p>

        <div class="subhead">Makra, jeśli je znasz albo chcesz strzelić</div>
        <div class="grid-5">
          ${[['kcal', 'kcal'], ['protein_g', 'białko'], ['fat_g', 'tłuszcz'], ['carbs_g', 'węgle'], ['fiber_g', 'błonnik']]
            .map(([n, l]) => `<div class="field">
              <label class="field-label" for="m-${n}">${l}</label>
              <input type="text" inputmode="decimal" id="m-${n}" name="${n}" placeholder="?">
            </div>`).join('')}
        </div>

        <label class="check">
          <input type="checkbox" name="estimated" value="1" checked>
          Makra podane na oko
        </label>
        <label class="check" style="margin-bottom:14px">
          <input type="checkbox" name="jako_szablon" value="1">
          Zapamiętaj jako szablon, żeby dodawać jednym dotknięciem
        </label>

        <button type="submit" class="button button-fill" style="width:100%">Zapisz posiłek</button>
      </form>
    `)}`;

  const e = edytowany;
  const anuluj = e
    ? `<a href="/day/${esc(e.date)}" class="button" style="width:100%;margin-top:8px">Anuluj</a>`
    : '';

  const objaw = `
    ${blockTitle(e ? 'Popraw objaw' : 'Objaw')}
    ${card(`
      <form method="POST" action="/log/symptom" class="form-narrow">
        <input type="hidden" name="date" value="${e ? esc(e.date) : date}">
        ${e ? `<input type="hidden" name="id" value="${e.id}">` : ''}
        <div class="field">
          <label class="field-label" for="s-kind">Rodzaj</label>
          <select id="s-kind" name="kind">
            ${['gazy', 'wzdecia', 'bol', 'przelewanie', 'zgaga', 'inne']
              .map((k) => `<option value="${k}"${e?.kind === k ? ' selected' : ''}>${k === 'wzdecia' ? 'wzdęcia' : k === 'bol' ? 'ból' : k}</option>`).join('')}
          </select>
        </div>
        <div class="grid-2">
          <div class="field">
            <label class="field-label" for="s-sev">Nasilenie, 0 do 10</label>
            <input type="number" id="s-sev" name="severity" min="0" max="10" value="${e?.severity ?? 5}">
          </div>
          <div class="field">
            <label class="field-label" for="s-time">Godzina</label>
            <input type="time" id="s-time" name="time" value="${esc(e?.time ?? '')}">
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="s-note">Notatka</label>
          <input type="text" id="s-note" name="notes" placeholder="opcjonalnie" value="${esc(e?.notes ?? '')}">
        </div>
        <button type="submit" class="button button-fill" style="width:100%">${e ? 'Zapisz zmiany' : 'Zapisz objaw'}</button>
        ${anuluj}
      </form>
    `)}`;

  const bristolOpisy: Array<[number, string]> = [
    [1, 'twarde grudki, zaparcie'], [2, 'grudkowaty, zbity'], [3, 'z pęknięciami, norma'],
    [4, 'gładki i miękki, ideał'], [5, 'miękkie kawałki'], [6, 'papkowaty, biegunka'], [7, 'wodnisty'],
  ];

  const stolec = `
    ${blockTitle(e ? 'Popraw stolec' : 'Stolec', 'skala Bristolska 1 do 7')}
    ${card(`
      <form method="POST" action="/log/stool" class="form-narrow">
        <input type="hidden" name="date" value="${e ? esc(e.date) : date}">
        ${e ? `<input type="hidden" name="id" value="${e.id}">` : ''}
        <div class="field">
          <label class="field-label" for="st-type">Typ</label>
          <select id="st-type" name="bristol">
            ${bristolOpisy.map(([n, opis]) =>
              `<option value="${n}"${(e ? e.bristol === n : n === 4) ? ' selected' : ''}>${n}, ${opis}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="field-label" for="st-time">Godzina</label>
          <input type="time" id="st-time" name="time" value="${esc(e?.time ?? '')}">
        </div>
        <div class="check-row">
          <label class="check"><input type="checkbox" name="straining" value="1"${e?.straining ? ' checked' : ''}> parcie</label>
          <label class="check"><input type="checkbox" name="incomplete" value="1"${e?.incomplete ? ' checked' : ''}> niepełne</label>
          <label class="check"><input type="checkbox" name="floating" value="1"${e?.floating ? ' checked' : ''}> pływający</label>
        </div>
        <button type="submit" class="button button-fill" style="width:100%">${e ? 'Zapisz zmiany' : 'Zapisz stolec'}</button>
        ${anuluj}
      </form>
    `)}`;

  const stresForm = `
    ${blockTitle(stres ? 'Popraw stres dnia' : 'Stres dnia', 'jedna liczba za całą dobę')}
    ${card(`
      <form method="POST" action="/log/stres" class="form-narrow">
        <input type="hidden" name="date" value="${date}">
        <div class="field">
          <label class="field-label" for="str-level">Ile tego było, 0 do 10</label>
          <select id="str-level" name="level">
            ${[...Array(11).keys()].map((n) =>
              `<option value="${n}"${(stres ? stres.level === n : n === 3) ? ' selected' : ''}>${n}${STRES_OPISY[n] ? `, ${STRES_OPISY[n]}` : ''}</option>`
            ).join('')}
          </select>
        </div>
        <div class="field">
          <label class="field-label" for="str-powod">Skąd głównie</label>
          <select id="str-powod" name="powod">
            <option value="">nie wiem albo wszystko naraz</option>
            ${STRES_POWODY.map((p) =>
              `<option value="${p}"${stres?.powod === p ? ' selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="field-label" for="str-note">Notatka</label>
          <input type="text" id="str-note" name="notes" placeholder="opcjonalnie" value="${esc(stres?.notes ?? '')}">
        </div>
        <p class="hint">
          Wpisuj wieczorem, za cały dzień. Jelito reaguje na napięcie w skali godzin i doby,
          więc dokładniejszy pomiar nic nie doda, a wpis zrobiony raz dziennie faktycznie powstanie.
          Napięcie z dziś potrafi odezwać się dopiero jutro rano, dlatego statystyki zestawiają
          każdy dzień ze stolcami tego dnia i następnego.
        </p>
        <button type="submit" class="button button-fill" style="width:100%">${stres ? 'Zapisz zmiany' : 'Zapisz stres dnia'}</button>
      </form>
      ${stres
        ? `<form method="POST" action="/log/stres/usun" style="margin-top:8px"
                 onsubmit="return confirm('Usunąć wpis o stresie z tego dnia?')">
             <input type="hidden" name="date" value="${date}">
             <button type="submit" class="button" style="width:100%">Usuń wpis z tego dnia</button>
           </form>`
        : ''}
    `)}`;

  const content = `
    ${segmented}
    ${dateBar}
    ${szybkie}
    ${co === 'posilek' ? posilek : co === 'objaw' ? objaw : co === 'stolec' ? stolec : stresForm}
  `;

  return c.html(page({ title: 'Dopisz', tab: 'log', header: 'Dopisz', content }));
});

log.post('/log/meal', async (c) => {
  const b = await c.req.parseBody();
  const date = String(b.date_override || b.date || todayWarsaw());
  const slot = String(b.slot || 'inne');
  const ingredients = String(b.ingredients || '').trim() || null;

  const inserted = await c.env.DB.prepare(
    `INSERT INTO meals (date, eaten_at, duration_min, slot, sitting, source, name, ingredients_raw,
       kcal, protein_g, fat_g, carbs_g, fiber_g, estimated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  )
    .bind(
      date,
      godzinaWpisu(b.time, date),
      numOrNull(b.duration_min),
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
  if (inserted) {
    await linkMealFoods(c.env.DB, inserted.id, ingredients ?? String(b.name || ''));
  }

  if (b.jako_szablon === '1') {
    await c.env.DB.prepare(
      `INSERT INTO meal_templates (name, ingredients, slot, source, kcal, protein_g, fat_g, carbs_g, fiber_g)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      String(b.name || 'Bez nazwy'), ingredients, slot, String(b.source || 'dom'),
      numOrNull(b.kcal), numOrNull(b.protein_g), numOrNull(b.fat_g),
      numOrNull(b.carbs_g), numOrNull(b.fiber_g)
    ).run();
  }

  return c.redirect(`/day/${date}`);
});

/** Dodanie z szablonu: godzina bierze sie z zegara, reszta z szablonu. */
log.post('/log/szablon/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const b = await c.req.parseBody();
  const date = String(b.date || todayWarsaw());

  const t = await c.env.DB.prepare(`SELECT * FROM meal_templates WHERE id = ?`).bind(id).first<any>();
  if (!t) return c.redirect(`/log?date=${date}`);

  const wstawiony = await c.env.DB.prepare(
    `INSERT INTO meals (date, eaten_at, slot, sitting, source, name, ingredients_raw,
       kcal, protein_g, fat_g, carbs_g, fiber_g, estimated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    date, terazWarsaw(), t.slot, SITTING_BY_SLOT[t.slot] ?? 0, t.source, t.name, t.ingredients,
    t.kcal, t.protein_g, t.fat_g, t.carbs_g, t.fiber_g, t.estimated
  ).first<{ id: number }>();

  if (wstawiony) {
    await linkMealFoods(c.env.DB, wstawiony.id, t.ingredients ?? t.name);
  }

  await c.env.DB.prepare(
    `UPDATE meal_templates SET times_used = times_used + 1, last_used = ? WHERE id = ?`
  ).bind(date, id).run();

  return c.redirect(`/day/${date}`);
});

log.post('/log/symptom', async (c) => {
  const b = await c.req.parseBody();
  const date = String(b.date || todayWarsaw());
  const id = Number(b.id) || null;
  const pola = [
    godzinaWpisu(b.time, date), String(b.kind || 'inne'),
    numOrNull(b.severity), String(b.notes || '') || null,
  ];

  await (id
    ? c.env.DB.prepare(`UPDATE symptoms SET time = ?, kind = ?, severity = ?, notes = ? WHERE id = ?`)
        .bind(...pola, id)
    : c.env.DB.prepare(`INSERT INTO symptoms (time, kind, severity, notes, date) VALUES (?, ?, ?, ?, ?)`)
        .bind(...pola, date)
  ).run();

  return c.redirect(`/day/${date}`);
});

log.post('/log/symptom/:id/usun', async (c) => {
  const b = await c.req.parseBody();
  await c.env.DB.prepare(`DELETE FROM symptoms WHERE id = ?`).bind(Number(c.req.param('id'))).run();
  return c.redirect(`/day/${String(b.date || todayWarsaw())}`);
});

log.post('/log/stool', async (c) => {
  const b = await c.req.parseBody();
  const date = String(b.date || todayWarsaw());
  const id = Number(b.id) || null;
  const pola = [
    godzinaWpisu(b.time, date), Number(b.bristol || 4),
    b.straining === '1' ? 1 : 0, b.incomplete === '1' ? 1 : 0, b.floating === '1' ? 1 : 0,
  ];

  await (id
    ? c.env.DB.prepare(
        `UPDATE stools SET time = ?, bristol = ?, straining = ?, incomplete = ?, floating = ? WHERE id = ?`
      ).bind(...pola, id)
    : c.env.DB.prepare(
        `INSERT INTO stools (time, bristol, straining, incomplete, floating, date) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(...pola, date)
  ).run();

  return c.redirect(`/day/${date}`);
});

/**
 * Zapis stresu to nadpisanie, nie dopisanie.
 *
 * Jeden wiersz na dobe, wiec wejscie w zakladke drugi raz tego samego dnia
 * poprawia liczbe zamiast tworzyc druga. Dzieki temu nie ma osobnego trybu
 * edycji ani ryzyka, ze jeden dzien bedzie mial dwie sprzeczne oceny.
 */
log.post('/log/stres', async (c) => {
  const b = await c.req.parseBody();
  const date = String(b.date || todayWarsaw());
  const level = Math.min(10, Math.max(0, Number(b.level ?? 0) || 0));

  await c.env.DB.prepare(
    `INSERT INTO stress (date, level, powod, notes) VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET level = excluded.level, powod = excluded.powod, notes = excluded.notes`
  ).bind(date, level, String(b.powod || '') || null, String(b.notes || '') || null).run();

  return c.redirect(`/day/${date}`);
});

log.post('/log/stres/usun', async (c) => {
  const b = await c.req.parseBody();
  const date = String(b.date || todayWarsaw());
  await c.env.DB.prepare(`DELETE FROM stress WHERE date = ?`).bind(date).run();
  return c.redirect(`/day/${date}`);
});

log.post('/log/stool/:id/usun', async (c) => {
  const b = await c.req.parseBody();
  await c.env.DB.prepare(`DELETE FROM stools WHERE id = ?`).bind(Number(c.req.param('id'))).run();
  return c.redirect(`/day/${String(b.date || todayWarsaw())}`);
});

export default log;
