/**
 * Pencatat pertanyaan tak terjawab, ke log terstruktur — bukan ke tabel.
 *
 * Tabel akan menggoda untuk menyimpan kalimat pengguna "supaya bisa dianalisis
 * nanti", dan kalimat pengguna tidak dibutuhkan untuk memutuskan ambang 10% di
 * kriteria adopsi RAG. Log terstruktur memberi angka yang sama tanpa menyimpan
 * apa pun yang perlu dihapus saat pengguna meminta datanya dihapus.
 *
 * Yang dicatat hanya empat field, dan `catalogVersionId` ikut karena ia yang
 * menjelaskan kenapa rasionya berubah: kolom yang terisi di versi berikutnya
 * seharusnya menurunkan angkanya.
 */
import { Injectable } from '@nestjs/common';
import type { Logger } from 'pino';
import { LoggerService } from '../../../shared/logging/logger.service.js';
import {
  UNANSWERED_QUESTION_RECORDER,
  type UnansweredQuestion,
  type UnansweredQuestionRecorder,
} from '../domain/unanswered-question.port.js';

/** Satu nama peristiwa, supaya rasionya bisa dihitung dengan satu filter log. */
const EVENT = 'product_question.unanswered';

@Injectable()
export class PinoUnansweredQuestionRecorder implements UnansweredQuestionRecorder {
  private readonly log: Logger;

  constructor(logger: LoggerService) {
    this.log = logger.child({ module: 'product-knowledge' });
  }

  record(question: UnansweredQuestion): void {
    // `info`, bukan `warn`: kolom katalog yang kosong adalah keadaan yang sudah
    // diperkirakan dan ditangani, bukan kegagalan. Mencatatnya sebagai peringatan
    // akan membuat peringatan berhenti berarti apa pun.
    this.log.info(
      {
        event: EVENT,
        productId: question.productId,
        aspect: question.aspect,
        hasDocuments: question.hasDocuments,
        catalogVersionId: question.catalogVersionId,
      },
      'pertanyaan produk tidak terjawab katalog',
    );
  }
}

export const unansweredQuestionRecorderProvider = {
  provide: UNANSWERED_QUESTION_RECORDER,
  inject: [LoggerService],
  useFactory: (logger: LoggerService): UnansweredQuestionRecorder =>
    new PinoUnansweredQuestionRecorder(logger),
};
