'use client';

/**
 * Halaman tautan bagikan `/shared?t=…` (P24-03; dibenahi P27-06 atas penilaian pemilik 2026-10-23:
 * "ui ux pada share link masih perlu dibenahi"): solusi baca-saja untuk tukang, toko, atau rekan.
 * Tanpa akun, tanpa percakapan; isinya layar solusi yang sama dalam mode `shared`.
 *
 * Yang berubah: tiga keadaan (memuat, tidak ada, gagal) punya kartunya sendiri dengan maskot dan
 * jalan keluar — dulu ketiganya satu baris teks abu-abu di tengah halaman kosong. Judulnya
 * ditemani lencana baca-saja supaya penerima langsung tahu ia tidak bisa mengubah apa pun, dan
 * ada tombol cetak: tautan ini sering berakhir di tangan tukang, bukan di layar.
 */
import type { SharedSolution } from '@snouty/shared-types';
import { useCallback, useEffect, useState } from 'react';
import { chatCopy } from '../chat/chat-copy';
import { LocaleToggle, useLocale } from '../locale';
import { Snouty, SnoutyAvatar } from '../mascot/snouty';
import { SolutionView, type SolutionTab } from '../solution/solution-view';
import { ThemeToggle } from '../theme-toggle';
import { fetchShared } from './library-api';
import { libraryCopy } from './library-copy';
import styles from './library.module.css';

type State = SharedSolution | 'loading' | 'not_found' | 'error';

export function SharedSolutionPage() {
  const { locale } = useLocale();
  const COPY = libraryCopy(locale);
  const CHAT = chatCopy(locale);
  const [data, setData] = useState<State>('loading');
  const [tab, setTab] = useState<SolutionTab>('ringkasan');

  const load = useCallback(() => {
    const token = new URLSearchParams(window.location.search).get('t');
    if (!token) {
      setData('not_found');
      return;
    }
    setData('loading');
    void fetchShared(token)
      .then(setData)
      .catch(() => setData('error'));
  }, []);

  useEffect(load, [load]);

  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'en' ? 'en-GB' : 'id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  return (
    <div className={styles.sharedShell}>
      <header className={styles.sharedHeader}>
        <a className={styles.sharedBrand} href="/consultation">
          <SnoutyAvatar mood="idle" size={28} />
          <span className={styles.sharedBrandName}>SNOUTY</span>
        </a>
        <div className={styles.row}>
          {typeof data === 'object' && (
            <button type="button" className={styles.secondaryAction} onClick={() => window.print()}>
              {COPY.sharedPrint}
            </button>
          )}
          <ThemeToggle compact />
          <LocaleToggle compact />
        </div>
      </header>

      <main className={styles.sharedBody}>
        {data === 'loading' && (
          <div className={styles.sharedState} role="status" aria-live="polite">
            <Snouty mood="idle" size={120} />
            <p className={styles.hint}>{COPY.sharedLoading}</p>
          </div>
        )}

        {data === 'not_found' && (
          <div className={styles.sharedState}>
            <Snouty mood="fail" size={120} />
            <h1 className={styles.sharedStateTitle}>{COPY.sharedNotFoundTitle}</h1>
            <p className={styles.hint}>{COPY.sharedNotFound}</p>
            <a className={styles.primary} href="/consultation">
              {COPY.sharedCta}
            </a>
          </div>
        )}

        {data === 'error' && (
          <div className={styles.sharedState}>
            <Snouty mood="think" size={120} />
            <h1 className={styles.sharedStateTitle}>{COPY.sharedErrorTitle}</h1>
            <p className={styles.hint}>{COPY.sharedError}</p>
            <button type="button" className={styles.primary} onClick={load}>
              {COPY.sharedRetry}
            </button>
          </div>
        )}

        {typeof data === 'object' && (
          <>
            <div className={styles.sharedTop}>
              <span className={styles.kicker}>{COPY.sharedKicker}</span>
              <span className={styles.sharedBadge}>{COPY.sharedReadOnly}</span>
            </div>
            <h1 className={styles.sharedTitle}>{data.title ?? data.recommendation.headline}</h1>
            <p className={styles.hint}>
              {COPY.sharedAt} {date(data.sharedAt)} · {COPY.sharedNotice}
            </p>
            <div className={styles.tabs} role="tablist">
              {CHAT.solutionTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={[styles.tab, tab === t.id ? styles.tabOn : ''].join(' ')}
                  onClick={() => setTab(t.id as SolutionTab)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <SolutionView
              recommendation={data.recommendation}
              tab={tab}
              shared={{ schematic: data.schematic }}
            />
            <div className={styles.sharedCta}>
              <a className={styles.primary} href="/consultation">
                {COPY.sharedCta}
              </a>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
