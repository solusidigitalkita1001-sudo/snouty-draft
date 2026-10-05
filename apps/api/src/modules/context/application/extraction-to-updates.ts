/**
 * Mengubah keluaran ekstraksi (skema `ai`) menjadi pembaruan field untuk `ContextMerger`.
 *
 * `undefined` = "tidak disebut di pesan ini" dan tidak menghasilkan pembaruan; `null`
 * tidak pernah datang dari skema (`optional`, bukan `nullable`).
 *
 * **Pagar grounding.** Model kecil gemar "melengkapi": dari "Rumah 2 lantai, 3 kamar
 * mandi" ia menulis `floorHeightM: 3` dan `mainRunMeters: 0` — angka yang tidak pernah
 * diucapkan pengguna, lalu masuk state sebagai `user_stated`. Prompt sudah melarangnya,
 * tetapi larangan di prompt dianggap tidak ada (docs/AI_BEHAVIOR.md): field yang hanya
 * bermakna bila pengguna menyebut hal itu dibuang bila pesannya tidak memuat
 * penandanya. Laju halusinasi harus 0% (docs/EVALUATION.md), dan ini salah satu pagarnya.
 */

import type { Extraction } from '../../ai/domain/extraction-schema.js';
import type { FieldUpdate } from '../domain/context-merger.js';

/** Penanda kata yang harus ada di pesan sebelum field ini dipercaya. */
const GROUNDING: Readonly<Record<string, RegExp>> = {
  'building.floorHeightM': /\b(tinggi|ketinggian|meter|\d\s*m\b)/i,
  'building.dimensions': /\b(meter|\d\s*m\b|panjang|jarak|jalur)/i,
  'fixtures.outletCount': /\b(titik|outlet|keran|kran)/i,
  'water.boosterPump': /\b(pompa|booster|pendorong)/i,
};

export function extractionToUpdates(extraction: Extraction, message = ''): FieldUpdate[] {
  const updates: FieldUpdate[] = [];
  const add = (path: FieldUpdate['path'], value: unknown): void => {
    if (value === undefined) return; // "tidak disebut di pesan ini"
    const marker = GROUNDING[path];
    if (marker && message !== '' && !marker.test(message)) return; // tidak pernah diucapkan
    updates.push({ path, value, source: 'user_stated' });
  };

  add('building.type', extraction.building?.type);
  add('building.floors', extraction.building?.floors);
  add('building.floorHeightM', extraction.building?.floorHeightM);
  if (extraction.building?.mainRunMeters !== undefined) {
    add('building.dimensions', { mainRunMeters: extraction.building.mainRunMeters });
  }

  add('fixtures.bathrooms', extraction.fixtures?.bathrooms);
  add('fixtures.basins', extraction.fixtures?.basins);
  add('fixtures.kitchens', extraction.fixtures?.kitchens);
  add('fixtures.outletCount', extraction.fixtures?.outletCount);

  add('water.source', extraction.water?.source);
  add('water.installationType', extraction.water?.installationType);
  add('water.boosterPump', extraction.water?.boosterPump);

  return updates;
}
