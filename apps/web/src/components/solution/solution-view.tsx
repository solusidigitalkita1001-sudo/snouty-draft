'use client';

/**
 * Layar 06 — workspace solusi, dan kartu produk layar 07.
 * Dari prototipe baru. docs/DESIGN_IMPLEMENTATION.md.
 *
 * Seluruh angka di sini datang dari `Recommendation` yang dirakit server; komponen ini
 * tidak menghitung apa pun. Kolom "DASAR PERHITUNGAN" merender `basis` dari trace
 * aturan, bukan prosa — itulah yang membuat auditabilitas SPEC §8 terlihat pengguna.
 */

import type { ComposedResponse, Recommendation, SelectedProduct } from '@snouty/shared-types';
import { useState } from 'react';
import { ProductDrawer, type DrawerSelection } from '../product/product-drawer';
import { SchematicTab } from './schematic-tab';
import { SOLUTION_COPY as COPY } from './solution-copy';
import { ProvenanceTag } from './provenance-tag';
import styles from './solution.module.css';

/** Tab layar solusi (prototipe `tabDefs`). Tanpa `tab`, seluruh bagian dirender berurutan. */
export type SolutionTab = 'ringkasan' | 'produk' | 'skema' | 'material';

export function SolutionView({
  recommendation,
  onFixAssumption,
  tab,
}: {
  recommendation: Recommendation;
  onFixAssumption?: (fieldPath: string) => void;
  tab?: SolutionTab;
}) {
  const [showTechnical, setShowTechnical] = useState(false);
  const [openProduct, setOpenProduct] = useState<DrawerSelection | null>(null);
  const { stats } = recommendation;
  const on = (which: SolutionTab) => tab === undefined || tab === which;

  return (
    <div className={styles.workspace}>
      {on('skema') && tab !== undefined && <SchematicTab recommendationId={recommendation.id} />}

      {on('ringkasan') && (
        <section className={styles.card}>
          <div className={styles.kicker}>{COPY.summaryKicker}</div>
          <h2 className={styles.headline}>{recommendation.headline}</h2>
          <p className={styles.body}>{recommendation.body}</p>
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
            {/* Skema dibentuk ulang deterministik dari snapshot — jadi tautannya cukup id. */}
            <a
              className={styles.linkButton}
              href={`/schematic?recommendation=${recommendation.id}`}
            >
              Lihat skema instalasi →
            </a>
          </div>
        </section>
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
              {/* Dirender dari trace aturan — bukan prosa LLM (invarian T-1). */}
              {recommendation.systemLines.map((line) => (
                <p key={line.name} className={styles.technicalLine}>
                  {line.reason}
                </p>
              ))}
            </div>
          )}
        </section>
      )}

      {on('ringkasan') && recommendation.composition && (
        <CompositionOptions composition={recommendation.composition} />
      )}

      {on('material') && (
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>{COPY.bomTitle}</h3>
          <div className={styles.bomTable} role="table">
            <div className={styles.bomHeadRow} role="row">
              <span role="columnheader">{COPY.bomColumns.item}</span>
              <span role="columnheader">{COPY.bomColumns.size}</span>
              <span role="columnheader">{COPY.bomColumns.quantity}</span>
              <span role="columnheader">{COPY.bomColumns.basis}</span>
            </div>
            {recommendation.bom.map((item, index) => (
              <div key={`${item.item}-${item.size}-${index}`} className={styles.bomRow} role="row">
                <span role="cell">{item.item}</span>
                <span className={styles.mono} role="cell">
                  {item.size}
                </span>
                <span className={styles.mono} role="cell">
                  {item.quantity} {item.unit}
                </span>
                <span className={styles.bomBasis} role="cell">
                  {item.basis} <ProvenanceTag provenance={item.provenance} />
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {on('material') && recommendation.assumptions.length > 0 && (
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>{COPY.assumptionsTitle}</h3>
          {recommendation.assumptions.map((assumption) => (
            <div
              key={`${assumption.fieldPath}-${assumption.text}`}
              className={styles.assumptionRow}
            >
              <span className={styles.assumptionText}>{assumption.text}</span>
              {onFixAssumption && (
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => onFixAssumption(assumption.fieldPath)}
                >
                  {COPY.fixAssumption}
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {on('material') && recommendation.composition && (
        <CompositionData composition={recommendation.composition} />
      )}

      {on('produk') && recommendation.products.length > 0 && (
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>{COPY.productsTitle}</h3>
          <div className={styles.productGrid}>
            {recommendation.products.map((product) => (
              <ProductCard
                key={`${product.productId}-${product.role}`}
                product={product}
                onOpen={() => setOpenProduct(product)}
              />
            ))}
          </div>
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

/** Kartu produk layar 07 — tiga keadaan, label dari desain. */
function ProductCard({ product, onOpen }: { product: SelectedProduct; onOpen: () => void }) {
  return (
    <button type="button" className={styles.productCard} onClick={onOpen}>
      <div className={styles.productRole}>{product.role.toUpperCase()}</div>
      <div className={styles.productSize}>{product.size}</div>
      <p className={styles.productReason}>{product.reason}</p>
      <span
        className={[
          styles.productState,
          product.matchState === 'VERIFIED_SELECTED' ? styles.productStateOk : '',
          product.matchState === 'SIZE_NEEDS_VALIDATION' ? styles.productStateWarn : '',
        ].join(' ')}
      >
        {COPY.matchStateLabel[product.matchState]}
      </span>
    </button>
  );
}

/** Warna bar peran: main merah merek, cabang lebih muda, fixture paling muda. */
function roleToneClass(role: SelectedProduct['role']): string {
  if (role === 'main' || role === 'riser') return styles.roleMain!;
  if (role === 'branch') return styles.roleBranch!;
  return styles.roleFixture!;
}
