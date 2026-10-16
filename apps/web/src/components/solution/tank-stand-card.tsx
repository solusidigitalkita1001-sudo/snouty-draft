'use client';

/**
 * Tinggi toren (P22-04): tekanan di titik air tertinggi untuk tiap dudukan — dak atap atau tiang
 * toren — dari ENG-711. Menjawab "toren harus di ketinggian berapa supaya deras tanpa pompa":
 * tiap pilihan bergambar, pilihan terendah yang cukup ditandai, ukuran pipa dari toren dan di
 * dalam rumah disebut di bawahnya. Angka dari engine; komponen ini hanya menata.
 */

import type { TankStandOption, TankStandView } from '@snouty/shared-types';
import { SceneImage } from '../illustration/illustration';
import { useLocale } from '../locale';
import { solutionCopy } from './solution-copy';
import styles from './solution.module.css';

function decimal(value: number, locale: string): string {
  return value.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 });
}

export function TankStandCard({ view }: { view: TankStandView }) {
  const { locale } = useLocale();
  const copy = solutionCopy(locale).tankStand;
  const d = (n: number) => decimal(n, locale);
  const label = (option: TankStandOption) =>
    option.kind === 'roof_slab' ? copy.roofSlab : copy.tower(d(option.supportHeightM));
  const caption = (option: TankStandOption) =>
    option.comfortable ? copy.strong : option.meetsMinimum ? copy.enough : copy.short;
  const recommended = view.recommendedIndex === null ? null : view.options[view.recommendedIndex];
  const branches = view.branchSizes.join(' / ');
  return (
    <section className={styles.card} data-testid="tank-stand">
      <h3 className={styles.cardTitle}>{copy.title}</h3>
      <p className={styles.body}>
        {recommended
          ? copy.lead(label(recommended), d(view.minimumBar))
          : copy.leadNone(d(view.minimumBar))}
      </p>
      <div className={styles.needs}>
        {view.options.map((option, index) => (
          <div
            key={`${option.kind}-${option.supportHeightM}`}
            className={[
              styles.need,
              index === view.recommendedIndex ? styles.needRecommended : '',
              option.meetsMinimum ? '' : styles.needAttention,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <SceneImage
              name={option.kind === 'roof_slab' ? 'tank' : 'tankup'}
              className={styles.needImage}
            />
            <span className={styles.needCount}>{copy.bar(d(option.residualBar))}</span>
            <span className={styles.needLabel}>{label(option)}</span>
            <span className={styles.needCaption}>
              {copy.waterLevel(d(option.waterLevelM))} · {caption(option)}
            </span>
          </div>
        ))}
      </div>
      <p className={styles.needCaption}>
        {copy.pipes(view.mainSize, branches)}{' '}
        {view.comfortableIndex === null ? copy.strongNeedsPump(d(view.comfortBar)) : ''}
      </p>
    </section>
  );
}
