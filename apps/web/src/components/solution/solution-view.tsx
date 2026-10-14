'use client';

/**
 * Layar 06 — workspace solusi, dan kartu produk layar 07.
 * Dari prototipe baru. docs/DESIGN_IMPLEMENTATION.md.
 *
 * Seluruh angka di sini datang dari `Recommendation` yang dirakit server; komponen ini
 * tidak menghitung apa pun. Kolom "DASAR PERHITUNGAN" merender `basis` dari trace
 * aturan, bukan prosa — itulah yang membuat auditabilitas SPEC §8 terlihat pengguna.
 */

import {
  boqFrom,
  type Assumption,
  type Boq,
  type BoqProduct,
  type BoqRow,
  type ComposedResponse,
  type Recommendation,
  type SelectedProduct,
  type SystemLine,
} from '@snouty/shared-types';
import { ASSUMPTION_CATEGORIES, assumptionCategory } from '@snouty/engineering';
import { Fragment, useState } from 'react';
import { ProductDrawer, type DrawerSelection } from '../product/product-drawer';
import { InstallationDrawingCard } from './installation-drawing-card';
import { ScenarioCard } from './scenario-card';
import { NeedsGrid, SummaryHero, WaterFlowCard } from './needs-board';
import { productVisual } from '@snouty/ui/product-visual';
import { ProductVisualView } from './product-visual-view';
import { SchematicTab } from './schematic-tab';
import { solutionCopy } from './solution-copy';
import { useLocale } from '../locale';
import { ProvenanceTag } from './provenance-tag';
import styles from './solution.module.css';

/** Teks UI mengikuti bahasa yang dipilih (Fase 15). */
function useSolutionCopy() {
  return solutionCopy(useLocale().locale);
}

/** Tab layar solusi (prototipe `tabDefs`). Tanpa `tab`, seluruh bagian dirender berurutan. */
export type SolutionTab = 'ringkasan' | 'produk' | 'skema' | 'material';

export function SolutionView({
  recommendation,
  onFixAssumption,
  onChangeAssumption,
  onRecompute,
  tab,
}: {
  recommendation: Recommendation;
  onFixAssumption?: (fieldPath: string) => void;
  /**
   * Ganti nilai asumsi angka lalu hitung ulang. `null` = berhasil; string = pesan untuk baris itu.
   * Tanpa ini baris asumsi memakai `onFixAssumption` (kembali ke chat / panel Ubah).
   */
  onChangeAssumption?: (assumptionId: string, value: number | null) => Promise<string | null>;
  /** Susun ulang rekomendasi dengan aturan terbaru — ditawarkan bila hasil ini dari aturan lama. */
  onRecompute?: () => void;
  tab?: SolutionTab;
}) {
  const COPY = useSolutionCopy();
  const [showTechnical, setShowTechnical] = useState(false);
  const [openProduct, setOpenProduct] = useState<DrawerSelection | null>(null);
  // Satu daftar untuk tab Produk dan material (TC-H-05, DD-01 #4).
  const boq = boqFrom(recommendation);
  const { stats } = recommendation;
  // Rekomendasi sebelum P17-04 tidak punya kebutuhan bergambar; ringkasannya tetap seperti dulu.
  const needs = recommendation.needs ?? [];
  const on = (which: SolutionTab) => tab === undefined || tab === which;
  // Semua jenis solusi punya skema: bangunan (lantai per lantai) atau aliran (kasus teknis, irigasi).
  const hasSchematic = true;

  return (
    <div className={styles.workspace}>
      {on('skema') && tab !== undefined && needs.length > 0 && (
        <ScenarioCard recommendationId={recommendation.id} />
      )}

      {on('skema') && tab !== undefined && needs.length > 0 && (
        <InstallationDrawingCard needs={needs} />
      )}

      {on('skema') && tab !== undefined && (
        <SchematicTab
          recommendationId={recommendation.id}
          // Skema hanya ada untuk solusi bangunan; kasus teknis/irigasi tidak punya (API 404) —
          // jangan memintanya, tampilkan "belum tersedia" langsung tanpa galat di konsol.
          available={hasSchematic}
        />
      )}

      {on('ringkasan') && (
        <section className={styles.card}>
          {needs.length > 0 ? (
            <>
              <SummaryHero
                needs={needs}
                kicker={COPY.summaryKicker}
                headline={recommendation.headline}
                body={recommendation.body}
              />
              <NeedsGrid needs={needs} />
            </>
          ) : (
            <>
              <div className={styles.kicker}>{COPY.summaryKicker}</div>
              <h2 className={styles.headline}>{recommendation.headline}</h2>
              <p className={styles.body}>{recommendation.body}</p>
            </>
          )}
          {/* Rekomendasi dari aturan yang sudah diganti (temuan laporan SNTY-2026-10-0002). */}
          {recommendation.outdated && onRecompute && (
            <p className={styles.disclaimer} role="status">
              {COPY.outdated}{' '}
              <button type="button" className={styles.linkButton} onClick={onRecompute}>
                {COPY.recompute}
              </button>
            </p>
          )}
          <div className={styles.statsRow}>
            {recommendation.kind === 'technical' && recommendation.highlights ? (
              <>
                {/* Kasus teknis umum (Fase 14): statistiknya berlabel dari API, per kasus. */}
                {recommendation.highlights.map((item) => (
                  <Stat key={item.label} label={item.label} value={item.value} />
                ))}
              </>
            ) : recommendation.kind === 'irrigation' && recommendation.irrigationStats ? (
              <>
                {/* Solusi irigasi (OQ-47): statistiknya luas, debit, jalur utama, pompa. */}
                <Stat
                  label={COPY.irrigationStats.area}
                  value={`${String(recommendation.irrigationStats.areaHa).replace('.', ',')} ha`}
                />
                <Stat
                  label={COPY.irrigationStats.flow}
                  value={`${String(recommendation.irrigationStats.designFlowLs).replace('.', ',')} l/s`}
                  mono
                />
                <Stat
                  label={COPY.statsLabels.mainSize}
                  value={recommendation.irrigationStats.mainSize}
                  mono
                />
                <Stat
                  label={COPY.irrigationStats.pump}
                  value={
                    recommendation.irrigationStats.pumpRequired
                      ? COPY.irrigationStats.pumpYes
                      : COPY.irrigationStats.pumpNo
                  }
                />
                <Stat
                  label={COPY.statsLabels.products}
                  value={`${recommendation.irrigationStats.productCount} item`}
                />
              </>
            ) : (
              <>
                <Stat label={COPY.statsLabels.outletCount} value={String(stats.outletCount)} />
                <Stat label={COPY.statsLabels.mainSize} value={stats.mainSize} mono />
                <Stat label={COPY.statsLabels.branch} value={String(stats.branchCount)} />
                <Stat label={COPY.statsLabels.fixture} value={stats.fixtureConnectionSize} mono />
                <Stat label={COPY.statsLabels.products} value={`${stats.productCount} item`} />
              </>
            )}
          </div>
          <div className={styles.summaryFooter}>
            <span className={styles.disclaimer}>{COPY.planningDisclaimer}</span>
            {/* Skema dibentuk ulang deterministik dari snapshot — jadi tautannya cukup id.
                Hanya solusi bangunan yang punya skema; tanpa itu tautannya tidak ditampilkan. */}
            {hasSchematic && (
              <a
                className={styles.linkButton}
                href={`/schematic?recommendation=${recommendation.id}`}
              >
                {COPY.schematicOpen}
              </a>
            )}
          </div>
        </section>
      )}

      {on('ringkasan') && needs.length > 0 && (
        <WaterFlowCard needs={needs} outletCount={stats.outletCount} />
      )}

      {on('ringkasan') && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>{COPY.systemTitle}</h3>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => setShowTechnical((open) => !open)}
              aria-expanded={showTechnical}
            >
              {showTechnical ? COPY.hideTechnical : COPY.showTechnical}
            </button>
          </div>

          {recommendation.systemLines.map((line) => (
            <div key={line.name} className={styles.systemRow}>
              <span className={[styles.roleBar, roleToneClass(line.role)].join(' ')} />
              <div className={styles.systemName}>
                <span className={styles.systemNameText}>{line.name}</span>
                <span className={styles.systemPath}>{line.path}</span>
              </div>
              <span className={styles.systemSize}>{line.size}</span>
              <span className={styles.systemReason}>{line.reason}</span>
              <ProvenanceTag provenance={line.provenance} />
            </div>
          ))}

          {showTechnical && (
            <div className={styles.technicalBlock}>
              <div className={styles.kicker}>{COPY.technicalKicker}</div>
              {/* Dirender dari trace aturan — bukan prosa LLM (invarian T-1). Langkah bernomor per
                  jalur; rekomendasi lama tanpa langkah memakai alasannya. */}
              {recommendation.systemLines.map((line) => (
                <div key={line.name} className={styles.technicalGroup}>
                  <div className={styles.technicalGroupTitle}>
                    {line.name} · <span className={styles.technicalGroupSize}>{line.size}</span>
                  </div>
                  {line.steps && line.steps.length > 0 ? (
                    <ol className={styles.stepList}>
                      {line.steps.map((step, index) => (
                        <li key={`${step.title}-${index}`} className={styles.stepItem}>
                          <span className={styles.stepTitle}>{step.title}.</span> {step.text}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className={styles.technicalLine}>{line.reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {on('ringkasan') && recommendation.composition && (
        <CompositionOptions composition={recommendation.composition} />
      )}

      {on('material') && boq.sections.length > 0 && (
        <BoqTables boq={boq} lines={recommendation.systemLines} />
      )}

      {on('material') && recommendation.assumptions.length > 0 && (
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>{COPY.assumptionsTitle}</h3>
          <div className={styles.tableWrap}>
            <table className={[styles.boqTable, styles.assumptionTable].join(' ')}>
              <thead>
                <tr>
                  <th>{COPY.assumptionColumns.text}</th>
                  <th>{COPY.assumptionColumns.value}</th>
                  <th>{COPY.assumptionColumns.origin}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {/* Dikelompokkan per kategori dari registry (DD-01 #10), urutan tetap. */}
                {ASSUMPTION_CATEGORIES.map((category) => {
                  const rows = recommendation.assumptions.filter(
                    (a) => assumptionCategory(a) === category,
                  );
                  if (rows.length === 0) return null;
                  return (
                    <Fragment key={category}>
                      <tr className={styles.boqSection}>
                        <td colSpan={4}>{COPY.assumptionCategories[category]}</td>
                      </tr>
                      {rows.map((assumption) => (
                        <AssumptionRow
                          key={`${assumption.fieldPath}-${assumption.text}`}
                          assumption={assumption}
                          {...(onFixAssumption ? { onFix: onFixAssumption } : {})}
                          {...(onChangeAssumption ? { onChange: onChangeAssumption } : {})}
                        />
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {on('material') && recommendation.composition && (
        <CompositionData composition={recommendation.composition} />
      )}

      {on('produk') && boq.products.length > 0 && (
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>{COPY.productsTitle}</h3>
          {/* Kartu = SKU di BOQ, dikelompokkan per sistem seperti BOQ-nya (DD-01 #4). */}
          {boqSystems(boq).map((system) => (
            <div key={system ?? 'other'} className={styles.productGroup}>
              {boq.sections.length > 1 && (
                <h4 className={styles.productGroupTitle}>{COPY.boq.systems[system ?? 'other']}</h4>
              )}
              <div className={styles.productGrid}>
                {boq.products
                  .filter((p) => p.system === system)
                  .map((product) => (
                    <ProductCard
                      key={product.productId}
                      product={product}
                      onOpen={() => setOpenProduct(product.selections[0]!)}
                    />
                  ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {openProduct && (
        <ProductDrawer selection={openProduct} onClose={() => setOpenProduct(null)} />
      )}
    </div>
  );
}

/**
 * Opsi ukuran + kesiapan hasil (Fase 14 §28) — layar BELUM DIDESAIN (OQ-50): dibangun minimal
 * dengan token dan kelas yang sudah ada. Seluruh isinya dari `composition` yang dirakit server;
 * status dan catatan tradeoff datang dari kode API, bukan dihitung di sini.
 */
function CompositionOptions({ composition }: { composition: ComposedResponse }) {
  const COPY = useSolutionCopy();
  const C = COPY.composition;
  return (
    <>
      {composition.options.length > 0 && (
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>{C.optionsTitle}</h3>
          <p className={styles.body}>{C.optionsHint}</p>
          <div className={styles.bomTable} role="table">
            {composition.options.map((option) => (
              <div
                key={option.size}
                className={[
                  styles.optionRow,
                  option.recommended ? styles.optionRecommended : '',
                ].join(' ')}
                role="row"
              >
                <span className={styles.mono} role="cell">
                  {option.size}
                </span>
                <span className={styles.optionTags} role="cell">
                  <span
                    className={[
                      styles.tag,
                      option.status === 'ok' ? styles.tagVerified : styles.tagAssumed,
                    ].join(' ')}
                  >
                    {C.optionStatus[option.status]}
                  </span>
                  {option.recommended && (
                    <span className={[styles.tag, styles.tagVerified].join(' ')}>
                      {C.optionRecommended}
                    </span>
                  )}
                  {option.alternative && (
                    <span className={[styles.tag, styles.tagUnavailable].join(' ')}>
                      {C.optionAlternative}
                    </span>
                  )}
                </span>
                <span className={styles.mono} role="cell">
                  {option.metrics.map((m) => `${m.label} ${m.value}`).join(' · ')}
                </span>
                <span className={styles.bomBasis} role="cell">
                  {option.note}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {composition.readiness.length > 0 && (
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>{C.readinessTitle}</h3>
          {composition.readiness.map((item) => (
            <div key={item.output} className={styles.assumptionRow}>
              <span className={styles.assumptionText}>
                <strong>{item.label}</strong>
                {item.missing.length > 0 && (
                  <span className={styles.specMissing}>
                    {' '}
                    — {C.readinessMissing} {item.missing.join(', ')}
                  </span>
                )}
                {item.missing.length === 0 && item.improvable.length > 0 && (
                  <span className={styles.specMissing}>
                    {' '}
                    — {C.readinessImprovable} {item.improvable.join(', ')}
                  </span>
                )}
              </span>
              <span
                className={[
                  styles.tag,
                  item.readiness === 'ready'
                    ? styles.tagVerified
                    : item.readiness === 'partial'
                      ? styles.tagAssumed
                      : styles.tagUnavailable,
                ].join(' ')}
              >
                {C.readinessLabel[item.readiness]}
              </span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

/** Data diketahui · parameter diasumsikan · perhitungan · data yang masih dibutuhkan (tab Material). */
function CompositionData({ composition }: { composition: ComposedResponse }) {
  const COPY = useSolutionCopy();
  const C = COPY.composition;
  const list = (title: string, items: readonly { label: string; value: string }[]) =>
    items.length > 0 && (
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>{title}</h3>
        {items.map((item) => (
          <div key={`${item.label}-${item.value}`} className={styles.assumptionRow}>
            <span className={styles.assumptionText}>
              <strong>{item.label}</strong> {item.value}
            </span>
          </div>
        ))}
      </section>
    );
  return (
    <>
      {list(C.knownTitle, composition.knownData)}
      {list(C.assumedTitle, composition.assumedData)}
      {list(C.calculationsTitle, composition.calculations)}
      {list(C.missingTitle, composition.missingData)}
    </>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={[styles.statValue, mono ? styles.mono : ''].join(' ')}>{value}</span>
    </div>
  );
}

/** Kartu produk layar 07: nama katalog, peruntukan, dan jumlahnya di BOQ (DD-01 #4). */
function ProductCard({ product, onOpen }: { product: BoqProduct; onOpen: () => void }) {
  const COPY = useSolutionCopy();
  const first = product.selections[0]!;
  // Peruntukan dari API (bahasa percakapan); tanpa itu label peran dua bahasa (TC-H-06).
  const purposes = [
    ...new Set(product.selections.map((s) => s.purpose ?? COPY.roleLabel[s.role])),
  ].join(' · ');
  const sizes = [...new Set(product.selections.map((s) => s.size))].join(' · ');
  const visual = productVisual({
    ...(first.family !== undefined ? { family: first.family } : {}),
    ...(first.category !== undefined ? { category: first.category } : {}),
    size: first.size,
    kind: product.kind,
  });
  return (
    <button type="button" className={styles.productCard} onClick={onOpen}>
      {visual && (
        <div className={styles.productImageBox}>
          <ProductVisualView
            visual={visual}
            label={product.name ?? purposes}
            className={styles.productImage}
          />
        </div>
      )}
      <div className={styles.productRole}>{purposes}</div>
      {product.name && <div className={styles.productName}>{product.name}</div>}
      <div className={styles.productSize}>{sizes}</div>
      <div className={styles.productNeed}>
        {product.quantity !== null ? (
          <>
            <span>
              {COPY.productNeeded}{' '}
              <span className={styles.productRows}>
                ({COPY.productRows(product.rowNos.join(', '))})
              </span>
            </span>
            <b className={styles.mono}>
              {product.quantity} {product.unit}
            </b>
          </>
        ) : (
          <span>{COPY.productPending}</span>
        )}
      </div>
      <span
        className={[
          styles.productState,
          first.matchState === 'VERIFIED_SELECTED' ? styles.productStateOk : '',
          first.matchState === 'SIZE_NEEDS_VALIDATION' ? styles.productStateWarn : '',
        ].join(' ')}
      >
        {COPY.matchStateLabel[first.matchState]}
      </span>
    </button>
  );
}

/** Urutan sistem di tab Produk = urutan bagian BOQ. */
function boqSystems(boq: Boq) {
  return boq.sections.map((s) => s.system);
}

function formatMeters(value: number, locale: string): string {
  return `${value.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID')} m`;
}

/**
 * BOQ per sistem lalu pipa / fitting (DD-01 #8) dan dasar perhitungan di tabel terpisah di
 * bawahnya (DD-01 #9). Baris tanpa jumlah tetap tampil dengan keterangannya.
 */
function BoqTables({ boq, lines }: { boq: Boq; lines: readonly SystemLine[] }) {
  const COPY = useSolutionCopy();
  const { locale } = useLocale();
  const counted = boq.sections.flatMap((s) => s.rows).filter((r) => r.no !== null);
  const totals = new Map<string, number>();
  for (const row of counted) {
    if (row.unit !== null && row.quantity !== null) {
      totals.set(row.unit, (totals.get(row.unit) ?? 0) + row.quantity);
    }
  }
  const note = (row: BoqRow) =>
    row.pending
      ? row.kind === 'fitting'
        ? COPY.boq.pendingFitting
        : COPY.boq.pendingPipe
      : row.netLengthM !== undefined
        ? formatMeters(row.netLengthM, locale)
        : '';
  return (
    <>
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>{COPY.boq.title}</h3>
        <div className={styles.tableWrap}>
          <table className={styles.boqTable}>
            <thead>
              <tr>
                <th className={styles.num}>{COPY.boq.columns.no}</th>
                <th>{COPY.boq.columns.item}</th>
                <th>{COPY.boq.columns.size}</th>
                <th className={styles.num}>{COPY.boq.columns.quantity}</th>
                <th>{COPY.boq.columns.unit}</th>
                <th>{COPY.boq.columns.note}</th>
              </tr>
            </thead>
            <tbody>
              {boq.sections.map((section) => (
                <BoqSectionRows
                  key={section.system ?? 'other'}
                  title={
                    boq.sections.length > 1 || section.system !== null
                      ? COPY.boq.systems[section.system ?? 'other']
                      : null
                  }
                  rows={section.rows}
                  note={note}
                />
              ))}
              {totals.size > 0 && (
                <tr className={styles.boqTotal}>
                  <td />
                  <td colSpan={2}>{COPY.boq.total}</td>
                  <td className={styles.num}>
                    {[...totals.values()].map((n, i) => (
                      <div key={i}>{n}</div>
                    ))}
                  </td>
                  <td>
                    {[...totals.keys()].map((unit) => (
                      <div key={unit}>{unit}</div>
                    ))}
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {(counted.some((r) => r.calc || r.basis) || lines.length > 0) && (
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>{COPY.boq.basisTitle}</h3>
          {counted.some((r) => r.calc || r.basis) && (
            <>
              <h4 className={styles.basisSubtitle}>{COPY.boq.basisQuantityTitle}</h4>
              <div className={styles.tableWrap}>
                <table className={styles.boqTable}>
                  <thead>
                    <tr>
                      <th className={styles.num}>{COPY.boq.basisColumns.no}</th>
                      <th>{COPY.boq.basisColumns.method}</th>
                      <th>{COPY.boq.basisColumns.working}</th>
                      <th className={styles.num}>{COPY.boq.basisColumns.result}</th>
                      <th>{COPY.boq.basisColumns.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counted
                      .filter((r) => r.calc || r.basis)
                      .map((row) => (
                        <tr key={row.no}>
                          <td className={styles.num}>{row.no}</td>
                          {/* Rekomendasi lama tidak punya `calc`: kalimat dasarnya utuh di satu sel. */}
                          {row.calc ? (
                            <>
                              <td>{row.calc.method}</td>
                              <td className={styles.mono}>{row.calc.working}</td>
                              <td className={styles.num}>{row.calc.result}</td>
                            </>
                          ) : (
                            <td colSpan={3}>{row.basis}</td>
                          )}
                          <td>{row.provenance && <ProvenanceTag provenance={row.provenance} />}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {lines.length > 0 && (
            <>
              <h4 className={styles.basisSubtitle}>{COPY.boq.basisSizeTitle}</h4>
              <div className={styles.tableWrap}>
                <table className={styles.boqTable}>
                  <thead>
                    <tr>
                      <th>{COPY.boq.basisColumns.line}</th>
                      <th>{COPY.boq.basisColumns.size}</th>
                      <th>{COPY.boq.basisColumns.reason}</th>
                      <th>{COPY.boq.basisColumns.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.name}>
                        <td>{line.name}</td>
                        <td className={styles.mono}>{line.size}</td>
                        <td>{line.reason}</td>
                        <td>
                          <ProvenanceTag provenance={line.provenance} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}

function BoqSectionRows({
  title,
  rows,
  note,
}: {
  title: string | null;
  rows: readonly BoqRow[];
  note: (row: BoqRow) => string;
}) {
  const COPY = useSolutionCopy();
  const groups = (['pipe', 'fitting'] as const).filter((kind) => rows.some((r) => r.kind === kind));
  return (
    <>
      {title !== null && (
        <tr className={styles.boqSection}>
          <td colSpan={6}>{title}</td>
        </tr>
      )}
      {groups.map((kind) => (
        <BoqGroup key={kind} label={COPY.boq.groups[kind]}>
          {rows
            .filter((r) => r.kind === kind)
            .map((row, index) => (
              <tr
                key={`${row.productId ?? row.item}-${row.size}-${index}`}
                className={row.pending ? styles.boqPending : undefined}
              >
                <td className={styles.num}>{row.no ?? '—'}</td>
                <td>
                  {row.purpose ?? row.item}
                  {row.productName && row.productName !== (row.purpose ?? row.item) && (
                    <span className={styles.boqProduct}>{row.productName}</span>
                  )}
                  {row.availability && (
                    <span className={styles.boqProduct}>
                      {COPY.boq.availability[row.availability]}
                    </span>
                  )}
                </td>
                <td className={styles.mono}>{row.size}</td>
                <td className={styles.num}>{row.quantity ?? '—'}</td>
                <td>{row.unit ?? '—'}</td>
                <td>{note(row)}</td>
              </tr>
            ))}
        </BoqGroup>
      ))}
    </>
  );
}

function BoqGroup({ label, children }: { label: string | null; children: React.ReactNode }) {
  return (
    <>
      {label !== null && (
        <tr className={styles.boqGroup}>
          <td />
          <td colSpan={5}>{label}</td>
        </tr>
      )}
      {children}
    </>
  );
}

/** Warna bar peran: main merah merek, cabang lebih muda, fixture paling muda. */
function roleToneClass(role: SelectedProduct['role']): string {
  if (role === 'main' || role === 'riser') return styles.roleMain!;
  if (role === 'branch') return styles.roleBranch!;
  return styles.roleFixture!;
}

/**
 * Satu baris asumsi. Asumsi angka dari registry bisa diganti di tempat ("Perbaiki asumsi ini" →
 * angka + satuan → Hitung ulang); yang lain memakai jalur lama (chat / panel Ubah). Baris
 * penjelasan cara hitung (`fieldPath` kosong) tidak punya tombol.
 */
function AssumptionRow({
  assumption,
  onFix,
  onChange,
}: {
  assumption: Assumption;
  onFix?: (fieldPath: string) => void;
  onChange?: (assumptionId: string, value: number | null) => Promise<string | null>;
}) {
  const COPY = useSolutionCopy();
  const { locale } = useLocale();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(assumption.value ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editable =
    onChange !== undefined &&
    assumption.assumptionId !== undefined &&
    assumption.value !== undefined;

  const submit = async (value: number | null) => {
    if (!editable) return;
    setBusy(true);
    setError(null);
    const problem = await onChange(assumption.assumptionId!, value);
    setBusy(false);
    if (problem !== null) setError(problem);
    else setEditing(false);
  };

  return (
    <tr>
      <td className={styles.assumptionMain}>
        <span className={styles.assumptionText}>{assumption.text}</span>
        {editing && (
          <form
            className={styles.assumptionEditor}
            onSubmit={(event) => {
              event.preventDefault();
              const value = Number(draft.replace(',', '.'));
              void submit(value);
            }}
          >
            <input
              className={styles.assumptionInput}
              inputMode="decimal"
              aria-label={COPY.assumptionValue}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoFocus
            />
            {assumption.unit && <span className={styles.assumptionUnit}>{assumption.unit}</span>}
            <button type="submit" className={styles.assumptionApply} disabled={busy}>
              {busy ? COPY.recalculating : COPY.recalculate}
            </button>
            {assumption.userSet && (
              <button
                type="button"
                className={styles.linkButton}
                disabled={busy}
                onClick={() => void submit(null)}
              >
                {COPY.resetAssumption}
              </button>
            )}
            <button
              type="button"
              className={styles.linkButton}
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
            >
              {COPY.cancel}
            </button>
            {error && <span className={styles.assumptionError}>{error}</span>}
          </form>
        )}
      </td>
      <td className={styles.mono}>
        {assumption.value !== undefined
          ? `${String(assumption.value).replace('.', locale === 'en' ? '.' : ',')}${assumption.unit ? ` ${assumption.unit}` : ''}`
          : ''}
      </td>
      <td>
        {assumption.fieldPath !== '' && (
          <span
            className={[
              styles.originTag,
              assumption.userSet ? styles.originUser : styles.originStandard,
            ].join(' ')}
          >
            {assumption.userSet ? COPY.assumptionOrigin.user : COPY.assumptionOrigin.standard}
          </span>
        )}
      </td>
      <td className={styles.assumptionAction}>
        {!editing && assumption.fieldPath !== '' && (editable || onFix) && (
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              if (editable) {
                setDraft(String(assumption.value).replace('.', ','));
                setEditing(true);
              } else onFix?.(assumption.fieldPath);
            }}
          >
            {COPY.fixAssumption}
          </button>
        )}
      </td>
    </tr>
  );
}
