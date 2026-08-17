import { esc, emptyState, poniedzialek } from './ui';

/**
 * Wykresy slupkowe bez zadnej biblioteki: divy w flexie, jak pierwotny wykres
 * HRV. Jedna kopia rysowania, bo kazdy nastepny wykres z wlasna petla slupkow
 * mialby wlasne bledy skali i wlasne kolory.
 *
 * Skala domyslnie zaczyna sie od najnizszego punktu, nie od zera. Wysokosc
 * liczona od zera bylaby plaska dla metryk, ktore nigdy nie schodza nisko
 * (HRV, sen, kalorie), i roznice dnia od dnia znikalyby. Cena jest znana:
 * roznice wygladaja na wieksze, niz sa, i podpis ma o tym mowic. Metryki
 * o naturalnej skali (Bristol 1 do 7) dostaja skale sztywna przez `skala`.
 */

export interface Slupek {
  etykieta: string;
  v: number;
}

export interface OpcjeWykresu {
  /** Pasmo dobre. Slupek poza nim jest bursztynowy, w nim zielony. */
  pasmo?: { min?: number | null; max?: number | null } | null;
  /** Pozioma kreska odniesienia, np. mediana wlasnej normy. */
  linia?: number | null;
  /** Sztywna skala osi. Bez niej skala idzie od najnizszego punktu. */
  skala?: { min: number; max: number };
  format?: (v: number) => string;
}

const WYSOKOSC_PX = 62;

export function slupkowy(punkty: Slupek[], o: OpcjeWykresu = {}): string {
  if (punkty.length < 2) return emptyState('Za mało dni, żeby narysować trend.');

  const wartosci = punkty.map((p) => p.v);
  const dol = o.skala ? o.skala.min : Math.min(...wartosci) * 0.95;
  const gora = o.skala ? o.skala.max : Math.max(...wartosci) * 1.02;
  const zakres = gora - dol || 1;
  const px = (v: number) => Math.round(((v - dol) / zakres) * (WYSOKOSC_PX - 2));
  const wysokosc = (v: number) => Math.max(2, px(v));

  const min = o.pasmo?.min ?? null;
  const max = o.pasmo?.max ?? null;
  const format = o.format ?? ((v: number) => String(Math.round(v)));

  const slupki = punkty.map((p) => {
    const poza = (min !== null && p.v < min) || (max !== null && p.v > max);
    return `<div style="flex:1;min-width:2px;display:flex;flex-direction:column;justify-content:flex-end;height:${WYSOKOSC_PX}px"
                 title="${esc(p.etykieta)}: ${esc(format(p.v))}">
      <div style="height:${wysokosc(p.v)}px;background:${poza ? 'var(--warn)' : 'var(--ok)'};border-radius:2px 2px 0 0"></div>
    </div>`;
  }).join('');

  // Kreski rysuja sie tylko wtedy, gdy mieszcza sie w skali. Kreska pod zerem
  // osi wyladowalaby pod wykresem i wygladala jak blad renderowania.
  const kreska = (v: number | null | undefined) =>
    typeof v === 'number' && v >= dol && v <= gora
      ? `<div style="position:absolute;left:0;right:0;bottom:${px(v)}px;border-top:1px dashed var(--muted);opacity:.7"></div>`
      : '';

  return `
    <div style="position:relative"><div style="display:flex;gap:1px;align-items:flex-end">${slupki}</div>
      ${kreska(o.linia)}${kreska(min)}${kreska(max)}
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:4px">
      <span>${esc(punkty[0].etykieta)}</span><span>${esc(punkty[punkty.length - 1].etykieta)}</span>
    </div>`;
}

/**
 * Dni zwiniete do tygodni, po jednym slupku na tydzien od poniedzialku.
 * Powyzej trzech miesiecy slupek dzienny ma pixel szerokosci i pokazuje szum,
 * nie trend. Agregat wybiera wolajacy: makra usrednia (jak tabela obok),
 * metryki zegarka biora mediane (jak reszta ekranu zegarka).
 */
export function zwinDoTygodni(
  dni: Array<{ date: string; v: number }>,
  agregat: 'srednia' | 'mediana'
): Slupek[] {
  const tygodnie = new Map<string, number[]>();
  for (const d of dni) {
    const k = poniedzialek(d.date);
    if (!tygodnie.has(k)) tygodnie.set(k, []);
    tygodnie.get(k)!.push(d.v);
  }
  return [...tygodnie.entries()].map(([k, v]) => {
    const s = [...v].sort((a, b) => a - b);
    const p = (s.length - 1) / 2;
    const wartosc = agregat === 'mediana'
      ? (s[Math.floor(p)] + s[Math.ceil(p)]) / 2
      : v.reduce((a, b) => a + b, 0) / v.length;
    return { etykieta: `tydz. ${k.slice(8)}.${k.slice(5, 7)}`, v: wartosc };
  });
}

/** Etykieta dzienna „17.08" z daty. */
export function etykietaDnia(date: string): string {
  return `${date.slice(8)}.${date.slice(5, 7)}`;
}
