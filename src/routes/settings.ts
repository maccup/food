import { Hono } from 'hono';
import { Env } from '../types';
import { page, card, esc, todayWarsaw, hhmmToMinutes } from '../views/ui';
import { listSettings, listCateringOrders, Setting, CateringOrder } from '../utils/settings';

const settings = new Hono<{ Bindings: Env }>();

/** Nazwy grup ustawień. Klucz bez wpisu tutaj ląduje w „Pozostałe", nie znika. */
const GRUPA_LABEL: Record<string, string> = {
  okna: 'Okna jedzenia',
  przerwy: 'Zasady przerw',
  inne: 'Pozostałe',
};

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

const DAY_CODES: Array<[string, string]> = [
  ['pon', 'Pn'], ['wt', 'Wt'], ['sr', 'Śr'], ['czw', 'Cz'], ['pt', 'Pt'], ['sob', 'So'], ['nie', 'Nd'],
];

/**
 * Dni tygodnia jako przełączniki, nie wolny tekst. CLAUDE.md tego repo ostrzega,
 * że dopasowanie dni jest wrażliwe na dokładny format tokenów, a literówka
 * w polu tekstowym po cichu psuje cały rozkład.
 */
function dayChips(days: string, prefix: string): string {
  const set = days === 'daily' ? new Set(DAY_CODES.map(([c]) => c)) : new Set(days.split(',').map((d) => d.trim()));
  return `<div style="display:flex;gap:4px;flex-wrap:wrap">${DAY_CODES.map(([code, label]) => `
    <label style="flex:1;min-width:38px;text-align:center;font-size:12px;padding:9px 0;border-radius:8px;
                  border:1px solid var(--hairline);cursor:pointer;
                  ${set.has(code) ? 'background:var(--color-primary);color:#fff;font-weight:600' : ''}">
      <input type="checkbox" name="${prefix}${code}" value="1" ${set.has(code) ? 'checked' : ''}
             style="display:none">${label}
    </label>`).join('')}</div>`;
}

/** Zaznaczone dni na wartość kolumny: komplet zapisujemy jako 'daily'. */
function daysFromBody(b: Record<string, unknown>, prefix: string): string {
  const picked = DAY_CODES.filter(([code]) => b[`${prefix}${code}`] === '1').map(([code]) => code);
  if (picked.length === 0 || picked.length === DAY_CODES.length) return 'daily';
  return picked.join(',');
}

const sel = (options: Array<[string, string]>, current: string | null, name: string, style = '') =>
  `<select name="${name}" style="${style}">${options
    .map(([v, l]) => `<option value="${v}" ${String(current ?? '') === v ? 'selected' : ''}>${l}</option>`)
    .join('')}</select>`;

/**
 * Zwijana sekcja. Ten sam wzorzec co lista suplementów: <details> z nagłówkiem
 * w <summary>, bez javascriptu. `podpis` to gotowy HTML, escapuje wywołujący.
 */
function blok(tytul: string, podpis: string | null, tresc: string, otwarty = false): string {
  return `<details ${otwarty ? 'open' : ''} style="margin:14px 0">
    <summary style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;
                    min-height:48px;cursor:pointer;list-style:none;padding:6px 2px">
      <b style="font-size:15px">${esc(tytul)}</b>
      ${podpis ? `<span style="font-size:12px;color:var(--muted);text-align:right">${podpis}</span>` : ''}
    </summary>
    ${tresc}
  </details>`;
}

/**
 * Czy godziny okien mieszczą się w progu przerwy.
 *
 * Godziny podejść i próg przerwy to dwa niezależne pola, które muszą do siebie
 * pasować, a nic tego nie sprawdzało. 09:00 / 14:00 / 18:30 mieści się w progu
 * 4 h tylko przy posiłku 30-minutowym. Przy 45 minutach druga przerwa spada do
 * 3 h 45 i próg pęka po cichu. To odczyt, nie blokada: pokazuje rozjazd, nie zabrania go.
 */
function przerwyOkien(s: Setting[]): Array<{ od: string; koniec: string; doGodz: string; minuty: number; ok: boolean }> {
  const wartosc = (k: string) => s.find((x) => x.key === k)?.value ?? '';
  const czasy = ['sitting_1_time', 'sitting_2_time', 'sitting_3_time'].map(wartosc).filter(Boolean);
  if (czasy.length < 2) return [];

  const trwanie = Number(wartosc('default_meal_min') || 30);
  const prog = Number(wartosc('min_gap_hours') || 4) * 60;

  return czasy.slice(0, -1).map((od, i) => {
    const koniec = hhmmToMinutes(od) + trwanie;
    const minuty = hhmmToMinutes(czasy[i + 1]) - koniec;
    return {
      od,
      koniec: `${String(Math.floor(koniec / 60) % 24).padStart(2, '0')}:${String(koniec % 60).padStart(2, '0')}`,
      doGodz: czasy[i + 1],
      minuty,
      ok: minuty >= prog,
    };
  });
}

function czasPrzerwy(minuty: number): string {
  const abs = Math.abs(minuty);
  return `${minuty < 0 ? '−' : ''}${Math.floor(abs / 60)} h ${String(abs % 60).padStart(2, '0')}`;
}

/** Krótki podpis w nagłówku bloku. Pełny rachunek siedzi w `kontrolaOkien`. */
function podsumowanieOkien(s: Setting[]): string {
  const p = przerwyOkien(s);
  if (!p.length) return '';
  return p
    .map((x) => `<span style="color:${x.ok ? 'var(--ok)' : 'var(--bad)'};font-weight:600">${czasPrzerwy(x.minuty)} ${x.ok ? '✓' : '✗'}</span>`)
    .join(' <span style="color:var(--muted)">&middot;</span> ');
}

/*
 * Rachunek pokazany, nie sam wynik. Wczesniej stalo tu „4 h 30 ✓" przy oknach
 * 08:00 i 13:00, wiec brakujace pol godziny wygladalo na blad aplikacji.
 * Te 30 minut to `default_meal_min` z sasiedniego bloku: przerwa liczy sie
 * od konca posilku, bo fala oczyszczajaca jelito rusza dopiero po oproznieniu
 * zoladka, a nie od chwili siadania do stolu.
 */
function kontrolaOkien(s: Setting[]): string {
  const wiersze = przerwyOkien(s);
  if (!wiersze.length) return '';

  const trwanie = Number(s.find((x) => x.key === 'default_meal_min')?.value || 30);

  return `<p style="margin:0 0 6px">Przerwa liczy się od <b>końca</b> posiłku, nie od godziny startu.
      Posiłek trwa domyślnie ${trwanie} min (pole „Domyślny czas posiłku” w bloku „Zasady przerw”),
      więc każde okno zabiera tyle z przerwy do następnego.</p>
    ${wiersze.map((x) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:2px 0">
      <span>${esc(x.od)} plus ${trwanie} min, czyli koniec ${esc(x.koniec)}, do ${esc(x.doGodz)}</span>
      <span style="color:${x.ok ? 'var(--ok)' : 'var(--bad)'};font-weight:600;white-space:nowrap">${czasPrzerwy(x.minuty)} ${x.ok ? '✓' : '✗'}</span>
    </div>`).join('')}`;
}

/** Przeszłe, aktywne, planowane. Liczone z dat, żeby nie było flagi do przestawiania. */
function statusZamowienia(o: CateringOrder, dzis: string): { label: string; cls: string } {
  if (o.date_to && o.date_to < dzis) return { label: 'zakończone', cls: 'forbidden' };
  if (o.date_from > dzis) return { label: 'planowane', cls: 'limit' };
  return { label: 'aktywne', cls: 'prefer' };
}

function toNumberOrNull(value: unknown): number | null {
  const s = String(value ?? '').replace(',', '.').trim();
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

settings.get('/ustawienia', async (c) => {
  const db = c.env.DB;

  const [general, phases, targets, supplements, schedule, rules, templates, orders] = await Promise.all([
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
    db.prepare(
      `SELECT * FROM meal_templates WHERE archived = 0 ORDER BY times_used DESC, name`
    ).all<any>(),
    listCateringOrders(db),
  ]);

  const dzis = todayWarsaw();

  /*
   * Jeden formularz na grupe, nie jeden na wszystko. Handler /ustawienia/ogolne
   * aktualizuje klucze obecne w ciele zadania, wiec rozbicie na grupy nie wymaga
   * zadnej zmiany po stronie zapisu.
   */
  const grupy = new Map<string, Setting[]>();
  for (const s of general) {
    if (!grupy.has(s.grupa)) grupy.set(s.grupa, []);
    grupy.get(s.grupa)!.push(s);
  }

  const poleUstawienia = (s: Setting) => `<div style="margin-bottom:14px">
      <label class="field-label" for="set-${esc(s.key)}">${esc(s.label)}</label>
      ${s.hint ? `<div style="font-size:12px;color:var(--muted);margin:2px 0 4px">${esc(s.hint)}</div>` : ''}
      <input type="${s.kind === 'time' ? 'time' : s.kind === 'number' ? 'number' : 'text'}"
             id="set-${esc(s.key)}" name="${esc(s.key)}" value="${esc(s.value)}"
             style="width:100%;padding:10px;font-size:15px">
    </div>`;

  const grupaHtml = (klucz: string) => card(`<form method="POST" action="/ustawienia/ogolne">
      ${(grupy.get(klucz) ?? []).map(poleUstawienia).join('')}
      ${klucz === 'okna'
        ? `<div style="font-size:12px;color:var(--muted);margin:-4px 0 12px;line-height:1.45">
             ${kontrolaOkien(general)}
           </div>`
        : ''}
      <button type="submit" class="button button-fill">Zapisz</button>
    </form>`);

  const zamowienieHtml = (o: CateringOrder) => {
    const st = statusZamowienia(o, dzis);
    return card(`
      <form method="POST" action="/ustawienia/catering">
        <input type="hidden" name="id" value="${o.id}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px">
          <b>${esc(o.provider)}, zamówienie ${esc(o.order_id)}</b>
          <span class="flag ${st.cls}">${st.label}</span>
        </div>
        <div class="grid-2">
          <div class="field">
            <label class="field-label">Numer zamówienia</label>
            <input type="text" name="order_id" value="${esc(o.order_id)}">
          </div>
          <div class="field">
            <label class="field-label">Numer diety</label>
            <input type="text" name="diet_id" value="${esc(o.diet_id ?? '')}">
          </div>
          <div class="field">
            <label class="field-label">Od</label>
            <input type="date" name="date_from" value="${esc(o.date_from)}">
          </div>
          <div class="field">
            <label class="field-label">Do</label>
            <input type="date" name="date_to" value="${esc(o.date_to ?? '')}">
          </div>
        </div>
        <div class="field">
          <label class="field-label">Dni bez dostawy</label>
          <input type="text" name="no_delivery" value="${esc(o.no_delivery ?? '')}"
                 placeholder="2026-08-21..2026-08-24, 2026-09-11..2026-09-14">
        </div>
        <p class="hint">Zakresy po przecinku. Kalendarz oznaczy je jako przerwę w dostawie, a nie jako brak wpisu.</p>
        <div class="field">
          <label class="field-label">Notatka</label>
          <input type="text" name="notes" value="${esc(o.notes ?? '')}" placeholder="opcjonalnie">
        </div>
        <div style="display:flex;gap:8px">
          <button type="submit" name="action" value="save" class="button button-small button-fill" style="flex:1">Zapisz</button>
          <button type="submit" name="action" value="delete" class="button button-small" style="color:var(--bad)">Usuń</button>
        </div>
      </form>`);
  };

  const cateringHtml = `
    ${(orders ?? []).map(zamowienieHtml).join('') || card('<p class="hint" style="margin:0">Brak zamówień.</p>')}
    ${card(`
      <form method="POST" action="/ustawienia/catering">
        <input type="hidden" name="action" value="create">
        <div class="field">
          <label class="field-label" for="new-order">Nowe zamówienie</label>
          <div style="display:grid;grid-template-columns:1fr 150px auto;gap:8px">
            <input type="text" name="order_id" id="new-order" placeholder="numer zamówienia" required>
            <input type="date" name="date_from" value="${dzis}" required>
            <button type="submit" class="button button-fill">Dodaj</button>
          </div>
        </div>
        <p class="hint">Numer diety, datę końca i dni bez dostawy uzupełnisz po dodaniu.</p>
      </form>`)}`;

  const targetsByPhase = new Map<number, any[]>();
  for (const t of targets.results ?? []) {
    if (!targetsByPhase.has(t.phase_id)) targetsByPhase.set(t.phase_id, []);
    targetsByPhase.get(t.phase_id)!.push(t);
  }

  const phasesHtml = (phases.results ?? []).map((p: any) => card(`
      <form method="POST" action="/ustawienia/faza">
        <input type="hidden" name="id" value="${p.id}">
        <input type="text" name="name" value="${esc(p.name)}" style="width:100%;padding:8px;font-weight:600;margin-bottom:8px">
        <div class="grid-2">
          <div class="field">
            <label class="field-label">Od</label>
            <input type="date" name="date_from" value="${esc(p.date_from)}">
          </div>
          <div class="field">
            <label class="field-label">Do</label>
            <input type="date" name="date_to" value="${esc(p.date_to ?? '')}">
          </div>
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

  const statusPill: Record<string, string> = {
    active: 'biorę', planned: 'plan', paused: 'pauza', discontinued: 'odstawione',
  };

  const suppHtml = (supplements.results ?? []).map((s: any) => card(`
      <details ${s.status === 'active' ? 'open' : ''}>
      <summary style="display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:48px;cursor:pointer;list-style:none">
        <span>
          <b>${esc(s.name)}</b>
          <span style="font-size:12px;color:var(--muted);display:block">${esc(s.dose ?? '')}${(scheduleBySupp.get(s.id) ?? []).length ? ` &middot; ${(scheduleBySupp.get(s.id) ?? []).length}x dziennie` : ''}</span>
        </span>
        <span class="flag ${s.status === 'active' ? 'prefer' : s.status === 'discontinued' ? 'forbidden' : 'limit'}">${statusPill[s.status] ?? s.status}</span>
      </summary>
      <form method="POST" action="/ustawienia/suplement" style="margin:12px 0">
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
          ${sel(WITH_MEAL_OPTIONS, sc.with_meal, 'with_meal', 'padding:8px;font-size:13px;width:100%;margin-bottom:6px')}
          <div style="margin-bottom:6px">${dayChips(sc.days, 'day_')}</div>
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
      </details>
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

  const szablonyHtml = (templates.results ?? []).map((t: any) => card(`
      <form method="POST" action="/ustawienia/szablon">
        <input type="hidden" name="id" value="${t.id}">
        <div class="field">
          <label class="field-label">Nazwa</label>
          <input type="text" name="name" value="${esc(t.name)}">
        </div>
        <div class="field">
          <label class="field-label">Skład, po przecinku</label>
          <input type="text" name="ingredients" value="${esc(t.ingredients ?? '')}" placeholder="po nim działają wykluczenia">
        </div>
        <div class="grid-5">
          ${[['kcal', 'kcal'], ['protein_g', 'białko'], ['fat_g', 'tłuszcz'], ['carbs_g', 'węgle'], ['fiber_g', 'błonnik']]
            .map(([k, l]) => `<div class="field">
              <label class="field-label">${l}</label>
              <input type="text" inputmode="decimal" name="${k}" value="${t[k] ?? ''}">
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span style="font-size:12px;color:var(--muted)">użyte ${t.times_used}x</span>
          <button type="submit" name="action" value="save" class="button button-small button-fill" style="margin-left:auto">Zapisz</button>
          <button type="submit" name="action" value="delete" class="button button-small" style="color:var(--bad)">Usuń</button>
        </div>
      </form>`)).join('');

  const nowySzablonHtml = card(`
    <form method="POST" action="/ustawienia/szablon">
      <input type="hidden" name="id" value="new">
      <div class="field">
        <label class="field-label" for="new-template">Nowy szablon</label>
        <div style="display:grid;grid-template-columns:1fr auto;gap:8px">
          <input type="text" name="name" id="new-template" placeholder="np. Kiwi" required>
          <button type="submit" class="button button-fill">Dodaj</button>
        </div>
      </div>
      <p class="hint">Skład i makra uzupełnisz na liście poniżej. Skład jest ważniejszy niż makra, bo to po nim działają wykluczenia.</p>
    </form>`);

  const content = `
    ${blok('Okna jedzenia', podsumowanieOkien(general), grupaHtml('okna'), true)}
    ${blok('Zasady przerw', null, grupaHtml('przerwy'), true)}
    ${[...grupy.keys()].filter((g) => g !== 'okna' && g !== 'przerwy')
      .map((g) => blok(GRUPA_LABEL[g] ?? g, null, grupaHtml(g))).join('')}
    ${blok('Catering', `${(orders ?? []).length} ${(orders ?? []).length === 1 ? 'zamówienie' : 'zamówienia'}`, cateringHtml)}
    ${blok('Szablony posiłków', 'jedno dotknięcie w zakładce Dopisz',
      `${nowySzablonHtml}<div class="cols">${szablonyHtml}</div>`)}
    ${blok('Fazy protokołu i cele makro', null, `<div class="cols">${phasesHtml}</div>`)}

    ${blok('Suplementy i rozkład dnia', null, `
      ${card(`
        <form method="POST" action="/ustawienia/suplement">
          <input type="hidden" name="id" value="new">
          <div class="field">
            <label class="field-label" for="new-supp">Nazwa nowego preparatu</label>
            <div style="display:grid;grid-template-columns:1fr auto;gap:8px">
              <input type="text" name="name" id="new-supp" placeholder="np. Imbir" required>
              <button type="submit" class="button button-fill">Dodaj</button>
            </div>
          </div>
        </form>`)}
      <div class="cols">${suppHtml}</div>`)}
    ${blok('Reguły braków', null, `<div class="cols">${rulesHtml}</div>`)}
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
      daysFromBody(b as any, 'day_'), String(b.date_from), String(b.date_to || '') || null, Number(b.id)
    ).run();
  }

  return c.redirect('/ustawienia');
});

settings.post('/ustawienia/catering', async (c) => {
  const b = await c.req.parseBody();
  const action = String(b.action || 'save');

  if (action === 'delete') {
    await c.env.DB.prepare(`DELETE FROM catering_orders WHERE id = ?`).bind(Number(b.id)).run();
  } else if (action === 'create') {
    // Jak przy suplementach: nowy wiersz powstaje z minimum, reszte uzupelnia
    // sie na liscie. Formularz dodawania z dziesiecioma polami nikt nie wypelnia.
    await c.env.DB.prepare(
      `INSERT INTO catering_orders (order_id, date_from) VALUES (?, ?)`
    ).bind(String(b.order_id || ''), String(b.date_from || todayWarsaw())).run();
  } else {
    await c.env.DB.prepare(
      `UPDATE catering_orders SET order_id = ?, diet_id = ?, date_from = ?, date_to = ?,
         no_delivery = ?, notes = ? WHERE id = ?`
    ).bind(
      String(b.order_id || ''), String(b.diet_id || '') || null,
      String(b.date_from || todayWarsaw()), String(b.date_to || '') || null,
      String(b.no_delivery || '') || null, String(b.notes || '') || null, Number(b.id)
    ).run();
  }

  return c.redirect('/ustawienia');
});

settings.post('/ustawienia/szablon', async (c) => {
  const b = await c.req.parseBody();

  if (String(b.id) === 'new') {
    await c.env.DB.prepare(`INSERT INTO meal_templates (name) VALUES (?)`)
      .bind(String(b.name || 'Bez nazwy')).run();
    return c.redirect('/ustawienia');
  }

  const id = Number(b.id);

  if (String(b.action) === 'delete') {
    // Archiwum, nie kasowanie: licznik uzyc jest informacja o nawykach.
    await c.env.DB.prepare(`UPDATE meal_templates SET archived = 1 WHERE id = ?`).bind(id).run();
    return c.redirect('/ustawienia');
  }

  await c.env.DB.prepare(
    `UPDATE meal_templates SET name = ?, ingredients = ?, kcal = ?, protein_g = ?,
       fat_g = ?, carbs_g = ?, fiber_g = ? WHERE id = ?`
  ).bind(
    String(b.name || 'Bez nazwy'), String(b.ingredients || '') || null,
    toNumberOrNull(b.kcal), toNumberOrNull(b.protein_g), toNumberOrNull(b.fat_g),
    toNumberOrNull(b.carbs_g), toNumberOrNull(b.fiber_g), id
  ).run();

  return c.redirect('/ustawienia');
});

settings.post('/ustawienia/regula', async (c) => {
  const b = await c.req.parseBody();
  await c.env.DB.prepare(`UPDATE coverage_rules SET min_days_per_week = ?, severity = ? WHERE id = ?`)
    .bind(Number(b.min_days), String(b.severity), Number(b.id)).run();
  return c.redirect('/ustawienia');
});

export default settings;
