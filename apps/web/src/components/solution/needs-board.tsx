'use client';

/**
 * Ringkasan bergambar (DD-01 #1): kartu kebutuhan dan alur air. Seluruh isi dari `needs-view`,
 * yang membaca `Recommendation.needs` — komponen ini hanya menata.
 */

import type { SolutionNeed } from '@snouty/shared-types';
import { SceneImage } from '../illustration/illustration';
import { useLocale } from '../locale';
import { flowSteps, needCards } from './needs-view';
import { solutionCopy } from './solution-copy';
import styles from './solution.module.css';

export function NeedsBoard({
  needs,
  outletCount,
}: {
  needs: readonly SolutionNeed[];
  outletCount: number;
}) {
  const { locale } = useLocale();
  const copy = solutionCopy(locale).needs;
  const cards = needCards(needs, copy, locale);
  const steps = flowSteps(needs, outletCount, copy, locale);
  return (
    <>
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
      {steps.length > 1 && (
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
      )}
    </>
  );
}
