/**
 * P14-06 — bagian tetap jawaban teknis dirakit dari state + engine, tanpa model: data diketahui vs
 * asumsi, perhitungan dari trace, opsi dengan status dan catatan tradeoff, kesiapan per keluaran,
 * data yang masih dibutuhkan. Invarian T-1: tidak ada angka yang tidak berasal dari engine/state.
 */
import { describe, expect, it } from 'vitest';
import { computeGravity, computePressurized } from '@snouty/engineering';
import { emptyRequirementState } from '../../context/domain/requirement-state.factory.js';
import { composeResponse } from './response-composer.js';

const T0 = '2026-01-01T00:00:00.000Z';
type Param = {
  label: string;
  value: number | string | boolean;
  unit?: string;
  origin: 'known' | 'assumed';
};
const technical = (caseId: string, parameters: Record<string, Param>) => ({
  ...emptyRequirementState(T0),
  useCase: { kind: 'technical' as const, caseId, parameters },
});
const known = (label: string, value: number | string | boolean, unit?: string): Param => ({
  label,
  value,
  origin: 'known',
  ...(unit ? { unit } : {}),
});

describe('composeResponse — transfer pompa', () => {
  const state = technical('pump_transfer', {
    design_flow: known('Debit rencana', 5, 'l/s'),
    route_length: known('Panjang jalur', 800, 'm'),
    static_head: known('Beda tinggi', 12, 'm'),
    material: { label: 'Bahan pipa', value: 'HDPE', origin: 'assumed' },
    pump_required: { label: 'Perlu pompa?', value: 'Belum tahu', origin: 'known' },
  });
  const result = computePressurized({ designFlowLs: 5, routeLengthM: 800, staticHeadM: 12 });
  const traces = result.traces.map((t, i) => ({ ...t, id: `T${i}` }));
  const composed = composeResponse({
    state,
    traces,
    pressurized: result,
    appliedAssumptionIds: [...result.appliedAssumptionIds, 'HDPE_MAIN_FROM_200M'],
  });

  it('asumsi engine mengisi parameternya untuk kesiapan: sizing yang baru dihitung tidak "DATA KURANG"', () => {
    // Produksi 2026-10-07: bahan tidak ada di state (dipilih engine lewat HDPE_MAIN_FROM_200M) dan
    // ID asumsinya tidak diteruskan → `material` dianggap kurang → pipe_sizing "missing_data".
    const withoutMaterial = Object.fromEntries(
      Object.entries(state.useCase!.parameters).filter(([key]) => key !== 'material'),
    );
    const bareState = { ...state, useCase: { ...state.useCase!, parameters: withoutMaterial } };
    const bare = composeResponse({ state: bareState, traces, pressurized: result });
    expect(bare.readiness.find((r) => r.output === 'pipe_sizing')?.readiness).toBe('missing_data');
    const fixed = composeResponse({
      state: bareState,
      traces,
      pressurized: result,
      appliedAssumptionIds: [...result.appliedAssumptionIds, 'HDPE_MAIN_FROM_200M'],
    });
    expect(fixed.readiness.find((r) => r.output === 'pipe_sizing')?.readiness).not.toBe(
      'missing_data',
    );
    // Diameter sudah ditetapkan engine → kesiapan pompa tidak boleh "kurang diameter nominal".
    const pump = fixed.readiness.find((r) => r.output === 'pump_sizing');
    expect(pump?.missing).not.toContain('Diameter nominal');
    expect(pump?.readiness).not.toBe('missing_data');
    const sizing = composed.readiness.find((r) => r.output === 'pipe_sizing');
    expect(sizing?.readiness).not.toBe('missing_data');
    expect(composed.missingData.map((m) => m.label)).not.toContain('Bahan pipa');
  });

  it('data diketahui = parameter known bersatuan; "Belum tahu" bukan data; asumsi terpisah', () => {
    expect(composed.knownData).toEqual([
      { label: 'Debit rencana', value: '5 l/s' },
      { label: 'Panjang jalur', value: '800 m' },
      // Label datang dari registry saat ditampilkan, bukan dari label yang tersimpan di state.
      { label: 'Tinggi statis', value: '12 m' },
    ]);
    expect(composed.assumedData).toEqual([{ label: 'Bahan pipa', value: 'HDPE' }]);
  });

  it('perhitungan: satu baris per trace, judul langkah yang bisa dibaca (tanpa kode aturan), penjelasan dari engine berangka Indonesia', () => {
    expect(composed.calculations).toHaveLength(traces.length);
    expect(composed.calculations[0]!.label).toBe('Pilih ukuran pipa');
    for (const c of composed.calculations) expect(c.label).not.toMatch(/ENG-\d/);
    expect(composed.calculations.map((c) => c.value)).toEqual(
      traces.map((t) => t.explanation.replace(/(\d)\.(\d)/g, '$1,$2')),
    );
  });

  it('opsi: seluruh kandidat engine, tepat satu rekomendasi, alternatif ditandai, catatan per status', () => {
    expect(composed.options).toHaveLength(result.candidates.length);
    const recommended = composed.options.filter((o) => o.recommended);
    expect(recommended).toHaveLength(1);
    expect(recommended[0]!.size).toBe(result.recommendedSize);
    expect(recommended[0]!.status).toBe('ok');
    expect(recommended[0]!.note).toContain('Memenuhi');
    const alternative = composed.options.find((o) => o.alternative);
    expect(alternative?.size).toBe(result.alternativeSize);
    expect(alternative?.note).toContain('Satu ukuran di atas');
    const tooFast = composed.options.find((o) => o.status === 'too_fast');
    expect(tooFast?.note).toContain('terlalu cepat');
    // Angka opsi persis dari kandidat engine (T-1).
    const first = result.candidates[0]!;
    expect(composed.options[0]!.metrics.map((m) => m.value)).toEqual([
      `${first.innerDiameterMm.toLocaleString('id-ID', { maximumFractionDigits: 2 })} mm`,
      `${first.velocityMs.toLocaleString('id-ID', { maximumFractionDigits: 2 })} m/s`,
      `${first.frictionLossM.toLocaleString('id-ID', { maximumFractionDigits: 2 })} m`,
      `${first.totalDynamicHeadM.toLocaleString('id-ID', { maximumFractionDigits: 2 })} m`,
    ]);
  });

  it('kesiapan per keluaran profil kasus dengan label bahasa pengguna; "Belum tahu" tidak dihitung', () => {
    expect(composed.readiness.length).toBeGreaterThan(0);
    for (const item of composed.readiness) {
      expect(item.label).not.toBe(item.output);
      expect(['ready', 'partial', 'missing_data']).toContain(item.readiness);
    }
    // Debit, panjang, dan beda tinggi diketahui → sizing bisa dihitung (tidak ada yang wajib kurang);
    // `partial` bila masih ada parameter yang akan memperbaiki hasil.
    const sizing = composed.readiness.find((r) => r.output === 'pipe_sizing');
    expect(sizing?.missing).toEqual([]);
    expect(['ready', 'partial']).toContain(sizing?.readiness);
  });

  it('data yang masih dibutuhkan: pertanyaan registry untuk parameter yang belum ada (maks. 4)', () => {
    expect(composed.missingData.length).toBeLessThanOrEqual(4);
    for (const item of composed.missingData) {
      expect(item.value.endsWith('?')).toBe(true);
    }
  });
});

describe('composeResponse — bahasa', () => {
  const state = technical('pump_transfer', {
    design_flow: known('Debit rencana', 5, 'l/s'),
    route_length: known('Panjang jalur', 800, 'm'),
    static_head: known('Beda tinggi', 12, 'm'),
  });
  const result = computePressurized({ designFlowLs: 5, routeLengthM: 800, staticHeadM: 12 });
  const traces = result.traces.map((t, i) => ({ ...t, id: `T${i}` }));
  const base = { state, traces, pressurized: result };

  it("'id' eksplisit sama dengan bawaan", () => {
    expect(composeResponse({ ...base, locale: 'id' })).toEqual(composeResponse(base));
  });

  it("'en': opsi berlabel dan bercatatan Inggris, jumlah dan angka sama", () => {
    const id = composeResponse(base);
    const en = composeResponse({ ...base, locale: 'en' });
    expect(en.options).toHaveLength(id.options.length);
    expect(en.options.map((o) => [o.size, o.status, o.recommended, o.alternative])).toEqual(
      id.options.map((o) => [o.size, o.status, o.recommended, o.alternative]),
    );
    const first = result.candidates[0]!;
    expect(en.options[0]!.metrics.map((m) => m.label)).toEqual([
      'Inner diameter',
      'Velocity',
      'Pressure loss',
      'Total lift',
    ]);
    expect(en.options[0]!.metrics.map((m) => m.value)).toEqual([
      `${first.innerDiameterMm.toLocaleString('en-US', { maximumFractionDigits: 2 })} mm`,
      `${first.velocityMs.toLocaleString('en-US', { maximumFractionDigits: 2 })} m/s`,
      `${first.frictionLossM.toLocaleString('en-US', { maximumFractionDigits: 2 })} m`,
      `${first.totalDynamicHeadM.toLocaleString('en-US', { maximumFractionDigits: 2 })} m`,
    ]);
    expect(en.options.find((o) => o.recommended)!.note).toBe(
      'Meets the limits for water speed and pressure loss.',
    );
    expect(en.options.find((o) => o.alternative)!.note).toContain('One size above');
    expect(en.options.find((o) => o.status === 'too_fast')!.note).toContain('Velocity too high');
  });

  it("'en': label kesiapan Inggris, status dan jumlah sama", () => {
    const id = composeResponse(base);
    const en = composeResponse({ ...base, locale: 'en' });
    expect(en.readiness.map((r) => [r.output, r.readiness])).toEqual(
      id.readiness.map((r) => [r.output, r.readiness]),
    );
    expect(en.readiness.find((r) => r.output === 'pipe_sizing')?.label).toBe('Pipe sizing');
    expect(en.readiness.every((r) => r.label !== r.output)).toBe(true);
    expect(en.missingData).toHaveLength(id.missingData.length);
  });

  it("'en': data diketahui, parameter kesiapan, dan data kurang berlabel registry Inggris", () => {
    const id = composeResponse(base);
    const en = composeResponse({ ...base, locale: 'en' });
    expect(id.knownData.map((k) => k.label)).toContain('Debit rencana');
    expect(en.knownData.map((k) => k.label)).toContain('Design flow');
    expect(en.knownData.map((k) => k.value)).toContain('5 l/s');
    en.knownData.forEach((k, i) => expect(k.label).not.toBe(id.knownData[i]!.label));
    en.readiness.forEach((r, i) => {
      expect(r.missing).toHaveLength(id.readiness[i]!.missing.length);
      expect(r.improvable).toHaveLength(id.readiness[i]!.improvable.length);
      r.improvable.forEach((label, j) => expect(label).not.toBe(id.readiness[i]!.improvable[j]));
    });
    en.missingData.forEach((m, i) => {
      expect(m.label).not.toBe(id.missingData[i]!.label);
      expect(m.value).not.toBe(id.missingData[i]!.value);
      expect(m.value.endsWith('?')).toBe(true);
    });
  });

  it("'en': gravitasi memakai label kapasitas Inggris", () => {
    const gState = technical('gravity_drainage', {
      design_flow: known('Debit rencana', 20, 'l/s'),
      slope: known('Kemiringan', 1, '%'),
    });
    const g = computeGravity({ kind: 'drainage', designFlowLs: 20, slopePercent: 1 });
    const gTraces = g.traces.map((t, i) => ({ ...t, id: `G${i}` }));
    const en = composeResponse({ state: gState, traces: gTraces, gravity: g, locale: 'en' });
    expect(en.options[0]!.metrics.map((m) => m.label)).toEqual([
      'Inner diameter',
      'Full-bore capacity',
      'Full-bore velocity',
      'Capacity utilisation',
    ]);
  });
});

describe('composeResponse — gravitasi dan kasus tanpa kandidat', () => {
  it('opsi gravitasi memakai kapasitas dan pemakaian kapasitas; status too_small bercatatan', () => {
    const state = technical('gravity_drainage', {
      design_flow: known('Debit rencana', 20, 'l/s'),
      slope: known('Kemiringan', 1, '%'),
    });
    const result = computeGravity({ kind: 'drainage', designFlowLs: 20, slopePercent: 1 });
    const traces = result.traces.map((t, i) => ({ ...t, id: `G${i}` }));
    const composed = composeResponse({ state, traces, gravity: result });
    expect(composed.options.length).toBe(result.candidates.length);
    expect(composed.options.filter((o) => o.recommended).map((o) => o.size)).toEqual([
      result.recommendedSize,
    ]);
    expect(composed.options[0]!.metrics.map((m) => m.label)).toEqual([
      'Diameter dalam',
      'Kapasitas penuh',
      'Kecepatan penuh',
      'Pemakaian kapasitas',
    ]);
    const small = composed.options.find((o) => o.status === 'too_small');
    if (small) expect(small.note).toContain('Kapasitas');
  });

  it('tanpa kandidat (kolam) → opsi kosong; bukan kasus teknis → semua bagian kosong', () => {
    const pond = technical('fish_pond', { pond_length: known('Panjang kolam', 4, 'm') });
    expect(composeResponse({ state: pond, traces: [] }).options).toEqual([]);
    const plain = composeResponse({ state: emptyRequirementState(T0), traces: [] });
    expect(plain).toEqual({
      knownData: [],
      assumedData: [],
      calculations: [],
      options: [],
      readiness: [],
      missingData: [],
    });
  });
});
