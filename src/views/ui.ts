import { layout, sidenav } from './layout';

export function esc(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Liczby po polsku: przecinek dziesietny, bez zbednych zer. */
export function pl(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '?';
  return value.toFixed(digits).replace('.', ',').replace(/,0$/, '');
}

export const SLOT_LABEL: Record<string, string> = {
  sniadanie: 'Śniadanie',
  ii_sniadanie: 'II śniadanie',
  obiad: 'Obiad',
  podwieczorek: 'Podwieczorek',
  kolacja: 'Kolacja',
  inne: 'Inne',
};

export const SITTING_TIME: Record<number, string> = { 1: '09:00', 2: '14:00', 3: '18:30' };

export const DAY_NAMES = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];

/** Dzisiejsza data w strefie Warszawy, format YYYY-MM-DD. */
export function todayWarsaw(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date());
}

/** "14:05" na minuty od północy. Jedna kopia dla panelu, dnia i ustawień. */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Aktualna godzina w Warszawie, jako minuty od północy. */
export function nowMinutesWarsaw(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00Z`).getTime();
  const b = new Date(`${to}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function prettyDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const [y, m, dd] = date.split('-');
  return `${DAY_NAMES[d.getUTCDay()]}, ${Number(dd)}.${m}.${y}`;
}

export interface MacroSpec {
  key: string;
  label: string;
  actual: number | null;
  min: number | null;
  max: number | null;
  unit: string;
}

/**
 * Pasek makro. Zielony w pasmie, bursztynowy blisko granicy, czerwony poza.
 * Znacznik na pasku pokazuje gorna granice celu, zeby dalo sie zobaczyc
 * nie tylko "ile", ale "ile wobec czego".
 */
export function macroBar(m: MacroSpec): string {
  const actual = m.actual ?? 0;
  const max = m.max ?? (actual || 1);
  const scale = Math.max(max * 1.3, actual * 1.05, 1);
  const pct = Math.min(100, (actual / scale) * 100);
  const targetPct = Math.min(100, (max / scale) * 100);

  let state: 'ok' | 'warn' | 'bad' = 'ok';
  if (m.min !== null && actual < m.min * 0.9) state = 'bad';
  else if (m.min !== null && actual < m.min) state = 'warn';
  else if (m.max !== null && actual > m.max * 1.1) state = 'bad';
  else if (m.max !== null && actual > m.max) state = 'warn';

  const range =
    m.min !== null && m.max !== null ? `${pl(m.min, 0)} do ${pl(m.max, 0)}` : '';

  return `<div class="macro-row">
    <div class="macro-label">${esc(m.label)}</div>
    <div class="macro-track">
      <div class="macro-fill ${state}" style="width:${pct.toFixed(1)}%"></div>
      <div class="macro-target-mark" style="left:${targetPct.toFixed(1)}%" title="cel ${range}"></div>
    </div>
    <div class="macro-value"><b>${pl(actual)}</b> ${esc(m.unit)}<br><span style="color:var(--muted);font-size:11px">${range}</span></div>
  </div>`;
}

export function flag(level: string, text: string): string {
  const cls =
    level === 'forbidden' ? 'forbidden' : level === 'limit' ? 'limit' : level === 'prefer' ? 'prefer' : 'info';
  return `<span class="flag ${cls}">${esc(text)}</span>`;
}

export function page(opts: {
  title: string;
  tab?: string;
  header: string;
  content: string;
  right?: string;
}): string {
  return layout(
    opts.title,
    `<div class="app">
      ${sidenav(opts.tab)}
      <div class="main">
        <header class="topbar">
          <h1>${opts.header}</h1>
          <div class="topbar-actions">
            ${opts.right ?? ''}
            <a href="/restrictions" aria-label="Wykluczenia" title="Wykluczenia">🚫</a>
            <a href="/ustawienia" aria-label="Ustawienia" title="Ustawienia">⚙️</a>
            <button class="theme-toggle" onclick="toggleTheme()" aria-label="Przełącz tryb jasny i ciemny">🌙</button>
          </div>
        </header>
        <main class="content">
          ${opts.content}
        </main>
      </div>
    </div>`,
    opts.tab
  );
}

export function emptyState(text: string): string {
  return `<div style="padding:32px 16px;text-align:center;color:var(--muted);font-size:14px">${esc(text)}</div>`;
}

export function card(inner: string, extraClass = ''): string {
  return `<div class="card ${extraClass}"><div class="card-content card-content-padding">${inner}</div></div>`;
}

export function blockTitle(text: string, right = ''): string {
  return `<div class="block-title" style="display:flex;justify-content:space-between;align-items:baseline">
    <span>${esc(text)}</span>${right ? `<span style="font-size:12px;font-weight:400;color:var(--muted)">${right}</span>` : ''}
  </div>`;
}
