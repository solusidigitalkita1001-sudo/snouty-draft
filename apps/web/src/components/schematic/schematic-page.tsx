'use client';

/**
 * Layar 09 — skema penuh: kanvas + panel DAFTAR JALUR dan blok judul.
 *
 * Topologi diambil dari API (`GET /recommendations/:id/schematic`), yang membentuknya
 * ulang deterministik dari snapshot tersimpan. Komponen ini tidak menghitung apa pun.
 */

import type { Schematic } from '@snouty/shared-types';
import { useEffect, useState } from 'react';
import { schematicCopy } from './schematic-copy';
import { useLocale } from '../locale';
import { authHeaders, restoreSession } from '../auth/session';
import { SchematicSidePanel, SchematicView } from './schematic-view';
import styles from './schematic-page.module.css';

/** Teks UI mengikuti bahasa yang dipilih (Fase 15). */
function useSchematicCopy() {
  return schematicCopy(useLocale().locale);
}

export function SchematicPage() {
  const COPY = useSchematicCopy();
  const [schematic, setSchematic] = useState<Schematic | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // `recommendationId` dari query string: halaman ini dibuka dari layar 06 atau
    // dibagikan sebagai tautan, jadi id-nya memang milik URL.
    const id = new URLSearchParams(window.location.search).get('recommendation');
    if (!id) {
      setError('Tautan skema tidak menyertakan id rekomendasi.');
      return;
    }

    let cancelled = false;
    // Halaman baru: sesi akun dipulihkan dulu, lalu token ikut dikirim (tamu memakai cookie).
    void restoreSession()
      .then(() =>
        fetch(`/api/v1/recommendations/${encodeURIComponent(id)}/schematic`, {
          credentials: 'include',
          headers: authHeaders(),
        }),
      )
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return (await response.json()) as Schematic;
      })
      .then((result) => {
        if (!cancelled) setSchematic(result);
      })
      .catch(() => {
        if (!cancelled) setError('Skema belum tersedia untuk konsultasi ini.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{COPY.title}</h1>
      {error !== null && <p className={styles.error}>{error}</p>}
      {schematic !== null && (
        <div className={styles.layout}>
          <SchematicView schematic={schematic} />
          <SchematicSidePanel schematic={schematic} />
        </div>
      )}
    </main>
  );
}
