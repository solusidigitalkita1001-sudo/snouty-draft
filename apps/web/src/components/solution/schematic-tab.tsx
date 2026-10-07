'use client';

/**
 * Tab "Skema" di layar solusi — prototipe menggambar skemanya DI DALAM tab, bukan hanya
 * menautkannya. Gambarnya renderer yang sama dengan halaman /schematic (`SchematicView`),
 * dibentuk ulang deterministik dari rekomendasi; halaman penuh tetap tersedia lewat tautan.
 */
import type { Schematic } from '@snouty/shared-types';
import { useEffect, useState } from 'react';
import { SchematicSidePanel, SchematicView } from '../schematic/schematic-view';
import { solutionCopy } from './solution-copy';
import { useLocale } from '../locale';
import styles from './solution.module.css';

/** Teks UI mengikuti bahasa yang dipilih (Fase 15). */
function useSolutionCopy() {
  return solutionCopy(useLocale().locale);
}

export function SchematicTab({ recommendationId }: { readonly recommendationId: string }) {
  const COPY = useSolutionCopy();
  const [schematic, setSchematic] = useState<Schematic | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSchematic(null);
    setFailed(false);
    void fetch(`/api/v1/recommendations/${encodeURIComponent(recommendationId)}/schematic`, {
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return (await response.json()) as Schematic;
      })
      .then((result) => {
        if (!cancelled) setSchematic(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [recommendationId]);

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.kicker}>{COPY.schematicKicker}</div>
        <a className={styles.linkButton} href={`/schematic?recommendation=${recommendationId}`}>
          Lihat skema instalasi →
        </a>
      </div>
      {failed && <p className={styles.body}>{COPY.schematicUnavailable}</p>}
      {!failed && schematic === null && <p className={styles.body}>{COPY.schematicLoading}</p>}
      {schematic !== null && (
        <div className={styles.schematicLayout}>
          <SchematicView schematic={schematic} />
          <SchematicSidePanel schematic={schematic} />
        </div>
      )}
    </section>
  );
}
