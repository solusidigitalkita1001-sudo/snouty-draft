/**
 * Gambar untuk pilihan di kartu pertanyaan (DD-01, P17-05).
 *
 * Kuncinya data terstruktur dari API, bukan kalimat pengguna: id pertanyaan (bidang kebutuhan
 * atau kunci parameter registry) dan nilai pilihan protokolnya (label Indonesia kanonik). Nilai
 * yang tidak ada di sini tampil sebagai chip teks biasa — tidak ada gambar tebakan. Pilihan angka
 * dan ya/tidak sengaja tanpa gambar: gambarnya tidak menambah apa pun.
 */

import type { SceneIllustration } from '@snouty/ui/illustrations';

type OptionMap = Readonly<Record<string, SceneIllustration>>;

const SOURCE: OptionMap = {
  PDAM: 'meter',
  'Sungai / saluran': 'river',
  Sumur: 'well',
  'Embung / kolam': 'embung',
  'Toren atap': 'tank',
  'Toren bawah': 'groundtank',
  Reservoir: 'reservoir',
  'Jaringan hulu': 'mainline',
};

const IRRIGATION_METHOD: OptionMap = {
  'Genangan / gravitasi': 'field',
  Sprinkler: 'sprinkler',
  Tetes: 'drip',
};

export const OPTION_ILLUSTRATIONS: Readonly<Record<string, OptionMap>> = {
  // Kartu rumah (bidang kebutuhan).
  'water.source': {
    'Toren atap': 'tank',
    'Toren bawah': 'groundtank',
    Pompa: 'pump',
    PDAM: 'meter',
  },
  'water.installationType': { 'Air bersih': 'drop', Pembuangan: 'septic', Keduanya: 'house2' },
  // Kartu irigasi.
  'irrigation.source': {
    'Sungai / saluran': 'river',
    'Sumur / pompa': 'well',
    'Embung / kolam': 'embung',
    PDAM: 'meter',
  },
  'irrigation.method': IRRIGATION_METHOD,
  // Kartu kasus teknis (parameter registry).
  source_type: SOURCE,
  project_type: {
    'Rumah tinggal': 'house2',
    'Gedung bertingkat': 'tower',
    'Cluster perumahan': 'cluster',
    Irigasi: 'field',
    'Drainase / air hujan': 'gutter',
    'Gorong-gorong': 'culvert',
    'Transfer pompa': 'hilltank',
    Lainnya: 'question',
  },
  building_type: {
    'Rumah tinggal': 'house2',
    'Rumah kos': 'kos',
    'Komersial ringan': 'shophouse',
    Industri: 'factory',
  },
  destination_type: {
    'Fixture di bangunan': 'basin',
    Toren: 'tank',
    Lahan: 'field',
    Reservoir: 'reservoir',
    Saluran: 'ditch',
    'Jaringan hilir': 'network',
  },
  fluid_type: {
    'Air bersih': 'drop',
    'Air hujan': 'rain',
    'Air limbah': 'sewage',
    'Air irigasi': 'field',
    'Cairan proses': 'process',
  },
  installation_location: {
    'Di dalam bangunan': 'inside',
    'Di luar, terbuka': 'outside',
    Ditanam: 'buried',
  },
  installation_method: {
    Ditanam: 'buried',
    Digantung: 'hanging',
    'Menempel dinding': 'wallmount',
    'Di atas tanah': 'onground',
  },
  terrain: { Datar: 'flat', Miring: 'slope', Bergelombang: 'wavy' },
  field_shape: { 'Bujur sangkar': 'square', Memanjang: 'long', 'Tidak beraturan': 'irregular' },
  irrigation_method: IRRIGATION_METHOD,
  crop_type: { Padi: 'rice', Palawija: 'corn', Sayur: 'veg', 'Buah / perkebunan': 'tree' },
  simultaneous_usage: { Bersamaan: 'together', Tersebar: 'spread', 'Tidak tahu': 'question' },
  outfall_condition: {
    'Saluran kota': 'citydrain',
    Sungai: 'river',
    Resapan: 'soakaway',
    'Belum ada': 'question',
  },
  traffic_load: { 'Pejalan kaki / motor': 'moto', Mobil: 'car', 'Truk / berat': 'truck' },
  soil_type: { Keras: 'rock', Lempung: 'clay', Berpasir: 'sand', 'Gambut / lunak': 'peat' },
};

/** Pertanyaan ini punya pilihan bergambar — kartunya ditata sebagai ubin. */
export function hasOptionIllustrations(questionId: string): boolean {
  return questionId in OPTION_ILLUSTRATIONS;
}

/** Gambar satu pilihan; "Belum tahu" memakai gambar tanya di kartu bergambar. */
export function optionIllustration(
  questionId: string,
  option: string,
  unknownOption: string,
): SceneIllustration | null {
  const map = OPTION_ILLUSTRATIONS[questionId];
  if (!map) return null;
  if (option === unknownOption) return 'question';
  return map[option] ?? null;
}
