/**
 * Menerjemahkan hasil ekstraksi tervalidasi menjadi `FieldUpdate[]` untuk merge.
 * docs/CONTEXT_ENGINE.md §4.
 *
 * Satu-satunya tempat yang memetakan bentuk bersarang skema ekstraksi ke jalur
 * datar merge. Field yang `undefined` sengaja tidak menghasilkan update — "tidak
 * disebut" tidak boleh menghapus apa pun. `source` selalu `user_stated`: ekstraksi
 * membaca apa yang pengguna katakan, bukan menyimpulkan maupun menetapkan default.
 */

import type { Extraction } from '../../ai/domain/extraction-schema.js';
import type { FieldUpdate } from '../domain/context-merger.js';

export function extractionToUpdates(extraction: Extraction): FieldUpdate[] {
  const updates: FieldUpdate[] = [];
  const add = (path: FieldUpdate['path'], value: unknown): void => {
    if (value === undefined) return; // "tidak disebut di pesan ini"
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
