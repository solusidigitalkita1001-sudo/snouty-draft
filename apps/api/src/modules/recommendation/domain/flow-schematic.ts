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
  type NetworkInput,
  pondSchematic,
  pressurizedSchematic,
  type FlowSchematicShape,
} from '@snouty/engineering';
import type { Locale, RequirementState } from '@snouty/shared-types';
import { overridesOf } from './assumption-overrides.js';
import { NO_SIGNATURES, withSignedOverall, type SignedStatusLookup } from './signed-rules.js';
import { buildingWaterInputFrom } from './building-water-view.js';
import { gravityPlanFrom, networkInputFrom } from './gravity-view.js';
import { irrigationInputFrom } from './irrigation-input.js';
import { pondInputFrom } from './pond-view.js';
import { pressurizedPlanFrom } from './pressurized-view.js';

/** Keluarga pipa jaringan cluster — aturan yang sama dengan `runNetwork`. */
export function networkFamilyFor(routeLengthM: number): 'HDPE' | 'PVC AW' {
  return routeLengthM >= HDPE_FROM_METERS ? 'HDPE' : 'PVC AW';
}

/**
 * Keluarga pipa jaringan: bahan pilihan pengguna menang; tanpa pilihan, aturan panjang jalur
 * (HDPE_MAIN_FROM_200M). Bahan yang tidak ada di katalog sebagai keluarga (PPR, galvanis) jatuh ke
 * aturan panjang — dan itu disebut di asumsi, bukan diam-diam.
 */
export function networkFamilyOf(network: NetworkInput): 'HDPE' | 'PVC AW' {
  if (network.material === 'HDPE') return 'HDPE';
  if (network.material === 'PVC') return 'PVC AW';
  return networkFamilyFor(network.routeLengthM);
}

/**
 * `null` = state ini bukan kasus teknis/irigasi yang bisa dihitung (pakai skema bangunan).
 *
 * `signedStatus` membawa tanda tangan ahli masuk ke gambar (P31-87). Engine selalu memberi
 * status yang tertulis di kodenya sendiri, dan gambar yang mewarisi status itu akan berbunyi
 * asumsi selamanya — juga setelah setiap aturan di belakangnya ditandatangani.
 */
export function flowSchematicFor(
  state: RequirementState,
  catalogVersionLabel: string,
  locale: Locale,
  signedStatus: SignedStatusLookup = NO_SIGNATURES,
): FlowSchematicShape | null {
  if (state.useCase?.kind === 'irrigation') {
    const { input } = irrigationInputFrom(state);
    return irrigationSchematic(
      input,
      withSignedOverall(computeIrrigation(input, locale), signedStatus),
      catalogVersionLabel,
      locale,
    );
  }
  if (state.useCase?.kind !== 'technical') return null;

  const pond = pondInputFrom(state);
  if (pond !== null) {
    return pondSchematic(
      pond,
      withSignedOverall(computePond(pond, locale, overridesOf(state)), signedStatus),
      catalogVersionLabel,
      locale,
    );
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
      withSignedOverall(computePressurized(plan.input, locale, overridesOf(state)), signedStatus),
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
      withSignedOverall(computeGravity(gravity.input, locale, overridesOf(state)), signedStatus),
      catalogVersionLabel,
      locale,
    );
  }
  const network = networkInputFrom(state);
  if (network !== null) {
    const family = networkFamilyOf(network);
    const result = computeNetwork(
      { ...network, material: family === 'HDPE' ? 'HDPE' : 'PVC' },
      locale,
      overridesOf(state),
    );
    return networkSchematic(
      { routeLengthM: network.routeLengthM, family },
      withSignedOverall(result, signedStatus),
      catalogVersionLabel,
      locale,
    );
  }
  const building = buildingWaterInputFrom(state);
  if (building !== null) {
    return buildingWaterSchematic(
      { floors: building.floors },
      withSignedOverall(computeBuildingWater(building, locale, overridesOf(state)), signedStatus),
      catalogVersionLabel,
      locale,
    );
  }
  return null;
}
