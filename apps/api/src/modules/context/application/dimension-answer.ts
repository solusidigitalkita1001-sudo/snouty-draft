/**
 * "Tebal pipa HDPE 110 SDR 17 berapa?" — tebal dinding, diameter dalam, dan berat per meter dari
 * tabel standar Pralon (P21-08). Nol LLM: angkanya dari dokumen, kalimatnya dari kode, dan
 * dokumennya disebut. Kelas tanpa tabel resmi (PRALON AW/D/C, OQ-64) diakui tidak ada angkanya.
 */

import type { AssistantCard, Locale } from '@snouty/shared-types';
import {
  classFilterFrom,
  meanInnerMm,
  rowsFor,
  withoutClassTokens,
  type StandardRow,
  type StandardSeries,
} from '../../product-knowledge/domain/pipe-standards.js';
import { parseSize } from '../domain/size-parser.js';

export interface DimensionOutcome {
  readonly text: string;
  readonly cards: readonly AssistantCard[];
}

/** Lebih dari ini baris, daftar terlalu panjang untuk chat — minta kelasnya. */
const MAX_LISTED = 9;

const SERIES_NAME: Readonly<Record<StandardSeries, { id: string; en: string }>> = {
  pe100: { id: 'pipa HDPE PE100', en: 'PE100 HDPE pipe' },
  jis_vp: { id: 'pipa uPVC JIS VP', en: 'JIS VP uPVC pipe' },
  jis_vu: { id: 'pipa uPVC JIS VU', en: 'JIS VU uPVC pipe' },
  sni_s: { id: 'pipa uPVC SNI kelas S', en: 'SNI class S uPVC pipe' },
  sni_ab: { id: 'pipa uPVC SNI Kelas A/B', en: 'SNI class A/B uPVC pipe' },
};

export function dimensionAnswer(
  message: string,
  families: readonly string[],
  rows: readonly StandardRow[],
  locale: Locale,
): DimensionOutcome {
  const en = locale === 'en';
  const n = (x: number, digits = 1) =>
    x.toLocaleString(en ? 'en-US' : 'id-ID', { maximumFractionDigits: digits });
  const filter = classFilterFrom(message, families, rows);
  const size = parseSize(withoutClassTokens(message));
  const contact: AssistantCard[] = [{ kind: 'cta', action: 'CONTACT_TECHNICAL' }];

  if (filter.pralonClass !== undefined) {
    return {
      text: en
        ? `I don't have the official wall-thickness table for Pralon class ${filter.pralonClass} pipe yet, so I won't quote a figure. The Pralon technical team can give you the exact numbers.`
        : `Tabel tebal dinding resmi pipa PRALON kelas ${filter.pralonClass} belum saya pegang, jadi angkanya tidak saya sebutkan. Tim teknis Pralon bisa memberikan angka pastinya.`,
      cards: contact,
    };
  }

  const matches = rowsFor(rows, filter, size);
  const seriesOf = [...new Set(matches.map((r) => r.series))];
  const name = (s: StandardSeries) => (en ? SERIES_NAME[s].en : SERIES_NAME[s].id);
  const cite = (list: readonly StandardRow[]) => {
    const docs = [...new Set(list.map((r) => r.document))].join(', ');
    return en ? `Per Pralon standard ${docs}.` : `Mengacu standar Pralon ${docs}.`;
  };

  if (rows.length === 0 || (matches.length === 0 && filter.series === undefined)) {
    return {
      text: en
        ? 'Tell me the pipe type, size and class (for example HDPE 110 mm SDR 17, or VP 1/2") and I will give you the wall thickness and weight.'
        : 'Sebutkan jenis pipa, ukuran, dan kelasnya (misalnya HDPE 110 mm SDR 17, atau VP 1/2") — nanti saya berikan tebal dinding dan beratnya.',
      cards: [],
    };
  }

  if (matches.length === 0) {
    const inSeries = rowsFor(rows, { series: filter.series! }, null);
    const classSizes = filter.classLabel
      ? inSeries.filter((r) => r.classLabel === filter.classLabel)
      : inSeries;
    const label = `${name(filter.series!)}${filter.classLabel ? ` ${filter.classLabel}` : ''}`;
    const range =
      classSizes.length > 0
        ? `${classSizes[0]!.size}–${classSizes.at(-1)!.size}`
        : [...new Set(inSeries.map((r) => r.classLabel))].join(', ');
    return {
      text: en
        ? `${label}${size ? ` is not made in ${size}` : ' is not in the Pralon standard'}; it is available in ${range}.`
        : `${capital(label)}${size ? ` tidak dibuat dalam ukuran ${size}` : ' tidak ada di standar Pralon'}; yang tersedia ${range}.`,
      cards: [],
    };
  }

  // Ukuran sama ada di beberapa jenis pipa ("110 mm" — HDPE, SNI S, SNI A/B): tanya jenisnya.
  if (seriesOf.length > 1) {
    const kinds = seriesOf.map(name).join(', ');
    return {
      text: en
        ? `${size ?? 'That size'} comes in several pipe types: ${kinds}. Which one do you mean?`
        : `Ukuran ${size ?? 'itu'} ada di beberapa jenis pipa: ${kinds}. Yang mana yang dimaksud?`,
      cards: [],
    };
  }

  const series = seriesOf[0]!;
  const cls = (r: StandardRow) => `${r.classLabel}${r.pressure ? ` (${r.pressure})` : ''}`;
  const figures = (r: StandardRow) => {
    const weight =
      r.kgPerM === null ? '' : en ? `, ${n(r.kgPerM, 3)} kg/m` : `, berat ${n(r.kgPerM, 3)} kg/m`;
    return en
      ? `wall ${n(r.wallMm)} mm (+${n(r.wallToleranceMm)} mm), inside diameter about ${n(meanInnerMm(r))} mm${weight}`
      : `tebal dinding ${n(r.wallMm)} mm (+${n(r.wallToleranceMm)} mm), diameter dalam ±${n(meanInnerMm(r))} mm${weight}`;
  };

  if (size === null) {
    const classes = [...new Set(matches.map((r) => r.classLabel))];
    const sizes = matches.filter((r) => r.classLabel === classes[0]);
    return {
      text: en
        ? `Which size? ${capital(name(series))}${filter.classLabel ? ` ${filter.classLabel}` : ''} comes in ${sizes[0]!.size}–${sizes.at(-1)!.size}.`
        : `Ukuran berapa? ${capital(name(series))}${filter.classLabel ? ` ${filter.classLabel}` : ''} tersedia ${sizes[0]!.size}–${sizes.at(-1)!.size}.`,
      cards: [],
    };
  }

  if (matches.length === 1) {
    const r = matches[0]!;
    return {
      // VP/VU: kelasnya sudah nama jenisnya — tidak diulang.
      text: `${capital(name(series))} ${r.size}${series.startsWith('jis') ? '' : ` ${cls(r)}`}: ${figures(r)}. ${cite(matches)}`,
      cards: [],
    };
  }

  if (matches.length > MAX_LISTED) {
    const classes = matches.map((r) => r.classLabel).join(', ');
    return {
      text: en
        ? `${capital(name(series))} ${size} comes in ${classes}. Which class?`
        : `${capital(name(series))} ${size} ada dalam kelas ${classes}. Kelas yang mana?`,
      cards: [],
    };
  }

  return {
    text: `${capital(name(series))} ${size}:\n\n${matches.map((r) => `- **${cls(r)}**: ${figures(r)}`).join('\n')}\n\n${cite(matches)}`,
    cards: [],
  };
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
