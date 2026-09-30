import { describe, expect, it } from 'vitest';
import { PipeSize, PipeSizeRange, PipeSizeTransition } from './pipe-size.js';

/** Ukuran yang benar-benar muncul di desain, dengan penulisan persis seperti di sana. */
const CATALOG_LABELS = ['1/2"', '3/4"', '1"', '1¼"', '1½"', '2"', '3"', '4"'] as const;

describe('PipeSize — label kanonik', () => {
  it('mereproduksi penulisan desain persis, termasuk campuran garis miring dan unicode', () => {
    const rendered = CATALOG_LABELS.map((l) => PipeSize.parse(l)?.label);
    expect(rendered).toEqual([...CATALOG_LABELS]);
  });

  it('memakai garis miring di bawah 1 inci dan pecahan unicode dari 1 inci ke atas', () => {
    expect(PipeSize.of(0.5)?.label).toBe('1/2"');
    expect(PipeSize.of(0.75)?.label).toBe('3/4"');
    expect(PipeSize.of(1.25)?.label).toBe('1¼"');
    expect(PipeSize.of(2.5)?.label).toBe('2½"'); // muncul di layar 07
  });
});

describe('PipeSize — penulisan berbeda, ukuran sama', () => {
  it('menganggap 1.25", 1¼", dan 1 1/4" sebagai ukuran yang sama', () => {
    const a = PipeSize.parse('1.25"');
    const b = PipeSize.parse('1¼');
    const c = PipeSize.parse('1 1/4"');
    expect(a && b && c).toBeTruthy();
    expect(a!.equals(b!)).toBe(true);
    expect(b!.equals(c!)).toBe(true);
    // Inilah bug yang dicegah value object ini: sebagai string mentah,
    // ketiganya adalah tiga ukuran berbeda dan matcher akan meleset.
    expect(new Set([a!.label, b!.label, c!.label]).size).toBe(1);
  });

  it('menerima 0.75 dan 3/4 sebagai ukuran yang sama', () => {
    expect(PipeSize.parse('0.75')!.equals(PipeSize.parse('3/4"')!)).toBe(true);
  });

  it('mengabaikan spasi dan berbagai bentuk tanda inci', () => {
    for (const variant of [' 3/4" ', '3/4”', '3/4″', '3/4']) {
      expect(PipeSize.parse(variant)?.label).toBe('3/4"');
    }
  });
});

describe('PipeSize — masukan tidak terbaca', () => {
  it('mengembalikan null alih-alih menebak', () => {
    // Menebak di sini akan menjadi nilai karangan yang ikut dihitung (SPEC §5 Policy 2).
    for (const bad of ['', '   ', 'besar', '3/0', '-1', '0', 'abc"', '999']) {
      expect(PipeSize.parse(bad)).toBeNull();
    }
  });
});

describe('PipeSize — perbandingan dan urutan', () => {
  it('mengurutkan ukuran katalog secara menaik, bukan secara leksikografis', () => {
    const shuffled = ['4"', '1/2"', '1¼"', '3/4"', '2"', '1"', '1½"', '3"'].map((l) =>
      PipeSize.parse(l)!,
    );
    expect(PipeSize.sort(shuffled).map((s) => s.label)).toEqual([...CATALOG_LABELS]);
    // Urutan string akan menempatkan 1/2" sebelum 1" dan 4" sebelum 1¼" — keliru.
  });

  it('mengetahui ukuran mana yang lebih besar', () => {
    expect(PipeSize.parse('1"')!.isLargerThan(PipeSize.parse('3/4"')!)).toBe(true);
    expect(PipeSize.parse('3/4"')!.isLargerThan(PipeSize.parse('1"')!)).toBe(false);
    expect(PipeSize.parse('1"')!.isLargerThan(PipeSize.parse('1"')!)).toBe(false);
  });
});

describe('PipeSizeRange — ukuran yang belum bisa dipastikan', () => {
  it('menampilkan rentang beserta tanda tanya seperti layar 07', () => {
    const range = new PipeSizeRange(PipeSize.parse('3"')!, PipeSize.parse('4"')!);
    expect(range.label).toBe('3"–4" ?');
  });

  it('bukan PipeSize, sehingga tidak bisa dipakai sebagai ukuran final', () => {
    const range = new PipeSizeRange(PipeSize.parse('3"')!, PipeSize.parse('4"')!);
    expect(range).not.toBeInstanceOf(PipeSize);
  });

  it('tahu ukuran mana yang berada di dalamnya', () => {
    const range = new PipeSizeRange(PipeSize.parse('3"')!, PipeSize.parse('4"')!);
    expect(range.contains(PipeSize.parse('3"')!)).toBe(true);
    expect(range.contains(PipeSize.parse('4"')!)).toBe(true);
    expect(range.contains(PipeSize.parse('2"')!)).toBe(false);
  });
});

describe('PipeSizeTransition — reducer', () => {
  it('menampilkan transisi seperti di BOM dan daftar jalur', () => {
    const t = new PipeSizeTransition(PipeSize.parse('1"')!, PipeSize.parse('3/4"')!);
    expect(t.label).toBe('1" → 3/4"');
  });
});

describe('PipeSize — serialisasi', () => {
  it('menjadi label kanonik saat masuk JSON, bukan angka mentah', () => {
    expect(JSON.parse(JSON.stringify({ size: PipeSize.parse('1¼"') }))).toEqual({ size: '1¼"' });
  });
});
