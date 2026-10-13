// Membuat packages/ui/src/illustrations.ts dari simbol SVG di mockup DD-01.
import fs from 'node:fs';
const [mockup, out] = process.argv.slice(2);
const html = fs.readFileSync(mockup, 'utf8');
const symbols = [
  ...html.matchAll(/<symbol id="([ip])-([a-z0-9]+)" viewBox="([^"]+)">([\s\S]*?)<\/symbol>/g),
];

const VARS = {
  '--ink-3': 'var(--snouty-ink-3)',
  '--ink-4': 'var(--snouty-ink-4)',
  '--ink': 'var(--snouty-ink)',
  '--surface': 'var(--snouty-surface)',
  '--subtle': 'var(--snouty-surface-subtle)',
  '--fill-soft': 'var(--snouty-hairline)',
  '--fill-mid': 'var(--snouty-border)',
  '--water-soft': 'color-mix(in srgb, var(--snouty-mascot-water) 28%, var(--snouty-surface))',
  '--water': 'var(--snouty-mascot-water)',
  '--action-soft': 'var(--snouty-action-soft-bg)',
  '--action-text': 'var(--snouty-action-text)',
  '--action': 'var(--snouty-action)',
  '--pipe-main': 'var(--snouty-pipe-main)',
  '--pipe-mid': 'var(--snouty-pipe-mid)',
  '--pipe-light': 'var(--snouty-pipe-light)',
  '--ok': 'var(--snouty-verified-text)',
  '--caption': 'var(--snouty-caption)',
  '--drain-2': 'var(--snouty-muted-2)',
  '--drain': 'var(--snouty-muted)',
  '--floor': 'var(--snouty-floor-line)',
  '--warn': 'var(--snouty-assumed-text)',
  '--mono': 'var(--snouty-font-mono)',
};
const CLASSES = ['ln1', 'ln', 'sf', 'mf', 'df', 'wf', 'ws', 'wl', 'af', 'as', 'al', 'gf'];

function convert(body) {
  let s = body.replace(/var\((--[a-z0-9-]+)\)/g, (m, name) => {
    if (name.startsWith('--pc')) return `var(--il-${name.slice(2)})`; // warna produk dari pemakai
    if (!VARS[name]) throw new Error('var tak dikenal: ' + name);
    return VARS[name];
  });
  s = s.replace(
    /class="([^"]+)"/g,
    (m, list) =>
      `class="${list
        .split(/\s+/)
        .map((c) => {
          if (!CLASSES.includes(c)) throw new Error('kelas tak dikenal: ' + c);
          return 'il-' + c;
        })
        .join(' ')}"`,
  );
  return s.replace(/\n\s*/g, '');
}

const ink = 'var(--snouty-ink)';
const style = [
  `.il-ln{fill:none;stroke:${ink};stroke-width:2;stroke-linecap:round;stroke-linejoin:round}`,
  `.il-ln1{fill:none;stroke:${ink};stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}`,
  `.il-sf{fill:${VARS['--surface']}}`,
  `.il-mf{fill:${VARS['--fill-soft']}}`,
  `.il-df{fill:${VARS['--fill-mid']}}`,
  `.il-wf{fill:${VARS['--water']}}`,
  `.il-ws{fill:${VARS['--water-soft']}}`,
  `.il-wl{fill:none;stroke:${VARS['--water']};stroke-width:2;stroke-linecap:round}`,
  `.il-af{fill:${VARS['--action']}}`,
  `.il-as{fill:${VARS['--action-soft']}}`,
  `.il-al{fill:none;stroke:${VARS['--pipe-main']};stroke-width:3;stroke-linecap:round;stroke-linejoin:round}`,
  `.il-gf{fill:${VARS['--ok']}}`,
  // Kelas dipakai bersama (mis. "sf ln"): isi dari kelas isi, garis dari kelas garis.
  `.il-sf.il-ln,.il-mf.il-ln,.il-df.il-ln,.il-as.il-ln,.il-ws.il-ln,.il-sf.il-ln1,.il-mf.il-ln1,.il-df.il-ln1,.il-as.il-ln1,.il-ws.il-ln1{stroke:${ink}}`,
  `.il-sf.il-ln,.il-sf.il-ln1{fill:${VARS['--surface']}}`,
  `.il-mf.il-ln,.il-mf.il-ln1{fill:${VARS['--fill-soft']}}`,
  `.il-df.il-ln,.il-df.il-ln1{fill:${VARS['--fill-mid']}}`,
  `.il-as.il-ln,.il-as.il-ln1{fill:${VARS['--action-soft']}}`,
  `.il-ws.il-ln,.il-ws.il-ln1{fill:${VARS['--water-soft']}}`,
  `.il-text{font-family:inherit}`,
].join('');

const scenes = symbols.filter((m) => m[1] === 'i');
const products = symbols.filter((m) => m[1] === 'p');
const names = (list) => list.map((m) => `  '${m[2]}',`).join('\n');
const defs = symbols
  .map(
    (m) =>
      `<symbol id="il-${m[1] === 'p' ? 'p-' : ''}${m[2]}" viewBox="${m[3]}">${convert(m[4])}</symbol>`,
  )
  .join('');

const ts = `/**
 * Pustaka ilustrasi SNOUTY (DD-01): gambar kebutuhan, pilihan kartu pertanyaan, dan jenis produk.
 *
 * DIBUAT OTOMATIS dari mockup yang disetujui pemilik
 * (\`design-input/mockups/2026-10-13-solusi-laporan-v2.html\`) — ubah gambarnya di sana lalu jalankan
 * \`node scripts/gen-illustrations.mjs <mockup> packages/ui/src/illustrations.ts\`; jangan sunting
 * string di bawah dengan tangan.
 *
 * Satu sprite SVG untuk web dan laporan: simbol \`il-<nama>\` dipakai lewat \`<use href>\`.
 * Warnanya token SNOUTY (\`--snouty-*\`), jadi terang dan gelap ikut tema. Gambar produk memakai
 * \`--il-pc\`, \`--il-pc2\`, \`--il-pc3\` (warna badan, garis, tulisan) yang diisi pemakainya.
 */

/** Ilustrasi kebutuhan dan pilihan (viewBox 120 × 100). */
export const SCENE_ILLUSTRATIONS = [
${names(scenes)}
] as const;
export type SceneIllustration = (typeof SCENE_ILLUSTRATIONS)[number];

/** Gambar jenis produk (viewBox 160 × 90), dipakai sampai foto asli tersedia (OQ-62). */
export const PRODUCT_ILLUSTRATIONS = [
${names(products)}
] as const;
export type ProductIllustration = (typeof PRODUCT_ILLUSTRATIONS)[number];

export const SCENE_VIEWBOX = '0 0 120 100';
export const PRODUCT_VIEWBOX = '0 0 160 90';

const STYLE = ${JSON.stringify(style)};

const SYMBOLS = ${JSON.stringify(defs)};

/** Isi \`<svg>\` sprite: gaya + seluruh simbol. Dipasang sekali per halaman. */
export function illustrationSpriteContent(): string {
  return \`<style>\${STYLE}</style><defs>\${SYMBOLS}</defs>\`;
}

export function sceneHref(name: SceneIllustration): string {
  return \`#il-\${name}\`;
}

export function productHref(name: ProductIllustration): string {
  return \`#il-p-\${name}\`;
}
`;
fs.writeFileSync(out, ts);
process.stdout.write(`scenes ${scenes.length}, products ${products.length}, bytes ${ts.length}\n`);
