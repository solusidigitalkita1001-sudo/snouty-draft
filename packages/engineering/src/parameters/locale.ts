/** Bahasa keluaran teks deterministik. Bahasa Indonesia adalah bawaan di mana pun. */
export type EngineeringLocale = 'id' | 'en';

export const DEFAULT_ENGINEERING_LOCALE: EngineeringLocale = 'id';

/**
 * Satuan registry yang berupa kata Indonesia ("lantai", "titik") dalam bahasa Inggris. Disimpan
 * tetap Indonesia sebagai nilai protokol; diterjemahkan saat ditampilkan (audit 2026-10-19: balasan
 * Inggris berbunyi "number of floors 5 lantai"). Satuan simbol (m, bar, %) tidak berubah.
 */
const UNIT_EN: Readonly<Record<string, string>> = {
  lantai: 'floors',
  cabang: 'branches',
  jam: 'h',
  'jam/hari': 'h/day',
  kolam: 'ponds',
  'mm/jam': 'mm/h',
  orang: 'people',
  sambungan: 'connections',
  tahun: 'years',
  titik: 'points',
  unit: 'units',
  '% jalur': '% of run',
  'WSFU per titik': 'WSFU per point',
  dapur: 'kitchens',
  deret: 'rows',
  hari: 'days',
  inci: 'in',
  'jiwa/sambungan': 'people/connection',
  'l/orang/hari': 'l/person/day',
  'l/s per keran': 'l/s per tap',
  'm jalur datar': 'm of level run',
  menit: 'min',
  'm²/orang': 'm²/person',
  'orang/unit': 'people/unit',
  sok: 'sockets',
  'wastafel per kamar mandi': 'basins per bathroom',
  wastafel: 'basins',
};

export function unitLabel(
  unit: string,
  locale: EngineeringLocale = DEFAULT_ENGINEERING_LOCALE,
): string {
  return locale === 'en' ? (UNIT_EN[unit] ?? unit) : unit;
}
