'use client';

/**
 * Layar 06 — workspace solusi, dan kartu produk layar 07.
 * Dari prototipe baru. docs/DESIGN_IMPLEMENTATION.md.
 *
 * Seluruh angka di sini datang dari `Recommendation` yang dirakit server; komponen ini
 * tidak menghitung apa pun. Kolom "DASAR PERHITUNGAN" merender `basis` dari trace
 * aturan, bukan prosa — itulah yang membuat auditabilitas SPEC §8 terlihat pengguna.
 */

import type { Recommendation, SelectedProduct } from '@snouty/shared-types';
import { useState } from 'react';
import { SOLUTION_COPY as COPY } from './solution-copy';
import { ProvenanceTag } from './provenance-tag';
import styles from './solution.module.css';

export function SolutionView({
  recommendation,
  onFixAssumption,
}: {
  recommendation: Recommendation;
  onFixAssumption?: (fieldPath: string) => void;
}) {
  const [showTechnical, setShowTechnical] = useState(false);
  const { stats } = recommendation;

  return (
    <div className={styles.workspace}>
      <section className={styles.card}>
        <div className={styles.kicker}>{COPY.summaryKicker}</div>
        <h2 className={styles.headline}>{recommendation.headline}</h2>
        <p className={styles.body}>{recommendation.body}</p>
        <div className={styles.statsRow}>
          <Stat label={COPY.statsLabels.outletCount} value={String(stats.outletCount)} />
          <Stat label={COPY.statsLabels.mainSize} value={stats.mainSize} mono />
          <Stat label={COPY.statsLabels.branch} value={String(stats.branchCount)} />
          <Stat label={COPY.statsLabels.fixture} value={stats.fixtureConnectionSize} mono />
          <Stat label={COPY.statsLabels.products} value={`${stats.productCount} item`} />
        </div>
        <div className={styles.summaryFooter}>
          <span className={styles.disclaimer}>{COPY.planningDisclaimer}</span>
          {/* Skema dibentuk ulang deterministik dari snapshot — jadi tautannya cukup id. */}
          <a className={styles.linkButton} href={`/skema?recommendation=${recommendation.id}`}>
            Lihat skema instalasi →
          </a>
        </div>
      </section>

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

      {recommendation.assumptions.length > 0 && (
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

      {recommendation.products.length > 0 && (
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>{COPY.productsTitle}</h3>
          <div className={styles.productGrid}>
            {recommendation.products.map((product) => (
              <ProductCard key={`${product.productId}-${product.role}`} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
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
function ProductCard({ product }: { product: SelectedProduct }) {
  return (
    <div className={styles.productCard}>
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
    </div>
  );
}

/** Warna bar peran: main merah merek, cabang lebih muda, fixture paling muda. */
function roleToneClass(role: SelectedProduct['role']): string {
  if (role === 'main' || role === 'riser') return styles.roleMain!;
  if (role === 'branch') return styles.roleBranch!;
  return styles.roleFixture!;
}
