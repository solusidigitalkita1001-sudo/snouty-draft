/** P21-08: tebal dinding, diameter dalam, dan berat dari tabel standar Pralon (handbook PROD/STD). */
import { describe, expect, it } from 'vitest';
import { pipeStandardRows } from '../../product-knowledge/infrastructure/pipe-standards.loader.js';
import { dimensionAnswer } from './dimension-answer.js';

const rows = pipeStandardRows();
const ask = (message: string, families: string[] = [], locale: 'id' | 'en' = 'id') =>
  dimensionAnswer(message, families, rows, locale);

describe('jawaban dimensi dari standar Pralon', () => {
  it('tabel terbaca dari data/standards', () => {
    expect(rows.length).toBeGreaterThan(300);
  });

  it('HDPE 110 mm SDR 17: tebal 6,6 mm (+0,8), dalam ±96 mm, 2,151 kg/m, dokumen disebut', () => {
    const { text, cards } = ask('tebal pipa hdpe 110 sdr 17 berapa?', ['hdpe']);
    expect(text).toContain('SDR 17 (PN 10)');
    expect(text).toContain('tebal dinding 6,6 mm (+0,8 mm)');
    expect(text).toContain('diameter dalam ±96 mm');
    expect(text).toContain('berat 2,151 kg/m');
    expect(text).toContain('PROD/STD/014 Rev. 04');
    expect(cards).toEqual([]);
  });

  it('PN dibaca sebagai kelas PE100; "SDR 17" tidak terbaca ukuran 17', () => {
    expect(ask('tebal hdpe pn 10 ukuran 90', ['hdpe']).text).toContain('90 mm SDR 17 (PN 10)');
    expect(ask('tebal hdpe sdr 17', ['hdpe']).text).toMatch(
      /^Ukuran berapa\? .*SDR 17 tersedia 32 mm–/,
    );
  });

  it('VP ½": ukuran inci, OD 22 mm, tebal 2,7 mm', () => {
    const { text } = ask('tebal pipa vp 1/2 inch?');
    expect(text).toContain('Pipa uPVC JIS VP 1/2": tebal dinding 2,7 mm');
    expect(text).toContain('PROD/STD-003 Rev. 05');
  });

  it('ukuran tanpa jenis yang ada di beberapa jenis pipa → tanya jenisnya, tidak menumpahkan tabel', () => {
    const { text } = ask('tebal dinding 110 mm berapa');
    expect(text).toMatch(/^Ukuran 110 mm ada di beberapa jenis pipa: .*HDPE.*Yang mana/);
  });

  it('kelas tanpa ukuran itu → sebut rentang yang ada', () => {
    expect(ask('tebal hdpe 20 mm sdr 17', ['hdpe']).text).toMatch(
      /tidak dibuat dalam ukuran 20 mm; yang tersedia 32 mm–/,
    );
  });

  it('PRALON AW: tabel resmi belum ada → tidak ada angka, tawarkan tim teknis (OQ-64)', () => {
    const { text, cards } = ask('tebal pipa aw 1/2', ['pvc aw']);
    expect(text).toContain('belum saya pegang');
    expect(text).not.toMatch(/\d,\d mm/);
    expect(cards).toEqual([{ kind: 'cta', action: 'CONTACT_TECHNICAL' }]);
  });

  it('bahasa Inggris', () => {
    expect(ask('hdpe 110 sdr 11 wall thickness', ['hdpe'], 'en').text).toContain(
      'wall 10 mm (+1.1 mm)',
    );
  });
});
