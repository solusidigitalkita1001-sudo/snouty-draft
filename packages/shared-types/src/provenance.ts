/**
 * Provenance — satu-satunya kosakata yang dipahami UI untuk asal-usul nilai.
 * SPEC §5 Policy 4 · docs/DOMAIN_MODEL.md §2.
 *
 * Invarian P-1: aturan ber-status REQUIRES_DOMAIN_VALIDATION tidak pernah
 * menghasilkan VERIFIED. Gerbangnya menyusul bersama Engineering Engine (Fase 6).
 */
export type Provenance = 'VERIFIED' | 'ASSUMED' | 'ESTIMATED' | 'UNAVAILABLE';

/** Dari mana sebuah nilai kebutuhan berasal. Presedensi merge di docs/CONTEXT_ENGINE.md §4. */
export type FieldSource = 'user_stated' | 'user_edited' | 'default_applied' | 'inferred';

/**
 * Setiap field kebutuhan adalah ini — tidak pernah skalar telanjang.
 *
 * Invarian TV-1: provenance 'ASSUMED' mewajibkan `reason` terisi, karena kalimat
 * itulah yang muncul di kartu "Asumsi yang digunakan". Asumsi tanpa alasan
 * berarti asumsi yang tidak terlihat pengguna.
 */
export interface TrackedValue<T> {
  readonly value: T | null;
  readonly provenance: Provenance;
  readonly source: FieldSource;
  readonly reason?: string;
  readonly ruleId?: string;
  readonly updatedAt: string;
}
