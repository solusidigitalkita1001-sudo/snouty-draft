/**
 * Heuristik teks murni milik `ai` — jalur cepat SEBELUM model dipanggil, dan satu-satunya
 * sumber adapter pengembangan (`DevDeterministicAiService`).
 *
 * Mengapa ada di adapter live: di CPU laptop, satu panggilan qwen2.5:7b memakan 10–60 detik.
 * Untuk pesan yang bentuknya tidak mungkin salah baca — sapaan utuh, merek pesaing,
 * "apa bedanya PVC dan HDPE", pertanyaan ukuran — memanggil model hanya menambah menit tanpa
 * menambah kebenaran. Hanya kasus yang PASTI yang dipotong; selebihnya tetap ke model.
 *
 * Bukan aturan bisnis: ini pemetaan bentuk kalimat ke label tugas bahasa, sama seperti yang
 * dilakukan model. Aturan bisnisnya (presedensi kebutuhan, grounding) tetap hidup di `context`.
 */
import type { IntentClassification, ProductQuestionParse } from './extraction-schema.js';

/** Isyarat bahwa pesan menyatakan KEBUTUHAN — mengalahkan isyarat pertanyaan produk. */
export const REQUIREMENT_SIGNALS =
  /\b(lantai|kamar mandi|wastafel|dapur|toren|tandon|pdam|sumur|pompa|rumah|ruko|kos|kost|gedung|pabrik|floors?|stor(?:e)?ys?|stories|bathrooms?|sinks?|basins?|kitchens?|tanks?|rooftop|wells?|pumps?|house|home|shophouse|boarding house|dorm(?:itory)?|building|factory|warehouse)\b/;
/** Isyarat pertanyaan produk/pengetahuan: menyebut keluarga produk atau menanyakan sifatnya. */
export const PRODUCT_SIGNALS =
  /\b(pvc|hdpe|ppr|pp-r|fitting|tee|elbow|reducer|socket|apa itu|apa bedanya|bedanya|perbedaan|bahan|material|standar|sni|tekanan|panjang batang|sambungan|aplikasi|kegunaan|ada ukuran|ukuran apa|harga|stok|tersedia|spesifikasi|what is|difference|differ|compare|comparison|versus|standard|pressure|rod length|joint|connection|application|uses?|sizes?|price|stock|available|specification|specs)/;
/** Sapaan/basa-basi utuh: tanpa isi kebutuhan maupun produk, cukup pendek. */
export const GREETING =
  /^\s*(hai|halo|hallo|hello|hi|hey|yo|pagi|siang|sore|malam|selamat\s+(pagi|siang|sore|malam)|apa kabar|terima kasih|makasih|thanks|ok|oke|sip|tes|test|testing)\b[\s!.,?]*(jo|snouty|bro|kak|min|ya|dong)?[\s!.,?]*$/;
export const COMPETITOR_BRANDS = /\b(rucika|wavin|maspion|vinilon|unilon|supralon|merek lain)\b/;
/** Pertanyaan KONSEP produk: definisi/perbandingan, bukan kebutuhan. */
/** Pertanyaan KONSEP/definisi/perbandingan: aspek spesifikasi tidak pernah ditebak darinya. */
export const PRODUCT_CONCEPT =
  /\b(apa itu|itu apa|apaan|apa sih|apa bedanya|bedanya|perbedaan|beda|what is|what are|difference|differences|differ|compare|comparison|versus|vs)\b/;
const FAMILY_TOKENS = /\b(pvc\s*(?:aw|d|c)?|hdpe|ppr|pp-r|tee|elbow|reducer|socket)\b/g;
const SIZE_TOKEN = /(\d+(?:\s*\/\s*\d+)?(?:\s*[.,]\d+)?)\s*(?:inch|inci|in|")?/;

/**
 * Intent yang bisa dipastikan tanpa model; `null` bila tidak pasti. Hanya tiga kelas:
 * sapaan utuh, merek pesaing, dan konsep produk tanpa isyarat kebutuhan.
 */
/** Irigasi/pertanian punya jalurnya sendiri di `context` — kebutuhan, bukan pertanyaan produk. */
const IRRIGATION =
  /\b(irigasi|sawah|kebun|perkebunan|pertanian|ladang|irrigation|paddy|rice field|farm|farmland|orchard|plantation|garden)\b/;
/** Kasus teknis umum (Fase 14): jalur kebutuhan di `context`, tanpa menunggu model. */
const TECHNICAL_CASE =
  /\b(gorong[- ]gorong|culvert|drainase|air hujan|limpasan|selokan|saluran pembuangan|air kotor|transfer air|memompa|dipompa|cluster|klaster|perumahan|komplek|apartemen|sumur bor|submersible|reservoir|tambak|kolam|lele|nila|gurame|bioflok|culvert|drainage|storm ?water|rainwater|runoff|sewer|wastewater|transfer water|water transfer|pumping|housing estate|housing complex|apartment|borehole|deep well|fish ?pond|ponds?|tilapia|catfish)\b/;

/**
 * Pralon sebagai PERUSAHAAN: "PT Pralon", "perusahaan", "company profile", sejarah, pabrik, visi,
 * kontak — atau pertanyaan telanjang "pralon itu apa?" yang tidak menyebut produk. Pesan yang
 * menyebut keluarga produk ("produk PVC AW Pralon") bukan pertanyaan perusahaan.
 */
export const COMPANY_SIGNALS =
  /\b(pt\.?\s*pralon|perusahaan|company|corporate|profil(?:e)?\b|company profile|sejarah|history|didirikan|berdiri|founded|pabrik(?:nya)?|factory|manufaktur|manufactur(?:er|ing)|sertifikasi|certif(?:ication|ied)|visi|misi|vision|mission|kantor|office|alamat|address|kontak|contact|cabang|distributor|tentang pralon|about pralon|siapa pralon|who is pralon)\b/;
const BARE_PRALON_QUESTION =
  /^\W*(?:pralon\W+(?:itu|tuh)?\W*(?:apa|apaan|siapa)|apa(?:\s+itu|\s+sih)?\W+pralon|what\W+is\W+pralon|pralon\W+(?:is\W+)?what)\W*$/;

export function asksAboutCompany(message: string): boolean {
  const text = message.toLowerCase();
  if (FAMILY_TOKENS.test(text)) {
    FAMILY_TOKENS.lastIndex = 0;
    return false;
  }
  FAMILY_TOKENS.lastIndex = 0;
  return (/\bpralon\b/.test(text) && COMPANY_SIGNALS.test(text)) || BARE_PRALON_QUESTION.test(text);
}

/**
 * Kebutuhan bangunan yang nyata — tanpa kata tempat (pabrik, kantor, gedung) yang juga lazim di
 * pertanyaan perusahaan ("pabrik Pralon di mana?").
 */
const BUILDING_NEED =
  /\b(lantai|kamar mandi|wastafel|dapur|toren|tandon|pdam|sumur|pompa|rumah|ruko|kos|kost|floors?|stor(?:e)?ys?|stories|bathrooms?|sinks?|basins?|kitchens?|tanks?|rooftop|wells?|pumps?|house|home|shophouse|boarding house|dorm(?:itory)?)\b/;
/** "produk HDPE-nya gimana?" — menyebut keluarga produk sebagai produk, tanpa kebutuhan. */
const PRODUCT_MENTION = /\b(produk(?:nya)?|products?|jual|punya|sell|carry)\b/;

export function certainIntent(message: string): IntentClassification | null {
  const text = message.toLowerCase();
  if (GREETING.test(text)) return { intent: 'OUT_OF_SCOPE', confidence: 0.95 };
  if (asksAboutCompany(message) && !BUILDING_NEED.test(text)) {
    return { intent: 'COMPANY_QUESTION', confidence: 0.9 };
  }
  if (IRRIGATION.test(text)) return { intent: 'REQUIREMENT_STATEMENT', confidence: 0.9 };
  if (COMPETITOR_BRANDS.test(text)) return { intent: 'COMPETITOR_QUESTION', confidence: 0.95 };
  if (PRODUCT_CONCEPT.test(text) && FAMILY_TOKENS.test(text) && !REQUIREMENT_SIGNALS.test(text)) {
    FAMILY_TOKENS.lastIndex = 0;
    return { intent: 'PRODUCT_LOOKUP', confidence: 0.9 };
  }
  FAMILY_TOKENS.lastIndex = 0;
  if (TECHNICAL_CASE.test(text)) return { intent: 'REQUIREMENT_STATEMENT', confidence: 0.9 };
  if (PRODUCT_MENTION.test(text) && FAMILY_TOKENS.test(text) && !REQUIREMENT_SIGNALS.test(text)) {
    FAMILY_TOKENS.lastIndex = 0;
    return { intent: 'PRODUCT_LOOKUP', confidence: 0.85 };
  }
  FAMILY_TOKENS.lastIndex = 0;
  return null;
}

/**
 * Parse pertanyaan produk dari bentuk kalimat. `productQuery` `null` bila tidak ada keluarga
 * produk yang dikenali — adapter live lalu bertanya ke model; adapter pengembangan memakainya
 * apa adanya. Aspek yang tidak dikenali tetap `null`, bukan ditebak.
 */
export function heuristicProductQuestion(message: string): ProductQuestionParse {
  const text = message.toLowerCase();
  const families = [...text.matchAll(FAMILY_TOKENS)].map((m) => m[1]!.replace(/\s+/g, ' ').trim());
  const unique = [...new Set(families)].slice(0, 2);
  const productQuery = unique.length > 0 ? unique.join(' dan ') : null;

  // "apa bedanya fitting sama HDPE?" adalah pertanyaan konsep — kata 'fitting' di dalamnya bukan
  // permintaan daftar fitting yang sepadan (laporan pemilik 2026-10-07).
  if (PRODUCT_CONCEPT.test(text)) return { productQuery, aspect: null, size: null };
  const availability = /ada ukuran|ukuran .* ada|tersedia ukuran|ukuran .* tersedia/.test(text);
  const sizeMatch = availability ? SIZE_TOKEN.exec(text.replace(/\b(pvc|hdpe|ppr)\b/g, '')) : null;
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

  return {
    productQuery,
    aspect,
    size: aspect === 'size_availability' && sizeMatch ? sizeMatch[1]!.replace(/\s+/g, '') : null,
  };
}
