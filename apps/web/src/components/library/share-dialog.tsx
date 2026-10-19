'use client';

/**
 * Pop-up "Bagikan solusi" (P24-03): buat tautan baca-saja, salin, cabut. Bentuknya mengikuti pop-up
 * akun (scrim, kartu, header, tutup); isinya belum didesain (OQ-72). Token hanya terlihat sesaat
 * setelah dibuat — server menyimpan hash-nya, jadi "salin lagi nanti" berarti membuat tautan baru.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../locale';
import modal from '../account/account-modal.module.css';
import { createShare, fetchShareStatus, revokeShare, type ShareStatus } from './library-api';
import { libraryCopy } from './library-copy';
import styles from './library.module.css';

export function ShareDialog({
  recommendationId,
  onClose,
  formatDate,
}: {
  readonly recommendationId: string;
  readonly onClose: () => void;
  readonly formatDate: (iso: string) => string;
}) {
  const COPY = libraryCopy(useLocale().locale);
  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();
    void fetchShareStatus(recommendationId).then(setStatus);
    return () => opener?.focus();
  }, [recommendationId]);

  const create = async () => {
    setBusy(true);
    setNotice(null);
    const link = await createShare(recommendationId);
    setBusy(false);
    if (link === null) {
      setNotice({ kind: 'error', text: COPY.shareFailed });
      return;
    }
    setUrl(link);
    setCopied(false);
    setStatus({ active: true, createdAt: new Date().toISOString() });
  };

  const revoke = async () => {
    setBusy(true);
    const ok = await revokeShare(recommendationId);
    setBusy(false);
    if (ok) {
      setUrl(null);
      setStatus({ active: false, createdAt: null });
      setNotice({ kind: 'ok', text: COPY.shareRevoked });
    }
  };

  const copy = async () => {
    if (url === null) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard ditolak (HTTP polos, izin): pilih teksnya supaya bisa disalin manual.
      document.querySelector<HTMLInputElement>('#share-url')?.select();
    }
  };

  return (
    <div className={modal.root}>
      <div className={modal.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={cardRef}
        className={modal.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <header className={modal.header}>
          <div className={modal.headerText}>
            <h2 id="share-title" className={modal.title}>
              {COPY.shareTitle}
            </h2>
            <span className={modal.subtitle}>{COPY.shareSubtitle}</span>
          </div>
          <button type="button" className={modal.close} onClick={onClose} aria-label={COPY.close}>
            ×
          </button>
        </header>
        <div className={modal.body}>
          <p className={styles.hint}>{COPY.shareBody}</p>
          {url !== null && (
            <div className={styles.linkRow}>
              <input
                id="share-url"
                className={styles.input}
                value={url}
                readOnly
                onFocus={(e) => e.target.select()}
              />
              <button type="button" className={styles.primary} onClick={() => void copy()}>
                {copied ? COPY.shareCopied : COPY.shareCopy}
              </button>
            </div>
          )}
          {url === null && status?.active && status.createdAt && (
            <p className={styles.status}>
              {COPY.shareActive} {formatDate(status.createdAt)}
            </p>
          )}
          {notice && (
            <p className={notice.kind === 'ok' ? styles.status : styles.statusError}>
              {notice.text}
            </p>
          )}
          <div className={styles.row}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => void create()}
              disabled={busy}
            >
              {status?.active || url !== null ? COPY.shareRecreate : COPY.shareCreate}
            </button>
            {(status?.active || url !== null) && (
              <button
                type="button"
                className={styles.danger}
                onClick={() => void revoke()}
                disabled={busy}
              >
                {COPY.shareRevoke}
              </button>
            )}
          </div>
          {(status?.active || url !== null) && <p className={styles.hint}>{COPY.shareNote}</p>}
        </div>
      </div>
    </div>
  );
}
