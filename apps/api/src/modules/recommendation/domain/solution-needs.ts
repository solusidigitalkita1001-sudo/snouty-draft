/**
 * Kebutuhan bergambar di Ringkasan (DD-01 #1) dari masukan dan hasil engine bangunan.
 *
 * Isinya fakta hitungan (jumlah alat per lantai, sumber air, perlu pompa atau tidak, ukuran
 * pembuangan), bukan kalimat: tampilan web dan laporan memilih gambar dan kata-katanya sendiri.
 */

import type { HouseDrainageResult, SolutionInput, SolutionResult } from '@snouty/engineering';
import type { BuildingType, NeedKind, SolutionNeed } from '@snouty/shared-types';

const SOURCE_NEED: Readonly<Record<SolutionInput['waterSource'], NeedKind>> = {
  rooftop_tank: 'rooftop_tank',
  ground_tank: 'ground_tank',
  municipal: 'municipal',
  pump: 'well_pump',
};

export function needsFrom(
  input: SolutionInput,
  solution: SolutionResult,
  drainage: HouseDrainageResult | null,
): readonly SolutionNeed[] {
  const plan = solution.floorsPlan;
  const perFloor = (pick: (floor: (typeof plan)[number]) => number) =>
    plan.map((f) => ({ floor: f.floor, count: pick(f) })).filter((f) => f.count > 0);
  const total = (pick: (floor: (typeof plan)[number]) => number) =>
    plan.reduce((sum, f) => sum + pick(f), 0);

  const needs: SolutionNeed[] = [
    {
      kind: 'building',
      count: input.floors,
      building: {
        type: input.buildingType as BuildingType,
        floors: input.floors,
        floorHeightM: solution.floorHeightM,
        ...(input.planLengthM && input.planWidthM
          ? { lengthM: input.planLengthM, widthM: input.planWidthM }
          : {}),
        ...(input.installationType !== 'drainage'
          ? {
              mainSize: solution.mainSize,
              // Cabang per lantai dari ENG-707: ukuran tiap cabang dan alat yang dilayaninya.
              branches: solution.branchGroups
                .flatMap((group) =>
                  group.branches.map((b) => ({
                    floor: b.floor,
                    size: group.size,
                    bathrooms: b.bathrooms,
                    basins: b.basins,
                    kitchens: b.kitchens,
                    urinals: b.urinals ?? 0,
                  })),
                )
                .sort((a, b) => b.floor - a.floor),
            }
          : {}),
      },
    },
  ];
  const fixture = (kind: NeedKind, pick: (floor: (typeof plan)[number]) => number) => {
    const count = total(pick);
    if (count > 0) needs.push({ kind, count, perFloor: perFloor(pick) });
  };
  fixture('bathroom', (f) => f.bathrooms);
  // Setiap kamar mandi berisi kloset (ENG-012; toilet umum: kloset + keran).
  fixture('water_closet', (f) => f.bathrooms);
  fixture('basin', (f) => f.basins);
  fixture('kitchen', (f) => f.kitchens);
  if ((input.urinals ?? 0) > 0) needs.push({ kind: 'urinal', count: input.urinals! });
  if (solution.wudhu !== null && solution.wudhu.taps > 0) {
    needs.push({ kind: 'wudhu_tap', count: solution.wudhu.taps });
  }

  if (input.installationType !== 'drainage') {
    // Pompa sumur / toren bawah adalah bagian sumbernya; pompa pendorong hanya untuk toren atap
    // yang tekanannya kurang (review putaran 3, 1a — dulu sumber pompa tampil dengan pompa kedua).
    const well = solution.supply.well;
    needs.push({
      kind: SOURCE_NEED[input.waterSource],
      count: 1,
      ...(well !== null
        ? {
            wellDepthM: well.depthM,
            wellDepthAssumed: solution.appliedAssumptionIds.includes('WELL_WATER_DEPTH_6M'),
            deepWell: well.beyondSuction,
          }
        : {}),
    });
    // Pompa transfer tandon bawah → toren atap (temuan 9): dua angkanya ikut, bukan hanya namanya.
    if (solution.transferPump !== null) {
      needs.push({
        kind: 'transfer_pump',
        count: 1,
        pumpFlowLpm: solution.transferPump.flowLpm,
        pumpHeadM: solution.transferPump.headM,
      });
    }
    if (solution.boosterPumpNeeded) {
      const residual = solution.supply.gravityResidualBar;
      const remedy = solution.supply.gravityRemedy;
      needs.push({
        kind: 'booster_pump',
        count: 1,
        ...(residual !== null ? { residualBar: residual } : {}),
        ...(remedy !== null ? { minimumStandM: remedy.minimumStandM } : {}),
      });
    }
  }
  if (drainage !== null && (drainage.soil || drainage.waste)) {
    needs.push({
      kind: 'drainage',
      count: 1,
      // Ke mana air bekasnya pergi (temuan 10): sumur resapan tidak lagi disebut bersamaan dengan
      // saluran seolah keduanya sama.
      ...(drainage.greyWater !== null
        ? {
            greyWaterDestination: drainage.greyWater.destination,
            greyWaterAssumed: drainage.greyWater.assumed,
          }
        : {}),
      ...(drainage.soil
        ? { soilSize: drainage.soil.size, soilVentSize: drainage.soil.ventSize }
        : {}),
      ...(drainage.waste
        ? { wasteSize: drainage.waste.size, wasteVentSize: drainage.waste.ventSize }
        : {}),
    });
  }
  // Grease trap dapur (temuan 10): jumlahnya dari jumlah dapur, ukurannya menunggu Pralon (OQ-101).
  if (drainage !== null && (drainage.greyWater?.greaseTraps ?? 0) > 0) {
    needs.push({ kind: 'grease_trap', count: drainage.greyWater!.greaseTraps });
  }
  return needs;
}
