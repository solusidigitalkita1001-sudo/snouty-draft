/**
 * Kelompok L — tempat ibadah (masjid, musala). Laporan pemilik 2026-10-12: "sistem masih nganggep
 * kran itu wastafel, pdhl masjid … biasanya ada bbrp kran yang berjejer dan cuma ada 1 pembuangan".
 *
 *   ENG-801  kebutuhan puncak: toilet umum lewat kurva Hunter (WSFU pemakaian umum) DITAMBAH keran
 *            wudhu sebagai aliran serentak — menjelang salat semua keran dibuka bersamaan, sehingga
 *            faktor keserentakan Hunter tidak berlaku untuknya;
 *   ENG-802  deret wudhu: keran dibagi rata ke tiap tempat wudhu; debit tiap deret untuk pipa
 *            pembagi di sepanjang deret;
 *   ENG-803  talang wudhu: satu pembuangan per deret, aliran kontinu → 2 DFU per gpm (IPC 709.3),
 *            ukuran dari tabel cabang mendatar IPC 710.1(2).
 *
 * Semua `REQUIRES_DOMAIN_VALIDATION`: debit keran wudhu adalah keputusan pemilik (OQ-61), bukan
 * standar.
 */

import { localized, requireInt, requireNumber, RuleInputError, type RuleVersion } from '../rule.js';
import { round1, round3 } from '../units.js';
import { branchSizeForDfu, type DrainSize } from './group-j-waste.js';
import { HUNTER_TABLE_MAX_WSFU, hunterGpm } from './group-k-house-supply.js';

const PENDING = 'REQUIRES_DOMAIN_VALIDATION' as const;
const GPM_TO_LS = 0.0630902;

// ── ENG-801 · Kebutuhan puncak tempat ibadah ────────────────────────────────

export interface WorshipDemandInput {
  readonly waterClosets: number;
  /** Keran di kamar mandi (satu per kamar mandi). */
  readonly bathroomTaps: number;
  readonly lavatories: number;
  readonly kitchenSinks: number;
  readonly urinals: number;
  readonly wudhuTaps: number;
  readonly wsfuWaterCloset: number;
  readonly wsfuTap: number;
  readonly wsfuUrinal: number;
  readonly wsfuKitchenSink: number;
  readonly wudhuTapFlowLs: number;
}
export interface WorshipDemandResult {
  readonly wsfu: number;
  /** Debit toilet dan wastafel dari kurva Hunter. */
  readonly fixtureFlowLs: number;
  /** Keran wudhu, semua serentak. */
  readonly wudhuFlowLs: number;
  readonly peakFlowLs: number;
}

/** Beban alat toilet umum (WSFU) — satu aritmetika untuk aturannya dan untuk pemeriksa cakupan. */
export function publicSupplyWsfu(i: WorshipDemandInput): number {
  return (
    i.waterClosets * i.wsfuWaterCloset +
    (i.bathroomTaps + i.lavatories) * i.wsfuTap +
    i.urinals * i.wsfuUrinal +
    i.kitchenSinks * i.wsfuKitchenSink
  );
}

export const ENG_801: RuleVersion<WorshipDemandInput, WorshipDemandResult> = {
  ruleId: 'ENG-801',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const count = (f: string) => requireInt('ENG-801', f, o[f], { min: 0, max: 500 });
    const unit = (f: string) => requireNumber('ENG-801', f, o[f], { min: 0, max: 10 });
    return {
      waterClosets: count('waterClosets'),
      bathroomTaps: count('bathroomTaps'),
      lavatories: count('lavatories'),
      kitchenSinks: count('kitchenSinks'),
      urinals: count('urinals'),
      wudhuTaps: count('wudhuTaps'),
      wsfuWaterCloset: unit('wsfuWaterCloset'),
      wsfuTap: unit('wsfuTap'),
      wsfuUrinal: unit('wsfuUrinal'),
      wsfuKitchenSink: unit('wsfuKitchenSink'),
      wudhuTapFlowLs: requireNumber('ENG-801', 'wudhuTapFlowLs', o['wudhuTapFlowLs'], {
        min: 0.01,
        max: 1,
      }),
    };
  },
  compute: (i) => {
    const wsfu = publicSupplyWsfu(i);
    if (wsfu > HUNTER_TABLE_MAX_WSFU) {
      throw new RuleInputError('ENG-801', `wsfu ${round1(wsfu)} > ${HUNTER_TABLE_MAX_WSFU}`);
    }
    const fixtureFlowLs = round3(hunterGpm(wsfu) * GPM_TO_LS);
    const wudhuFlowLs = round3(i.wudhuTaps * i.wudhuTapFlowLs);
    return {
      wsfu: round1(wsfu),
      fixtureFlowLs,
      wudhuFlowLs,
      peakFlowLs: round3(fixtureFlowLs + wudhuFlowLs),
    };
  },
  sourceReference:
    'UPC Tabel A 103.1: kloset tangki 2,5 pemakaian umum dan 3,5 kolom pertemuan, lavatory 1,0 (keran kamar mandi disetarakan), urinoir tangki 2,0 umum dan 3,0 pertemuan; debit puncak dari kurva Hunter kloset tangki IPC Tabel E103.3(3); keran wudhu 0,1 l/s per keran, semua serentak (keputusan pemilik 2026-10-12, OQ-61)',
  standard: 'UPC Table A 103.1; IPC Appendix E, Table E103.3(3)',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'masjid: 4 KM (kloset + keran), 8 keran wudhu → 26 WSFU (1,512 l/s) + 0,8 l/s',
      input: {
        waterClosets: 4,
        bathroomTaps: 4,
        lavatories: 0,
        kitchenSinks: 0,
        urinals: 0,
        wudhuTaps: 8,
        wsfuWaterCloset: 5,
        wsfuTap: 1.5,
        wsfuUrinal: 3,
        wsfuKitchenSink: 1,
        wudhuTapFlowLs: 0.1,
      },
      expected: { wsfu: 26, fixtureFlowLs: 1.379, wudhuFlowLs: 0.8, peakFlowLs: 2.179 },
    },
    {
      name: 'masjid + 3 urinoir → 26 + 9 = 35 WSFU (24,9 gpm = 1,571 l/s) + 0,8 l/s',
      input: {
        waterClosets: 4,
        bathroomTaps: 4,
        lavatories: 0,
        kitchenSinks: 0,
        urinals: 3,
        wudhuTaps: 8,
        wsfuWaterCloset: 5,
        wsfuTap: 1.5,
        wsfuKitchenSink: 1,
        wsfuUrinal: 3,
        wudhuTapFlowLs: 0.1,
      },
      expected: { wsfu: 35, fixtureFlowLs: 1.571, wudhuFlowLs: 0.8, peakFlowLs: 2.371 },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id:
        `Toilet umum ${i.waterClosets} kloset × ${i.wsfuWaterCloset} + ${i.bathroomTaps + i.lavatories} ${i.lavatories > 0 ? 'keran/wastafel' : 'keran'} × ${i.wsfuTap}` +
        (i.urinals > 0 ? ` + ${i.urinals} urinoir × ${i.wsfuUrinal}` : '') +
        (i.kitchenSinks > 0 ? ` + ${i.kitchenSinks} dapur × ${i.wsfuKitchenSink}` : '') +
        ` = ${o.wsfu} unit, menurut kurva Hunter ${o.fixtureFlowLs} l/s. ` +
        (i.wudhuTaps > 0
          ? `Keran wudhu dibuka bersamaan menjelang salat, jadi dihitung penuh: ${i.wudhuTaps} × ${i.wudhuTapFlowLs} l/s = ${o.wudhuFlowLs} l/s. `
          : '') +
        `Debit puncak ${o.peakFlowLs} l/s.`,
      en:
        `Public restroom ${i.waterClosets} toilets × ${i.wsfuWaterCloset} + ${i.bathroomTaps + i.lavatories} ${i.lavatories > 0 ? 'taps/basins' : 'taps'} × ${i.wsfuTap}` +
        (i.urinals > 0 ? ` + ${i.urinals} urinals × ${i.wsfuUrinal}` : '') +
        (i.kitchenSinks > 0 ? ` + ${i.kitchenSinks} kitchens × ${i.wsfuKitchenSink}` : '') +
        ` = ${o.wsfu} units, ${o.fixtureFlowLs} l/s on the Hunter curve. ` +
        (i.wudhuTaps > 0
          ? `Ablution taps all run together before prayer, so they count in full: ${i.wudhuTaps} × ${i.wudhuTapFlowLs} l/s = ${o.wudhuFlowLs} l/s. `
          : '') +
        `Peak flow ${o.peakFlowLs} l/s.`,
    }),
};

// ── ENG-802 · Deret keran wudhu ─────────────────────────────────────────────

export interface WudhuRowsInput {
  readonly wudhuTaps: number;
  readonly areas: number;
  readonly wudhuTapFlowLs: number;
  /** Jarak antar keran (WUDHU_TAP_SPACING_0_8M) — panjang pipa pembagi dan talang tiap deret. */
  readonly tapSpacingM: number;
}
export interface WudhuRow {
  readonly taps: number;
  readonly flowLs: number;
  /** Panjang deret = jumlah keran × jarak antar keran. */
  readonly lengthM: number;
}
export interface WudhuRowsResult {
  readonly rows: readonly WudhuRow[];
}

export const ENG_802: RuleVersion<WudhuRowsInput, WudhuRowsResult> = {
  ruleId: 'ENG-802',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const wudhuTaps = requireInt('ENG-802', 'wudhuTaps', o['wudhuTaps'], { min: 1, max: 500 });
    const areas = requireInt('ENG-802', 'areas', o['areas'], { min: 1, max: 50 });
    if (areas > wudhuTaps) throw new RuleInputError('ENG-802', 'areas > wudhuTaps');
    return {
      wudhuTaps,
      areas,
      wudhuTapFlowLs: requireNumber('ENG-802', 'wudhuTapFlowLs', o['wudhuTapFlowLs'], {
        min: 0.01,
        max: 1,
      }),
      tapSpacingM: requireNumber('ENG-802', 'tapSpacingM', o['tapSpacingM'], { min: 0.3, max: 3 }),
    };
  },
  compute: (i) => {
    // Dibagi rata; sisa pembagian ke deret pertama — deret terpanjang yang menentukan ukuran.
    const base = Math.floor(i.wudhuTaps / i.areas);
    const extra = i.wudhuTaps % i.areas;
    return {
      rows: Array.from({ length: i.areas }, (_, k) => {
        const taps = base + (k < extra ? 1 : 0);
        return {
          taps,
          flowLs: round3(taps * i.wudhuTapFlowLs),
          lengthM: round1(taps * i.tapSpacingM),
        };
      }),
    };
  },
  sourceReference:
    'Keran wudhu dibagi rata ke tiap tempat wudhu (satu deret per tempat); debit deret = jumlah keran × debit per keran, semua serentak; panjang deret = jumlah keran × jarak antar keran',
  validationStatus: PENDING,
  testCases: [
    {
      name: '8 keran di 2 tempat wudhu → 2 deret × 4 keran, 0,4 l/s',
      input: { wudhuTaps: 8, areas: 2, wudhuTapFlowLs: 0.1, tapSpacingM: 0.8 },
      expected: {
        rows: [
          { taps: 4, flowLs: 0.4, lengthM: 3.2 },
          { taps: 4, flowLs: 0.4, lengthM: 3.2 },
        ],
      },
    },
    {
      name: '7 keran di 2 tempat → 4 dan 3',
      input: { wudhuTaps: 7, areas: 2, wudhuTapFlowLs: 0.1, tapSpacingM: 0.8 },
      expected: {
        rows: [
          { taps: 4, flowLs: 0.4, lengthM: 3.2 },
          { taps: 3, flowLs: 0.3, lengthM: 2.4 },
        ],
      },
    },
  ],
  explain: (i, o, locale) => {
    const list = o.rows.map((r) => r.taps).join(' + ');
    return localized(locale, {
      id: `${i.wudhuTaps} keran wudhu di ${i.areas} tempat wudhu, berjejer per deret (${list} keran, jarak ${String(i.tapSpacingM).replace('.', ',')} m); tiap deret ${o.rows.map((r) => String(r.flowLs).replace('.', ',')).join(' / ')} l/s.`,
      en: `${i.wudhuTaps} ablution taps in ${i.areas} ablution areas, in a row each (${list} taps, ${i.tapSpacingM} m apart); each row ${o.rows.map((r) => r.flowLs).join(' / ')} l/s.`,
    });
  },
};

// ── ENG-803 · Talang wudhu ──────────────────────────────────────────────────

export interface WudhuDrainInput {
  /** Debit tiap deret (l/s). */
  readonly rowFlowsLs: readonly number[];
  readonly dfuPerGpm: number;
}
export interface WudhuDrainRow {
  readonly gpm: number;
  readonly dfu: number;
  readonly size: DrainSize;
}
export interface WudhuDrainResult {
  readonly rows: readonly WudhuDrainRow[];
  readonly totalDfu: number;
}

export const ENG_803: RuleVersion<WudhuDrainInput, WudhuDrainResult> = {
  ruleId: 'ENG-803',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const rows = o['rowFlowsLs'];
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 50) {
      throw new RuleInputError('ENG-803', 'rowFlowsLs');
    }
    return {
      rowFlowsLs: rows.map((v, k) =>
        requireNumber('ENG-803', `rowFlowsLs[${k}]`, v, { min: 0.01, max: 20 }),
      ),
      dfuPerGpm: requireNumber('ENG-803', 'dfuPerGpm', o['dfuPerGpm'], { min: 0.5, max: 10 }),
    };
  },
  compute: (i) => {
    const rows = i.rowFlowsLs.map((ls) => {
      const gpm = round1(ls / GPM_TO_LS);
      const dfu = Math.ceil(gpm * i.dfuPerGpm);
      return { gpm, dfu, size: branchSizeForDfu(dfu) };
    });
    return { rows, totalDfu: rows.reduce((sum, r) => sum + r.dfu, 0) };
  },
  sourceReference:
    'IPC 709.3: aliran kontinu = 2 DFU per gpm; talang tiap deret sebagai cabang mendatar, IPC 2021 Tabel 710.1(2): 1½" 3, 2" 6, 2½" 12, 3" 20, 4" 160 DFU',
  standard: 'IPC 709.3, IPC 2021 Table 710.1(2)',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'deret 4 keran (0,4 l/s = 6,3 gpm) → 13 DFU → 3"',
      input: { rowFlowsLs: [0.4], dfuPerGpm: 2 },
      expected: { rows: [{ gpm: 6.3, dfu: 13, size: '3"' }], totalDfu: 13 },
    },
    {
      name: 'deret 1 keran (0,1 l/s = 1,6 gpm) → 4 DFU → 2"',
      input: { rowFlowsLs: [0.1], dfuPerGpm: 2 },
      expected: { rows: [{ gpm: 1.6, dfu: 4, size: '2"' }], totalDfu: 4 },
    },
  ],
  explain: (i, o, locale) => {
    const parts = (en: boolean) =>
      o.rows
        .map((r) =>
          en
            ? `${r.gpm} gpm × ${i.dfuPerGpm} = ${r.dfu} DFU → ${r.size}`
            : `${String(r.gpm).replace('.', ',')} gpm × ${i.dfuPerGpm} = ${r.dfu} beban → ${r.size}`,
        )
        .join('; ');
    return localized(locale, {
      id: `Tiap deret wudhu punya satu talang pembuangan. Airnya mengalir terus selama wudhu, jadi tiap galon per menit dihitung ${i.dfuPerGpm} beban: ${parts(false)} (IPC 710.1(2)). Semua talang masuk ke jalur air bekas.`,
      en: `Each ablution row has one trough drain. Water flows continuously during ablution, so each gallon per minute counts ${i.dfuPerGpm} units: ${parts(true)} (IPC 710.1(2)). All troughs join the waste line.`,
    });
  },
};

export const GROUP_L = [ENG_801, ENG_802, ENG_803] as const;
