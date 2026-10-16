/** Audit PDAM 2026-10-16 (temuan 3–6): tampilan jaringan air minum jujur per segmen, mode, PN, fitting. */
import { computeNetwork } from '@snouty/engineering';
import { describe, expect, it } from 'vitest';
import {
  waterSupplyBomItems,
  waterSupplyHighlights,
  waterSupplyProse,
  waterSupplySystemLines,
} from './water-supply-view.js';

const traced = (result: ReturnType<typeof computeNetwork>) =>
  result.traces.map((t, i) => ({ ...t, id: `T${String(i).padStart(3, '0')}` }));

describe('water-supply view', () => {
  const branched = computeNetwork({
    kind: 'water_supply',
    connections: 500,
    routeLengthM: 2000,
    staticHeadM: 20,
    branches: 4,
    sourcePressureBar: 1.5,
    material: 'HDPE',
  });
  const single = computeNetwork({
    kind: 'water_supply',
    connections: 500,
    routeLengthM: 2000,
    staticHeadM: 20,
    material: 'HDPE',
  });

  it('highlight: induk, 4 cabang dengan debit tiap cabang, head titik kritis, mode booster, pompa sebesar kekurangan, PN + surja', () => {
    const rows = waterSupplyHighlights(branched, 'HDPE', 3, 'id');
    const by = (label: string) => rows.find((r) => r.label.startsWith(label))?.value ?? '';
    expect(by('Cabang (4)')).toContain('tiap cabang');
    expect(by('Sistem')).toBe('PDAM + pompa booster');
    expect(by('Pompa')).toContain('cocokkan dengan kurva pabrikan');
    expect(by('Kelas tekanan')).toMatch(/PN|kajian tim teknis/);
    expect(by('Kelas tekanan')).toContain('surja');
    expect(by('Head di titik kritis')).toContain('kehilangan');
  });

  it('tanpa cabang: highlight dan prosa menyebut satu pipa sebagai asumsi, bukan tata letak', () => {
    const rows = waterSupplyHighlights(single, 'HDPE', 3, 'id');
    expect(rows.find((r) => r.label === 'Cabang')?.value).toContain('asumsi');
    expect(waterSupplyProse(single, 'HDPE', 'id').body).toContain('asumsi, bukan tata letak');
  });

  it('baris sistem: induk, cabang × 4, mode, kelas tekanan — dasar dari trace ENG-414/415/416/411', () => {
    const lines = waterSupplySystemLines(branched, 'HDPE', traced(branched), 'id');
    expect(lines.map((l) => l.name)).toEqual([
      'Pipa induk HDPE',
      'Pipa cabang HDPE (× 4)',
      'PDAM + pompa booster',
      'Kelas tekanan',
    ]);
    expect(lines[0]!.reason).toContain('Pipa induk membawa seluruh');
    expect(lines[2]!.reason).toContain('pompa booster');
    expect(lines[3]!.reason).toMatch(/kelas PN|melampaui kelas PN/);
  });

  it('BOM: pipa induk, pipa cabang 4 × panjang, tee per cabang, reducer bila ukuran turun; elbow/katup/check valve tertunda', () => {
    const bom = waterSupplyBomItems(branched, 'HDPE', traced(branched), 'id', {
      trunk: null,
      branch: null,
    });
    const items = bom.map((b) => b.item);
    expect(items[0]).toBe('Pipa HDPE (induk)');
    expect(items[1]).toBe('Pipa HDPE (cabang)');
    expect(bom[1]!.quantity).toBe(4 * branched.supply!.topology.branch!.lengthM);
    expect(bom.find((b) => b.item.startsWith('Tee'))?.quantity).toBe(4);
    const branchSize = branched.supply!.topology.branch!.size;
    if (branchSize !== branched.recommendedSize) {
      expect(bom.find((b) => b.item.startsWith('Reducer'))?.quantity).toBe(4);
    }
    const pending = bom.filter((b) => b.pending);
    expect(pending.map((b) => b.item)).toEqual([
      'Elbow 90° (belokan jalur)',
      'Katup / gate valve (sumber, cabang)',
      'Katup searah dan adaptor pompa',
    ]);
    expect(pending.every((b) => b.quantity === 0)).toBe(true);
  });

  it('prosa: menyebut mode, segmen, PN, dan bahwa kelas harus dikonfirmasi ke Pralon; bukan desain final', () => {
    const prose = waterSupplyProse(branched, 'HDPE', 'id');
    expect(prose.headline).toMatch(/^500 sambungan rumah: pipa induk HDPE .* dengan 4 cabang/);
    expect(prose.headline).toContain(', PDAM + pompa booster');
    expect(waterSupplyProse(single, 'HDPE', 'id').headline).toMatch(
      /, (gravitasi|suplai|dipompa|PDAM)/,
    );
    expect(prose.body).toContain('kurva pompa pabrikan');
    expect(prose.body).toMatch(/Kelas tekanan PN \d+ .*kelas itu atau lebih/);
    expect(prose.body).toContain('bukan desain final');
    expect(waterSupplyProse(branched, 'HDPE', 'en').body).toContain('not a final design');
  });
});
