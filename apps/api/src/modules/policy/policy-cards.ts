/**
 * Menerjemahkan keputusan kebijakan menjadi `AssistantCard`. SPEC §5 · layar 08, 11.
 * **Fungsi murni, tanpa I/O.**
 *
 * Policy 3 (batas rekomendasi) hidup di dua tempat yang saling melengkapi: `scopePolicy`
 * memutuskan skenario mana yang di luar cakupan, dan gerbang provenance memastikan
 * aturan yang belum divalidasi tidak pernah terlihat pasti. Berkas ini bagian yang
 * dilihat pengguna.
 *
 * Kalimat SLA dan "bukan sertifikasi teknis" adalah janji produk, bukan redaksi
 * (docs/DESIGN_IMPLEMENTATION.md §10) — ia hidup di satu tempat dan tidak diparafrase.
 */

import {
  DEFAULT_LOCALE,
  type AssistantCard,
  type KeyValue,
  type Locale,
} from '@snouty/shared-types';
import { neutralCriteria, type PolicyOutcome } from './scope.js';

/** Janji waktu tanggap tim teknis (layar 11). Satu angka, satu tempat. */
export const TECHNICAL_SLA_HOURS = 24;

/**
 * Kartu untuk sebuah keputusan kebijakan, atau `null` bila alurnya didukung penuh
 * (tidak ada yang perlu dikatakan — rekomendasi yang bicara).
 */
export function policyCard(
  outcome: PolicyOutcome,
  captured: readonly KeyValue[] = [],
  locale: Locale = DEFAULT_LOCALE,
): AssistantCard | null {
  if (outcome.kind === 'supported') return null;

  if (outcome.code === 'COMPETITOR_COMPARISON_REFUSED') {
    // Layar 08: kriteria netral. Menolak membandingkan TANPA menjelaskan cara memilih
    // akan meninggalkan pengguna tanpa jalan keluar — dan itu bukan jawaban.
    return {
      kind: 'criteria',
      items: neutralCriteria(locale).map((detail) => ({
        label: locale === 'en' ? 'Criterion' : 'Kriteria',
        detail,
      })),
    };
  }

  // Layar 11: validasi teknis / belum didukung. Kebutuhan yang sudah terkumpul
  // dibawa serta supaya pengguna tidak mengulang cerita ke tim teknis.
  return {
    kind: 'unsupported',
    reasons: outcome.reasons,
    captured,
    slaHours: TECHNICAL_SLA_HOURS,
  };
}
