/**
 * P31-83 — tanda tangan ahli menembus sampai ke angka yang dibaca pengguna.
 *
 * Jalurnya sama dengan pembuatan laporan: `AnalysisService.run` → jejak hitung → baris sistem dan
 * BOQ. Yang dipaku di sini: tanpa tanda tangan semuanya asumsi, dan setelah aturannya
 * ditandatangani baris yang memakai aturan itu ikut naik — bukan hanya jejaknya.
 */
import { DEFAULT_LOCALE, type Recommendation, type RequirementState } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { mergeRequirement } from '../../context/domain/context-merger.js';
import { withCompleteness } from '../../context/domain/completeness.js';
import { emptyRequirementState } from '../../context/domain/requirement-state.factory.js';
import type { TraceToSave } from '../domain/recommendation.repository.js';
import type { SignedDecisionRow } from '../domain/signed-rules.js';
import { AnalysisService } from './analysis.service.js';

const T0 = '2026-10-28T02:00:00.000Z';

const STATE: RequirementState = withCompleteness(
  mergeRequirement(
    emptyRequirementState(T0),
    [
      { path: 'building.type', value: 'residential', source: 'user_stated' },
      { path: 'building.floors', value: 2, source: 'user_stated' },
      { path: 'fixtures.bathrooms', value: 2, source: 'user_stated' },
      { path: 'water.source', value: 'municipal', source: 'user_stated' },
      { path: 'water.installationType', value: 'clean_water', source: 'user_stated' },
    ],
    T0,
  ).state,
);

async function analyse(
  decisions: readonly SignedDecisionRow[],
  state: RequirementState = STATE,
): Promise<{ rec: Recommendation; traces: readonly TraceToSave[] }> {
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
        ({ id: 'V'.repeat(26), label: 'erp-uji', kind: 'pralon', status: 'active' }) as never,
      listProducts: async () => ({ items: [], nextCursor: null }),
      candidatesFor: async () => [],
    },
    { decisions: async () => decisions },
  );
  await service.run('C'.repeat(26), 'S'.repeat(26), state, [], T0, undefined, DEFAULT_LOCALE);
  return saved!;
}

describe('tanda tangan ahli pada angka yang ditampilkan', () => {
  it('tanpa tanda tangan, tidak satu pun angka terverifikasi', async () => {
    const { rec, traces } = await analyse([]);
    expect(traces.length).toBeGreaterThan(0);
    expect(traces.some((t) => t.provenance === 'VERIFIED')).toBe(false);
    expect(rec.systemLines.some((line) => line.provenance === 'VERIFIED')).toBe(false);
  });

  it('aturan yang ditandatangani menaikkan jejaknya, dan hanya jejaknya', async () => {
    const { traces: before } = await analyse([]);
    const target = before.find((t) => t.provenance === 'ASSUMED')!;
    expect(target).toBeDefined();

    const { traces: after } = await analyse([
      { ruleId: target.ruleId, ruleVersion: target.ruleVersion, decision: 'approved' },
    ]);

    const raised = after.filter((t) => t.provenance !== 'ASSUMED');
    expect(raised.every((t) => t.ruleId === target.ruleId)).toBe(true);
    // Tanpa ukuran rumah, dimensinya belum diketahui: naik ke estimasi, bukan terverifikasi.
    expect(raised.every((t) => t.provenance === 'ESTIMATED')).toBe(true);
  });

  it('baris sistem yang memakai aturan itu ikut naik', async () => {
    const { rec: before, traces } = await analyse([]);
    const line = before.systemLines.find((l) => l.traceIds.length > 0)!;
    const used = traces.filter((t) => line.traceIds.includes(t.id));
    expect(used.length).toBeGreaterThan(0);

    const { rec: after } = await analyse(
      used.map((t) => ({ ruleId: t.ruleId, ruleVersion: t.ruleVersion, decision: 'approved' })),
    );
    const sameLine = after.systemLines.find((l) => l.name === line.name)!;
    expect(line.provenance).toBe('ASSUMED');
    expect(sameLine.provenance).toBe('ESTIMATED');
  });

  it('dengan ukuran rumah yang disebut, tanda tangan sampai ke terverifikasi', async () => {
    const sized = withCompleteness(
      mergeRequirement(
        STATE,
        [{ path: 'building.dimensions', value: { lengthM: 9, widthM: 7 }, source: 'user_stated' }],
        T0,
      ).state,
    );
    const { traces: before } = await analyse([], sized);
    const target = before.find((t) => t.provenance === 'ASSUMED')!;

    const { traces: after } = await analyse(
      [{ ruleId: target.ruleId, ruleVersion: target.ruleVersion, decision: 'approved' }],
      sized,
    );
    expect(after.find((t) => t.ruleId === target.ruleId)?.provenance).toBe('VERIFIED');
  });

  it('aturan yang ditolak ahli membuat barisnya tidak menampilkan nilai', async () => {
    const { rec: before, traces } = await analyse([]);
    const line = before.systemLines.find((l) => l.traceIds.length > 0)!;
    const used = traces.filter((t) => line.traceIds.includes(t.id));

    const { rec: after } = await analyse(
      used.map((t) => ({ ruleId: t.ruleId, ruleVersion: t.ruleVersion, decision: 'rejected' })),
    );
    expect(after.systemLines.find((l) => l.name === line.name)?.provenance).toBe('UNAVAILABLE');
  });
});
