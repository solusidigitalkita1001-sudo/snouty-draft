#!/usr/bin/env node
/**
 * Uji kapasitas SNOUTY: berapa sesi serentak yang bisa dipegang server sebelum jawabannya
 * melambat. Bukan alat serangan — bebannya dinaikkan bertahap, setiap tahap diukur, dan
 * pengujian BERHENTI SENDIRI pada ambang pertama yang terlewati (lihat LIMITS).
 *
 * Tiga jalur diukur terpisah karena biayanya berbeda jauh:
 *   - fast : giliran deterministik (katalog, pengetahuan, tabel ukuran) — 150-400 ms;
 *   - case : kasus teknis utuh — kebutuhan dicatat, mesin hitung dijalankan lewat /analyze,
 *            lalu ditanyai dan diubah; jalur yang paling banyak menulis ke database;
 *   - web  : muat halaman dan katalog aktif — nginx dan SPA.
 * Dicampur jadi satu angka, jalur yang berat menutupi jalur yang ringan dan hasilnya tidak
 * bisa dibaca.
 *
 * Antrean model diukur terpisah oleh model-queue.mjs. Jalur chat hampir seluruhnya deterministik;
 * satu-satunya giliran yang memanggil model adalah pertanyaan lanjutan atas kasus yang sudah
 * dihitung, dan di CPU ia berhenti di batas 15 detik lalu memakai teks tetap (OQ-94). Membebani
 * chat karena itu tidak mengukur kapasitas model.
 *
 * Satu sesi tamu per pengguna virtual, dan batas pesan tamu 20/jam (docs/POLICY.md §10)
 * dihormati lewat --max-per-vu: yang diuji kapasitas server, bukan cara menembus batas lajunya.
 *
 *   node scripts/load-test/snouty-load.mjs --base https://ai.pralon.co.id --dry-run
 *   node scripts/load-test/snouty-load.mjs --base https://ai.pralon.co.id \
 *     --stages 1,10,50,100,200 --case-stages 0,2,5,10,20 --stage-seconds 300 \
 *     --host-metrics host.csv --out hasil/
 *
 * Prosedur, jendela waktu, dan pembersihan data: docs/LOAD_TEST.md.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

/** Ambang berhenti. Satu saja terlewati → pengujian dihentikan dan dilaporkan apa adanya. */
const LIMITS = {
  /** Giliran deterministik yang ikut melambat berarti kapasitasnya sudah terlewati. */
  fastP95Ms: 2000,
  /** Kasus teknis menjalankan mesin hitung dan menulis snapshot; lebih lambat itu wajar, sampai sini. */
  caseP95Ms: 15_000,
  errorRate: 0.01,
  /** 429 bukan galat server, tetapi kalau banyak yang terukur batas laju, bukan kapasitas. */
  rejectedRate: 0.05,
  /** Mesin 4 inti. */
  load1: 8,
  memFreeMb: 1500,
  /** Disk server tinggal belasan GB; uji ini menulis percakapan dan snapshot kebutuhan. */
  diskFreeGb: 8,
};

const args = parse(process.argv.slice(2));
const BASE = (args.base ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
const API = `${BASE}/api/v1`;
const OUT = args.out ?? `load-${stamp()}`;
const THINK_MS = Number(args.think ?? 50) * 1000;
const STAGE_MS = Number(args['stage-seconds'] ?? 300) * 1000;
const MAX_PER_VU = Number(args['max-per-vu'] ?? 18);
const MAX_MESSAGES = Number(args['max-messages'] ?? 4000);
const WEB_RPS = Number(args['web-rps'] ?? 2);
const FAST_STAGES = list(args.stages ?? '1,10,50,100,200');
const CASE_STAGES = list(args['case-stages'] ?? '0,2,5,10,20');
const DRY = args['dry-run'] === true;
const HOST_METRICS = args['host-metrics'] ?? null;

const pools = JSON.parse(readFileSync(new URL('./questions.json', import.meta.url), 'utf8')).pools;

/** Satu baris per permintaan; semuanya ditulis mentah supaya hasilnya bisa dihitung ulang. */
const records = [];
const conversations = [];
const state = { stop: null, stage: 0, sent: 0 };

mkdirSync(OUT, { recursive: true });
const rawPath = `${OUT}/requests.csv`;
writeFileSync(rawPath, 'ts,stage,track,step,status,ttft_ms,total_ms,bytes\n');
writeFileSync(`${OUT}/stages.csv`, 'stage,fast_vus,case_vus,n,fast_p95_ms,case_p95_ms\n');

main().catch((error) => {
  console.error('GAGAL:', error.message);
  process.exitCode = 1;
});

async function main() {
  console.log(`sasaran   : ${BASE}`);
  const version = await fetch(`${API}/catalog/version`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  console.log(`katalog   : ${version?.label ?? 'tidak terbaca'}`);
  if (DRY) {
    console.log('mode      : uji coba — satu sesi, satu giliran per jalur');
    await smoke();
    return;
  }
  console.log(
    `tahapan   : ${FAST_STAGES.join(' → ')} sesi cepat; ${CASE_STAGES.join(' → ')} sesi kasus`,
  );
  console.log(`per tahap : ${STAGE_MS / 1000} detik, jeda baca ${THINK_MS / 1000} detik`);
  console.log(
    `ambang    : p95 cepat ${LIMITS.fastP95Ms} ms · p95 kasus ${LIMITS.caseP95Ms / 1000} s · ` +
      `galat ${LIMITS.errorRate * 100}% · load ${LIMITS.load1} · RAM ${LIMITS.memFreeMb} MB · disk ${LIMITS.diskFreeGb} GB`,
  );
  console.log(`hasil     : ${OUT}/\n`);

  const web = runWeb();
  for (let i = 0; i < FAST_STAGES.length; i += 1) {
    state.stage = i + 1;
    const fastVus = FAST_STAGES[i] ?? 0;
    const caseVus = CASE_STAGES[i] ?? 0;
    const from = records.length;
    console.log(`— tahap ${state.stage}: ${fastVus} sesi cepat, ${caseVus} sesi kasus`);
    const runners = [
      ...Array.from({ length: fastVus }, (_, n) => vuFast(n)),
      ...Array.from({ length: caseVus }, (_, n) => vuCase(n)),
    ];
    const ended = await Promise.race([sleep(STAGE_MS), watchdog(from)]);
    state.stop = 'tahap selesai';
    await Promise.allSettled(runners);
    state.stop = null;
    report(state.stage, fastVus, caseVus, records.slice(from));
    if (typeof ended === 'string') {
      console.log(`\nBERHENTI: ${ended}`);
      break;
    }
    if (state.sent >= MAX_MESSAGES) {
      console.log(`\nBERHENTI: batas ${MAX_MESSAGES} pesan tercapai`);
      break;
    }
  }
  state.stop = 'selesai';
  await web;
  await cleanup();
  summarise();
}

/** Satu giliran per jalur dengan satu sesi — memastikan alatnya benar sebelum membebani. */
async function smoke() {
  const session = await guest();
  const fast = await turn(session, pick(pools.fast.questions), 'fast', 'tanya');
  console.log(
    `  fast  ${fast.status} · token pertama ${ms(fast.ttft)} · selesai ${ms(fast.total)}`,
  );
  const kasus = await caseScenario(session);
  for (const r of kasus) console.log(`  case  ${r.status} · ${r.step.padEnd(10)} ${ms(r.total)}`);
  await cleanup();
}

/** Pengguna virtual jalur cepat: sesi tamu sendiri, bertanya lalu "membaca" jawabannya. */
async function vuFast() {
  const session = await guest().catch(() => null);
  if (!session) return;
  let sent = 0;
  await sleep(Math.random() * THINK_MS);
  while (state.stop === null && sent < MAX_PER_VU && state.sent < MAX_MESSAGES) {
    await turn(session, pick(pools.fast.questions), 'fast', 'tanya');
    sent += 1;
    await think();
  }
}

/**
 * Pengguna virtual jalur kasus: satu kasus utuh per sesi, lalu kasusnya diubah — persis yang
 * dilakukan orang yang sedang merencanakan, dan jalur yang paling banyak menulis ke database.
 */
async function vuCase() {
  const session = await guest().catch(() => null);
  if (!session) return;
  await sleep(Math.random() * THINK_MS);
  while (state.stop === null && state.sent < MAX_MESSAGES) {
    await caseScenario(session);
    if (state.stop !== null) break;
    await think();
  }
}

async function caseScenario(session) {
  const out = [];
  out.push(await turn(session, pick(pools.case.requirement), 'case', 'kebutuhan'));
  if (state.stop !== null) return out;
  out.push(await analyze(session));
  await think(0.3);
  if (state.stop !== null) return out;
  out.push(await turn(session, pick(pools.case.followUp), 'case', 'lanjutan'));
  await think(0.3);
  if (state.stop !== null) return out;
  out.push(await turn(session, pick(pools.case.mutation), 'case', 'ubah'));
  return out;
}

/** Muat halaman dan katalog aktif pada laju tetap — latar yang selalu ada di jam kerja. */
async function runWeb() {
  const paths = pools.web.paths;
  let i = 0;
  while (state.stop !== 'selesai') {
    const path = paths[i++ % paths.length];
    const t0 = performance.now();
    try {
      const r = await fetch(`${BASE}${path}`, { redirect: 'manual' });
      await r.arrayBuffer();
      record('web', path, r.status, null, performance.now() - t0, 0);
    } catch {
      record('web', path, 0, null, performance.now() - t0, 0);
    }
    await sleep(1000 / Math.max(WEB_RPS, 0.1));
  }
}

async function guest() {
  const jar = { cookie: '' };
  const r = await http(jar, 'POST', '/conversations', { language: 'id' });
  if (!r.ok) throw new Error(`sesi tamu gagal: ${r.status}`);
  const body = await r.json();
  conversations.push({ id: body.id, jar });
  return { jar, id: body.id };
}

/**
 * Satu giliran chat. Dua hal yang diukur: waktu sampai token PERTAMA — itu yang dirasakan
 * pengguna — dan waktu sampai jawabannya utuh.
 */
async function turn(session, text, track, step) {
  const t0 = performance.now();
  state.sent += 1;
  let status;
  let ttft = null;
  let bytes = 0;
  try {
    const r = await fetch(`${API}/conversations/${session.id}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        cookie: session.jar.cookie,
      },
      body: JSON.stringify({ text }),
    });
    status = r.status;
    if (r.body) {
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let tail = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        // Diperiksa SEBELUM dipangkas: satu balasan pendek tiba dalam satu potongan, dan
        // menyimpan 400 karakter terakhir saja membuang event token yang ada di awalnya.
        const probe = tail + decoder.decode(value, { stream: true });
        if (ttft === null && probe.includes('"type":"token"')) ttft = performance.now() - t0;
        tail = probe.slice(-400);
      }
    }
  } catch {
    status = 0;
  }
  return record(track, step, status, ttft, performance.now() - t0, bytes);
}

/** "Susun rekomendasi" — mesin hitung jalan, nol panggilan model. */
async function analyze(session) {
  const t0 = performance.now();
  let status;
  let bytes = 0;
  try {
    const r = await fetch(`${API}/conversations/${session.id}/analyze`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        cookie: session.jar.cookie,
      },
      body: '{}',
    });
    status = r.status;
    bytes = (await r.arrayBuffer()).byteLength;
  } catch {
    status = 0;
  }
  return record('case', 'analisa', status, null, performance.now() - t0, bytes);
}

async function http(jar, method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', cookie: jar.cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = r.headers.getSetCookie?.() ?? [];
  if (set.length > 0) jar.cookie = set.map((c) => c.split(';')[0]).join('; ');
  return r;
}

function record(track, step, status, ttft, total, bytes) {
  const row = { ts: Date.now(), stage: state.stage, track, step, status, ttft, total, bytes };
  records.push(row);
  appendFileSync(
    rawPath,
    `${row.ts},${row.stage},${track},${step},${status},${ttft === null ? '' : Math.round(ttft)},${Math.round(total)},${bytes}\n`,
  );
  return row;
}

/**
 * Pengawas: menilai ambang setiap 15 detik dari tahap yang sedang jalan dan dari metrik host
 * (bila host-sampler.sh sedang menulisnya). Mengembalikan alasan berhenti.
 */
async function watchdog(from) {
  for (;;) {
    await sleep(15_000);
    if (state.stop !== null) return false;
    const slice = records.slice(from);
    const fast = slice.filter((r) => r.track === 'fast');
    const kasus = slice.filter((r) => r.track === 'case');
    const answered = slice.filter((r) => r.track !== 'web');
    if (fast.length >= 20 && p95(fast) > LIMITS.fastP95Ms) {
      return `p95 jalur cepat ${ms(p95(fast))} melewati ${LIMITS.fastP95Ms} ms`;
    }
    if (kasus.length >= 20 && p95(kasus) > LIMITS.caseP95Ms) {
      return `p95 jalur kasus ${ms(p95(kasus))} melewati ${LIMITS.caseP95Ms / 1000} s`;
    }
    if (answered.length >= 20) {
      const failed = answered.filter((r) => r.status === 0 || r.status >= 500).length;
      const rejected = answered.filter((r) => r.status === 429).length;
      if (failed / answered.length > LIMITS.errorRate) {
        return `galat ${pct(failed, answered.length)} melewati ${LIMITS.errorRate * 100}%`;
      }
      if (rejected / answered.length > LIMITS.rejectedRate) {
        return `429 ${pct(rejected, answered.length)} — yang terukur batas laju, bukan kapasitas`;
      }
    }
    const host = hostMetrics();
    if (host) {
      if (host.load1 > LIMITS.load1) return `load average ${host.load1} melewati ${LIMITS.load1}`;
      if (host.memFreeMb < LIMITS.memFreeMb) {
        return `RAM bebas ${host.memFreeMb} MB di bawah ${LIMITS.memFreeMb} MB`;
      }
      if (host.diskFreeGb < LIMITS.diskFreeGb) {
        return `disk bebas ${host.diskFreeGb} GB di bawah ${LIMITS.diskFreeGb} GB`;
      }
    }
  }
}

/** Baris terakhir CSV dari host-sampler.sh: ts,load1,mem_free_mb,disk_free_gb,... */
function hostMetrics() {
  if (!HOST_METRICS) return null;
  try {
    const lines = readFileSync(HOST_METRICS, 'utf8').trim().split(/\r?\n/);
    const last = lines[lines.length - 1]?.split(',');
    if (!last || last.length < 4 || Number.isNaN(Number(last[1]))) return null;
    return { load1: Number(last[1]), memFreeMb: Number(last[2]), diskFreeGb: Number(last[3]) };
  } catch {
    return null;
  }
}

/**
 * Percakapan uji dihapus (soft delete) supaya riwayat sungguhan tidak tercampur. Barisnya tetap
 * ada di database — daftar idnya ditulis ke conversations.txt untuk pembersihan tuntas oleh
 * pemilik (docs/LOAD_TEST.md §6).
 */
async function cleanup() {
  writeFileSync(`${OUT}/conversations.txt`, `${conversations.map((c) => c.id).join('\n')}\n`);
  let removed = 0;
  for (const c of conversations) {
    try {
      const r = await http(c.jar, 'DELETE', `/conversations/${c.id}`);
      if (r.ok) removed += 1;
    } catch {
      /* yang gagal terbaca dari selisih jumlahnya */
    }
  }
  console.log(`\npembersihan: ${removed}/${conversations.length} percakapan uji dihapus`);
}

function report(stage, fastVus, caseVus, slice) {
  for (const track of ['fast', 'case', 'web']) {
    const rows = slice.filter((r) => r.track === track);
    if (rows.length === 0) continue;
    const bad = rows.filter((r) => r.status === 0 || r.status >= 500).length;
    const rejected = rows.filter((r) => r.status === 429).length;
    const first = rows.filter((r) => r.ttft !== null);
    console.log(
      `  ${track.padEnd(5)} n=${String(rows.length).padStart(4)} ` +
        `p50 ${ms(p50(rows)).padStart(8)} p95 ${ms(p95(rows)).padStart(8)} maks ${ms(max(rows)).padStart(8)}` +
        (first.length > 0 ? ` · token pertama p95 ${ms(p95(first, 'ttft'))}` : '') +
        (bad > 0 ? ` · galat ${bad}` : '') +
        (rejected > 0 ? ` · 429 ${rejected}` : ''),
    );
  }
  const host = hostMetrics();
  if (host) {
    console.log(
      `  host  load ${host.load1} · RAM bebas ${host.memFreeMb} MB · disk bebas ${host.diskFreeGb} GB`,
    );
  }
  appendFileSync(
    `${OUT}/stages.csv`,
    `${stage},${fastVus},${caseVus},${slice.length},` +
      `${round(p95(slice.filter((r) => r.track === 'fast')))},` +
      `${round(p95(slice.filter((r) => r.track === 'case')))}\n`,
  );
}

function summarise() {
  const lines = [
    '# Hasil uji kapasitas SNOUTY',
    '',
    `Sasaran: ${BASE}`,
    `Waktu: ${new Date().toISOString()}`,
    `Pesan terkirim: ${state.sent}`,
    '',
    '| Tahap | Sesi cepat | Sesi kasus | Jalur | n | p50 | p95 | maks | galat | 429 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const stage of [...new Set(records.map((r) => r.stage))]) {
    for (const track of ['fast', 'case', 'web']) {
      const rows = records.filter((r) => r.stage === stage && r.track === track);
      if (rows.length === 0) continue;
      lines.push(
        `| ${stage} | ${FAST_STAGES[stage - 1] ?? ''} | ${CASE_STAGES[stage - 1] ?? ''} | ${track} | ` +
          `${rows.length} | ${ms(p50(rows))} | ${ms(p95(rows))} | ${ms(max(rows))} | ` +
          `${rows.filter((r) => r.status === 0 || r.status >= 500).length} | ` +
          `${rows.filter((r) => r.status === 429).length} |`,
      );
    }
  }
  lines.push('', `Permintaan mentah: \`requests.csv\` (${records.length} baris).`, '');
  writeFileSync(`${OUT}/RINGKASAN.md`, lines.join('\n'));
  console.log(`ringkasan : ${OUT}/RINGKASAN.md`);
}

/** Jeda baca dengan sebaran ±30%: permintaan serentak seperti metronom tidak ada pada manusia. */
function think(factor = 1) {
  return sleep(THINK_MS * factor * (0.7 + Math.random() * 0.6));
}
function pick(xs) {
  return xs[Math.floor(Math.random() * xs.length)];
}
function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
function ms(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`;
}
function pct(a, b) {
  return `${((100 * a) / b).toFixed(1)}%`;
}
function round(v) {
  return Number.isNaN(v) ? '' : Math.round(v);
}
function list(value) {
  return String(value)
    .split(',')
    .map((n) => Number(n.trim()));
}
function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
function quantile(rows, q, field = 'total') {
  const values = rows
    .map((r) => r[field])
    .filter((v) => v !== null && v !== undefined)
    .sort((a, b) => a - b);
  if (values.length === 0) return Number.NaN;
  return values[Math.min(values.length - 1, Math.floor(q * values.length))];
}
function p50(rows, field) {
  return quantile(rows, 0.5, field);
}
function p95(rows, field) {
  return quantile(rows, 0.95, field);
}
function max(rows, field) {
  return quantile(rows, 1, field);
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
