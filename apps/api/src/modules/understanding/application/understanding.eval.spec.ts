/**
 * Evaluasi pemahaman terhadap golden dataset `evals/understanding-cases.json` — dengan penyandi
 * SUNGGUHAN (Ollama `bge-m3` lokal), bukan penyandi cadangan. Ini pengukur "apakah contoh +
 * ambang masih memahami pengguna kita", bukan tes kebenaran kode; keluarannya berubah saat data
 * contoh berubah tanpa satu baris kode pun berubah (docs/EVALUATION.md).
 *
 * Dijalankan hanya bila `UNDERSTANDING_EVAL=1` (butuh Ollama di `UNDERSTANDING_EVAL_URL`, baku
 * `http://127.0.0.1:11434/v1`, model `UNDERSTANDING_EVAL_MODEL`, baku `bge-m3`). Di CI tanpa
 * Ollama ia dilewati, bukan gagal.
 *
 *   UNDERSTANDING_EVAL=1 pnpm --filter @snouty/api test -- understanding.eval
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TextEncoder } from '../../ai/domain/text-encoder.port.js';
import { EntityLexicon } from '../domain/vocabulary.js';
import { findDataDir, loadUnderstandingData } from '../infrastructure/catalog-files.js';
import { UnderstandingService } from './understanding.service.js';
import type { MessageUnderstanding } from './message-understanding.js';

interface GoldenCase {
  readonly text: string;
  readonly intent?: string | null;
  readonly depth?: string;
  readonly format?: string;
  readonly companyTopic?: string;
  readonly productAspect?: string;
  readonly mutationOp?: string | null;
  readonly topics?: readonly string[];
  /** Topik yang dikenali harus PERSIS `topics` — tidak ada topik lain yang ikut terseret. */
  readonly topicsOnly?: boolean;
  readonly families?: readonly string[];
  readonly source?: string;
}

const ENABLED = process.env['UNDERSTANDING_EVAL'] === '1';
const BASE_URL = process.env['UNDERSTANDING_EVAL_URL'] ?? 'http://127.0.0.1:11434/v1';
const MODEL = process.env['UNDERSTANDING_EVAL_MODEL'] ?? 'bge-m3';
/** Akurasi intent minimum (docs/EVALUATION.md: ≥ 95% untuk intent). */
const MIN_INTENT_ACCURACY = 0.95;

class OllamaEncoder implements TextEncoder {
  readonly id = `eval:${MODEL}`;
  async encode(texts: readonly string[]): Promise<readonly Float32Array[]> {
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += 32) {
      const batch = texts.slice(i, i + 32);
      const response = await fetch(`${BASE_URL}/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODEL, input: batch }),
      });
      if (!response.ok) throw new Error(`embeddings ${response.status}`);
      const body = (await response.json()) as { data: { index: number; embedding: number[] }[] };
      for (const row of [...body.data].sort((a, b) => a.index - b.index)) {
        const v = Float32Array.from(row.embedding);
        let sum = 0;
        for (const x of v) sum += x * x;
        const len = Math.sqrt(sum);
        for (let k = 0; k < v.length; k += 1) v[k] = v[k]! / len;
        out.push(v);
      }
    }
    return out;
  }
}

describe.skipIf(!ENABLED)('evaluasi pemahaman terhadap golden dataset (Ollama bge-m3)', () => {
  it('mengenali intent, kedalaman, format, topik, dan aspek seperti yang diharapkan', async () => {
    const dir = findDataDir();
    if (!dir) throw new Error('data/understanding tidak ditemukan');
    const data = loadUnderstandingData(dir);
    const service = new UnderstandingService(
      data.catalogs,
      new EntityLexicon(data.vocabulary),
      new OllamaEncoder(),
    );
    await service.whenReady();
    expect(service.available).toBe(true);

    // Sonde: `UNDERSTANDING_PROBE="kalimat satu|kalimat dua"` mencetak pemahaman lengkap tiap
    // kalimat — untuk menyelidiki kalimat produksi yang dikenali keliru sebelum menambah contoh.
    const probed: string[] = [];
    for (const text of (process.env['UNDERSTANDING_PROBE'] ?? '').split('|').filter(Boolean)) {
      const u = await service.understand(text);
      const { intentRanking, ...rest } = u;
      const top = intentRanking.slice(0, 3).map((r) => `${r.label}=${r.score.toFixed(3)}`);
      probed.push(JSON.stringify({ ...rest, top }));
    }

    const golden = JSON.parse(
      readFileSync(join(process.cwd(), 'evals', 'understanding-cases.json'), 'utf8'),
    ) as { cases: GoldenCase[] };

    const failures: string[] = [];
    let intentChecked = 0;
    let intentCorrect = 0;
    for (const c of golden.cases) {
      const u = await service.understand(c.text);
      const problems = compare(c, u);
      if (c.intent !== undefined) {
        intentChecked += 1;
        if ((u.intent?.label ?? null) === c.intent) intentCorrect += 1;
      }
      if (problems.length > 0) {
        const top = u.intentRanking
          .slice(0, 3)
          .map((r) => `${r.label}=${r.score.toFixed(3)} ("${r.example}")`)
          .join(', ');
        failures.push(`"${c.text}"\n    ${problems.join('\n    ')}\n    peringkat: ${top}`);
      }
    }

    const accuracy = intentChecked === 0 ? 1 : intentCorrect / intentChecked;
    const report = [
      ...probed,
      `intent: ${intentCorrect}/${intentChecked} (${(accuracy * 100).toFixed(1)}%)`,
      ...failures,
    ].join('\n');
    // Laporan selalu dicetak: saat lulus pun angkanya berguna untuk menala ambang.
    // eslint-disable-next-line no-console -- laporan evaluasi memang untuk dibaca manusia
    console.log(report);
    const reportPath = process.env['UNDERSTANDING_EVAL_REPORT'];
    if (reportPath) writeFileSync(reportPath, report);
    expect(accuracy, report).toBeGreaterThanOrEqual(MIN_INTENT_ACCURACY);
    expect(
      failures.filter((f) => f.includes('[wajib]')),
      report,
    ).toEqual([]);
  }, 600_000);
});

function compare(c: GoldenCase, u: MessageUnderstanding): string[] {
  const problems: string[] = [];
  const got = u.intent?.label ?? null;
  if (c.intent !== undefined && got !== c.intent) {
    problems.push(`intent: diharapkan ${c.intent}, dapat ${got ?? 'ragu'}`);
  }
  if (c.depth !== undefined && u.depth !== c.depth) {
    problems.push(`depth: diharapkan ${c.depth}, dapat ${u.depth ?? 'null'}`);
  }
  if (c.format !== undefined && u.format !== c.format) {
    problems.push(`format: diharapkan ${c.format}, dapat ${u.format ?? 'null'}`);
  }
  if (c.mutationOp !== undefined && u.mutationOp !== c.mutationOp) {
    problems.push(`mutationOp: diharapkan ${c.mutationOp}, dapat ${u.mutationOp ?? 'null'}`);
  }
  if (c.companyTopic !== undefined && u.companyTopic !== c.companyTopic) {
    problems.push(`companyTopic: diharapkan ${c.companyTopic}, dapat ${u.companyTopic ?? 'null'}`);
  }
  if (c.productAspect !== undefined && u.productAspect !== c.productAspect) {
    problems.push(
      `productAspect: diharapkan ${c.productAspect}, dapat ${u.productAspect ?? 'null'}`,
    );
  }
  // `topics: []` berarti TIDAK BOLEH ada topik yang dikenali — kalimat produk/perusahaan biasa
  // tidak boleh menyeret paragraf konsep yang tidak ditanya.
  if (c.topics !== undefined && c.topics.length === 0 && u.knowledgeTopics.length > 0) {
    problems.push(`topics: diharapkan tidak ada, dapat ${u.knowledgeTopics.join(', ')}`);
  }
  if (c.topicsOnly && c.topics !== undefined) {
    const extra = u.knowledgeTopics.filter((t) => !c.topics!.includes(t));
    if (extra.length > 0) problems.push(`topics: ikut terseret ${extra.join(', ')}`);
  }
  for (const topic of c.topics ?? []) {
    if (!u.knowledgeTopics.includes(topic as never)) {
      problems.push(
        `topics: ${topic} tidak dikenali (dapat ${u.knowledgeTopics.join(', ') || '-'})`,
      );
    }
  }
  // Kosakata bersifat deterministik: salah di sini adalah cacat data, bukan soal ambang.
  if (c.families !== undefined && JSON.stringify([...u.families]) !== JSON.stringify(c.families)) {
    problems.push(
      `[wajib] families: diharapkan ${c.families.join(',')}, dapat ${u.families.join(',')}`,
    );
  }
  return problems;
}
