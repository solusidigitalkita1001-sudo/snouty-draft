/**
 * `AssistantCard` — union **tertutup**. docs/API_CONTRACTS.md §3 · docs/DOMAIN_MODEL.md §6.
 *
 * Balasan asisten tidak pernah berisi HTML maupun markdown bebas, dan itu bukan
 * pilihan gaya: membatasi kartu pada union tertutup menutup satu jalur prompt
 * injection seluruhnya. Dokumen atau email yang disisipi markup tidak bisa
 * menghasilkan markup di layar karena **tidak ada jalur render untuk itu**
 * (docs/SECURITY.md §6, docs/AI_BEHAVIOR.md §8).
 *
 * Konsekuensinya mengikat ke arah sebaliknya juga: menambah satu bentuk balasan
 * berarti menambah varian di sini, bukan menyelipkan string yang akan dirender
 * mentah. Kalau suatu hari ada yang butuh "sedikit markdown saja", itu pertanda
 * varian baru yang kurang — bukan pertanda union ini terlalu ketat.
 *
 * Isi tiap varian mengeras di fasenya masing-masing; yang dibekukan sekarang adalah
 * **daftar varian**, karena itulah yang menjadi pagar keamanan.
 */

import type { Provenance } from './provenance.js';
import type { ProductMatchState } from './catalog.js';

/** Pasangan label–nilai untuk kartu yang menampilkan data tertangkap. */
export interface KeyValue {
  readonly label: string;
  readonly value: string;
}

/** Satu baris kartu "Yang sudah saya pahami" (layar 02). Mengeras di Fase 4. */
export interface SummaryField {
  readonly label: string;
  readonly value: string;
  /** Nilai yang ditampilkan **selalu** membawa asal-usulnya (SPEC §5 Policy 4). */
  readonly provenance: Provenance;
  /** Wajib terisi saat `provenance` adalah `ASSUMED` — invarian TV-1. */
  readonly reason?: string;
}

/** Satu pertanyaan klarifikasi (layar 03). Mengeras di Fase 5. */
export interface ClarificationQuestion {
  readonly id: string;
  readonly question: string;
  readonly options: readonly string[];
  /** "Belum tahu" selalu tersedia — pengguna tidak dipaksa menebak. */
  readonly allowUnknown: boolean;
}

/** Satu kriteria pemilihan (layar 08). Mengeras di Fase 5. */
export interface CriteriaItem {
  readonly label: string;
  readonly detail: string;
}

/**
 * Kartu produk (layar 07). Mengeras di Fase 7.
 *
 * `productId` wajib dan hanya pernah berasal dari katalog Pralon: kartu produk
 * tanpa baris di `products` tidak bisa dirakit, dan itulah yang membuat invarian
 * C-2 struktural, bukan sekadar aturan prompt.
 */
export interface ProductCardDto {
  readonly productId: string;
  readonly sku: string;
  readonly name: string;
  readonly sizeLabel: string | null;
  readonly state: ProductMatchState;
  readonly provenance: Provenance;
  readonly sourceDocument: string;
  readonly sourcePage: number;
  readonly imageUrl: string | null;
}

export type AssistantCard =
  | {
      readonly kind: 'summary';
      readonly fields: readonly SummaryField[];
      readonly readCount: number;
    }
  /** Maksimum 4 — lebih dari itu berhenti terasa seperti percakapan. */
  | { readonly kind: 'clarification'; readonly questions: readonly ClarificationQuestion[] }
  | { readonly kind: 'criteria'; readonly items: readonly CriteriaItem[] }
  | {
      readonly kind: 'unsupported';
      readonly reasons: readonly string[];
      readonly captured: readonly KeyValue[];
      readonly slaHours: number;
    }
  | { readonly kind: 'product'; readonly products: readonly ProductCardDto[] }
  | { readonly kind: 'cta'; readonly action: 'ANALYZE' | 'REGISTER' | 'CONTACT_TECHNICAL' };

export type AssistantCardKind = AssistantCard['kind'];

/** Maksimum pertanyaan klarifikasi dalam satu kartu (SPEC §33, layar 03). */
export const MAX_CLARIFICATION_QUESTIONS = 4;
