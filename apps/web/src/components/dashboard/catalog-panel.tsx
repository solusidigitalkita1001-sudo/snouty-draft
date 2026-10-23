'use client';

/**
 * Katalog produk (P29-02). Versi yang pernah dimuat, dan mana yang sedang menjawab.
 *
 * API-nya sudah ada sejak Fase 1; layarnya tidak pernah menampilkan satu baris pun — ia
 * hanya memberi tahu pembacanya bahwa daftar versi "tersedia lewat API". Pemegang
 * `catalog_admin` tidak membaca API.
 *
 * Yang disebut paling keras adalah katalog contoh: selama versi aktifnya `sample`, jawaban
 * produk bukan data Pralon, dan itu harus terlihat sebelum ada yang mempercayainya.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '../locale';
import {
  fetchCatalogVersions,
  promoteCatalogVersion,
  type CatalogVersionRow,
  type Loaded,
} from './dashboard-api';
import { dashboardCopy } from './dashboard-copy';
import { EmptyState } from './empty-state';
import styles from './dashboard.module.css';

/** Berapa versi lama yang ikut ditampilkan sebelum sisanya cukup disebut jumlahnya. */
const ARCHIVED_SHOWN = 5;

export function CatalogPanel() {
  const { locale } = useLocale();
  const BOARD = dashboardCopy(locale);
  const COPY = BOARD.catalog;
  const [versions, setVersions] = useState<Loaded<{
    readonly items: readonly CatalogVersionRow[];
  }> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setVersions(await fetchCatalogVersions());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const promote = async (id: string) => {
    setBusy(id);
    setError(null);
    const problem = await promoteCatalogVersion(id);
    setBusy(null);
    if (problem !== null) {
      setError(BOARD.errors['generic'] ?? '');
      return;
    }
    await load();
  };

  if (versions === null) return <p className={styles.muted}>{BOARD.loading}</p>;
  if (versions.kind === 'forbidden') {
    return (
      <div className={styles.notice}>
        <p>{BOARD.forbidden}</p>
        <a className={styles.primary} href="/login">
          {BOARD.signIn}
        </a>
      </div>
    );
  }
  if (versions.kind === 'failed') {
    return (
      <div className={styles.notice} role="alert">
        <p>{BOARD.failed}</p>
        <button type="button" className={styles.secondary} onClick={() => void load()}>
          {BOARD.retry}
        </button>
      </div>
    );
  }

  const items = versions.value.items;
  const active = items.find((item) => item.status === 'active') ?? null;
  const others = items.filter((item) => item.status !== 'active');
  // Draft dulu — itulah yang bisa dipakai; arsip hanya beberapa yang terakhir. Riwayat
  // puluhan versi membuat satu-satunya tindakan di layar ini tenggelam di antara catatan.
  const drafts = others.filter((item) => item.status === 'draft');
  const archived = others.filter((item) => item.status !== 'draft');
  const shown = [...drafts, ...archived.slice(0, ARCHIVED_SHOWN)];
  const hidden = others.length - shown.length;

  return (
    <>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{COPY.title}</h1>
        <p className={styles.subtitle}>{COPY.subtitle}</p>
      </div>

      {error !== null && (
        <p className={styles.rowError} role="alert">
          {error}
        </p>
      )}

      {items.length === 0 && <EmptyState mood="confused" text={COPY.empty} />}

      {active !== null && active.kind === 'sample' && (
        <div className={styles.notice} role="status">
          <p>{COPY.sampleWarning}</p>
        </div>
      )}

      {active !== null && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{COPY.activeTitle}</h2>
          <div className={styles.versionRow}>
            <VersionRow item={active} locale={locale} />
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{COPY.otherTitle}</h2>
          <ul className={styles.versionList}>
            {shown.map((item) => (
              <li key={item.id} className={styles.versionRow}>
                <VersionRow item={item} locale={locale} />
                {item.status === 'draft' && (
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={busy !== null}
                    onClick={() => void promote(item.id)}
                  >
                    {busy === item.id ? COPY.promoting : COPY.promote}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {hidden > 0 && <p className={styles.muted}>{COPY.olderHidden(hidden)}</p>}
          <p className={styles.muted}>{COPY.promoteHint}</p>
        </section>
      )}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{COPY.uploadTitle}</h2>
        <p className={styles.muted}>{COPY.uploadBody}</p>
      </section>
    </>
  );
}

function VersionRow({
  item,
  locale,
}: {
  item: CatalogVersionRow;
  locale: ReturnType<typeof useLocale>['locale'];
}) {
  const COPY = dashboardCopy(locale).catalog;
  return (
    <div className={styles.versionText}>
      <span className={styles.name}>{item.label}</span>
      <span className={styles.meta}>
        {COPY.source(item.sourceDocument)} · {COPY.effective(day(item.effectiveFrom, locale))}
      </span>
      <span className={styles.leadTags}>
        <span className={styles.stageTag}>{COPY.status[item.status]}</span>
        {/* Peringatan katalog contoh hanya di versi yang bisa menjawab hari ini; di arsip ia
            hanya kebisingan yang menutupi versi yang benar-benar perlu diperhatikan. */}
        {item.kind === 'sample' && item.status !== 'archived' && (
          <span className={[styles.priority, styles['priority_hot']].join(' ')}>{COPY.sample}</span>
        )}
      </span>
    </div>
  );
}

/** Tanggal yang dibaca orang, bukan stempel waktu ISO. */
function day(iso: string, locale: ReturnType<typeof useLocale>['locale']): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(locale === 'en' ? 'en-GB' : 'id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
