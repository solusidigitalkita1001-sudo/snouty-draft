/**
 * Ringkasan bergambar (DD-01 #1): kebutuhan terstruktur dari server → kartu bergambar dan alur air.
 * Memilih gambar dan menyusun keterangan saja; angka semuanya dari `Recommendation.needs`.
 */

import type { BuildingType, SolutionNeed } from '@snouty/shared-types';
import type { SceneIllustration } from '@snouty/ui/illustrations';
import type { SolutionCopy } from './solution-copy';

export interface NeedCard {
  readonly key: string;
  readonly image: SceneIllustration;
  readonly count: number;
  readonly label: string;
  readonly caption: string;
  /** Butir yang perlu diperhatikan (pompa pendorong yang diperlukan). */
  readonly attention: boolean;
}

export interface FlowStep {
  readonly key: string;
  readonly image: SceneIllustration;
  readonly label: string;
  readonly caption: string;
}

const BUILDING_IMAGE: Readonly<Record<BuildingType, SceneIllustration>> = {
  residential: 'house2',
  boarding_house: 'kos',
  light_commercial: 'shophouse',
  industrial: 'factory',
  place_of_worship: 'mosque',
  public_building: 'school',
};

const NEED_IMAGE: Readonly<Record<Exclude<SolutionNeed['kind'], 'building'>, SceneIllustration>> = {
  bathroom: 'shower',
  water_closet: 'wc',
  basin: 'basin',
  kitchen: 'kitchen',
  urinal: 'urinal',
  wudhu_tap: 'mosque',
  rooftop_tank: 'tank',
  ground_tank: 'groundtank',
  municipal: 'meter',
  well_pump: 'well',
  booster_pump: 'pump',
  drainage: 'septic',
};

function buildingImage(need: SolutionNeed): SceneIllustration {
  const building = need.building;
  if (!building) return 'house2';
  // Rumah: gambar mengikuti jumlah lantai (1, 2, 3+).
  if (building.type === 'residential') {
    return building.floors <= 1 ? 'house1' : building.floors === 2 ? 'house2' : 'house3';
  }
  return BUILDING_IMAGE[building.type];
}

function decimal(value: number, locale: string): string {
  return value.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 });
}

function caption(need: SolutionNeed, copy: SolutionCopy['needs'], locale: string): string {
  const perFloor =
    need.perFloor && need.perFloor.length > 1
      ? need.perFloor.map((f) => copy.floorCount(f.floor, f.count)).join(' · ')
      : need.perFloor?.length === 1
        ? copy.onFloor(need.perFloor[0]!.floor)
        : '';
  switch (need.kind) {
    case 'building': {
      const b = need.building;
      if (!b) return '';
      const height = copy.floorHeight(decimal(b.floorHeightM, locale));
      return b.lengthM !== undefined && b.widthM !== undefined
        ? `${copy.buildingSize(decimal(b.lengthM, locale), decimal(b.widthM, locale))}, ${height}`
        : height;
    }
    case 'water_closet':
      return copy.perBathroom;
    case 'rooftop_tank':
      return copy.rooftopTank;
    case 'ground_tank':
      return copy.groundTank;
    case 'municipal':
      return copy.municipal;
    case 'well_pump':
      return copy.wellPump;
    case 'booster_pump':
      return need.residualBar !== undefined
        ? copy.boosterNeeded(decimal(Math.max(need.residualBar, 0), locale))
        : copy.boosterNeededPlain;
    case 'drainage':
      return copy.drainageSizes(need.soilSize ?? '–', need.wasteSize ?? '–');
    default:
      return perFloor;
  }
}

export function needCards(
  needs: readonly SolutionNeed[],
  copy: SolutionCopy['needs'],
  locale: string,
): readonly NeedCard[] {
  return needs.map((need) => ({
    key: need.kind,
    image: need.kind === 'building' ? buildingImage(need) : NEED_IMAGE[need.kind],
    count: need.count,
    label: need.kind === 'building' ? copy.floors : copy.labels[need.kind],
    caption: caption(need, copy, locale),
    attention: need.kind === 'booster_pump',
  }));
}

const SOURCE_KINDS = ['municipal', 'well_pump', 'ground_tank', 'rooftop_tank'] as const;

/**
 * Alur air: sumber → pompa (bila perlu) → bangunan → pembuangan → ventilasi. Hanya butir yang ada
 * di kebutuhan; tidak ada langkah tambahan yang tidak dihitung.
 */
export function flowSteps(
  needs: readonly SolutionNeed[],
  outletCount: number,
  copy: SolutionCopy['needs'],
  locale: string,
): readonly FlowStep[] {
  const cards = new Map(needCards(needs, copy, locale).map((c) => [c.key, c]));
  const steps: FlowStep[] = [];
  for (const kind of SOURCE_KINDS) {
    const card = cards.get(kind);
    if (card)
      steps.push({ key: kind, image: card.image, label: card.label, caption: card.caption });
  }
  const pump = cards.get('booster_pump');
  if (pump)
    steps.push({ key: 'pump', image: pump.image, label: pump.label, caption: copy.boosterFlow });
  const building = cards.get('building');
  if (building && outletCount > 0) {
    steps.push({
      key: 'building',
      image: building.image,
      label: copy.outlets(outletCount),
      caption: building.caption,
    });
  }
  const drainage = cards.get('drainage');
  if (drainage) {
    steps.push({
      key: 'drainage',
      image: drainage.image,
      label: drainage.label,
      caption: drainage.caption,
    });
    steps.push({ key: 'vent', image: 'vent', label: copy.vent, caption: copy.ventCaption });
  }
  return steps;
}

export interface BuildingSummary {
  readonly image: SceneIllustration;
  /** "Rumah tinggal · 2 lantai · 8 × 15 m · 3,5 m per lantai". */
  readonly meta: string;
}

/** Gambar dan satu baris data bangunan untuk kepala ringkasan; `null` tanpa butir bangunan. */
export function buildingSummary(
  needs: readonly SolutionNeed[],
  copy: SolutionCopy['needs'],
  locale: string,
): BuildingSummary | null {
  const need = needs.find((n) => n.kind === 'building');
  const building = need?.building;
  if (!need || !building) return null;
  const parts = [copy.buildingTypes[building.type], copy.floorsCount(building.floors)];
  if (building.lengthM !== undefined && building.widthM !== undefined) {
    parts.push(
      copy.buildingSize(decimal(building.lengthM, locale), decimal(building.widthM, locale)),
    );
  }
  parts.push(copy.floorHeight(decimal(building.floorHeightM, locale)));
  return { image: buildingImage(need), meta: parts.join(' · ') };
}
