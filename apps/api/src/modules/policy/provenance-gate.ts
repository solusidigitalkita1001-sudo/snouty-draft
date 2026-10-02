/**
 * Policy 4 — gerbang provenance. SPEC §5 · docs/DOMAIN_MODEL.md §9 (invarian P-2).
 * **Fungsi murni, tanpa I/O.**
 *
 * Invarian yang dijaga di sini: **aturan ber-status `REQUIRES_DOMAIN_VALIDATION`
 * tidak pernah menghasilkan `VERIFIED`.** Nilai dari aturan yang belum ditandatangani
 * ahli domain Pralon (OQ-06) adalah asumsi, seberapa pun yakin perhitungannya.
 *
 * Gerbang ini satu-satunya jalan nilai bisa menjadi `VERIFIED`: tidak ada tempat lain
 * di sistem yang menuliskannya untuk nilai hasil hitungan. Itu membuat invariannya
 * struktural — tidak ada `provenance: 'VERIFIED'` yang tersebar untuk dilewatkan.
 */

import type { Provenance } from '@snouty/shared-types';
import type { RuleValidationStatus } from '@snouty/engineering';

export interface GateInput {
  /** Status validasi aturan yang menghasilkan nilai ini. */
  readonly ruleStatus: RuleValidationStatus;
  /** Provenance yang diminta pemanggil berdasarkan kualitas datanya. */
  readonly requested: Provenance;
}

/**
 * Menurunkan provenance ke tingkat yang benar-benar bisa dipertanggungjawabkan.
 *
 * - Aturan `VALIDATED` → provenance yang diminta berlaku apa adanya.
 * - Aturan `REQUIRES_DOMAIN_VALIDATION` → `VERIFIED` turun menjadi `ASSUMED`; yang
 *   sudah lebih rendah (`ESTIMATED`, `UNAVAILABLE`) tidak dinaikkan.
 * - Aturan `REJECTED` → tidak ada nilai yang boleh ditampilkan: `UNAVAILABLE`.
 */
export function gateProvenance(input: GateInput): Provenance {
  if (input.ruleStatus === 'REJECTED') return 'UNAVAILABLE';

  if (input.ruleStatus === 'REQUIRES_DOMAIN_VALIDATION' && input.requested === 'VERIFIED') {
    return 'ASSUMED';
  }

  return input.requested;
}

/**
 * Apakah tag "TERVERIFIKASI" boleh dirender. Satu-satunya pemeriksaan yang dipakai
 * UI; `<ProvenanceTag>` menerima `Provenance`, bukan string bebas, sehingga tidak
 * ada jalur untuk menampilkan tag itu atas nilai yang tidak layak.
 */
export function mayRenderVerified(provenance: Provenance): boolean {
  return provenance === 'VERIFIED';
}
