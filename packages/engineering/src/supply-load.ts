/**
 * Beban alat suplai (WSFU) dari kebutuhan yang sudah tercatat — angka yang sama yang dihitung
 * ENG-701 (rumah) dan ENG-801 (toilet umum), tanpa menjalankan seluruh solusi. Dipakai untuk
 * mengetahui SEBELUM menghitung apakah bebannya masih tercakup kurva Hunter: di atas itu debit
 * puncaknya tidak ada di tabel, jadi kasusnya diteruskan ke tim teknis — bukan dihitung dengan
 * angka karangan, dan bukan gagal tanpa penjelasan (produksi 2026-10-27).
 *
 * Murni.
 */

import { assumptionReader, type AssumptionOverrides } from './parameters/assumptions.js';
import { houseSupplyWsfu } from './rules/group-k-house-supply.js';
import { publicSupplyWsfu } from './rules/group-l-worship.js';
import { round1 } from './units.js';

export interface SupplyLoadInput {
  readonly buildingType: string | null;
  readonly bathrooms: number | null;
  readonly basins?: number | null;
  readonly kitchens?: number | null;
  readonly urinals?: number | null;
}

export function supplyLoadWsfu(
  input: SupplyLoadInput,
  overrides: AssumptionOverrides = {},
): number {
  const { use } = assumptionReader(overrides);
  const bathrooms = Math.max(0, input.bathrooms ?? 0);
  // Toilet umum: sekolah, klinik, dan tempat ibadah memakai kolom pemakaian umum (ENG-801).
  const publicRestroom =
    input.buildingType === 'public_building' || input.buildingType === 'place_of_worship';
  const basins =
    input.basins ??
    (publicRestroom ? use('HOUSE_BASINS_0') : bathrooms * use('HOUSE_BASINS_PER_BATHROOM_1'));
  const kitchens =
    input.kitchens ?? (publicRestroom ? use('WORSHIP_KITCHEN_0') : use('HOUSE_KITCHEN_1'));
  const urinals = publicRestroom ? Math.max(0, input.urinals ?? 0) : 0;
  if (publicRestroom) {
    return round1(
      publicSupplyWsfu({
        waterClosets: bathrooms,
        // Kamar mandi toilet umum = kloset + keran (ENG-801).
        bathroomTaps: bathrooms,
        lavatories: basins,
        kitchenSinks: kitchens,
        urinals,
        wudhuTaps: 0,
        wsfuWaterCloset: use('WSFU_PUBLIC_WATER_CLOSET_5'),
        wsfuTap: use('WSFU_PUBLIC_TAP_1_5'),
        wsfuUrinal: urinals > 0 ? use('WSFU_PUBLIC_URINAL_3') : 0,
        wsfuKitchenSink: kitchens > 0 ? use('WSFU_KITCHEN_SINK_1') : 1,
        wudhuTapFlowLs: 0.1,
      }),
    );
  }
  return round1(
    houseSupplyWsfu({
      waterClosets: bathrooms,
      showers: bathrooms,
      lavatories: basins,
      kitchenSinks: kitchens,
      wsfuWaterCloset: use('WSFU_WATER_CLOSET_2_2'),
      wsfuShower: use('WSFU_SHOWER_1'),
      wsfuLavatory: use('WSFU_LAVATORY_0_5'),
      wsfuKitchenSink: use('WSFU_KITCHEN_SINK_1'),
    }),
  );
}
