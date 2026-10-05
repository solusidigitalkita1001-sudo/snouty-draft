/**
 * Ekstraktor deterministik **KHUSUS PENGEMBANGAN**. Bukan jalur produksi.
 *
 * Mengapa ini ada: seluruh Context Engine, Policy Engine, Engineering Engine, dan pipeline
 * rekomendasi sudah selesai dan teruji, tetapi **tidak bisa diklik** tanpa kunci model —
 * satu-satunya langkah yang memakai LLM adalah ekstraksi, dan tanpa itu giliran chat
 * berhenti di `LLM_UNAVAILABLE`. Adapter ini mengisi langkah itu dengan regex supaya alur
 * lengkap bisa diuji manusia: cerita → klarifikasi → analisis → solusi → skema → laporan.
 *
 * **Tiga pagar supaya ia tidak pernah ikut ke produksi:**
 *
 * 1. Hanya terdaftar bila `NODE_ENV === 'development'` **dan** `SNOUTY_FAKE_AI=1`. Dua
 *    syarat, bukan satu: `NODE_ENV` saja terlalu mudah salah set.
 * 2. Adapter OpenRouter sungguhan **selalu menang** bila kuncinya ada.
 * 3. Melempar saat dikonstruksi di luar development — bukan sekadar berperilaku berbeda.
 *
 * Regexnya sengaja kasar dan dicatat sebagai ilustratif (`docs/DESIGN_IMPLEMENTATION.md` §2
 * melarang menyalin ekstraksi regex prototipe ke produksi). Ia tidak pernah menjadi
 * `AiService` di produksi, jadi larangan itu tetap utuh.
 */

import type { AiService, IntentInput } from '../domain/ai.port.js';
import {
  ExtractionSchema,
  IntentSchema,
  ProductQuestionSchema,
  type Extraction,
  type IntentClassification,
  type ProductQuestionParse,
} from '../domain/extraction-schema.js';

/** Isyarat bahwa pesan menyatakan KEBUTUHAN — mengalahkan isyarat pertanyaan produk. */
const REQUIREMENT_SIGNALS =
  /\b(lantai|kamar mandi|wastafel|dapur|toren|pdam|pompa|rumah|ruko|kos|pabrik)\b/;
/** Isyarat pertanyaan produk/pengetahuan: menyebut keluarga produk atau menanyakan sifatnya. */
const PRODUCT_SIGNALS =
  /\b(pvc|hdpe|ppr|pp-r|fitting|tee|elbow|reducer|socket|apa itu|apa bedanya|bedanya|perbedaan|bahan|material|standar|sni|tekanan|panjang batang|sambungan|aplikasi|kegunaan|ada ukuran|ukuran apa|harga|stok|tersedia|spesifikasi)/;
/** Sapaan/basa-basi utuh: tanpa isi kebutuhan maupun produk, cukup pendek. */
const GREETING =
  /^\s*(hai|halo|hallo|hello|hi|hey|yo|pagi|siang|sore|malam|selamat\s+(pagi|siang|sore|malam)|apa kabar|terima kasih|makasih|thanks|ok|oke|sip|tes|test|testing)\b[\s!.,?]*(jo|snouty|bro|kak|min|ya|dong)?[\s!.,?]*$/;
const FAMILY_TOKENS = /\b(pvc\s*(?:aw|d|c)?|hdpe|ppr|pp-r|tee|elbow|reducer|socket)\b/g;
const SIZE_TOKEN = /(\d+(?:\s*\/\s*\d+)?(?:\s*[.,]\d+)?)\s*(?:inch|inci|in|")?/;

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  satu: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
  sepuluh: 10,
};

export class DevDeterministicAiService implements AiService {
  constructor() {
    if (process.env['NODE_ENV'] !== 'development') {
      // Melempar, bukan berperilaku berbeda: adapter palsu yang diam-diam aktif di
      // produksi akan menghasilkan rekomendasi dari regex, dan itu jauh lebih buruk
      // daripada proses yang menolak start.
      throw new Error('DevDeterministicAiService hanya untuk NODE_ENV=development');
    }
  }

  extract(message: string): Promise<Extraction> {
    const text = message.toLowerCase();

    const building: Record<string, unknown> = {};
    const fixtures: Record<string, unknown> = {};
    const water: Record<string, unknown> = {};

    const floors = countNear(text, /(\d+|[a-z]+)\s*lantai/);
    if (floors !== null) building['floors'] = clamp(floors, 1, 50);

    if (/\b(kos|kost)\b/.test(text)) building['type'] = 'boarding_house';
    else if (/\b(pabrik|industri|gudang)\b/.test(text)) building['type'] = 'industrial';
    else if (/\b(ruko|kantor|toko|komersial)\b/.test(text)) building['type'] = 'light_commercial';
    else if (/\b(rumah|hunian)\b/.test(text)) building['type'] = 'residential';

    const bathrooms = countNear(text, /(\d+|[a-z]+)\s*(kamar mandi|km\b|toilet|wc)/);
    if (bathrooms !== null) fixtures['bathrooms'] = clamp(bathrooms, 0, 200);

    const basins = countNear(text, /(\d+|[a-z]+)\s*(wastafel|washtafel|lavatory)/);
    if (basins !== null) fixtures['basins'] = clamp(basins, 0, 200);

    const kitchens = countNear(text, /(\d+|[a-z]+)\s*(dapur|pantry)/);
    if (kitchens !== null) fixtures['kitchens'] = clamp(kitchens, 0, 100);
    // "tidak ada dapur" → 0 eksplisit, bukan tak disebut. Pembedaan yang sama yang
    // dijaga ContextMerger (docs/CONTEXT_ENGINE.md §4).
    else if (/(tidak|tanpa|belum)\s+(ada\s+)?(dapur|pantry)/.test(text)) fixtures['kitchens'] = 0;

    if (/toren.*(atas|atap)|atap.*toren|rooftop/.test(text)) water['source'] = 'rooftop_tank';
    else if (/toren.*(bawah|tanah)|ground\s*tank/.test(text)) water['source'] = 'ground_tank';
    else if (/\bpompa\b/.test(text)) water['source'] = 'pump';
    else if (/\b(pdam|pam)\b/.test(text)) water['source'] = 'municipal';
    else if (/\btoren\b/.test(text)) water['source'] = 'rooftop_tank';

    const hasClean = /air bersih/.test(text);
    const hasDrain = /pembuangan|air kotor|limbah|drainase/.test(text);
    if (hasClean && hasDrain) water['installationType'] = 'both';
    else if (hasDrain) water['installationType'] = 'drainage';
    else if (hasClean) water['installationType'] = 'clean_water';

    if (/pompa pendorong|booster/.test(text)) water['boosterPump'] = true;

    // Divalidasi skema yang sama seperti keluaran model — tidak ada jalur pintas.
    return Promise.resolve(
      ExtractionSchema.parse({
        ...(Object.keys(building).length > 0 ? { building } : {}),
        ...(Object.keys(fixtures).length > 0 ? { fixtures } : {}),
        ...(Object.keys(water).length > 0 ? { water } : {}),
      }),
    );
  }

  classifyIntent(input: IntentInput): Promise<IntentClassification> {
    const text = input.message.toLowerCase();

    // Sapaan dan basa-basi: di luar topik — dibalas sapaan, bukan formulir klarifikasi.
    if (GREETING.test(text)) return this.intent('OUT_OF_SCOPE', 0.9);

    // Kompetitor diperiksa lebih dulu: Policy 1 harus menang sebelum apa pun.
    if (/\b(rucika|wavin|maspion|vinilon|merek lain|bandingkan|lebih bagus)\b/.test(text)) {
      return this.intent('COMPETITOR_QUESTION', 0.9);
    }
    if (/\b(kenapa|mengapa|kok|jelaskan|alasan)\b/.test(text)) {
      return this.intent('EXPLANATION_REQUEST', 0.85);
    }
    // Pertanyaan produk: menyebut keluarga produk atau sifatnya, TANPA isyarat kebutuhan.
    // "Pakai pipa PVC untuk rumah 2 lantai" tetap pernyataan kebutuhan.
    if (PRODUCT_SIGNALS.test(text) && !REQUIREMENT_SIGNALS.test(text)) {
      return this.intent('PRODUCT_LOOKUP', 0.85);
    }
    if (input.hasExistingRequirements && /\b(tambah|ubah|ganti|jadi|kurangi)\b/.test(text)) {
      return this.intent('REQUIREMENT_MUTATION', 0.8);
    }
    if (input.hasExistingRequirements) return this.intent('CLARIFICATION_ANSWER', 0.75);
    return this.intent('REQUIREMENT_STATEMENT', 0.8);
  }

  /**
   * Pemetaan pertanyaan produk lewat kata kunci — cukup untuk mengklik alur pengetahuan
   * produk tanpa kunci model. Aspek yang tidak dikenali tetap `null`, bukan ditebak.
   */
  parseProductQuestion(message: string): Promise<ProductQuestionParse> {
    const text = message.toLowerCase();
    const families = [...text.matchAll(FAMILY_TOKENS)].map((m) => m[1]!.replace(/\s+/g, ' '));
    const unique = [...new Set(families)].slice(0, 2);
    const productQuery = unique.length > 0 ? unique.join(' dan ') : null;

    const availability = /ada ukuran|ukuran .* ada|tersedia ukuran|ukuran .* tersedia/.test(text);
    const sizeMatch = availability
      ? SIZE_TOKEN.exec(text.replace(/\b(pvc|hdpe|ppr)\b/g, ''))
      : null;
    const aspect: ProductQuestionParse['aspect'] =
      availability && sizeMatch
        ? 'size_availability'
        : /ukuran apa|ukuran (yang )?tersedia|ukuran (yang )?ada|ukurannya/.test(text)
          ? 'sizes'
          : /fitting|cocok dengan|sepadan/.test(text)
            ? 'compatible_fittings'
            : /\b(bahan|material)\b/.test(text)
              ? 'material'
              : /\b(standar|sni)/.test(text)
                ? 'standard'
                : /tekanan/.test(text)
                  ? 'pressure_class'
                  : /panjang/.test(text)
                    ? 'rod_length'
                    : /sambungan|solvent|lem\b/.test(text)
                      ? 'joint_type'
                      : /aplikasi|kegunaan|dipakai untuk|untuk apa/.test(text)
                        ? 'application'
                        : null;

    return Promise.resolve(
      ProductQuestionSchema.parse({
        productQuery,
        aspect,
        size:
          aspect === 'size_availability' && sizeMatch ? sizeMatch[1]!.replace(/\s+/g, '') : null,
      }),
    );
  }

  titleFor(firstMessage: string): Promise<string> {
    const trimmed = firstMessage.trim().replace(/\s+/g, ' ');
    return Promise.resolve(trimmed.length > 48 ? `${trimmed.slice(0, 45)}…` : trimmed);
  }

  /**
   * Adapter pengembangan **tidak menulis prosa**. Ia mengembalikan `null`, bukan
   * kalimat karangan, sehingga perakitan jatuh ke templat deterministik yang setiap
   * angkanya berasal dari hasil hitungan.
   *
   * Pilihan ini penting: regex boleh mengisi langkah ekstraksi karena hasilnya
   * langsung terlihat salah bila salah. Prosa karangan justru terbaca meyakinkan —
   * ia akan menjelaskan angka yang tidak pernah dihitung siapa pun, di layar yang
   * dipakai manusia untuk menilai apakah produknya benar.
   */
  writeProse(): Promise<unknown> {
    return Promise.resolve(null);
  }

  private intent(intent: IntentClassification['intent'], confidence: number) {
    return Promise.resolve(IntentSchema.parse({ intent, confidence }));
  }
}

/** Angka di depan sebuah kata — menerima digit maupun kata bilangan Indonesia. */
function countNear(text: string, pattern: RegExp): number | null {
  const match = pattern.exec(text);
  if (!match?.[1]) return null;
  const raw = match[1];
  const digits = Number.parseInt(raw, 10);
  if (Number.isFinite(digits)) return digits;
  return NUMBER_WORDS[raw] ?? null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
