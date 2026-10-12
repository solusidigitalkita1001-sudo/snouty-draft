#!/usr/bin/env node
/**
 * Golden eval jawaban pertanyaan sales (`evals/faq-sales-cases.json`) terhadap API yang berjalan —
 * lokal atau produksi. Tiap kasus di sesi tamu baru (kuota tamu per sesi), mode Hemat, satu
 * percakapan baru. Keluaran: skor per kasus + alasan gagal; `--out berkas.json` menyimpan jawaban.
 *
 *   node scripts/faq-eval.mjs https://ai.pralon.co.id/api/v1 [--only DE-07,MA-02] [--out hasil.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2];
if (!base) {
  console.error('pakai: node scripts/faq-eval.mjs <base-url> [--only ID,ID] [--out berkas.json]');
  process.exit(2);
}
const flag = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const only = flag('--only')?.split(',');
const out = flag('--out');

const { cases } = JSON.parse(
  readFileSync(join(here, '..', 'evals', 'faq-sales-cases.json'), 'utf8'),
);
const rx = (p) => new RegExp(p, 'im');

async function ask(text) {
  let cookie = '';
  const req = async (method, path, body) => {
    const r = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = r.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return r;
  };
  const conv = await (await req('POST', '/conversations', { language: 'id' })).json();
  const t0 = Date.now();
  const response = await req('POST', `/conversations/${conv.id}/messages`, { text, mode: 'hemat' });
  const raw = await response.text();
  const ms = Date.now() - t0;
  if (!response.ok)
    return { text: `HTTP ${response.status} ${raw.slice(0, 200)}`, cards: [], ms, state: '' };
  const events = raw
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => JSON.parse(l.slice(5)));
  const answer = events
    .filter((e) => e.type === 'token')
    .map((e) => e.text)
    .join('');
  const cards = events.filter((e) => e.type === 'card').map((e) => e.card);
  const state = JSON.stringify(
    await (await req('GET', `/conversations/${conv.id}/requirement`)).json(),
  );
  return { text: answer, cards, ms, state };
}

function judge(c, got) {
  const problems = [];
  const k = c.checks ?? {};
  const cardText = got.cards.map((card) => JSON.stringify(card)).join('\n');
  const all = `${got.text}\n${cardText}`;
  for (const p of k.all ?? []) if (!rx(p).test(all)) problems.push(`tidak memuat /${p}/`);
  for (const group of k.any ?? []) {
    if (!group.some((p) => rx(p).test(all)))
      problems.push(`tidak memuat salah satu dari ${group.join(' | ')}`);
  }
  for (const p of k.none ?? []) if (rx(p).test(got.text)) problems.push(`memuat terlarang /${p}/`);
  if (k.opens) {
    const first = got.text.replace(/^\s*[*_#>-]+\s*/, '').split(/(?<=[.!?])\s|\n/)[0] ?? '';
    if (!rx(k.opens).test(first))
      problems.push(`kalimat pertama tidak cocok /${k.opens}/: "${first.slice(0, 90)}"`);
  }
  for (const kind of k.cards ?? []) {
    if (!got.cards.some((card) => card.kind === kind)) problems.push(`tanpa kartu ${kind}`);
  }
  if (k.state && !got.state.includes(`"value":${k.state}`))
    problems.push(`state tanpa nilai ${k.state}`);
  return problems;
}

const results = [];
let passed = 0;
for (const c of cases) {
  if (only && !only.includes(c.id)) continue;
  const got = await ask(c.q);
  const problems = judge(c, got);
  if (problems.length === 0) passed += 1;
  results.push({
    id: c.id,
    q: c.q,
    ms: got.ms,
    pass: problems.length === 0,
    problems,
    text: got.text,
    cards: got.cards.map((x) => x.kind),
  });
  console.log(
    `${problems.length === 0 ? 'LOLOS' : 'GAGAL'} ${c.id} [${got.ms} ms] ${problems.join('; ')}`,
  );
  console.log(`   ${got.text.replace(/\n+/g, ' ⏎ ').slice(0, 400)}`);
}
console.log(`\nskor: ${passed}/${results.length}`);
if (out) writeFileSync(out, JSON.stringify(results, null, 2));
