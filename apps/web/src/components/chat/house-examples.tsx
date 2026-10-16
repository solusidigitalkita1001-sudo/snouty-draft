'use client';

/**
 * Contoh rumah di layar sambutan (P22-01): pengguna awam memilih yang paling mirip rumahnya,
 * lalu mengubah yang berbeda — tanpa harus tahu istilah. Daftarnya dari API (data), gambar dari
 * sprite ilustrasi. Komponen ini hanya menata; nilainya diterapkan server saat dipilih.
 */

import type { SceneIllustration } from '@snouty/ui/illustrations';
import { SceneImage } from '../illustration/illustration';
import styles from './chat-workspace.module.css';

export interface HouseExampleItem {
  readonly id: string;
  readonly image: SceneIllustration;
  readonly label: { readonly id: string; readonly en: string };
  readonly summary: { readonly id: string; readonly en: string };
}

export function HouseExamples({
  examples,
  locale,
  title,
  disabled,
  onChoose,
}: {
  examples: readonly HouseExampleItem[];
  locale: 'id' | 'en';
  title: string;
  disabled: boolean;
  onChoose: (exampleId: string) => void;
}) {
  if (examples.length === 0) return null;
  return (
    <section className={styles.welcomeExamples} aria-label={title}>
      <h2 className={styles.welcomeExamplesTitle}>{title}</h2>
      <div className={styles.exampleGrid}>
        {examples.map((example) => (
          <button
            key={example.id}
            type="button"
            className={styles.exampleCard}
            disabled={disabled}
            onClick={() => onChoose(example.id)}
          >
            <SceneImage name={example.image} className={styles.exampleImage} />
            <span className={styles.exampleLabel}>{example.label[locale]}</span>
            <span className={styles.exampleSummary}>{example.summary[locale]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
