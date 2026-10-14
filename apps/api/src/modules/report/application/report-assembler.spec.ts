/**
 * P8-04a — laporan dirakit dari data tersimpan, TANPA LLM, dan dua kali perakitan
 * menghasilkan isi identik (docs/REPORT.md §1).
 */
import { describe, expect, it } from 'vitest';
import type { ProductMatchState, Recommendation, RequirementState } from '@snouty/shared-types';
import { computeSolution } from '@snouty/engineering';
import { mergeRequirement } from '../../context/domain/context-merger.js';
import { withCompleteness } from '../../context/domain/completeness.js';
import { emptyRequirementState } from '../../context/domain/requirement-state.factory.js';
import type { TraceToSave } from '../../recommendation/domain/recommendation.repository.js';
import { assembleReportPayload } from './report-assembler.js';
import { renderReportHtml } from './report-html.js';
import { schematicFor } from '../../recommendation/application/analysis.service.js';

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
  bom: [
    {
      item: 'Pipa PVC AW',
      size: '1"',
      quantity: 7,
      unit: 'batang',
      basis: 'Panjang bersih 25,5 m ÷ 4 m per batang = 6,38 → 7 batang.',
      provenance: 'ASSUMED',
      traceIds: ['t9'],
    },
  ],
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

  it('produk terpilih tanpa baris jumlah didaftar dengan nama katalog; tanpa nama tidak dikarang', () => {
    const product = (
      productId: string,
      size: string,
      matchState: ProductMatchState = 'VERIFIED_SELECTED',
    ) => ({ productId, size, role: 'main', matchState, reason: '' }) as const;
    const payload = assembleReportPayload({
      ...INPUT,
      recommendation: {
        ...RECOMMENDATION,
        bom: [{ ...RECOMMENDATION.bom[0]!, productId: 'P-COUNTED' }],
        products: [
          product('P-COUNTED', '1"'),
          product('P-AW34', '3/4"'),
          product('P-AW34', '3/4"'),
          product('P-NONAME', '1/2"'),
          product('P-UNKNOWN', '4"', 'INFORMATION_UNAVAILABLE'),
        ],
      },
      productNames: new Map([
        ['P-COUNTED', 'Pipa AW 1"'],
        ['P-AW34', 'Pipa (TS End) Putih AW 3/4" x 4 Meter'],
        ['P-UNKNOWN', 'Pipa D 4"'],
      ]),
    });
    expect(payload.pendingItems).toEqual([
      {
        productId: 'P-AW34',
        name: 'Pipa (TS End) Putih AW 3/4" x 4 Meter',
        size: '3/4"',
        kind: 'pipe',
      },
    ]);

    const html = renderReportHtml({ ...payload, bom: [] });
    // BOQ (DD-01): produk tanpa jumlah tetap satu baris tanpa angka, dengan keterangannya.
    expect(html).toContain('Pipa (TS End) Putih AW 3/4&quot; x 4 Meter');
    expect(html).toContain('Menunggu ukuran bangunan');
    expect(html).not.toContain('Pipa D 4&quot;');
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
    // Satu baris BOM × 100.000 = 100.000; PPN 11 % = 11.000.
    expect(payload.pricing.subtotal).toBe(100_000);
    expect(payload.pricing.taxAmount).toBe(11_000);
    expect(payload.pricing.total).toBe(111_000);
  });

  it('status mengikuti provenance — ASUMSI hari ini, bukan TERVERIFIKASI', () => {
    const payload = assembleReportPayload(INPUT);
    expect(payload.overallProvenance).toBe('ASSUMED');
    for (const line of payload.systemLines) expect(line.provenance).toBe('ASSUMED');
  });
});

describe('renderReportHtml', () => {
  const html = renderReportHtml(assembleReportPayload(INPUT));

  it('tanpa harga (DD-01): ringkasan, BOQ, dasar perhitungan & asumsi, penutup; tanpa produk terpilih tanpa lampiran produk', () => {
    const titles = [...html.matchAll(/<h2 class="section-title">([^<]*)<\/h2>/g)].map((m) => m[1]);
    expect(titles).toEqual([
      'Ringkasan Solusi',
      'Daftar Kebutuhan Material (BOQ)',
      'Dasar Perhitungan &amp; Asumsi',
      'Langkah Hitung &amp; Pengesahan',
    ]);
    const boq = html.slice(html.indexOf('BAGIAN 2'), html.indexOf('BAGIAN 3'));
    expect(boq).toContain('<td class="num">7</td>');
    expect(boq).toContain('batang');
  });

  it('ringkasan tanpa kotak warna-warni', () => {
    expect(html).not.toMatch(/class="tile|tone-/);
  });

  it('dasar perhitungan mencetak rumus singkat bila aturannya punya rumus', () => {
    const payload = assembleReportPayload(INPUT);
    const withFormula = payload.basis.filter((row) => row.formula !== undefined);
    expect(withFormula.length).toBeGreaterThan(0);
    // Hanya tabel langkah hitung: kalimat yang sama boleh muncul di tabel asumsi.
    const steps = html.slice(html.indexOf('<table class="grid steps">'));
    const stepsTable = steps.slice(0, steps.indexOf('</table>'));
    for (const row of withFormula) {
      expect(stepsTable).toContain(
        `<td class="formula">${row.formula!.replace(/"/g, '&quot;')}</td>`,
      );
      expect(stepsTable).not.toContain(row.explanation.replace(/"/g, '&quot;'));
    }
  });

  it('memuat logo Pralon dan maskot SNOUTY sebagai gambar tersisip, footer bernomor halaman', () => {
    expect(html.split("url('data:image/png;base64,").length - 1).toBe(2);
    expect(html).toContain('<script type="text/plain" id="snouty-pdf-footer">');
    expect(html).toContain('<span class="totalPages"></span>');
  });

  it('dasar perhitungan memakai judul langkah, bukan kode aturan', () => {
    const basis = html.slice(
      html.indexOf('<table class="grid steps">'),
      html.indexOf('Langkah berikutnya'),
    );
    expect(basis).not.toMatch(/ENG-\d/);
  });

  it('memuat nomor laporan di kedua kop', () => {
    expect(html.match(/SNTY-2026-10-0001/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it('memuat disclaimer apa adanya di kedua footer', () => {
    expect(html.match(/PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS/g)).toHaveLength(2);
  });

  it('baris teknik berstatus ASUMSI; baris kebutuhan "DISEBUT PENGGUNA", bukan TERVERIFIKASI', () => {
    // Nilai TEKNIK asumsi karena aturannya belum divalidasi (OQ-06). Kebutuhan yang disebut
    // pengguna adalah pernyataan mereka sendiri — bukan katalog atau aturan tervalidasi, jadi
    // tidak memakai label TERVERIFIKASI (temuan laporan 0009).
    expect(html).toContain('ASUMSI');

    const basis = html.slice(html.indexOf('Dasar Perhitungan &amp; Asumsi</h2>'));
    const systemRows = basis.slice(
      basis.indexOf('Ukuran pipa</h3>'),
      basis.indexOf('<h3 class="subhead">Asumsi</h3>'),
    );
    expect(systemRows).not.toContain('TERVERIFIKASI');

    const requirementSection = html.slice(html.indexOf('Kebutuhan yang tercatat'));
    const requirementRows = requirementSection.slice(0, requirementSection.indexOf('</section>'));
    expect(requirementRows).toContain('<span class="pill pill-user">DISEBUT PENGGUNA</span>');
    expect(requirementRows).not.toContain('TERVERIFIKASI');
    // Legendanya menjelaskan label itu.
    expect(html).toContain(
      '<strong>DISEBUT PENGGUNA</strong><span>Data dari Anda, belum dicek di lapangan</span>',
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

describe('laporan dua bahasa (P15-05)', () => {
  const PRICED = {
    ...INPUT,
    recommendation: {
      ...RECOMMENDATION,
      bom: RECOMMENDATION.bom.map((item) => ({
        ...item,
        unitPrice: 1_250_000,
        subtotal: 2_500_000,
      })),
    },
    pricing: { enabled: true, taxRatePercent: 11 },
  };
  const en = renderReportHtml(assembleReportPayload({ ...PRICED, locale: 'en' }));
  const enUnpriced = renderReportHtml(assembleReportPayload({ ...INPUT, locale: 'en' }));

  it("payload membekukan bahasa; tanpa locale bakunya 'id'", () => {
    expect(assembleReportPayload(INPUT).locale).toBe('id');
    expect(assembleReportPayload({ ...INPUT, locale: 'en' }).locale).toBe('en');
  });

  it("'id' eksplisit identik byte demi byte dengan bawaan", () => {
    for (const input of [INPUT, PRICED]) {
      expect(renderReportHtml(assembleReportPayload({ ...input, locale: 'id' }))).toBe(
        renderReportHtml(assembleReportPayload(input)),
      );
    }
    expect(renderReportHtml(assembleReportPayload(INPUT))).toContain('<html lang="id">');
  });

  it("'en': lang, judul, kolom, dan label status dalam bahasa Inggris", () => {
    expect(en).toContain('<html lang="en">');
    expect(en).toContain('Piping System Recommendation');
    expect(en).toContain('SECTION 2');
    expect(en).toContain('Bill of Quantities</h2>');
    expect(en).toContain('Calculation Basis &amp; Assumptions</h2>');
    expect(en).toContain('<th>UNIT PRICE</th>');
    expect(en).toContain('Reviewed by (optional):');
    expect(en).toContain('Page <span class="pageNumber"></span> of');
    expect(en).toContain('<span class="pill pill-assumed">ASSUMED</span>');
    expect(en).toContain('<span class="pill pill-user">STATED BY YOU</span>');
    // Baris kebutuhan dirakit dalam bahasa percakapan, bukan diterjemahkan saat mencetak.
    expect(en).toContain('<tr><th>Number of floors</th><td>2 floors</td>');
  });

  it("'en': dua kalimat kebijakan memakai redaksi web persis", () => {
    // SOLUTION_COPY_EN.planningDisclaimer — di kedua footer.
    expect(en.match(/PLANNING GUIDANCE — NOT A TECHNICAL CERTIFICATION/g)).toHaveLength(2);
    // SOLUTION_COPY_EN.priceDisclaimer — kalimat pertama banner, dengan atau tanpa harga.
    expect(en).toContain(
      '<div class="banner">A planning estimate, not an official quotation. Final prices follow the current Pralon distributor price list.</div>',
    );
    expect(enUnpriced).toContain(
      '<div class="banner">A planning estimate, not an official quotation.</div>',
    );
  });

  it("'en': rupiah tetap Rp dengan pemisah ribuan en-US", () => {
    expect(en).toContain('Rp 1,250,000');
    expect(en).toContain('<th>VAT 11%</th>');
    expect(en).not.toContain('Rp 1.250.000');
    expect(renderReportHtml(assembleReportPayload(PRICED))).toContain('Rp 1.250.000');
  });

  it("'en': tidak memuat teks tetap Indonesia", () => {
    for (const label of [
      'TERVERIFIKASI',
      'ASUMSI',
      'BAGIAN',
      'Halaman',
      'PANDUAN PERENCANAAN',
      'Perkiraan perencanaan',
      'Pelanggan',
      'KEBUTUHAN YANG TERCATAT',
      'HARGA SATUAN',
      'Total estimasi',
      'Diperiksa oleh',
      'DISUSUN UNTUK',
      'Tipe bangunan',
    ]) {
      expect(en).not.toContain(label);
    }
  });

  it("'en': nilai dari pengguna dan rekomendasi tetap di-escape", () => {
    const evil = '<img src=x onerror="a()">&\'';
    const escaped = '&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;';
    const html = renderReportHtml(
      assembleReportPayload({
        ...PRICED,
        locale: 'en',
        reportNumber: evil,
        identity: { ...INPUT.identity, customerName: evil, projectLocation: evil },
        catalogVersionLabel: evil,
        recommendation: {
          ...PRICED.recommendation,
          headline: evil,
          body: evil,
          assumptions: [{ ...RECOMMENDATION.assumptions[0]!, text: evil }],
        },
      }),
    );
    expect(html).not.toContain('<img');
    // nomor ×7 (title, sampul, lima kop bagian), nama ×7 (sampul, lima kop, footer),
    // lokasi (sampul), isi, asumsi. Label katalog tidak dicetak lagi (P17-10).
    expect(html.split(escaped)).toHaveLength(18);
  });
});

describe('versi aturan di laporan (temuan SNTY-2026-10-0002)', () => {
  it('stempel versi aturan tersimpan di payload, tidak dicetak (P17-10); hasil terkini tidak ditandai lama', () => {
    const payload = assembleReportPayload(INPUT);
    expect(payload.ruleset?.stamp).toMatch(/^[0-9a-f]{8}$/);
    expect(payload.ruleset?.outdated).toBe(false);
    const html = renderReportHtml(payload);
    // Label internal tidak dicetak (keputusan pemilik 2026-10-13); pelacakan lewat payload.
    expect(html).not.toContain(payload.ruleset!.stamp);
    expect(html).not.toContain('Versi aturan hitung');
    expect(html).not.toContain('versi aturan lama');
  });

  it('trace dari aturan yang sudah dihapus (ENG-002, ENG-009) → tanda di halaman pertama', () => {
    const oldTraces = [
      ...TRACES,
      { ...TRACES[0]!, id: 'old1', ruleId: 'ENG-002', ruleVersion: 1 },
      { ...TRACES[0]!, id: 'old2', ruleId: 'ENG-009', ruleVersion: 1 },
    ] as typeof TRACES;
    const payload = assembleReportPayload({ ...INPUT, traces: oldTraces });
    expect(payload.ruleset?.outdated).toBe(true);
    expect(renderReportHtml(payload)).toContain('Dihitung dengan versi aturan lama');
  });
});

describe('skema instalasi di laporan', () => {
  const schematic = schematicFor(STATE, 'dev-0.2', T0);
  const withSchematic = renderReportHtml(assembleReportPayload({ ...INPUT, schematic } as never));

  it('dicetak sebagai bagian 2 dengan gambar dan kedua catatan wajib skema', () => {
    const section = withSchematic.slice(
      withSchematic.indexOf('BAGIAN 2'),
      withSchematic.indexOf('BAGIAN 3'),
    );
    expect(section).toContain('Skema Instalasi');
    expect(section).toContain('<svg class="schematic"');
    expect(section).toContain('SKEMATIK · BUKAN GAMBAR KERJA');
    expect(section).toContain(
      'Skema menunjukkan hubungan antar jalur, bukan posisi fisik pipa di bangunan. Panjang jalur dan posisi shaft ditentukan saat pelaksanaan.',
    );
  });

  it('setiap lantai dan titik air dari topologi tergambar, tidak ada yang ditambah', () => {
    for (const floor of schematic.floors) expect(withSchematic).toContain(floor.shortLabel);
    const fixtures = schematic.nodes.filter((node) => node.type === 'fixture');
    for (const node of fixtures) expect(withSchematic).toContain(`>${node.code!}</text>`);
    // Dihitung di bagian skema saja — sprite ilustrasi juga memuat persegi bersudut.
    const section = withSchematic.slice(
      withSchematic.indexOf('<svg class="schematic"'),
      withSchematic.indexOf('<div class="schematic-legend">'),
    );
    expect(section.match(/<rect [^>]*rx="4"/g)).toHaveLength(fixtures.length);
  });

  it('label dari topologi di-escape', () => {
    const evil = {
      ...schematic,
      nodes: schematic.nodes.map((node) =>
        node.type === 'fixture' ? { ...node, label: '<img src=x onerror=a()>' } : node,
      ),
    };
    const html = renderReportHtml(assembleReportPayload({ ...INPUT, schematic: evil } as never));
    expect(html).not.toContain('<img');
  });

  it('tanpa skema (payload lama) tidak ada bagian skema', () => {
    expect(renderReportHtml(assembleReportPayload(INPUT))).not.toContain('Skema Instalasi');
  });
});

describe('fitting tanpa jumlah (temuan laporan 0009)', () => {
  it('fitting diberi "– pcs" dan keterangannya sendiri, bukan kalimat jumlah batang', () => {
    const payload = assembleReportPayload({
      ...INPUT,
      recommendation: {
        ...RECOMMENDATION,
        bom: [],
        products: [
          {
            productId: 'Y4',
            size: '4"',
            role: 'fitting',
            matchState: 'VERIFIED_SELECTED',
            reason: '',
          },
        ],
      },
      productNames: new Map([['Y4', 'Long Y - D 4"']]),
    });
    expect(payload.pendingItems).toEqual([
      { productId: 'Y4', name: 'Long Y - D 4"', size: '4"', kind: 'fitting' },
    ]);
    const html = renderReportHtml(payload);
    // BOQ (DD-01): fitting tanpa jumlah → "Dihitung saat pemasangan", bukan keterangan batang.
    const row = html.slice(
      html.indexOf('Long Y - D 4&quot;') - 400,
      html.indexOf('Long Y - D 4&quot;') + 400,
    );
    expect(row).toContain('Dihitung saat pemasangan');
    expect(row).not.toContain('Menunggu ukuran bangunan');
  });
});

describe('tanpa halaman kosong di akhir PDF (temuan laporan 0009)', () => {
  it('bagian terakhir tidak memaksa pindah halaman; :last-child tidak dipakai karena footer ada di akhir body', () => {
    const html = renderReportHtml(assembleReportPayload(INPUT));
    expect(html).toContain('section.page:last-of-type { page-break-after: auto; }');
    expect(html).not.toContain('.page:last-child');
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
    expect(html.lastIndexOf('<section')).toBeLessThan(html.indexOf('id="snouty-pdf-footer"'));
  });
});

describe('laporan v2 (DD-01, P17-09)', () => {
  const products = [
    {
      productId: 'AW1',
      name: 'Pipa (TS End) Putih AW 1" x 4 Meter',
      size: '1"',
      role: 'main' as const,
      matchState: 'VERIFIED_SELECTED' as const,
      reason: '',
      purpose: 'Pipa utama',
      system: 'clean_water' as const,
      family: 'PVC AW',
      category: 'PIPA PVC AW · TS END',
      alternatives: [{ productId: 'AW1B', name: 'Pipa AW 1" x 6 Meter' }],
    },
  ];
  const payload = assembleReportPayload({
    ...INPUT,
    recommendation: {
      ...RECOMMENDATION,
      products,
      bom: [
        {
          ...RECOMMENDATION.bom[0]!,
          productId: 'AW1',
          system: 'clean_water',
          purpose: 'Pipa utama',
        },
      ],
      needs: [
        {
          kind: 'building',
          count: 2,
          building: { type: 'residential', floors: 2, floorHeightM: 3.5 },
        },
        {
          kind: 'bathroom',
          count: 3,
          perFloor: [
            { floor: 2, count: 2 },
            { floor: 1, count: 1 },
          ],
        },
      ],
    },
  } as never);
  const html = renderReportHtml(payload);

  it('payload membekukan produk (tanpa varian alternatif), kebutuhan, dan jumlah titik air', () => {
    expect(payload.products?.[0]).not.toHaveProperty('alternatives');
    expect(payload.needs).toHaveLength(2);
    expect(payload.outletCount).toBe(RECOMMENDATION.stats.outletCount);
  });

  it('ringkasan bergambar: sprite ilustrasi dan gambar bangunan lebih dulu', () => {
    expect(html).toContain('<symbol id="il-house2"');
    const summary = html.slice(html.indexOf('BAGIAN 1'), html.indexOf('BAGIAN 2'));
    expect(summary.indexOf('r-hero-img')).toBeLessThan(summary.indexOf('lead-value'));
    expect(summary).toContain('Rumah tinggal · 2 lantai · 3,5 m per lantai');
    expect(summary).toContain('Lantai 2: 2 · Lantai 1: 1');
  });

  it('lampiran produk: foto pralon.com sebagai latar CSS — laporan tetap tanpa tag <img>', () => {
    expect(html).toContain('Produk Pralon</h2>');
    expect(html).toContain('BOQ no. 1');
    expect(html).toContain("background-image:url('data:image/jpeg;base64,");
    expect(html).not.toContain('<img');
  });
});

describe('denah di laporan (P17-07)', () => {
  const withBranches = renderReportHtml(
    assembleReportPayload({
      ...INPUT,
      recommendation: {
        ...RECOMMENDATION,
        needs: [
          {
            kind: 'building',
            count: 1,
            building: {
              type: 'residential',
              floors: 1,
              floorHeightM: 3.5,
              mainSize: '3/4"',
              branches: [
                { floor: 1, size: '3/4"', bathrooms: 1, basins: 1, kitchens: 1, urinals: 0 },
              ],
            },
          },
          { kind: 'municipal', count: 1 },
        ],
      },
    } as never),
  );

  it('ada data cabang → halaman Denah Instalasi dengan potongan dan denah lantai', () => {
    const section = withBranches.slice(withBranches.indexOf('Denah Instalasi</h2>'));
    expect(section).toContain('Potongan instalasi');
    expect(section).toContain('Denah jalur per lantai');
    expect(section).toContain('<use href="#il-meter"/>');
  });

  it('tanpa data cabang (rekomendasi lama) tidak ada halaman denah', () => {
    expect(renderReportHtml(assembleReportPayload(INPUT))).not.toContain('Denah Instalasi');
  });
});

describe('tanggal data produk (P17-10)', () => {
  it('dicetak sebagai kalimat biasa, bukan label versi katalog', () => {
    const html = renderReportHtml(
      assembleReportPayload({ ...INPUT, catalogDate: '2026-10-06T00:00:00.000Z' } as never),
    );
    expect(html).toContain('Data produk per 6 Oktober 2026');
    expect(html).not.toContain(INPUT.catalogVersionLabel);
  });

  it('payload lama tanpa tanggal: barisnya tidak dicetak', () => {
    expect(renderReportHtml(assembleReportPayload(INPUT))).not.toContain('Data produk per');
  });
});

describe('kebutuhan tercatat memuat setiap masukan hitungan (review laporan 0015)', () => {
  const withSizes = withCompleteness(
    mergeRequirement(
      STATE,
      [
        {
          path: 'building.dimensions',
          value: { lengthM: 12, widthM: 7, landLengthM: 15, landWidthM: 10 },
          source: 'user_stated',
        },
      ],
      T0,
    ).state,
  );
  const rows = assembleReportPayload({ ...INPUT, state: withSizes }).requirements;

  it('ukuran bangunan dan tanah tampil dengan statusnya', () => {
    const size = rows.find((r) => r.label === 'Ukuran bangunan / tanah');
    expect(size?.value).toContain('tanah 15 × 10 m');
    expect(size?.provenance).toBe('VERIFIED');
  });

  it('kamar mandi ditulis sebagai ruang dengan titik airnya', () => {
    expect(rows.find((r) => r.label === 'Kamar mandi')?.value).toBe(
      '3 ruang (6 titik: shower + kloset)',
    );
  });
});

describe('tata letak cetak (review laporan 0015)', () => {
  it('judul tidak yatim: subjudul menempel isi berikutnya; "Langkah berikutnya" satu blok', () => {
    const html = renderReportHtml(assembleReportPayload(INPUT));
    expect(html).toMatch(/\.subhead \{[^}]*break-after: avoid/);
    expect(html).toMatch(/<div class="keep">\s*<h3 class="subhead">Langkah berikutnya<\/h3>/);
  });
});

describe('sampul laporan — data di luar kewajaran (review putaran 4, 6b)', () => {
  it('asumsi yang perlu diverifikasi tampil sebagai banner di halaman pertama', () => {
    const payload = assembleReportPayload(INPUT);
    const text = 'Data di luar kewajaran, mohon diverifikasi: Bangunan 2 × 2 m 2 lantai.';
    const html = renderReportHtml({
      ...payload,
      assumptions: [
        ...payload.assumptions,
        { text, fieldPath: 'building.dimensions', needsVerification: true },
      ],
    });
    const cover = html.slice(html.indexOf('class="page cover"'), html.indexOf('BAGIAN 1'));
    expect(cover).toContain(`<div class="banner">${text}</div>`);
  });
});
