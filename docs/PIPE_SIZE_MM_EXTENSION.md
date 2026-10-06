# Rancangan: ukuran milimeter di `PipeSize` dan `product_sizes`

2026-10-06 · Status: **diimplementasikan 2026-10-06** (Tahap B–C: `PipeSize` bersatuan, migration 0016, validator; matcher/engine belum — lihat `docs/MATCHER_V2_PROPOSAL.md`) · Terkait: `PRODUCT_MASTER_DATA_SCHEMA.md` §1, §4, §7

## 1. Masalah

`PipeSize` hanya mengenal inci (`size_inches_x1000`). Di export ERP Pralon (7.710 baris), **5.045 baris
(65 %) berukuran mm**: seluruh HDPE/MDPE, PVC seri ISO `S-6.3…S-16`, PVC SNI Kelas A/B dan Type I–III,
serta sebagian besar fitting besar. Baris itu sudah diparse dan disiapkan di
`snouty_catalog_import_mm_PENDING.csv`, tetapi ditolak validator hari ini ("Ukuran tidak terbaca").

## 2. Keputusan desain

1. **Satuan adalah bagian dari ukuran.** Ukuran = `(unit, value)`. `110 mm` dan `4"` adalah dua ukuran
   berbeda, bukan satu angka dengan dua label.
2. **Tidak ada konversi mm ↔ inci di kode.** "63 mm ≈ 2"" bukan fakta fisika (OD 63 mm ≠ 2,000"), melainkan
   padanan dagang yang berbeda per sistem standar. Padanan hanya boleh datang dari tabel ber-provenance
   (usulan `equivalentOf`, `PRODUCT_MASTER_DATA.md` §3), tidak dibahas di dokumen ini.
3. **Kompatibel ke belakang.** Sel tanpa satuan tetap dibaca sebagai inci, jadi katalog `sample` dan
   impor lama tidak berubah.

## 3. Value object (`packages/shared-types/src/pipe-size.ts`)

```ts
export type PipeSizeUnit = 'in' | 'mm';

export interface PipeSize {
  readonly unit: PipeSizeUnit;
  readonly valueX1000: number; // in: 0.75" → 750 · mm: 110 mm → 110000, 12.5 mm → 12500
  readonly label: string; // '3/4"', '1¼"', '110 mm'
}

const LIMITS: Record<PipeSizeUnit, number> = { in: 100_000, mm: 3_000_000 }; // ≤ 100" · ≤ 3000 mm

// Diterima (tambahan dari hari ini): '110 mm', '110mm', '110 MM', '12.5 mm', '12,5 mm'
// Tetap: '3/4', '3/4"', '0.75', '1 1/4"', '1¼', '1.25"', '½'  → inci
// Ditolak: '11/2' (pecahan dengan pembilang ≥ penyebut → ambigu, bukan 5.5"), '2\'' , '110' tanpa satuan
//          bila sumbernya menyatakan mm (adapter yang memutuskan, bukan parser).
export function parsePipeSize(raw: string): PipeSize | null;

export function comparePipeSize(a: PipeSize, b: PipeSize): number; // hanya untuk unit sama; beda unit → throw
export function samePipeSize(a: PipeSize, b: PipeSize): boolean; // unit sama && valueX1000 sama
```

Label kanonik mm: angka tanpa nol di belakang + ` mm` (`110 mm`, `12.5 mm`). Label inci tidak berubah.

Pecahan ambigu perlu ditolak juga di parser inci yang sekarang: export memuat `Socket - W 11/2"`
(maksudnya 1½", tetapi `Fraction('11/2')` = 5,5"). Hari ini enam baris seperti ini sudah ditolak oleh
adapter, bukan diterjemahkan.

## 4. Skema dan migrasi (`catalog.ts`)

```ts
export const productSizes = mysqlTable(
  'product_sizes',
  {
    productId: char('product_id', { length: 26 }).notNull(),
    sizeUnit: varchar('size_unit', { length: 2 }).notNull().default('in'), // 'in' | 'mm'
    sizeValue: int('size_value_x1000').notNull(), // dulu size_inches_x1000
    sizeLabel: varchar('size_label', { length: 16 }).notNull(),
    available: tinyint('available').notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.sizeUnit, t.sizeValue] }),
    check('ck_product_sizes_unit', sql`size_unit IN ('in','mm')`),
    check(
      'ck_product_sizes_range',
      sql`(size_unit = 'in' AND size_value_x1000 BETWEEN 1 AND 100000)
       OR (size_unit = 'mm' AND size_value_x1000 BETWEEN 1 AND 3000000)`,
    ),
    index('ix_product_sizes_unit_value').on(t.sizeUnit, t.sizeValue),
    foreignKey({ columns: [t.productId], foreignColumns: [products.id] }).onDelete('cascade'),
  ],
);
```

Migrasi naik (urutan penting karena PK berubah):

```sql
ALTER TABLE product_sizes DROP CHECK ck_product_sizes_positive;
ALTER TABLE product_sizes RENAME COLUMN size_inches_x1000 TO size_value_x1000;
ALTER TABLE product_sizes ADD COLUMN size_unit VARCHAR(2) NOT NULL DEFAULT 'in' AFTER product_id;
ALTER TABLE product_sizes DROP PRIMARY KEY, ADD PRIMARY KEY (product_id, size_unit, size_value_x1000);
ALTER TABLE product_sizes
  ADD CONSTRAINT ck_product_sizes_unit CHECK (size_unit IN ('in','mm')),
  ADD CONSTRAINT ck_product_sizes_range CHECK (
    (size_unit = 'in' AND size_value_x1000 BETWEEN 1 AND 100000) OR
    (size_unit = 'mm' AND size_value_x1000 BETWEEN 1 AND 3000000));
CREATE INDEX ix_product_sizes_unit_value ON product_sizes (size_unit, size_value_x1000);
```

Migrasi turun: hanya aman bila tidak ada baris `mm`. Turun harus **gagal dengan pesan jelas** bila ada
(`SELECT COUNT(*) … WHERE size_unit='mm'` > 0), bukan menghapus data diam-diam. Setelah itu kebalikan
langkah di atas. Sesuai N-6: dites naik-turun, dan tidak dijalankan di DB bersama Pralon tanpa backup.

## 5. Kontrak impor dan validator

- Kolom `sizes` tidak berubah namanya. Sel boleh mencampur satuan (`63 mm; 2"`), tetapi validator
  memberi **peringatan** bila satu produk punya dua satuan (biasanya tanda salah ketik).
- `ValidatedCatalogRow.sizes: readonly PipeSize[]` → urut per unit lalu nilai, tanpa duplikat.
- Pesan galat baru:
  - `Ukuran tidak terbaca: "11/2". Pecahan dengan pembilang ≥ penyebut ambigu; tulis "1 1/2".`
  - `Ukuran mm di luar rentang (1–3000 mm): "…".`
- `CatalogImportSource` dan adapter tidak berubah.

## 6. Matcher dan mesin teknik

- Kebutuhan per peran berubah dari `{ size: '1½"', family }` menjadi `{ size: PipeSize, family }`.
- Pencocokan **hanya unit sama** (`samePipeSize`). Kebutuhan inci terhadap produk mm → tidak cocok →
  `SIZE_NEEDS_VALIDATION`, dengan trace "ukuran tersedia dalam mm; padanan belum terverifikasi".
- **Konsekuensi untuk engine:** ENG-102/201/202 hari ini menyebut HDPE dalam inci ("HDPE 2½" PN 10").
  Setelah migrasi, HDPE di katalog berada di mm, sehingga jalur HDPE tetap tidak menemukan produk sampai
  engine memilih ukuran HDPE dalam mm (OD) dari tabel ber-ID. Ini pekerjaan terpisah dan bergantung pada
  data OD/tebal dinding (`PRODUCT_MASTER_DATA.md` §3).
- `Product.sizes` di `shared-types/catalog.ts` tetap `string[]` label kanonik. UI tidak perlu tahu unit.

## 7. Test case minimum

| Kasus                                         | Harapan                                        |
| --------------------------------------------- | ---------------------------------------------- |
| `parsePipeSize('110 mm')` / `('110mm')`       | `{ mm, 110000, '110 mm' }`                     |
| `parsePipeSize('12,5 mm')`                    | `{ mm, 12500, '12.5 mm' }`                     |
| `parsePipeSize('1 1/4"')`                     | `{ in, 1250, '1¼"' }` (perilaku lama tetap)    |
| `parsePipeSize('11/2"')`                      | `null` (ambigu)                                |
| `parsePipeSize('0 mm')`, `('3500 mm')`        | `null`                                         |
| `samePipeSize(63 mm, 2")`                     | `false`                                        |
| Impor sel `63 mm; 110 mm`                     | dua baris `product_sizes`, unit `mm`, urut     |
| Impor katalog `sample` lama setelah migrasi   | identik dengan sebelum migrasi                 |
| Migrasi turun dengan baris mm                 | gagal dengan pesan, data utuh                  |
| Matcher: kebutuhan `HDPE 63 mm`, produk ada   | `VERIFIED_SELECTED`                            |
| Matcher: kebutuhan `HDPE 2"`, produk hanya mm | `SIZE_NEEDS_VALIDATION`, trace menyebut alasan |

## 8. Urutan rilis

1. `PipeSize` + test (tanpa menyentuh DB).
2. Migrasi + validator + adapter; impor ulang `sample` untuk membuktikan kompatibilitas.
3. Impor `snouty_catalog_import_inch.csv` + `snouty_catalog_import_mm_PENDING.csv` sebagai satu versi `draft`.
4. Matcher berbasis `PipeSize`; evaluasi golden dataset ulang.
5. (Terpisah) engine memilih ukuran HDPE dalam mm.
