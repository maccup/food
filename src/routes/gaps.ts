import { Hono } from 'hono';
import { Env } from '../types';
import { esc, todayWarsaw, shiftDate } from '../views/ui';

const gaps = new Hono<{ Bindings: Env }>();

const DNI = ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'];

export type StatusDnia = 'zjedzone' | 'plan' | 'brak';

export interface DzienGrupy {
  date: string;
  status: StatusDnia;
  produkty: string[];
}

export interface WeekGap {
  group_id: number;
  name: string;
  provides: string | null;
  examples: string | null;
  severity: string;
  need: number;
  dni: DzienGrupy[];
  dniZjedzone: number;
  dniPlan: number;
  /** Ile dni brakuje PO doliczeniu zaplanowanych pudełek. Zero znaczy: nic nie rób. */
  brakuje: number;
  /** Dni od dzisiaj do niedzieli, w których nie ma ani wpisu, ani pudełka. */
  dniWolne: number;
  dzisStatus: StatusDnia;
  /** Ile porcji dziennie wymaga regula. Null znaczy: jedna wystarcza. */
  minPorcjeDnia: number | null;
  /** Ile porcji z tej grupy zjedzono DZIS. */
  porcjeDzis: number;
}

/**
 * Pokrycie grup w CAŁYM tygodniu, nie w jednym dniu.
 *
 * Reguły w `coverage_rules` są tygodniowe („kiwi 7 dni", „ryby 2 dni"), więc
 * pytanie „czy ta grupa była dzisiaj" było pytaniem o co innego niż reguła.
 * Do 15.08.2026 sekcja liczyła wyłącznie posiłki zjedzone, przez co pokazywała
 * brak ryb w dniu, w którym pudełko z tuńczykiem leżało już w bazie na jutro.
 *
 * Liczą się dwa stany posiłku i każdy znaczy co innego:
 * `zjedzony` to fakt, `plan` to pudełko z cateringu, które dopiero przyjdzie.
 * Dzień z jednym i drugim jest dniem zjedzonym, bo fakt bije zapowiedź.
 * `pominiety` nie liczy się nigdzie, bo to jedzenie, którego nie było.
 */
export async function loadWeekGaps(
  db: D1Database, date: string, weekStart: string
): Promise<WeekGap[]> {
  const dniTygodnia = Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i));
  const weekEnd = dniTygodnia[6];

  const [rules, pokrycie, porcjeDzisiaj] = await Promise.all([
    db.prepare(
      `SELECT r.group_id, r.min_days_per_week, r.min_portions_per_day, r.severity, g.name, g.provides, g.examples
       FROM coverage_rules r JOIN food_groups g ON g.id = r.group_id
       WHERE (r.active_from IS NULL OR r.active_from <= ?) AND (r.active_to IS NULL OR r.active_to >= ?)
       ORDER BY CASE r.severity WHEN 'critical' THEN 1 WHEN 'important' THEN 2 ELSE 3 END, g.name`
    ).bind(date, date).all<any>(),
    /*
     * Nazwy produktow jada razem ze stanem, bo bez nich wiersz mowi „masz
     * 2 z 5 dni" i nie da sie sprawdzic, z czego to policzone.
     *
     * `portion_role = 'porcja'` odsiewa posypki: natka pietruszki na kremie
     * zaliczala wczesniej dzien zielonych lisci tak samo jak miska szpinaku.
     * Ocene nowych skladnikow robi Claude przy /hfood, patrz migracja 045.
     */
    db.prepare(
      `SELECT f.group_id, m.date, m.stan, GROUP_CONCAT(DISTINCT f.name) AS produkty
       FROM meals m
       JOIN meal_foods mf ON mf.meal_id = m.id
       JOIN foods f       ON f.id = mf.food_id
       WHERE m.date BETWEEN ? AND ? AND f.group_id IS NOT NULL
         AND f.portion_role = 'porcja'
         AND m.stan IN ('zjedzony', 'plan')
       GROUP BY f.group_id, m.date, m.stan`
    ).bind(weekStart, weekEnd).all<any>(),
    /*
     * Porcje DZISIEJSZE osobno, bo pokrycie wyzej liczy dni, nie porcje.
     * Regula kiwi mowi "2 porcje dziennie" i po jednej sztuce dzien wygladal
     * na zamkniety, a przycisk znikal w polowie zadania (zgloszone 18.08.2026).
     */
    db.prepare(
      `SELECT f.group_id, COUNT(*) AS n
       FROM meals m
       JOIN meal_foods mf ON mf.meal_id = m.id
       JOIN foods f       ON f.id = mf.food_id
       WHERE m.date = ? AND m.stan = 'zjedzony'
         AND f.group_id IS NOT NULL AND f.portion_role = 'porcja'
       GROUP BY f.group_id`
    ).bind(date).all<any>(),
  ]);

  const porcjeByGrupa = new Map<number, number>(
    (porcjeDzisiaj.results ?? []).map((r: any) => [r.group_id, Number(r.n)])
  );

  // klucz: "grupa|data" -> stan -> produkty
  const bierz = new Map<string, { zjedzone?: string[]; plan?: string[] }>();
  for (const r of pokrycie.results ?? []) {
    const klucz = `${r.group_id}|${r.date}`;
    const wpis = bierz.get(klucz) ?? {};
    const produkty = String(r.produkty ?? '').split(',').filter(Boolean);
    if (r.stan === 'zjedzony') wpis.zjedzone = produkty;
    else wpis.plan = produkty;
    bierz.set(klucz, wpis);
  }

  return (rules.results ?? []).map((r: any) => {
    const dni: DzienGrupy[] = dniTygodnia.map((d) => {
      const wpis = bierz.get(`${r.group_id}|${d}`);
      if (wpis?.zjedzone) return { date: d, status: 'zjedzone', produkty: wpis.zjedzone };
      if (wpis?.plan) return { date: d, status: 'plan', produkty: wpis.plan };
      return { date: d, status: 'brak', produkty: [] };
    });

    const dniZjedzone = dni.filter((d) => d.status === 'zjedzone').length;
    const dniPlan = dni.filter((d) => d.status === 'plan').length;
    const need = r.min_days_per_week ?? 0;

    return {
      group_id: r.group_id,
      name: r.name,
      provides: r.provides,
      examples: r.examples,
      severity: r.severity,
      need,
      dni,
      dniZjedzone,
      dniPlan,
      brakuje: Math.max(0, need - dniZjedzone - dniPlan),
      dniWolne: dni.filter((d) => d.status === 'brak' && d.date >= date).length,
      dzisStatus: dni.find((d) => d.date === date)?.status ?? 'brak',
      minPorcjeDnia: r.min_portions_per_day ?? null,
      porcjeDzis: porcjeByGrupa.get(r.group_id) ?? 0,
    };
  });
}

function kropki(g: WeekGap, date: string): string {
  return `<div class="tydzien-kropki">${g.dni.map((d, i) => {
    const dzis = d.date === date ? ' dzis' : '';
    const opis = d.produkty.length
      ? `${d.date}: ${d.produkty.join(', ')}`
      : `${d.date}: nic z tej grupy`;
    return `<span class="tydzien-dzien">
      <span class="kropka ${d.status}${dzis}" title="${esc(opis)}"></span>
      <span class="tydzien-etykieta">${DNI[i]}</span>
    </span>`;
  }).join('')}</div>`;
}

/** Jedno zdanie werdyktu. To ono ma odpowiedzieć, czy w ogóle trzeba coś robić. */
function werdykt(g: WeekGap): { tekst: string; klasa: string } {
  if (g.brakuje === 0 && g.dniPlan === 0)
    return { tekst: `zrobione, ${g.dniZjedzone} z ${g.need} dni`, klasa: 'ok' };
  if (g.brakuje === 0)
    return {
      tekst: `domknie się samo: masz ${g.dniZjedzone}, w pudełkach jeszcze ${g.dniPlan}`,
      klasa: 'ok',
    };
  if (g.brakuje > g.dniWolne)
    return {
      tekst: `w tym tygodniu już nie do nadrobienia, ${
        g.dniWolne === 0
          ? 'nie ma wolnego dnia'
          : g.dniWolne === 1
            ? 'został 1 wolny dzień'
            : `zostały ${g.dniWolne} wolne dni`
      }`,
      klasa: 'muted',
    };
  return {
    tekst: `dorzuć ${g.brakuje === 1 ? 'w 1 dniu' : `w ${g.brakuje} dniach`}: masz ${
      g.dniZjedzone
    }, w pudełkach ${g.dniPlan}, cel ${g.need}`,
    klasa: g.severity === 'critical' ? 'bad' : 'warn',
  };
}

export function renderGaps(list: WeekGap[], date: string): string {
  // Kolejność: najpierw to, co wymaga ruchu, na końcu to, co zamknięte.
  const waga = (g: WeekGap) =>
    (g.brakuje === 0 ? 2 : g.brakuje > g.dniWolne ? 1 : 0) * 10 +
    (g.severity === 'critical' ? 0 : g.severity === 'important' ? 1 : 2);
  const posortowane = [...list].sort((a, b) => waga(a) - waga(b));

  const doZrobienia = posortowane.filter((g) => g.brakuje > 0 && g.brakuje <= g.dniWolne);
  /*
   * Do dzisiejszej listy wchodzi tez grupa, ktorej tygodnia juz nie da sie
   * domknac. Cel tygodniowy jest przegrany, ale zjedzenie kiwi dzis dalej ma
   * sens, a wersja, ktora takie grupy chowala, potrafila napisac „nic nie
   * trzeba dokladac" w dniu z dwoma niedomkniętymi grupami.
   */
  const naDzis = posortowane.filter((g) => g.brakuje > 0 && g.dzisStatus === 'brak');

  const wiersz = (g: WeekGap) => {
    const w = werdykt(g);

    /*
     * Regula wieloporcjowa (kiwi: 2 dziennie) trzyma przycisk az do domkniecia
     * porcji, nie pierwszej sztuki. "Dzis juz bylo" po jednej z dwoch porcji
     * chowalo przycisk w polowie zadania i wygladalo na zepsute.
     */
    const porcjeBrakuje = g.minPorcjeDnia !== null && g.minPorcjeDnia > 1
      && g.porcjeDzis > 0 && g.porcjeDzis < g.minPorcjeDnia;
    const dzisiaj =
      g.dzisStatus === 'zjedzone'
        ? (g.minPorcjeDnia !== null && g.minPorcjeDnia > 1
            ? `dziś ${g.porcjeDzis} z ${g.minPorcjeDnia} porcji`
            : 'dziś już było')
        : g.dzisStatus === 'plan' ? 'dziś jest w pudełku, odhacz je po zjedzeniu'
        : 'dziś jeszcze nie';

    // Zwykla grupa: przycisk tylko, gdy dzis pusto i tydzien niedomkniety.
    // Grupa wieloporcjowa: takze po pierwszej porcji, az do kompletu dnia.
    const pokazPrzycisk = (g.brakuje > 0 && g.dzisStatus === 'brak') || porcjeBrakuje;

    return `<li>
      <div class="item-content"><div class="item-inner" style="display:block;padding:12px 0">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">
          <b>${esc(g.name)}</b>
          <span class="tydzien-licznik ${w.klasa}">${g.dniZjedzone + g.dniPlan} z ${g.need} dni</span>
        </div>
        ${kropki(g, date)}
        <div class="tydzien-werdykt ${w.klasa}">${esc(w.tekst)} &middot; ${esc(dzisiaj)}</div>
        ${g.examples ? `<div style="font-size:13px;margin-top:4px">${esc(g.examples)}</div>` : ''}
        ${
          pokazPrzycisk
            ? `<div class="gap-actions">
                <form method="POST" action="/braki/zjedzone">
                  <input type="hidden" name="group_id" value="${g.group_id}">
                  <input type="hidden" name="date" value="${date}">
                  <button type="submit" class="button button-small button-fill" style="width:100%">
                    ${porcjeBrakuje ? `Zjedzone dzisiaj, porcja ${g.porcjeDzis + 1} z ${g.minPorcjeDnia}` : 'Zjedzone dzisiaj'}
                  </button>
                </form>
              </div>`
            : ''
        }
      </div></div>
    </li>`;
  };

  /*
   * Naglowek odpowiada na pytanie „co mam jeszcze dzisiaj zjesc" jednym zdaniem,
   * zeby nie trzeba bylo czytac siedmiu wierszy, zeby to wiedziec.
   */
  const przepadle = posortowane.filter((g) => g.brakuje > 0 && g.brakuje > g.dniWolne);
  // Nazwy w ogonie tylko wtedy, gdy naglowek ich jeszcze nie wymienil.
  const nowePrzepadle = przepadle.filter((g) => !naDzis.includes(g));
  const ogon = !przepadle.length
    ? ''
    : nowePrzepadle.length
      ? ` Pełnego tygodnia nie zrobisz już w: ${nowePrzepadle
          .map((g) => esc(g.name.toLowerCase())).join(', ')}, ale każdy dzień się liczy.`
      : ' Pełnego tygodnia już nie domkniesz, ale każdy dzień się liczy.';

  const naglowek = naDzis.length
    ? `<div class="tydzien-dzis">Dziś dorzuć: <b>${naDzis
        .map((g) => esc(g.name.toLowerCase())).join(', ')}</b>.${ogon}</div>`
    : doZrobienia.length
      ? `<div class="tydzien-dzis">Na dziś nic dodatkowego, dzisiejsze pudełka mają wszystko.
          Do końca tygodnia zostaje: <b>${doZrobienia
            .map((g) => esc(g.name.toLowerCase())).join(', ')}</b>.${ogon}</div>`
      : `<div class="tydzien-dzis ok">Nic nie trzeba dokładać, resztę tygodnia domykają zamówione pudełka.${ogon}</div>`;

  return `
    ${naglowek}
    <div class="tydzien-legenda">
      <span><span class="kropka zjedzone"></span> zjedzone</span>
      <span><span class="kropka plan"></span> pudełko w planie</span>
      <span><span class="kropka brak"></span> nic z tej grupy</span>
      <span class="tydzien-zrodlo">liczone z twoich wpisów i składów z cateringu, dotknij kropki, żeby zobaczyć produkt</span>
    </div>
    <div class="list" style="margin:0"><ul>${posortowane.map(wiersz).join('')}</ul></div>`;
}

/** Odhaczenie grupy jako zjedzonej: zapisuje realny posiłek, żeby reguły to zobaczyły. */
gaps.post('/braki/zjedzone', async (c) => {
  const b = await c.req.parseBody();
  const groupId = Number(b.group_id);
  const date = String(b.date || todayWarsaw());

  const group = await c.env.DB.prepare(`SELECT name, examples FROM food_groups WHERE id = ?`)
    .bind(groupId).first<{ name: string; examples: string | null }>();

  // Produkt z tej grupy, ktory nie jest aktualnie zakazany. Wersja z szablonem
  // idzie pierwsza, bo szablon niesie makra i realna porcje. Bez niego wpis
  // wchodzil z pustymi kaloriami i dzien liczyl sie tak, jakby nic nie zjadl.
  const wolne = `NOT EXISTS (
      SELECT 1 FROM restrictions r
      WHERE (r.food_id = f.id OR r.group_id = f.group_id)
        AND r.level = 'forbidden' AND r.status = 'active'
        AND ? >= r.date_from AND (r.date_to IS NULL OR ? <= r.date_to)
    )`;

  const zSzablonem = await c.env.DB.prepare(
    `SELECT f.id, f.name, t.name AS t_name, t.kcal, t.protein_g, t.fat_g, t.carbs_g, t.fiber_g
     FROM foods f
     JOIN meal_templates t ON lower(t.ingredients) = lower(f.name) AND t.archived = 0
     WHERE f.group_id = ? AND ${wolne}
     ORDER BY t.times_used DESC, f.id LIMIT 1`
  ).bind(groupId, date, date).first<any>();

  const food = zSzablonem ?? await c.env.DB.prepare(
    `SELECT f.id, f.name FROM foods f
     WHERE f.group_id = ? AND ${wolne}
     ORDER BY f.id LIMIT 1`
  ).bind(groupId, date, date).first<{ id: number; name: string }>();

  const szablon = zSzablonem;

  const inserted = await c.env.DB.prepare(
    `INSERT INTO meals (date, slot, sitting, source, name, ingredients_raw,
       kcal, protein_g, fat_g, carbs_g, fiber_g, estimated, notes)
     VALUES (?, 'inne', 0, 'dom', ?, ?, ?, ?, ?, ?, ?, 1, 'dopisane z sekcji o brakach')
     RETURNING id`
  ).bind(
    date,
    szablon?.t_name ?? (group?.name ? `Dodatek: ${group.name.toLowerCase()}` : 'Dodatek'),
    group?.examples ?? null,
    szablon?.kcal ?? null, szablon?.protein_g ?? null, szablon?.fat_g ?? null,
    szablon?.carbs_g ?? null, szablon?.fiber_g ?? null
  ).first<{ id: number }>();

  if (inserted && food) {
    await c.env.DB.prepare(`INSERT OR IGNORE INTO meal_foods (meal_id, food_id) VALUES (?, ?)`)
      .bind(inserted.id, food.id).run();
  }

  return c.redirect(`/day/${date}`);
});

export default gaps;
