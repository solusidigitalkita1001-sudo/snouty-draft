/**
 * P2-07a — **log tidak pernah memuat isi pertanyaan pengguna.**
 *
 * Diuji dengan menangkap apa yang benar-benar ditulis, bukan dengan membaca kode
 * pencatatnya: satu field tambahan "supaya bisa dianalisis nanti" adalah cara paling
 * umum data pribadi masuk ke log (docs/SECURITY.md §11, docs/PRIVACY.md §5).
 */
import { describe, expect, it } from 'vitest';
import pino from 'pino';
import type { LoggerService } from '../../../shared/logging/logger.service.js';
import { PRODUCT_ASPECTS } from '../domain/product-aspect.js';
import { PinoUnansweredQuestionRecorder } from './pino-unanswered-question.recorder.js';

const PRODUCT_ID = 'P'.padEnd(26, '0');
const VERSION_ID = 'V'.padEnd(26, '0');

/** Logger sungguhan yang menulis ke memori, supaya yang diuji adalah keluarannya. */
function capturing(): { recorder: PinoUnansweredQuestionRecorder; lines: string[] } {
  const lines: string[] = [];
  const logger = pino({ level: 'debug' }, { write: (line: string) => void lines.push(line) });
  const service = { child: (bindings: Record<string, unknown>) => logger.child(bindings) };
  return {
    recorder: new PinoUnansweredQuestionRecorder(service as unknown as LoggerService),
    lines,
  };
}

describe('PinoUnansweredQuestionRecorder', () => {
  it('mencatat produk, aspek, keberadaan dokumen, dan versi katalog', () => {
    const { recorder, lines } = capturing();

    recorder.record({
      productId: PRODUCT_ID,
      aspect: PRODUCT_ASPECTS.pressureClass,
      hasDocuments: true,
      catalogVersionId: VERSION_ID,
    });

    const entry = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    expect(entry['event']).toBe('product_question.unanswered');
    expect(entry['productId']).toBe(PRODUCT_ID);
    expect(entry['aspect']).toBe('pressure_class');
    expect(entry['hasDocuments']).toBe(true);
    expect(entry['catalogVersionId']).toBe(VERSION_ID);
  });

  it('tidak menulis field apa pun di luar yang disepakati', () => {
    // Daftar tertutup: field baru harus lewat tes ini lebih dulu, dan di situlah
    // pertanyaan "apakah ini data pribadi?" pasti ditanyakan.
    const { recorder, lines } = capturing();

    recorder.record({
      productId: PRODUCT_ID,
      aspect: PRODUCT_ASPECTS.rodLength,
      hasDocuments: false,
      catalogVersionId: VERSION_ID,
    });

    const entry = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;

    // Field milik Pino sendiri disisihkan, lalu sisanya diperiksa persis. Menyebut
    // daftar lengkapnya akan membuat tes ini gagal setiap kali Pino menambah field
    // bawaan — dan tes yang sering gagal karena alasan tak relevan akan dilonggarkan.
    const PINO_OWN = new Set(['level', 'time', 'pid', 'hostname', 'msg', 'module']);
    const ours = Object.keys(entry).filter((key) => !PINO_OWN.has(key));

    expect(ours.sort()).toEqual([
      'aspect',
      'catalogVersionId',
      'event',
      'hasDocuments',
      'productId',
    ]);
  });

  it('mencatat sebagai info, bukan peringatan', () => {
    // Kolom katalog yang kosong adalah keadaan yang sudah diperkirakan dan ditangani.
    // Mencatatnya sebagai peringatan membuat peringatan berhenti berarti apa pun.
    const { recorder, lines } = capturing();

    recorder.record({
      productId: PRODUCT_ID,
      aspect: PRODUCT_ASPECTS.jointType,
      hasDocuments: false,
      catalogVersionId: VERSION_ID,
    });

    const entry = JSON.parse(lines[0] ?? '{}') as { level: number };
    expect(entry.level).toBe(pino.levels.values['info']);
  });
});
