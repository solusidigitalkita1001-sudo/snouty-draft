#!/usr/bin/env node
/**
 * P13-04 — evaluasi AI terhadap golden dataset (docs/EVALUATION.md §2–§5).
 *
 *   pnpm --filter @snouty/api build
 *   pnpm eval                       # seluruh dataset
 *   pnpm eval --tag extraction      # sebagian
 *   pnpm eval --compare evals/results/<berkas>.json
 *   pnpm eval --no-cache            # paksa panggilan model
 *
 * Memanggil model SUNGGUHAN lewat adapter yang sama dengan produksi (`OpenRouterAiService`
 * + `OpenRouterTransport` dari `dist/`), lalu pipa deterministik yang sama: presedensi
 * kebutuhan, grounding, merge, kelengkapan, kebijakan. Yang diukur adalah model + prompt +
 * pagar kode bersama-sama — itulah yang dialami pengguna.
 *
 * Respons di-cache per hash (model + pesan) di `.eval-cache/`, jadi menjalankan ulang
 * tanpa perubahan gratis. Hasil disimpan ke `evals/results/` untuk dibandingkan.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(here, '..');
const repoRoot = join(apiRoot, '..', '..');

// ── Argumen ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const tag = option('--tag');
const compareWith = option('--compare');
const useCache = !flag('--no-cache');

// ── Lingkungan: .env di akar repo bila variabelnya belum ada ─────────────────
const envFile = join(repoRoot, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
process.env.NODE_ENV ??= 'development';
for (const required of [
  'OPENROUTER_API_KEY',
  'LLM_MODEL_FAST',
  'LLM_MODEL_BALANCED',
  'LLM_MODEL_STRONG',
]) {
  if (!process.env[required]) {
    console.error(
      `✖ ${required} belum diset — evaluasi memanggil model sungguhan (docs/EVALUATION.md §5).`,
    );
    process.exit(2);
  }
}
// Variabel wajib lain supaya loadEnv() tidak menolak; nilainya tidak dipakai evaluasi.
process.env.DB_HOST ??= '127.0.0.1';
process.env.DB_PORT ??= '3316';
process.env.DB_DATABASE ??= 'snouty';
process.env.DB_USERNAME ??= 'root';
process.env.DB_PASSWORD ??= 'snouty';
process.env.REDIS_URL ??= 'redis://127.0.0.1:6380';
process.env.RABBITMQ_URL ??= 'amqp://guest:guest@127.0.0.1:5673';
process.env.JWT_ACCESS_SECRET ??= 'contoh-rahasia-pengembangan-32-karakter';
process.env.JWT_REFRESH_SECRET ??= 'contoh-rahasia-refresh-32-karakter-lagi';
process.env.POLICY_VERSION ??= 'v0-draft';

// ── Modul dari dist ─────────────────────────────────────────────────────────
let m;
try {
  m = {
    ...(await import('../dist/modules/ai/application/openrouter-ai.service.js')),
    ...(await import('../dist/modules/ai/infrastructure/openrouter-transport.js')),
    ...(await import('../dist/modules/ai/domain/model-routing.js')),
    ...(await import('../dist/modules/context/application/intent-router.js')),
    ...(await import('../dist/modules/context/application/extraction-to-updates.js')),
    ...(await import('../dist/modules/context/domain/context-merger.js')),
    ...(await import('../dist/modules/context/domain/completeness.js')),
    ...(await import('../dist/modules/context/domain/requirement-state.factory.js')),
    ...(await import('../dist/modules/policy/scope.js')),
    ...(await import('../dist/modules/context/domain/technical.js')),
  };
} catch (cause) {
  console.error('✖ `dist` belum ada atau usang. Jalankan dulu: pnpm --filter @snouty/api build');
  console.error(cause.message);
  process.exit(2);
}

// ── Transport ber-cache + perekam biaya ─────────────────────────────────────
const cacheDir = join(apiRoot, '.eval-cache');
mkdirSync(cacheDir, { recursive: true });
const live = new m.OpenRouterTransport();
let cacheHits = 0;
let modelCalls = 0;
const transport = {
  async complete(request) {
    const key = createHash('sha256').update(JSON.stringify(request)).digest('hex');
    const file = join(cacheDir, `${key}.json`);
    if (useCache && existsSync(file)) {
      cacheHits += 1;
      return JSON.parse(readFileSync(file, 'utf8'));
    }
    modelCalls += 1;
    const result = await live.complete(request);
    writeFileSync(file, JSON.stringify(result));
    return result;
  },
};
const calls = [];
const recorder = {
  async record(record) {
    calls.push(record);
  },
};
const ai = new m.OpenRouterAiService(transport, recorder);

// ── Dataset ─────────────────────────────────────────────────────────────────
const dataset = JSON.parse(readFileSync(join(apiRoot, 'evals', 'cases.json'), 'utf8'));
const cases = dataset.cases.filter((c) => !tag || c.tags.includes(tag));
if (cases.length === 0) {
  console.error(`✖ Tidak ada kasus bertanda "${tag}".`);
  process.exit(2);
}

const T0 = '2026-01-01T00:00:00.000Z';
const EXTRACTING = new Set([
  'REQUIREMENT_STATEMENT',
  'REQUIREMENT_MUTATION',
  'CLARIFICATION_ANSWER',
]);

function priorState(prior) {
  const empty = m.emptyRequirementState(T0);
  if (!prior) return empty;
  const updates = Object.entries(prior).map(([path, value]) => ({
    path,
    value,
    source: 'user_stated',
  }));
  return m.withCompleteness(m.mergeRequirement(empty, updates, T0).state);
}

function valueAt(state, path) {
  const [group, field] = path.split('.');
  return state[group]?.[field]?.value ?? null;
}

// ── Menjalankan satu kasus ──────────────────────────────────────────────────
async function runCase(c) {
  const before = calls.length;
  const state = priorState(c.prior);
  const hasExisting = state.completeness.filled > 0;
  const failures = [];
  const observed = {};

  // 1. Intent: model + presedensi kebutuhan (persis IntentRouter).
  const raw = await ai.classifyIntent({ message: c.input, hasExistingRequirements: hasExisting });
  let intent = m.withRequirementPrecedence(c.input, raw);
  if (intent.confidence < m.INTENT_CONFIDENCE_THRESHOLD)
    intent = { ...intent, intent: 'CLARIFICATION_NEEDED' };
  observed.intent = intent.intent;
  observed.rawIntent = raw.intent;
  const intentOk = c.expected.intentOneOf
    ? c.expected.intentOneOf.includes(intent.intent)
    : c.expected.intent === undefined || c.expected.intent === intent.intent;
  if (!intentOk)
    failures.push(
      `intent: ${intent.intent} (model: ${raw.intent}), diharapkan ${c.expected.intent ?? c.expected.intentOneOf.join('|')}`,
    );

  // 2. Ekstraksi + grounding + merge — hanya di jalur yang memang mengekstrak.
  let merged = state;
  const fieldChecks = [];
  const hallucinated = [];
  // Kasus teknis tidak lewat ekstraksi model (pipeline pun tidak), jadi tidak dinilai di sini.
  const shouldExtract = !c.expected.technical && EXTRACTING.has(c.expected.intent ?? intent.intent);
  if (shouldExtract) {
    let extraction = {};
    try {
      extraction = await ai.extract(c.input);
    } catch (error) {
      failures.push(`ekstraksi gagal validasi dua kali: ${error.message}`);
    }
    const updates = m.extractionToUpdates(extraction, c.input);
    merged = m.withCompleteness(m.mergeRequirement(state, updates, T0).state);
    observed.updates = Object.fromEntries(updates.map((u) => [u.path, u.value]));

    for (const [path, expectedValue] of Object.entries(c.expected.requirement ?? {})) {
      const actual = valueAt(merged, path);
      const ok = JSON.stringify(actual) === JSON.stringify(expectedValue);
      fieldChecks.push({ path, ok });
      if (!ok)
        failures.push(
          `field ${path}: ${JSON.stringify(actual)}, diharapkan ${JSON.stringify(expectedValue)}`,
        );
    }
    for (const path of c.expected.notFilled ?? []) {
      const touched = updates.some((u) => u.path === path);
      if (touched) {
        hallucinated.push(path);
        failures.push(
          `HALUSINASI ${path}: ${JSON.stringify(observed.updates[path])} padahal tidak disebut`,
        );
      }
    }
    if (c.expected.missing) {
      const actualMissing = [...merged.missingInformation].sort();
      const expectedMissing = [...c.expected.missing].sort();
      observed.missing = actualMissing;
      if (JSON.stringify(actualMissing) !== JSON.stringify(expectedMissing)) {
        failures.push(
          `field kurang: ${actualMissing.join(',') || '-'}, diharapkan ${expectedMissing.join(',') || '-'}`,
        );
      }
    }
  }

  // 3. Kebijakan atas state ter-merge (Policy 1 dari intent, Policy 5 dari state).
  let policy;
  if (c.expected.policy !== undefined) {
    // Urutan persis pipeline: pesaing → guna di luar cakupan (dari pesan) → cakupan dari state.
    const useCase = m.useCasePolicy(c.input);
    const outcome =
      intent.intent === 'COMPETITOR_QUESTION'
        ? m.competitorPolicy()
        : useCase.kind === 'policy'
          ? useCase
          : m.scopePolicy({
              buildingType: merged.building.type.value,
              installationType: merged.water.installationType.value,
              floors: merged.building.floors.value,
            });
    policy = outcome.kind === 'policy' ? outcome.code : 'ALLOWED';
    observed.policy = policy;
    if (policy !== c.expected.policy)
      failures.push(`kebijakan: ${policy}, diharapkan ${c.expected.policy}`);
  }

  // 4. Parse pertanyaan produk (hanya PRODUCT_LOOKUP).
  let productOk = null;
  if (c.expected.product && intent.intent === 'PRODUCT_LOOKUP') {
    let parsed = null;
    try {
      parsed = await ai.parseProductQuestion(c.input);
    } catch (error) {
      failures.push(`parse produk gagal: ${error.message}`);
    }
    observed.product = parsed;
    productOk = parsed !== null;
    for (const [key, expectedValue] of Object.entries(c.expected.product)) {
      const actual = parsed?.[key] ?? null;
      const ok =
        key === 'size'
          ? String(actual ?? '').replace(/\s/g, '') === String(expectedValue)
          : actual === expectedValue;
      if (!ok) {
        productOk = false;
        failures.push(
          `produk.${key}: ${JSON.stringify(actual)}, diharapkan ${JSON.stringify(expectedValue)}`,
        );
      }
    }
  }

  // 4b. Kasus teknis (Fase 14): klasifikasi + ekstraksi fakta tersurat — deterministik, nol model.
  let technicalOk = null;
  if (c.expected.technical) {
    const caseId = m.detectTechnicalCase(c.input, state);
    technicalOk = caseId === c.expected.technical.caseId;
    if (!technicalOk)
      failures.push(`kasus teknis: ${caseId}, diharapkan ${c.expected.technical.caseId}`);
    if (caseId) {
      const params = m.applyTechnicalFacts(state, caseId, c.input).state.useCase.parameters;
      observed.technical = Object.fromEntries(
        Object.entries(params).map(([key, p]) => [key, p.value]),
      );
      for (const [key, expectedValue] of Object.entries(c.expected.technical.parameters ?? {})) {
        const actual = params[key]?.value ?? null;
        if (JSON.stringify(actual) !== JSON.stringify(expectedValue)) {
          technicalOk = false;
          failures.push(
            `teknis.${key}: ${JSON.stringify(actual)}, diharapkan ${JSON.stringify(expectedValue)}`,
          );
        }
      }
      for (const key of c.expected.technical.notFilled ?? []) {
        if (params[key] !== undefined) {
          technicalOk = false;
          failures.push(
            `teknis.${key} terisi ${JSON.stringify(params[key].value)} padahal tidak disebut`,
          );
        }
      }
    }
  }

  // 5. Kelolosan skema pada percobaan pertama & kesesuaian routing (deterministik).
  const myCalls = calls.slice(before);
  const retries = myCalls.filter((r) => r.task === 'extraction_retry').length;
  const routingOk = myCalls.every((r) => r.tier === m.tierForTask(r.task));

  return {
    id: c.id,
    tags: c.tags,
    ok: failures.length === 0,
    failures,
    observed,
    metrics: {
      intentOk,
      fieldChecks,
      hallucinated,
      missingOk: c.expected.missing ? !failures.some((f) => f.startsWith('field kurang')) : null,
      policyOk: c.expected.policy !== undefined ? policy === c.expected.policy : null,
      productOk,
      technicalOk,
      firstTryOk: retries === 0,
      routingOk,
      calls: myCalls.length,
      retries,
      promptTokens: myCalls.reduce((n, r) => n + (r.promptTokens ?? 0), 0),
      completionTokens: myCalls.reduce((n, r) => n + (r.completionTokens ?? 0), 0),
      costUsd: myCalls.reduce((n, r) => n + (r.costUsd ?? 0), 0),
      latencyMs: myCalls.reduce((n, r) => n + (r.latencyMs ?? 0), 0),
    },
  };
}

// ── Jalankan ────────────────────────────────────────────────────────────────
const model = {
  fast: process.env.LLM_MODEL_FAST,
  balanced: process.env.LLM_MODEL_BALANCED,
  strong: process.env.LLM_MODEL_STRONG,
  baseUrl: process.env.OPENROUTER_BASE_URL,
};
console.log(
  `\nEvaluasi AI → ${model.baseUrl} · fast=${model.fast} balanced=${model.balanced} strong=${model.strong}`,
);
console.log(
  `${cases.length} kasus${tag ? ` (tag: ${tag})` : ''}${useCache ? '' : ' · tanpa cache'}\n`,
);

const results = [];
for (const c of cases) {
  const started = Date.now();
  const r = await runCase(c);
  results.push(r);
  console.log(`${r.ok ? '✓' : '✖'} ${c.id} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  for (const f of r.failures) console.log(`    ${f}`);
}

// ── Metrik (docs/EVALUATION.md §3) ──────────────────────────────────────────
const pct = (num, den) => (den === 0 ? null : Math.round((num / den) * 1000) / 10);
const intentCases = results.filter((r) => r.metrics.intentOk !== undefined);
const fieldChecks = results.flatMap((r) => r.metrics.fieldChecks);
const hallucinationCases = results.filter(
  (r) => cases.find((c) => c.id === r.id).expected.notFilled,
);
const missingCases = results.filter((r) => r.metrics.missingOk !== null);
const policyCases = results.filter((r) => r.metrics.policyOk !== null);
const productCases = results.filter((r) => r.metrics.productOk !== null);
const technicalCases = results.filter((r) => r.metrics.technicalOk !== null);
const extractCases = results.filter((r) => r.metrics.calls > 0);

const metrics = {
  intentAccuracy: pct(intentCases.filter((r) => r.metrics.intentOk).length, intentCases.length),
  fieldAccuracy: pct(fieldChecks.filter((f) => f.ok).length, fieldChecks.length),
  hallucinationRate: pct(
    hallucinationCases.filter((r) => r.metrics.hallucinated.length > 0).length,
    hallucinationCases.length,
  ),
  missingPrecision: pct(
    missingCases.filter((r) => r.metrics.missingOk).length,
    missingCases.length,
  ),
  policyMatch: pct(policyCases.filter((r) => r.metrics.policyOk).length, policyCases.length),
  productParse: pct(productCases.filter((r) => r.metrics.productOk).length, productCases.length),
  technicalMatch: pct(
    technicalCases.filter((r) => r.metrics.technicalOk).length,
    technicalCases.length,
  ),
  schemaFirstTry: pct(extractCases.filter((r) => r.metrics.firstTryOk).length, extractCases.length),
  routingMatch: pct(results.filter((r) => r.metrics.routingOk).length, results.length),
};
const THRESHOLDS = {
  intentAccuracy: ['>=', 95],
  fieldAccuracy: ['>=', 90],
  hallucinationRate: ['==', 0],
  missingPrecision: ['>=', 90],
  policyMatch: ['==', 100],
  schemaFirstTry: ['>=', 95],
  routingMatch: ['>=', 90],
  // Deterministik (tanpa model) — tidak ada alasan meleset.
  technicalMatch: ['==', 100],
};
const LABEL = {
  intentAccuracy: 'Akurasi intent',
  fieldAccuracy: 'Akurasi per field',
  hallucinationRate: 'Laju halusinasi',
  missingPrecision: 'Presisi field kurang',
  policyMatch: 'Kesesuaian kebijakan',
  productParse: 'Parse pertanyaan produk',
  technicalMatch: 'Kasus teknis (klasifikasi + fakta)',
  schemaFirstTry: 'Kelolosan skema percobaan pertama',
  routingMatch: 'Kesesuaian routing',
};

const perField = {};
for (const f of fieldChecks) {
  perField[f.path] ??= { ok: 0, total: 0 };
  perField[f.path].total += 1;
  if (f.ok) perField[f.path].ok += 1;
}

const totals = results.reduce(
  (t, r) => ({
    calls: t.calls + r.metrics.calls,
    promptTokens: t.promptTokens + r.metrics.promptTokens,
    completionTokens: t.completionTokens + r.metrics.completionTokens,
    costUsd: t.costUsd + r.metrics.costUsd,
    latencyMs: t.latencyMs + r.metrics.latencyMs,
  }),
  { calls: 0, promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: 0 },
);

let failedThresholds = 0;
console.log('\nMetrik:');
for (const [key, value] of Object.entries(metrics)) {
  const threshold = THRESHOLDS[key];
  let verdict = '';
  if (threshold && value !== null) {
    const [op, limit] = threshold;
    const pass = op === '>=' ? value >= limit : value === limit;
    if (!pass) failedThresholds += 1;
    verdict = pass ? '  ✓' : `  ✖ (ambang ${op} ${limit}%)`;
  }
  console.log(
    `  ${LABEL[key].padEnd(36)} ${value === null ? '  n/a' : `${String(value).padStart(5)}%`}${verdict}`,
  );
}
console.log('\nPer field:');
for (const [path, v] of Object.entries(perField)) {
  console.log(`  ${path.padEnd(28)} ${v.ok}/${v.total}`);
}
console.log(
  `\nBiaya: ${totals.calls} panggilan (${modelCalls} ke model, ${cacheHits} dari cache) · ${totals.promptTokens}+${totals.completionTokens} token · $${totals.costUsd.toFixed(4)} · ${(totals.latencyMs / 1000).toFixed(0)}s latensi model`,
);

// ── Simpan & bandingkan ─────────────────────────────────────────────────────
const resultsDir = join(apiRoot, 'evals', 'results');
mkdirSync(resultsDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const safeModel = String(model.balanced).replace(/[^a-z0-9.-]/gi, '_');
const outFile = join(resultsDir, `${stamp}-${safeModel}${tag ? `-${tag}` : ''}.json`);
writeFileSync(
  outFile,
  JSON.stringify(
    {
      ranAt: new Date().toISOString(),
      model,
      tag: tag ?? null,
      metrics,
      perField,
      totals,
      results,
    },
    null,
    2,
  ),
);
console.log(`Hasil: ${outFile}`);

if (compareWith) {
  const baseline = JSON.parse(readFileSync(compareWith, 'utf8'));
  console.log(`\nDibandingkan dengan ${compareWith} (${baseline.model?.balanced}):`);
  let regressions = 0;
  for (const [key, value] of Object.entries(metrics)) {
    const was = baseline.metrics?.[key];
    if (value === null || was === null || was === undefined) continue;
    const delta = value - was;
    const worse = key === 'hallucinationRate' ? delta > 2 : delta < -2;
    if (worse) regressions += 1;
    console.log(
      `  ${LABEL[key].padEnd(36)} ${String(was).padStart(5)}% → ${String(value).padStart(5)}%${worse ? '  ✖ regresi' : ''}`,
    );
  }
  if (regressions > 0) failedThresholds += regressions;
}

const failedCases = results.filter((r) => !r.ok).length;
console.log(
  `\n${results.length - failedCases}/${results.length} kasus lolos · ${failedThresholds} ambang/regresi gagal\n`,
);
process.exit(failedThresholds === 0 ? 0 : 1);
