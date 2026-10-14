// Membuat packages/engineering/src/parameters/pe100-walls.ts dari tabel PROD/STD/014 di handbook
// Pralon (data/standards/2026-10-14-pralon-handbook/standards.json). Engine tidak membaca berkas —
// datanya dibangkitkan menjadi modul TypeScript murni (scripts/check-engineering-isolation.mjs).
//
//   node scripts/gen-pe100-walls.mjs data/standards/2026-10-14-pralon-handbook/standards.json \
//     packages/engineering/src/parameters/pe100-walls.ts
import fs from 'node:fs';

const [source, out] = process.argv.slice(2);
const { STD014, SDR_CLASSES } = JSON.parse(fs.readFileSync(source, 'utf8'));

// "2,0 + 0,3" → [2.0, 0.3]: tebal nominal (minimum) + toleransi atas.
const wall = (text) => {
  const match = /^\s*([\d,]+)\s*\+\s*([\d,]+)\s*$/.exec(text);
  if (!match) throw new Error(`Tebal dinding tidak terbaca: "${text}"`);
  return [Number(match[1].replace(',', '.')), Number(match[2].replace(',', '.'))];
};
const sdrOf = (id) =>
  Number(
    SDR_CLASSES.find((c) => c.id === id)
      .label.replace('SDR ', '')
      .replace(',', '.'),
  );

const rows = STD014.rows.map((row) => {
  const entries = Object.entries(row.vals)
    .filter(([, value]) => value !== null)
    .map(([id, value]) => `'${sdrOf(id)}': [${wall(value[0]).join(', ')}]`);
  return `  ${row.od}: { ${entries.join(', ')} },`;
});

const doc = STD014.doc;
fs.writeFileSync(
  out,
  `/**
 * DIBANGKITKAN oleh scripts/gen-pe100-walls.mjs — jangan disunting tangan.
 *
 * Tebal dinding pipa PE100 Pralon per diameter luar (mm) dan SDR: [tebal nominal, toleransi atas],
 * dari ${doc.no} Rev. ${doc.rev} (${doc.date}), lewat handbook Pralon yang diterima pemilik
 * 2026-10-14 (data/standards/2026-10-14-pralon-handbook/). Kombinasi yang tidak ada di tabel tidak
 * diproduksi di kelas itu.
 */
export const PE100_WALL_SOURCE = '${doc.no} Rev. ${doc.rev}';

export const PE100_WALLS_MM: Readonly<
  Record<number, Readonly<Record<string, readonly [number, number]>>>
> = {
${rows.join('\n')}
};
`,
);
console.log(`${out}: ${rows.length} ukuran`);
