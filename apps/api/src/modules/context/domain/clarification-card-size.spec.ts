/**
 * Laporan pemilik 2026-10-12: kartu penyempurna tempat ibadah (5 pertanyaan) dijawab → 400, karena
 * endpoint jawaban menerima paling banyak 4. Setiap kartu yang bisa dikirim API harus bisa dijawab.
 */
import { DEFAULT_LOCALE } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import {
  houseRefinementQuestions,
  isClarificationAnswerId,
  MAX_ANSWERS_PER_CARD,
} from './clarification.js';

describe('kartu klarifikasi yang dikirim API bisa dijawab lewat API', () => {
  for (const type of [null, 'residential', 'place_of_worship', 'public_building']) {
    it(`kartu penyempurna ${type ?? 'rumah'}: jumlah dan id jawabannya diterima`, () => {
      const card = houseRefinementQuestions(() => false, DEFAULT_LOCALE, type);
      expect(card.length).toBeLessThanOrEqual(MAX_ANSWERS_PER_CARD);
      for (const q of card) expect(isClarificationAnswerId(q.id)).toBe(true);
    });
  }
});
