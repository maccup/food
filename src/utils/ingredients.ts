/**
 * Rozbijanie skladow z hfood na pojedyncze skladniki.
 *
 * Ich pole ingredientsName to jeden string z trzema pulapkami:
 *
 *  1. Tagi HTML zaznaczajace alergeny:
 *     "<b><u>Mleko bez laktozy 1,5 %</u></b>, jagody, kasza kukurydziana"
 *
 *  2. Blok pogrubiony potrafi zawierac kilka skladnikow naraz:
 *     "<b><u>marchew, pietruszka, seler korzeniowy</u></b>"
 *     To sa trzy warzywa, nie jedno. Po zdjeciu tagow rozbijaja sie same.
 *
 *  3. Nawias z podskladnikami produktu zlozonego:
 *     "chleb owsiany (platki owsiane,maka ryzowa,slonecznik,siemie lniane,drozdze,babka plesznik)"
 *     Przecinki w nawiasie NIE moga rozbijac listy nadrzednej, ale same
 *     podskladniki maja znaczenie, bo to w nich siedzi siemie lniane.
 *     Zwracamy wiec i produkt nadrzedny, i jego podskladniki.
 */

export interface ParsedIngredient {
  /** Nazwa znormalizowana, klucz do tabeli food_aliases. */
  alias: string;
  /** Tekst tak, jak podal go catering, do podgladu przy mapowaniu. */
  raw: string;
  /** true, jesli pozycja pochodzi z nawiasu produktu zlozonego. */
  nested: boolean;
}

/** Zdejmuje tagi HTML i zamienia encje, ktore hfood potrafi wstawic. */
export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Klucz do dopasowania: male litery, pojedyncze spacje, bez koncowej
 * interpunkcji. Celowo NIE usuwamy procentow ani liczb, bo "mleko bez
 * laktozy 1,5 %" i "mleko bez laktozy 3,2 %" to dla nas ten sam produkt,
 * ale niech to zostanie decyzja przy mapowaniu, a nie cichym efektem
 * normalizacji.
 */
export function normalizeAlias(input: string): string {
  return stripHtml(input)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.;:]+|[\s,.;:]+$/g, '')
    .trim();
}

/**
 * Jednostki, ktore pojawiaja sie przy recznym wpisywaniu posilku:
 * "maslo 7 g", "35 g chleba bialkowego", "dzem 1 lyzeczka".
 * Celowo NIE ma tu procentu, bo "mleko bez laktozy 1,5 %" i "czekolada 85%"
 * to nazwy produktow, a nie ilosci.
 */
const JEDNOSTKI = 'g|gr|dag|kg|ml|l|szt|sztuki|sztuk|łyżka|łyżki|łyżeczka|łyżeczki|plaster|plastry|kromka|kromki';
const ILOSC_NA_KONCU = new RegExp(`\\s+\\d+([.,]\\d+)?\\s*(${JEDNOSTKI})\\.?$`, 'i');
const ILOSC_NA_POCZATKU = new RegExp(`^\\d+([.,]\\d+)?\\s*(${JEDNOSTKI})\\.?\\s+`, 'i');

/**
 * Alias bez ilosci. Uzywany jako drugie podejscie przy dopasowaniu do slownika,
 * nigdy przy zapisie: "maslo 7 g" ma trafic na "maslo", ale nie ma powodu
 * zakladac w slowniku osobnego wpisu na kazda gramature.
 */
export function stripQuantity(alias: string): string {
  return alias.replace(ILOSC_NA_KONCU, '').replace(ILOSC_NA_POCZATKU, '').trim();
}

const isDigit = (ch: string | undefined) => !!ch && ch >= '0' && ch <= '9';

/**
 * Dzieli po przecinkach, ignorujac przecinki wewnatrz nawiasow oraz przecinki
 * dziesietne. To drugie jest istotne, bo sklady sa po polsku i "Mleko bez
 * laktozy 1,5 %" rozpadloby sie na "mleko bez laktozy 1" i "5 %".
 */
function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);

    const decimalComma = ch === ',' && isDigit(text[i - 1]) && isDigit(text[i + 1]);

    if (ch === ',' && depth === 0 && !decimalComma) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);

  return out.map((s) => s.trim()).filter(Boolean);
}

export function parseIngredients(ingredientsName: string | null | undefined): ParsedIngredient[] {
  if (!ingredientsName) return [];

  const plain = stripHtml(ingredientsName);
  const result: ParsedIngredient[] = [];
  const seen = new Set<string>();

  const push = (raw: string, nested: boolean) => {
    const alias = normalizeAlias(raw);
    if (!alias || seen.has(alias)) return;
    seen.add(alias);
    result.push({ alias, raw: raw.trim(), nested });
  };

  for (const part of splitTopLevel(plain)) {
    const open = part.indexOf('(');

    if (open === -1) {
      push(part, false);
      continue;
    }

    const close = part.lastIndexOf(')');
    const head = part.slice(0, open);
    const inner = close > open ? part.slice(open + 1, close) : '';

    push(head, false);
    for (const sub of splitTopLevel(inner)) {
      push(sub, true);
    }
  }

  return result;
}
