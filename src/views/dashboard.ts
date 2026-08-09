import { esc, pl } from './ui';

export interface DashboardData {
  date: string;
  isToday: boolean;
  nowMinutes: number | null;
  phaseName: string | null;
  phaseEnd: string | null;
  daysLeft: number | null;
  totals: any | null;
  targets: Map<string, { min_value: number | null; max_value: number | null }>;
  sittingTimes: Record<number, string>;
  mealsBySitting: Map<number, { total: number; eaten: number }>;
  supplementsTotal: number;
  supplementsTaken: number;
  nextSupplement: { time: string; name: string } | null;
  overdueSupplements: number;
  forbiddenToday: Array<{ food_name: string; meal_name: string }>;
  minGapHours: number;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

function state(actual: number, t?: { min_value: number | null; max_value: number | null }) {
  if (!t) return 'ok';
  if (t.min_value !== null && actual < t.min_value * 0.9) return 'bad';
  if (t.max_value !== null && actual > t.max_value * 1.1) return 'bad';
  if (t.min_value !== null && actual < t.min_value) return 'warn';
  if (t.max_value !== null && actual > t.max_value) return 'warn';
  return 'ok';
}

/**
 * Panel kontrolny. Ma odpowiadać na trzy pytania w trzy sekundy:
 * gdzie jestem w protokole, co mam zrobić najbliżej, czy coś poszło nie tak.
 * Liczby szczegółowe są niżej, na stronie dnia.
 */
export function dashboard(d: DashboardData): string {
  const macros = [
    { key: 'kcal', label: 'kcal', digits: 0 },
    { key: 'protein_g', label: 'białko', digits: 0 },
    { key: 'fat_g', label: 'tłuszcz', digits: 0 },
    { key: 'carbs_g', label: 'węgle', digits: 0 },
    { key: 'fiber_g', label: 'błonnik', digits: 0 },
  ];

  const macroTiles = macros.map((m) => {
    const value = d.totals ? Number(d.totals[m.key]) : 0;
    const st = d.totals ? state(value, d.targets.get(m.key)) : 'none';
    const color = st === 'bad' ? 'var(--bad)' : st === 'warn' ? 'var(--warn)' : st === 'ok' ? 'var(--ok)' : 'var(--muted)';
    return `<div class="tile">
      <div class="tile-value" style="color:${color}">${d.totals ? pl(value, m.digits) : '–'}</div>
      <div class="tile-label">${m.label}</div>
    </div>`;
  }).join('');

  // Najblizsze okno jedzenia i to, czy przerwa od poprzedniego jest wystarczajaca.
  let nextWindow = '';
  if (d.isToday && d.nowMinutes !== null) {
    const entries = [1, 2, 3].map((s) => ({ s, t: d.sittingTimes[s], m: toMinutes(d.sittingTimes[s]) }));
    const upcoming = entries.find((e) => e.m > d.nowMinutes!);
    const current = [...entries].reverse().find((e) => e.m <= d.nowMinutes!);

    if (upcoming) {
      const mins = upcoming.m - d.nowMinutes;
      const h = Math.floor(mins / 60);
      const rest = mins % 60;
      const eaten = d.mealsBySitting.get(upcoming.s);
      nextWindow = `<div class="panel-row">
        <div>
          <div class="panel-row-label">Następne podejście</div>
          <div class="panel-row-main">${esc(upcoming.t)}, za ${h ? `${h} h ` : ''}${rest} min</div>
        </div>
        <div class="panel-row-side">${eaten ? `${eaten.total} pudełka` : 'brak pudełek'}</div>
      </div>`;
    } else if (current) {
      nextWindow = `<div class="panel-row">
        <div>
          <div class="panel-row-label">Ostatnie podejście</div>
          <div class="panel-row-main">${esc(current.t)}, minęło</div>
        </div>
        <div class="panel-row-side">przerwa nocna</div>
      </div>`;
    }
  }

  const suppLine = d.supplementsTotal
    ? `<div class="panel-row">
        <div>
          <div class="panel-row-label">Suplementy</div>
          <div class="panel-row-main">${d.supplementsTaken} z ${d.supplementsTotal} wzięte</div>
        </div>
        <div class="panel-row-side">${d.overdueSupplements
          ? `<span style="color:var(--warn);font-weight:600">${d.overdueSupplements} zaległe</span>`
          : d.nextSupplement
            ? `${esc(d.nextSupplement.time)} ${esc(d.nextSupplement.name)}`
            : 'komplet'}</div>
      </div>`
    : '';

  const phaseLine = d.phaseName
    ? `<div class="panel-row">
        <div>
          <div class="panel-row-label">Faza</div>
          <div class="panel-row-main">${esc(d.phaseName)}</div>
        </div>
        <div class="panel-row-side">${d.daysLeft !== null ? `zostało ${d.daysLeft} dni` : 'bez końca'}</div>
      </div>`
    : '';

  const alerts = d.forbiddenToday.length
    ? `<div class="panel-alert">
        <b>${d.forbiddenToday.length === 1 ? 'Zakazany składnik' : `Zakazane składniki: ${d.forbiddenToday.length}`}</b>
        <div style="margin-top:3px">${d.forbiddenToday.slice(0, 4).map((f) => esc(f.food_name)).join(', ')}</div>
      </div>`
    : '';

  const missingMacros = d.totals?.meals_without_macros > 0 || d.totals?.meals_estimated > 0
    ? `<div class="panel-note">${[
        d.totals.meals_without_macros ? `${d.totals.meals_without_macros} bez makr` : '',
        d.totals.meals_estimated ? `${d.totals.meals_estimated} na oko` : '',
      ].filter(Boolean).join(', ')}, więc sumy są przybliżone</div>`
    : '';

  return `<div class="panel">
    <div class="tiles">${macroTiles}</div>
    ${missingMacros}
    ${phaseLine}
    ${nextWindow}
    ${suppLine}
    ${alerts}
    <div class="panel-actions">
      <a href="/log?date=${d.date}" class="button button-small button-fill">Dopisz</a>
      <a href="/suplementy?date=${d.date}" class="button button-small">Suplementy</a>
      <a href="/kalendarz?m=${d.date.slice(0, 7)}" class="button button-small">Kalendarz</a>
    </div>
  </div>`;
}
