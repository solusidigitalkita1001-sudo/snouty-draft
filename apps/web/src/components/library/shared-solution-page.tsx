'use client';

/**
 * Halaman tautan bagikan `/shared?t=…` (P24-03): solusi baca-saja untuk tukang, toko, atau rekan.
 * Tanpa akun, tanpa percakapan; isinya layar solusi yang sama dalam mode `shared`.
 */
import type { SharedSolution } from '@snouty/shared-types';
import { useEffect, useState } from 'react';
import { chatCopy } from '../chat/chat-copy';
import { LocaleToggle, useLocale } from '../locale';
import { SnoutyAvatar } from '../mascot/snouty';
import { SolutionView, type SolutionTab } from '../solution/solution-view';
import { ThemeToggle } from '../theme-toggle';
import { fetchShared } from './library-api';
import { libraryCopy } from './library-copy';
import styles from './library.module.css';

export function SharedSolutionPage() {
  const { locale } = useLocale();
  const COPY = libraryCopy(locale);
  const CHAT = chatCopy(locale);
  const [data, setData] = useState<SharedSolution | 'loading' | 'not_found' | 'error'>('loading');
  const [tab, setTab] = useState<SolutionTab>('ringkasan');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('t');
    if (!token) {
      setData('not_found');
      return;
    }
    void fetchShared(token)
      .then(setData)
      .catch(() => setData('error'));
  }, []);

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
          <ThemeToggle compact />
          <LocaleToggle compact />
        </div>
      </header>
      <main className={styles.sharedBody}>
        {data === 'loading' && <p className={styles.hint}>{COPY.sharedLoading}</p>}
        {data === 'not_found' && <p className={styles.hint}>{COPY.sharedNotFound}</p>}
        {data === 'error' && <p className={styles.statusError}>{COPY.sharedError}</p>}
        {typeof data === 'object' && (
          <>
            <div className={styles.kicker}>{COPY.sharedKicker}</div>
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
            <div className={styles.row}>
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
