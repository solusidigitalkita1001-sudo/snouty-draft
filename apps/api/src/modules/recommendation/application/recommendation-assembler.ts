/**
 * Merakit `Recommendation` dari hasil engine, katalog, dan prosa LLM.
 * docs/DOMAIN_MODEL.md §7 · docs/API_CONTRACTS.md §3.
 *
 * Urutannya adalah inti dari seluruh janji produk: **hitung dulu, baru jelaskan.**
 * Engine menghasilkan angka, katalog menyediakan produk, dan baru setelah keduanya
 * selesai LLM menulis prosa — yang kemudian **diperiksa** terhadap angka itu (REC-1).
 * Prosa yang memuat angka asing dibuang, diminta ulang sekali, lalu diganti templat
 * deterministik. Dengan begitu jalur terburuknya tetap jujur, bukan gagal.
 */

import type { Locale } from '@snouty/shared-types';
import {
  boqFrom,
  type Assumption,
  type Recommendation,
  type SelectedProduct,
  type SystemLine,
} from '@snouty/shared-types';
import type { SolutionResult } from '@snouty/engineering';
import { checkProse } from '../domain/prose-check.js';
import type { StockLength } from '../domain/pipe-quantity.js';
import type { ProseSource } from '../domain/recommendation.repository.js';
import {
  allowedNumbersFrom,
  allowedSizesFrom,
  assumptionsFrom,
  bomItemsFrom,
  statsFrom,
  systemLinesFrom,
  type HouseStocks,
  type IdentifiedTrace,
} from '../domain/solution-view.js';

/** Penulis prosa — port sempit supaya perakitan bisa diuji tanpa LLM. */
export interface ProseWriter {
  write(input: {
    readonly stats: ReturnType<typeof statsFrom>;
    readonly systemLines: readonly SystemLine[];
    readonly retryReason?: string;
    /** Bahasa prosa (Fase 15); bawaan Indonesia. */
    readonly locale?: Locale;
  }): Promise<{ readonly headline: string; readonly body: string }>;
}

export interface AssembleInput {
  readonly recommendationId: string;
  readonly conversationId: string;
  readonly snapshotId: string;
  readonly catalogVersionId: string;
  readonly solution: SolutionResult;
  readonly traces: readonly IdentifiedTrace[];
  readonly products: readonly SelectedProduct[];
  readonly requirementAssumptions: readonly Assumption[];
  /** Panjang batang produk pipa utama terpilih — dasar jumlah beli di material. */
  readonly mainStock?: StockLength | null;
  /** Produk cabang, sambungan, dan tee terpilih — dasar jumlah beli jalur lain (P16-60). */
  readonly houseStocks?: HouseStocks;
  /** `now` disuntikkan demi determinisme pengujian. */
  readonly now: string;
  /** Bahasa prosa (Fase 15); templat deterministik masih Indonesia sampai P15-03. */
  readonly locale?: Locale;
  /** Pipa lama diganti ke Pralon (P22-03): judul dan kalimat pembuka menyebutnya. */
  readonly replaceExisting?: boolean;
}

export interface AssembleResult {
  readonly recommendation: Recommendation;
  /** Apakah prosa LLM dipakai, atau templat deterministik yang menggantikannya. */
  readonly proseSource: ProseSource;
}

export async function assembleRecommendation(
  input: AssembleInput,
  prose: ProseWriter | null,
): Promise<AssembleResult> {
  const stats = statsFrom(input.solution, input.products.length);
  const systemLines = systemLinesFrom(input.solution, input.traces, input.locale);
  const bom = bomItemsFrom(
    input.solution,
    input.traces,
    input.locale,
    input.mainStock ?? null,
    input.houseStocks ?? {},
  );
  const assumptions = assumptionsFrom(
    input.solution,
    input.traces,
    input.requirementAssumptions,
    input.locale,
  );

  const allowedNumbers = allowedNumbersFrom(stats, bom, input.solution);
  const allowedSizes = allowedSizesFrom(input.solution, bom);

  const written = await writeProse(prose, {
    stats,
    systemLines,
    allowedNumbers,
    allowedSizes,
    ...(input.locale ? { locale: input.locale } : {}),
    replaceExisting: input.replaceExisting ?? false,
    wudhuTaps: input.solution.wudhu?.taps ?? 0,
  });

  return {
    proseSource: written.source,
    recommendation: {
      id: input.recommendationId,
      conversationId: input.conversationId,
      snapshotId: input.snapshotId,
      catalogVersionId: input.catalogVersionId,
      headline: written.headline,
      body: written.body,
      stats,
      systemLines,
      products: input.products,
      bom,
      assumptions,
      overallProvenance: input.solution.overallProvenance,
      createdAt: input.now,
    },
  };
}

async function writeProse(
  prose: ProseWriter | null,
  context: {
    stats: ReturnType<typeof statsFrom>;
    systemLines: readonly SystemLine[];
    allowedNumbers: readonly number[];
    allowedSizes: readonly string[];
    locale?: Locale;
    replaceExisting?: boolean;
    /** Keran wudhu tempat ibadah: tidak termasuk titik air, tetapi tetap milik pengguna. */
    wudhuTaps?: number;
  },
): Promise<{ headline: string; body: string; source: AssembleResult['proseSource'] }> {
  if (!prose) {
    return {
      ...templateProse(
        context.stats,
        context.locale,
        context.replaceExisting ?? false,
        context.wudhuTaps ?? 0,
      ),
      source: 'template',
    };
  }

  const locale = context.locale ? { locale: context.locale } : {};
  const first = await safeWrite(prose, {
    stats: context.stats,
    systemLines: context.systemLines,
    ...locale,
  });
  if (first) {
    const check = checkProse({
      ...first,
      allowedNumbers: context.allowedNumbers,
      allowedSizes: context.allowedSizes,
    });
    if (check.ok) return { ...first, source: 'llm' };

    // Satu kali minta ulang, dengan alasan penolakan dilampirkan supaya model tahu
    // angka mana yang bermasalah.
    const second = await safeWrite(prose, {
      stats: context.stats,
      systemLines: context.systemLines,
      ...locale,
      retryReason:
        `Angka berikut tidak ada di hasil hitungan: ${check.foreignNumbers.join(', ')} ${check.foreignSizes.join(', ')}`.trim(),
    });
    if (second) {
      const recheck = checkProse({
        ...second,
        allowedNumbers: context.allowedNumbers,
        allowedSizes: context.allowedSizes,
      });
      if (recheck.ok) return { ...second, source: 'llm_retry' };
    }
  }

  // Tidak ada percobaan ketiga. Templat deterministik selalu lulus REC-1 karena ia
  // hanya menyusun ulang angka yang memang dihitung.
  return {
    ...templateProse(
      context.stats,
      context.locale,
      context.replaceExisting ?? false,
      context.wudhuTaps ?? 0,
    ),
    source: 'template',
  };
}

async function safeWrite(
  prose: ProseWriter,
  input: Parameters<ProseWriter['write']>[0],
): Promise<{ headline: string; body: string } | null> {
  try {
    return await prose.write(input);
  } catch {
    // LLM tidak tersedia bukan alasan menggagalkan solusi yang sudah dihitung.
    return null;
  }
}

/**
 * Templat deterministik — jalur terakhir, dan jalur yang dipakai bila LLM tidak
 * dikonfigurasi. Ia tidak pernah melanggar REC-1 karena setiap angka di dalamnya
 * berasal langsung dari `stats`.
 */
export function templateProse(
  stats: ReturnType<typeof statsFrom>,
  locale: Locale = 'id',
  /** Pipa lama diganti ke Pralon (P22-03): jumlahnya sama dengan instalasi baru di jalur yang sama. */
  replaceExisting = false,
  /**
   * Keran wudhu (tempat ibadah): dihitung penuh di debit puncak dan punya pipa deretnya sendiri,
   * tetapi tidak termasuk `outletCount` (ENG-001 menghitung kamar mandi, wastafel, dapur,
   * urinoir). Tanpa disebut, masjid dengan 20 keran wudhu dan 6 toilet berjudul "12 titik air" —
   * angka yang benar untuk toiletnya, tetapi bukan jawaban atas apa yang pengguna sebut
   * (produksi 2026-10-27).
   */
  wudhuTaps = 0,
): {
  headline: string;
  body: string;
} {
  if (locale === 'en') {
    const branches = stats.branchCount === 1 ? '1 branch' : `${stats.branchCount} branches`;
    const taps = wudhuTaps > 0 ? ` and ${wudhuTaps} ablution taps` : '';
    const products =
      stats.productCount === 1 ? '1 Pralon product' : `${stats.productCount} Pralon products`;
    return {
      headline: replaceExisting
        ? `Replacing the pipes with Pralon for ${stats.outletCount} water outlets${taps}`
        : `Distribution system for ${stats.outletCount} water outlets${taps}`,
      body:
        (replaceExisting
          ? 'The existing pipes are replaced along the same runs, so the material list is the same as for a new installation; the old pipes are removed during the work. '
          : '') +
        `Your requirements cover ${stats.outletCount} water outlets served by ${branches}${
          wudhuTaps > 0 ? `, plus ${wudhuTaps} ablution taps on their own row pipe` : ''
        }. ` +
        `The main line uses size ${stats.mainSize}, and each fixture connection uses ${stats.fixtureConnectionSize}. ` +
        `There ${stats.productCount === 1 ? 'is' : 'are'} ${products} suited to this system.`,
    };
  }
  const keran = wudhuTaps > 0 ? ` dan ${wudhuTaps} keran wudhu` : '';
  return {
    headline: replaceExisting
      ? `Penggantian pipa ke Pralon untuk ${stats.outletCount} titik air${keran}`
      : `Sistem distribusi untuk ${stats.outletCount} titik air${keran}`,
    body:
      (replaceExisting
        ? 'Pipa lama diganti pada jalur yang sama, jadi daftar materialnya sama dengan instalasi baru; pipa lama dilepas saat pemasangan. '
        : '') +
      `Kebutuhan Anda mencakup ${stats.outletCount} titik air yang dilayani ${stats.branchCount} cabang${
        wudhuTaps > 0 ? `, ditambah ${wudhuTaps} keran wudhu pada pipa deretnya sendiri` : ''
      }. ` +
      `Jalur utama memakai ukuran ${stats.mainSize}, dan sambungan ke setiap fixture memakai ${stats.fixtureConnectionSize}. ` +
      `Ada ${stats.productCount} produk Pralon yang sesuai untuk sistem ini.`,
  };
}

/**
 * "Ada N produk Pralon" dihitung dari daftar material yang benar-benar tercetak (temuan laporan
 * 0009: tertulis 5, daftarnya 7): baris material ditambah produk terpilih yang belum punya baris
 * jumlah (laporan mencetaknya dengan jumlah "menyusul"). Dipanggil setelah pembuangan digabung dan
 * baris SKU yang sama disatukan; kalimat templat ikut diperbarui.
 */
export function withPrintedMaterialCount(recommendation: Recommendation): Recommendation {
  // "Produk Pralon" = SKU katalog yang punya jumlah di BOQ (TC-H-05, review laporan 0015). Produk
  // yang jumlahnya menyusul tetap di BOQ dan tab Produk, tetapi tidak ikut hitungan ringkasan.
  const count = boqFrom(recommendation).products.filter((p) => p.quantity !== null).length;
  const before = recommendation.stats.productCount;
  if (count === before && count > 0) return recommendation;
  const body =
    count === 0
      ? recommendation.body
          .replace(/ ?Ada \d+ produk Pralon yang sesuai untuk sistem ini\./, '')
          .replace(/ ?There (?:is|are) \d+ Pralon products? suited to this system\./, '')
      : recommendation.body
          .replace(`Ada ${before} produk Pralon`, `Ada ${count} produk Pralon`)
          .replace(
            new RegExp(`There (?:is|are) ${before} Pralon products?`),
            `There ${count === 1 ? 'is' : 'are'} ${count} Pralon product${count === 1 ? '' : 's'}`,
          );
  return { ...recommendation, body, stats: { ...recommendation.stats, productCount: count } };
}
