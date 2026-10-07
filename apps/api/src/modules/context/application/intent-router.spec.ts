/**
 * P4-08a — intent router: mutasi memperbarui state, pertanyaan tidak (§9 #10);
 * ragu → bertanya.
 */
import { describe, expect, it } from 'vitest';
import type { AiService, IntentInput } from '../../ai/domain/ai.port.js';
import type { Extraction, IntentClassification } from '../../ai/domain/extraction-schema.js';
import { INTENT_CONFIDENCE_THRESHOLD, IntentRouter } from './intent-router.js';

function aiReturning(result: IntentClassification): AiService {
  return {
    classifyIntent: (_input: IntentInput) => Promise.resolve(result),
    extract: () => Promise.resolve({} as Extraction),
    titleFor: () => Promise.resolve(''),
    parseProductQuestion: () => Promise.resolve({ productQuery: null, aspect: null, size: null }),
    // Jalur prosa tidak dipakai di router intent; fake-nya cukup menolak.
    writeProse: () => Promise.resolve(null),
  };
}

const router = (result: IntentClassification) => new IntentRouter(aiReturning(result));

describe('IntentRouter — presedensi kebutuhan (intent sadar konteks)', () => {
  it('"lebih bagus PVC atau HDPE buat rumah 2 lantai?" yang dilabeli PRODUCT_LOOKUP → REQUIREMENT_STATEMENT', async () => {
    const d = await router({ intent: 'PRODUCT_LOOKUP', confidence: 0.85 }).route(
      'lebih bagus PVC atau HDPE buat rumah 2 lantai?',
      false,
    );
    expect(d.intent).toBe('REQUIREMENT_STATEMENT');
    expect(d.shouldExtract).toBe(true);
    expect(d.mutatesState).toBe(false);
  });

  it('model ragu tetapi pesannya membawa kebutuhan → tetap diekstrak, bukan ditanya balik', async () => {
    const d = await router({ intent: 'CLARIFICATION_NEEDED', confidence: 0.3 }).route(
      'rumah 2 lantai 3 kamar mandi',
      false,
    );
    expect(d.intent).toBe('REQUIREMENT_STATEMENT');
  });

  it('"rekomendasi produk buat proyek drainase sawah" yang dilabeli PRODUCT_LOOKUP → kebutuhan (lalu kebijakan cakupan)', async () => {
    const d = await router({ intent: 'PRODUCT_LOOKUP', confidence: 0.85 }).route(
      'rekomendasi product buat project drainase sawah',
      false,
    );
    expect(d.intent).toBe('REQUIREMENT_STATEMENT');
    expect(d.shouldExtract).toBe(true);
  });

  it('COMPETITOR_QUESTION tanpa merek pesaing di pesan → PRODUCT_LOOKUP (pertanyaan tentang Pralon sendiri)', async () => {
    const d = await router({ intent: 'COMPETITOR_QUESTION', confidence: 0.9 }).route(
      'gw mau nanya produk pralon itu yang terkenal apa sih?',
      false,
    );
    expect(d.intent).toBe('PRODUCT_LOOKUP');
    const real = await router({ intent: 'COMPETITOR_QUESTION', confidence: 0.9 }).route(
      'lebih bagus Pralon atau Rucika?',
      false,
    );
    expect(real.intent).toBe('COMPETITOR_QUESTION');
  });

  it('subjek PERUSAHAAN aktif (Fase 16): lanjutan "boleh"/"semuanya" tidak memanggil model, tetap perusahaan', async () => {
    const company = {
      kind: 'company',
      entity: 'PT Pralon',
      topic: 'company_profile',
      depth: 'standard',
    } as const;
    let calls = 0;
    const ai = aiReturning({ intent: 'PRODUCT_LOOKUP', confidence: 0.9 });
    ai.classifyIntent = () => {
      calls += 1;
      return Promise.resolve({ intent: 'PRODUCT_LOOKUP', confidence: 0.9 });
    };
    const r = new IntentRouter(ai);
    for (const message of ['boleh', 'data nya secara lengkap dong', 'semuanya, tolong tampilin']) {
      const d = await r.route(message, false, [], company);
      expect(d.intent).toBe('COMPANY_QUESTION');
      expect(d.shouldExtract).toBe(false);
    }
    expect(calls).toBe(0);
    // Pesan yang menyebut Pralon lagi tanpa produk: tetap perusahaan walau model bilang produk.
    const again = await r.route('ceritain lebih jauh tentang pralon', false, [], company);
    expect(again.intent).toBe('COMPANY_QUESTION');
    // TEST E: menyebut produk → pindah ke produk (pergantian topik yang disengaja).
    const product = await r.route('produk HDPE nya gimana?', false, [], company);
    expect(product.intent).toBe('PRODUCT_LOOKUP');
    // Tanpa subjek, "boleh" tidak dilanjutkan ke mana pun — ke model seperti biasa.
    await r.route('boleh', false, [], undefined);
    // Model hanya ditanya untuk "produk HDPE nya gimana?" dan "boleh" tanpa subjek;
    // "tentang pralon" sudah pasti perusahaan di kode.
    expect(calls).toBe(2);
  });

  it('subjek PRODUK aktif: "bikinin tabelnya dong" dilanjutkan sebagai PRODUCT_LOOKUP tanpa model; menyebut bahan baru → model', async () => {
    const product = {
      kind: 'product',
      entity: 'hdpe',
      topic: 'comparison',
      depth: 'standard',
    } as const;
    let calls = 0;
    const ai = aiReturning({ intent: 'PRODUCT_LOOKUP', confidence: 0.9 });
    ai.classifyIntent = () => {
      calls += 1;
      return Promise.resolve({ intent: 'PRODUCT_LOOKUP', confidence: 0.9 });
    };
    const r = new IntentRouter(ai);
    const d = await r.route(
      'bikinin skema perbedaan nya dalam bentuk table dong biar lebih enak dibaca',
      false,
      [],
      product,
    );
    expect(d.intent).toBe('PRODUCT_LOOKUP');
    expect(calls).toBe(0);
    await r.route('bikinin tabel bedanya PVC sama PPR', false, [], product);
    expect(calls).toBe(1);
  });

  it('COMPANY_QUESTION dari model tanpa Pralon/perusahaan di pesan → OUT_OF_SCOPE (sapaan tetap pembuka)', async () => {
    const d = await router({ intent: 'COMPANY_QUESTION', confidence: 0.9 }).route(
      'hi, I want to ask something',
      false,
    );
    expect(d.intent).toBe('OUT_OF_SCOPE');
    const real = await router({ intent: 'COMPANY_QUESTION', confidence: 0.9 }).route(
      'tell me about pralon as a company',
      false,
    );
    expect(real.intent).toBe('COMPANY_QUESTION');
  });

  it('tanpa isyarat kebutuhan, label model dipakai apa adanya', async () => {
    const d = await router({ intent: 'PRODUCT_LOOKUP', confidence: 0.85 }).route(
      'apa bedanya pvc sama hdpe?',
      false,
    );
    expect(d.intent).toBe('PRODUCT_LOOKUP');
  });

  it('jalur cepat (P14-07): pesan pertama berisyarat kebutuhan TIDAK memanggil model', async () => {
    let calls = 0;
    const ai = aiReturning({ intent: 'OUT_OF_SCOPE', confidence: 1 });
    ai.classifyIntent = () => {
      calls += 1;
      return Promise.resolve({ intent: 'OUT_OF_SCOPE', confidence: 1 });
    };
    const d = await new IntentRouter(ai).route('rumah 2 lantai, 3 kamar mandi', false);
    expect(d.intent).toBe('REQUIREMENT_STATEMENT');
    expect(d.shouldExtract).toBe(true);
    expect(calls).toBe(0);
  });

  it('jalur cepat tidak dipakai untuk pertanyaan "kenapa", pesaing, atau bila sudah ada kebutuhan', async () => {
    let calls = 0;
    const ai = aiReturning({ intent: 'EXPLANATION_REQUEST', confidence: 0.9 });
    ai.classifyIntent = () => {
      calls += 1;
      return Promise.resolve({ intent: 'EXPLANATION_REQUEST', confidence: 0.9 });
    };
    const r = new IntentRouter(ai);
    expect((await r.route('kenapa rumah 2 lantai butuh pipa 1 inci?', false)).intent).toBe(
      'EXPLANATION_REQUEST',
    );
    await r.route('rumah 2 lantai pakai Rucika bagus nggak?', false);
    await r.route('rumah 2 lantai, 3 kamar mandi', true);
    expect(calls).toBe(3);
  });

  it('giliran terakhir diteruskan ke klasifikasi model', async () => {
    const seen: IntentInput[] = [];
    const ai = aiReturning({ intent: 'REQUIREMENT_STATEMENT', confidence: 0.9 });
    ai.classifyIntent = (input) => {
      seen.push(input);
      return Promise.resolve({ intent: 'REQUIREMENT_STATEMENT', confidence: 0.9 });
    };
    await new IntentRouter(ai).route('yang mana?', false, [{ role: 'user', text: 'hai' }]);
    expect(seen[0]?.recentTurns).toEqual([{ role: 'user', text: 'hai' }]);
  });
});

describe('IntentRouter', () => {
  it('REQUIREMENT_MUTATION mengekstrak dan memutasi state', async () => {
    const d = await router({ intent: 'REQUIREMENT_MUTATION', confidence: 0.9 }).route(
      'tambah 1 kamar mandi',
      true,
    );
    expect(d.shouldExtract).toBe(true);
    expect(d.mutatesState).toBe(true);
  });

  it('EXPLANATION_REQUEST tidak mengekstrak dan tidak memutasi', async () => {
    const d = await router({ intent: 'EXPLANATION_REQUEST', confidence: 0.95 }).route(
      'kenapa ukuran ini?',
      true,
    );
    expect(d.shouldExtract).toBe(false);
    expect(d.mutatesState).toBe(false);
  });

  it('PRODUCT_LOOKUP tidak mengekstrak kebutuhan (dijawab query MySQL)', async () => {
    const d = await router({ intent: 'PRODUCT_LOOKUP', confidence: 0.9 }).route(
      'ada ukuran 3/4 inch?',
      true,
    );
    expect(d.shouldExtract).toBe(false);
    expect(d.mutatesState).toBe(false);
  });

  it('REQUIREMENT_STATEMENT mengekstrak tetapi tidak dihitung "mutasi" (pernyataan awal)', async () => {
    const d = await router({ intent: 'REQUIREMENT_STATEMENT', confidence: 0.8 }).route(
      'rumah 2 lantai',
      false,
    );
    expect(d.shouldExtract).toBe(true);
    expect(d.mutatesState).toBe(false);
  });

  it('CLARIFICATION_ANSWER mengekstrak dan memutasi', async () => {
    const d = await router({ intent: 'CLARIFICATION_ANSWER', confidence: 0.85 }).route(
      'toren atap',
      true,
    );
    expect(d.shouldExtract).toBe(true);
    expect(d.mutatesState).toBe(true);
  });

  it('keyakinan di bawah ambang → bertanya, bukan menebak', async () => {
    const low = INTENT_CONFIDENCE_THRESHOLD - 0.01;
    const d = await router({ intent: 'REQUIREMENT_MUTATION', confidence: low }).route(
      'mungkin tambah?',
      true,
    );
    expect(d.intent).toBe('CLARIFICATION_NEEDED');
    expect(d.shouldExtract).toBe(false);
    expect(d.mutatesState).toBe(false);
  });
});
