#!/usr/bin/env node
/**
 * Kapasitas layanan model, diukur langsung — bukan lewat chat. Jalur chat hampir seluruhnya
 * deterministik, dan satu-satunya giliran yang memanggil model berhenti di batas 15 detik lalu
 * memakai teks tetap (OQ-94), jadi beban chat tidak pernah memperlihatkan batas model. Yang
 * menentukan ukuran server justru antrean ini: berapa permintaan serentak sampai menunggunya
 * tidak masuk akal lagi.
 *
 * DIJALANKAN DI SERVER (layanan model tidak terbuka ke jaringan):
 *   ssh -i ~/.ssh/snouty_deploy snouty@192.168.1.10
 *   docker run --rm --network snouty_default -v ~/snouty/scripts:/s node:22-alpine \
 *     node /s/load-test/model-queue.mjs --base http://ollama:11434 --model qwen3.5:9b
 *
 * Berhenti sendiri saat p95 melewati --max-wait (baku 60 detik) atau tahap terakhir selesai.
 * Setiap permintaan dibatasi 160 token keluaran supaya pengujiannya pendek dan terukur.
 */
const args = parse(process.argv.slice(2));
const BASE = (args.base ?? 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODEL = args.model ?? 'qwen3.5:9b';
const STAGES = String(args.stages ?? '1,2,4,8')
  .split(',')
  .map(Number);
const PER_STAGE = Number(args['per-stage'] ?? 4);
const MAX_WAIT_MS = Number(args['max-wait'] ?? 60) * 1000;
const NUM_PREDICT = Number(args.tokens ?? 160);

/** Satu kalimat teknis, panjangnya wajar — yang diukur laju model, bukan isi jawabannya. */
const PROMPT =
  'Jelaskan dalam dua kalimat mengapa pipa HDPE disambung dengan pemanasan, bukan dengan lem.';

const rows = [];
await main();

async function main() {
  console.log(`layanan : ${BASE}`);
  console.log(`model   : ${MODEL}`);
  console.log(
    `tahapan : ${STAGES.join(' → ')} permintaan serentak, ${PER_STAGE} putaran per tahap`,
  );
  console.log(`berhenti: p95 > ${MAX_WAIT_MS / 1000} detik\n`);

  // Pemanasan: muat model ke RAM dulu. Tanpa ini tahap pertama mengukur waktu MEMUAT model
  // (belasan detik di CPU), bukan waktu menjawab.
  const warm = await generate();
  console.log(`pemanasan: ${fmt(warm.ms)} · ${warm.tokens} token · ${rate(warm)} token/detik\n`);

  for (const concurrency of STAGES) {
    const stage = [];
    for (let round = 0; round < PER_STAGE; round += 1) {
      const batch = await Promise.all(Array.from({ length: concurrency }, () => generate()));
      stage.push(...batch);
    }
    rows.push({ concurrency, results: stage });
    const ok = stage.filter((r) => r.ok);
    const p95 = quantile(
      ok.map((r) => r.ms),
      0.95,
    );
    const throughput =
      ok.reduce((sum, r) => sum + r.tokens, 0) /
      (sum(ok.map((r) => r.ms)) / 1000 / Math.max(concurrency, 1));
    console.log(
      `${String(concurrency).padStart(2)} serentak · n=${String(stage.length).padStart(3)} ` +
        `p50 ${fmt(
          quantile(
            ok.map((r) => r.ms),
            0.5,
          ),
        ).padStart(8)} p95 ${fmt(p95).padStart(8)} ` +
        `maks ${fmt(
          quantile(
            ok.map((r) => r.ms),
            1,
          ),
        ).padStart(8)} · ` +
        `${throughput.toFixed(2)} token/detik total` +
        (stage.length - ok.length > 0 ? ` · gagal ${stage.length - ok.length}` : ''),
    );
    if (p95 > MAX_WAIT_MS) {
      console.log(`\nBERHENTI: p95 ${fmt(p95)} melewati batas ${MAX_WAIT_MS / 1000} detik.`);
      break;
    }
  }
  console.log('\nAntrean model adalah antrean tunggal: permintaan kedua menunggu yang pertama');
  console.log('selesai, jadi p95 naik hampir linear terhadap jumlah permintaan serentak.');
}

async function generate() {
  const t0 = Date.now();
  try {
    const r = await fetch(`${BASE}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt: PROMPT,
        stream: false,
        options: { num_predict: NUM_PREDICT },
      }),
    });
    const body = await r.json();
    return {
      ok: r.ok,
      ms: Date.now() - t0,
      tokens: body.eval_count ?? 0,
      evalMs: (body.eval_duration ?? 0) / 1e6,
    };
  } catch (error) {
    return { ok: false, ms: Date.now() - t0, tokens: 0, evalMs: 0, error: error.message };
  }
}

const rate = (r) => (r.evalMs > 0 ? (r.tokens / (r.evalMs / 1000)).toFixed(2) : '—');
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const fmt = (v) =>
  Number.isNaN(v) || v === undefined
    ? '—'
    : v >= 1000
      ? `${(v / 1000).toFixed(1)} s`
      : `${Math.round(v)} ms`;

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return Number.NaN;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function parse(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}
