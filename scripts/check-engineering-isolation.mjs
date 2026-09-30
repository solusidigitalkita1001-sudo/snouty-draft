#!/usr/bin/env node
// packages/engineering harus tetap murni: tanpa dependensi runtime sama sekali.
// SPEC §8 mensyaratkan engine deterministik dan dapat diaudit; cara paling andal
// menjaganya adalah memastikan tidak ada apa pun untuk dipanggil.
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('packages/engineering/package.json', 'utf8'));
const deps = Object.keys(pkg.dependencies ?? {});

if (deps.length > 0) {
  console.error(
    `packages/engineering harus bebas dependensi runtime, tetapi mendeklarasikan: ${deps.join(', ')}\n` +
      'Engine teknik wajib murni — tanpa I/O, tanpa framework, tanpa LLM (SPEC §8, §25).',
  );
  process.exit(1);
}
console.log('packages/engineering: tanpa dependensi runtime ✓');
