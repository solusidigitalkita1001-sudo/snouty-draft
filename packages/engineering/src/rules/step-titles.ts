/**
 * Judul langkah hitung per aturan, dalam bahasa pengguna — untuk panel "detail teknis" (laporan
 * pemilik 2026-10-09: "gw gak paham rumus itu"). Kode aturan (ENG-…) adalah identitas internal
 * dan tidak pernah tampil; yang tampil judul ini plus penjelasan aturannya (`explain`).
 */

import type { EngineeringLocale } from '../parameters/locale.js';

const TITLES: Readonly<Record<string, { readonly id: string; readonly en: string }>> = {
  'ENG-001': { id: 'Titik air dan beban', en: 'Outlets and load' },
  'ENG-002': { id: 'Ukuran pipa utama', en: 'Main pipe size' },
  'ENG-003': { id: 'Jumlah cabang', en: 'Number of branches' },
  'ENG-004': { id: 'Tinggi lantai', en: 'Floor height' },
  'ENG-005': { id: 'Sambungan ke titik air', en: 'Outlet connection' },
  'ENG-006': { id: 'Cadangan lapangan', en: 'Site allowance' },
  'ENG-007': { id: 'Urutan pertanyaan', en: 'Question order' },
  'ENG-008': { id: 'Sebaran titik per lantai', en: 'Outlets per floor' },
  'ENG-009': { id: 'Jumlah material', en: 'Material quantities' },
  'ENG-010': { id: 'Kecepatan aliran', en: 'Flow speed' },
  'ENG-011': { id: 'Tekanan dari toren', en: 'Pressure from the tank' },
  'ENG-012': { id: 'Isi kamar mandi', en: 'Bathroom fixtures' },
  'ENG-013': { id: 'Kelas pipa', en: 'Pipe class' },
  'ENG-014': { id: 'Nilai bila belum tahu', en: 'Values when unknown' },
  'ENG-101': { id: 'Kebutuhan air lahan', en: 'Field water need' },
  'ENG-102': { id: 'Ukuran pipa dari debit', en: 'Pipe size from flow' },
  'ENG-103': { id: 'Tekanan dan pompa', en: 'Pressure and pump' },
  'ENG-104': { id: 'Bahan tiap jalur', en: 'Material per line' },
  'ENG-105': { id: 'Panjang dan material', en: 'Length and materials' },
  'ENG-201': { id: 'Kecepatan air', en: 'Water speed' },
  'ENG-202': { id: 'Kehilangan tekanan di pipa', en: 'Pressure loss in the pipe' },
  'ENG-203': { id: 'Kehilangan di sambungan', en: 'Loss in the fittings' },
  'ENG-204': { id: 'Tinggi angkat total', en: 'Total lift' },
  'ENG-205': { id: 'Pilih ukuran pipa', en: 'Choosing the pipe size' },
  'ENG-206': { id: 'Pompa yang dibutuhkan', en: 'Pump needed' },
  'ENG-301': { id: 'Volume kolam', en: 'Pond volume' },
  'ENG-302': { id: 'Debit pengisian', en: 'Filling flow' },
  'ENG-303': { id: 'Pipa kuras', en: 'Drain pipe' },
  'ENG-304': { id: 'Material kolam', en: 'Pond materials' },
  'ENG-401': { id: 'Kemampuan pipa saat penuh', en: 'Pipe capacity when full' },
  'ENG-402': { id: 'Pilih ukuran saluran', en: 'Choosing the drain size' },
  'ENG-403': { id: 'Debit air hujan', en: 'Rainwater flow' },
  'ENG-404': { id: 'Timbunan di atas pipa', en: 'Cover above the pipe' },
  'ENG-405': { id: 'Kebutuhan puncak', en: 'Peak demand' },
  'ENG-406': { id: 'Debit air limbah', en: 'Wastewater flow' },
  'ENG-407': { id: 'Ukuran minimum pipa air limbah', en: 'Minimum sewer pipe size' },
  'ENG-408': { id: 'Sambungan dari jumlah jiwa', en: 'Connections from population' },
  'ENG-409': { id: 'Kebutuhan air jaringan', en: 'Network water demand' },
  'ENG-410': { id: 'Volume reservoir', en: 'Reservoir volume' },
  'ENG-411': { id: 'Kelas tekanan pipa', en: 'Pipe pressure class' },
  'ENG-412': { id: 'Aliran sebagian dan kecepatan', en: 'Partial flow and velocity' },
  'ENG-413': { id: 'Manhole dan kedalaman galian', en: 'Manholes and trench depth' },
  'ENG-414': { id: 'Debit per segmen', en: 'Flow per segment' },
  'ENG-415': { id: 'Head di titik kritis', en: 'Head at the critical point' },
  'ENG-416': { id: 'Mode sistem', en: 'System mode' },
  'ENG-501': { id: 'Perkiraan penghuni', en: 'Estimated occupants' },
  'ENG-502': { id: 'Kebutuhan air harian dan puncak', en: 'Daily and peak water need' },
  'ENG-503': { id: 'Zona tekanan dan booster', en: 'Pressure zones and booster' },
  'ENG-504': { id: 'Pembagian riser', en: 'Splitting the risers' },
  'ENG-505': { id: 'Air untuk tiap lantai', en: 'Water for each floor' },
  'ENG-506': { id: 'Volume tangki', en: 'Tank volumes' },
  'ENG-601': { id: 'Beban pembuangan', en: 'Drainage load' },
  'ENG-602': { id: 'Ukuran pipa buangan dan ventilasi', en: 'Drain and vent size' },
  'ENG-603': { id: 'Panjang jalur pembuangan', en: 'Drain line lengths' },
  'ENG-604': { id: 'Cabang per lantai dan pipa tegak', en: 'Branch per floor and stack' },
  'ENG-605': { id: 'Fitting pembuangan', en: 'Drainage fittings' },
  'ENG-701': { id: 'Debit puncak air bersih', en: 'Peak water demand' },
  'ENG-702': { id: 'Jalur dan beda tinggi', en: 'Route and height' },
  'ENG-703': { id: 'Tekanan dari toren atap', en: 'Pressure from the roof tank' },
  'ENG-704': { id: 'Panjang cabang dan sambungan', en: 'Branch and connection lengths' },
  'ENG-705': { id: 'Jarak halaman', en: 'Yard distance' },
  'ENG-706': { id: 'Pipa pengisi toren', en: 'Tank fill pipe' },
  'ENG-707': { id: 'Isi tiap cabang', en: 'Branch contents' },
  'ENG-708': { id: 'Fitting air bersih', en: 'Clean-water fittings' },
  'ENG-709': { id: 'Pompa sumur', en: 'Well pump' },
  'ENG-710': { id: 'Tekanan untuk mengisi toren', en: 'Pressure to fill the tank' },
  'ENG-711': { id: 'Pilihan dudukan toren', en: 'Tank stand options' },
  'ENG-801': { id: 'Debit puncak toilet umum', en: 'Peak demand, public restrooms' },
  'ENG-802': { id: 'Deret keran wudhu', en: 'Ablution tap rows' },
  'ENG-803': { id: 'Talang wudhu', en: 'Ablution trough drain' },
};

/** Judul langkah untuk sebuah aturan; aturan yang belum terdaftar → judul umum, bukan kodenya. */
export function ruleStepTitle(ruleId: string, locale: EngineeringLocale): string {
  const title = TITLES[ruleId];
  if (title) return locale === 'en' ? title.en : title.id;
  return locale === 'en' ? 'Calculation step' : 'Langkah hitung';
}

/** Untuk tes: setiap aturan terdaftar punya judul. */
export function hasStepTitle(ruleId: string): boolean {
  return ruleId in TITLES;
}
