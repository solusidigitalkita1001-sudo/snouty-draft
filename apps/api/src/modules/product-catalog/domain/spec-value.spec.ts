/**
 * P1-09a — invarian **C-1**: spesifikasi kosong menjadi `UNAVAILABLE`, tidak
 * pernah diisi tebakan.
 *
 * Sebagian tes di berkas ini berjalan saat **kompilasi**, bukan saat eksekusi.
 * `@ts-expect-error` gagal kalau galatnya hilang, dan `tsconfig.spec.json`
 * memeriksa berkas spec — jadi melonggarkan tipe `SpecValue` akan menggagalkan
 * `pnpm typecheck`, bukan lolos diam-diam karena vitest hanya membuang tipe.
 */
import { describe, expect, it } from 'vitest';
import type { SpecValue } from '@snouty/shared-types';
import { specHasValue } from '@snouty/shared-types';
import {
  specFromCatalogColumn,
  specFromStoredRow,
  specFromTechnicalDocument,
  unavailableSpec,
} from './spec-value.js';

const UNAVAILABLE = { provenance: 'UNAVAILABLE', value: null };

describe('C-1 di tingkat tipe — bentuk yang tidak bisa ditulis', () => {
  it('tidak mengizinkan UNAVAILABLE membawa nilai', () => {
    // @ts-expect-error UNAVAILABLE wajib bernilai null — invarian P-2.
    const impossible: SpecValue = { provenance: 'UNAVAILABLE', value: 'mungkin 10 bar' };

    expect(impossible).toBeDefined();
  });

  it('tidak mengizinkan VERIFIED tanpa nilai', () => {
    // @ts-expect-error nilai kosong tidak boleh mengaku terverifikasi.
    const impossible: SpecValue = { provenance: 'VERIFIED', value: null };

    expect(impossible).toBeDefined();
  });

  it('tidak mengizinkan fakta produk bertanda ASSUMED', () => {
    // @ts-expect-error asumsi berlaku untuk kebutuhan pengguna, bukan fakta produk.
    const impossible: SpecValue = { provenance: 'ASSUMED', value: '10 bar' };

    expect(impossible).toBeDefined();
  });

  it('tidak mengizinkan fakta produk bertanda ESTIMATED', () => {
    // @ts-expect-error perkiraan berlaku untuk kuantitas, bukan spesifikasi pipa.
    const impossible: SpecValue = { provenance: 'ESTIMATED', value: '10 bar' };

    expect(impossible).toBeDefined();
  });

  it('tidak mengizinkan sitasi dibaca sebelum provenance diperiksa', () => {
    const spec: SpecValue = specFromCatalogColumn('uPVC');

    // @ts-expect-error `sourceDocument` hanya ada pada cabang VERIFIED.
    const leaked = spec.sourceDocument;

    expect(leaked).toBeUndefined();
  });
});

describe('specFromCatalogColumn', () => {
  it('mengembalikan UNAVAILABLE untuk kolom kosong', () => {
    expect(specFromCatalogColumn('')).toEqual(UNAVAILABLE);
  });

  it('mengembalikan UNAVAILABLE untuk kolom yang hanya berisi spasi', () => {
    // Sel spreadsheet yang "terlihat kosong" sangat sering memuat spasi; kalau
    // spasi lolos sebagai nilai, UI akan merender tag hijau di sebelah ruang hampa.
    expect(specFromCatalogColumn('   ')).toEqual(UNAVAILABLE);
  });

  it('mengembalikan UNAVAILABLE untuk null dan undefined', () => {
    expect(specFromCatalogColumn(null)).toEqual(UNAVAILABLE);
    expect(specFromCatalogColumn(undefined)).toEqual(UNAVAILABLE);
  });

  it('menandai kolom terisi sebagai VERIFIED tanpa sitasi dokumen', () => {
    // Menempelkan nama katalog ke setiap kolom akan membuat sitasi berhenti berarti.
    expect(specFromCatalogColumn('uPVC')).toEqual({ provenance: 'VERIFIED', value: 'uPVC' });
  });

  it('merapikan spasi di tepi nilai', () => {
    expect(specFromCatalogColumn('  SNI 06-0084-2002  ')).toEqual({
      provenance: 'VERIFIED',
      value: 'SNI 06-0084-2002',
    });
  });
});

describe('specFromTechnicalDocument', () => {
  it('menyertakan dokumen dan halaman saat sitasinya lengkap', () => {
    expect(specFromTechnicalDocument('10 bar', 'Datasheet Pralon PVC AW', 7)).toEqual({
      provenance: 'VERIFIED',
      value: '10 bar',
      sourceDocument: 'Datasheet Pralon PVC AW',
      sourcePage: 7,
    });
  });

  it('menurunkan nilai tanpa nama dokumen menjadi UNAVAILABLE', () => {
    // "Jawaban berbasis dokumen tanpa sitasi" ada di daftar hal yang tidak boleh
    // terjadi — jadi nilainya tidak ditampilkan, bukan ditampilkan tanpa sumber.
    expect(specFromTechnicalDocument('10 bar', '', 7)).toEqual(UNAVAILABLE);
  });

  it('menurunkan nilai tanpa nomor halaman menjadi UNAVAILABLE', () => {
    // UI merender "Sumber: <dokumen> hal. N"; sitasi setengah tidak bisa dirender.
    expect(specFromTechnicalDocument('10 bar', 'Datasheet', null)).toEqual(UNAVAILABLE);
  });

  it('menolak nomor halaman nol, negatif, dan pecahan', () => {
    expect(specFromTechnicalDocument('10 bar', 'Datasheet', 0)).toEqual(UNAVAILABLE);
    expect(specFromTechnicalDocument('10 bar', 'Datasheet', -3)).toEqual(UNAVAILABLE);
    expect(specFromTechnicalDocument('10 bar', 'Datasheet', 7.5)).toEqual(UNAVAILABLE);
  });

  it('tidak mengarang nilai hanya karena sitasinya lengkap', () => {
    expect(specFromTechnicalDocument('', 'Datasheet', 7)).toEqual(UNAVAILABLE);
  });
});

describe('specFromStoredRow', () => {
  it('mengembalikan UNAVAILABLE saat barisnya tidak ada', () => {
    expect(specFromStoredRow(undefined)).toEqual(UNAVAILABLE);
  });

  it('tidak pernah membocorkan nilai dari baris bertanda UNAVAILABLE', () => {
    const spec = specFromStoredRow({
      specValue: 'mungkin 10 bar',
      provenance: 'UNAVAILABLE',
      sourceDocument: null,
      sourcePage: null,
    });

    expect(spec).toEqual(UNAVAILABLE);
  });

  it('menurunkan provenance yang tidak dikenal menjadi UNAVAILABLE, bukan melempar', () => {
    // CHECK database sudah membatasi nilainya. Kalau suatu hari ada baris yang
    // lolos, tidak merendernya lebih baik daripada merender fakta produk yang
    // asal-usulnya tidak dikenali.
    const spec = specFromStoredRow({
      specValue: '10 bar',
      provenance: 'ASSUMED',
      sourceDocument: null,
      sourcePage: null,
    });

    expect(spec).toEqual(UNAVAILABLE);
  });

  it('membaca nilai kolom katalog tanpa menambahkan sitasi', () => {
    const spec = specFromStoredRow({
      specValue: 'uPVC',
      provenance: 'VERIFIED',
      sourceDocument: null,
      sourcePage: null,
    });

    expect(spec).toEqual({ provenance: 'VERIFIED', value: 'uPVC' });
  });

  it('membaca nilai berbasis dokumen beserta sitasinya', () => {
    const spec = specFromStoredRow({
      specValue: '10 bar',
      provenance: 'VERIFIED',
      sourceDocument: 'Datasheet Pralon PVC AW',
      sourcePage: 7,
    });

    expect(spec).toEqual({
      provenance: 'VERIFIED',
      value: '10 bar',
      sourceDocument: 'Datasheet Pralon PVC AW',
      sourcePage: 7,
    });
  });

  it('menurunkan baris yang mengaku dari dokumen tetapi kehilangan halamannya', () => {
    // Kehadiran salah satu kolom sitasi berarti nilainya mengaku berasal dari
    // dokumen; maka sitasinya harus lengkap, atau nilainya tidak ditampilkan.
    const spec = specFromStoredRow({
      specValue: '10 bar',
      provenance: 'VERIFIED',
      sourceDocument: 'Datasheet',
      sourcePage: null,
    });

    expect(spec).toEqual(UNAVAILABLE);
  });

  it('menurunkan baris yang membawa halaman tanpa nama dokumen', () => {
    const spec = specFromStoredRow({
      specValue: '10 bar',
      provenance: 'VERIFIED',
      sourceDocument: null,
      sourcePage: 7,
    });

    expect(spec).toEqual(UNAVAILABLE);
  });
});

describe('unavailableSpec', () => {
  it('membagikan satu instance yang beku ke seluruh katalog', () => {
    // Ia dipakai ratusan produk sekaligus; satu pemanggil yang menulisinya akan
    // mengubah arti seluruh katalog.
    const spec = unavailableSpec();

    expect(Object.isFrozen(spec)).toBe(true);
    expect(unavailableSpec()).toBe(spec);
  });
});

describe('specHasValue', () => {
  it('membedakan nilai yang boleh dirender dari yang tidak', () => {
    expect(specHasValue(specFromCatalogColumn('uPVC'))).toBe(true);
    expect(specHasValue(unavailableSpec())).toBe(false);
  });

  it('menyempitkan tipe sehingga sitasi bisa dibaca setelah diperiksa', () => {
    const spec = specFromTechnicalDocument('10 bar', 'Datasheet', 7);

    if (!specHasValue(spec)) throw new Error('seharusnya terverifikasi');

    expect(spec.sourceDocument).toBe('Datasheet');
    expect(spec.value.length).toBeGreaterThan(0);
  });
});
