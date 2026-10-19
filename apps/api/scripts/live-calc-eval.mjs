#!/usr/bin/env node
/**
 * Simulasi test case PERHITUNGAN terhadap API yang berjalan (P25-05). Tiap kasus satu percakapan tamu:
 * pesan dikirim berurutan, kartu klarifikasi dijawab dari `answers` kasus (sisanya "Belum tahu" =
 * asumsi standar), lalu `POST /analyze` dan `GET /recommendations/:id`. Pemeriksaan per kasus atas JSON
 * rekomendasi, ditambah aturan yang berlaku untuk SEMUA hasil hitung:
 *   - tidak ada `VERIFIED` (semua aturan engine masih REQUIRES_DOMAIN_VALIDATION);
 *   - setiap produk punya productId dan keluarga katalog (tidak ada produk karangan);
 *   - kuantitas BOM positif dan berhingga; tidak ada NaN/undefined di JSON;
 *   - judul/isi tanpa metatext.
 *
 *   node scripts/live-calc-eval.mjs <base-url> <berkas-kasus.json> [--only C-01] [--out hasil.md]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [base, file] = process.argv.slice(2);
if (!base || !file) {
  console.error(
    'pakai: node scripts/live-calc-eval.mjs <base-url> <berkas-kasus.json> [--only ID] [--out hasil.md]',
  );
  process.exit(2);
}
const flag = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const only = flag('--only')?.split(',');
const out = flag('--out');
const { cases } = JSON.parse(readFileSync(resolve(file), 'utf8'));
const UNKNOWN = 'Belum tahu';
const MAX_CARD_ROUNDS = 4;
const METATEXT = /data saya|\bmy data\b|sebagai AI|as an AI|belum menangkap maksud/i;

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
const sse = (raw) =>
  raw
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => JSON.parse(l.slice(5)));
const clarificationOf = (cards) => cards.find((c) => c?.kind === 'clarification') ?? null;

/** Nilai di jalur "a.b[0].c" atau `*` untuk setiap elemen larik. */
function at(value, path) {
  let current = [value];
  for (const part of path.split('.')) {
    const m = /^(\w+)(?:\[(\d+|\*)\])?$/.exec(part);
    if (!m) return [];
    current = current.flatMap((v) => {
      const next = v?.[m[1]];
      if (m[2] === undefined) return [next];
      if (!Array.isArray(next)) return [];
      return m[2] === '*' ? next : [next[Number(m[2])]];
    });
  }
  return current.filter((v) => v !== undefined);
}

function check(rec, c) {
  const values = at(rec, c.path);
  const shown = JSON.stringify(values).slice(0, 160);
  if (c.equals !== undefined && !values.some((v) => JSON.stringify(v) === JSON.stringify(c.equals)))
    return `${c.path} = ${shown}, diharapkan ${JSON.stringify(c.equals)}`;
  if (c.matches !== undefined && !values.some((v) => new RegExp(c.matches, 'i').test(String(v))))
    return `${c.path} = ${shown}, tidak cocok /${c.matches}/`;
  if (c.none !== undefined && values.some((v) => new RegExp(c.none, 'i').test(String(v))))
    return `${c.path} = ${shown}, terlarang /${c.none}/`;
  if (c.min !== undefined && !values.some((v) => Number(v) >= c.min))
    return `${c.path} = ${shown}, diharapkan ≥ ${c.min}`;
  if (c.max !== undefined && !values.some((v) => Number(v) <= c.max))
    return `${c.path} = ${shown}, diharapkan ≤ ${c.max}`;
  if (c.exists === true && values.length === 0) return `${c.path} tidak ada`;
  return null;
}

function globalChecks(rec) {
  const failed = [];
  if (rec.overallProvenance === 'VERIFIED')
    failed.push('overallProvenance VERIFIED padahal aturan belum divalidasi');
  for (const b of rec.bom ?? []) {
    if (b.provenance === 'VERIFIED') failed.push(`BOM ${b.item} VERIFIED`);
    // Baris `pending` sengaja tanpa angka (dihitung tim / butuh data) — bukan kuantitas karangan.
    if (!b.pending && !(Number.isFinite(b.quantity) && b.quantity > 0))
      failed.push(`BOM ${b.item} kuantitas ${b.quantity}`);
  }
  for (const p of rec.products ?? []) {
    if (!p.productId || !p.family) failed.push(`produk tanpa id/keluarga katalog: ${p.name}`);
  }
  const json = JSON.stringify(rec);
  if (/\bNaN\b|"undefined"|\bnull m\b/.test(json))
    failed.push('nilai mentah NaN/undefined di rekomendasi');
  if (METATEXT.test(`${rec.headline} ${rec.body}`)) failed.push('metatext di judul/isi');
  return failed;
}

async function run(kase) {
  const req = session();
  const conv = await (
    await req('POST', '/conversations', { language: kase.language ?? 'id' })
  ).json();
  const log = [];
  let cards = [];
  for (const text of kase.messages) {
    const t0 = Date.now();
    const events = sse(
      await (await req('POST', `/conversations/${conv.id}/messages`, { text })).text(),
    );
    cards = events.filter((e) => e.type === 'card').map((e) => e.card);
    log.push({ who: 'user', text, ms: Date.now() - t0 });
    log.push({
      who: 'snouty',
      text: events
        .filter((e) => e.type === 'token')
        .map((e) => e.text)
        .join(''),
    });
  }
  for (let round = 0; round < MAX_CARD_ROUNDS; round += 1) {
    const card = clarificationOf(cards);
    if (!card) break;
    const answers = card.questions.map((q) => ({
      id: q.id,
      option: kase.answers?.[q.id] ?? UNKNOWN,
    }));
    const r = await req('POST', `/conversations/${conv.id}/requirement/clarification`, { answers });
    const body = await r.json().catch(() => ({}));
    log.push({ who: 'kartu', text: answers.map((a) => `${a.id}=${a.option}`).join('; ') });
    if (!r.ok) {
      log.push({
        who: 'galat',
        text: `clarification HTTP ${r.status} ${JSON.stringify(body).slice(0, 200)}`,
      });
      break;
    }
    log.push({ who: 'snouty', text: body.text ?? '' });
    const next = body.cards ?? [];
    if (JSON.stringify(clarificationOf(next)) === JSON.stringify(card)) break;
    cards = next;
  }
  const t0 = Date.now();
  const events = sse(await (await req('POST', `/conversations/${conv.id}/analyze`)).text());
  const analyzeMs = Date.now() - t0;
  const error = events.find((e) => e.type === 'error');
  const id = events.find((e) => e.type === 'solution.ready')?.recommendationId;
  const handoff = events.find((e) => e.type === 'card' && e.card?.kind === 'unsupported');
  if (!id)
    return {
      log,
      analyzeMs,
      rec: null,
      events,
      error: error?.code ?? (handoff ? 'HANDOFF' : 'TANPA SOLUSI'),
    };
  const rec = await (await req('GET', `/recommendations/${id}`)).json();
  return { log, analyzeMs, rec, events };
}

const rows = [];
for (const kase of cases) {
  if (only && !only.includes(kase.id)) continue;
  let result;
  try {
    result = await run(kase);
  } catch (e) {
    result = { log: [], rec: null, error: `galat: ${e.message}` };
  }
  const failed = [];
  if (kase.expectError) {
    if (result.error !== kase.expectError)
      failed.push(`diharapkan galat ${kase.expectError}, dapat ${result.error ?? 'rekomendasi'}`);
  } else if (!result.rec) failed.push(`tidak ada rekomendasi (${result.error})`);
  else {
    failed.push(...globalChecks(result.rec));
    for (const c of kase.checks ?? []) {
      const f = check(result.rec, c);
      if (f) failed.push(f);
    }
  }
  rows.push({ kase, failed, ...result });
  const s = result.rec?.stats ?? {};
  console.log(
    `${failed.length === 0 ? '✓' : '✗'} ${kase.id} [${kase.category}] ${result.analyzeMs ?? '-'} ms · ${result.rec?.headline ?? result.error}`,
  );
  if (result.rec) console.log(`    stats ${JSON.stringify(s)}`);
  for (const f of failed) console.log(`    ${f}`);
}
const passed = rows.filter((r) => r.failed.length === 0).length;
console.log(`\n${passed}/${rows.length} lolos`);

if (out) {
  const lines = [
    `# Simulasi perhitungan — ${file}`,
    '',
    `${passed}/${rows.length} lolos · ${new Date().toISOString()} · ${base}`,
    '',
  ];
  for (const { kase, failed, log, rec } of rows) {
    lines.push(
      `## ${failed.length === 0 ? '✓' : '✗'} ${kase.id} — ${kase.category}`,
      '',
      `**Diharapkan:** ${kase.expect ?? '-'}`,
      '',
    );
    for (const l of log) lines.push(`- **${l.who}:** ${String(l.text).replace(/\n+/g, ' ⏎ ')}`);
    if (rec) {
      lines.push(
        '',
        `**Hasil:** ${rec.headline} — ${rec.body}`,
        '',
        `- stats: \`${JSON.stringify(rec.stats)}\``,
      );
      for (const s of rec.systemLines ?? []) {
        lines.push(`- jalur **${s.name}** ${s.size ?? ''}`);
        for (const st of s.steps ?? []) lines.push(`  - ${st.title}: ${st.text}`);
      }
      lines.push('', '| Item | Ukuran | Jumlah | Dasar |', '|---|---|---|---|');
      for (const b of rec.bom ?? [])
        lines.push(
          `| ${b.purpose ?? b.item} | ${b.size ?? ''} | ${b.quantity} ${b.unit ?? ''} | ${String(b.basis ?? '').replace(/\|/g, '/')} |`,
        );
    }
    if (failed.length) lines.push('', '**Gagal:**', ...failed.map((f) => `- ${f}`));
    lines.push('');
  }
  writeFileSync(out, lines.join('\n'));
}
process.exit(passed === rows.length ? 0 : 1);
