'use client';

/**
 * Tab "Skema" di layar solusi — prototipe menggambar skemanya DI DALAM tab, bukan hanya
 * menautkannya. Gambarnya renderer yang sama dengan halaman /schematic (`SchematicView`),
 * dibentuk ulang deterministik dari rekomendasi; halaman penuh tetap tersedia lewat tautan.
 */
import type { AnySchematic } from '@snouty/shared-types';
import { useEffect, useState } from 'react';
import { SchematicSidePanel, SchematicView } from '../schematic/schematic-view';
import { solutionCopy } from './solution-copy';
import { useLocale } from '../locale';
import { authHeaders } from '../auth/session';
import styles from './solution.module.css';

/** Teks UI mengikuti bahasa yang dipilih (Fase 15). */
function useSolutionCopy() {
  return solutionCopy(useLocale().locale);
}

export function SchematicTab({
  recommendationId,
  available = true,
}: {
  readonly recommendationId: string;
  /** `false` = jenis solusi ini tidak punya skema (teknis/irigasi): tanpa permintaan ke API. */
  readonly available?: boolean;
}) {
  const COPY = useSolutionCopy();
  const [schematic, setSchematic] = useState<AnySchematic | null>(null);
  const [failed, setFailed] = useState(!available);

  useEffect(() => {
    let cancelled = false;
    setSchematic(null);
    setFailed(!available);
    if (!available) return undefined;
    void fetch(`/api/v1/recommendations/${encodeURIComponent(recommendationId)}/schematic`, {
      credentials: 'include',
      // Akun memegang access token di memori, bukan cookie — tanpa header ini pengguna yang
      // sudah masuk selalu melihat "Skema belum tersedia" (laporan pemilik 2026-10-08).
      headers: authHeaders(),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as AnySchematic | { error: unknown };
        // Endpoint menjawab NOT_FOUND sebagai badan 200 — bukan skema.
        if ('error' in body) throw new Error('NOT_FOUND');
        return body;
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
  }, [recommendationId, available]);

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.kicker}>{COPY.schematicKicker}</div>
        {/* Tautan hanya bila memang ada skema di baliknya. */}
        {schematic !== null && (
          <a className={styles.linkButton} href={`/schematic?recommendation=${recommendationId}`}>
            {COPY.schematicOpen}
          </a>
        )}
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
