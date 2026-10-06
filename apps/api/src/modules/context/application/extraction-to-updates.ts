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
  // Evaluasi 2026-10-06: dari "Instalasi air bersih untuk rumah baru 1 lantai" model menulis
  // `source: municipal`. Sumber air hanya dipercaya bila pengguna menyebut sumbernya.
  'water.source': /\b(toren|tandon|tangki|pompa|pdam|sumur|ledeng|air tanah|sumber)/i,
  'water.installationType': /\b(air bersih|pembuangan|limbah|drainase|saluran|keduanya)\b/i,
};

/**
 * Kebalikan dari pagar grounding: fakta yang **tersurat** di pesan tetapi dilewatkan model.
 * Model 7B mengembalikan `{}` untuk "lebih bagus PVC atau HDPE buat rumah 2 lantai?" — lalu
 * sistem bertanya "bangunannya berapa lantai?" kepada orang yang baru saja mengatakannya.
 * Hanya tiga hal yang bentuknya tidak bisa salah baca; nilainya dari teks, bukan tebakan,
 * dan hanya dipakai bila model tidak mengisinya.
 */
const OBVIOUS = {
  floors: (m: string) => intAfter(/\b(\d{1,2})\s*(?:lantai|lt)\b/i, m),
  bathrooms: (m: string) => intAfter(/\b(\d{1,2})\s*(?:kamar mandi|km|toilet)\b/i, m),
  type: (m: string): NonNullable<Extraction['building']>['type'] => {
    if (/\b(kos|kost|kos-kosan)\b/i.test(m)) return 'boarding_house';
    if (/\b(pabrik|industri|gudang)\b/i.test(m)) return 'industrial';
    if (/\b(ruko|toko|kantor|kafe|cafe|resto)\b/i.test(m)) return 'light_commercial';
    if (/\b(rumah|hunian)\b/i.test(m)) return 'residential';
    return undefined;
  },
};

function intAfter(pattern: RegExp, message: string): number | undefined {
  const match = pattern.exec(message);
  if (!match?.[1]) return undefined;
  const n = Number(match[1]);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export function extractionToUpdates(extraction: Extraction, message = ''): FieldUpdate[] {
  const updates: FieldUpdate[] = [];
  const add = (path: FieldUpdate['path'], value: unknown): void => {
    if (value === undefined) return; // "tidak disebut di pesan ini"
    const marker = GROUNDING[path];
    if (marker && message !== '' && !marker.test(message)) return; // tidak pernah diucapkan
    updates.push({ path, value, source: 'user_stated' });
  };

  add('building.type', extraction.building?.type ?? OBVIOUS.type(message));
  add('building.floors', extraction.building?.floors ?? OBVIOUS.floors(message));
  add('building.floorHeightM', extraction.building?.floorHeightM);
  if (extraction.building?.mainRunMeters !== undefined) {
    add('building.dimensions', { mainRunMeters: extraction.building.mainRunMeters });
  }

  add('fixtures.bathrooms', extraction.fixtures?.bathrooms ?? OBVIOUS.bathrooms(message));
  add('fixtures.basins', extraction.fixtures?.basins);
  add('fixtures.kitchens', extraction.fixtures?.kitchens);
  add('fixtures.outletCount', extraction.fixtures?.outletCount);

  add('water.source', extraction.water?.source);
  add('water.installationType', extraction.water?.installationType);
  add('water.boosterPump', extraction.water?.boosterPump);

  return updates;
}
