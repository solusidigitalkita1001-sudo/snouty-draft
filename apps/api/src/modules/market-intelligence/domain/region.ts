/**
 * Wilayah event pasar dari geolokasi IP (P26-07, OQ-77). Yang disimpan **provinsi**, bukan kota:
 * kota dari IP di Indonesia sering meleset ke kota penyedia internet dan kadang setingkat kecamatan
 * ("Cicurug"), terlalu sempit untuk ambang k-anonimitas dan terlalu yakin untuk akurasinya. IP di
 * luar Indonesia tidak diberi wilayah.
 *
 * Peta ini kosakata nilai (nama provinsi DB-IP berbahasa Inggris → nama resmi), bukan pola kalimat.
 */
const PROVINCE_ID: Readonly<Record<string, string>> = {
  Aceh: 'Aceh',
  Bali: 'Bali',
  'Bangka–Belitung Islands': 'Kepulauan Bangka Belitung',
  'Bangka-Belitung Islands': 'Kepulauan Bangka Belitung',
  Banten: 'Banten',
  Bengkulu: 'Bengkulu',
  'Central Java': 'Jawa Tengah',
  'Central Kalimantan': 'Kalimantan Tengah',
  'Central Papua': 'Papua Tengah',
  'Central Sulawesi': 'Sulawesi Tengah',
  'East Java': 'Jawa Timur',
  'East Kalimantan': 'Kalimantan Timur',
  'East Nusa Tenggara': 'Nusa Tenggara Timur',
  Gorontalo: 'Gorontalo',
  'Highland Papua': 'Papua Pegunungan',
  Jakarta: 'DKI Jakarta',
  Jambi: 'Jambi',
  Lampung: 'Lampung',
  Maluku: 'Maluku',
  'North Kalimantan': 'Kalimantan Utara',
  'North Maluku': 'Maluku Utara',
  'North Sulawesi': 'Sulawesi Utara',
  'North Sumatra': 'Sumatera Utara',
  Papua: 'Papua',
  Riau: 'Riau',
  'Riau Islands': 'Kepulauan Riau',
  'South Kalimantan': 'Kalimantan Selatan',
  'South Papua': 'Papua Selatan',
  'South Sulawesi': 'Sulawesi Selatan',
  'South Sumatra': 'Sumatera Selatan',
  'Southeast Sulawesi': 'Sulawesi Tenggara',
  'Southwest Papua': 'Papua Barat Daya',
  'West Java': 'Jawa Barat',
  'West Kalimantan': 'Kalimantan Barat',
  'West Nusa Tenggara': 'Nusa Tenggara Barat',
  'West Papua': 'Papua Barat',
  'West Sulawesi': 'Sulawesi Barat',
  'West Sumatra': 'Sumatera Barat',
  Yogyakarta: 'DI Yogyakarta',
  'Special Region of Yogyakarta': 'DI Yogyakarta',
};

/** Bentuk catatan mmdb yang dipakai — negara, subdivisi, kota, dan titik kasarnya. */
export interface GeoRecord {
  readonly country?: { readonly iso_code?: string };
  readonly subdivisions?: readonly { readonly names?: { readonly en?: string } }[];
  readonly city?: { readonly names?: { readonly en?: string } };
  readonly location?: { readonly latitude?: number; readonly longitude?: number };
}

/**
 * Tempat satu event pasar: provinsi, kota perkiraan, dan koordinat yang **dibulatkan 0,1°** (±11 km).
 * Pembulatan itu yang membuat titik di peta tetap setingkat kota — bukan alamat (P26-12, OQ-77).
 */
export interface Place {
  readonly province: string | null;
  readonly city: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
}

const COARSE = 10; // satu angka di belakang koma

export function placeOf(record: GeoRecord | null | undefined): Place {
  const province = provinceOf(record);
  if (province === null) return { province: null, city: null, lat: null, lng: null };
  const city = record?.city?.names?.en ?? null;
  const lat = record?.location?.latitude;
  const lng = record?.location?.longitude;
  const coarse = (v: number | undefined) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.round(v * COARSE) / COARSE : null;
  return { province, city: city === '' ? null : city, lat: coarse(lat), lng: coarse(lng) };
}

export function provinceOf(record: GeoRecord | null | undefined): string | null {
  if (record?.country?.iso_code !== 'ID') return null;
  const name = record.subdivisions?.[0]?.names?.en;
  if (name === undefined || name.trim() === '') return null;
  // Nama baru yang belum ada di peta tetap setingkat provinsi — disimpan apa adanya.
  return PROVINCE_ID[name] ?? name;
}
