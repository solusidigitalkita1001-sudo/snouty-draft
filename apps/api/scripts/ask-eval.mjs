#!/usr/bin/env node
/**
 * Menanyakan SEKUMPULAN pertanyaan apa adanya ke API yang berjalan dan menyimpan jawabannya untuk
 * DIBACA (P27-13, pemilik 2026-10-23: "coba testing dari pertanyaan2 ini lalu lu review jawabannya
 * masuk akal apa ngga").
 *
 * Berbeda dari `faq-eval.mjs`, di sini tidak ada pola yang dicocokkan: pola yang lolos tidak
 * berarti jawabannya masuk akal. Keluarannya berkas Markdown berisi pertanyaan, jawaban utuh,
 * kartu yang muncul, dan waktunya — untuk dibaca satu per satu.
 *
 * Tiap pertanyaan di percakapan tamu yang baru, berurutan (model di server berjalan di CPU;
 * permintaan paralel membuat tahap pemahaman kelaparan — lihat catatan audit P25-03).
 *
 *   node scripts/ask-eval.mjs <base-url> <berkas-pertanyaan.json> --out hasil.md [--only 3,7]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [base, file] = process.argv.slice(2);
if (!base || !file) {
  console.error('pakai: node scripts/ask-eval.mjs <base-url> <berkas.json> --out hasil.md');
  process.exit(2);
}
const flag = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const out = flag('--out');
const only = flag('--only')?.split(',').map(Number);
const { cases } = JSON.parse(readFileSync(resolve(file), 'utf8'));

function session() {
  let cookie = '';
  return async (method, path, body) => {
    const r = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = r.headers.getSetCookie?.() ?? [];
    if (set.length > 0) cookie = set.map((c) => c.split(';')[0]).join('; ');
    return r;
  };
}

/** Potongan SSE → teks jawaban dan kartu yang menyertainya. */
function parse(raw) {
  let text = '';
  const cards = [];
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data:')) continue;
    let event;
    try {
      event = JSON.parse(line.slice(5).trim());
    } catch {
      continue;
    }
    if (typeof event.text === 'string') text += event.text;
    if (event.type === 'card' && event.card) cards.push(event.card.kind ?? 'card');
    if (Array.isArray(event.cards)) cards.push(...event.cards.map((c) => c.kind ?? 'card'));
  }
  return { text: text.trim(), cards: [...new Set(cards)] };
}

const rows = [];
for (const [index, kase] of cases.entries()) {
  const n = index + 1;
  if (only && !only.includes(n)) continue;
  const req = session();
  const started = Date.now();
  let answer = { text: '', cards: [] };
  let error = null;
  try {
    const created = await req('POST', '/conversations', { language: kase.language ?? 'id' });
    const { id } = await created.json();
    const sent = await req('POST', `/conversations/${id}/messages`, { text: kase.q });
    answer = parse(await sent.text());
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }
  const ms = Date.now() - started;
  rows.push({ n, group: kase.group ?? '', q: kase.q, ...answer, ms, error });
  const head = (error ?? answer.text).replace(/\s+/g, ' ').slice(0, 90);
  console.log(`${String(n).padStart(3)} [${String(ms).padStart(6)} ms] ${head}`);
}

const md = [
  `# SNOUTY — jawaban atas pertanyaan pemilik (${new Date().toISOString().slice(0, 10)})`,
  '',
  `Sumber: ${base} · ${rows.length} pertanyaan · tiap pertanyaan di percakapan tamu yang baru.`,
  '',
  ...rows.flatMap((row) => [
    `## ${row.n}. ${row.q}`,
    '',
    row.group
      ? `_${row.group}_ · ${row.ms} ms${row.cards.length ? ` · kartu: ${row.cards.join(', ')}` : ''}`
      : `${row.ms} ms${row.cards.length ? ` · kartu: ${row.cards.join(', ')}` : ''}`,
    '',
    row.error ? `**GAGAL:** ${row.error}` : row.text || '**(kosong)**',
    '',
  ]),
].join('\n');
if (out) writeFileSync(resolve(out), md);
console.log(`\n${rows.length} pertanyaan${out ? ` → ${out}` : ''}`);
