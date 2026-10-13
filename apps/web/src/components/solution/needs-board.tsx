'use client';

/**
 * Ringkasan bergambar (DD-01 #1): kepala ringkasan dengan gambar bangunan, kartu kebutuhan, dan
 * alur air. Seluruh isi dari `needs-view`, yang membaca `Recommendation.needs` — komponen ini
 * hanya menata. Gambar lebih dulu, teks pendek di sampingnya (masukan pemilik 2026-10-13:
 * "masa text dulu sampai selesai habis itu gambar").
 */

import type { SolutionNeed } from '@snouty/shared-types';
import { SceneImage } from '../illustration/illustration';
import { useLocale } from '../locale';
import { buildingSummary, flowSteps, needCards } from '@snouty/ui/needs-view';
import { solutionCopy } from './solution-copy';
import styles from './solution.module.css';

function useNeedsCopy() {
  const { locale } = useLocale();
  return { locale, copy: solutionCopy(locale).needs };
}

/** Gambar bangunan di kiri; kicker, judul, satu baris data bangunan, dan isi ringkasan di kanan. */
export function SummaryHero({
  needs,
  kicker,
  headline,
  body,
}: {
  needs: readonly SolutionNeed[];
  kicker: string;
  headline: string;
  body: string;
}) {
  const { locale, copy } = useNeedsCopy();
  const building = buildingSummary(needs, copy, locale);
  return (
    <div className={styles.hero}>
      {building && <SceneImage name={building.image} className={styles.heroImage} />}
      <div className={styles.heroText}>
        <div className={styles.kicker}>{kicker}</div>
        <h2 className={styles.headline}>{headline}</h2>
        {building && <div className={styles.heroMeta}>{building.meta}</div>}
        <p className={styles.body}>{body}</p>
      </div>
    </div>
  );
}

/** Kartu kebutuhan selain bangunan (bangunannya sudah di kepala ringkasan). */
export function NeedsGrid({ needs }: { needs: readonly SolutionNeed[] }) {
  const { locale, copy } = useNeedsCopy();
  const cards = needCards(needs, copy, locale).filter((card) => card.key !== 'building');
  if (cards.length === 0) return null;
  return (
    <div className={styles.needs}>
      {cards.map((card) => (
        <div
          key={card.key}
          className={[styles.need, card.attention ? styles.needAttention : ''].join(' ')}
        >
          <SceneImage name={card.image} className={styles.needImage} />
          <span className={styles.needCount}>{card.count}</span>
          <span className={styles.needLabel}>{card.label}</span>
          {card.caption && <span className={styles.needCaption}>{card.caption}</span>}
        </div>
      ))}
    </div>
  );
}

export function WaterFlowCard({
  needs,
  outletCount,
}: {
  needs: readonly SolutionNeed[];
  outletCount: number;
}) {
  const { locale, copy } = useNeedsCopy();
  const steps = flowSteps(needs, outletCount, copy, locale);
  if (steps.length < 2) return null;
  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>{copy.flowTitle}</h3>
      <ol className={styles.flow}>
        {steps.map((step) => (
          <li key={step.key} className={styles.flowStep}>
            <SceneImage name={step.image} className={styles.flowImage} />
            <span className={styles.needLabel}>{step.label}</span>
            <span className={styles.needCaption}>{step.caption}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
