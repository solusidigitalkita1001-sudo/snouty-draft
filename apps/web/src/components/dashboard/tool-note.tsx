'use client';

/**
 * Alat internal yang isinya memang belum ada (P29-03): validasi aturan dan peninjauan email.
 *
 * Keduanya menunggu orang, bukan menunggu kode — ahli pipa yang menandatangani aturan, dan
 * kotak masuk yang disambungkan. Layarnya mengatakan itu dengan kalimat biasa: pembacanya
 * orang Pralon, yang tidak tahu apa itu "OQ-06" dan tidak perlu tahu.
 */
import { useLocale } from '../locale';
import { dashboardCopy } from './dashboard-copy';
import styles from './dashboard.module.css';

export function ToolNote({ section }: { section: 'rules' | 'email' }) {
  const COPY = dashboardCopy(useLocale().locale)[section];
  return (
    <>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{COPY.title}</h1>
        <p className={styles.subtitle}>{COPY.subtitle}</p>
      </div>
      <section className={styles.card}>
        <p className={styles.contextText}>{COPY.body}</p>
      </section>
    </>
  );
}
