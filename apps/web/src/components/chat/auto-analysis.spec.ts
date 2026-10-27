/**
 * Laporan pemilik 2026-10-27: "pengen bikin rumah 2 lantai" langsung menampilkan solusi, dan
 * pertanyaan yang dikirim di giliran yang sama tidak pernah terlihat.
 */
import type { AssistantCard } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { autoAnalysisStart } from './auto-analysis';

const analyze = (auto?: boolean): AssistantCard =>
  auto === undefined
    ? { kind: 'cta', action: 'ANALYZE' }
    : { kind: 'cta', action: 'ANALYZE', auto };

const clarification: AssistantCard = {
  kind: 'clarification',
  questions: [
    {
      id: 'fixtures.bathrooms',
      question: 'Ada berapa kamar mandi?',
      options: ['1', '2'],
      allowUnknown: true,
    },
  ],
};

describe('hitungan yang berjalan sendiri', () => {
  it('kartu ANALYZE bertanda auto: dihitung, tetapi tetap di percakapan', () => {
    expect(autoAnalysisStart([clarification, analyze(true)])).toBe('in-chat');
  });

  it('tanpa tanda auto: menunggu tombol', () => {
    expect(autoAnalysisStart([analyze()])).toBe('none');
    expect(autoAnalysisStart([analyze(false)])).toBe('none');
    expect(autoAnalysisStart([clarification])).toBe('none');
    expect(autoAnalysisStart([])).toBe('none');
  });

  it('tidak ada jalur yang membuka layar solusi sendiri', () => {
    const starts = [[analyze(true)], [analyze(false)], [clarification], []].map(autoAnalysisStart);
    expect(starts).not.toContain('open-solution');
  });
});
