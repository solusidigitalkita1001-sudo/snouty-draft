/**
 * AnalysisService — menjalankan sisa pipeline setelah data inti lengkap.
 * docs/API_CONTRACTS.md §3 (lima tahap) · docs/CONTEXT_ENGINE.md §3.
 *
 * Empat tahap terakhir dipancarkan di sini, dan masing-masing menandai **batas nyata**:
 * `ANALYZING_INSTALLATION` saat aturan teknik selesai dievaluasi, `MATCHING_PRODUCTS`
 * saat pencocokan katalog selesai, `COMPOSING` saat rekomendasi dirakit dan disimpan,
 * `PREPARING_SCHEMATIC` saat topologi terbentuk. Tidak ada timer — kalau sebuah tahap
 * tidak punya pekerjaan nyata, ia tidak dipancarkan.
 *
 * Katalog adalah sumber kebenaran produk: versi aktif dibaca sekali dan **dibekukan**
 * ke dalam rekomendasi, sehingga promosi katalog setelahnya tidak mengubah arti laporan
 * yang sudah jadi.
 */

import { Inject, Injectable } from '@nestjs/common';
import type { AssistantStreamEvent, Assumption, RequirementState } from '@snouty/shared-types';
import { buildSchematic, computeSolution, type SolutionInput } from '@snouty/engineering';
import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
} from '../../product-catalog/domain/catalog.repository.js';
import { ConversationService } from '../../conversation/application/conversation.service.js';
import { ulid } from '../../../shared/ulid.js';
import { assembleRecommendation, type ProseWriter } from './recommendation-assembler.js';
import { matchProducts, requirementsFrom } from '../domain/product-matcher.js';
import type { IdentifiedTrace } from '../domain/solution-view.js';
import {
  RECOMMENDATION_REPOSITORY,
  type RecommendationRepository,
} from '../domain/recommendation.repository.js';

/**
 * Membentuk topologi skema dari state + hasil engine. Diekspor karena **tidak disimpan**:
 * skema diturunkan deterministik, jadi endpoint skema membentuknya ulang dari snapshot
 * yang tersimpan alih-alih menyalinnya ke basis data. Itu juga yang membuat skenario
 * "bagaimana kalau" hanya perhitungan ulang (docs/SCHEMATIC_ENGINE.md §1, §6).
 */
export function schematicFor(
  state: RequirementState,
  catalogVersionLabel: string,
  now: string,
): ReturnType<typeof buildSchematic> {
  const solution = computeSolution(solutionInputFrom(state));
  return buildSchematic({
    floors: state.building.floors.value ?? 1,
    floorHeightM: solution.floorHeightM,
    floorHeightIsDefault: state.building.floorHeightM.source === 'default_applied',
    waterSource: (state.water.source.value ?? 'rooftop_tank') as 'rooftop_tank',
    branchSize: '3/4"',
    mainSize: solution.mainSize,
    fixtureSize: solution.fixtureConnectionSize,
    floorsPlan: solution.floorsPlan,
    provenance: solution.overallProvenance,
    catalogVersionLabel,
    now,
  });
}

/** Keluarga produk per peran. Nilai sementara sampai katalog nyata ada (OQ-07). */
const PIPE_FAMILY = 'PVC AW';
const FITTING_FAMILY = 'FITTING PVC';

export class CatalogUnavailableError extends Error {
  constructor() {
    super('tidak ada versi katalog aktif');
    this.name = 'CatalogUnavailableError';
  }
}

@Injectable()
export class AnalysisService {
  constructor(
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
    @Inject(RECOMMENDATION_REPOSITORY) private readonly repository: RecommendationRepository,
    private readonly conversations: ConversationService,
    private readonly prose: ProseWriter | null = null,
  ) {}

  /**
   * Topologi skema untuk sebuah rekomendasi. Label versi katalog **dicari**, bukan
   * memakai id-nya: blok judul gambar berbunyi "KATALOG v2.4" (docs/SCHEMATIC_ENGINE.md
   * §2), dan ULID di tempat itu tidak berarti apa pun bagi orang yang membaca gambarnya.
   */
  async schematicForRecommendation(
    state: RequirementState,
    catalogVersionId: string,
    now: string,
  ): Promise<ReturnType<typeof buildSchematic>> {
    const version = await this.catalog.findVersionById(catalogVersionId);
    return schematicFor(state, version?.label ?? 'TIDAK DIKETAHUI', now);
  }

  /**
   * Menjalankan analisis dan mengembalikan event untuk dialirkan. Melempar
   * `CatalogUnavailableError` bila tidak ada katalog aktif — pemanggil menerjemahkannya
   * menjadi `error CATALOG_UNAVAILABLE` yang retryable, bukan menyembunyikan kegagalan.
   */
  async run(
    conversationId: string,
    snapshotId: string,
    state: RequirementState,
    requirementAssumptions: readonly Assumption[],
    now: string,
  ): Promise<readonly AssistantStreamEvent[]> {
    const events: AssistantStreamEvent[] = [];

    // --- Tahap 2: aturan teknik ---
    events.push({ type: 'stage', stage: 'ANALYZING_INSTALLATION', status: 'active' });
    const solution = computeSolution(solutionInputFrom(state));
    const traces: readonly IdentifiedTrace[] = solution.traces.map((trace) => ({
      ...trace,
      id: ulid(),
    }));
    events.push({
      type: 'stage',
      stage: 'ANALYZING_INSTALLATION',
      status: 'done',
      detail: `RISER + ${state.building.floors.value ?? 1} LANTAI`,
    });

    // --- Tahap 3: pencocokan katalog ---
    events.push({ type: 'stage', stage: 'MATCHING_PRODUCTS', status: 'active' });
    const version = await this.catalog.findActiveVersion();
    if (!version) {
      events.push({ type: 'stage', stage: 'MATCHING_PRODUCTS', status: 'failed' });
      throw new CatalogUnavailableError();
    }

    const page = await this.catalog.listProducts({
      catalogVersionId: version.id,
      limit: 50,
    });
    const match = matchProducts(
      requirementsFrom({
        mainSize: solution.mainSize,
        branchSize: '3/4"',
        fixtureSize: solution.fixtureConnectionSize,
        pipeFamily: PIPE_FAMILY,
        fittingFamily: FITTING_FAMILY,
      }),
      page.items,
    );
    events.push({
      type: 'stage',
      stage: 'MATCHING_PRODUCTS',
      status: 'done',
      detail: `${match.products.length} PRODUK`,
    });

    // --- Tahap 4: perakitan + penyimpanan ---
    events.push({ type: 'stage', stage: 'COMPOSING', status: 'active' });
    const assembled = await assembleRecommendation(
      {
        recommendationId: ulid(),
        conversationId,
        snapshotId,
        catalogVersionId: version.id,
        solution,
        traces,
        products: match.products,
        requirementAssumptions,
        now,
      },
      this.prose,
    );
    await this.repository.save(assembled.recommendation, traces);
    // Status percakapan menyusul solusinya: header layar dan daftar riwayat keduanya
    // membaca kolom ini, jadi membiarkannya `IN_PROGRESS` akan membuat riwayat
    // berbohong tentang konsultasi yang sudah selesai.
    await this.conversations.markSolutionReady(conversationId);
    events.push({ type: 'stage', stage: 'COMPOSING', status: 'done' });

    // --- Tahap 5: topologi skema ---
    // Dibentuk deterministik dari state + hasil engine (Fase 9). Karena sumbernya sama
    // dengan tabel sistem dan BOM, gambar tidak bisa bertentangan dengan keduanya.
    const schematic = schematicFor(state, version.label, now);

    events.push({
      type: 'stage',
      stage: 'PREPARING_SCHEMATIC',
      status: 'done',
      detail: `${schematic.floors.length} LANTAI`,
    });

    events.push({ type: 'solution.ready', recommendationId: assembled.recommendation.id });
    return events;
  }
}

/**
 * Menerjemahkan state kebutuhan ke masukan engine. Nilai yang belum ada diisi default
 * yang **sudah tercatat sebagai asumsi** oleh Context Engine — bukan ditebak di sini.
 */
function solutionInputFrom(state: RequirementState): SolutionInput {
  return {
    buildingType: (state.building.type.value ?? 'residential') as SolutionInput['buildingType'],
    floors: state.building.floors.value ?? 1,
    bathrooms: state.fixtures.bathrooms.value ?? 0,
    basins: state.fixtures.basins.value ?? 0,
    kitchens: state.fixtures.kitchens.value ?? 0,
    waterSource: (state.water.source.value ?? 'rooftop_tank') as SolutionInput['waterSource'],
    installationType: (state.water.installationType.value ??
      'clean_water') as SolutionInput['installationType'],
    floorHeightM: state.building.floorHeightM.value,
    mainRunMeters: state.building.dimensions.value?.mainRunMeters ?? null,
  };
}
