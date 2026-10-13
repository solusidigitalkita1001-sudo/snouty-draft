/**
 * "Coba ubah" (DD-01, P17-08): susun baris perbandingan Sekarang ↔ skenario dari angka engine.
 * Hanya menata dan memformat; tidak menghitung apa pun.
 */

import type { ScenarioId, ScenarioMetrics } from '@snouty/shared-types';
import type { SceneIllustration } from '@snouty/ui/illustrations';

export interface ScenarioCopy {
  readonly labels: Readonly<Record<Exclude<ScenarioId, 'tank_raised'>, string>>;
  readonly tankRaised: (meters: string) => string;
  readonly rows: {
    readonly outlets: string;
    readonly main: string;
    readonly branches: string;
    readonly pump: string;
    readonly residual: string;
    readonly tankFill: string;
  };
  readonly pumpNeeded: string;
  readonly pumpNotNeeded: string;
  readonly noTank: string;
}

export const SCENARIO_IMAGE: Readonly<Record<ScenarioId, SceneIllustration>> = {
  tank_raised: 'tankup',
  add_bathroom: 'bathplus',
  municipal: 'meter',
  ground_tank: 'groundtank',
  rooftop_tank: 'tank',
};

export interface ScenarioRow {
  readonly label: string;
  readonly now: string;
  readonly then: string;
  readonly changed: boolean;
}

function decimal(value: number, locale: string): string {
  return value.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 });
}

export function scenarioLabel(
  id: ScenarioId,
  raisedByM: number,
  copy: ScenarioCopy,
  locale: string,
): string {
  return id === 'tank_raised' ? copy.tankRaised(decimal(raisedByM, locale)) : copy.labels[id];
}

function cells(m: ScenarioMetrics, copy: ScenarioCopy, locale: string): readonly string[] {
  return [
    String(m.outletCount),
    `${m.mainSize} · ${decimal(m.velocityMs, locale)} m/s`,
    m.branches.map((b) => `${b.size} ×${b.count}`).join(', '),
    m.boosterPumpNeeded ? copy.pumpNeeded : copy.pumpNotNeeded,
    m.residualBar === null ? '—' : `${decimal(m.residualBar, locale)} bar`,
    m.tankFill === null ? copy.noTank : `${m.tankFill.size}, ${decimal(m.tankFill.netM, locale)} m`,
  ];
}

export function scenarioRows(
  base: ScenarioMetrics,
  scenario: ScenarioMetrics,
  copy: ScenarioCopy,
  locale: string,
): readonly ScenarioRow[] {
  const labels = [
    copy.rows.outlets,
    copy.rows.main,
    copy.rows.branches,
    copy.rows.pump,
    copy.rows.residual,
    copy.rows.tankFill,
  ];
  const now = cells(base, copy, locale);
  const then = cells(scenario, copy, locale);
  return labels.map((label, i) => ({
    label,
    now: now[i]!,
    then: then[i]!,
    changed: now[i] !== then[i],
  }));
}
