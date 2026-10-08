/**
 * Penyandi cadangan tanpa model: trigram huruf yang di-hash ke vektor tetap.
 *
 * Hanya untuk tes dan mode pengembangan tanpa Ollama (`SNOUTY_FAKE_AI=1`). Ia mengenali
 * kalimat yang MIRIP EJAANNYA dengan contoh, bukan maknanya — "makasih" ≈ "makasih ya", tetapi
 * "terima kasih" ≉ "thanks". Ambang di katalog data ditala untuk model embedding sungguhan;
 * dengan penyandi ini, hanya kalimat yang hampir sama dengan contoh yang lolos. Itu disengaja:
 * cadangan yang terlalu percaya diri lebih buruk daripada yang jujur ragu.
 */
import type { TextEncoder } from '../../ai/domain/text-encoder.port.js';

const DIMENSIONS = 1024;

export class HashedNgramEncoder implements TextEncoder {
  readonly id = 'hashed-trigram-v1';

  encode(texts: readonly string[]): Promise<readonly Float32Array[]> {
    return Promise.resolve(texts.map(encodeOne));
  }
}

function encodeOne(text: string): Float32Array {
  const vector = new Float32Array(DIMENSIONS);
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  for (const word of words) {
    const padded = ` ${word} `;
    for (let i = 0; i + 3 <= padded.length; i += 1) bump(vector, padded.slice(i, i + 3));
    // Kata utuh sebagai fitur juga, supaya kata pendek ("ya", "ok") punya bobot sendiri.
    bump(vector, `w:${word}`);
  }
  let sum = 0;
  for (const v of vector) sum += v * v;
  const length = Math.sqrt(sum);
  if (length > 0) for (let i = 0; i < DIMENSIONS; i += 1) vector[i] = vector[i]! / length;
  return vector;
}

/** FNV-1a: indeks dari bit atas, tanda dari bit terendah — mengurangi tabrakan yang searah. */
function bump(vector: Float32Array, feature: string): void {
  let h = 0x811c9dc5;
  for (let i = 0; i < feature.length; i += 1) {
    h ^= feature.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const index = (h >>> 1) % DIMENSIONS;
  vector[index] = vector[index]! + ((h & 1) === 0 ? 1 : -1);
}
