/**
 * Menerjemahkan state kebutuhan ke masukan engine rumah (`SolutionInput`). **Fungsi murni.**
 *
 * Nilai yang belum ada dibiarkan `null`: engine memakai asumsi registry-nya sendiri dan
 * mencatatnya — bukan ditebak di sini.
 *
 * Tinggal di `context` karena dua pemanggil membutuhkannya: layar solusi (`recommendation`) dan
 * jalur chat, yang menjawab klaim ukuran dengan angka hitungan yang sama (P32-10). Keduanya
 * memanggil `computeSolution` dengan masukan yang sama, jadi angka di chat dan di layar tidak
 * bisa berbeda.
 */
import type { SolutionInput } from '@snouty/engineering';
import type { RequirementState } from '@snouty/shared-types';

/**
 * Tapak bangunan: panjang × lebar yang disebut, atau luas bangunan saja — total semua lantai
 * ("LB"), jadi tapak = luas ÷ lantai, dianggap persegi (sisi = √tapak). Ukuran tanah terpisah:
 * hanya untuk jarak halaman (ENG-705), tidak pernah menjadi tapak bangunan.
 */
export function planOf(
  d: RequirementState['building']['dimensions']['value'],
  floors: number,
): {
  planLengthM: number | null;
  planWidthM: number | null;
  landLengthM: number | null;
  landWidthM: number | null;
} {
  const land = { landLengthM: d?.landLengthM ?? null, landWidthM: d?.landWidthM ?? null };
  if (d?.lengthM !== undefined && d.widthM !== undefined) {
    return { planLengthM: d.lengthM, planWidthM: d.widthM, ...land };
  }
  if (d?.areaM2 !== undefined && d.areaM2 > 0) {
    const side = Math.round(Math.sqrt(d.areaM2 / Math.max(1, floors)) * 10) / 10;
    return { planLengthM: side, planWidthM: side, ...land };
  }
  return { planLengthM: null, planWidthM: null, ...land };
}

export function solutionInputFrom(state: RequirementState): SolutionInput {
  return {
    buildingType: (state.building.type.value ?? 'residential') as SolutionInput['buildingType'],
    floors: state.building.floors.value ?? 1,
    bathrooms: state.fixtures.bathrooms.value ?? 0,
    basins: state.fixtures.basins.value,
    kitchens: state.fixtures.kitchens.value,
    // Tempat ibadah (Kelompok L): keran wudhu, tempat wudhu, urinoir — field lama boleh tidak ada.
    wudhuTaps: state.fixtures.wudhuTaps?.value ?? null,
    wudhuAreas: state.fixtures.wudhuAreas?.value ?? null,
    urinals: state.fixtures.urinals?.value ?? null,
    // Keran tambahan di luar kamar mandi dan dapur (P33-04).
    outdoorTaps: state.fixtures.outdoorTaps?.value ?? null,
    upperFloorTaps: state.fixtures.upperFloorTaps?.value ?? null,
    waterSource: (state.water.source.value ?? 'rooftop_tank') as SolutionInput['waterSource'],
    installationType: (state.water.installationType.value ??
      'clean_water') as SolutionInput['installationType'],
    floorHeightM: state.building.floorHeightM.value,
    mainRunMeters: state.building.dimensions.value?.mainRunMeters ?? null,
    // Sumur: kosong → engine memakai asumsi WELL_WATER_DEPTH_6M (tampil di tabel asumsi).
    wellDepthM: state.water.wellDepthM?.value ?? null,
    ...planOf(state.building.dimensions.value, state.building.floors.value ?? 1),
  };
}
