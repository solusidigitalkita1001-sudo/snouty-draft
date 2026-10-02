/**
 * Gerbang provenance keluar engine. docs/ENGINEERING_RULES.md §2.
 *
 * **Satu-satunya jalan keluar.** Aturan yang belum ditandatangani ahli domain (OQ-06)
 * tidak pernah menghasilkan `VERIFIED`, seberapa pun yakin perhitungannya. Dan bahkan
 * aturan yang sudah divalidasi hanya menghasilkan `VERIFIED` bila dimensi bangunan
 * benar-benar diketahui — tanpa itu, angkanya estimasi, persis seperti tag desain
 * "ESTIMASI · DIMENSI BELUM LENGKAP".
 *
 * Gerbang ini sengaja diduplikasi dengan yang ada di modul `policy` (P5-03): yang di
 * sini menjaga keluaran engine di dalam paket murni, yang di sana menjaga apa pun yang
 * akan ditampilkan. Keduanya menegakkan invarian P-2 dari sisi berbeda, dan keduanya
 * diuji.
 */

import type { RuleValidationStatus } from './rule.js';

export type Provenance = 'VERIFIED' | 'ASSUMED' | 'ESTIMATED' | 'UNAVAILABLE';

export interface GateInput {
  readonly ruleStatus: RuleValidationStatus;
  /** Apakah dimensi bangunan nyata tersedia (bukan default/kosong). */
  readonly hasRealDimensions: boolean;
}

export function gateEngineProvenance(input: GateInput): Provenance {
  if (input.ruleStatus === 'REJECTED') return 'UNAVAILABLE';
  if (input.ruleStatus !== 'VALIDATED') return 'ASSUMED';
  return input.hasRealDimensions ? 'VERIFIED' : 'ESTIMATED';
}
