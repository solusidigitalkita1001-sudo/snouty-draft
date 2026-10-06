/**
 * Adapter CSV: bentuk berkas → `CatalogImportSource`, tanpa menyentuh aturan validasi.
 */
import { describe, expect, it } from 'vitest';
import { validateCatalogImport } from '../domain/catalog-import.validator.js';
import {
  CsvCatalogImportAdapter,
  CsvCatalogImportError,
  parseCsvCatalog,
} from './csv-catalog-import.adapter.js';

const HEADER = 'sku,name,family,category,source_page,sizes,rod_length';

describe('parseCsvCatalog', () => {
  it('baris normal: header → columns, sel → values, nomor baris fisik (header = 1)', () => {
    const source = parseCsvCatalog(
      `${HEADER}\nPRL-1,Pipa AW,PVC AW,PIPA,14,3/4,4 m\n`,
      'v1',
      'Katalog 2026',
    );
    expect(source.columns).toEqual(HEADER.split(','));
    expect(source.rows).toEqual([
      {
        rowNumber: 2,
        values: {
          sku: 'PRL-1',
          name: 'Pipa AW',
          family: 'PVC AW',
          category: 'PIPA',
          source_page: '14',
          sizes: '3/4',
          rod_length: '4 m',
        },
      },
    ]);
    expect(source.label).toBe('v1');
    expect(source.sourceDocument).toBe('Katalog 2026');
  });

  it('nilai jamak dibiarkan utuh; validator yang memecahnya menjadi ukuran terurut', () => {
    const source = parseCsvCatalog(
      `${HEADER}\nPRL-1,Pipa AW,PVC AW,PIPA,14,"1; 3/4; 1 1/4",`,
      'v1',
      'K',
    );
    expect(source.rows[0]!.values['sizes']).toBe('1; 3/4; 1 1/4');
    const validation = validateCatalogImport(source);
    expect(validation.issues).toEqual([]);
    expect(validation.rows[0]!.sizes.map((s) => s.label)).toEqual(['3/4"', '1"', '1¼"']);
  });

  it('sel berkutip boleh memuat koma, kutip ganda (""), dan baris baru; CRLF dan BOM diterima', () => {
    const text =
      '﻿' +
      HEADER.replace(/,/g, ',') +
      '\r\n' +
      'PRL-2,"Pipa (Plain End) Abu AW 1/2"" x 4 Meter, kelas AW","PVC AW","PIPA, SNI",3,"1/2\n3/4",\r\n';
    const source = parseCsvCatalog(text, 'v1', 'K');
    expect(source.columns[0]).toBe('sku');
    expect(source.rows[0]!.values['name']).toBe('Pipa (Plain End) Abu AW 1/2" x 4 Meter, kelas AW');
    expect(source.rows[0]!.values['category']).toBe('PIPA, SNI');
    expect(source.rows[0]!.values['sizes']).toBe('1/2\n3/4');
    expect(source.rows[0]!.rowNumber).toBe(2);
  });

  it('karakter UTF-8 (°, ·, ½) utuh lewat adapter maupun bytes', async () => {
    const text = `${HEADER}\nPRL-3,Elbow 90° PVC AW,PVC AW,FITTING · SNI,41,1½,\n`;
    const bytes = new TextEncoder().encode(text);
    const source = await new CsvCatalogImportAdapter().read({
      label: 'v1',
      sourceDocument: 'K',
      bytes,
    });
    expect(source.rows[0]!.values['name']).toBe('Elbow 90° PVC AW');
    expect(source.rows[0]!.values['category']).toBe('FITTING · SNI');
    expect(validateCatalogImport(source).rows[0]!.sizes[0]!.label).toBe('1½"');
  });

  it('kolom wajib hilang: adapter tetap membaca, validator melaporkannya sekali di tingkat berkas', () => {
    const source = parseCsvCatalog('sku,name\nPRL-4,Tanpa family\n', 'v1', 'K');
    const validation = validateCatalogImport(source);
    expect(validation.rows).toEqual([]);
    expect(validation.issues.map((i) => [i.rowNumber, i.column])).toEqual([
      [0, 'family'],
      [0, 'category'],
      [0, 'source_page'],
    ]);
  });

  it('sel kosong tidak dibawa; baris kosong di akhir dilewati; nomor baris tetap fisik', () => {
    const source = parseCsvCatalog(`${HEADER}\nPRL-5,Pipa,PVC D,PIPA,26,,\n\n`, 'v1', 'K');
    expect(source.rows).toHaveLength(1);
    expect(source.rows[0]!.values).toEqual({
      sku: 'PRL-5',
      name: 'Pipa',
      family: 'PVC D',
      category: 'PIPA',
      source_page: '26',
    });
  });

  it('galat bentuk berkas dilaporkan dengan nomor baris: sel lebih banyak dari header, kutip tak ditutup, header ganda', () => {
    expect(() => parseCsvCatalog(`${HEADER}\na,b,c,d,e,f,g,h\n`, 'v1', 'K')).toThrow(
      CsvCatalogImportError,
    );
    expect(() => parseCsvCatalog(`${HEADER}\na,"belum ditutup\n`, 'v1', 'K')).toThrow(/baris 2/);
    expect(() => parseCsvCatalog('sku,sku\n', 'v1', 'K')).toThrow(/dua kali/);
  });

  it('supports(): berdasarkan ekstensi atau MIME', () => {
    const adapter = new CsvCatalogImportAdapter();
    expect(adapter.format).toBe('csv');
    expect(adapter.supports('katalog.CSV', 'application/octet-stream')).toBe(true);
    expect(adapter.supports('katalog.bin', 'text/csv; charset=utf-8')).toBe(true);
    expect(adapter.supports('katalog.xlsx', 'application/vnd.ms-excel')).toBe(false);
  });
});
