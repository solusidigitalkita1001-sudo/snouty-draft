/**
 * P1-05a — validasi impor katalog.
 *
 * Tes utama berkas ini adalah yang pertama: **semua galat dilaporkan sekaligus.**
 * Memperbaiki 40 galat satu per satu, masing-masing menunggu satu putaran impor,
 * adalah cara tercepat membuat admin katalog menyerah
 * (docs/PRODUCT_KNOWLEDGE.md §3).
 */
import { describe, expect, it } from 'vitest';
import {
  CATALOG_IMPORT_COLUMNS,
  type CatalogImportSource,
  type RawCatalogRow,
} from './catalog-import.contract.js';
import { validateCatalogImport } from './catalog-import.validator.js';

type Cells = Record<string, string | readonly string[]>;

/** Baris yang lolos seluruh aturan — dasar untuk merusak satu hal per tes. */
function validRow(overrides: Cells = {}): Cells {
  return {
    sku: 'AW-A',
    name: 'Pralon PVC AW 3/4"',
    family: 'PVC AW',
    category: 'PIPA AIR BERSIH · SNI',
    source_page: '14',
    ...overrides,
  };
}

/** Baris 1 adalah header di berkas tabular, jadi data mulai dari baris 2. */
function source(
  rows: readonly Cells[],
  overrides: Partial<CatalogImportSource> = {},
): CatalogImportSource {
  const raw: RawCatalogRow[] = rows.map((values, index) => ({ rowNumber: index + 2, values }));
  return {
    label: 'v2.4',
    sourceDocument: 'Katalog produk Pralon 2026',
    columns: [...CATALOG_IMPORT_COLUMNS.required, ...CATALOG_IMPORT_COLUMNS.optional],
    rows: raw,
    ...overrides,
  };
}

/** Penanda ringkas "baris:kolom" supaya kegagalan tes mudah dibaca. */
function marks(result: { issues: readonly { rowNumber: number; column: string }[] }): string[] {
  return result.issues.map((issue) => `${issue.rowNumber}:${issue.column}`);
}

describe('validateCatalogImport — melaporkan semua galat sekaligus', () => {
  it('mengumpulkan galat dari seluruh baris dalam satu kali jalan, bukan berhenti di yang pertama', () => {
    const result = validateCatalogImport(
      source([
        validRow({ sku: '' }),
        validRow({ sku: 'AW-B', name: '', family: '' }),
        validRow({ sku: 'AW-C', source_page: '0' }),
        validRow({ sku: 'AW-D' }),
      ]),
    );

    expect(marks(result)).toEqual(['2:sku', '3:name', '3:family', '4:source_page']);
  });

  it('tidak mengeluarkan baris yang sah hanya karena baris lain gagal', () => {
    const result = validateCatalogImport(
      source([validRow({ sku: '' }), validRow({ sku: 'AW-B' }), validRow({ sku: 'AW-C' })]),
    );

    expect(result.rows.map((row) => row.sku)).toEqual(['AW-B', 'AW-C']);
  });

  it('tidak melaporkan galat apa pun untuk impor yang seluruh barisnya bersih', () => {
    const result = validateCatalogImport(source([validRow(), validRow({ sku: 'AW-B' })]));

    expect(result.issues).toEqual([]);
    expect(result.rows).toHaveLength(2);
  });

  it('melaporkan kolom wajib yang hilang satu kali untuk seluruh berkas, bukan sekali per baris', () => {
    const rows = Array.from({ length: 20 }, (_, i) => validRow({ sku: `AW-${i}` }));
    const result = validateCatalogImport(
      source(rows, { columns: ['sku', 'name', 'family', 'category'] }),
    );

    // rowNumber 0 berarti "berlaku untuk seluruh berkas", bukan satu baris.
    expect(marks(result)).toEqual(['0:source_page']);
    expect(result.rows).toEqual([]);
  });
});

describe('validateCatalogImport — field wajib dan rujukan sumber', () => {
  it('menolak source_page yang bukan bilangan bulat positif', () => {
    const result = validateCatalogImport(
      source([
        validRow({ sku: 'AW-A', source_page: '0' }),
        validRow({ sku: 'AW-B', source_page: '-3' }),
        validRow({ sku: 'AW-C', source_page: 'empat belas' }),
        validRow({ sku: 'AW-D', source_page: '14.5' }),
      ]),
    );

    expect(marks(result)).toEqual([
      '2:source_page',
      '3:source_page',
      '4:source_page',
      '5:source_page',
    ]);
  });

  it('memakai source_document dari berkas bila baris tidak menyebutkannya sendiri', () => {
    const result = validateCatalogImport(source([validRow()]));

    expect(result.rows[0]?.sourceDocument).toBe('Katalog produk Pralon 2026');
  });

  it('mengizinkan satu baris menimpa source_document, untuk impor dari beberapa dokumen', () => {
    const result = validateCatalogImport(
      source([validRow({ source_document: 'Katalog fitting Pralon 2025' })]),
    );

    expect(result.rows[0]?.sourceDocument).toBe('Katalog fitting Pralon 2025');
  });

  it('menolak baris tanpa dokumen sumber dari mana pun — rujukan itu janji bahwa data bisa dicek', () => {
    const result = validateCatalogImport(source([validRow()], { sourceDocument: '' }));

    expect(marks(result)).toContain('2:source_document');
  });

  it('menolak berkas tanpa label versi', () => {
    const result = validateCatalogImport(source([validRow()], { label: '' }));

    expect(marks(result)).toContain('0:label');
  });
});

describe('validateCatalogImport — SKU unik', () => {
  it('menolak SKU ganda dalam satu versi katalog', () => {
    const result = validateCatalogImport(source([validRow(), validRow()]));

    expect(marks(result)).toEqual(['3:sku']);
    expect(result.rows.map((row) => row.rowNumber)).toEqual([2]);
  });

  it('menganggap AW-A dan aw-a sebagai SKU yang sama, karena MySQL juga begitu', () => {
    // Collation baku MySQL tidak membedakan huruf besar-kecil: kalau validasi
    // membedakannya, uq_products_version_sku yang akan meledak saat job berjalan —
    // jauh dari admin yang bisa memperbaikinya.
    const result = validateCatalogImport(
      source([validRow({ sku: 'AW-A' }), validRow({ sku: 'aw-a' })]),
    );

    expect(marks(result)).toEqual(['3:sku']);
  });
});

describe('validateCatalogImport — ukuran pipa', () => {
  it('mengkanonikkan, mengurutkan, dan membuang duplikat ukuran', () => {
    const result = validateCatalogImport(
      source([validRow({ sizes: '1 1/4; 3/4; 1; 1.25; 0.75' })]),
    );

    expect(result.rows[0]?.sizes.map((size) => size.label)).toEqual(['3/4"', '1"', '1¼"']);
  });

  it('menerima nilai jamak sebagai array, bukan hanya string dengan pemisah', () => {
    // Adapter ERP mengirim daftar; adapter Excel mengirim satu sel. Kontraknya
    // menerima keduanya, supaya format tidak merembes ke validator.
    const result = validateCatalogImport(source([validRow({ sizes: ['3/4', '1'] })]));

    expect(result.rows[0]?.sizes.map((size) => size.label)).toEqual(['3/4"', '1"']);
  });

  it('menolak ukuran yang tidak terbaca dan menyebut nilai yang bermasalah', () => {
    const result = validateCatalogImport(source([validRow({ sizes: '3/4; dua inci; 1' })]));

    expect(marks(result)).toEqual(['2:sizes']);
    expect(result.issues[0]?.message).toContain('dua inci');
  });

  it('menerima baris tanpa ukuran sama sekali', () => {
    const result = validateCatalogImport(source([validRow()]));

    expect(result.rows[0]?.sizes).toEqual([]);
    expect(result.issues).toEqual([]);
  });
});

describe('validateCatalogImport — spesifikasi dan provenance', () => {
  it('menandai spesifikasi kosong sebagai UNAVAILABLE, bukan menghilangkannya', () => {
    const result = validateCatalogImport(source([validRow({ material: 'PVC' })]));

    expect(result.rows[0]?.specs['material']).toEqual({ value: 'PVC', provenance: 'VERIFIED' });
    expect(result.rows[0]?.specs['pressure_class']).toEqual({
      value: null,
      provenance: 'UNAVAILABLE',
    });
  });

  it('tidak pernah menandai fakta produk sebagai ASSUMED, sekosong apa pun barisnya', () => {
    const result = validateCatalogImport(source([validRow()]));
    const provenances = Object.values(result.rows[0]?.specs ?? {}).map((spec) => spec.provenance);

    expect(new Set(provenances)).toEqual(new Set(['UNAVAILABLE']));
  });

  it('tidak memberi sitasi dokumen teknis pada spesifikasi yang berasal dari kolom katalog', () => {
    const result = validateCatalogImport(source([validRow({ standard: 'SNI 06-0084-2002' })]));

    expect(result.rows[0]?.specs['standard']).not.toHaveProperty('sourceDocument');
  });
});

describe('validateCatalogImport — status, gambar, kompatibilitas', () => {
  it('menganggap status kosong sebagai active, dan menolak nilai di luar daftar', () => {
    const result = validateCatalogImport(
      source([
        validRow({ sku: 'AW-A' }),
        validRow({ sku: 'AW-B', status: 'discontinued' }),
        validRow({ sku: 'AW-C', status: 'ditarik' }),
      ]),
    );

    expect(result.rows.map((row) => row.status)).toEqual(['active', 'discontinued']);
    expect(marks(result)).toEqual(['4:status']);
  });

  it('menolak daftar pada kolom yang hanya menerima satu nilai — hampir pasti salah peta kolom', () => {
    const result = validateCatalogImport(source([validRow({ sku: ['AW-A', 'AW-B'] })]));

    expect(marks(result)).toContain('2:sku');
    expect(result.issues[0]?.message).toContain('satu nilai');
  });

  it('menolak image_url dengan skema yang tidak aman dirender', () => {
    const result = validateCatalogImport(
      source([
        validRow({ sku: 'AW-A', image_url: 'https://cdn.pralon.co.id/aw-a.png' }),
        validRow({ sku: 'AW-B', image_url: '/images/aw-b.png' }),
        validRow({ sku: 'AW-C', image_url: 'javascript:alert(1)' }),
      ]),
    );

    expect(marks(result)).toEqual(['4:image_url']);
  });

  it('menolak rujukan kompatibilitas ke SKU yang tidak ada di impor yang sama', () => {
    const result = validateCatalogImport(
      source([
        validRow({ sku: 'AW-A', compatible_skus: 'FIT-T:tee; FIT-HILANG:elbow' }),
        validRow({ sku: 'FIT-T' }),
      ]),
    );

    expect(marks(result)).toEqual(['2:compatible_skus']);
    expect(result.issues[0]?.message).toContain('FIT-HILANG');
  });

  it('menolak jenis fitting di luar tee/elbow/reducer/socket', () => {
    const result = validateCatalogImport(
      source([
        validRow({ sku: 'AW-A', compatible_skus: 'FIT-K:kopling' }),
        validRow({ sku: 'FIT-K' }),
      ]),
    );

    expect(marks(result)).toEqual(['2:compatible_skus']);
    expect(result.issues[0]?.message).toContain('kopling');
  });

  it('menolak produk yang kompatibel dengan dirinya sendiri', () => {
    const result = validateCatalogImport(
      source([validRow({ sku: 'AW-A', compatible_skus: 'AW-A:socket' })]),
    );

    expect(marks(result)).toEqual(['2:compatible_skus']);
  });

  it('mengurai rujukan kompatibilitas yang sah menjadi pasangan SKU dan jenis', () => {
    const result = validateCatalogImport(
      source([
        validRow({ sku: 'AW-A', compatible_skus: 'FIT-T:tee; FIT-E:elbow' }),
        validRow({ sku: 'FIT-T' }),
        validRow({ sku: 'FIT-E' }),
      ]),
    );

    expect(result.rows[0]?.compatibleSkus).toEqual([
      { sku: 'FIT-T', kind: 'tee' },
      { sku: 'FIT-E', kind: 'elbow' },
    ]);
  });
});

describe('validateCatalogImport — rowHash untuk idempotensi', () => {
  it('menghasilkan hash yang sama untuk baris yang sama, apa pun urutan kolomnya', () => {
    const a = validateCatalogImport(
      source([{ sku: 'AW-A', name: 'N', family: 'F', category: 'C', source_page: '14' }]),
    );
    const b = validateCatalogImport(
      source([{ source_page: '14', category: 'C', family: 'F', name: 'N', sku: 'AW-A' }]),
    );

    expect(a.rows[0]?.rowHash).toBe(b.rows[0]?.rowHash);
  });

  it('menghasilkan hash berbeda saat satu sel berubah', () => {
    const a = validateCatalogImport(source([validRow()]));
    const b = validateCatalogImport(source([validRow({ source_page: '15' })]));

    expect(a.rows[0]?.rowHash).not.toBe(b.rows[0]?.rowHash);
  });

  it('tidak terpengaruh nomor baris, supaya menyusun ulang berkas tidak membuat impor ulang', () => {
    const a = validateCatalogImport({ ...source([validRow()]) });
    const shifted = source([validRow()]);
    const b = validateCatalogImport({
      ...shifted,
      rows: [{ rowNumber: 99, values: shifted.rows[0]!.values }],
    });

    expect(a.rows[0]?.rowHash).toBe(b.rows[0]?.rowHash);
  });
});
