#!/usr/bin/env node
// Stempluje arkusz stylow skrotem jego tresci i zapisuje do src/views/assets.ts.
//
// Powod: plik nazywa sie zawsze tak samo, wiec i brzeg Cloudflare, i service
// worker potrafia podac stara wersje po wdrozeniu nowej. Zdarzylo sie to
// 09.08.2026: przegladarka dostala arkusz z 24 regulami zamiast ponad stu
// i cala aplikacja wygladala jak goly HTML.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const css = readFileSync('public/css/food-theme.css');
const hash = createHash('sha256').update(css).digest('hex').slice(0, 10);

writeFileSync(
  'src/views/assets.ts',
  `// Plik generowany przez scripts/stamp-assets.mjs. Nie edytowac recznie.\n` +
    `export const ASSET_V = '${hash}';\n`,
  'utf8'
);

console.log(`arkusz ostemplowany: ${hash}`);
