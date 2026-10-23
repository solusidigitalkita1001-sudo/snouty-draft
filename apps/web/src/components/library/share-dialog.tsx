'use client';

/**
 * Pop-up "Bagikan solusi" (P24-03, dibenahi P27-06 atas penilaian pemilik 2026-10-23: "ui ux pada
 * share link masih perlu dibenahi").
 *
 * Yang berubah dan mengapa:
 *
 *   - **Satu keadaan, satu tampilan.** Dulu tombol "Buat tautan" dan "Buat tautan baru" berdiri
 *     berdampingan dengan status yang terpisah, jadi tidak jelas sedang ada tautan atau tidak.
 *     Sekarang tiga keadaan dibedakan tegas: belum ada tautan, tautan baru (token di tangan), dan
 *     tautan aktif dari kunjungan lalu (token sudah tidak ada).
 *   - **Tautan langsung tersalin** begitu dibuat, dan kotaknya terpilih. Token hanya diterima
 *     sekali dari server; menutup pop-up tanpa menyalin berarti membuat tautan baru.
 *   - **Kirim lewat WhatsApp**, karena ke sanalah tautan ini pergi: tukang, toko, rekan.
 *   - **Mencabut diminta konfirmasi** — ia memutus tautan yang mungkin sudah dikirim.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../locale';
import modal from '../account/account-modal.module.css';
import { createShare, fetchShareStatus, revokeShare, type ShareStatus } from './library-api';
import { libraryCopy } from './library-copy';
import styles from './library.module.css';

/** Lama lencana "Tersalin" bertahan sebelum tombolnya kembali ke "Salin". */
const COPIED_MS = 2_000;

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
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();
    void fetchShareStatus(recommendationId).then(setStatus);
    return () => opener?.focus();
  }, [recommendationId]);

  // Escape menutup walau fokus sudah lepas dari kartu (tombol yang baru diklik menjadi nonaktif).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard ditolak (HTTP polos, izin): pilih teksnya supaya bisa disalin manual.
      urlRef.current?.select();
    }
  };

  const create = async () => {
    setBusy(true);
    setNotice(null);
    setConfirmRevoke(false);
    const link = await createShare(recommendationId);
    setBusy(false);
    if (link === null) {
      setNotice({ kind: 'error', text: COPY.shareFailed });
      return;
    }
    setUrl(link);
    setStatus({ active: true, createdAt: new Date().toISOString() });
    // Disalin sekaligus: token hanya diterima sekali, jadi "lupa menyalin" mahal.
    await copy(link);
    urlRef.current?.select();
  };

  const revoke = async () => {
    setBusy(true);
    const ok = await revokeShare(recommendationId);
    setBusy(false);
    setConfirmRevoke(false);
    if (ok) {
      setUrl(null);
      setStatus({ active: false, createdAt: null });
      setNotice({ kind: 'ok', text: COPY.shareRevoked });
    }
  };

  const active = url !== null || status?.active === true;

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
          {/* Belum ada tautan: satu kalimat tentang isinya, satu tombol. */}
          {!active && (
            <>
              <p className={styles.hint}>{COPY.shareBody}</p>
              <div className={styles.row}>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => void create()}
                  disabled={busy}
                >
                  {busy ? COPY.shareWorking : COPY.shareCreate}
                </button>
              </div>
            </>
          )}

          {/* Tautan baru, token masih di tangan: salin, kirim, cabut. */}
          {url !== null && (
            <>
              <p className={styles.shareReady}>{COPY.shareReady}</p>
              <div className={styles.linkRow}>
                <input
                  ref={urlRef}
                  id="share-url"
                  className={styles.input}
                  value={url}
                  readOnly
                  aria-label={COPY.shareLinkLabel}
                  onFocus={(event) => event.target.select()}
                />
                <button type="button" className={styles.primary} onClick={() => void copy(url)}>
                  {copied ? COPY.shareCopied : COPY.shareCopy}
                </button>
              </div>
              <div className={styles.row}>
                <a
                  className={styles.secondaryAction}
                  href={`https://wa.me/?text=${encodeURIComponent(`${COPY.shareWhatsappText} ${url}`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {COPY.shareWhatsapp}
                </a>
              </div>
              <p className={styles.hint}>{COPY.shareOnce}</p>
            </>
          )}

          {/* Tautan aktif dari kunjungan lalu: tokennya tidak disimpan siapa pun. */}
          {url === null && status?.active === true && (
            <>
              <p className={styles.shareReady}>
                {status.createdAt ? `${COPY.shareActive} ${formatDate(status.createdAt)}` : null}
              </p>
              <p className={styles.hint}>{COPY.shareLost}</p>
              <div className={styles.row}>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => void create()}
                  disabled={busy}
                >
                  {busy ? COPY.shareWorking : COPY.shareRecreate}
                </button>
              </div>
            </>
          )}

          {notice && (
            <p className={notice.kind === 'ok' ? styles.status : styles.statusError}>
              {notice.text}
            </p>
          )}

          {active && (
            <div className={styles.shareFooter}>
              {confirmRevoke ? (
                <div className={styles.row}>
                  <span className={styles.hint}>{COPY.shareRevokeConfirm}</span>
                  <button
                    type="button"
                    className={styles.danger}
                    onClick={() => void revoke()}
                    disabled={busy}
                  >
                    {COPY.shareRevokeYes}
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    onClick={() => setConfirmRevoke(false)}
                  >
                    {COPY.cancel}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.linkDanger}
                  onClick={() => setConfirmRevoke(true)}
                  disabled={busy}
                >
                  {COPY.shareRevoke}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
