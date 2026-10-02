/**
 * P8-04a — laporan dirakit dari data tersimpan, TANPA LLM, dan dua kali perakitan
 * menghasilkan isi identik (docs/REPORT.md §1).
 */
import { describe, expect, it } from 'vitest';
import type { Recommendation, RequirementState } from '@snouty/shared-types';
import { computeSolution } from '@snouty/engineering';
import { mergeRequirement } from '../../context/domain/context-merger.js';
import { withCompleteness } from '../../context/domain/completeness.js';
import { emptyRequirementState } from '../../context/domain/requirement-state.factory.js';
import type { TraceToSave } from '../../recommendation/domain/recommendation.repository.js';
import { assembleReportPayload } from './report-assembler.js';
import { renderReportHtml } from './report-html.js';

const T0 = '2026-10-02T00:00:00.000Z';

const SOLUTION = computeSolution({
  buildingType: 'residential',
  floors: 2,
  bathrooms: 3,
  basins: 4,
  kitchens: 1,
  waterSource: 'rooftop_tank',
  installationType: 'clean_water',
  floorHeightM: null,
  mainRunMeters: null,
});

const TRACES: readonly TraceToSave[] = SOLUTION.traces.map((trace, index) => ({
  ...trace,
  id: `t${index}`,
}));

const STATE: RequirementState = withCompleteness(
  mergeRequirement(
    emptyRequirementState(T0),
    [
      { path: 'building.type', value: 'residential', source: 'user_stated' },
      { path: 'building.floors', value: 2, source: 'user_stated' },
      { path: 'fixtures.bathrooms', value: 3, source: 'user_stated' },
      { path: 'water.source', value: 'rooftop_tank', source: 'user_stated' },
      { path: 'water.installationType', value: 'clean_water', source: 'user_stated' },
    ],
    T0,
  ).state,
);

const RECOMMENDATION: Recommendation = {
  id: '01JBREC00000000000000000AA',
  conversationId: '01JBCONV0000000000000000BB',
  snapshotId: '01JBSNAP0000000000000000CC',
  catalogVersionId: 'dev-0.2',
  headline: 'Sistem distribusi untuk 8 titik air',
  body: 'Kebutuhan Anda mencakup 8 titik air yang dilayani 2 cabang.',
  stats: {
    outletCount: 8,
    mainSize: '1"',
    branchCount: 2,
    fixtureConnectionSize: '1/2"',
    productCount: 4,
  },
  systemLines: [
    {
      name: 'Pipa distribusi utama',
      path: 'Sumber → riser',
      size: '1"',
      reason: 'Total 11 unit beban mencapai ambang 8 unit.',
      provenance: 'ASSUMED',
      traceIds: ['t0', 't1'],
      role: 'main',
    },
  ],
  products: [],
  bom: SOLUTION.bom.map((line) => ({
    item: line.item,
    size: line.size,
    quantity: line.quantity,
    unit: line.unit,
    basis: 'Kuantitas diperkirakan dari 2 lantai dan 3 kamar mandi.',
    provenance: 'ASSUMED',
    traceIds: ['t9'],
  })),
  assumptions: [
    {
      text: 'Tinggi antar lantai diasumsikan 3,5 meter.',
      fieldPath: 'building.floorHeightM',
      ruleId: 'ENG-004',
    },
  ],
  overallProvenance: 'ASSUMED',
  createdAt: T0,
};

const INPUT = {
  reportNumber: 'SNTY-2026-10-0001',
  recommendation: RECOMMENDATION,
  traces: TRACES,
  state: STATE,
  identity: {
    customerName: 'Budi Santoso',
    projectLocation: 'Surabaya',
    consultationDate: '2026-10-02',
    installationType: 'Air bersih',
  },
  catalogVersionLabel: 'dev-0.2',
  pricing: { enabled: false, taxRatePercent: 11 },
};

describe('assembleReportPayload', () => {
  it('dirakit dua kali menghasilkan isi identik', () => {
    expect(JSON.stringify(assembleReportPayload(INPUT))).toBe(
      JSON.stringify(assembleReportPayload(INPUT)),
    );
  });

  it('menyalin prosa dari rekomendasi, tidak membuat yang baru', () => {
    const payload = assembleReportPayload(INPUT);
    expect(payload.headline).toBe(RECOMMENDATION.headline);
    expect(payload.body).toBe(RECOMMENDATION.body);
  });

  it('kebutuhan yang belum diisi tidak menjadi baris kosong', () => {
    const payload = assembleReportPayload(INPUT);
    // `fixtures.basins` dan `kitchens` tidak diisi di STATE.
    expect(payload.requirements.map((r) => r.label)).not.toContain('Wastafel');
    expect(payload.requirements.map((r) => r.label)).toContain('Kamar mandi');
  });

  it('DASAR PERHITUNGAN dirakit dari trace, satu baris per aturan', () => {
    const payload = assembleReportPayload(INPUT);
    expect(payload.basis).toHaveLength(TRACES.length);
    expect(payload.basis[0]!.ruleId).toBe(TRACES[0]!.ruleId);
    expect(payload.basis[0]!.explanation).toBe(TRACES[0]!.explanation);
  });

  it('harga nonaktif: seluruh nilainya nol dan ditandai nonaktif', () => {
    const payload = assembleReportPayload(INPUT);
    expect(payload.pricing).toEqual({
      enabled: false,
      taxRatePercent: 11,
      subtotal: 0,
      taxAmount: 0,
      total: 0,
    });
  });

  it('harga aktif: PPN dihitung dari subtotal baris BOM', () => {
    const withPrices = {
      ...INPUT,
      recommendation: {
        ...RECOMMENDATION,
        bom: RECOMMENDATION.bom.map((item) => ({ ...item, unitPrice: 50_000, subtotal: 100_000 })),
      },
      pricing: { enabled: true, taxRatePercent: 11 },
    };
    const payload = assembleReportPayload(withPrices);
    expect(payload.pricing.subtotal).toBe(500_000);
    expect(payload.pricing.taxAmount).toBe(55_000);
    expect(payload.pricing.total).toBe(555_000);
  });

  it('status mengikuti provenance — ASUMSI hari ini, bukan TERVERIFIKASI', () => {
    const payload = assembleReportPayload(INPUT);
    expect(payload.overallProvenance).toBe('ASSUMED');
    for (const line of payload.systemLines) expect(line.provenance).toBe('ASSUMED');
  });
});

describe('renderReportHtml', () => {
  const html = renderReportHtml(assembleReportPayload(INPUT));

  it('menghasilkan dua halaman', () => {
    expect(html.match(/class="page"/g)).toHaveLength(2);
  });

  it('memuat nomor laporan di kedua kop', () => {
    expect(html.match(/SNTY-2026-10-0001/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it('memuat disclaimer apa adanya di kedua footer', () => {
    expect(html.match(/PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS/g)).toHaveLength(2);
  });

  it('baris teknik berstatus ASUMSI, baris kebutuhan boleh TERVERIFIKASI', () => {
    // Pembedaan yang penting: nilai TEKNIK asumsi karena aturannya belum divalidasi
    // (OQ-06), tetapi kebutuhan yang DISEBUT PENGGUNA memang terverifikasi — itu
    // pernyataan mereka sendiri, bukan hasil hitungan sistem.
    expect(html).toContain('ASUMSI');

    const systemSection = html.slice(html.indexOf('REKOMENDASI SISTEM'));
    const systemRows = systemSection.slice(0, systemSection.indexOf('ASUMSI YANG DIGUNAKAN'));
    expect(systemRows).not.toContain('TERVERIFIKASI');

    const requirementSection = html.slice(html.indexOf('KEBUTUHAN YANG TERCATAT'));
    expect(requirementSection.slice(0, requirementSection.indexOf('REKOMENDASI SISTEM'))).toContain(
      'TERVERIFIKASI',
    );
  });

  it('harga nonaktif: tidak merender kolom harga maupun blok total', () => {
    expect(html).not.toContain('HARGA SATUAN');
    expect(html).not.toContain('Total estimasi');
    // Tidak pernah menampilkan Rp 0, yang akan terbaca sebagai "gratis".
    expect(html).not.toContain('Rp 0');
  });

  it('harga aktif: merender kolom, total, dan kalimat penawaran', () => {
    const withPrices = renderReportHtml(
      assembleReportPayload({
        ...INPUT,
        recommendation: {
          ...RECOMMENDATION,
          bom: RECOMMENDATION.bom.map((item) => ({
            ...item,
            unitPrice: 50_000,
            subtotal: 100_000,
          })),
        },
        pricing: { enabled: true, taxRatePercent: 11 },
      }),
    );
    expect(withPrices).toContain('HARGA SATUAN');
    expect(withPrices).toContain('Total estimasi');
    expect(withPrices).toContain('bukan penawaran resmi');
  });

  it('meng-escape nilai dari pengguna (nama pelanggan adalah jalur injeksi)', () => {
    const html = renderReportHtml(
      assembleReportPayload({
        ...INPUT,
        identity: { ...INPUT.identity, customerName: '<script>alert(1)</script>' },
      }),
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('memuat blok "Diperiksa oleh (opsional)" — tempat manusia mengambil tanggung jawab', () => {
    expect(html).toContain('Diperiksa oleh (opsional)');
  });

  it('memuat A4 dan margin di CSS @page', () => {
    expect(html).toContain('size: A4');
  });
});
