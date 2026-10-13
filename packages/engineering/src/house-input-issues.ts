/**
 * Kewajaran masukan rumah (review putaran 3, kelompok 2): angka yang secara fisik janggal ditanyakan
 * ulang sebelum dihitung, bukan dihitung diam-diam. Pengguna boleh menegaskan angkanya; hitungan
 * tetap jalan dan laporan mencatatnya sebagai data yang perlu diverifikasi.
 *
 * Murni dan tanpa bahasa alami: masukannya angka terstruktur, keluarannya kode + kalimat tetap.
 * Satu sumber untuk kartu tanya di percakapan dan catatan di laporan.
 */

/** Kode masalah — disimpan di state saat pengguna menegaskan angkanya. */
export type HouseOutlierCode = 'area_per_bathroom' | 'land_smaller_than_building';

export interface HouseInputFacts {
  readonly floors: number | null;
  readonly bathrooms: number | null;
  readonly lengthM?: number;
  readonly widthM?: number;
  /** Luas tapak bangunan bila sisinya tidak disebut. */
  readonly areaM2?: number;
  readonly landLengthM?: number;
  readonly landWidthM?: number;
  readonly landAreaM2?: number;
}

export interface HouseInputIssue {
  readonly code: HouseOutlierCode;
  /** Pertanyaan balik di percakapan. */
  readonly question: string;
  readonly questionEn: string;
  /** Catatan di laporan setelah pengguna menegaskan angkanya. */
  readonly note: string;
  readonly noteEn: string;
}

/**
 * Luas lantai terkecil per kamar mandi yang masih wajar (keputusan pemilik 2026-10-13): kamar mandi
 * terkecil sekitar 1,2 × 1,5 m, jadi di bawah 2 m² per kamar mandi berarti bangunannya habis untuk
 * kamar mandi saja.
 */
export const MIN_FLOOR_AREA_PER_BATHROOM_M2 = 2;

const fmt = (n: number, en: boolean) =>
  n.toLocaleString(en ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 });

function footprint(f: HouseInputFacts): number | null {
  if (f.lengthM !== undefined && f.widthM !== undefined) return f.lengthM * f.widthM;
  return f.areaM2 ?? null;
}

function landArea(f: HouseInputFacts): number | null {
  if (f.landLengthM !== undefined && f.landWidthM !== undefined)
    return f.landLengthM * f.landWidthM;
  return f.landAreaM2 ?? null;
}

function sizeText(
  length: number | undefined,
  width: number | undefined,
  area: number,
  en: boolean,
): string {
  return length !== undefined && width !== undefined
    ? `${fmt(length, en)} × ${fmt(width, en)} m`
    : `${fmt(area, en)} m²`;
}

export function houseInputIssues(f: HouseInputFacts): readonly HouseInputIssue[] {
  const issues: HouseInputIssue[] = [];
  const building = footprint(f);
  const floors = f.floors !== null && f.floors >= 1 ? f.floors : null;

  if (building !== null && floors !== null && f.bathrooms !== null && f.bathrooms > 0) {
    const total = building * floors;
    if (total / f.bathrooms < MIN_FLOOR_AREA_PER_BATHROOM_M2) {
      const size = (en: boolean) => sizeText(f.lengthM, f.widthM, building, en);
      const id = `Bangunan ${size(false)} ${floors} lantai luasnya ${fmt(total, false)} m², untuk ${f.bathrooms} kamar mandi itu kurang dari ${MIN_FLOOR_AREA_PER_BATHROOM_M2} m² per kamar mandi.`;
      const en = `A ${size(true)} building on ${floors} floor${floors === 1 ? '' : 's'} has ${fmt(total, true)} m², which for ${f.bathrooms} bathrooms is under ${MIN_FLOOR_AREA_PER_BATHROOM_M2} m² per bathroom.`;
      issues.push({
        code: 'area_per_bathroom',
        question: `${id} Ukuran bangunan dan jumlah kamar mandinya sudah benar?`,
        questionEn: `${en} Are the building size and the number of bathrooms right?`,
        note: id,
        noteEn: en,
      });
    }
  }

  const land = landArea(f);
  if (building !== null && land !== null && land < building) {
    const b = (en: boolean) => sizeText(f.lengthM, f.widthM, building, en);
    const l = (en: boolean) => sizeText(f.landLengthM, f.landWidthM, land, en);
    const id = `Tanah ${l(false)} lebih kecil daripada bangunan ${b(false)}.`;
    const en = `The ${l(true)} plot is smaller than the ${b(true)} building.`;
    issues.push({
      code: 'land_smaller_than_building',
      question: `${id} Ukuran tanah dan bangunannya sudah benar?`,
      questionEn: `${en} Are the plot and building sizes right?`,
      note: id,
      noteEn: en,
    });
  }
  return issues;
}
