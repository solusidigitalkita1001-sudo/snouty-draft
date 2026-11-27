/**
 * Laporan pemilik 2026-10-12: kartu penyempurna tempat ibadah (5 pertanyaan) dijawab → 400, karena
 * endpoint jawaban menerima paling banyak 4. Setiap kartu yang bisa dikirim API harus bisa dijawab.
 *
 * Produksi 2026-11-27: bentuk kartu yang diperiksa di sini dulu hanya empat (jenis bangunan, tanpa
 * sumber air, tanpa renovasi, tanpa pembuangan) — dan celahnya persis di yang tidak diperiksa.
 * Kartu kasus pembuangan menanyakan tujuan air bekas, id-nya ditolak endpoint, dan karena zod
 * memvalidasi seluruh larik jawaban, ukuran bangunan di baris yang sama ikut gagal. Sapuannya kini
 * seluas kartunya sendiri: jenis bangunan × jenis pekerjaan × sumber air × jenis instalasi.
 */
import { DEFAULT_LOCALE } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import {
  houseRefinementQuestions,
  isClarificationAnswerId,
  MAX_ANSWERS_PER_CARD,
  CLARIFICATION_FIELD_IDS,
  summarizeAnswers,
} from './clarification.js';

const BUILDING_TYPES = [null, 'residential', 'place_of_worship', 'public_building'];
const WORK_TYPES = [null, 'new_build', 'replace_all', 'replace_partial', 'extend'];
const WATER_SOURCES = [null, 'pdam', 'pump', 'tank'];
const INSTALLATION_TYPES = [null, 'clean_water', 'drainage', 'both'];

describe('kartu klarifikasi yang dikirim API bisa dijawab lewat API', () => {
  for (const buildingType of BUILDING_TYPES) {
    for (const workType of WORK_TYPES) {
      for (const waterSource of WATER_SOURCES) {
        for (const installationType of INSTALLATION_TYPES) {
          const shape = `${buildingType ?? 'rumah'} · ${workType ?? 'bangun baru'} · ${waterSource ?? 'sumber belum disebut'} · ${installationType ?? 'instalasi belum disebut'}`;
          it(`kartu penyempurna ${shape}: jumlah dan id jawabannya diterima`, () => {
            const card = houseRefinementQuestions(
              () => false,
              DEFAULT_LOCALE,
              buildingType,
              waterSource,
              workType,
              installationType,
            );
            expect(card.length).toBeLessThanOrEqual(MAX_ANSWERS_PER_CARD);
            for (const q of card) expect(isClarificationAnswerId(q.id), q.id).toBe(true);
          });
        }
      }
    }
  }

  // Yang gagal di produksi, disebut namanya supaya penyebabnya terbaca tanpa menelusuri sapuan.
  it('tujuan air bekas pada kasus pembuangan bisa dijawab (produksi 2026-11-27)', () => {
    for (const installationType of ['drainage', 'both']) {
      const ids = houseRefinementQuestions(
        () => false,
        DEFAULT_LOCALE,
        null,
        null,
        null,
        installationType,
      ).map((q) => q.id);
      expect(ids, installationType).toContain('water.greyWaterDestination');
    }
    expect(isClarificationAnswerId('water.greyWaterDestination')).toBe(true);
  });
});

/**
 * Produksi 2026-11-27: gelembung pengguna setelah kartu berbunyi "Ukuran: bangunan 12 × 8 m ·
 * fixtures.outdoorTaps: Tidak ada · fixtures.upperFloorTaps: Tidak ada · Tujuan air bekas:
 * Saluran kota". Dua path kode di layar, karena dua pertanyaan P33-04 tidak pernah diberi label.
 * Pagarnya berlaku untuk setiap pertanyaan yang punya templat, bukan hanya dua itu.
 */
describe('ringkasan jawaban tidak pernah menampilkan path field', () => {
  for (const id of CLARIFICATION_FIELD_IDS) {
    it(`${id} punya label manusiawi di ringkasan`, () => {
      for (const locale of ['id', 'en'] as const) {
        const summary = summarizeAnswers([{ id, option: 'Belum tahu' }], locale);
        expect(summary, `${id} (${locale})`).not.toContain(id);
      }
    });
  }
});
