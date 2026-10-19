#!/usr/bin/env node
/**
 * Simulasi test case terhadap API yang berjalan (P25-04) — lokal atau produksi. Tiap kasus satu
 * percakapan tamu baru; giliran dikirim BERURUTAN (paralel di server CPU memalsukan kegagalan karena
 * antrean model). Selain pemeriksaan per kasus, setiap jawaban diperiksa terhadap aturan teks pengguna
 * yang berlaku global: tanpa metatext ("data saya", "sebagai AI"), tanpa pembuka basa-basi, tanpa
 * jawaban "belum menangkap maksud", tanpa nilai mentah (undefined/NaN).
 *
 *   node scripts/live-eval.mjs <base-url> <berkas-kasus.json> [--only PP-01,PP-02] [--out hasil.md]
 *   node scripts/live-eval.mjs https://ai.pralon.co.id/api/v1 evals/live-piping-cases.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [base, file] = process.argv.slice(2);
if (!base || !file) {
  console.error(
    'pakai: node scripts/live-eval.mjs <base-url> <berkas-kasus.json> [--only ID] [--out hasil.md]',
  );
  process.exit(2);
}
const flag = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const only = flag('--only')?.split(',');
const out = flag('--out');
const slowMs = Number(flag('--slow-ms') ?? 15_000);

const { cases } = JSON.parse(readFileSync(resolve(file), 'utf8'));
const rx = (p) => new RegExp(p, 'im');

/** Aturan teks pengguna (CLAUDE.md "Teks yang dilihat pengguna") — berlaku untuk setiap jawaban. */
const GLOBAL_NONE = [
  'data saya',
  '\\bmy (official )?data\\b',
  'sebagai (sebuah )?AI|as an AI',
  '^(Tentu|Baik)!',
  '^Berikut adalah',
  'belum menangkap maksud',
  "didn't quite catch",
  '\\bundefined\\b|\\bNaN\\b|\\[object Object\\]',
  'Kelas tekanan hanya disebut',
];

async function conversation(turns) {
  let cookie = '';
  const req = async (method, path, body) => {
    const r = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = r.headers.getSetCookie?.() ?? [];
    if (set.length > 0) cookie = set.map((c) => c.split(';')[0]).join('; ');
    return r;
  };
  const conv = await (await req('POST', '/conversations', { language: 'id' })).json();
  const results = [];
  for (const turn of turns) {
    const t0 = Date.now();
    const response = await req('POST', `/conversations/${conv.id}/messages`, { text: turn.q });
    const raw = await response.text();
    const ms = Date.now() - t0;
    if (!response.ok) {
      results.push({ turn, ms, text: `HTTP ${response.status} ${raw.slice(0, 200)}`, cards: [] });
      continue;
    }
    const events = raw
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => JSON.parse(l.slice(5)));
    const text = events
      .filter((e) => e.type === 'token')
      .map((e) => e.text)
      .join('');
    const cards = events.filter((e) => e.type === 'card').map((e) => e.card);
    results.push({ turn, ms, text, cards });
  }
  return results;
}

function verdict({ turn, text, cards }) {
  const c = turn.checks ?? {};
  const failed = [];
  for (const p of c.all ?? []) if (!rx(p).test(text)) failed.push(`tidak ada: /${p}/`);
  for (const group of c.any ?? [])
    if (!group.some((p) => rx(p).test(text)))
      failed.push(`tidak ada satu pun: ${group.join(' | ')}`);
  for (const p of [...(c.none ?? []), ...GLOBAL_NONE])
    if (rx(p).test(text)) failed.push(`terlarang: /${p}/`);
  for (const kind of c.cards ?? [])
    if (!cards.some((k) => k.kind === kind)) failed.push(`kartu ${kind} tidak ada`);
  return failed;
}

const rows = [];
for (const kase of cases) {
  if (only && !only.includes(kase.id)) continue;
  let results;
  try {
    results = await conversation(kase.turns);
  } catch (error) {
    rows.push({ kase, ok: false, failed: [`galat: ${error.message}`], results: [] });
    console.log(`✗ ${kase.id} galat: ${error.message}`);
    continue;
  }
  const failed = results.flatMap((r, i) => verdict(r).map((f) => `giliran ${i + 1}: ${f}`));
  const slow = results.filter((r) => r.ms > slowMs).map((r) => `${r.turn.q} (${r.ms} ms)`);
  rows.push({ kase, ok: failed.length === 0, failed, results, slow });
  const ms = results.map((r) => r.ms).join('+');
  console.log(
    `${failed.length === 0 ? '✓' : '✗'} ${kase.id} [${kase.category}] ${ms} ms${slow.length ? ' LAMBAT' : ''}`,
  );
  for (const f of failed) console.log(`    ${f}`);
}

const passed = rows.filter((r) => r.ok).length;
console.log(`\n${passed}/${rows.length} lolos`);

if (out) {
  const md = [
    `# Simulasi test case — ${file}`,
    '',
    `${passed}/${rows.length} lolos · ${new Date().toISOString()} · ${base}`,
    '',
    ...rows.flatMap(({ kase, ok, failed, results }) => [
      `## ${ok ? '✓' : '✗'} ${kase.id} — ${kase.category}`,
      '',
      ...results.flatMap((r) => [
        `**Tanya:** ${r.turn.q}  `,
        `**Diharapkan:** ${r.turn.expect ?? '-'}  `,
        `**Waktu:** ${r.ms} ms · kartu: ${r.cards.map((k) => k.kind).join(', ') || '-'}`,
        '',
        '```',
        r.text,
        '```',
        '',
      ]),
      ...(failed.length ? ['**Gagal:**', ...failed.map((f) => `- ${f}`), ''] : []),
    ]),
  ].join('\n');
  writeFileSync(out, md);
}
process.exit(passed === rows.length ? 0 : 1);
