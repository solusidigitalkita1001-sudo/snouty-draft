/**
 * Menaikkan provenance jejak hitung setelah aturannya ditandatangani (P31-83, OQ-06).
 * **Fungsi murni, tanpa I/O.**
 *
 * Paket `@snouty/engineering` tidak tahu — dan tidak boleh tahu — siapa yang sudah
 * menandatangani apa: ia bebas I/O, dan itulah yang membuat laporan lama bisa dibuat ulang
 * identik. Jadi ia selalu memberi status yang tertulis di kodenya sendiri, yaitu
 * `REQUIRES_DOMAIN_VALIDATION` untuk semua aturan, yang berarti `ASSUMED`.
 *
 * Tanda tangan dibaca di tepi aplikasi, dan gerbang yang sama dihitung ulang di sini dengan
 * status yang sebenarnya berlaku. Yang ikut naik hanya nilai yang memang layak: aturan yang
 * ditandatangani **dan** dimensi yang benar-benar diketahui menghasilkan `VERIFIED`; tanpa
 * dimensi nyata ia berhenti di `ESTIMATED`, persis aturan yang sudah berlaku sejak Fase 6.
 *
 * Aturan yang **ditolak** ahli tidak boleh menampilkan nilai sama sekali — itu arti menolak.
 */
import { gateEngineProvenance, type RuleValidationStatus } from '@snouty/engineering';
import type { Provenance } from '@snouty/shared-types';

export interface SignedTraceInput {
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly provenance: Provenance;
  readonly hasRealDimensions?: boolean;
}

/** Satu tanda tangan yang sudah tercatat. */
export interface SignedDecisionRow {
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly decision: 'approved' | 'rejected';
}

/** Dari mana tanda tangan dibaca. Modul recommendation hanya butuh sebanyak ini. */
export interface RuleDecisionSource {
  decisions(): Promise<readonly SignedDecisionRow[]>;
}

/** Status aturan menurut tanda tangan, atau null bila aturan itu masih menunggu. */
export type SignedStatusLookup = (
  ruleId: string,
  ruleVersion: number,
) => RuleValidationStatus | null;

/**
 * Provenance yang berlaku untuk satu jejak.
 *
 * Tanpa tanda tangan, apa pun yang sudah dihitung engine dibiarkan apa adanya — termasuk
 * `UNAVAILABLE`, yang tidak pernah dinaikkan oleh siapa pun.
 */
export function signedProvenance(
  trace: SignedTraceInput,
  signedStatus: SignedStatusLookup,
): Provenance {
  // Aturan yang sudah ditolak di dalam kode engine tidak bisa dihidupkan lewat basis data —
  // sejajar dengan `statusOf()` di layar validasi aturan.
  if (trace.provenance === 'UNAVAILABLE') return 'UNAVAILABLE';
  const status = signedStatus(trace.ruleId, trace.ruleVersion);
  if (status === null) return trace.provenance;
  return gateEngineProvenance({
    ruleStatus: status,
    hasRealDimensions: trace.hasRealDimensions ?? false,
  });
}

/** Peta tanda tangan menjadi pencarian per aturan + versi. */
export function signedStatusFrom(rows: readonly SignedDecisionRow[]): SignedStatusLookup {
  const byKey = new Map(rows.map((row) => [`${row.ruleId}@${row.ruleVersion}`, row.decision]));
  return (ruleId, ruleVersion) => {
    const decision = byKey.get(`${ruleId}@${ruleVersion}`);
    if (decision === undefined) return null;
    return decision === 'approved' ? 'VALIDATED' : 'REJECTED';
  };
}
