'use client';

/**
 * Tindak lanjut sebuah prospek (P27-09, pemilik 2026-10-23: "CRM mengenai prospek harus di
 * dalemin lebih lanjut"): kapan ditengok lagi, catatan apa yang terjadi, dan jejak lengkapnya.
 *
 * Dipisah dari `sales-dashboard.tsx` karena ia punya datanya sendiri (jejak ditarik terpisah dari
 * ringkasan) dan siklus muatnya sendiri — bukan karena berkasnya panjang.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '../locale';
import { dashboardCopy } from './dashboard-copy';
import {
  addLeadNote,
  fetchLeadActivity,
  setLeadFollowUp,
  type LeadActivityItem,
} from './dashboard-api';
import { salesCopy } from './sales-copy';
import styles from './dashboard.module.css';

/** `2026-11-02T03:00:00.000Z` → `2026-11-02`, bentuk yang diterima `<input type="date">`. */
export function dateInputValue(iso: string | null): string {
  if (iso === null) return '';
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '' : (at.toISOString().split('T')[0] ?? '');
}

/** Tanggal saja (tanpa jam): jadwal menengok diputuskan per hari, bukan per menit. */
export function isOverdue(iso: string | null, now: Date = new Date()): boolean {
  if (iso === null) return false;
  const at = new Date(iso);
  return !Number.isNaN(at.getTime()) && at.getTime() < now.setHours(0, 0, 0, 0);
}

export function LeadFollowUp({
  userId,
  followUpAt,
  onChanged,
}: {
  readonly userId: string;
  readonly followUpAt: string | null;
  readonly onChanged: () => void;
}) {
  const { locale } = useLocale();
  const COPY = salesCopy(locale);
  const BOARD = dashboardCopy(locale);
  const [date, setDate] = useState(dateInputValue(followUpAt));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [trail, setTrail] = useState<readonly LeadActivityItem[]>([]);

  const load = useCallback(() => {
    void fetchLeadActivity(userId).then((result) => {
      if (result.kind === 'ok') setTrail(result.value.items);
    });
  }, [userId]);

  useEffect(() => {
    setDate(dateInputValue(followUpAt));
    load();
  }, [followUpAt, load]);

  const day = (iso: string | null) =>
    iso === null
      ? null
      : new Date(iso).toLocaleDateString(locale === 'en' ? 'en-GB' : 'id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });

  const moment = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'en' ? 'en-GB' : 'id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  const saveDate = async (value: string | null) => {
    setBusy(true);
    // Tengah hari lokal, bukan tengah malam: pergeseran zona waktu tidak menggeser harinya.
    await setLeadFollowUp(
      userId,
      value === null ? null : new Date(`${value}T12:00:00`).toISOString(),
    );
    setBusy(false);
    onChanged();
    load();
  };

  const saveNote = async () => {
    if (note.trim() === '') return;
    setBusy(true);
    await addLeadNote(userId, note.trim());
    setBusy(false);
    setNote('');
    load();
  };

  const lineOf = (row: LeadActivityItem): string => {
    if (row.kind === 'note') return row.note ?? '';
    if (row.kind === 'assigned') return COPY.trail.assigned;
    if (row.kind === 'follow_up') return COPY.trail.followUp(day(row.followUpAt));
    const label = row.status === null ? '' : BOARD.leadStatus[row.status];
    return row.note === null
      ? COPY.trail.status(label)
      : `${COPY.trail.status(label)} — ${row.note}`;
  };

  return (
    <>
      <div className={styles.block}>
        <span className={styles.blockTitle}>{COPY.followUp.title}</span>
        <div className={styles.addForm}>
          <input
            type="date"
            className={styles.control}
            aria-label={COPY.followUp.label}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <button
            type="button"
            className={styles.primary}
            disabled={busy || date === ''}
            onClick={() => void saveDate(date)}
          >
            {COPY.followUp.set}
          </button>
          {followUpAt !== null && (
            <button
              type="button"
              className={styles.secondary}
              disabled={busy}
              onClick={() => void saveDate(null)}
            >
              {COPY.followUp.clear}
            </button>
          )}
        </div>
        {followUpAt === null ? (
          <p className={styles.muted}>{COPY.followUp.none}</p>
        ) : (
          isOverdue(followUpAt) && (
            <p className={styles.rowError} role="status">
              {COPY.followUp.due}
            </p>
          )
        )}
      </div>

      <div className={styles.block}>
        <span className={styles.blockTitle}>{COPY.notes.title}</span>
        <div className={styles.addForm}>
          <input
            className={[styles.control, styles.search].join(' ')}
            aria-label={COPY.notes.title}
            placeholder={COPY.notes.placeholder}
            maxLength={1000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <button
            type="button"
            className={styles.primary}
            disabled={busy || note.trim() === ''}
            onClick={() => void saveNote()}
          >
            {COPY.notes.add}
          </button>
        </div>
        {trail.length === 0 ? (
          <p className={styles.muted}>{COPY.notes.empty}</p>
        ) : (
          <ol className={styles.trail}>
            {trail.map((row) => (
              <li key={row.id} className={styles.trailItem}>
                <span className={styles.trailText}>{lineOf(row)}</span>
                <span className={styles.trailMeta}>
                  {COPY.notes.byAt(row.actorName ?? COPY.notes.someone, moment(row.at))}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}
