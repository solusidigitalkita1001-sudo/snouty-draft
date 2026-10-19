/** P23-02 — lapisan renovasi di atas rekomendasi kasus mana pun: fakta, baris, BOM, kalimat. */
import { describe, expect, it } from 'vitest';
import type { Recommendation, RequirementState } from '@snouty/shared-types';
import { emptyRequirementState } from '../../context/domain/requirement-state.factory.js';
import { applyTechnicalFacts } from '../../context/domain/technical.js';
import { renovationFactsFrom, withRenovation, workTypeLabel } from './renovation-view.js';

const T0 = '2026-01-01T00:00:00.000Z';

function base(kind: Recommendation['kind']): Recommendation {
  return {
    id: 'R',
    conversationId: 'C',
    snapshotId: 'S',
    catalogVersionId: 'V',
    headline: 'Sistem distribusi untuk 2 titik air',
    body: 'Kalimat pertama. Kalimat kedua.',
    ...(kind ? { kind } : {}),
    stats: {
      outletCount: 2,
      mainSize: '3/4"',
      branchCount: 1,
      fixtureConnectionSize: '1/2"',
      productCount: 1,
    },
    ...(kind === 'technical' ? { highlights: [{ label: 'Pipa utama', value: '3/4"' }] } : {}),
    systemLines: [],
    products: [],
    bom: [
      {
        item: 'Pipa PVC AW',
        size: '3/4"',
        quantity: 10,
        unit: 'batang',
        basis: 'jalur 30 m',
        provenance: 'ASSUMED',
        traceIds: [],
        netLengthM: 30,
      },
      {
        item: 'Elbow',
        size: '3/4"',
        quantity: 4,
        unit: 'pcs',
        basis: '',
        provenance: 'ASSUMED',
        traceIds: [],
      },
    ],
    assumptions: [],
    overallProvenance: 'ASSUMED',
    createdAt: T0,
  };
}

function technicalState(message: string): RequirementState {
  return applyTechnicalFacts(emptyRequirementState(T0), 'water_supply_network', message).state;
}

describe('renovationFactsFrom', () => {
  it('kasus teknis: dari parameter work_type/existing_*; bangun baru → null', () => {
    expect(renovationFactsFrom(technicalState('spam 500 sr, jalur 2 km, naik 20 m'))).toBeNull();
    const facts = renovationFactsFrom(
      technicalState(
        'perluasan spam, pipa induk lama 110 mm hdpe sudah melayani 300 sr, tambah 200 sambungan, jalur baru 800 m',
      ),
    );
    expect(facts).toEqual({
      mode: 'extend',
      existingSize: '110 mm',
      existingMaterial: 'HDPE',
      existingLoad: 300,
      replacementLengthM: null,
    });
  });

  it('rumah: workType/field pipa lama; replaceExisting lama dibaca ganti semua; renovasi tanpa jenis → null', () => {
    const s0 = emptyRequirementState(T0);
    const tracked = <T>(value: T) => ({
      value,
      provenance: 'VERIFIED' as const,
      source: 'user_stated' as const,
      updatedAt: T0,
    });
    const extend: RequirementState = {
      ...s0,
      water: {
        ...s0.water,
        workType: tracked('extend' as const),
        existingMainSize: tracked('3/4"'),
        existingPipeMaterial: tracked('galvanized' as const),
        existingOutlets: tracked(4),
      },
    };
    expect(renovationFactsFrom(extend)).toEqual({
      mode: 'extend',
      existingSize: '3/4"',
      existingMaterial: 'Galvanis / besi',
      existingLoad: 4,
      replacementLengthM: null,
    });
    const legacy: RequirementState = {
      ...s0,
      water: { ...s0.water, replaceExisting: tracked(true) },
    };
    expect(renovationFactsFrom(legacy)?.mode).toBe('replace_all');
    const unclear: RequirementState = {
      ...s0,
      water: { ...s0.water, workType: tracked('renovation' as const) },
    };
    expect(renovationFactsFrom(unclear)).toBeNull();
  });
});

describe('withRenovation', () => {
  it('perluasan rumah: pipa lama 3/4" galvanis kurang untuk 6 titik → baris sistem, sok drat + tee di BOM, judul dan pembuka', () => {
    const out = withRenovation(
      base(undefined),
      {
        mode: 'extend',
        existingSize: '3/4"',
        existingMaterial: 'Galvanis / besi',
        existingLoad: 4,
        replacementLengthM: null,
      },
      [],
      {
        newMainSize: '3/4"',
        branchSize: '3/4"',
        newLoad: 2,
        loadUnit: 'titik',
        routeLengthM: 30,
        family: 'PVC AW',
        sizeForTotal: (existing, total) => (existing === 4 && total === 6 ? '1"' : null),
        extraAssumptionIds: ['RENOV_EXISTING_OUTLET_1_WSFU'],
        productFor: (kind) => (kind === 'faucet_socket' ? 'P-FS' : undefined),
      },
      'id',
    );
    const r = out.recommendation;
    expect(r.headline).toBe('Perluasan: sistem distribusi untuk 2 titik air');
    expect(r.body).toMatch(
      /^Perluasan: pipa utama lama 3\/4" kurang untuk total 6 titik air dan diganti ke 1"/,
    );
    expect(r.systemLines.map((l) => l.name)).toEqual(['Pipa utama lama', 'Sambungan ke pipa lama']);
    expect(r.systemLines[0]!.reason).toContain('4 titik air yang sudah ada ditambah 2');
    expect(r.systemLines[0]!.reason).toContain('kurang');
    const added = r.bom.slice(2);
    expect(added.map((b) => `${b.item}|${b.size}|${b.quantity}|${b.productId ?? '-'}`)).toEqual([
      'Sok drat PVC AW (sambung pipa lama)|3/4"|2|P-FS',
      'Tee PVC AW (sambung pipa lama)|3/4"|1|-',
    ]);
    expect(r.assumptions.map((a) => a.assumptionId)).toContain('RENOV_EXISTING_OUTLET_1_WSFU');
    expect(out.traces.map((t) => t.ruleId)).toEqual(['ENG-904', 'ENG-901', 'ENG-902']);
    expect(out.traces.every((t) => t.id.length > 0)).toBe(true);
    // Judul rumah tidak kehilangan huruf; highlight hanya untuk kasus teknis.
    expect(r.highlights).toBeUndefined();
  });

  it('perluasan tanpa ukuran pipa lama: kapasitas tidak dicek dan DITULIS; tanpa fitting sambungan', () => {
    const out = withRenovation(
      base('technical'),
      {
        mode: 'extend',
        existingSize: null,
        existingMaterial: null,
        existingLoad: null,
        replacementLengthM: null,
      },
      [],
      { newMainSize: '90 mm', family: 'HDPE', newLoad: 200, loadUnit: 'sambungan' },
      'id',
    );
    const r = out.recommendation;
    expect(r.body).toContain('belum dicek cukup atau tidak karena ukuran pipa lama belum disebut');
    expect(r.highlights?.map((h) => h.label)).toEqual(['Pipa utama', 'Pekerjaan', 'Pipa lama']);
    expect(r.highlights?.[2]!.value).toContain('belum dicek');
    expect(r.bom).toHaveLength(2);
    expect(r.assumptions.some((a) => a.ruleId === 'ENG-901' && a.fieldPath === '')).toBe(true);
  });

  it('ganti sebagian 12 m dari 30 m: hanya pipa utama 40 % (dibulatkan ke atas) + 2 sok; cabang dan fitting lain tidak ikut', () => {
    const out = withRenovation(
      base('technical'),
      {
        mode: 'replace_partial',
        existingSize: null,
        existingMaterial: 'PVC',
        existingLoad: null,
        replacementLengthM: 12,
      },
      [],
      { newMainSize: '3/4"', family: 'PVC AW', routeLengthM: 30, productFor: () => 'P-SOK' },
      'id',
    );
    const r = out.recommendation;
    expect(r.bom).toHaveLength(2);
    expect(r.bom[0]).toMatchObject({ item: 'Pipa PVC AW', quantity: 4, netLengthM: 12 });
    expect(r.bom[1]).toMatchObject({
      item: 'Sok PVC AW (sambung ke pipa lama)',
      quantity: 2,
      productId: 'P-SOK',
    });
    expect(r.headline).toBe('Penggantian sebagian: sistem distribusi untuk 2 titik air');
    expect(r.body).toMatch(/^Penggantian sebagian: hanya segmen 12 m yang diganti/);
    expect(r.assumptions.map((a) => a.assumptionId)).toEqual(['RENOV_COUPLINGS_PER_SEGMENT_2']);
  });

  it('ganti semua: kasus teknis mendapat judul + kalimat; rumah memakai judul templatnya sendiri', () => {
    const facts = {
      mode: 'replace_all' as const,
      existingSize: null,
      existingMaterial: null,
      existingLoad: null,
      replacementLengthM: null,
    };
    const technical = withRenovation(
      base('technical'),
      facts,
      [],
      { newMainSize: '2"', family: 'PVC AW' },
      'id',
    );
    expect(technical.recommendation.headline).toBe(
      'Penggantian pipa: sistem distribusi untuk 2 titik air',
    );
    expect(technical.recommendation.body).toMatch(
      /^Penggantian pipa: pipa lama diganti pada jalur yang sama/,
    );
    const house = withRenovation(
      base(undefined),
      facts,
      [],
      { newMainSize: '3/4"', family: 'PVC AW' },
      'id',
    );
    expect(house.recommendation.headline).toBe('Sistem distribusi untuk 2 titik air');
    expect(house.recommendation.body).toBe('Kalimat pertama. Kalimat kedua.');
    expect(workTypeLabel('replace_all', 'en')).toBe('Pipe replacement');
  });
});
