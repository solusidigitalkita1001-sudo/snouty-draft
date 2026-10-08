/**
 * P4-08a — intent router: mutasi memperbarui state, pertanyaan tidak (§9 #10);
 * ragu → bertanya.
 *
 * Sejak P16-11 router membaca HASIL PEMAHAMAN (label dari contoh + kosakata), bukan teks:
 * tes memberi label halus yang akan dihasilkan penyandi (`understood`), dan yang diuji adalah
 * aturan bisnisnya — presedensi, pagar, subjek, kapan model generatif masih ditanya.
 */
import { describe, expect, it } from 'vitest';
import type { AiService, IntentInput } from '../../ai/domain/ai.port.js';
import type { Extraction, IntentClassification } from '../../ai/domain/extraction-schema.js';
import { understood } from '../../understanding/testing/understood.js';
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

/** Model yang menghitung berapa kali ia ditanya. */
function countingAi(result: IntentClassification): { ai: AiService; calls: () => number } {
  let calls = 0;
  const ai = aiReturning(result);
  ai.classifyIntent = () => {
    calls += 1;
    return Promise.resolve(result);
  };
  return { ai, calls: () => calls };
}

describe('IntentRouter — presedensi kebutuhan (intent sadar konteks)', () => {
  it('"lebih bagus PVC atau HDPE buat rumah 2 lantai?" (nasihat + kebutuhan) → REQUIREMENT_STATEMENT', async () => {
    const d = await router({ intent: 'PRODUCT_LOOKUP', confidence: 0.85 }).route(
      understood('lebih bagus PVC atau HDPE buat rumah 2 lantai?', { intent: 'advice_request' }),
      false,
    );
    expect(d.intent).toBe('REQUIREMENT_STATEMENT');
    expect(d.shouldExtract).toBe(true);
    expect(d.mutatesState).toBe(false);
  });

  it('model ragu tetapi pesannya membawa kebutuhan → tetap diekstrak, bukan ditanya balik', async () => {
    // Pemahaman tidak mengenali bentuknya (null) → model ditanya; jawabannya ragu, tetapi
    // "rumah", "lantai", "kamar mandi" adalah hal-hal kebutuhan.
    const d = await router({ intent: 'CLARIFICATION_NEEDED', confidence: 0.3 }).route(
      understood('rumah 2 lantai 3 kamar mandi', { intent: null }),
      true,
    );
    expect(d.intent).toBe('REQUIREMENT_STATEMENT');
  });

  it('"rekomendasi produk buat proyek drainase sawah" → kebutuhan (lalu kebijakan cakupan)', async () => {
    const d = await router({ intent: 'PRODUCT_LOOKUP', confidence: 0.85 }).route(
      understood('rekomendasi product buat project drainase sawah', { intent: 'advice_request' }),
      false,
    );
    expect(d.intent).toBe('REQUIREMENT_STATEMENT');
    expect(d.shouldExtract).toBe(true);
  });

  it('label pesaing tanpa merek pesaing di pesan → PRODUCT_LOOKUP (pertanyaan tentang Pralon sendiri)', async () => {
    // Dari pemahaman maupun dari model: Policy 1 hanya untuk pesaing yang benar-benar disebut.
    const d = await router({ intent: 'COMPETITOR_QUESTION', confidence: 0.9 }).route(
      understood('gw mau nanya produk pralon itu yang terkenal apa sih?', {
        intent: 'competitor_question',
      }),
      false,
    );
    expect(d.intent).toBe('PRODUCT_LOOKUP');
    const fromModel = await router({ intent: 'COMPETITOR_QUESTION', confidence: 0.9 }).route(
      understood('gw mau nanya produk pralon itu yang terkenal apa sih?', { intent: null }),
      false,
    );
    expect(fromModel.intent).toBe('PRODUCT_LOOKUP');
    const real = await router({ intent: 'COMPETITOR_QUESTION', confidence: 0.9 }).route(
      understood('lebih bagus Pralon atau Rucika?', { intent: 'competitor_question' }),
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
    const { ai, calls } = countingAi({ intent: 'PRODUCT_LOOKUP', confidence: 0.9 });
    const r = new IntentRouter(ai);
    const followUps = [
      understood('boleh', { intent: 'follow_up_continue' }),
      understood('data nya secara lengkap dong', { intent: 'follow_up_more' }),
      understood('semuanya, tolong tampilin', { intent: 'follow_up_more' }),
    ];
    for (const u of followUps) {
      const d = await r.route(u, false, [], company);
      expect(d.intent).toBe('COMPANY_QUESTION');
      expect(d.shouldExtract).toBe(false);
    }
    expect(calls()).toBe(0);
    // Pesan yang menyebut Pralon lagi tanpa produk, dan pemahaman ragu: model bilang produk,
    // presedensi subjek tetap perusahaan.
    const again = await r.route(
      understood('ceritain lebih jauh tentang pralon', { intent: null }),
      false,
      [],
      company,
    );
    expect(again.intent).toBe('COMPANY_QUESTION');
    expect(calls()).toBe(1);
    // TEST E: menyebut produk → pindah ke produk (pergantian topik yang disengaja). Bentuknya
    // dikenali dari contoh (product_concept) — diputuskan di kode, model tidak ditanya.
    const product = await r.route(
      understood('produk HDPE nya gimana?', { intent: 'product_concept' }),
      false,
      [],
      company,
    );
    expect(product.intent).toBe('PRODUCT_LOOKUP');
    // Tanpa subjek, "boleh" tidak punya apa pun untuk dilanjutkan: pembuka, tanpa model.
    const bare = await r.route(understood('boleh', { intent: 'follow_up_continue' }), false, []);
    expect(bare.intent).toBe('OUT_OF_SCOPE');
    // Model hanya ditanya sekali: untuk "ceritain lebih jauh tentang pralon" yang tidak dikenali.
    expect(calls()).toBe(1);
  });

  it('subjek PRODUK aktif: "bikinin tabelnya dong" dilanjutkan sebagai PRODUCT_LOOKUP tanpa model; menyebut bahan baru → pertanyaan produk baru', async () => {
    const product = {
      kind: 'product',
      entity: 'hdpe',
      topic: 'comparison',
      depth: 'standard',
    } as const;
    const { ai, calls } = countingAi({ intent: 'PRODUCT_LOOKUP', confidence: 0.9 });
    const r = new IntentRouter(ai);
    const d = await r.route(
      understood('bikinin skema perbedaan nya dalam bentuk table dong biar lebih enak dibaca', {
        intent: 'follow_up_reformat',
        format: 'table',
      }),
      false,
      [],
      product,
    );
    expect(d.intent).toBe('PRODUCT_LOOKUP');
    expect(calls()).toBe(0);
    // Menyebut PVC dan PPR: bukan lanjutan subjek HDPE, melainkan perbandingan baru — dikenali
    // dari contoh, jadi model pun tidak ditanya (dulu: ke model).
    const fresh = await r.route(
      understood('bikinin tabel bedanya PVC sama PPR', {
        intent: 'product_comparison',
        format: 'table',
      }),
      false,
      [],
      product,
    );
    expect(fresh.intent).toBe('PRODUCT_LOOKUP');
    expect(calls()).toBe(0);
  });

  it('COMPANY_QUESTION dari model tanpa Pralon/perusahaan di pesan → OUT_OF_SCOPE (sapaan tetap pembuka)', async () => {
    const d = await router({ intent: 'COMPANY_QUESTION', confidence: 0.9 }).route(
      understood('hi, I want to ask something', { intent: null }),
      false,
    );
    expect(d.intent).toBe('OUT_OF_SCOPE');
    const real = await router({ intent: 'COMPANY_QUESTION', confidence: 0.9 }).route(
      understood('tell me about pralon as a company', { intent: null }),
      false,
    );
    expect(real.intent).toBe('COMPANY_QUESTION');
  });

  it('pertanyaan perusahaan yang dikenali: pasti di kode; "pabrik Pralon di mana?" tetap perusahaan walau "pabrik" kata kebutuhan', async () => {
    const { ai, calls } = countingAi({ intent: 'PRODUCT_LOOKUP', confidence: 0.9 });
    const r = new IntentRouter(ai);
    expect(
      (await r.route(understood('pralon itu apa?', { intent: 'company_question' }), false)).intent,
    ).toBe('COMPANY_QUESTION');
    expect(
      (await r.route(understood('pabrik pralon di mana?', { intent: 'company_question' }), false))
        .intent,
    ).toBe('COMPANY_QUESTION');
    expect(calls()).toBe(0);
    // Bentuk perusahaan tanpa menyebut Pralon tetapi membawa kebutuhan bangunan → kebutuhan.
    const need = await r.route(
      understood('perusahaan mana yang cocok buat rumah 2 lantai saya?', {
        intent: 'company_question',
      }),
      false,
    );
    expect(need.intent).toBe('REQUIREMENT_STATEMENT');
  });

  it('subjek PRODUK: "yang mana buat kamar mandi?" adalah lanjutan pilihan — tanpa model, walau menyebut tempat pakai', async () => {
    const product = {
      kind: 'product',
      entity: 'pvc d dan pvc aw',
      topic: 'comparison',
      depth: 'standard',
    } as const;
    const { ai, calls } = countingAi({ intent: 'REQUIREMENT_STATEMENT', confidence: 0.9 });
    const d = await new IntentRouter(ai).route(
      understood('yang mana buat kamar mandi?', { intent: 'follow_up_choice' }),
      false,
      [],
      product,
    );
    expect(d.intent).toBe('PRODUCT_LOOKUP');
    expect(calls()).toBe(0);
  });

  it('tanpa isyarat kebutuhan, label model dipakai apa adanya', async () => {
    const d = await router({ intent: 'PRODUCT_LOOKUP', confidence: 0.85 }).route(
      understood('apa bedanya pvc sama hdpe?', { intent: null }),
      false,
    );
    expect(d.intent).toBe('PRODUCT_LOOKUP');
  });

  it('jalur cepat (P14-07): pesan pertama berisyarat kebutuhan TIDAK memanggil model', async () => {
    const { ai, calls } = countingAi({ intent: 'OUT_OF_SCOPE', confidence: 1 });
    const d = await new IntentRouter(ai).route(
      understood('rumah 2 lantai, 3 kamar mandi', { intent: null }),
      false,
    );
    expect(d.intent).toBe('REQUIREMENT_STATEMENT');
    expect(d.shouldExtract).toBe(true);
    expect(calls()).toBe(0);
  });

  it('jalur cepat tidak dipakai untuk pertanyaan "kenapa", pesaing, atau bila sudah ada kebutuhan', async () => {
    const { ai, calls } = countingAi({ intent: 'EXPLANATION_REQUEST', confidence: 0.9 });
    const r = new IntentRouter(ai);
    // "kenapa …" yang dikenali: pasti di kode (tanpa model); yang tidak dikenali → model.
    expect(
      (
        await r.route(
          understood('kenapa rumah 2 lantai butuh pipa 1 inci?', { intent: 'explanation_request' }),
          false,
        )
      ).intent,
    ).toBe('EXPLANATION_REQUEST');
    expect(calls()).toBe(0);
    // Pesaing dan kebutuhan yang sudah ada: ke model. Pertanyaan "kenapa" yang TIDAK dikenali
    // contoh dan menyebut kebutuhan di pesan pertama memakai jalur cepat (dulu dipotong daftar
    // kata tanya di kode; kini kata tanya adalah contoh di data, bukan pola di kode).
    await r.route(understood('rumah 2 lantai pakai Rucika bagus nggak?', { intent: null }), false);
    await r.route(understood('rumah 2 lantai, 3 kamar mandi', { intent: null }), true);
    expect(calls()).toBe(2);
  });

  it('giliran terakhir diteruskan ke klasifikasi model', async () => {
    const seen: IntentInput[] = [];
    const ai = aiReturning({ intent: 'REQUIREMENT_STATEMENT', confidence: 0.9 });
    ai.classifyIntent = (input) => {
      seen.push(input);
      return Promise.resolve({ intent: 'REQUIREMENT_STATEMENT', confidence: 0.9 });
    };
    await new IntentRouter(ai).route(understood('yang mana?', { intent: null }), false, [
      { role: 'user', text: 'hai' },
    ]);
    expect(seen[0]?.message).toBe('yang mana?');
    expect(seen[0]?.recentTurns).toEqual([{ role: 'user', text: 'hai' }]);
  });
});

describe('IntentRouter — intent pasti dari pemahaman (tanpa model)', () => {
  const { ai, calls } = countingAi({ intent: 'OUT_OF_SCOPE', confidence: 0.5 });
  const r = new IntentRouter(ai);

  it('sapaan/sosial → OUT_OF_SCOPE; pesaing → COMPETITOR_QUESTION; produk → PRODUCT_LOOKUP', async () => {
    expect((await r.route(understood('hai', { intent: 'greeting' }), false)).intent).toBe(
      'OUT_OF_SCOPE',
    );
    expect((await r.route(understood('ok makasih', { intent: 'thanks' }), false)).intent).toBe(
      'OUT_OF_SCOPE',
    );
    expect(
      (await r.route(understood('Pralon vs Rucika?', { intent: 'competitor_question' }), false))
        .intent,
    ).toBe('COMPETITOR_QUESTION');
    expect(
      (await r.route(understood('apa itu PPR?', { intent: 'product_concept' }), false)).intent,
    ).toBe('PRODUCT_LOOKUP');
    // Pertanyaan produk yang menyebut pesaing adalah urusan Policy 1.
    expect(
      (
        await r.route(
          understood('ukuran pipa rucika ada apa aja?', { intent: 'product_spec' }),
          false,
        )
      ).intent,
    ).toBe('COMPETITOR_QUESTION');
    expect(calls()).toBe(0);
  });

  it('mutasi dan jawaban klarifikasi hanya bila kebutuhan sudah ada; sebelumnya = pernyataan kebutuhan', async () => {
    const mutation = understood('tambah satu kamar mandi', { intent: 'requirement_mutation' });
    expect((await r.route(mutation, true)).intent).toBe('REQUIREMENT_MUTATION');
    expect((await r.route(mutation, false)).intent).toBe('REQUIREMENT_STATEMENT');
    const answer = understood('dari pdam', { intent: 'clarification_answer' });
    expect((await r.route(answer, true)).intent).toBe('CLARIFICATION_ANSWER');
    expect((await r.route(answer, false)).intent).toBe('REQUIREMENT_STATEMENT');
    expect(calls()).toBe(0);
  });

  it('irigasi dan kasus teknis → REQUIREMENT_STATEMENT tanpa model', async () => {
    expect(
      (
        await r.route(
          understood('irigasi sawah 2 hektar', { intent: 'requirement_irrigation' }),
          false,
        )
      ).intent,
    ).toBe('REQUIREMENT_STATEMENT');
    expect(
      (
        await r.route(
          understood('drainase air hujan komplek 2 hektar', { intent: 'requirement_technical' }),
          false,
        )
      ).intent,
    ).toBe('REQUIREMENT_STATEMENT');
    expect(calls()).toBe(0);
  });
});

describe('IntentRouter', () => {
  it('REQUIREMENT_MUTATION mengekstrak dan memutasi state', async () => {
    const d = await router({ intent: 'REQUIREMENT_MUTATION', confidence: 0.9 }).route(
      understood('tambah 1 kamar mandi', { intent: null }),
      true,
    );
    expect(d.shouldExtract).toBe(true);
    expect(d.mutatesState).toBe(true);
  });

  it('EXPLANATION_REQUEST tidak mengekstrak dan tidak memutasi', async () => {
    const d = await router({ intent: 'EXPLANATION_REQUEST', confidence: 0.95 }).route(
      understood('kenapa ukuran ini?', { intent: null }),
      true,
    );
    expect(d.shouldExtract).toBe(false);
    expect(d.mutatesState).toBe(false);
  });

  it('PRODUCT_LOOKUP tidak mengekstrak kebutuhan (dijawab query MySQL)', async () => {
    const d = await router({ intent: 'PRODUCT_LOOKUP', confidence: 0.9 }).route(
      understood('ada ukuran 3/4 inch?', { intent: null }),
      true,
    );
    expect(d.shouldExtract).toBe(false);
    expect(d.mutatesState).toBe(false);
  });

  it('REQUIREMENT_STATEMENT mengekstrak tetapi tidak dihitung "mutasi" (pernyataan awal)', async () => {
    const d = await router({ intent: 'REQUIREMENT_STATEMENT', confidence: 0.8 }).route(
      understood('rumah 2 lantai', { intent: null }),
      false,
    );
    expect(d.shouldExtract).toBe(true);
    expect(d.mutatesState).toBe(false);
  });

  it('CLARIFICATION_ANSWER mengekstrak dan memutasi', async () => {
    const d = await router({ intent: 'CLARIFICATION_ANSWER', confidence: 0.85 }).route(
      understood('toren atap', { intent: null }),
      true,
    );
    expect(d.shouldExtract).toBe(true);
    expect(d.mutatesState).toBe(true);
  });

  it('keyakinan di bawah ambang → bertanya, bukan menebak', async () => {
    const low = INTENT_CONFIDENCE_THRESHOLD - 0.01;
    const d = await router({ intent: 'REQUIREMENT_MUTATION', confidence: low }).route(
      understood('mungkin tambah?', { intent: null }),
      true,
    );
    expect(d.intent).toBe('CLARIFICATION_NEEDED');
    expect(d.shouldExtract).toBe(false);
    expect(d.mutatesState).toBe(false);
  });
});
