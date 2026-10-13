'use client';

/**
 * Denah di tab Denah (DD-01 #7, P17-07): potongan instalasi dan denah jalur per lantai. Gambarnya
 * dari `@snouty/ui/installation-drawing` — SVG yang sama dengan laporan — dan datanya kebutuhan
 * rekomendasi. String SVG dibuat oleh modul kita sendiri dengan label yang di-escape, jadi aman
 * disisipkan.
 */

import type { SolutionNeed } from '@snouty/shared-types';
import { drawingInputFrom, floorPlanSvg, sectionSvg } from '@snouty/ui/installation-drawing';
import { useLocale } from '../locale';
import { solutionCopy } from './solution-copy';
import styles from './solution.module.css';

export function InstallationDrawingCard({ needs }: { needs: readonly SolutionNeed[] }) {
  const { locale } = useLocale();
  const COPY = solutionCopy(locale);
  const copy = {
    ...COPY.drawing,
    decimal: (value: number) =>
      value.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 }),
  };
  const input = drawingInputFrom(needs);
  if (input === null) return null;
  const levels = Array.from({ length: input.floors }, (_, i) => input.floors - i);
  return (
    <>
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>{COPY.drawing.sectionTitle}</h3>
        <div className={styles.drawingLegend}>
          <span>
            <i style={{ borderColor: 'var(--snouty-pipe-main)' }} />
            {COPY.drawing.legend.main}
          </span>
          <span>
            <i style={{ borderColor: 'var(--snouty-pipe-mid)' }} />
            {COPY.drawing.legend.branch}
          </span>
          {input.drainage && (
            <>
              <span>
                <i style={{ borderColor: 'var(--snouty-muted)' }} />
                {COPY.drawing.legend.soil}
              </span>
              <span>
                <i style={{ borderColor: 'var(--snouty-muted-2)' }} />
                {COPY.drawing.legend.waste}
              </span>
            </>
          )}
        </div>
        <div
          className={styles.drawing}
          dangerouslySetInnerHTML={{ __html: sectionSvg(input, copy) }}
        />
        <p className={styles.drawingNote}>{COPY.drawing.note}</p>
      </section>
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>{COPY.drawing.plansTitle}</h3>
        <div className={styles.plans}>
          {levels.map((level) => (
            <figure key={level} className={styles.plan}>
              <figcaption>{COPY.drawing.planCaption(level)}</figcaption>
              <div dangerouslySetInnerHTML={{ __html: floorPlanSvg(input, level, copy) }} />
            </figure>
          ))}
        </div>
      </section>
    </>
  );
}
