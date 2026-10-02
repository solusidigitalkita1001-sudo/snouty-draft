/**
 * `<ProvenanceTag>` — **satu-satunya** cara merender tag status.
 * docs/DESIGN_IMPLEMENTATION.md §6 · SPEC §5 Policy 4.
 *
 * Ia menerima `Provenance`, bukan string: tidak ada prop yang menerima
 * "TERVERIFIKASI", sehingga tak ada jalur untuk menampilkan tag itu atas nilai yang
 * tidak layak. "TERVERIFIKASI" hanya pernah muncul untuk `VERIFIED`.
 *
 * Warna tidak pernah menjadi satu-satunya pembawa makna — tag selalu berisi teks.
 * Bagi pengguna buta warna merah-hijau, perbedaan hijau/amber hilang total; teks yang
 * membawanya.
 */

import type { Provenance } from '@snouty/shared-types';
import styles from './solution.module.css';

const LABEL: Readonly<Record<Provenance, string>> = {
  VERIFIED: 'TERVERIFIKASI',
  ASSUMED: 'ASUMSI',
  ESTIMATED: 'ESTIMASI',
  UNAVAILABLE: 'LIHAT DOKUMEN TEKNIS',
};

const TONE: Readonly<Record<Provenance, string>> = {
  VERIFIED: styles.tagVerified!,
  ASSUMED: styles.tagAssumed!,
  ESTIMATED: styles.tagAssumed!,
  UNAVAILABLE: styles.tagUnavailable!,
};

export function ProvenanceTag({ provenance }: { provenance: Provenance }) {
  return <span className={[styles.tag, TONE[provenance]].join(' ')}>{LABEL[provenance]}</span>;
}

/**
 * Nilai spesifikasi beserta tagnya. `UNAVAILABLE` **tidak merender nilai sama sekali**
 * — ia menampilkan "Lihat dokumen teknis". Mengisi kolom kosong dengan perkiraan
 * adalah cara halus berhalusinasi (docs/PRODUCT_KNOWLEDGE.md §4).
 */
export function SpecCell({ value, provenance }: { value: string | null; provenance: Provenance }) {
  if (provenance === 'UNAVAILABLE' || value === null) {
    return <span className={styles.specMissing}>Lihat dokumen teknis</span>;
  }
  return (
    <span className={styles.specValue}>
      {value} <ProvenanceTag provenance={provenance} />
    </span>
  );
}
