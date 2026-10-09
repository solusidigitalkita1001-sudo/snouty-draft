/**
 * Skema aliran kasus teknis dan irigasi, dibentuk ulang dari snapshot kebutuhan (SCHEMATIC_ENGINE
 * §10: skema tidak disimpan). Memakai pemeta masukan yang sama dengan `AnalysisService`, jadi skema
 * dan solusi selalu berasal dari hitungan yang sama. **Fungsi murni.**
 */
import {
  HDPE_FROM_METERS,
  buildingWaterSchematic,
  computeBuildingWater,
  computeGravity,
  computeIrrigation,
  computeNetwork,
  computePond,
  computePressurized,
  gravitySchematic,
  irrigationSchematic,
  networkSchematic,
  pondSchematic,
  pressurizedSchematic,
  type FlowSchematicShape,
} from '@snouty/engineering';
import type { Locale, RequirementState } from '@snouty/shared-types';
import { buildingWaterInputFrom } from './building-water-view.js';
import { gravityPlanFrom, networkInputFrom } from './gravity-view.js';
import { irrigationInputFrom } from './irrigation-input.js';
import { pondInputFrom } from './pond-view.js';
import { pressurizedPlanFrom } from './pressurized-view.js';

/** Keluarga pipa jaringan cluster — aturan yang sama dengan `runNetwork`. */
export function networkFamilyFor(routeLengthM: number): 'HDPE' | 'PVC AW' {
  return routeLengthM >= HDPE_FROM_METERS ? 'HDPE' : 'PVC AW';
}

/** `null` = state ini bukan kasus teknis/irigasi yang bisa dihitung (pakai skema bangunan). */
export function flowSchematicFor(
  state: RequirementState,
  catalogVersionLabel: string,
  locale: Locale,
): FlowSchematicShape | null {
  if (state.useCase?.kind === 'irrigation') {
    const { input } = irrigationInputFrom(state);
    return irrigationSchematic(
      input,
      computeIrrigation(input, locale),
      catalogVersionLabel,
      locale,
    );
  }
  if (state.useCase?.kind !== 'technical') return null;

  const pond = pondInputFrom(state);
  if (pond !== null) {
    return pondSchematic(pond, computePond(pond, locale), catalogVersionLabel, locale);
  }
  const plan = pressurizedPlanFrom(state);
  if (plan !== null) {
    return pressurizedSchematic(
      {
        kind: state.useCase.caseId === 'well_distribution' ? 'well_distribution' : 'pump_transfer',
        designFlowLs: plan.input.designFlowLs,
        routeLengthM: plan.input.routeLengthM,
        staticHeadM: plan.input.staticHeadM,
        family: plan.family,
      },
      computePressurized(plan.input, locale),
      catalogVersionLabel,
      locale,
    );
  }
  const gravity = gravityPlanFrom(state);
  if (gravity !== null) {
    return gravitySchematic(
      {
        pipeLengthM: gravity.pipeLengthM,
        ...(gravity.input.catchmentHa !== undefined
          ? { catchmentHa: gravity.input.catchmentHa }
          : {}),
      },
      computeGravity(gravity.input, locale),
      catalogVersionLabel,
      locale,
    );
  }
  const network = networkInputFrom(state);
  if (network !== null) {
    const family = networkFamilyFor(network.routeLengthM);
    const result = computeNetwork(
      family === 'HDPE' ? { ...network, material: 'HDPE' } : network,
      locale,
    );
    return networkSchematic(
      { routeLengthM: network.routeLengthM, family },
      result,
      catalogVersionLabel,
      locale,
    );
  }
  const building = buildingWaterInputFrom(state);
  if (building !== null) {
    return buildingWaterSchematic(
      { floors: building.floors },
      computeBuildingWater(building, locale),
      catalogVersionLabel,
      locale,
    );
  }
  return null;
}
