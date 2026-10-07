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
import type { Assumption, Recommendation, SelectedProduct, SystemLine } from '@snouty/shared-types';
import type { SolutionResult } from '@snouty/engineering';
import { checkProse } from '../domain/prose-check.js';
import type { ProseSource } from '../domain/recommendation.repository.js';
import {
  allowedNumbersFrom,
  allowedSizesFrom,
  assumptionsFrom,
  bomItemsFrom,
  statsFrom,
  systemLinesFrom,
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
  /** `now` disuntikkan demi determinisme pengujian. */
  readonly now: string;
  /** Bahasa prosa (Fase 15); templat deterministik masih Indonesia sampai P15-03. */
  readonly locale?: Locale;
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
  const systemLines = systemLinesFrom(input.solution, input.traces);
  const bom = bomItemsFrom(input.solution, input.traces);
  const assumptions = assumptionsFrom(input.solution, input.traces, input.requirementAssumptions);

  const allowedNumbers = allowedNumbersFrom(stats, bom, input.solution);
  const allowedSizes = allowedSizesFrom(input.solution, bom);

  const written = await writeProse(prose, {
    stats,
    systemLines,
    allowedNumbers,
    allowedSizes,
    ...(input.locale ? { locale: input.locale } : {}),
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
  },
): Promise<{ headline: string; body: string; source: AssembleResult['proseSource'] }> {
  if (!prose) {
    return { ...templateProse(context.stats), source: 'template' };
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
  return { ...templateProse(context.stats), source: 'template' };
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
export function templateProse(stats: ReturnType<typeof statsFrom>): {
  headline: string;
  body: string;
} {
  return {
    headline: `Sistem distribusi untuk ${stats.outletCount} titik air`,
    body:
      `Kebutuhan Anda mencakup ${stats.outletCount} titik air yang dilayani ${stats.branchCount} cabang. ` +
      `Jalur utama memakai ukuran ${stats.mainSize}, dan sambungan ke setiap fixture memakai ${stats.fixtureConnectionSize}. ` +
      `Ada ${stats.productCount} produk Pralon yang sesuai untuk sistem ini.`,
  };
}
