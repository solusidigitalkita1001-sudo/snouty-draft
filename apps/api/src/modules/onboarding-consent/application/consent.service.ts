/**
 * Use case consent. docs/PRIVACY.md §3.
 *
 * Tiga sifat yang dipegang di sini:
 *
 * **Append-only.** Memberi, menolak, dan memberi-lagi-setelah-mencabut semuanya
 * baris baru. Keadaan sekarang = baris terbaru; sejarah = buktinya.
 *
 * **Penolakan bukan penghalang.** Desain menegaskan "SNOUTY tetap bisa digunakan
 * tanpa lokasi" — maka `deny` mencatat dan selesai. Tidak ada jalur di sini yang
 * mengembalikan "tidak boleh lanjut".
 *
 * **`policyVersion` datang dari config, bukan dari klien.** Versi kebijakan yang
 * disetujui adalah fakta sisi server; klien yang bisa memilihnya sendiri bisa
 * menyetujui versi yang tidak pernah ditampilkan kepadanya.
 */

import { ulid } from '../../../shared/ulid.js';
import type {
  ConsentKind,
  ConsentRepository,
  ConsentRow,
  ConsentSubject,
} from '../domain/consent.repository.js';

export interface ConsentState {
  readonly kind: ConsentKind;
  readonly granted: boolean;
  readonly policyVersion: string;
  readonly grantedAt: Date;
  readonly revokedAt: Date | null;
}

export class ConsentService {
  constructor(
    private readonly repository: ConsentRepository,
    private readonly policyVersion: string,
  ) {}

  async record(subject: ConsentSubject, kind: ConsentKind, granted: boolean): Promise<void> {
    await this.repository.append({
      id: ulid(),
      subject,
      kind,
      granted,
      policyVersion: this.policyVersion,
    });
  }

  /**
   * Mencabut persetujuan yang sedang berlaku. Idempoten: mencabut yang sudah
   * tercabut — atau yang tidak pernah diberikan — bukan kesalahan, karena keadaan
   * akhirnya sama: tidak ada persetujuan yang berlaku.
   */
  async revoke(subject: ConsentSubject, kind: ConsentKind): Promise<void> {
    const latest = await this.repository.findLatest(subject, kind);
    if (latest === null || !latest.granted || latest.revokedAt !== null) return;
    await this.repository.markRevoked(latest.id);
  }

  /** Keadaan sekarang per jenis. Jenis yang tidak pernah disentuh tidak muncul. */
  async current(subject: ConsentSubject): Promise<readonly ConsentState[]> {
    const rows = await this.repository.findAllLatest(subject);
    return rows.map(toState);
  }

  /** Satu pertanyaan yang akan sering ditanya kode lain: "boleh pakai lokasi?". */
  async isGranted(subject: ConsentSubject, kind: ConsentKind): Promise<boolean> {
    const latest = await this.repository.findLatest(subject, kind);
    return latest !== null && latest.granted && latest.revokedAt === null;
  }
}

function toState(row: ConsentRow): ConsentState {
  return {
    kind: row.kind,
    granted: row.granted && row.revokedAt === null,
    policyVersion: row.policyVersion,
    grantedAt: row.grantedAt,
    revokedAt: row.revokedAt,
  };
}
