/**
 * UnitConverter (brief §10 — fase 3). Konversi deterministik ke satuan internal engine:
 * debit l/s, panjang m, head m kolom air, diameter mm. Tanpa pembulatan tersembunyi —
 * pembulatan untuk tampilan dilakukan di aturan/penyaji, bukan di sini.
 */

const M_HEAD_PER_BAR = 10.197; // 1 bar ≈ 10,197 m kolom air (air 4 °C, g = 9,81)

export function m3hToLs(m3h: number): number {
  return m3h / 3.6;
}
export function lsToM3h(ls: number): number {
  return ls * 3.6;
}
export function lminToLs(lmin: number): number {
  return lmin / 60;
}
export function barToHeadM(bar: number): number {
  return bar * M_HEAD_PER_BAR;
}
export function headMToBar(m: number): number {
  return m / M_HEAD_PER_BAR;
}
export function inchToMm(inch: number): number {
  return inch * 25.4;
}
export function kmToM(km: number): number {
  return km * 1000;
}

/** Label inci ('1½"', '1 1/2"', '3/4"', '2"') → angka inci; `null` bila tidak terbaca. */
export function parseInchLabel(label: string): number | null {
  const text = label
    .replace(/["”]/g, '')
    .replace('¼', ' 1/4')
    .replace('½', ' 1/2')
    .replace('¾', ' 3/4')
    .trim();
  const m = /^(\d+)?\s*(?:(\d+)\/(\d+))?$/.exec(text);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  const whole = m[1] ? Number(m[1]) : 0;
  const frac = m[2] && m[3] ? Number(m[2]) / Number(m[3]) : 0;
  return whole + frac;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
