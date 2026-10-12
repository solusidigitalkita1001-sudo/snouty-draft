/**
 * TC-H-02 / TC-G-01 (tes live 12 Okt 2026): tinggi lantai dari kalimat terbaca, nilai di luar
 * 2–10 m ditanyakan balik dan tidak dihitung, nilai dalam rentang dipakai sebagai data pengguna.
 */
import { CaseInputInvalidError } from '@snouty/engineering';
import { DEFAULT_LOCALE, type Recommendation, type RequirementState } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { AnalysisService } from '../../recommendation/application/analysis.service.js';
import type { TraceToSave } from '../../recommendation/domain/recommendation.repository.js';
import { answerToUpdate } from '../domain/clarification.js';
import { mergeRequirement } from '../domain/context-merger.js';
import { withCompleteness } from '../domain/completeness.js';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import { extractionToUpdates } from './extraction-to-updates.js';
import { followUpCard } from './message-pipeline.js';

const T0 = '2026-10-12T07:20:00.000Z';
const stateOf = (message: string): RequirementState =>
  withCompleteness(
    mergeRequirement(emptyRequirementState(T0), extractionToUpdates({}, message), T0).state,
  );

async function analyse(state: RequirementState) {
  let saved: { rec: Recommendation; traces: readonly TraceToSave[] } | null = null;
  const service = new AnalysisService(
    { findVersionById: async () => null } as never,
    {
      save: async (rec: Recommendation, traces: readonly TraceToSave[]) => {
        saved = { rec, traces };
      },
    } as never,
    { markSolutionReady: async () => undefined } as never,
    null,
    {
      activeVersion: async () =>
        ({ id: 'V'.repeat(26), label: 'x', kind: 'pralon', status: 'active' }) as never,
      listProducts: async () => ({ items: [], nextCursor: null }),
      candidatesFor: async () => [],
    },
  );
  await service.run('C'.repeat(26), 'S'.repeat(26), state, [], T0, undefined, DEFAULT_LOCALE);
  return saved!;
}

describe('TC-H-02 · tinggi lantai dari kalimat', () => {
  it('TC-H-02a / TC-G-01: 11 m terbaca, ditanya balik dengan isian angka, tidak ada tombol susun, analisis ditolak', async () => {
    const state = stateOf(
      'Rumah 2 lantai, tinggi tiap lantai 11 m, 2 kamar mandi, PDAM, air bersih',
    );
    expect(state.building.floorHeightM.value).toBe(11);
    expect(state.missingInformation).toEqual(['building.floorHeightM']);
    const card = followUpCard(state, DEFAULT_LOCALE);
    expect(card?.kind).toBe('clarification');
    const question = card?.kind === 'clarification' ? card.questions[0]! : null;
    expect(question).toMatchObject({ id: 'building.floorHeightM', options: [] });
    expect(question!.inputs![0]).toMatchObject({ min: 2, max: 10, unit: 'm' });
    // Tidak pernah dihitung dengan 3,5 m.
    await expect(analyse(state)).rejects.toBeInstanceOf(CaseInputInvalidError);
  });

  it('jawaban kartu: 4 m diterima, 11 m ditolak (bukan tebakan)', () => {
    const answer = (option: string) =>
      answerToUpdate({ id: 'building.floorHeightM', option }, () => null);
    expect(answer('value=4')).toEqual({
      path: 'building.floorHeightM',
      value: 4,
      source: 'user_stated',
    });
    expect(answer('value=11')).toBeNull();
  });

  it('TC-H-02b: 4 m dipakai sebagai data pengguna; beda tinggi PDAM = 4 + 2 = 6 m; tanpa asumsi 3,5 m', async () => {
    const state = stateOf(
      'Rumah 2 lantai, tinggi tiap lantai 4 m, 2 kamar mandi, PDAM, air bersih',
    );
    expect(state.building.floorHeightM).toMatchObject({ value: 4, source: 'user_stated' });
    expect(state.missingInformation).toEqual([]);
    const { rec, traces } = await analyse(state);
    expect(traces.some((t) => t.ruleId === 'ENG-004')).toBe(false);
    const route = traces.find((t) => t.ruleId === 'ENG-702')!;
    expect((route.output as { staticHeadM: number }).staticHeadM).toBe(6);
    expect(rec.assumptions.map((a) => a.text).join(' ')).not.toContain('3.5');
    expect(rec.assumptions.map((a) => a.text).join(' ')).not.toContain('3,5');
  });

  it('TC-H-02c: "floor height 3.8 m" terbaca', () => {
    expect(
      stateOf('2 storey house, floor height 3.8 m, 2 bathrooms, municipal water, clean water')
        .building.floorHeightM.value,
    ).toBe(3.8);
    expect(stateOf('rumah 2 lantai, tinggi lantai 3,8 meter').building.floorHeightM.value).toBe(
      3.8,
    );
  });

  it('angka lain tanpa "tinggi … lantai" tidak dibaca sebagai tinggi lantai', () => {
    expect(
      stateOf('rumah 2 lantai, jalur 11 m, 2 kamar mandi').building.floorHeightM.value,
    ).toBeNull();
  });
});

describe('Sekolah / klinik (pemilik 2026-10-12: hitungan toilet umum)', () => {
  it('sekolah dan klinik dikenali, dihitung sebagai toilet umum tanpa wudhu', async () => {
    for (const word of ['Sekolah', 'Klinik']) {
      const state = stateOf(
        `${word} 2 lantai, 6 kamar mandi, 4 urinoir, 4 wastafel, PDAM, air bersih dan pembuangan`,
      );
      expect(state.building.type.value).toBe('public_building');
      expect(state.fixtures.urinals?.value).toBe(4);
      const { rec, traces } = await analyse(state);
      expect(traces.some((t) => t.ruleId === 'ENG-801')).toBe(true);
      expect(rec.systemLines.some((l) => l.name.includes('wudhu'))).toBe(false);
    }
    const { houseRefinementQuestions } = await import('../domain/clarification.js');
    expect(
      houseRefinementQuestions(() => false, DEFAULT_LOCALE, 'public_building').map((q) => q.id),
    ).toEqual(['building.dimensions', 'fixtures.urinals', 'fixtures.basins']);
  });

  it('tebakan model kelas lama (sekolah → komersial ringan) kalah dari jenis yang tersurat', () => {
    const updates = extractionToUpdates(
      { building: { type: 'light_commercial' } },
      'sekolah 2 lantai',
    );
    expect(updates.find((u) => u.path === 'building.type')?.value).toBe('public_building');
  });

  it('kantor dan ruko tetap komersial ringan', () => {
    expect(stateOf('kantor 2 lantai').building.type.value).toBe('light_commercial');
  });
});

describe('Tempat ibadah (pemilik 2026-10-12: "masih nganggep kran itu wastafel, pdhl masjid")', () => {
  const MASJID =
    'Masjid 2 lantai, 4 kamar mandi, 8 keran wudhu di 2 tempat wudhu, 3 urinoir, PDAM, air bersih dan pembuangan';

  it('masjid = tempat ibadah; keran wudhu, tempat wudhu, urinoir tercatat sendiri, bukan wastafel', () => {
    const state = stateOf(MASJID);
    expect(state.building.type.value).toBe('place_of_worship');
    expect(state.fixtures.wudhuTaps?.value).toBe(8);
    expect(state.fixtures.wudhuAreas?.value).toBe(2);
    expect(state.fixtures.urinals?.value).toBe(3);
    expect(state.fixtures.basins.value).toBeNull();
    expect(state.missingInformation).toEqual([]);
  });

  it('pertanyaan penyempurna tempat ibadah: wudhu dan urinoir, bukan dapur', async () => {
    const { houseRefinementQuestions } = await import('../domain/clarification.js');
    const asked = houseRefinementQuestions(() => false, DEFAULT_LOCALE, 'place_of_worship').map(
      (q) => q.id,
    );
    expect(asked).toEqual([
      'building.dimensions',
      'fixtures.wudhuTaps',
      'fixtures.wudhuAreas',
      'fixtures.urinals',
      'fixtures.basins',
    ]);
    const house = houseRefinementQuestions(() => false).map((q) => q.id);
    expect(house).not.toContain('fixtures.wudhuTaps');
  });

  it('hitungan: wudhu serentak, kamar mandi kloset + keran, deret wudhu dan talang di tabel sistem', async () => {
    const { rec, traces } = await analyse(stateOf(MASJID));
    const demand = traces.find((t) => t.ruleId === 'ENG-801')!;
    expect(demand.explanation).toContain('8 × 0.1 l/s = 0.8 l/s');
    expect(demand.explanation).toContain('3 urinoir');
    expect(traces.some((t) => t.ruleId === 'ENG-701')).toBe(false);
    expect(traces.find((t) => t.ruleId === 'ENG-001')!.explanation).toContain('kloset dan keran');
    const names = rec.systemLines.map((l) => l.name);
    expect(names).toContain('Pipa deret wudhu');
    expect(names).toContain('Talang wudhu PVC D');
    const soil = rec.systemLines.find((l) => l.name.startsWith('Pipa air kotor'))!;
    expect(soil.path).toBe('Kloset dan urinoir → septic tank');
    expect(rec.body).toContain('kloset dan urinoir dibuang ke septic tank');
    expect(rec.body).toContain('tiap deret wudhu punya satu talang 3"');
    expect(rec.body).not.toContain('urinoir dan floor drain');
    expect(demand.explanation).toContain('4 keran × 1.5');
    expect(rec.assumptions.some((a) => a.assumptionId === 'WUDHU_TAP_FLOW_0_1LS')).toBe(true);
    expect(rec.assumptions.some((a) => a.assumptionId === 'HOUSE_KITCHEN_1')).toBe(false);
  });

  it('skema: deret wudhu dan urinoir di lantai dasar, bukan wastafel', async () => {
    const { schematicFor } = await import('../../recommendation/application/analysis.service.js');
    const schematic = schematicFor(stateOf(MASJID), 'x', T0);
    const ground = schematic.nodes.filter((n) => n.type === 'fixture' && n.floorLevel === 1);
    expect(ground.map((n) => n.label)).toEqual(
      expect.arrayContaining(['Urinoir ×3', 'Wudhu 4 keran']),
    );
    expect(ground.filter((n) => n.code?.startsWith('WD-'))).toHaveLength(2);
    expect(schematic.nodes.some((n) => n.code?.startsWith('WF-'))).toBe(false);
  });

  it('TC-H-04: kartu wastafel bisa diisi 8 (isian angka di samping pilihan 0–3)', async () => {
    const { houseRefinementQuestions } = await import('../domain/clarification.js');
    const basins = houseRefinementQuestions((path) => path !== 'fixtures.basins').find(
      (q) => q.id === 'fixtures.basins',
    )!;
    expect(basins.options).toEqual(['0', '1', '2', '3']);
    expect(basins.inputs![0]).toMatchObject({ key: 'value', group: 'Lebih dari 3', min: 0 });
    const answer = (option: string) =>
      answerToUpdate({ id: 'fixtures.basins', option }, () => null);
    expect(answer('value=8')).toEqual({ path: 'fixtures.basins', value: 8, source: 'user_stated' });
    expect(answer('2')).toEqual({ path: 'fixtures.basins', value: 2, source: 'user_stated' });
  });

  it('jarak keran 0,8 m bisa diubah setelah hitungan: panjang deret dan talang ikut, nilai di luar batas ditolak', async () => {
    const { overrideAssumption } =
      await import('../../recommendation/application/analysis.service.js');
    const before = await analyse(stateOf(MASJID));
    const spacing = before.rec.assumptions.find(
      (a) => a.assumptionId === 'WUDHU_TAP_SPACING_0_8M',
    )!;
    expect(spacing).toMatchObject({ value: 0.8, unit: 'm' });

    const next = overrideAssumption(stateOf(MASJID), 'WUDHU_TAP_SPACING_0_8M', 1, DEFAULT_LOCALE);
    expect(next.assumptionOverrides).toEqual({ WUDHU_TAP_SPACING_0_8M: 1 });
    const { rec, traces } = await analyse(next);
    // 2 deret × 4 keran × 1 m = 8 m talang 3", bukan 6,4 m.
    const trough = rec.bom.find((b) => b.basis.includes('talang wudhu'))!;
    expect(trough.basis).toContain('8 m');
    expect(traces.find((t) => t.ruleId === 'ENG-802')!.explanation).toContain('jarak 1 m');
    const rows = rec.assumptions.filter((a) => a.assumptionId === 'WUDHU_TAP_SPACING_0_8M');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ value: 1, userSet: true });

    expect(() =>
      overrideAssumption(stateOf(MASJID), 'WUDHU_TAP_SPACING_0_8M', 20, DEFAULT_LOCALE),
    ).toThrow();
  });
});
