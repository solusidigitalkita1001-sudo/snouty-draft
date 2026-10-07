/**
 * Subjek percakapan aktif dan penyelesaian rujukan (Fase 16) — fungsi murni, tanpa model.
 *
 * Masalah yang diselesaikan: "pralon itu apa?" → "PT Pralon yang gw maksud" → "boleh" →
 * "lengkap dong" → "semuanya, tolong tampilin". Tanpa subjek, tiap pesan lanjutan diklasifikasi
 * seolah pesan lepas, dan "semuanya" jatuh ke pertanyaan produk ("Produk mana yang Anda maksud?").
 * Dengan subjek, pesan yang tidak berdiri sendiri diselesaikan terhadap apa yang sedang
 * dibicarakan: entitasnya tetap, kedalamannya naik.
 *
 * Subjek hanya berganti bila pengguna benar-benar berganti topik (menyebut produk, kebutuhan,
 * atau perusahaan secara eksplisit) — kegagalan retrieval bukan pergantian topik.
 */
import type { AnswerDepth, ConversationSubject, Intent, SubjectKind } from '@snouty/shared-types';

export const COMPANY_ENTITY = 'PT Pralon';

/** Topik perusahaan — bagian profil yang ditanyakan; `company_profile` = seluruhnya. */
export type CompanyTopic =
  | 'company_profile'
  | 'company_overview'
  | 'history'
  | 'products'
  | 'manufacturing'
  | 'certifications'
  | 'vision_mission'
  | 'contact';

const DEPTH_ORDER: readonly AnswerDepth[] = ['brief', 'standard', 'detailed', 'comprehensive'];

const COMPREHENSIVE =
  /\b(semua(?:nya)?|seluruh(?:nya)?|lengkap(?:nya)?|selengkap(?:nya)?|komplit|secara lengkap|secara detail|everything|all of it|complete(?:ly)?|full(?:y)?|comprehensive|in full)\b/i;
const DETAILED =
  /\b(detail(?:nya|ed)?|detil|rinci(?:nya)?|terperinci|mendalam|lebih (?:jauh|dalam|banyak|lanjut)|more|elaborate|deeper|in depth|further)\b/i;
const BRIEF =
  /\b(singkat(?:nya)?|ringkas(?:nya)?|sekilas|garis besar|brief(?:ly)?|short(?:ly)?|summary|quick(?:ly)?|tl;?dr)\b/i;

/** Kedalaman jawaban yang diminta pesan; `null` bila pesan tidak menyebutnya. */
export function requestedDepth(message: string): AnswerDepth | null {
  if (COMPREHENSIVE.test(message)) return 'comprehensive';
  if (DETAILED.test(message)) return 'detailed';
  if (BRIEF.test(message)) return 'brief';
  return null;
}

/**
 * Kata-kata yang boleh menyusun pesan LANJUTAN: persetujuan, rujukan ("yang tadi"), permintaan
 * kedalaman, dan kata pengisi. Pesan yang seluruh katanya ada di sini tidak berdiri sendiri —
 * maknanya hanya ada relatif terhadap subjek yang aktif.
 */
const FOLLOW_UP_WORDS = new Set([
  // persetujuan / lanjutkan
  'ya',
  'iya',
  'yes',
  'yep',
  'yup',
  'ok',
  'oke',
  'okay',
  'okey',
  'boleh',
  'sure',
  'silakan',
  'silahkan',
  'gas',
  'gaskeun',
  'lanjut',
  'lanjutkan',
  'lanjutin',
  'terus',
  'teruskan',
  'terusin',
  'continue',
  'go',
  'on',
  'ahead',
  'more',
  'lagi',
  'yuk',
  'ayo',
  'mau',
  'pengen',
  'pingin',
  'want',
  'need',
  // tampilkan / jelaskan
  'tampilkan',
  'tampilin',
  'tunjukkan',
  'tunjukin',
  'kasih',
  'kasi',
  'show',
  'tell',
  'me',
  'jelasin',
  'jelaskan',
  'jelasinnya',
  'explain',
  'elaborate',
  'sebutkan',
  'sebutin',
  'list',
  'liat',
  'lihat',
  'see',
  // kedalaman
  'detail',
  'detailnya',
  'detil',
  'rinci',
  'rincinya',
  'lengkap',
  'lengkapnya',
  'lengkapin',
  'selengkapnya',
  'komplit',
  'semua',
  'semuanya',
  'seluruh',
  'seluruhnya',
  'everything',
  'all',
  'of',
  'it',
  'complete',
  'full',
  'fully',
  'singkat',
  'ringkas',
  'brief',
  'short',
  'secara',
  'lebih',
  'jauh',
  'dalam',
  'banyak',
  'mendalam',
  'in',
  'depth',
  // rujukan
  'yang',
  'tadi',
  'itu',
  'tuh',
  'ini',
  'the',
  'that',
  'this',
  'one',
  'previous',
  'same',
  'sama',
  'pertama',
  'kedua',
  'ketiga',
  'first',
  'second',
  'third',
  'data',
  'datanya',
  'nya',
  'info',
  'infonya',
  'informasi',
  'informasinya',
  'profil',
  'profilnya',
  'profile',
  'details',
  // pengisi
  'dong',
  'donk',
  'deh',
  'dah',
  'aja',
  'saja',
  'please',
  'pls',
  'plis',
  'tolong',
  'coba',
  'bisa',
  'bisakah',
  'minta',
  'gw',
  'gue',
  'gua',
  'aku',
  'saya',
  'i',
  'kak',
  'min',
  'bro',
  'jo',
  'snouty',
  'ya',
  'yah',
  'sih',
  'kalau',
  'kalo',
  'bisa',
  'boleh',
  'saya',
  'tau',
  'tahu',
  'know',
  'about',
  'tentang',
  'soal',
  'terkait',
  'mengenai',
  'apa',
  'what',
  'else',
  'juga',
  'too',
  'also',
  'and',
  'dan',
  'with',
  'dengan',
  'so',
  'jadi',
]);
const MAX_FOLLOW_UP_WORDS = 8;

/**
 * Pesan lanjutan yang tidak berdiri sendiri: pendek, dan setiap katanya adalah persetujuan,
 * rujukan, permintaan kedalaman, atau pengisi. "boleh", "lengkap dong", "semuanya, tolong
 * tampilin", "data nya secara lengkap dong", "yang tadi" — ya. "produk HDPE nya gimana?" — bukan:
 * ia menyebut hal baru (HDPE, gimana).
 */
export function isFollowUp(message: string): boolean {
  const words = message
    .toLowerCase()
    .replace(/[^a-z0-9\s;]/g, ' ')
    .replace(/\btl;dr\b/g, 'tldr')
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0 || words.length > MAX_FOLLOW_UP_WORDS) return false;
  return words.every((w) => FOLLOW_UP_WORDS.has(w));
}

/** Bentuk penyajian yang diminta pengguna atas jawaban yang sudah ada. */
export type AnswerFormat = 'table' | 'bullets' | 'summary';

const FORMAT_TABLE =
  /\b(tabel|table|tabelkan|bentuk tabel|skema perbandingan|skema|bagan|matriks|matrix|side by side)\b/i;
const FORMAT_BULLETS = /\b(poin[- ]?poin|poin|butir|bullet(?:s)?|daftar|list(?:kan)?|poinnya)\b/i;
const FORMAT_SUMMARY =
  /\b(ringkas(?:kan|in)?|rangkum(?:kan|in)?|singkat(?:kan|in)?|intinya|tl;?dr|summar(?:y|ize|ise))\b/i;
/** Rujukan ke jawaban yang baru saja diberikan: "-nya", "tadi", "di atas", "yang itu", "the above". */
const REFERENCE =
  /\b(nya|tadi|itu|ini|di ?atas|sebelumnya|barusan|yang tadi|yang itu|perbedaannya|bedanya|penjelasannya|jawabannya|the above|that|this|previous|earlier)\b|nya\b/i;

/** Format yang diminta pesan; `null` bila tidak ada. Tabel menang atas daftar, daftar atas ringkasan. */
export function requestedFormat(message: string): AnswerFormat | null {
  if (FORMAT_TABLE.test(message)) return 'table';
  if (FORMAT_BULLETS.test(message)) return 'bullets';
  if (FORMAT_SUMMARY.test(message)) return 'summary';
  return null;
}

/**
 * Permintaan UBAH BENTUK atas jawaban sebelumnya: "bikinin skema perbedaannya dalam bentuk tabel",
 * "ringkas aja", "poin-poinnya dong". Pesan seperti ini tidak membawa topik baru — maknanya hanya
 * ada relatif terhadap apa yang baru dijawab — sehingga diperlakukan sebagai lanjutan subjek.
 * Pemanggil tetap memeriksa bahwa pesan tidak menyebut entitas baru (bahan, produk, kebutuhan).
 */
export function isFormatFollowUp(message: string): boolean {
  const format = requestedFormat(message);
  if (format === null) return false;
  const words = message.split(/\s+/).filter((w) => w.length > 0).length;
  return REFERENCE.test(message) || words <= MAX_FOLLOW_UP_WORDS;
}

/** Topik perusahaan yang disebut pesan; `company_profile` bila "profil/company profile/semuanya". */
export function companyTopicOf(message: string): CompanyTopic {
  const t = message.toLowerCase();
  if (/\b(profil(?:e)?|company profile|selengkapnya|semua(?:nya)?|seluruh)\b/.test(t)) {
    return 'company_profile';
  }
  if (/\b(sejarah|history|didirikan|berdiri|founded|milestone)/.test(t)) return 'history';
  if (/\b(pabrik|factory|manufaktur|manufactur|produksi|production|fasilitas|facilit)/.test(t)) {
    return 'manufacturing';
  }
  if (/\b(sertifikasi|sertifikat|certif|sni|iso|standar mutu|quality)/.test(t))
    return 'certifications';
  if (/\b(visi|misi|vision|mission|nilai|values)\b/.test(t)) return 'vision_mission';
  if (
    /\b(kontak|contact|alamat|address|kantor|office|telepon|phone|email|website|situs|cabang|distributor)\b/.test(
      t,
    )
  ) {
    return 'contact';
  }
  if (/\b(produk|products?|jual|bikin|buat|membuat|manufacture|jenis|range)\b/.test(t))
    return 'products';
  return 'company_overview';
}

function deeper(depth: AnswerDepth): AnswerDepth {
  const index = DEPTH_ORDER.indexOf(depth);
  return DEPTH_ORDER[Math.min(index + 1, DEPTH_ORDER.length - 1)]!;
}

export interface SubjectResolution {
  readonly subject: ConversationSubject;
  /** Pesan diselesaikan terhadap subjek sebelumnya (bukan topik baru). */
  readonly resolvedFromPrevious: boolean;
}

/**
 * Subjek PERUSAHAAN untuk giliran ini. Pesan lanjutan atas subjek perusahaan yang sudah aktif
 * mewarisi topiknya dan menaikkan kedalamannya ("boleh" → satu tingkat lebih dalam; "semuanya"
 * → `comprehensive`); pesan yang menyebut topik baru menggantinya.
 */
export function resolveCompanySubject(
  message: string,
  previous: ConversationSubject | undefined,
): SubjectResolution {
  const requested = requestedDepth(message);
  const followUp = isFollowUp(message);
  if (previous?.kind === 'company' && followUp) {
    const mentionsTopic = companyTopicOf(message) !== 'company_overview';
    return {
      subject: {
        ...previous,
        topic: mentionsTopic ? companyTopicOf(message) : previous.topic,
        depth: requested ?? deeper(previous.depth),
      },
      resolvedFromPrevious: true,
    };
  }
  const topic = companyTopicOf(message);
  return {
    subject: {
      kind: 'company',
      entity: COMPANY_ENTITY,
      topic,
      // Profil utuh yang diminta eksplisit ("company profile") sudah lebih dari sekadar ringkasan.
      depth: requested ?? (topic === 'company_profile' ? 'detailed' : 'standard'),
    },
    resolvedFromPrevious: previous?.kind === 'company',
  };
}

/** Subjek PRODUK/BAHAN setelah pertanyaan produk terjawab; `entity` = query yang dipakai. */
export function productSubject(
  entity: string | null,
  message: string,
  previous: ConversationSubject | undefined,
): ConversationSubject {
  const requested = requestedDepth(message);
  if (entity === null && previous && previous.kind !== 'company' && isFollowUp(message)) {
    return { ...previous, depth: requested ?? deeper(previous.depth) };
  }
  const comparison = COMPARISON_WORDS.test(message);
  // "coba bandingin sama pipa PVC" saat subjeknya HDPE: yang dibandingkan adalah keduanya —
  // entitasnya digabung supaya giliran berikutnya ("bedanya sama AW?") tahu apa yang sedang dibahas.
  const merged =
    comparison &&
    entity !== null &&
    previous?.kind === 'product' &&
    !previous.entity.split(/\s+dan\s+/).includes(entity)
      ? `${previous.entity} dan ${entity}`
      : entity;
  return {
    kind: 'product',
    entity: merged ?? previous?.entity ?? 'Pralon',
    topic: comparison ? 'comparison' : 'product_overview',
    depth: requested ?? 'standard',
  };
}

const COMPARISON_WORDS =
  /\b(beda|bedanya|perbedaan|bandingkan|bandingin|dibanding|differ|difference|compare|versus|vs)\b/i;

/** Intent yang dilanjutkan sebuah pesan lanjutan atas subjek bersangkutan. */
export function intentForSubject(kind: SubjectKind): Intent {
  if (kind === 'company') return 'COMPANY_QUESTION';
  if (kind === 'case') return 'REQUIREMENT_STATEMENT';
  return 'PRODUCT_LOOKUP';
}
