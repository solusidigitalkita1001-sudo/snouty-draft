/**
 * Membaca payload laporan yang tersimpan (`reports.payload_json`).
 *
 * Payload dibekukan saat laporan dibuat dan tidak pernah dirakit ulang. Laporan yang dibuat
 * sebelum P15-05 tidak punya `locale` — semuanya lahir dalam bahasa Indonesia, jadi dibaca
 * sebagai `DEFAULT_LOCALE`. Nilai yang tidak dikenal juga jatuh ke baku: dokumen lama harus
 * tetap tercetak, bukan gagal karena satu field.
 */
import { DEFAULT_LOCALE, isLocale } from '@snouty/shared-types';
import type { ReportPayload } from './report.types.js';

export function storedReportPayload(raw: unknown): ReportPayload {
  const stored = raw as Omit<ReportPayload, 'locale'> & { readonly locale?: unknown };
  return { ...stored, locale: isLocale(stored.locale) ? stored.locale : DEFAULT_LOCALE };
}
