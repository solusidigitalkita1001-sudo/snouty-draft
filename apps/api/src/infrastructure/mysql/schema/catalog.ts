import { sql } from 'drizzle-orm';
import {
  char,
  check,
  datetime,
  index,
  int,
  json,
  foreignKey,
  mysqlTable,
  primaryKey,
  text,
  tinyint,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

/**
 * Skema konteks katalog. docs/DATABASE.md §5–§6.
 *
 * Konvensi yang dipegang di seluruh berkas ini:
 *   - id `CHAR(26)` ULID — terurut waktu (baik untuk indeks) sekaligus tidak mudah ditebak
 *   - waktu `DATETIME(3)` UTC; konversi zona waktu di lapisan tampilan
 *   - enum sebagai `VARCHAR` + CHECK, bukan tipe ENUM MySQL, supaya menambah
 *     nilai tidak memerlukan ALTER pada tabel besar
 *   - provenance sebagai KOLOM di samping nilainya, bukan di dalam blob JSON,
 *     sehingga invarian P-1 bisa dibuktikan lewat query SQL, bukan hanya tes unit
 */

const id = () => char('id', { length: 26 });
const createdAt = () =>
  datetime('created_at', { fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`);
const updatedAt = () =>
  datetime('updated_at', { fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP(3)`);

/**
 * Versi katalog. Tepat satu berstatus `active`; impor masuk sebagai `draft`,
 * divalidasi, lalu dipromosikan. Rekomendasi membekukan `catalogVersionId`
 * supaya laporan lama tetap terbaca sama meski katalog berubah.
 */
export const catalogVersions = mysqlTable(
  'catalog_versions',
  {
    id: id().primaryKey(),
    /** Tampil sebagai "KATALOG PRALON · v2.4". */
    label: varchar('label', { length: 32 }).notNull(),
    /** mis. "Katalog produk Pralon 2026". */
    sourceDocument: varchar('source_document', { length: 255 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    effectiveFrom: datetime('effective_from', { fsp: 3 }).notNull(),
    importedBy: char('imported_by', { length: 26 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),

    /**
     * Kolom terbangkitkan yang bernilai 'active' hanya untuk versi aktif, dan
     * NULL untuk sisanya. Karena MySQL mengizinkan banyak NULL dalam unique
     * index, ini membuat "tepat satu versi aktif" menjadi jaminan database —
     * bukan aturan yang harus diingat setiap kali seseorang menulis kode promosi.
     */
    activeGuard: varchar('active_guard', { length: 6 }).generatedAlwaysAs(
      sql`(CASE WHEN \`status\` = 'active' THEN 'active' ELSE NULL END)`,
    ),
  },
  (t) => [
    uniqueIndex('uq_catalog_versions_label').on(t.label),
    uniqueIndex('uq_catalog_versions_single_active').on(t.activeGuard),
    index('ix_catalog_versions_status').on(t.status),
    check('ck_catalog_versions_status', sql`\`status\` IN ('draft','active','archived')`),
  ],
);

/**
 * Produk. Hanya produk Pralon pernah menjadi baris di sini — itulah yang membuat
 * Policy 1 struktural: produk kompetitor tidak punya `productId` untuk dirender
 * sebagai kartu, seberapa pun kreatifnya sebuah prompt (invarian C-2).
 */
export const products = mysqlTable(
  'products',
  {
    id: id().primaryKey(),
    catalogVersionId: char('catalog_version_id', { length: 26 }).notNull(),
    sku: varchar('sku', { length: 64 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    /** mis. "PVC AW" — dipakai matcher untuk menyaring per peran jalur. */
    family: varchar('family', { length: 80 }).notNull(),
    /** mis. "PIPA AIR BERSIH · SNI" — caption pada kartu produk. */
    category: varchar('category', { length: 120 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 16 }).notNull().default('active'),

    /**
     * Wajib. UI menampilkannya sebagai "Katalog produk Pralon 2026 · hal. 14",
     * dan baris itu adalah janji bahwa datanya bisa dicek. Produk tanpa rujukan
     * halaman ditolak saat impor.
     */
    sourceDocument: varchar('source_document', { length: 255 }).notNull(),
    sourcePage: int('source_page').notNull(),

    imageUrl: varchar('image_url', { length: 512 }),

    /**
     * Sidik jari baris impor yang melahirkan produk ini
     * (`catalog-import.contract.ts`).
     *
     * Unik bersama `catalog_version_id`, sehingga idempotensi job
     * `catalog.ingest` menjadi jaminan database: memproses ulang pesan yang sama
     * — hal yang pasti terjadi pada antrean dengan retry — tidak bisa
     * menduplikasi produk, bukan sekadar "sebaiknya tidak".
     */
    rowHash: char('row_hash', { length: 64 }).notNull(),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('uq_products_version_sku').on(t.catalogVersionId, t.sku),
    uniqueIndex('uq_products_version_row_hash').on(t.catalogVersionId, t.rowHash),
    // Bentuk query nyata matcher: saring keluarga + kategori + status.
    index('ix_products_family_category_status').on(t.family, t.category, t.status),
    index('ix_products_catalog_version').on(t.catalogVersionId),
    check('ck_products_status', sql`\`status\` IN ('active','discontinued')`),
    // Rujukan halaman wajib masuk akal: itu janji bahwa datanya bisa dicek.
    check('ck_products_source_page', sql`\`source_page\` > 0`),
    /**
     * FK **di dalam satu konteks** (docs/DATABASE.md §5). Tanpa ini baris anak yatim
     * mungkin terjadi — dan katalog yatim adalah data yang tidak bisa dijelaskan asalnya.
     * `CASCADE` karena anak-anak ini tidak punya arti tanpa induknya: ukuran tanpa produk
     * bukan apa-apa.
     */
    foreignKey({
      name: 'fk_products_version',
      columns: [t.catalogVersionId],
      foreignColumns: [catalogVersions.id],
    }).onDelete('cascade'),
  ],
);

/**
 * Ukuran yang tersedia per produk.
 *
 * `size_inches` disimpan sebagai angka supaya perbandingan dan pengurutan benar;
 * `size_label` menyimpan penulisan kanonik (`3/4"`, `1¼"`) supaya tampilan tidak
 * perlu memformat ulang dan tidak bisa menyimpang dari value object PipeSize.
 */
export const productSizes = mysqlTable(
  'product_sizes',
  {
    productId: char('product_id', { length: 26 }).notNull(),
    sizeInches: int('size_inches_x1000').notNull(),
    sizeLabel: varchar('size_label', { length: 16 }).notNull(),
    available: tinyint('available').notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.sizeInches] }),
    index('ix_product_sizes_lookup').on(t.productId, t.sizeInches),
    check('ck_product_sizes_positive', sql`\`size_inches_x1000\` > 0`),
    foreignKey({
      name: 'fk_product_sizes_product',
      columns: [t.productId],
      foreignColumns: [products.id],
    }).onDelete('cascade'),
  ],
);

/**
 * Spesifikasi teknis, satu baris per field.
 *
 * Kolom `provenance` hanya pernah `VERIFIED` atau `UNAVAILABLE`: tidak ada jalur
 * yang menghasilkan fakta produk bertanda `ASSUMED`. Nilai kosong TETAP menjadi
 * baris di sini dengan `provenance = 'UNAVAILABLE'`, bukan baris yang hilang —
 * UI perlu membedakan "belum ada datanya" (render "Lihat dokumen teknis") dari
 * "field tidak berlaku" (tidak dirender sama sekali).
 */
export const productSpecs = mysqlTable(
  'product_specs',
  {
    productId: char('product_id', { length: 26 }).notNull(),
    /** mis. 'material', 'standard', 'pressure_class', 'rod_length', 'joint_type', 'application'. */
    specKey: varchar('spec_key', { length: 48 }).notNull(),
    specValue: varchar('spec_value', { length: 255 }),
    provenance: varchar('provenance', { length: 16 }).notNull(),
    sourceDocument: varchar('source_document', { length: 255 }),
    sourcePage: int('source_page'),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.specKey] }),
    /**
     * Invarian C-1 sebagai constraint database, bukan sekadar tes: fakta produk
     * tidak pernah bisa bertanda ASSUMED atau ESTIMATED. Kalau suatu hari ada
     * kode yang mencoba menyimpannya, database yang menolak.
     */
    check('ck_product_specs_provenance', sql`\`provenance\` IN ('VERIFIED','UNAVAILABLE')`),
    /** Nilai kosong WAJIB bertanda UNAVAILABLE — tidak boleh diam-diam VERIFIED. */
    check(
      'ck_product_specs_empty_is_unavailable',
      sql`(\`spec_value\` IS NOT NULL) OR (\`provenance\` = 'UNAVAILABLE')`,
    ),
    foreignKey({
      name: 'fk_product_specs_product',
      columns: [t.productId],
      foreignColumns: [products.id],
    }).onDelete('cascade'),
  ],
);

/**
 * Fitting yang sepadan.
 *
 * Daftar "FITTING YANG SEPADAN" di drawer produk dirender dari tabel ini, bukan
 * dicocokkan ulang berdasarkan kesamaan ukuran. Janji produk — "satu ekosistem
 * fitting mengurangi risiko sambungan bocor" — hanya bermakna bila
 * kompatibilitasnya data, bukan tebakan.
 */
export const productCompatibility = mysqlTable(
  'product_compatibility',
  {
    productId: char('product_id', { length: 26 }).notNull(),
    compatibleProductId: char('compatible_product_id', { length: 26 }).notNull(),
    /** 'tee' | 'elbow' | 'reducer' | 'socket'. */
    kind: varchar('kind', { length: 24 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.compatibleProductId] }),
    index('ix_product_compatibility_kind').on(t.productId, t.kind),
    check('ck_product_compatibility_kind', sql`\`kind\` IN ('tee','elbow','reducer','socket')`),
    check('ck_product_compatibility_not_self', sql`\`product_id\` <> \`compatible_product_id\``),
    // Dua FK: kedua sisi relasi harus produk yang benar-benar ada, atau "kompatibel
    // dengan" menunjuk ke ketiadaan.
    foreignKey({
      name: 'fk_product_compatibility_product',
      columns: [t.productId],
      foreignColumns: [products.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'fk_product_compatibility_compatible',
      columns: [t.compatibleProductId],
      foreignColumns: [products.id],
    }).onDelete('cascade'),
  ],
);

/** Dokumen teknis yang bisa dibuka dari drawer produk ("Buka dokumen teknis"). */
export const productDocuments = mysqlTable(
  'product_documents',
  {
    id: id().primaryKey(),
    productId: char('product_id', { length: 26 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    url: varchar('url', { length: 512 }).notNull(),
    page: int('page'),
  },
  (t) => [
    index('ix_product_documents_product').on(t.productId),
    foreignKey({
      name: 'fk_product_documents_product',
      columns: [t.productId],
      foreignColumns: [products.id],
    }).onDelete('cascade'),
  ],
);

/** Foto produk 1:1. Kosong berarti placeholder bergaris — tidak pernah foto produk lain. */
export const productImages = mysqlTable(
  'product_images',
  {
    id: id().primaryKey(),
    productId: char('product_id', { length: 26 }).notNull(),
    url: varchar('url', { length: 512 }).notNull(),
    sortOrder: int('sort_order').notNull().default(0),
  },
  (t) => [
    index('ix_product_images_product').on(t.productId),
    foreignKey({
      name: 'fk_product_images_product',
      columns: [t.productId],
      foreignColumns: [products.id],
    }).onDelete('cascade'),
  ],
);

/**
 * Satu kali upaya impor katalog.
 *
 * Ada karena idempotensi job membutuhkan identitas yang terbit **sebelum**
 * pekerjaannya dimulai. Kunci baris adalah `catalogVersionId + rowHash`, tetapi
 * versi katalog sendiri baru dibuat setelah validasi lolos — jadi tanpa tabel
 * ini, menjalankan ulang satu pesan akan membuat versi draft kedua yang terlihat
 * sah. Dengan tabel ini, pesan membawa `catalogImportRunId`, dan versi yang sudah
 * terpaut pada run itu dipakai kembali, bukan dibuat lagi.
 *
 * Laporan galat disimpan apa adanya dari validator: admin katalog melihat
 * laporan yang sama persis dengan yang dipakai job untuk menolak impor.
 */
export const catalogImportRuns = mysqlTable(
  'catalog_import_runs',
  {
    id: id().primaryKey(),
    label: varchar('label', { length: 32 }).notNull(),
    sourceDocument: varchar('source_document', { length: 255 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('pending'),

    /**
     * Terisi begitu validasi lolos dan versi draft dibuat — **sebelum** run
     * ditandai selesai, dan itu memang disengaja.
     *
     * Godaannya adalah memaksa kolom ini hanya terisi saat `status = 'ingested'`.
     * Itu justru mematikan idempotensi: proses yang mati setelah versi terbentuk
     * tetapi sebelum run ditandai selesai akan kehilangan jejak versinya, dan
     * pengiriman ulang pesan — hal yang pasti terjadi pada antrean dengan retry —
     * membuat versi draft KEDUA yang terlihat sah. Dengan penautan lebih awal,
     * percobaan berikutnya memakai ulang versi yang sama.
     */
    catalogVersionId: char('catalog_version_id', { length: 26 }),

    rowsAccepted: int('rows_accepted').notNull().default(0),
    rowsRejected: int('rows_rejected').notNull().default(0),
    /** `CatalogImportIssue[]` apa adanya — nomor baris, kolom, dan pesannya. */
    issues: json('issues'),

    requestedBy: char('requested_by', { length: 26 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    finishedAt: datetime('finished_at', { fsp: 3 }),
  },
  (t) => [
    /** Satu versi katalog tidak pernah lahir dari dua run. */
    uniqueIndex('uq_catalog_import_runs_version').on(t.catalogVersionId),
    index('ix_catalog_import_runs_status').on(t.status),
    check(
      'ck_catalog_import_runs_status',
      sql`\`status\` IN ('pending','rejected','ingested','failed')`,
    ),
  ],
);
