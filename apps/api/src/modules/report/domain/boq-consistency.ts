/**
 * Pagar pra-render (smoke test 13 Nov 2026, temuan 6): angka yang sama tidak boleh berbeda di dua
 * bagian laporan yang sama. Bagian "Dasar perhitungan" mencetak `calc.result` ("8 batang") dan BOQ
 * mencetak `quantity` (1) — keduanya dari baris material yang sama, jadi selisih di antaranya bukan
 * selera tampilan: salah satunya salah, dan laporan tidak boleh dicetak membawa keduanya.
 *
 * Pemeriksaannya membandingkan angka, bukan satuannya: "7 batang" dan "7 rods" adalah baris yang
 * sama dalam dua bahasa, sedangkan "8 batang" untuk 1 batang adalah dua jawaban untuk satu baris.
 */
import type { BomItem } from '@snouty/shared-types';

export interface BomQuantityMismatch {
  readonly item: string;
  readonly size: string;
  readonly quantity: number;
  readonly result: string;
}

export class ReportQuantityMismatchError extends Error {
  constructor(readonly mismatches: readonly BomQuantityMismatch[]) {
    super(
      `jumlah material tidak sama dengan hasil hitungnya: ${mismatches
        .map((m) => `${m.item} ${m.size} → ${m.quantity} vs "${m.result}"`)
        .join('; ')}`,
    );
    this.name = 'ReportQuantityMismatchError';
  }
}

/**
 * Angka pertama di `calc.result`; `null` bila hasilnya tidak menyebut angka.
 *
 * Pemisah ribuan id-ID ("1.234 pcs") dan desimal id-ID ("3,1 m") dibedakan dari posisi
 * pemisahnya, bukan diasumsikan salah satunya.
 */
export function quantityInResult(result: string): number | null {
  const match = /\d[\d.,]*/.exec(result);
  if (match === null) return null;
  const text = match[0].replace(/[.,](?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** Baris yang hitungannya dan jumlahnya berbeda. Baris tanpa angka (`pending`) tidak diperiksa. */
export function bomQuantityMismatches(rows: readonly BomItem[]): readonly BomQuantityMismatch[] {
  const out: BomQuantityMismatch[] = [];
  for (const row of rows) {
    if (row.calc === undefined || row.pending === true) continue;
    const stated = quantityInResult(row.calc.result);
    if (stated === null || Math.abs(stated - row.quantity) < 0.005) continue;
    out.push({ item: row.item, size: row.size, quantity: row.quantity, result: row.calc.result });
  }
  return out;
}

export function assertBomQuantitiesMatchCalc(rows: readonly BomItem[]): void {
  const mismatches = bomQuantityMismatches(rows);
  if (mismatches.length > 0) throw new ReportQuantityMismatchError(mismatches);
}
