#!/usr/bin/env node
/**
 * Probe jawaban terhadap API yang berjalan — lokal atau produksi. Berbeda dari `live-eval.mjs` dan
 * `faq-eval.mjs`, yang mencocokkan jawaban dengan harapan yang sudah ditulis: probe TIDAK menilai
 * apa pun. Ia menanyakan satu daftar pertanyaan dan menuliskan jawaban UTUH untuk dibaca manusia.
 *
 * Alasannya ada di tiga fase terakhir: cacat baru selalu datang dari pertanyaan yang belum pernah
 * ditanyakan, dan pemeriksa yang ditulis sebelum jawabannya terlihat hanya menemukan apa yang sudah
 * diduga. Probe dibaca dulu, pemeriksanya ditulis belakangan — di berkas eval, bukan di sini.
 *
 *   node scripts/probe.mjs <base-url> <berkas-kasus.json> [--only P7-01,P7-02] [--out hasil.md]
 *   node scripts/probe.mjs https://ai.pralon.co.id/api/v1 evals/probe-v7-2026-11-12.json
 *
 * Giliran dikirim BERURUTAN: paralel di server CPU hanya mengantrekan model dan memalsukan
 * kegagalan (lihat PROGRESS P25-03).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [base, file] = process.argv.slice(2);
if (!base || !file) {
  console.error(
    'pakai: node scripts/probe.mjs <base-url> <berkas-kasus.json> [--only ID] [--out hasil.md]',
  );
  process.exit(2);
}
const flag = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const only = flag('--only')?.split(',');
const out = flag('--out');
const mode = flag('--mode') ?? 'hemat';

const { cases } = JSON.parse(readFileSync(resolve(file), 'utf8'));

/** Satu percakapan tamu baru per kasus; giliran di dalam satu kasus berbagi percakapan. */
async function ask(turns, language) {
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
  const conv = await (await req('POST', '/conversations', { language: language ?? 'id' })).json();
  const said = [];
  for (const text of turns) {
    const t0 = Date.now();
    const response = await req('POST', `/conversations/${conv.id}/messages`, { text, mode });
    const raw = await response.text();
    const ms = Date.now() - t0;
    if (!response.ok) {
      said.push({ q: text, ms, answer: `HTTP ${response.status} ${raw.slice(0, 300)}`, cards: [] });
      continue;
    }
    const events = raw
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => JSON.parse(l.slice(5)));
    said.push({
      q: text,
      ms,
      answer: events
        .filter((e) => e.type === 'token')
        .map((e) => e.text)
        .join(''),
      cards: events.filter((e) => e.type === 'card').map((e) => e.card),
    });
  }
  const requirement = await (await req('GET', `/conversations/${conv.id}/requirement`)).json();
  return { said, requirement };
}

const lines = [`# Probe ${file} → ${base}`, '', `Dijalankan ${new Date().toISOString()}`, ''];
let slowest = 0;

for (const c of cases) {
  if (only && !only.includes(c.id)) continue;
  const turns = c.turns ?? [c.q];
  const { said, requirement } = await ask(turns, c.language);
  const ms = said.map((s) => s.ms);
  slowest = Math.max(slowest, ...ms);
  console.log(`${c.id ?? '—'} [${ms.join('+')} ms] ${turns[0].slice(0, 70)}`);
  console.log(`   ${said.at(-1).answer.replace(/\n+/g, ' ⏎ ').slice(0, 300)}`);

  lines.push(`## ${c.id ?? '—'}${c.note ? ` — ${c.note}` : ''}`, '');
  for (const s of said) {
    lines.push(`**T:** ${s.q}`, '', `**J** (${s.ms} ms):`, '', s.answer || '_(kosong)_', '');
    if (s.cards.length) lines.push(`Kartu: ${s.cards.map((k) => k.kind).join(', ')}`, '');
  }
  const values = Object.entries(requirement?.fields ?? requirement ?? {}).length;
  if (values) lines.push('```json', JSON.stringify(requirement, null, 2).slice(0, 1200), '```', '');
}

lines.push('', `Giliran terlama: ${slowest} ms.`);
if (out) {
  writeFileSync(resolve(out), lines.join('\n'), 'utf8');
  console.log(`\n→ ${out}`);
}
console.log(`giliran terlama ${slowest} ms`);
