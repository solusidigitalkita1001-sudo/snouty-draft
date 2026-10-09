/**
 * Subjek percakapan aktif dan penyelesaian rujukan (Fase 16) — fungsi murni atas HASIL
 * PEMAHAMAN pesan, tanpa pola kalimat (aturan proyek: pertanyaan pengguna tidak pernah
 * di-hardcode; contoh kalimatnya hidup di `data/understanding/`).
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
import type { MessageUnderstanding } from '../../understanding/application/message-understanding.js';
import {
  isFollowUp as isFollowUpIntent,
  isPresentationFollowUp,
  type CompanyTopicLabel,
} from '../../understanding/domain/labels.js';

export const COMPANY_ENTITY = 'PT Pralon';

/** Topik perusahaan — bagian profil yang ditanyakan; `company_overview` bila tidak ada yang spesifik. */
export type CompanyTopic = CompanyTopicLabel | 'company_overview';

const DEPTH_ORDER: readonly AnswerDepth[] = ['brief', 'standard', 'detailed', 'comprehensive'];

/**
 * Pesan lanjutan yang tidak berdiri sendiri ("boleh", "lengkap dong", "yang tadi"): bentuknya
 * dikenali pemahaman; aturan di sini adalah PAGARNYA — pesan yang menyebut produk atau kebutuhan
 * baru membawa topik baru, apa pun bentuk kalimatnya ("lebih detail soal HDPE dong" bukan lanjutan
 * subjek perusahaan, melainkan pertanyaan HDPE).
 */
export function isFollowUp(u: MessageUnderstanding): boolean {
  return isFollowUpIntent(u.intent?.label) && u.families.length === 0 && !u.mentionsRequirement;
}

/**
 * Permintaan UBAH BENTUK atas jawaban sebelumnya ("bikinin tabelnya dong", "ringkas aja"): tidak
 * membawa topik baru — maknanya hanya ada relatif terhadap apa yang baru dijawab. Format yang
 * diminta dibaca `u.format`.
 */
export function isFormatFollowUp(u: MessageUnderstanding): boolean {
  return (
    u.format !== null &&
    (u.intent?.label === 'follow_up_reformat' || isPresentationFollowUp(u.intent?.label)) &&
    u.families.length === 0 &&
    !u.mentionsRequirement
  );
}

/**
 * "yang mana buat kamar mandi?", "mana yang lebih cocok?": memilih di antara hal yang baru
 * dibandingkan — lanjutan subjek walau menyebut tempat pakainya (kamar mandi adalah tempat,
 * bukan kebutuhan baru). Yang menggugurkannya hanya bahan/produk baru di pesan.
 */
export function isChoiceFollowUp(u: MessageUnderstanding): boolean {
  return u.intent?.label === 'follow_up_choice' && u.families.length === 0;
}

/** Topik perusahaan yang disebut pesan; `company_overview` bila tidak ada bagian spesifik. */
export function companyTopicOf(u: MessageUnderstanding): CompanyTopic {
  return u.companyTopic ?? 'company_overview';
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
  u: MessageUnderstanding,
  previous: ConversationSubject | undefined,
): SubjectResolution {
  const requested = u.depth;
  if (previous?.kind === 'company' && isFollowUp(u)) {
    return {
      subject: {
        ...previous,
        topic: u.companyTopic ?? previous.topic,
        depth: requested ?? deeper(previous.depth),
      },
      resolvedFromPrevious: true,
    };
  }
  const topic = companyTopicOf(u);
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

/** Topik subjek produk: "apa bedanya fitting sama HDPE?" — komponen dibandingkan dengan satu bahan. */
export const FITTING_VS_MATERIAL = 'fitting_vs_material';

/**
 * Subjek PRODUK/BAHAN setelah pertanyaan produk terjawab; `entity` = query yang dipakai (keluarga
 * produk kanonis, "pvc aw dan hdpe"), atau `null` bila pesan tidak menyebut produk.
 */
export function productSubject(
  entity: string | null,
  u: MessageUnderstanding,
  previous: ConversationSubject | undefined,
): ConversationSubject {
  const requested = u.depth;
  if (entity === null && previous && previous.kind !== 'company' && isFollowUp(u)) {
    return { ...previous, depth: requested ?? deeper(previous.depth) };
  }
  const comparison = u.intent?.label === 'product_comparison';
  // Fitting vs satu bahan: topiknya disimpan supaya "bikinin tabelnya" berikutnya tahu bahwa
  // yang dibandingkan adalah komponen dengan bahan — bukan dua bahan.
  if (
    comparison &&
    entity !== null &&
    u.families.length === 1 &&
    u.knowledgeTopics.includes('fitting')
  ) {
    return { kind: 'product', entity, topic: FITTING_VS_MATERIAL, depth: requested ?? 'standard' };
  }
  // "coba bandingin sama pipa PVC" saat subjeknya HDPE: yang dibandingkan adalah keduanya —
  // entitasnya digabung supaya giliran berikutnya ("bedanya sama AW?") tahu apa yang sedang dibahas.
  // Hanya bila pesan menyebut SATU bahan: "apa bedanya pvc dan hdpe?" sudah lengkap sendiri —
  // menggabungkannya dengan subjek lama menghasilkan "hdpe dan pvc dan hdpe" (tinjauan 2026-10-08).
  const merged =
    comparison &&
    entity !== null &&
    u.families.length === 1 &&
    previous?.kind === 'product' &&
    !previous.entity.split(/\s+dan\s+/).includes(entity)
      ? `${previous.entity} dan ${entity}`
      : entity;
  return {
    kind: 'product',
    // Hanya entitas PRODUK yang diwarisi: subjek kasus ("building") atau perusahaan bukan produk
    // (judul riwayat sempat menjadi "Produk BUILDING", 2026-10-09).
    entity: merged ?? (previous?.kind === 'product' ? previous.entity : null) ?? 'Pralon',
    topic: comparison ? 'comparison' : 'product_overview',
    depth: requested ?? 'standard',
  };
}

/** Intent yang dilanjutkan sebuah pesan lanjutan atas subjek bersangkutan. */
export function intentForSubject(kind: SubjectKind): Intent {
  if (kind === 'company') return 'COMPANY_QUESTION';
  if (kind === 'case') return 'REQUIREMENT_STATEMENT';
  return 'PRODUCT_LOOKUP';
}
