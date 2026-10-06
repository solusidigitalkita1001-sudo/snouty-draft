/**
 * Galat domain katalog, masing-masing membawa kode API-nya sendiri.
 *
 * Kodenya ikut di sini, bukan dipetakan di controller, supaya satu kebutuhan
 * tidak bisa dipenuhi dua kali dengan jawaban berbeda: `GET /products` dan
 * pipeline rekomendasi melaporkan katalog yang tidak tersedia dengan kode yang
 * sama karena keduanya melempar galat yang sama (docs/API_CONTRACTS.md §4).
 */

/**
 * Tidak ada versi katalog `active`.
 *
 * Retryable dan 503, bukan 404: ini keadaan sistem — katalog belum pernah
 * dipromosikan, atau database tidak terjangkau — bukan permintaan yang salah.
 * Pesannya mengikuti salinan desain apa adanya.
 */
export class CatalogUnavailableError extends Error {
  readonly code = 'CATALOG_UNAVAILABLE' as const;

  constructor() {
    super(
      'Koneksi ke katalog Pralon terputus. Kebutuhan Anda tetap tersimpan, jadi tidak perlu mengetik ulang.',
    );
    this.name = 'CatalogUnavailableError';
  }
}

/**
 * Versi aktif adalah katalog contoh (`kind = 'sample'`) di lingkungan yang tidak
 * mengizinkannya. Ke pengguna tampak sama dengan katalog yang tidak tersedia — dan memang
 * begitu: tidak ada katalog Pralon yang bisa dijawab. Dibedakan sebagai kelas supaya log
 * dan tes bisa menunjuk penyebabnya, bukan menduga dari pesan.
 */
export class SampleCatalogRefusedError extends CatalogUnavailableError {
  constructor(readonly catalogVersionId: string) {
    super();
    this.name = 'SampleCatalogRefusedError';
  }
}

/** Produk tidak ada **di versi katalog aktif** — bukan berarti tidak pernah ada. */
export class ProductNotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;

  constructor(readonly productId: string) {
    super('Produk tidak ditemukan di katalog Pralon yang aktif.');
    this.name = 'ProductNotFoundError';
  }
}

/**
 * Parameter kueri tidak lolos validasi.
 *
 * `details` memuat nama field yang bermasalah, bukan pesan zod mentah: pesan zod
 * ditulis untuk pengembang, dan `message` di kontrak ini dijanjikan aman
 * ditampilkan apa adanya ke pengguna.
 */
export class InvalidCatalogQueryError extends Error {
  readonly code = 'VALIDATION_FAILED' as const;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(fields: readonly string[]) {
    super('Ada isian yang belum sesuai.');
    this.name = 'InvalidCatalogQueryError';
    this.details = { fields };
  }
}
