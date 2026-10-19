/**
 * Kelompok M — renovasi (pemilik 2026-10-19: "snouty bisa mencakup itung-itungan yang sifatnya
 * renov belum? … inget dari semua case"). Berlaku untuk semua kasus: rumah, gedung, jaringan,
 * irigasi, gravitasi. Aturannya tidak mengukur pipa — itu tugas aturan kasusnya — melainkan
 * menjawab tiga hal yang hanya ada pada pekerjaan di instalasi yang sudah terpasang:
 *
 *   ENG-901  pipa lama masih cukup? ukuran lama dibandingkan dengan ukuran yang dibutuhkan beban
 *            total setelah perluasan (diameter luar, bukan label — inci dan mm bisa dibandingkan);
 *   ENG-902  sambungan ke pipa lama: PVC → tee lem; galvanis/besi → potong lalu sok drat di kedua
 *            ujung + tee; HDPE → tee HDPE; PPR → fitting fusi (bukan lini Pralon) → tim teknis;
 *   ENG-903  penggantian sebagian: porsi pipa dari panjang yang diganti terhadap jalur, dan sok
 *            penyambung di kedua ujung segmen;
 *   ENG-904  beban total perluasan = yang sudah ada + yang baru (satu tempat, bertrace).
 *
 * Semua `REQUIRES_DOMAIN_VALIDATION` (OQ-71): cara sambung pipa lama dan jumlah sok adalah praktik
 * lapangan, bukan standar yang dikutip.
 */

import { localized, requireInt, requireNumber, RuleInputError, type RuleVersion } from '../rule.js';
import { round2 } from '../units.js';

const PENDING = 'REQUIRES_DOMAIN_VALIDATION' as const;

// ── ENG-901 · Kapasitas pipa lama terhadap beban total ───────────────────────

export interface ExistingCapacityInput {
  readonly existingSize: string;
  readonly existingOuterMm: number;
  /** Ukuran yang dibutuhkan beban total (lama + baru) menurut aturan kasusnya. */
  readonly requiredSize: string;
  readonly requiredOuterMm: number;
}
export interface ExistingCapacityResult {
  readonly sufficient: boolean;
  /** Selisih diameter luar lama terhadap yang dibutuhkan (%); negatif = pipa lama lebih kecil. */
  readonly marginPct: number;
}

function requireLabel(ruleId: string, field: string, raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new RuleInputError(ruleId, `${field} harus label ukuran, bukan ${String(raw)}`);
  }
  return raw.trim();
}

export const ENG_901: RuleVersion<ExistingCapacityInput, ExistingCapacityResult> = {
  ruleId: 'ENG-901',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      existingSize: requireLabel('ENG-901', 'existingSize', o['existingSize']),
      existingOuterMm: requireNumber('ENG-901', 'existingOuterMm', o['existingOuterMm'], {
        min: 10,
        max: 2000,
      }),
      requiredSize: requireLabel('ENG-901', 'requiredSize', o['requiredSize']),
      requiredOuterMm: requireNumber('ENG-901', 'requiredOuterMm', o['requiredOuterMm'], {
        min: 10,
        max: 2000,
      }),
    };
  },
  compute: (i) => ({
    // Toleransi 1 mm: label yang sama dari dua tabel (inci vs mm) tidak boleh dinyatakan kurang.
    sufficient: i.existingOuterMm + 1 >= i.requiredOuterMm,
    marginPct: round2(((i.existingOuterMm - i.requiredOuterMm) / i.requiredOuterMm) * 100),
  }),
  sourceReference:
    'Pipa lama dipakai bila diameternya ≥ ukuran yang dihitung untuk beban total; dibandingkan lewat diameter luar (PROD/STD-04 untuk PVC inci, ISO 4427 untuk PE mm)',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'pipa lama 3/4" (26,7 mm) untuk beban total yang butuh 1" (33,4 mm) → kurang, −20 %',
      input: {
        existingSize: '3/4"',
        existingOuterMm: 26.7,
        requiredSize: '1"',
        requiredOuterMm: 33.4,
      },
      expected: { sufficient: false, marginPct: -20.06 },
    },
    {
      name: 'pipa induk lama 110 mm untuk beban total yang butuh 90 mm → cukup, +22 %',
      input: {
        existingSize: '110 mm',
        existingOuterMm: 110,
        requiredSize: '90 mm',
        requiredOuterMm: 90,
      },
      expected: { sufficient: true, marginPct: 22.22 },
    },
    {
      name: 'ukuran sama → cukup, 0 %',
      input: {
        existingSize: '1"',
        existingOuterMm: 33.4,
        requiredSize: '1"',
        requiredOuterMm: 33.4,
      },
      expected: { sufficient: true, marginPct: 0 },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id: `Beban total setelah perluasan butuh pipa ${i.requiredSize} (diameter luar ${i.requiredOuterMm} mm); pipa lama ${i.existingSize} berdiameter luar ${i.existingOuterMm} mm, ${o.sufficient ? `jadi masih cukup (${o.marginPct} % lebih besar)` : `jadi kurang (${Math.abs(o.marginPct)} % lebih kecil) dan jalur utamanya ikut diganti ke ${i.requiredSize}`}.`,
      en: `The total load after the extension needs ${i.requiredSize} pipe (outer diameter ${i.requiredOuterMm} mm); the existing ${i.existingSize} pipe has an outer diameter of ${i.existingOuterMm} mm, ${o.sufficient ? `so it is still sufficient (${o.marginPct} % larger)` : `so it falls short (${Math.abs(o.marginPct)} % smaller) and the main run is replaced with ${i.requiredSize} as well`}.`,
    }),
};

// ── ENG-902 · Sambungan ke pipa lama ─────────────────────────────────────────

export type ExistingMaterial = 'PVC' | 'Galvanis / besi' | 'HDPE' | 'PPR' | 'unknown';
export type TieInMethod = 'solvent_tee' | 'threaded_adaptor' | 'hdpe_tee' | 'specialist';
export type TieInFittingKind = 'tee' | 'faucet_socket' | 'reducer';

export interface TieInInput {
  readonly existingMaterial: ExistingMaterial;
  readonly existingSize: string;
  readonly branchSize: string;
}
export interface TieInResult {
  readonly method: TieInMethod;
  readonly fittings: readonly {
    readonly kind: TieInFittingKind;
    readonly size: string;
    readonly branchSize?: string;
    readonly quantity: number;
  }[];
  /** Bahan pipa lama tidak disebut → cara sambungnya harus dipastikan di lapangan. */
  readonly materialAssumed: boolean;
}

const MATERIALS: readonly ExistingMaterial[] = ['PVC', 'Galvanis / besi', 'HDPE', 'PPR', 'unknown'];

export const ENG_902: RuleVersion<TieInInput, TieInResult> = {
  ruleId: 'ENG-902',
  version: 1,
  category: 'material',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const material = o['existingMaterial'];
    if (typeof material !== 'string' || !MATERIALS.includes(material as ExistingMaterial)) {
      throw new RuleInputError('ENG-902', `existingMaterial tidak dikenal: ${String(material)}`);
    }
    return {
      existingMaterial: material as ExistingMaterial,
      existingSize: requireLabel('ENG-902', 'existingSize', o['existingSize']),
      branchSize: requireLabel('ENG-902', 'branchSize', o['branchSize']),
    };
  },
  compute: (i) => {
    const tee = {
      kind: 'tee' as const,
      size: i.existingSize,
      ...(i.branchSize !== i.existingSize ? { branchSize: i.branchSize } : {}),
      quantity: 1,
    };
    switch (i.existingMaterial) {
      case 'Galvanis / besi':
        // Pipa besi dipotong, kedua ujungnya diberi sok drat, lalu tee PVC di antaranya.
        return {
          method: 'threaded_adaptor',
          fittings: [{ kind: 'faucet_socket', size: i.existingSize, quantity: 2 }, tee],
          materialAssumed: false,
        };
      case 'HDPE':
        return { method: 'hdpe_tee', fittings: [tee], materialAssumed: false };
      case 'PPR':
        return { method: 'specialist', fittings: [], materialAssumed: false };
      case 'unknown':
        return { method: 'solvent_tee', fittings: [tee], materialAssumed: true };
      default:
        return { method: 'solvent_tee', fittings: [tee], materialAssumed: false };
    }
  },
  sourceReference:
    'Praktik sambung lapangan: PVC–PVC lem (solvent cement); besi/galvanis–PVC lewat sok drat (faucet socket) di ujung potongan; PE lewat fitting PE; PPR lewat fusi panas (bukan lini Pralon)',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'pipa lama PVC 1" cabang baru 3/4" → tee reduksi 1" × 3/4" dilem',
      input: { existingMaterial: 'PVC', existingSize: '1"', branchSize: '3/4"' },
      expected: {
        method: 'solvent_tee',
        fittings: [{ kind: 'tee', size: '1"', branchSize: '3/4"', quantity: 1 }],
        materialAssumed: false,
      },
    },
    {
      name: 'pipa lama galvanis 3/4" cabang 3/4" → 2 sok drat 3/4" + tee 3/4"',
      input: { existingMaterial: 'Galvanis / besi', existingSize: '3/4"', branchSize: '3/4"' },
      expected: {
        method: 'threaded_adaptor',
        fittings: [
          { kind: 'faucet_socket', size: '3/4"', quantity: 2 },
          { kind: 'tee', size: '3/4"', quantity: 1 },
        ],
        materialAssumed: false,
      },
    },
    {
      name: 'bahan tidak disebut → tee, ditandai perlu dipastikan',
      input: { existingMaterial: 'unknown', existingSize: '110 mm', branchSize: '63 mm' },
      expected: {
        method: 'solvent_tee',
        fittings: [{ kind: 'tee', size: '110 mm', branchSize: '63 mm', quantity: 1 }],
        materialAssumed: true,
      },
    },
    {
      name: 'PPR → fitting fusi, bukan lini Pralon',
      input: { existingMaterial: 'PPR', existingSize: '3/4"', branchSize: '1/2"' },
      expected: { method: 'specialist', fittings: [], materialAssumed: false },
    },
  ],
  explain: (i, o, locale) => {
    const sizes =
      i.branchSize === i.existingSize ? i.existingSize : `${i.existingSize} × ${i.branchSize}`;
    const unknownId = o.materialAssumed
      ? ' Bahan pipa lama belum disebut, jadi cara sambungnya dipastikan di lapangan.'
      : '';
    const unknownEn = o.materialAssumed
      ? ' The existing pipe material was not given, so the joining method is confirmed on site.'
      : '';
    switch (o.method) {
      case 'threaded_adaptor':
        return localized(locale, {
          id: `Pipa lama ${i.existingMaterial} ${i.existingSize} dipotong di titik sambung, kedua ujungnya diberi sok drat ${i.existingSize} (2 pcs), lalu tee ${sizes} dipasang di antaranya.`,
          en: `The existing ${i.existingMaterial} ${i.existingSize} pipe is cut at the tie-in, both ends get a ${i.existingSize} threaded socket (2 pcs), and a ${sizes} tee goes between them.`,
        });
      case 'hdpe_tee':
        return localized(locale, {
          id: `Pipa lama HDPE ${i.existingSize} disambung dengan tee HDPE ${sizes} (sambungan kompresi atau las).`,
          en: `The existing HDPE ${i.existingSize} pipe is joined with an HDPE ${sizes} tee (compression or fusion joint).`,
        });
      case 'specialist':
        return localized(locale, {
          id: `Pipa lama PPR ${i.existingSize} disambung dengan fitting fusi PPR yang bukan lini Pralon; titik sambungnya diteruskan ke tim teknis.`,
          en: `The existing PPR ${i.existingSize} pipe needs PPR fusion fittings outside the Pralon range; the tie-in goes to the technical team.`,
        });
      default:
        return localized(locale, {
          id: `Cabang baru disambung ke pipa lama ${i.existingSize} dengan tee ${sizes} yang dilem.${unknownId}`,
          en: `The new branch joins the existing ${i.existingSize} pipe with a solvent-cemented ${sizes} tee.${unknownEn}`,
        });
    }
  },
};

// ── ENG-903 · Penggantian sebagian ───────────────────────────────────────────

export interface PartialReplacementInput {
  readonly replacementLengthM: number;
  /** Panjang jalur penuh menurut hitungan kasus; `null` = tidak diketahui → seluruh jalur. */
  readonly routeLengthM: number | null;
  readonly couplingsPerSegment: number;
}
export interface PartialReplacementResult {
  /** Porsi pipa jalur yang dibeli (0–1). */
  readonly ratio: number;
  readonly couplings: number;
  readonly lengthM: number;
}

export const ENG_903: RuleVersion<PartialReplacementInput, PartialReplacementResult> = {
  ruleId: 'ENG-903',
  version: 1,
  category: 'geometry',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const route = o['routeLengthM'];
    return {
      replacementLengthM: requireNumber('ENG-903', 'replacementLengthM', o['replacementLengthM'], {
        min: 0.1,
        max: 100_000,
      }),
      routeLengthM:
        route === null || route === undefined
          ? null
          : requireNumber('ENG-903', 'routeLengthM', route, { min: 0.1, max: 100_000 }),
      couplingsPerSegment: requireInt('ENG-903', 'couplingsPerSegment', o['couplingsPerSegment'], {
        min: 0,
        max: 10,
      }),
    };
  },
  compute: (i) => {
    const lengthM =
      i.routeLengthM === null
        ? i.replacementLengthM
        : Math.min(i.replacementLengthM, i.routeLengthM);
    return {
      ratio: i.routeLengthM === null ? 1 : round2(lengthM / i.routeLengthM),
      couplings: i.couplingsPerSegment,
      lengthM: round2(lengthM),
    };
  },
  sourceReference:
    'Segmen yang diganti dipotong di kedua ujung dan disambung kembali ke pipa lama dengan sok; panjang pipa = panjang segmen',
  validationStatus: PENDING,
  testCases: [
    {
      name: '12 m diganti dari jalur 30 m → 40 %, 2 sok',
      input: { replacementLengthM: 12, routeLengthM: 30, couplingsPerSegment: 2 },
      expected: { ratio: 0.4, couplings: 2, lengthM: 12 },
    },
    {
      name: 'panjang jalur tidak diketahui → seluruh panjang yang diganti, rasio 1',
      input: { replacementLengthM: 300, routeLengthM: null, couplingsPerSegment: 2 },
      expected: { ratio: 1, couplings: 2, lengthM: 300 },
    },
    {
      name: 'yang diganti lebih panjang dari jalur → dibatasi panjang jalur',
      input: { replacementLengthM: 50, routeLengthM: 30, couplingsPerSegment: 2 },
      expected: { ratio: 1, couplings: 2, lengthM: 30 },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id: `Hanya ${o.lengthM} m yang diganti${i.routeLengthM !== null ? ` dari jalur ${i.routeLengthM} m (${Math.round(o.ratio * 100)} %)` : ''}; segmen itu dipotong di kedua ujung dan disambung kembali dengan ${o.couplings} sok.`,
      en: `Only ${o.lengthM} m is replaced${i.routeLengthM !== null ? ` out of the ${i.routeLengthM} m run (${Math.round(o.ratio * 100)} %)` : ''}; the segment is cut at both ends and rejoined with ${o.couplings} couplings.`,
    }),
};

// ── ENG-904 · Beban total perluasan ──────────────────────────────────────────

export interface TotalLoadInput {
  readonly existingLoad: number;
  readonly newLoad: number;
  /** Satuan beban: titik air atau sambungan — hanya untuk penjelasan. */
  readonly unit: 'titik' | 'sambungan';
}
export interface TotalLoadResult {
  readonly totalLoad: number;
}

export const ENG_904: RuleVersion<TotalLoadInput, TotalLoadResult> = {
  ruleId: 'ENG-904',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const unit = o['unit'];
    if (unit !== 'titik' && unit !== 'sambungan') {
      throw new RuleInputError('ENG-904', `unit harus titik/sambungan, bukan ${String(unit)}`);
    }
    return {
      existingLoad: requireNumber('ENG-904', 'existingLoad', o['existingLoad'], {
        min: 0,
        max: 1_000_000,
      }),
      newLoad: requireNumber('ENG-904', 'newLoad', o['newLoad'], { min: 0, max: 1_000_000 }),
      unit,
    };
  },
  compute: (i) => ({ totalLoad: round2(i.existingLoad + i.newLoad) }),
  sourceReference: 'Pipa lama memikul beban lama dan baru sekaligus setelah perluasan',
  validationStatus: PENDING,
  testCases: [
    {
      name: '4 titik lama + 2 titik baru → 6 titik',
      input: { existingLoad: 4, newLoad: 2, unit: 'titik' },
      expected: { totalLoad: 6 },
    },
    {
      name: '300 SR lama + 200 SR baru → 500 SR',
      input: { existingLoad: 300, newLoad: 200, unit: 'sambungan' },
      expected: { totalLoad: 500 },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id: `Setelah perluasan pipa lama memikul ${i.existingLoad} ${i.unit === 'titik' ? 'titik air' : 'sambungan'} yang sudah ada ditambah ${i.newLoad} yang baru = ${o.totalLoad}.`,
      en: `After the extension the existing pipe carries the ${i.existingLoad} existing ${i.unit === 'titik' ? 'water points' : 'connections'} plus the ${i.newLoad} new ones = ${o.totalLoad}.`,
    }),
};

export const GROUP_M = [ENG_901, ENG_902, ENG_903, ENG_904] as const;
