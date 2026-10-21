import { describe, expect, it } from 'vitest';
import { FINE_INTENTS } from '../../understanding/domain/labels.js';
import { assessProspect, projectScaleOf, stageOf, type ProspectEvent } from './prospect-stage.js';

const NOW = new Date('2026-10-21T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const intent = (label: string, at = NOW): ProspectEvent => ({ kind: 'intent', label, at });

describe('tahap 5A dari kejadian (P26-03, docs/PROSPECT_5A.md §2)', () => {
  it('label pemahaman dipetakan ke tahap; basa-basi dan lanjutan tidak menggeser tahap', () => {
    expect(stageOf(intent('company_question'))).toBe('aware');
    expect(stageOf(intent('product_comparison'))).toBe('appeal');
    expect(stageOf(intent('competitor_question'))).toBe('appeal');
    expect(stageOf(intent('price_question'))).toBe('ask');
    expect(stageOf(intent('requirement_building'))).toBe('ask');
    expect(stageOf(intent('thanks'))).toBeNull();
    expect(stageOf(intent('follow_up_more'))).toBeNull();
    expect(stageOf(intent('label_yang_tidak_ada'))).toBeNull();
  });

  it('setiap label pemahaman punya keputusan tahap (bukan undefined)', () => {
    for (const label of FINE_INTENTS) expect(stageOf(intent(label))).not.toBeUndefined();
  });

  it('tahap = yang tertinggi pernah dicapai, dengan waktu pertama kali dicapai', () => {
    const view = assessProspect(
      [
        { kind: 'account_created', at: daysAgo(10) },
        intent('product_spec', daysAgo(9)),
        { kind: 'analysis', at: daysAgo(5) },
        { kind: 'report_download', at: daysAgo(3) },
        intent('thanks', daysAgo(1)),
      ],
      ['house'],
      NOW,
    );
    expect(view).toMatchObject({
      stage: 'act',
      stageReachedAt: daysAgo(3),
      lastActivityAt: daysAgo(1),
    });
  });

  it('Advocate ditampilkan sebagai tahap, tetapi prioritas memakai bobot Act yang lebih besar', () => {
    const view = assessProspect(
      [
        { kind: 'report_created', at: NOW },
        { kind: 'share_created', at: NOW },
      ],
      ['building'],
      NOW,
    );
    expect(view?.stage).toBe('advocate');
    expect(view?.score).toBe(12); // Act 6 × gedung 2
    expect(view?.priority).toBe('hot');
  });

  it('tanpa kejadian bukan prospek', () => {
    expect(assessProspect([], ['district'], NOW)).toBeNull();
  });
});

describe('prioritas: tahap × skala × kebaruan (§3)', () => {
  const ask = [{ kind: 'analysis', at: NOW }] as const satisfies readonly ProspectEvent[];

  it('perumahan di tahap Ask lebih panas daripada rumah di tahap Act', () => {
    const district = assessProspect(ask, ['district'], NOW)!;
    const house = assessProspect([{ kind: 'sales_request', at: NOW }], ['house'], NOW)!;
    expect(district).toMatchObject({ score: 16, priority: 'hot' });
    expect(house).toMatchObject({ score: 6, priority: 'warm' });
  });

  it('skala terbesar di antara proyek pengguna yang dipakai', () => {
    expect(assessProspect(ask, ['house', 'district', 'building'], NOW)?.scale).toBe('district');
    expect(assessProspect(ask, [], NOW)?.scale).toBe('house');
  });

  it('diam dua minggu = separuh nilai; panas bisa turun jadi hangat lalu dingin', () => {
    const at = (days: number) =>
      assessProspect([{ kind: 'analysis', at: daysAgo(days) }], ['district'], NOW)!;
    expect(at(0).priority).toBe('hot');
    expect(at(14)).toMatchObject({ score: 8, priority: 'warm' });
    expect(at(42)).toMatchObject({ score: 2, priority: 'cold' });
  });

  it('hanya bertanya soal perusahaan = dingin', () => {
    expect(assessProspect([intent('company_question')], ['house'], NOW)?.priority).toBe('cold');
  });
});

describe('skala proyek (§3)', () => {
  it('kasus kawasan, gedung, dan rumah', () => {
    expect(projectScaleOf({ useCase: 'sewerage' })).toBe('district');
    expect(projectScaleOf({ useCase: 'residential_cluster' })).toBe('district');
    expect(projectScaleOf({ useCase: 'multistorey_building_water' })).toBe('building');
    expect(projectScaleOf({ buildingType: 'light_commercial' })).toBe('building');
    expect(projectScaleOf({ buildingType: 'residential' })).toBe('house');
  });

  it('tidak diketahui = rumah: prospek tidak pernah tampak lebih besar dari yang dikatakan', () => {
    expect(projectScaleOf({})).toBe('house');
    expect(projectScaleOf({ useCase: 'kasus_baru', buildingType: null })).toBe('house');
  });
});
