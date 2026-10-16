/**
 * Contoh rumah di layar sambutan (P22-01, masukan pengguna rumah subsidi 2026-10-16): pengguna
 * awam memilih yang paling mirip, nilainya masuk sebagai ASUMSI bertanda contoh — kalah dari
 * apa pun yang ia sebut, tampil di tabel Asumsi dengan tombol Ubah. Daftarnya DATA
 * (`data/house-examples/examples.json`), dimuat infrastruktur; di sini bentuk dan kalimatnya.
 */
import type { Locale } from '@snouty/shared-types';
import type { SceneIllustration } from '@snouty/ui/illustrations';
import type { RequirementEdit } from './requirement-edit.js';

export interface HouseExample {
  readonly id: string;
  readonly image: SceneIllustration;
  readonly label: { readonly id: string; readonly en: string };
  readonly summary: { readonly id: string; readonly en: string };
  readonly fields: readonly RequirementEdit[];
}

export const HOUSE_EXAMPLES = Symbol('HOUSE_EXAMPLES');

/** Alasan di tabel Asumsi untuk setiap nilai contoh — satu kalimat, menyebut contohnya. */
export function houseExampleReason(example: HouseExample, locale: Locale): string {
  return locale === 'en'
    ? `From the example "${example.label.en}"; change it if your house differs.`
    : `Dari contoh "${example.label.id}"; ubah bila rumah Anda berbeda.`;
}

/** Gelembung pengguna: contoh yang dipilih. */
export function houseExampleUserText(example: HouseExample, locale: Locale): string {
  return locale === 'en'
    ? `Start from the example: ${example.label.en}`
    : `Mulai dari contoh: ${example.label.id}`;
}

/** Balasan teknisi: apa yang dipakai, cara mengubahnya, dan langkah berikutnya. Tanpa model. */
export function houseExampleReply(example: HouseExample, locale: Locale): string {
  return locale === 'en'
    ? `I am using the example "${example.label.en}": ${example.summary.en}. If your house is different, just type the difference, for example "two bathrooms", or change it in the panel on the right. When it matches, press Compose recommendation.`
    : `Saya pakai contoh "${example.label.id}": ${example.summary.id}. Kalau rumah Anda berbeda, ketik saja bedanya, misalnya "kamar mandinya 2", atau ubah di panel kanan. Kalau sudah pas, tekan Susun rekomendasi.`;
}
