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
import type {
  AssistantStreamEvent,
  Assumption,
  Recommendation,
  RequirementState,
} from '@snouty/shared-types';
import { PipeSize, type Product } from '@snouty/shared-types';
import {
  buildSchematic,
  computeIrrigation,
  computeGravity,
  computeNetwork,
  computePond,
  computePressurized,
  computeSolution,
  HDPE_FROM_METERS,
  type NetworkInput,
  type PondInput,
  type SolutionInput,
} from '@snouty/engineering';
import {
  appliedAssumptionsToView,
  engineeringStateFrom,
  irrigationFieldFor,
} from '../domain/engineering-state.js';
import { irrigationInputFrom } from '../domain/irrigation-input.js';
import {
  gravityAssumptionsFrom,
  gravityBomItemsFrom,
  gravityHighlights,
  gravityLegacyStats,
  gravityPlanFrom,
  gravityProse,
  gravitySystemLinesFrom,
  networkHighlightsPrefix,
  networkInputFrom,
  type GravityPlan,
} from '../domain/gravity-view.js';
import {
  pressurizedAssumptionsFrom,
  pressurizedBomItemsFrom,
  pressurizedHighlights,
  pressurizedLegacyStats,
  pressurizedPlanFrom,
  pressurizedProse,
  pressurizedSystemLinesFrom,
  type PressurizedPlan,
} from '../domain/pressurized-view.js';
import {
  pondAssumptionsFrom,
  pondBomItemsFrom,
  pondHighlights,
  pondInputFrom,
  pondLegacyStats,
  pondProse,
  pondSystemLinesFrom,
} from '../domain/pond-view.js';
import {
  irrigationAssumptionsFrom,
  irrigationBomItemsFrom,
  irrigationProse,
  irrigationStatsFrom,
  irrigationSystemLinesFrom,
  legacyStatsFrom,
} from '../domain/irrigation-view.js';
import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
} from '../../product-catalog/domain/catalog.repository.js';
import { ConversationService } from '../../conversation/application/conversation.service.js';
import type { CatalogQueryService } from '../../product-catalog/application/catalog-query.service.js';
import { CatalogUnavailableError as CatalogReadUnavailableError } from '../../product-catalog/domain/catalog.errors.js';
import { ulid } from '../../../shared/ulid.js';
import { assembleRecommendation, type ProseWriter } from './recommendation-assembler.js';
import {
  fittingRequirement,
  matchProducts,
  pipeRequirement,
  requirementsFrom,
  type RoleRequirement,
} from '../domain/product-matcher.js';
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
    /**
     * Asumsi bila pengguna **tidak menyatakannya**, bukan hanya bila default sudah
     * ditulis ke state. Keduanya berbeda: field yang belum pernah disentuh bernilai
     * `null` dengan source `inferred`, lalu engine memakai ENG-004 — tetap asumsi.
     * Memeriksa `=== 'default_applied'` saja membuat blok judul gambar menulis
     * "3,50 M" tanpa "· ASUMSI", yakni berbohong tentang asal angkanya.
     */
    floorHeightIsDefault: state.building.floorHeightM.value === null,
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
    private readonly catalogQuery: Pick<
      CatalogQueryService,
      'activeVersion' | 'listProducts' | 'candidatesFor'
    >,
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

    // Jalur irigasi (OQ-47): mesin Kelompok E, perakitan sendiri, tanpa skema bangunan.
    if (state.useCase?.kind === 'irrigation') {
      return this.runIrrigation(conversationId, snapshotId, state, requirementAssumptions, now);
    }
    // Kasus teknis umum (Fase 14) yang kalkulatornya ada: kolam/tambak (Kelompok G).
    if (state.useCase?.kind === 'technical') {
      const pondInput = pondInputFrom(state);
      if (pondInput !== null)
        return this.runPond(conversationId, snapshotId, state, pondInput, now);
      const plan = pressurizedPlanFrom(state);
      if (plan !== null) return this.runPressurized(conversationId, snapshotId, plan, now);
      const gravity = gravityPlanFrom(state);
      if (gravity !== null) return this.runGravity(conversationId, snapshotId, gravity, now);
      const network = networkInputFrom(state);
      if (network !== null) return this.runNetwork(conversationId, snapshotId, network, now);
      throw new TechnicalCaseNotComputableError(state.useCase.caseId);
    }

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
    // Lewat `CatalogQueryService`, bukan repository: di sanalah pagar "katalog contoh
    // bukan katalog Pralon" (0013) hidup, dan rekomendasi tidak boleh melewatinya.
    events.push({ type: 'stage', stage: 'MATCHING_PRODUCTS', status: 'active' });
    let version;
    try {
      version = await this.catalogQuery.activeVersion();
    } catch (error) {
      events.push({ type: 'stage', stage: 'MATCHING_PRODUCTS', status: 'failed' });
      if (error instanceof CatalogReadUnavailableError) throw new CatalogUnavailableError();
      throw error;
    }

    const match = await this.matchRoles(
      requirementsFrom({
        mainSize: solution.mainSize,
        branchSize: '3/4"',
        fixtureSize: solution.fixtureConnectionSize,
        pipeFamily: PIPE_FAMILY,
      }),
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
    await this.repository.save(assembled.recommendation, traces, {
      proseSource: assembled.proseSource,
    });
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

  /**
   * Irigasi: engine Kelompok E (semua `REQUIRES_DOMAIN_VALIDATION` → ASSUMED), pencocokan
   * produk per peran (jalur utama HDPE/PVC AW, distribusi PVC AW, fitting), prosa deterministik.
   * Tahap skema ditandai selesai tanpa gambar — skema irigasi belum didesain.
   */
  private async runIrrigation(
    conversationId: string,
    snapshotId: string,
    state: RequirementState,
    requirementAssumptions: readonly Assumption[],
    now: string,
  ): Promise<readonly AssistantStreamEvent[]> {
    const events: AssistantStreamEvent[] = [];

    events.push({ type: 'stage', stage: 'ANALYZING_INSTALLATION', status: 'active' });
    const { input, assumptions: inputAssumptions } = irrigationInputFrom(state);
    const result = computeIrrigation(input);
    const traces: readonly IdentifiedTrace[] = result.traces.map((trace) => ({
      ...trace,
      id: ulid(),
    }));
    events.push({
      type: 'stage',
      stage: 'ANALYZING_INSTALLATION',
      status: 'done',
      detail: `IRIGASI ${input.areaHa} HA`,
    });

    events.push({ type: 'stage', stage: 'MATCHING_PRODUCTS', status: 'active' });
    let version;
    try {
      version = await this.catalogQuery.activeVersion();
    } catch (error) {
      events.push({ type: 'stage', stage: 'MATCHING_PRODUCTS', status: 'failed' });
      if (error instanceof CatalogReadUnavailableError) throw new CatalogUnavailableError();
      throw error;
    }
    const match = await this.matchRoles([
      pipeRequirement('main', result.mainSize, result.mainFamily),
      pipeRequirement('branch', result.distributionSize, result.distributionFamily),
      fittingRequirement(result.distributionSize, result.distributionFamily),
    ]);
    events.push({
      type: 'stage',
      stage: 'MATCHING_PRODUCTS',
      status: 'done',
      detail: `${match.products.length} PRODUK`,
    });

    events.push({ type: 'stage', stage: 'COMPOSING', status: 'active' });
    const stats = irrigationStatsFrom(result, input.areaHa, match.products.length);
    const prose = irrigationProse(stats, result);
    const recommendation: Recommendation = {
      id: ulid(),
      conversationId,
      snapshotId,
      catalogVersionId: version.id,
      kind: 'irrigation',
      headline: prose.headline,
      body: prose.body,
      stats: legacyStatsFrom(result, match.products.length),
      irrigationStats: stats,
      systemLines: irrigationSystemLinesFrom(result, traces),
      products: match.products,
      bom: irrigationBomItemsFrom(result, traces),
      assumptions: irrigationAssumptionsFrom(traces, [
        ...appliedAssumptionsToView(
          engineeringStateFrom(state).appliedAssumptions,
          irrigationFieldFor,
          'ENG-101',
        ),
        ...inputAssumptions,
        ...requirementAssumptions,
      ]),
      overallProvenance: result.overallProvenance,
      createdAt: now,
    };
    await this.repository.save(recommendation, traces, { proseSource: 'template' });
    await this.conversations.markSolutionReady(conversationId);
    events.push({ type: 'stage', stage: 'COMPOSING', status: 'done' });

    events.push({
      type: 'stage',
      stage: 'PREPARING_SCHEMATIC',
      status: 'done',
      detail: 'SKEMA IRIGASI MENUNGGU DESAIN',
    });
    events.push({ type: 'solution.ready', recommendationId: recommendation.id });
    return events;
  }

  /**
   * Kolam/tambak: engine Kelompok G (semua `REQUIRES_DOMAIN_VALIDATION` → ASSUMED), pencocokan
   * produk per peran (pipa masuk PVC AW, pipa kuras PVC D, fitting), prosa deterministik.
   */
  /**
   * Transfer pompa / sumur → tandon: engine Kelompok F (sizing multi-kriteria + titik kerja
   * pompa), produk per peran (pipa utama sesuai keluarga, alternatif, fitting), prosa deterministik.
   */
  private async runPressurized(
    conversationId: string,
    snapshotId: string,
    plan: PressurizedPlan,
    now: string,
  ): Promise<readonly AssistantStreamEvent[]> {
    const events: AssistantStreamEvent[] = [];

    events.push({ type: 'stage', stage: 'ANALYZING_INSTALLATION', status: 'active' });
    const result = computePressurized(plan.input);
    const traces: readonly IdentifiedTrace[] = result.traces.map((trace) => ({
      ...trace,
      id: ulid(),
    }));
    events.push({
      type: 'stage',
      stage: 'ANALYZING_INSTALLATION',
      status: 'done',
      detail: `${plan.input.designFlowLs} L/S · ${plan.input.routeLengthM} M`,
    });

    events.push({ type: 'stage', stage: 'MATCHING_PRODUCTS', status: 'active' });
    let version;
    try {
      version = await this.catalogQuery.activeVersion();
    } catch (error) {
      events.push({ type: 'stage', stage: 'MATCHING_PRODUCTS', status: 'failed' });
      if (error instanceof CatalogReadUnavailableError) throw new CatalogUnavailableError();
      throw error;
    }
    const roles = [
      pipeRequirement('main', result.recommendedSize, plan.family),
      fittingRequirement(result.recommendedSize, plan.family),
    ];
    if (result.alternativeSize) {
      roles.push(pipeRequirement('branch', result.alternativeSize, plan.family));
    }
    const match = await this.matchRoles(roles);
    events.push({
      type: 'stage',
      stage: 'MATCHING_PRODUCTS',
      status: 'done',
      detail: `${match.products.length} PRODUK`,
    });

    events.push({ type: 'stage', stage: 'COMPOSING', status: 'active' });
    const prose = pressurizedProse(result, plan.family, plan.input);
    const recommendation: Recommendation = {
      id: ulid(),
      conversationId,
      snapshotId,
      catalogVersionId: version.id,
      kind: 'technical',
      headline: prose.headline,
      body: prose.body,
      stats: pressurizedLegacyStats(result, match.products.length),
      highlights: pressurizedHighlights(result, plan.family, match.products.length),
      systemLines: pressurizedSystemLinesFrom(result, plan.family, traces),
      products: match.products,
      bom: pressurizedBomItemsFrom(result, plan.family, plan.input.routeLengthM, traces),
      assumptions: pressurizedAssumptionsFrom(result, plan.extraAssumptionIds, traces),
      overallProvenance: result.overallProvenance,
      createdAt: now,
    };
    await this.repository.save(recommendation, traces, { proseSource: 'template' });
    await this.conversations.markSolutionReady(conversationId);
    events.push({ type: 'stage', stage: 'COMPOSING', status: 'done' });
    events.push({
      type: 'stage',
      stage: 'PREPARING_SCHEMATIC',
      status: 'done',
      detail: 'SKEMA JALUR MENUNGGU DESAIN',
    });
    events.push({ type: 'solution.ready', recommendationId: recommendation.id });
    return events;
  }

  /** Drainase / air hujan / gorong-gorong: engine Kelompok H, produk PVC D + fitting, prosa deterministik. */
  private async runGravity(
    conversationId: string,
    snapshotId: string,
    plan: GravityPlan,
    now: string,
  ): Promise<readonly AssistantStreamEvent[]> {
    const events: AssistantStreamEvent[] = [];
    events.push({ type: 'stage', stage: 'ANALYZING_INSTALLATION', status: 'active' });
    const result = computeGravity(plan.input);
    const traces: readonly IdentifiedTrace[] = result.traces.map((trace) => ({
      ...trace,
      id: ulid(),
    }));
    events.push({
      type: 'stage',
      stage: 'ANALYZING_INSTALLATION',
      status: 'done',
      detail: `${result.designFlowLs} L/S · ${result.slopePercent} %`,
    });

    const { version } = await this.catalogForMatching(events);
    const match = await this.matchRoles([
      pipeRequirement('main', result.recommendedSize, 'PVC D'),
      fittingRequirement(result.recommendedSize, 'PVC D'),
    ]);
    events.push({
      type: 'stage',
      stage: 'MATCHING_PRODUCTS',
      status: 'done',
      detail: `${match.products.length} PRODUK`,
    });

    events.push({ type: 'stage', stage: 'COMPOSING', status: 'active' });
    const prose = gravityProse(result);
    const recommendation: Recommendation = {
      id: ulid(),
      conversationId,
      snapshotId,
      catalogVersionId: version.id,
      kind: 'technical',
      headline: prose.headline,
      body: prose.body,
      stats: gravityLegacyStats(result, match.products.length),
      highlights: gravityHighlights(result, match.products.length),
      systemLines: gravitySystemLinesFrom(result, traces),
      products: match.products,
      bom: gravityBomItemsFrom(result, plan.pipeLengthM, traces),
      assumptions: gravityAssumptionsFrom(result, traces),
      overallProvenance: result.overallProvenance,
      createdAt: now,
    };
    await this.repository.save(recommendation, traces, { proseSource: 'template' });
    await this.conversations.markSolutionReady(conversationId);
    events.push({ type: 'stage', stage: 'COMPOSING', status: 'done' });
    events.push({
      type: 'stage',
      stage: 'PREPARING_SCHEMATIC',
      status: 'done',
      detail: 'SKEMA SALURAN MENUNGGU DESAIN',
    });
    events.push({ type: 'solution.ready', recommendationId: recommendation.id });
    return events;
  }

  /** Cluster perumahan: kebutuhan puncak (ENG-405) lalu jalur bertekanan (Kelompok F). */
  private async runNetwork(
    conversationId: string,
    snapshotId: string,
    input: NetworkInput,
    now: string,
  ): Promise<readonly AssistantStreamEvent[]> {
    const events: AssistantStreamEvent[] = [];
    events.push({ type: 'stage', stage: 'ANALYZING_INSTALLATION', status: 'active' });
    // Keluarga dulu: HDPE dijual dalam mm, jadi engine harus memilih ukuran dari tabel mm.
    const family = input.routeLengthM >= HDPE_FROM_METERS ? 'HDPE' : 'PVC AW';
    const result = computeNetwork(family === 'HDPE' ? { ...input, material: 'HDPE' } : input);
    const traces: readonly IdentifiedTrace[] = result.traces.map((trace) => ({
      ...trace,
      id: ulid(),
    }));
    const extra = family === 'HDPE' ? ['HDPE_MAIN_FROM_200M'] : [];
    events.push({
      type: 'stage',
      stage: 'ANALYZING_INSTALLATION',
      status: 'done',
      detail: `${result.connections} UNIT · ${result.peakFlowLs} L/S`,
    });

    const { version } = await this.catalogForMatching(events);
    const roles = [
      pipeRequirement('main', result.recommendedSize, family),
      fittingRequirement(result.recommendedSize, family),
    ];
    if (result.alternativeSize)
      roles.push(pipeRequirement('branch', result.alternativeSize, family));
    const match = await this.matchRoles(roles);
    events.push({
      type: 'stage',
      stage: 'MATCHING_PRODUCTS',
      status: 'done',
      detail: `${match.products.length} PRODUK`,
    });

    events.push({ type: 'stage', stage: 'COMPOSING', status: 'active' });
    const pressurizedInput = {
      designFlowLs: result.peakFlowLs,
      routeLengthM: input.routeLengthM,
      staticHeadM: input.staticHeadM,
    };
    const prose = pressurizedProse(result, family, pressurizedInput);
    const recommendation: Recommendation = {
      id: ulid(),
      conversationId,
      snapshotId,
      catalogVersionId: version.id,
      kind: 'technical',
      headline: `${result.connections} unit: ${prose.headline}`,
      body: `Kebutuhan puncak ${String(result.peakFlowLs).replace('.', ',')} l/s untuk ${result.connections} sambungan (rata-rata ${String(result.averageFlowLs).replace('.', ',')} l/s). ${prose.body}`,
      stats: pressurizedLegacyStats(result, match.products.length),
      highlights: [
        ...networkHighlightsPrefix(result),
        ...pressurizedHighlights(result, family, match.products.length),
      ],
      systemLines: pressurizedSystemLinesFrom(result, family, traces),
      products: match.products,
      bom: pressurizedBomItemsFrom(result, family, input.routeLengthM, traces),
      assumptions: pressurizedAssumptionsFrom(result, extra, traces),
      overallProvenance: result.overallProvenance,
      createdAt: now,
    };
    await this.repository.save(recommendation, traces, { proseSource: 'template' });
    await this.conversations.markSolutionReady(conversationId);
    events.push({ type: 'stage', stage: 'COMPOSING', status: 'done' });
    events.push({
      type: 'stage',
      stage: 'PREPARING_SCHEMATIC',
      status: 'done',
      detail: 'SKEMA JARINGAN MENUNGGU DESAIN',
    });
    events.push({ type: 'solution.ready', recommendationId: recommendation.id });
    return events;
  }

  /** Versi katalog aktif + halaman produk untuk pencocokan; gagal → `CatalogUnavailableError`. */
  private async catalogForMatching(events: AssistantStreamEvent[]) {
    events.push({ type: 'stage', stage: 'MATCHING_PRODUCTS', status: 'active' });
    let version;
    try {
      version = await this.catalogQuery.activeVersion();
    } catch (error) {
      events.push({ type: 'stage', stage: 'MATCHING_PRODUCTS', status: 'failed' });
      if (error instanceof CatalogReadUnavailableError) throw new CatalogUnavailableError();
      throw error;
    }
    return { version };
  }

  /**
   * Kandidat per peran dari repository (keluarga + ukuran bersatuan + status aktif), lalu matcher
   * murni memilih. Menggantikan jendela 50 produk pertama yang membuat semua peran kosong di katalog
   * Pralon (docs/MATCHER_V2_PROPOSAL.md §4).
   */
  private async matchRoles(roles: readonly RoleRequirement[]) {
    const byId = new Map<string, Product>();
    for (const role of roles) {
      const size = PipeSize.parse(role.size);
      for (const family of role.families) {
        const found = await this.catalogQuery.candidatesFor({
          family,
          size,
          ...(role.categoryIncludes ? { categoryIncludes: role.categoryIncludes } : {}),
        });
        for (const product of found) byId.set(product.id, product);
        if (found.length > 0) break;
      }
    }
    return matchProducts(roles, [...byId.values()]);
  }

  private async runPond(
    conversationId: string,
    snapshotId: string,
    state: RequirementState,
    input: PondInput,
    now: string,
  ): Promise<readonly AssistantStreamEvent[]> {
    const events: AssistantStreamEvent[] = [];

    events.push({ type: 'stage', stage: 'ANALYZING_INSTALLATION', status: 'active' });
    const result = computePond(input);
    const traces: readonly IdentifiedTrace[] = result.traces.map((trace) => ({
      ...trace,
      id: ulid(),
    }));
    events.push({
      type: 'stage',
      stage: 'ANALYZING_INSTALLATION',
      status: 'done',
      detail: `KOLAM ${result.volumeM3} M³`,
    });

    events.push({ type: 'stage', stage: 'MATCHING_PRODUCTS', status: 'active' });
    let version;
    try {
      version = await this.catalogQuery.activeVersion();
    } catch (error) {
      events.push({ type: 'stage', stage: 'MATCHING_PRODUCTS', status: 'failed' });
      if (error instanceof CatalogReadUnavailableError) throw new CatalogUnavailableError();
      throw error;
    }
    const match = await this.matchRoles([
      pipeRequirement('main', result.inletSize, result.inletFamily),
      pipeRequirement('branch', result.drainSize, result.drainFamily),
      fittingRequirement(result.inletSize, result.inletFamily),
    ]);
    events.push({
      type: 'stage',
      stage: 'MATCHING_PRODUCTS',
      status: 'done',
      detail: `${match.products.length} PRODUK`,
    });

    events.push({ type: 'stage', stage: 'COMPOSING', status: 'active' });
    const prose = pondProse(result);
    const recommendation: Recommendation = {
      id: ulid(),
      conversationId,
      snapshotId,
      catalogVersionId: version.id,
      kind: 'technical',
      headline: prose.headline,
      body: prose.body,
      stats: pondLegacyStats(result, match.products.length),
      highlights: pondHighlights(result, match.products.length),
      systemLines: pondSystemLinesFrom(result, traces),
      products: match.products,
      bom: pondBomItemsFrom(result, traces),
      assumptions: pondAssumptionsFrom(result, traces),
      overallProvenance: result.overallProvenance,
      createdAt: now,
    };
    await this.repository.save(recommendation, traces, { proseSource: 'template' });
    await this.conversations.markSolutionReady(conversationId);
    events.push({ type: 'stage', stage: 'COMPOSING', status: 'done' });
    events.push({
      type: 'stage',
      stage: 'PREPARING_SCHEMATIC',
      status: 'done',
      detail: 'SKEMA KOLAM MENUNGGU DESAIN',
    });
    events.push({ type: 'solution.ready', recommendationId: recommendation.id });
    void state;
    return events;
  }
}

/** Kasus teknis yang belum punya kalkulator atau datanya belum cukup — pemanggil menjawab jujur. */
export class TechnicalCaseNotComputableError extends Error {
  constructor(readonly caseId: string) {
    super(`kasus teknis ${caseId} belum bisa dihitung`);
    this.name = 'TechnicalCaseNotComputableError';
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
