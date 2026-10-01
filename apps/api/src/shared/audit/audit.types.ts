/**
 * Siapa yang melakukan sebuah tulis internal. docs/BACKOFFICE.md §6.
 *
 * Tinggal di `shared` karena setiap modul yang punya rute `/internal/*` akan
 * memakainya, bukan karena katalog membutuhkannya lebih dulu.
 */
export interface AuditActor {
  readonly id: string;
  /**
   * Peran **saat aksi dilakukan**, bukan peran sekarang.
   *
   * Menyimpannya sebagai nilai, bukan sebagai rujukan ke akun, adalah inti audit:
   * seseorang yang mempromosikan katalog sebagai `catalog_admin` lalu dicabut
   * perannya tetap tercatat melakukannya sebagai `catalog_admin`.
   */
  readonly role: string;
  readonly correlationId?: string;
  readonly ip?: string;
}

/** Verba audit tetap Inggris, seperti identifier lain di basis kode ini. */
export const AUDIT_ACTIONS = {
  catalogVersionPromote: 'catalog.version.promote',
  catalogVersionArchive: 'catalog.version.archive',
} as const;

export const AUDIT_ENTITIES = {
  catalogVersion: 'catalog_version',
} as const;
