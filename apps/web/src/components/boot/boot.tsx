'use client';

/**
 * Layar muat pertama (P27-05, pemilik 2026-10-23: "loading snouty untuk awal2 masuk").
 *
 * Sebelum ini, masuk ke SNOUTY berarti melihat ruang konsultasi kosong sementara sesi dipulihkan
 * dan keadaan onboarding ditanyakan ke server; kalau orangnya sudah pernah datang, wizard sempat
 * berkedip dulu sebelum hilang. Dua pekerjaan itu sekarang ditunggu di satu tempat, di balik satu
 * layar bermaskot, dan isinya baru tampil setelah keduanya selesai.
 *
 * Ia TIDAK boleh menyandera orang: kalau API tidak menjawab, layar ini menyerah setelah
 * `MAX_WAIT_MS` dan aplikasinya tetap terbuka. Tidak ada pesan "memuat data" atau label teknis —
 * yang tampil hanya nama dan satu kalimat (CLAUDE.md, teks yang dilihat pengguna).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocale } from '../locale';
import { Snouty } from '../mascot/snouty';
import styles from './boot.module.css';

/** Pekerjaan yang harus selesai sebelum isi aplikasi tampil. */
export type BootStep = 'session' | 'onboarding';

const ALL_STEPS: readonly BootStep[] = ['session', 'onboarding'];

/** Batas menunggu; lewat ini isinya tampil apa adanya, berapa pun yang belum selesai. */
const MAX_WAIT_MS = 5_000;

const BootContext = createContext<(step: BootStep) => void>(() => {});

/**
 * Menandai satu pekerjaan selesai. Aman dipanggil berkali-kali dan di luar `BootGate`
 * (`/consultation` tidak memakai gate, dan komponennya tetap komponen yang sama).
 */
export function useBootStep(): (step: BootStep) => void {
  return useContext(BootContext);
}

export function BootGate({
  children,
  /** Pekerjaan yang ditunggu rute ini; `/consultation` tidak memakai onboarding. */
  steps = ALL_STEPS,
}: {
  readonly children: React.ReactNode;
  readonly steps?: readonly BootStep[];
}) {
  const [done, setDone] = useState<readonly BootStep[]>([]);
  const [timedOut, setTimedOut] = useState(false);
  const markReady = useCallback((step: BootStep) => {
    setDone((current) => (current.includes(step) ? current : [...current, step]));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  const ready = timedOut || steps.every((step) => done.includes(step));

  return (
    <BootContext.Provider value={markReady}>
      {!ready && <BootScreen />}
      {children}
    </BootContext.Provider>
  );
}

const COPY = {
  id: { name: 'SNOUTY', kicker: 'Asisten solusi perpipaan', line: 'Menyiapkan ruang konsultasi' },
  en: { name: 'SNOUTY', kicker: 'Piping solution assistant', line: 'Opening your workspace' },
} as const;

function BootScreen() {
  const { locale } = useLocale();
  const copy = useMemo(() => COPY[locale === 'en' ? 'en' : 'id'], [locale]);
  return (
    <div className={styles.screen} role="status" aria-live="polite">
      <div className={styles.mascot} aria-hidden="true">
        <Snouty mood="idle" size={168} />
      </div>
      <div className={styles.name}>{copy.name}</div>
      <div className={styles.kicker}>{copy.kicker}</div>
      <div className={styles.bar} aria-hidden="true">
        <span className={styles.barFill} />
      </div>
      <div className={styles.line}>{copy.line}</div>
    </div>
  );
}
