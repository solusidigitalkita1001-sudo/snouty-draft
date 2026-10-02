/**
 * Palet cetak laporan tidak boleh menyimpang dari token desain.
 *
 * Dokumen cetak adalah artefak mandiri — Chromium merendernya tanpa pipeline CSS, jadi
 * warnanya harus literal dan tidak bisa mewarisi custom property dari `packages/ui`.
 * Duplikasi itu tak terhindarkan; yang bisa dihindari adalah **penyimpangan diam-diam**.
 * Tes ini membaca `tokens.css` dan menegaskan setiap nilai di palet cetak masih cocok,
 * sehingga perubahan token yang lupa dicerminkan gagal di sini alih-alih muncul sebagai
 * laporan berwarna lain.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PRINT_PALETTE } from './report-html.js';

const tokensCss = readFileSync(
  fileURLToPath(new URL('../../../../../../packages/ui/src/tokens.css', import.meta.url)),
  'utf8',
);

/** Nilai token dari blok `:root` (mode terang) — bukan dari blok mode gelap. */
function lightValueOf(token: string): string | null {
  const lightBlock = tokensCss.slice(0, tokensCss.indexOf('prefers-color-scheme: dark'));
  const match = new RegExp(`--${token}:\\s*(#[0-9a-fA-F]{3,8})`).exec(lightBlock);
  return match?.[1]?.toLowerCase() ?? null;
}

describe('palet cetak laporan', () => {
  it('setiap entri merujuk token yang benar-benar ada', () => {
    for (const token of Object.keys(PRINT_PALETTE)) {
      expect(lightValueOf(token), `token --${token} tidak ada di tokens.css`).not.toBeNull();
    }
  });

  it('nilainya masih cocok dengan token mode terang', () => {
    for (const [token, value] of Object.entries(PRINT_PALETTE)) {
      expect(lightValueOf(token), `--${token} menyimpang dari palet cetak`).toBe(
        value.toLowerCase(),
      );
    }
  });
});
