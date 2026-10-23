/**
 * Jangan menanyakan ulang apa yang sudah disebut (P27-02).
 *
 * Laporan pemilik 2026-10-23: "ada user nanya bangun rumah dengan spesifikasi beberapa udah
 * disebutin, tp snouty malah menanyakan ulang bbrp spesifikasi yang disebutin tadi".
 *
 * Sebabnya pagar grounding: ia hanya menerima angka yang tersurat PERSIS di dekat kata bendanya,
 * lalu diam-diam memakai angka lain yang kebetulan ada di teks. Kalimat yang membagi per lantai
 * atau per ruang kehilangan jumlahnya, dan alat yang disebut tanpa angka hilang sama sekali.
 *
 * Tes ini memakai keluaran model yang BENAR untuk tiap kalimat, lalu memeriksa apa yang lolos
 * pagar. Dua sisinya sama penting: yang disebut harus masuk, yang tidak disebut harus tetap
 * ditolak (laju halusinasi 0 %, docs/EVALUATION.md).
 */

import { describe, expect, it } from 'vitest';
import type { Extraction } from '../../ai/domain/extraction-schema.js';
import { confirmCount, extractionToUpdates, statedCounts } from './extraction-to-updates.js';

const BATH = 'kamar mandi|km|toilet|wc|bathrooms?|toilets?|restrooms?';
const KITCHEN = 'dapur|kitchens?|pantry';

const fields = (model: Extraction, message: string): Record<string, unknown> =>
  Object.fromEntries(extractionToUpdates(model, message).map((u) => [u.path, u.value]));

const HOUSE = (floors: number, bathrooms: number, kitchens?: number, basins?: number): Extraction =>
  ({
    building: { type: 'residential', floors },
    fixtures: {
      bathrooms,
      ...(kitchens === undefined ? {} : { kitchens }),
      ...(basins === undefined ? {} : { basins }),
    },
    water: { source: 'municipal' },
  }) as Extraction;

describe('jumlah yang tersebar di kalimat tetap terbaca', () => {
  it('"tiap lantai ada 2 kamar mandi" di rumah 2 lantai = 4, bukan 2', () => {
    const message = 'mau bangun rumah dua lantai, tiap lantai ada 2 kamar mandi, dapur 1, PDAM';
    expect(fields(HOUSE(2, 4, 1), message)).toMatchObject({
      'building.floors': 2,
      'fixtures.bathrooms': 4,
      'fixtures.kitchens': 1,
    });
  });

  it('jumlah per lantai dijumlahkan: 1 + 2 = 3 kamar mandi', () => {
    const message =
      'rumah 2 lantai, lantai 1 ada 1 kamar mandi dan dapur, lantai 2 ada 2 kamar mandi, toren atap';
    expect(fields(HOUSE(2, 3, 1), message)).toMatchObject({ 'fixtures.bathrooms': 3 });
  });

  it('alat yang disebut tanpa angka tidak hilang — dapur tidak ditanyakan lagi', () => {
    const message =
      'rumah 2 lantai, lantai 1 ada 1 kamar mandi dan dapur, lantai 2 ada 2 kamar mandi';
    expect(fields(HOUSE(2, 3, 1), message)['fixtures.kitchens']).toBe(1);
  });

  it('kalimat yang tidak terbaca parser teks memakai bacaan model, asal tidak lebih kecil', () => {
    const message =
      'rumah 3 lantai dengan 4 kamar tidur, masing-masing ada kamar mandi dalam, plus 1 kamar mandi tamu, dapur 1, wastafel 2';
    expect(fields(HOUSE(3, 5, 1, 2), message)).toMatchObject({
      'fixtures.bathrooms': 5,
      'fixtures.basins': 2,
      'fixtures.kitchens': 1,
    });
  });

  it('kalimat lugas tetap apa adanya', () => {
    const message = 'saya mau bangun rumah 2 lantai, 3 kamar mandi, 1 dapur, sumber air PDAM';
    expect(fields(HOUSE(2, 3, 1), message)).toMatchObject({
      'building.floors': 2,
      'fixtures.bathrooms': 3,
      'fixtures.kitchens': 1,
      'water.source': 'municipal',
    });
  });
});

describe('pagar halusinasi tetap berdiri', () => {
  it('pesan tanpa fakta bangunan menolak seluruh angka model', () => {
    const message = 'mau tanya soal pipa dong';
    expect(fields(HOUSE(2, 3, 1, 2), message)).toEqual({});
  });

  it('kata bendanya tidak disebut sama sekali → angkanya ditolak', () => {
    expect(confirmCount('rumah 2 lantai', BATH, 3)).toBeUndefined();
    expect(confirmCount('rumah 2 lantai', KITCHEN, 1)).toBeUndefined();
  });

  it('angka yang jauh dari kata bendanya bukan bukti', () => {
    // "2" milik lantai, bukan wastafel; wastafel tidak disebut.
    expect(confirmCount('rumah 2 lantai', 'wastafel', 2)).toBeUndefined();
  });

  it('nol hanya dengan peniadaan di dekat kata bendanya', () => {
    expect(confirmCount('rumah 2 lantai tanpa dapur', KITCHEN, 0)).toBe(0);
    expect(confirmCount('rumah 2 lantai dengan dapur', KITCHEN, 0)).toBeUndefined();
  });

  it('angka tak masuk akal ditolak walau kata bendanya disebut', () => {
    expect(confirmCount('rumah 2 lantai ada kamar mandi', BATH, 900)).toBeUndefined();
  });
});

describe('statedCounts membaca angka yang menempel kata bendanya', () => {
  it('mengumpulkan semua angka yang tersurat', () => {
    expect(statedCounts('lantai 1 ada 1 kamar mandi, lantai 2 ada 2 kamar mandi', BATH)).toEqual([
      1, 2,
    ]);
  });

  it('kata bilangan ikut terbaca', () => {
    expect(statedCounts('di bawah satu kamar mandi, di atas dua kamar mandi', BATH)).toEqual([
      1, 2,
    ]);
  });

  it('kata benda tanpa angka tidak memberi angka', () => {
    expect(statedCounts('ada dapur di belakang', KITCHEN)).toEqual([]);
  });
});
