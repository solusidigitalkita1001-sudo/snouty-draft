/**
 * Alat diagnosis, bukan tes: mencetak bagaimana kalimat-kalimat dipahami (intent, aspek, topik, kasus)
 * dengan penyandi SUNGGUHAN (Ollama `bge-m3` lokal). Dipakai saat audit live menemukan jawaban yang
 * salah arah — penyebabnya hampir selalu contoh data, dan alat ini menunjukkan contoh mana yang menang.
 * Berjalan hanya bila `PROBE` diisi (satu kalimat per baris); hasil ditulis ke `PROBE_OUT`.
 *
 *   PROBE=kalimat.txt PROBE_OUT=hasil.txt npx vitest run understanding.probe
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { it } from 'vitest';
import type { TextEncoder } from '../../ai/domain/text-encoder.port.js';
import { EntityLexicon } from '../domain/vocabulary.js';
import { findDataDir, loadUnderstandingData } from '../infrastructure/catalog-files.js';
import { UnderstandingService } from './understanding.service.js';

const BASE_URL = process.env['UNDERSTANDING_EVAL_URL'] ?? 'http://127.0.0.1:11434/v1';
const MODEL = process.env['UNDERSTANDING_EVAL_MODEL'] ?? 'bge-m3';

class OllamaEncoder implements TextEncoder {
  readonly id = `probe:${MODEL}`;
  async encode(texts: readonly string[]): Promise<readonly Float32Array[]> {
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += 32) {
      const r = await fetch(`${BASE_URL}/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODEL, input: texts.slice(i, i + 32) }),
      });
      const body = (await r.json()) as { data: { index: number; embedding: number[] }[] };
      for (const row of [...body.data].sort((a, b) => a.index - b.index)) {
        const v = Float32Array.from(row.embedding);
        let s = 0;
        for (const x of v) s += x * x;
        const l = Math.sqrt(s);
        for (let k = 0; k < v.length; k++) v[k] = v[k]! / l;
        out.push(v);
      }
    }
    return out;
  }
}

const top = (ranking: readonly { label: string; score: number }[] | undefined) =>
  JSON.stringify((ranking ?? []).slice(0, 3).map((r) => `${r.label}=${r.score.toFixed(3)}`));

it.skipIf(!process.env['PROBE'])(
  'probe pemahaman',
  async () => {
    const data = loadUnderstandingData(findDataDir()!);
    const service = new UnderstandingService(
      data.catalogs,
      new EntityLexicon(data.vocabulary),
      new OllamaEncoder(),
    );
    await service.whenReady();
    const lines: string[] = [];
    for (const t of readFileSync(process.env['PROBE']!, 'utf8').split(/\r?\n/).filter(Boolean)) {
      const u = await service.understand(t);
      lines.push(
        [
          t.padEnd(50),
          u.intent?.label ?? '-',
          top(u.intentRanking),
          u.productAspect ?? '-',
          JSON.stringify(u.knowledgeTopics),
          top(u.topicRanking),
          u.useCase ?? '-',
          JSON.stringify(u.families),
          `req=${u.mentionsRequirement}`,
        ].join(' | '),
      );
    }
    appendFileSync(process.env['PROBE_OUT'] ?? 'probe-out.txt', lines.join('\n') + '\n');
  },
  600_000,
);
