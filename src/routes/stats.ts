import { Hono } from 'hono';
import { Env } from '../types';
import { page, card, blockTitle, emptyState, esc, pl, todayWarsaw, shiftDate, daysBetween, DAY_NAMES } from '../views/ui';
import { loadSettings } from '../utils/settings';
import { statystykaPrzerw, PosilekDoPrzerw } from '../utils/gaps-stats';

/**
 * Statystyki z dowolnego zakresu dat.
 *
 * Zastapily ekran tygodnia, ktory liczyl na sztywno siedem dni wstecz. Zakres
 * siedzi w adresie, wiec da sie go zapisac w zakladce i wkleic w rozmowie.
 */
const stats = new Hono<{ Bindings: Env }>();

const ZAKRESY: Array<[string, string]> = [
  ['7', '7 dni'],
  ['30', '30 dni'],
  ['miesiac', 'ten miesiąc'],
  ['rok', 'rok'],
];

/** Dzien tygodnia liczony od poniedzialku, zeby tygodnie w tabeli zaczynaly sie tam, gdzie w regulach. */
function poniedzialek(date: string): string {
  const dow = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  return shiftDate(date, -dow);
}

function okres(zakres: string, od: string | undefined, doDnia: string | undefined) {
  const dzis = todayWarsaw();
  if (od && doDnia) return { od, do: doDnia, zakres: 'wlasny' };

  if (zakres === 'miesiac') return { od: `${dzis.slice(0, 7)}-01`, do: dzis, zakres };
  if (zakres === 'rok') return { od: shiftDate(dzis, -364), do: dzis, zakres };
  if (zakres === '30') return { od: shiftDate(dzis, -29), do: dzis, zakres };
  return { od: shiftDate(dzis, -6), do: dzis, zakres: '7' };
}

function czasPl(minuty: number): string {
  const h = Math.floor(Math.abs(minuty) / 60);
  const m = Math.abs(minuty) % 60;
  return `${minuty < 0 ? '−' : ''}${h} h ${String(m).padStart(2, '0')}`;
}

/** Stary adres zostaje zywy, zeby nie psuc zakladek. */
stats.get('/week', (c) => c.redirect('/statystyki?zakres=7'));

stats.get('/statystyki', async (c) => {
  const db = c.env.DB;
  const o = okres(
    c.req.query('zakres') ?? '7',
    c.req.query('od') || undefined,
    c.req.query('do') || undefined
  );
  const dniZakresu = daysBetween(o.od, o.do) + 1;

  const [totals, phase, coverage, rules, breaches, posilki, objawy, stolce] = await Promise.all([
    db.prepare(`SELECT * FROM v_day_totals WHERE date BETWEEN ? AND ? ORDER BY date`).bind(o.od, o.do).all<any>(),
    db.prepare(`SELECT * FROM phases WHERE ? >= date_from AND (date_to IS NULL OR ? <= date_to) LIMIT 1`)
      .bind(o.do, o.do).first<any>(),
    db.prepare(
      `SELECT group_id, COUNT(DISTINCT date) AS days FROM v_group_coverage
       WHERE date BETWEEN ? AND ? GROUP BY group_id`
    ).bind(o.od, o.do).all<any>(),
    db.prepare(
      `SELECT r.group_id, r.min_days_per_week, r.severity, r.rationale, g.name, g.provides
       FROM coverage_rules r JOIN food_groups g ON g.id = r.group_id
       WHERE (r.active_from IS NULL OR r.active_from <= ?) AND (r.active_to IS NULL OR r.active_to >= ?)
       ORDER BY CASE r.severity WHEN 'critical' THEN 1 WHEN 'important' THEN 2 ELSE 3 END`
    ).bind(o.do, o.od).all<any>(),
    db.prepare(
      `SELECT food_name, level, COUNT(*) AS n FROM v_restriction_breaches
       WHERE date BETWEEN ? AND ? AND stan = 'zjedzony'
       GROUP BY food_name, level ORDER BY level DESC, n DESC`
    ).bind(o.od, o.do).all<any>(),
    db.prepare(
      `SELECT id, date, sitting, eaten_at, duration_min, kcal, protein_g, fat_g, stan FROM meals
       WHERE date BETWEEN ? AND ? ORDER BY date, COALESCE(eaten_at, '99:99'), id`
    ).bind(o.od, o.do).all<PosilekDoPrzerw & { date: string }>(),
    db.prepare(
      `SELECT kind, COUNT(*) AS n, ROUND(AVG(severity), 1) AS srednia FROM symptoms
       WHERE date BETWEEN ? AND ? GROUP BY kind ORDER BY n DESC`
    ).bind(o.od, o.do).all<any>(),
    db.prepare(
      `SELECT bristol, COUNT(*) AS n FROM stools WHERE date BETWEEN ? AND ? GROUP BY bristol ORDER BY bristol`
    ).bind(o.od, o.do).all<any>(),
  ]);

  const targets = phase
    ? await db.prepare(`SELECT metric, min_value, max_value FROM targets WHERE phase_id = ?`).bind(phase.id).all<any>()
    : { results: [] };
  const t = new Map<string, any>((targets.results ?? []).map((x: any) => [x.metric, x]));

  const settings = await loadSettings(db);
  const minGap = Number(settings.get('min_gap_hours') || 4);
  const przerwy = statystykaPrzerw(
    posilki.results ?? [],
    {
      progKcal: Number(settings.get('gap_kcal_prog') || 30),
      progMakro: Number(settings.get('gap_makro_prog') || 1),
      domyslneTrwanie: Number(settings.get('default_meal_min') || 30),
    },
    minGap * 60
  );

  // Ta sama komorka co na starym ekranie tygodnia: kolor plus strzalka, bo sam
  // odcien to za malo przy daltonizmie i w sloncu.
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
    const low = spec.min_value !== null && value < spec.min_value;
    const mark = bad || warn ? (low ? '↓' : '↑') : '';
    return `<td style="text-align:right;color:${color};font-weight:600;white-space:nowrap">${pl(value, 0)}<span style="font-size:11px">${mark}</span></td>`;
  };

  const lista = totals.results ?? [];
  const srednia = (key: string, z: any[] = lista) =>
    z.length ? z.reduce((a: number, d: any) => a + Number(d[key] ?? 0), 0) / z.length : 0;

  /*
   * Do 14 dni tabela idzie dzien po dniu. Powyzej zwija sie w tygodnie, bo
   * 365 wierszy nikt nie czyta, a srednia tygodniowa jest i tak wlasciwa
   * jednostka: reguly pokrycia grup sa tygodniowe.
   */
  const poTygodniach = dniZakresu > 14;

  let rows = '';
  if (poTygodniach) {
    const grupy = new Map<string, any[]>();
    for (const d of lista) {
      const k = poniedzialek(d.date);
      if (!grupy.has(k)) grupy.set(k, []);
      grupy.get(k)!.push(d);
    }
    rows = [...grupy.entries()].map(([start, dni]) => `<tr>
      <td><a href="/statystyki?od=${start}&do=${shiftDate(start, 6)}">${start.slice(8)}.${start.slice(5, 7)}</a>
        <span style="color:var(--muted);font-size:11px">${dni.length} dni</span></td>
      ${cell(srednia('kcal', dni), 'kcal')}${cell(srednia('protein_g', dni), 'protein_g')}${cell(srednia('fat_g', dni), 'fat_g')}${cell(srednia('carbs_g', dni), 'carbs_g')}${cell(srednia('fiber_g', dni), 'fiber_g')}
    </tr>`).join('');
  } else {
    rows = lista.map((d: any) => {
      const dow = DAY_NAMES[new Date(`${d.date}T12:00:00Z`).getUTCDay()].slice(0, 3);
      return `<tr>
        <td><a href="/day/${d.date}">${dow} ${d.date.slice(8)}.${d.date.slice(5, 7)}</a></td>
        ${cell(d.kcal, 'kcal')}${cell(d.protein_g, 'protein_g')}${cell(d.fat_g, 'fat_g')}${cell(d.carbs_g, 'carbs_g')}${cell(d.fiber_g, 'fiber_g')}
      </tr>`;
    }).join('');
  }

  const table = lista.length
    ? `<div style="overflow-x:auto"><table class="data-table" style="width:100%;font-size:13px">
        <thead><tr><th>${poTygodniach ? 'Tydzień od' : 'Dzień'}</th><th style="text-align:right">kcal</th><th style="text-align:right">B</th><th style="text-align:right">T</th><th style="text-align:right">W</th><th style="text-align:right">bł</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="border-top:2px solid rgba(0,0,0,.15)">
          <td><b>średnia</b></td>
          ${cell(srednia('kcal'), 'kcal')}${cell(srednia('protein_g'), 'protein_g')}${cell(srednia('fat_g'), 'fat_g')}${cell(srednia('carbs_g'), 'carbs_g')}${cell(srednia('fiber_g'), 'fiber_g')}
        </tr></tfoot>
      </table></div>`
    : emptyState('Brak wpisów z tego zakresu.');

  /*
   * Kompletnosc na samej gorze i celowo przed kazda inna liczba. Srednia z trzech
   * dni wyglada na ekranie identycznie jak srednia z trzydziestu, a znaczy co innego.
   */
  const kompletnosc = card(`
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
      <span style="font-size:13px;color:var(--muted)">Dni z wpisami</span>
      <b style="font-size:19px">${lista.length} <span style="font-size:13px;font-weight:400;color:var(--muted)">z ${dniZakresu}</span></b>
    </div>
    ${lista.length < dniZakresu
      ? `<p class="hint" style="margin:6px 0 0">Reszta liczb dotyczy tylko dni z wpisami. Puste dni nie są wliczane do średnich.</p>`
      : ''}`);

  const przerwyHtml = przerwy.przerwy
    ? card(`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <div style="font-size:12px;color:var(--muted)">Średnia przerwa</div>
          <b style="font-size:19px;color:${przerwy.srednia >= minGap * 60 ? 'var(--ok)' : 'var(--bad)'}">${czasPl(przerwy.srednia)}</b>
        </div>
        <div>
          <div style="font-size:12px;color:var(--muted)">Najkrótsza</div>
          <b style="font-size:19px;color:${(przerwy.najkrotsza ?? 0) >= minGap * 60 ? 'var(--ok)' : 'var(--bad)'}">${czasPl(przerwy.najkrotsza ?? 0)}</b>
        </div>
        <div>
          <div style="font-size:12px;color:var(--muted)">Poniżej ${minGap} h</div>
          <b style="font-size:19px;color:${przerwy.ponizejProgu ? 'var(--bad)' : 'var(--ok)'}">${przerwy.ponizejProgu} z ${przerwy.przerwy}</b>
        </div>
        <div>
          <div style="font-size:12px;color:var(--muted)">Dni z za krótką</div>
          <b style="font-size:19px;color:${przerwy.dniPonizejProgu ? 'var(--bad)' : 'var(--ok)'}">${przerwy.dniPonizejProgu} z ${przerwy.dni}</b>
        </div>
      </div>
      <p class="hint" style="margin:10px 0 0">
        Przerwa liczy się od końca całego podejścia do początku następnego. Pozycje poniżej progu
        kalorycznego, jak czarne espresso, przerwy nie przerywają.
      </p>`)
    : emptyState('Za mało wpisów z godzinami, żeby policzyć przerwy.');

  const covBy = new Map<number, any>((coverage.results ?? []).map((x: any) => [x.group_id, x]));
  const tygodni = Math.max(1, dniZakresu / 7);
  const gaps = (rules.results ?? []).map((r: any) => {
    const dniZGrupa = covBy.get(r.group_id)?.days ?? 0;
    // Norma jest tygodniowa, wiec przy dluzszym zakresie porownujemy srednia na tydzien.
    const naTydzien = dniZGrupa / tygodni;
    const need = r.min_days_per_week ?? 0;
    const ok = naTydzien >= need;
    const color = ok ? 'var(--ok)' : r.severity === 'critical' ? 'var(--bad)' : 'var(--warn)';
    return `<li>
      <div class="item-content"><div class="item-inner" style="display:block;padding:10px 0">
        <div style="display:flex;justify-content:space-between;gap:8px">
          <b style="font-size:14px">${esc(r.name)}</b>
          <span style="color:${color};font-weight:700;white-space:nowrap">${pl(naTydzien, 1)} z ${need} dni/tydz.</span>
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
    : emptyState('Żadnych naruszeń w tym zakresie.');

  const stolceLista = stolce.results ?? [];
  const stolceRazem = stolceLista.reduce((a: number, s: any) => a + s.n, 0);
  const zdrowiaHtml = (objawy.results ?? []).length || stolceRazem
    ? card(`
      ${stolceRazem ? `
        <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Stolce, skala Bristol (${stolceRazem} wpisów)</div>
        <div style="display:flex;gap:4px;align-items:flex-end;height:56px;margin-bottom:14px">
          ${[1, 2, 3, 4, 5, 6, 7].map((b) => {
            const n = stolceLista.find((s: any) => s.bristol === b)?.n ?? 0;
            const h = stolceRazem ? Math.round((n / stolceRazem) * 44) : 0;
            // 3 i 4 to postac prawidlowa, 1 i 2 to zaparcie, 6 i 7 biegunka.
            const kolor = b === 3 || b === 4 ? 'var(--ok)' : b <= 2 ? 'var(--warn)' : 'var(--bad)';
            return `<div style="flex:1;text-align:center">
              <div style="height:${Math.max(h, n ? 4 : 1)}px;background:${n ? kolor : 'var(--hairline)'};border-radius:3px 3px 0 0"></div>
              <div style="font-size:10px;color:var(--muted);margin-top:3px">${b}</div>
              <div style="font-size:11px;font-weight:600">${n || ''}</div>
            </div>`;
          }).join('')}
        </div>` : ''}
      ${(objawy.results ?? []).length
        ? `<div style="font-size:12px;color:var(--muted);margin-bottom:4px">Objawy</div>
           ${(objawy.results ?? []).map((s: any) =>
             `<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0">
                <span>${esc(s.kind)}</span><span style="color:var(--muted)">${s.n}x, średnio ${pl(s.srednia ?? 0, 1)}/10</span>
              </div>`).join('')}`
        : '<p class="hint" style="margin:0">Żadnych objawów w tym zakresie.</p>'}`)
    : emptyState('Brak wpisów o objawach i stolcu.');

  const przycisk = (wartosc: string, label: string) =>
    `<a href="/statystyki?zakres=${wartosc}" class="button button-small ${o.zakres === wartosc ? 'button-fill' : ''}">${label}</a>`;

  const content = `
    <div class="block" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
      ${ZAKRESY.map(([w, l]) => przycisk(w, l)).join('')}
    </div>

    <div class="block">
      <form method="GET" action="/statystyki" class="stats-filtr">
        <div class="field">
          <label class="field-label" for="st-od">Od</label>
          <input type="date" id="st-od" name="od" value="${esc(o.od)}">
        </div>
        <div class="field">
          <label class="field-label" for="st-do">Do</label>
          <input type="date" id="st-do" name="do" value="${esc(o.do)}">
        </div>
        <button type="submit" class="button button-small">Pokaż</button>
      </form>
      <p class="hint" style="margin:6px 0 0">
        ${esc(o.od)} do ${esc(o.do)}, ${dniZakresu} dni${phase ? `, faza: ${esc(phase.name)}` : ''}
      </p>
    </div>

    ${blockTitle('Ile tego jest')}
    ${kompletnosc}

    ${blockTitle('Przerwy między podejściami', `cel: min. ${minGap} h`)}
    ${przerwyHtml}

    ${blockTitle('Makro', poTygodniach ? 'średnie tygodniowe' : 'dzień po dniu')}
    ${card(table)}

    ${blockTitle('Pokrycie grup produktów')}
    <div class="list media-list" style="margin:0"><ul>${gaps || emptyState('Brak reguł.')}</ul></div>

    ${blockTitle('Naruszenia wykluczeń')}
    ${breachList}

    ${blockTitle('Objawy i stolce')}
    ${zdrowiaHtml}
  `;

  return c.html(page({ title: 'Statystyki', tab: 'stats', header: 'Statystyki', content }));
});

export default stats;
