'use client';

/**
 * Pratinjau laporan — overlay "Buat laporan" dari prototipe (docs/REPORT.md §8): banner
 * ESTIMASI, ringkasan, tabel material, lalu footer "Kirim ke email" / "Unduh PDF".
 *
 * Alur yang dipilih desain: pengguna melihat isinya lebih dulu; PDF adalah job asinkron
 * yang bisa gagal, dan statusnya ditampilkan apa adanya. Dua hal tidak ada di prototipe
 * dan dibangun minimal, bertanda menunggu desain: formulir identitas (API mewajibkan nama
 * pelanggan dan lokasi proyek untuk kop laporan) dan pesan hak akses (`REPORT_PDF` hanya
 * untuk tier lanjutan — tombolnya tidak berpura-pura berhasil).
 *
 * Kolom harga dan total hanya dirender bila `pricing.enabled` (OQ-03: nonaktif).
 */

import type { ReportPreview } from '@snouty/shared-types';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { Snouty } from '../mascot/snouty';
import { createReport, downloadReport, fetchReport } from './report-api';
import { reportCopy, formatRupiah } from './report-copy';
import { useLocale } from '../locale';
import styles from './report-modal.module.css';

/** Teks UI mengikuti bahasa yang dipilih (Fase 15). */
function useReportCopy() {
  return reportCopy(useLocale().locale);
}

/** Pratinjau PENDING ditanya ulang sampai PDF-nya selesai, lalu berhenti. */
const POLL_MS = 3000;
const POLL_LIMIT = 20;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Step =
  | { readonly kind: 'identity' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'preview'; readonly report: ReportPreview }
  | { readonly kind: 'not-entitled' }
  | { readonly kind: 'error' };

export function ReportModal({
  recommendationId,
  onClose,
  guest = false,
}: {
  recommendationId: string;
  onClose: () => void;
  /** Tamu tidak berhak membuat laporan (kebijakan akun): langsung ke ajakan mendaftar, tanpa POST 403. */
  guest?: boolean;
}) {
  const COPY = useReportCopy();
  const [step, setStep] = useState<Step>(guest ? { kind: 'not-entitled' } : { kind: 'identity' });
  const [customerName, setCustomerName] = useState('');
  const [projectLocation, setProjectLocation] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();
    return () => opener?.focus();
  }, []);

  // Polling status PDF: hanya selama PENDING, dan berhenti sendiri setelah batas.
  useEffect(() => {
    if (step.kind !== 'preview' || step.report.status !== 'PENDING') return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (tries > POLL_LIMIT) {
        clearInterval(timer);
        return;
      }
      void fetchReport(step.report.id).then((result) => {
        if (result.kind === 'ok') setStep({ kind: 'preview', report: result.value });
      });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [step]);

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const name = customerName.trim();
      const location = projectLocation.trim();
      if (name === '' || location === '') return;
      setStep({ kind: 'loading' });
      const created = await createReport({
        recommendationId,
        customerName: name,
        projectLocation: location,
      });
      if (created.kind !== 'ok') {
        setStep({ kind: created.kind });
        return;
      }
      const preview = await fetchReport(created.value.id);
      setStep(
        preview.kind === 'ok' ? { kind: 'preview', report: preview.value } : { kind: 'error' },
      );
    },
    [customerName, projectLocation, recommendationId],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !cardRef.current) return;
      const focusable = Array.from(cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === cardRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  const report = step.kind === 'preview' ? step.report : null;
  const [download, setDownload] = useState<'idle' | 'busy' | 'failed'>('idle');
  const startDownload = useCallback(async () => {
    if (!report || download === 'busy') return;
    setDownload('busy');
    const ok = await downloadReport(report.id, `${report.reportNumber}.pdf`);
    setDownload(ok ? 'idle' : 'failed');
  }, [download, report]);

  const pdfNote =
    download === 'busy'
      ? COPY.downloading
      : download === 'failed'
        ? COPY.downloadError
        : report
          ? COPY.pdf[report.status]
          : '';

  return (
    <div className={styles.root}>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={cardRef}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label={COPY.title}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <Snouty mood="write" size={56} />
            <div className={styles.headerText}>
              <div className={styles.title}>{COPY.title}</div>
              {report && <div className={styles.number}>{COPY.number(report.reportNumber)}</div>}
            </div>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label={COPY.close}>
            ×
          </button>
        </header>

        <div className={styles.body} aria-busy={step.kind === 'loading'}>
          {step.kind === 'identity' && (
            <form className={styles.identity} onSubmit={submit} data-needs-design="true">
              <div className={styles.identityHead}>
                <span className={styles.kicker}>{COPY.identity.title}</span>
                <span className={styles.needsDesign}>{COPY.needsDesign}</span>
              </div>
              <label className={styles.field}>
                <span>{COPY.identity.customerName}</span>
                <input
                  className={styles.input}
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  required
                  maxLength={120}
                  autoComplete="name"
                />
              </label>
              <label className={styles.field}>
                <span>{COPY.identity.projectLocation}</span>
                <input
                  className={styles.input}
                  value={projectLocation}
                  onChange={(event) => setProjectLocation(event.target.value)}
                  required
                  maxLength={160}
                />
              </label>
              <p className={styles.hint}>{COPY.identity.hint}</p>
              <button type="submit" className={styles.primary}>
                {COPY.identity.submit}
              </button>
            </form>
          )}
          {step.kind === 'loading' && <p className={styles.status}>{COPY.loading}</p>}
          {step.kind === 'not-entitled' && <p className={styles.status}>{COPY.notEntitled}</p>}
          {step.kind === 'error' && <p className={styles.status}>{COPY.error}</p>}
          {report && <Preview report={report} />}
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.link} onClick={onClose}>
            {COPY.back}
          </button>
          {report && (
            <div className={styles.footerActions}>
              <span className={styles.pdfStatus} role="status">
                {pdfNote}
              </span>
              {/* `POST /reports/:id/email` belum ada di API — tombolnya tidak berpura-pura. */}
              <button
                type="button"
                className={styles.secondary}
                disabled
                title={COPY.emailUnavailable}
              >
                {COPY.email}
              </button>
              <button
                type="button"
                className={styles.primary}
                disabled={report.status !== 'READY' || download === 'busy'}
                onClick={() => void startDownload()}
              >
                {COPY.download}
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}

function Preview({ report }: { report: ReportPreview }) {
  const COPY = useReportCopy();
  const { payload } = report;
  const priced = payload.pricing.enabled;
  const grid = priced ? styles.rowPriced : styles.row;

  return (
    <>
      <div className={styles.banner}>
        <span className={styles.estimateTag}>{COPY.estimateTag}</span>
        <span className={styles.bannerText}>{COPY.estimateNote}</span>
      </div>

      <section className={styles.section}>
        <span className={styles.kicker}>{COPY.summaryTitle}</span>
        <p className={styles.headline}>{payload.headline}</p>
      </section>

      <div className={styles.table} role="table">
        <div className={[grid, styles.tableHead].join(' ')} role="row">
          <span role="columnheader">{COPY.columns.item}</span>
          <span role="columnheader">{COPY.columns.size}</span>
          <span role="columnheader">{COPY.columns.quantity}</span>
          {priced && (
            <span role="columnheader" className={styles.right}>
              {COPY.columns.subtotal}
            </span>
          )}
        </div>
        {payload.bom.map((item, index) => (
          <div key={`${item.item}-${index}`} className={grid} role="row">
            <span role="cell" className={styles.cellItem}>
              {item.item}
            </span>
            <span role="cell" className={styles.cellMono}>
              {item.size}
            </span>
            <span role="cell" className={styles.cellQty}>
              {item.quantity} {item.unit}
            </span>
            {priced && (
              <span
                role="cell"
                className={[styles.cellMono, styles.right, styles.strong].join(' ')}
              >
                {item.subtotal !== undefined ? formatRupiah(item.subtotal) : '—'}
              </span>
            )}
          </div>
        ))}
        {priced && (
          <div className={styles.totals}>
            <div className={styles.totalsBox}>
              <div className={styles.totalRow}>
                <span className={styles.muted}>{COPY.subtotal}</span>
                <span className={styles.cellMono}>{formatRupiah(payload.pricing.subtotal)}</span>
              </div>
              <div className={styles.totalRow}>
                <span className={styles.muted}>{COPY.tax(payload.pricing.taxRatePercent)}</span>
                <span className={styles.cellMono}>{formatRupiah(payload.pricing.taxAmount)}</span>
              </div>
              <div className={[styles.totalRow, styles.grandTotal].join(' ')}>
                <span>{COPY.total}</span>
                <span className={styles.cellMono}>{formatRupiah(payload.pricing.total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className={styles.footnote}>{COPY.footnote}</p>
    </>
  );
}
