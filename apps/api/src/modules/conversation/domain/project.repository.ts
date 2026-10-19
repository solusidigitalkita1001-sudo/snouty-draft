/**
 * Port repository proyek (P24-02, pemilik 2026-10-19: "ala Claude: ada project"). Proyek hanya milik
 * akun terdaftar; tamu tidak punya riwayat, jadi tidak punya proyek. Kepemilikan diperiksa di
 * `ProjectService`, bukan hanya lewat `WHERE` (docs/SECURITY.md §4).
 */

export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');

export interface ProjectRow {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  /** Catatan proyek (lokasi, sumber air, preferensi bahan) — ikut dibaca konsultasi baru di dalamnya. */
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface ProjectWithCount extends ProjectRow {
  readonly conversationCount: number;
}

export interface ProjectRepository {
  create(row: { id: string; ownerId: string; name: string; notes: string | null }): Promise<void>;
  /** Termasuk yang dihapus lunak — pemanggil memutuskan. */
  findById(id: string): Promise<ProjectRow | null>;
  /** Proyek aktif milik pemilik, terbaru diperbarui dulu, dengan jumlah konsultasi aktifnya. */
  list(ownerId: string): Promise<readonly ProjectWithCount[]>;
  update(id: string, patch: { name?: string; notes?: string | null }): Promise<void>;
  /** Hapus lunak; konsultasi di dalamnya dilepas dari proyek (tetap ada di riwayat). */
  softDelete(id: string): Promise<void>;
  /** Menandai proyek baru disentuh — konsultasi baru di dalamnya menaikkannya ke atas. */
  touch(id: string): Promise<void>;
}
