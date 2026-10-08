/**
 * Parser nilai terstruktur: SUHU fluida yang tersurat ("suhu 70 °C", "60 derajat", "at 70 degrees C").
 * Angka + satuan, bukan pemahaman pertanyaan; batasnya (≥ 45 °C) aturan kebijakan
 * (`policy/scope.ts`). `null` bila tidak ada suhu.
 */
const TEMPERATURE =
  /(\d{2,3}(?:[.,]\d+)?)\s*(?:°\s*c?|derajat(?:\s*celsius)?|degrees?(?:\s*c(?:elsius)?)?|celsius\b|c\b)/i;

export function parseTemperature(text: string): number | null {
  const match = TEMPERATURE.exec(text);
  if (!match) return null;
  const value = Number(match[1]!.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}
