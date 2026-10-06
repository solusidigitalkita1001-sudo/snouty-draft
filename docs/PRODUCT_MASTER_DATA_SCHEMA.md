# Master Data Produk — Skema DB, Kontrak Impor, dan Contoh Katalog (1:1 dengan kode)

2026-10-06 · Pendamping `docs/PRODUCT_MASTER_DATA.md`. Semua yang di bawah ini disalin dari kode
yang berjalan (branch `phase-1/P1-01-catalog-foundation`), bukan diringkas ulang. Sumber berkas:

| Bagian                                 | Berkas di repo                                                            |
| -------------------------------------- | ------------------------------------------------------------------------- |
| Skema MySQL (Drizzle)                  | `apps/api/src/infrastructure/mysql/schema/catalog.ts`                     |
| Kontrak impor (bentuk setelah parsing) | `apps/api/src/modules/product-catalog/domain/catalog-import.contract.ts`  |
| Kunci spesifikasi                      | `apps/api/src/modules/product-catalog/domain/catalog-spec-keys.ts`        |
| Ukuran pipa (value object)             | `packages/shared-types/src/pipe-size.ts`                                  |
| Tipe domain (API ↔ web)                | `packages/shared-types/src/catalog.ts`                                    |
| Validator impor                        | `apps/api/src/modules/product-catalog/domain/catalog-import.validator.ts` |
| Katalog contoh yang aktif sekarang     | `apps/api/scripts/seed-sample-catalog.mjs`                                |

Tidak ada Prisma/TypeORM; ORM-nya **Drizzle** di atas MySQL 8. Tidak ada skema zod untuk impor:
validasinya fungsi murni atas `CatalogImportSource` (bagian 2 dan 5).

---

## 1. Skema MySQL (Drizzle, `catalog.ts`)

Konvensi: id `CHAR(26)` ULID; waktu `DATETIME(3)` UTC; enum sebagai `VARCHAR` + `CHECK`;
provenance sebagai **kolom** di samping nilai, bukan di dalam JSON.

```ts
/** Versi katalog. Tepat satu `active` (dijamin unique index atas kolom terbangkitkan). */
export const catalogVersions = mysqlTable(
  'catalog_versions',
  {
    id: char('id', { length: 26 }).primaryKey(),
    label: varchar('label', { length: 32 }).notNull(), // "KATALOG PRALON · v2.4"
    sourceDocument: varchar('source_document', { length: 255 }).notNull(), // "Katalog produk Pralon 2026"
    kind: varchar('kind', { length: 8 }).notNull().default('pralon'), // 'pralon' | 'sample'
    status: varchar('status', { length: 16 }).notNull().default('draft'), // 'draft' | 'active' | 'archived'
    effectiveFrom: datetime('effective_from', { fsp: 3 }).notNull(),
    importedBy: char('imported_by', { length: 26 }).notNull(),
    createdAt,
    updatedAt,
    activeGuard: varchar('active_guard', { length: 6 }).generatedAlwaysAs(
      sql`(CASE WHEN status = 'active' THEN 'active' ELSE NULL END)`,
    ),
  },
  (t) => [
    uniqueIndex('uq_catalog_versions_label').on(t.label),
    uniqueIndex('uq_catalog_versions_single_active').on(t.activeGuard),
    check('ck_catalog_versions_status', sql`status IN ('draft','active','archived')`),
  ],
);

/** Produk. Hanya produk Pralon pernah menjadi baris di sini (Policy 1 struktural). */
export const products = mysqlTable(
  'products',
  {
    id: char('id', { length: 26 }).primaryKey(),
    catalogVersionId: char('catalog_version_id', { length: 26 }).notNull(),
    sku: varchar('sku', { length: 64 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    family: varchar('family', { length: 80 }).notNull(), // "PVC AW" — dipakai matcher per peran
    category: varchar('category', { length: 120 }).notNull(), // "PIPA AIR BERSIH · SNI" — caption kartu
    description: text('description'),
    status: varchar('status', { length: 16 }).notNull().default('active'), // 'active' | 'discontinued'
    sourceDocument: varchar('source_document', { length: 255 }).notNull(), // wajib: "… · hal. 14"
    sourcePage: int('source_page').notNull(), // wajib, > 0
    imageUrl: varchar('image_url', { length: 512 }),
    rowHash: char('row_hash', { length: 64 }).notNull(), // sidik jari baris impor (idempotensi)
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('uq_products_version_sku').on(t.catalogVersionId, t.sku),
    uniqueIndex('uq_products_version_row_hash').on(t.catalogVersionId, t.rowHash),
    index('ix_products_family_category_status').on(t.family, t.category, t.status),
    check('ck_products_status', sql`status IN ('active','discontinued')`),
    check('ck_products_source_page', sql`source_page > 0`),
    foreignKey({ columns: [t.catalogVersionId], foreignColumns: [catalogVersions.id] }).onDelete(
      'cascade',
    ),
  ],
);

/** Ukuran per produk. Angka untuk membandingkan, label kanonik untuk tampil. */
export const productSizes = mysqlTable(
  'product_sizes',
  {
    productId: char('product_id', { length: 26 }).notNull(),
    sizeInches: int('size_inches_x1000').notNull(), // 0.75" → 750
    sizeLabel: varchar('size_label', { length: 16 }).notNull(), // '3/4"', '1¼"'
    available: tinyint('available').notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.sizeInches] }),
    check('ck_product_sizes_positive', sql`size_inches_x1000 > 0`),
    foreignKey({ columns: [t.productId], foreignColumns: [products.id] }).onDelete('cascade'),
  ],
);

/** Spesifikasi, satu baris per field. Provenance hanya VERIFIED | UNAVAILABLE (invarian C-1). */
export const productSpecs = mysqlTable(
  'product_specs',
  {
    productId: char('product_id', { length: 26 }).notNull(),
    specKey: varchar('spec_key', { length: 48 }).notNull(), // material | standard | pressure_class | rod_length | joint_type | application
    specValue: varchar('spec_value', { length: 255 }), // NULL ⇔ UNAVAILABLE
    provenance: varchar('provenance', { length: 16 }).notNull(),
    sourceDocument: varchar('source_document', { length: 255 }),
    sourcePage: int('source_page'),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.specKey] }),
    check('ck_product_specs_provenance', sql`provenance IN ('VERIFIED','UNAVAILABLE')`),
    check(
      'ck_product_specs_empty_is_unavailable',
      sql`(spec_value IS NOT NULL) OR (provenance = 'UNAVAILABLE')`,
    ),
    foreignKey({ columns: [t.productId], foreignColumns: [products.id] }).onDelete('cascade'),
  ],
);

/** Fitting sepadan — dari tabel, bukan dari kesamaan ukuran. */
export const productCompatibility = mysqlTable(
  'product_compatibility',
  {
    productId: char('product_id', { length: 26 }).notNull(),
    compatibleProductId: char('compatible_product_id', { length: 26 }).notNull(),
    kind: varchar('kind', { length: 24 }).notNull(), // 'tee' | 'elbow' | 'reducer' | 'socket'
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.compatibleProductId] }),
    check('ck_product_compatibility_kind', sql`kind IN ('tee','elbow','reducer','socket')`),
    check('ck_product_compatibility_not_self', sql`product_id <> compatible_product_id`),
    // dua FK ke products(id), cascade
  ],
);

/** Dokumen teknis yang ditawarkan di drawer produk (tidak dibaca untuk menambal kolom kosong). */
export const productDocuments = mysqlTable('product_documents', {
  id: char('id', { length: 26 }).primaryKey(),
  productId: char('product_id', { length: 26 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  url: varchar('url', { length: 512 }).notNull(),
  page: int('page'),
});

/** Foto produk 1:1; kosong → placeholder, tidak pernah foto produk lain. */
export const productImages = mysqlTable('product_images', {
  id: char('id', { length: 26 }).primaryKey(),
  productId: char('product_id', { length: 26 }).notNull(),
  url: varchar('url', { length: 512 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
});

/** Satu upaya impor; identitas terbit sebelum pekerjaan dimulai (idempotensi job). */
export const catalogImportRuns = mysqlTable(
  'catalog_import_runs',
  {
    id: char('id', { length: 26 }).primaryKey(),
    label: varchar('label', { length: 32 }).notNull(),
    sourceDocument: varchar('source_document', { length: 255 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('pending'), // pending|rejected|ingested|failed
    catalogVersionId: char('catalog_version_id', { length: 26 }),
    rowsAccepted: int('rows_accepted').notNull().default(0),
    rowsRejected: int('rows_rejected').notNull().default(0),
    issues: json('issues'), // CatalogImportIssue[]
    requestedBy: char('requested_by', { length: 26 }).notNull(),
    createdAt,
    updatedAt,
    finishedAt,
  },
  (t) => [uniqueIndex('uq_catalog_import_runs_version').on(t.catalogVersionId)],
);
```

Catatan untuk brainstorming: belum ada kolom untuk **OD/tebal dinding/ID**, **tekanan kerja numerik**,
**kekakuan ring (SN)**, **panjang gulungan HDPE**, **suhu maks**, maupun **peran yang disarankan**.
Semuanya hari ini hanya bisa masuk sebagai teks di `product_specs` (lihat `PRODUCT_MASTER_DATA.md` §3).

---

## 2. Kontrak impor (`catalog-import.contract.ts`)

Yang dibekukan adalah bentuk **setelah parsing**; adapter Excel/CSV/ERP tinggal menghasilkan ini.

```ts
export interface RawCatalogRow {
  readonly rowNumber: number; // nomor baris di sumber (header = 1)
  readonly values: Readonly<Record<string, string | readonly string[]>>;
}

export interface CatalogImportSource {
  readonly label: string; // label versi, mis. "v2.4"
  readonly sourceDocument: string; // dokumen asal baku; baris boleh menimpa lewat kolom source_document
  readonly columns: readonly string[]; // kolom yang benar-benar ada (kolom wajib hilang dilaporkan sekali)
  readonly rows: readonly RawCatalogRow[];
}

export interface CatalogImportAdapter {
  // implementasi untuk format Pralon BELUM ADA (OQ-07)
  readonly format: string; // 'xlsx' | 'csv' | …
  supports(filename: string, mimeType: string): boolean;
  read(input: {
    label: string;
    sourceDocument: string;
    bytes: Uint8Array;
  }): Promise<CatalogImportSource>;
}

export const CATALOG_IMPORT_COLUMNS = {
  required: ['sku', 'name', 'family', 'category', 'source_page'],
  optional: [
    'source_document',
    'description',
    'status',
    'image_url',
    'sizes',
    'compatible_skus',
    'documents',
    'images',
    'material',
    'standard',
    'pressure_class',
    'rod_length',
    'joint_type',
    'application',
  ],
};

export const CATALOG_IMPORT_MULTI_VALUE_SEPARATOR = ';'; // nilai jamak dalam satu sel (baris baru juga diterima)
export const CATALOG_IMPORT_FIELD_SEPARATOR = '|'; // bagian di dalam satu nilai: Judul|URL|halaman

export interface CatalogCompatibilityRef {
  sku: string;
  kind: 'tee' | 'elbow' | 'reducer' | 'socket';
}

/** Baris yang lolos seluruh aturan. */
export interface ValidatedCatalogRow {
  rowNumber: number;
  rowHash: string; // dari sel mentah, tanpa nomor baris
  sku: string;
  name: string;
  family: string;
  category: string;
  description: string | null;
  status: 'active' | 'discontinued';
  sourceDocument: string;
  sourcePage: number;
  imageUrl: string | null;
  sizes: readonly PipeSize[]; // kanonik, urut menaik, tanpa duplikat
  specs: Record<CatalogSpecKey, SpecValue>; // keenam kunci selalu ada; kosong → UNAVAILABLE
  compatibleSkus: readonly CatalogCompatibilityRef[];
  documents: readonly { title: string; url: string; page: number | null }[];
  images: readonly string[];
}

export interface CatalogImportValidation {
  rows: readonly ValidatedCatalogRow[];
  issues: readonly { rowNumber: number; column: string; message: string }[]; // rowNumber 0 = seluruh berkas
}
```

### Konvensi sel (sumber tabular)

| Kolom             | Bentuk                                   | Contoh                                                |
| ----------------- | ---------------------------------------- | ----------------------------------------------------- |
| `sizes`           | ukuran dipisah `;`                       | `1/2; 3/4; 1; 1 1/4; 1 1/2; 2; 3; 4`                  |
| `compatible_skus` | `SKU:jenis` dipisah `;`                  | `PRL-TEE-AW:tee; PRL-ELB-AW:elbow`                    |
| `documents`       | `Judul\|URL\|halaman` (halaman opsional) | `Datasheet PVC AW\|https://pralon.co.id/ds-aw.pdf\|7` |
| `images`          | URL dipisah `;`                          | `/images/aw.png; /images/aw-2.png`                    |
| `status`          | kosong = `active`                        | `discontinued`                                        |
| `source_page`     | bilangan bulat > 0                       | `14`                                                  |

---

## 3. Kunci spesifikasi (`catalog-spec-keys.ts`) dan tipe `SpecValue`

```ts
export const CATALOG_SPEC_KEYS = {
  material: 'material',
  standard: 'standard',
  pressureClass: 'pressure_class', // "Tekanan kerja"
  rodLength: 'rod_length', // "Panjang batang"
  jointType: 'joint_type', // "Sambungan"
  application: 'application',
} as const;

// packages/shared-types/src/catalog.ts
export type SpecValue =
  | { provenance: 'VERIFIED'; value: string; sourceDocument?: string; sourcePage?: number }
  | { provenance: 'UNAVAILABLE'; value: null }; // dirender "Lihat dokumen teknis", tanpa nilai

export interface Product {
  id: string;
  sku: string;
  name: string;
  family: string;
  category: string;
  description: string;
  status: 'active' | 'discontinued';
  sizes: readonly string[]; // label kanonik, urut menaik
  material: SpecValue;
  standard: SpecValue;
  pressureClass: SpecValue;
  rodLength: SpecValue;
  jointType: SpecValue;
  application: SpecValue;
  sourceDocument: string;
  sourcePage: number;
  catalogVersionId: string;
  imageUrl: string | null;
}
export interface CompatibleFitting {
  productId: string;
  name: string;
  kind: 'tee' | 'elbow' | 'reducer' | 'socket';
}
export type ProductMatchState =
  'VERIFIED_SELECTED' | 'SIZE_NEEDS_VALIDATION' | 'INFORMATION_UNAVAILABLE';
```

---

## 4. Ukuran pipa (`pipe-size.ts`)

- Disimpan sebagai **inci × 1000** (`size_inches_x1000`), dibandingkan numerik, ditampilkan dengan
  label kanonik: di bawah 1" pakai garis miring (`1/2"`, `3/4"`), dari 1" ke atas pecahan unicode
  (`1¼"`, `1½"`, `2½"`), bulat `2"`.
- `PipeSize.parse()` menerima: `3/4`, `3/4"`, `0.75`, `1 1/4"`, `1¼`, `1.25"`, `½`. Yang tidak
  terbaca → galat impor "Ukuran tidak terbaca", bukan default.
- Batas: 0 < inci ≤ 100.
- **Belum ada representasi milimeter (OD) untuk HDPE** — keputusan yang perlu diambil bersama Pralon.

---

## 5. Aturan validator (`catalog-import.validator.ts`)

| Aturan                                                                 | Tingkat         | Pesan                                                       |
| ---------------------------------------------------------------------- | --------------- | ----------------------------------------------------------- |
| Label versi wajib                                                      | berkas          | "Label versi katalog wajib diisi."                          |
| Kolom wajib ada (`sku`, `name`, `family`, `category`, `source_page`)   | berkas (sekali) | "Kolom wajib `x` tidak ada di berkas."                      |
| Kolom bernilai tunggal hanya satu nilai                                | baris           | "Kolom `x` hanya menerima satu nilai."                      |
| Field wajib terisi                                                     | baris           | "Kolom `x` wajib diisi."                                    |
| `source_page` bulat positif                                            | baris           | "… rujukan halaman adalah janji bahwa data ini bisa dicek." |
| Dokumen sumber ada (kolom atau metadata)                               | baris           | "Dokumen sumber wajib ada …"                                |
| `status` ∈ {active, discontinued}, kosong = active                     | baris           | "Status `x` tidak dikenal …"                                |
| `image_url` http(s) atau jalur `/…`                                    | baris           | "… bukan URL http(s) maupun jalur yang dimulai dengan /."   |
| Ukuran terbaca `PipeSize`                                              | baris           | "Ukuran tidak terbaca: …"                                   |
| `compatible_skus` bentuk `SKU:jenis`, jenis dikenal, SKU ada di berkas | baris           | gabungan masalah                                            |
| `documents` bentuk `Judul\|URL\|halaman`, halaman (bila ada) positif   | baris           | gabungan masalah                                            |
| SKU unik per versi, tanpa membedakan huruf besar-kecil                 | baris           | "SKU `x` sudah dipakai di baris N."                         |
| Versi `draft` hanya dibuat bila **0 galat**                            | seluruh         | — (OQ-38)                                                   |

Spesifikasi yang kosong **tetap** ditulis sebagai baris `product_specs` dengan `UNAVAILABLE`.

---

## 6. Katalog contoh yang aktif sekarang (`seed-sample-catalog.mjs`)

Versi `kind = 'sample'`, `source_document = "Katalog contoh pengembangan SNOUTY (BUKAN data Pralon)"`.
Enam baris, dalam bentuk kolom impor:

```csv
sku,name,family,category,source_page,status,sizes,material,standard,pressure_class,rod_length,joint_type,application,compatible_skus,documents,images
DEV-AW-PIPE,CONTOH Pipa PVC AW,PVC AW,PIPA AIR BERSIH · SNI,14,,1/2; 3/4; 1; 1 1/4; 1 1/2; 2; 3; 4,uPVC,SNI 06-0084-2002,,4 m,Solvent cement,Air bersih bertekanan,DEV-FIT-TEE:tee; DEV-FIT-ELBOW:elbow; DEV-FIT-REDUCER:reducer; DEV-FIT-SOCKET:socket,CONTOH Datasheet Pipa PVC AW|https://example.invalid/contoh-datasheet-aw.pdf|7,/images/dev/aw-pipe.png; /images/dev/aw-pipe-detail.png
DEV-D-PIPE,CONTOH Pipa PVC D,PVC D,PIPA PEMBUANGAN · SNI,26,,1 1/2; 2; 3; 4,uPVC,SNI 06-0084-2002,,4 m,,Pembuangan gravitasi,,,/images/dev/d-pipe.png
DEV-FIT-TEE,CONTOH Tee PVC AW,PVC AW,FITTING · SNI,41,,3/4; 1; 1 1/4,uPVC,,,,Solvent cement,,,,
DEV-FIT-ELBOW,CONTOH Elbow 90° PVC AW,PVC AW,FITTING · SNI,42,,3/4; 1; 1 1/4,uPVC,,,,Solvent cement,,,,
DEV-FIT-REDUCER,CONTOH Reducer PVC AW,PVC AW,FITTING · SNI,43,,3/4; 1,uPVC,,,,,,,,
DEV-FIT-SOCKET,CONTOH Socket PVC AW,PVC AW,FITTING · SNI,44,discontinued,3/4,uPVC,,,,,,,,
```

Catatan: `pressure_class` pada PVC AW sengaja kosong → tampil "Lihat dokumen teknis". Katalog ini
belum punya HDPE/PPR sama sekali, itulah sebabnya rekomendasi irigasi jalur panjang (HDPE) hari ini
tidak menemukan produk.

---

## 7. Bagaimana matcher memakai data ini (untuk konteks brainstorming)

Mesin teknik menghasilkan kebutuhan per **peran** (`main`, `branch`, `fitting`) berupa
`{ size: '1½"', family: 'PVC AW' }`. Matcher (`product-matcher.ts`):

1. saring `products` dengan `family` sama persis dan `status = 'active'`;
2. cari produk yang `sizes` memuat ukuran itu → `VERIFIED_SELECTED`;
3. ada keluarga tetapi ukuran tidak ada → `SIZE_NEEDS_VALIDATION`;
4. keluarga tidak ada → peran tidak terpenuhi (`INFORMATION_UNAVAILABLE`).

Nama keluarga yang dipakai kode hari ini: `PVC AW`, `PVC D`, `HDPE`, `FITTING PVC`. Jadi kamus
`family` di master data Pralon harus disepakati dulu (atau dipetakan) sebelum impor. Catatan: katalog
contoh menaruh fitting di `family = PVC AW` dengan `category = FITTING · SNI`, sedangkan matcher
mencari `FITTING PVC` — itulah sebabnya peran fitting hari ini tidak pernah terisi. Keputusan untuk
Pralon: fitting dibedakan lewat `family` sendiri, atau lewat `category`/peran?
