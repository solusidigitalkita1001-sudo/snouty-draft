// Membuat packages/engineering/src/parameters/pralon-upvc-walls.ts dari transkripsi PROD/STD-04
// (data/standards/2026-10-14-prod-std-004/pralon-upvc.json). Engine tidak membaca berkas.
//
//   node scripts/gen-pralon-upvc-walls.mjs data/standards/2026-10-14-prod-std-004/pralon-upvc.json \
//     packages/engineering/src/parameters/pralon-upvc-walls.ts
import fs from 'node:fs';

const [source, out] = process.argv.slice(2);
const table = JSON.parse(fs.readFileSync(source, 'utf8'));

// `1 1/4"` → `1¼"`: label kanonik PipeSize yang dipakai engine dan katalog.
const FRACTION = { '1/4': '¼', '1/2': '½', '3/4': '¾', '3/8': '⅜' };
const canonical = (size) =>
  size.replace(/^(\d+) (1\/4|1\/2|3\/4)"$/, (_, whole, part) => `${whole}${FRACTION[part]}"`);

const cls = (cell) => (cell === null ? 'null' : `[${cell[0]}, ${cell[1]}]`);
const rows = table.rows.map(
  ([size, od, odTol, aw, d, c]) =>
    `  { size: '${canonical(size)}', outerMm: ${od}, outerToleranceMm: ${odTol}, AW: ${cls(aw)}, D: ${cls(d)}, C: ${cls(c)} },`,
);

fs.writeFileSync(
  out,
  `/**
 * DIBANGKITKAN oleh scripts/gen-pralon-upvc-walls.mjs — jangan disunting tangan.
 *
 * Pipa PRALON uPVC kelas AW, D, C per ukuran nominal: OD nominal + toleransi, dan per kelas
 * [tebal dinding nominal, toleransi] (mm); \`null\` = ukuran itu tidak ada di kelas tersebut.
 * Sumber: ${table.doc.no} Rev. ${table.doc.rev} (data/standards/2026-10-14-prod-std-004/).
 */
export const PRALON_UPVC_SOURCE = '${table.doc.no} Rev. ${table.doc.rev}';

type Wall = readonly [number, number] | null;

export const PRALON_UPVC_WALLS_MM: readonly {
  readonly size: string;
  readonly outerMm: number;
  readonly outerToleranceMm: number;
  readonly AW: Wall;
  readonly D: Wall;
  readonly C: Wall;
}[] = [
${rows.join('\n')}
];
`,
);
console.log(`${out}: ${rows.length} ukuran`);
