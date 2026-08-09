// Sprawdzenie parsera skladow na prawdziwych stringach z hfood
// (dania z 14 do 16.08.2026, pobrane z panelu 09.08).
// Uruchomienie: node scripts/test-ingredients.mjs

import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(mkdtempSync(join(tmpdir(), 'food-')), 'ing.mjs');
execFileSync(
  'npx',
  ['esbuild', 'src/utils/ingredients.ts', '--bundle', '--format=esm', `--outfile=${out}`],
  { stdio: 'pipe' }
);
const { parseIngredients, stripQuantity } = await import(out);

const CASES = [
  {
    name: 'tagi alergenow',
    input:
      '<b><u>Mleko bez laktozy 1,5 %</u></b>, jagody, kasza kukurydziana, Stewia, Masło roślinne, słonecznik nasiona, <b><u>Płatki migdałowe</u></b>, płatki kokosowe, Nasiona chia, dynia pestki',
    expectContains: ['mleko bez laktozy 1,5 %', 'jagody', 'nasiona chia', 'dynia pestki'],
    expectCount: 10,
  },
  {
    name: 'pogrubiony blok z trzema warzywami',
    input:
      'Bulion warzywny, ziemniaki, Przecier pomidorowy, <b><u>marchew, pietruszka, seler korzeniowy</u></b>, fasolka szparagowa',
    expectContains: ['marchew', 'pietruszka', 'seler korzeniowy', 'fasolka szparagowa'],
    expectCount: 7,
  },
  {
    name: 'nawias z podskladnikami',
    input:
      'Ogórki kiszone, chleb owsiany (płatki owsiane,mąka ryżowa,słonecznik,siemię lniane,drożdże,babka płesznik), pIetruszka korzeń',
    expectContains: ['ogórki kiszone', 'chleb owsiany', 'siemię lniane', 'babka płesznik', 'pietruszka korzeń'],
    expectCount: 9,
  },
  {
    name: 'nawias bez spacji przed, jak w chlebie rustykalnym',
    input:
      'pomidor, bezglutenowy chleb rustykalny (skrobia kukurydziana,mąka ryżowa,drożdże,maniok) , awokado',
    expectContains: ['bezglutenowy chleb rustykalny', 'maniok', 'awokado'],
    expectCount: 7,
  },
  {
    name: 'pusty sklad',
    input: null,
    expectContains: [],
    expectCount: 0,
  },
];

// Ilosci przy recznym wpisywaniu. "maslo 7 g" ma trafic na "maslo",
// ale "mleko bez laktozy 1,5 %" i "czekolada 85%" to nazwy produktow.
const ILOSCI = [
  ['chleb białkowy 35 g', 'chleb białkowy'],
  ['masło 7 g', 'masło'],
  ['dżem malinowy 15 g', 'dżem malinowy'],
  ['35 g chleba', 'chleba'],
  ['ryż 1 szt', 'ryż'],
  ['miód 1 łyżeczka', 'miód'],
  ['mleko bez laktozy 1,5 %', 'mleko bez laktozy 1,5 %'],
  ['czekolada 85%', 'czekolada 85%'],
  ['figi x2', 'figi x2'],
  ['masło', 'masło'],
];

let failed = 0;

for (const [wejscie, oczekiwane] of ILOSCI) {
  const got = stripQuantity(wejscie);
  if (got === oczekiwane) {
    console.log(`OK    ilosc: "${wejscie}" -> "${got}"`);
  } else {
    failed++;
    console.log(`FAIL  ilosc: "${wejscie}" -> "${got}", oczekiwano "${oczekiwane}"`);
  }
}

for (const c of CASES) {
  const got = parseIngredients(c.input);
  const aliases = got.map((g) => g.alias);
  const missing = c.expectContains.filter((e) => !aliases.includes(e));
  const countOk = got.length === c.expectCount;

  if (missing.length || !countOk) {
    failed++;
    console.log(`FAIL  ${c.name}`);
    if (missing.length) console.log(`      brakuje: ${missing.join(' | ')}`);
    if (!countOk) console.log(`      liczba: ${got.length}, oczekiwano ${c.expectCount}`);
    console.log(`      dostano: ${aliases.join(' | ')}`);
  } else {
    console.log(`OK    ${c.name}  (${got.length} skladnikow)`);
  }
}

console.log(failed ? `\n${failed} nie przeszlo` : `\nWszystkie ${CASES.length + ILOSCI.length} przeszly`);
process.exit(failed ? 1 : 0);
