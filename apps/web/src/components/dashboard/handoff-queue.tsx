'use client';

/**
 * Antrean teknis (P29-01). Kasus dari "Kirim ke tim teknis Pralon".
 *
 * Barisnya sudah tersimpan sejak Fase 8, tetapi sampai sekarang tidak ada layar yang
 * membacanya — layar ini dulu hanya memuat satu paragraf tentang API. Selama tujuan email
 * belum diisi, inilah satu-satunya jalan kasus itu sampai ke orang Pralon, jadi ia harus
 * menjawab tiga hal sekali pandang: siapa yang menunggu, sudah berapa lama, dan apa yang
 * sudah diceritakannya.
 *
 * Yang dibaca pengguna di kartu "yang sudah saya catat" dan yang dibaca tim teknis di sini
 * adalah salinan yang sama — itulah yang membuat janji "tidak perlu menjelaskan ulang"
 * benar-benar ditepati.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '../locale';
import {
  fetchHandoffQueue,
  setHandoffStatus,
  type HandoffCase,
  type HandoffQueue,
  type HandoffStatus,
  type Loaded,
} from './dashboard-api';
import { dashboardCopy } from './dashboard-copy';
import { EmptyState } from './empty-state';
import styles from './dashboard.module.css';

/** Label asumsi dan lampiran dibedakan di `captured` lewat awalan ini (HandoffService). */
const ASSUMPTION = 'asumsi:';
const ATTACHMENT = 'lampiran:';

export function HandoffQueuePanel() {
  const { locale } = useLocale();
  const BOARD = dashboardCopy(locale);
  const COPY = BOARD.queue;
  const [queue, setQueue] = useState<Loaded<HandoffQueue> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setQueue(await fetchHandoffQueue());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Layar ini dulu terbuka sebagai dua kotak: daftar di kiri, dan di kanan satu kalimat
  // "pilih satu kasus". Orang teknis yang membukanya hampir selalu mau kasus terlama,
  // dan itu kasus pertama di daftar — jadi ia yang terbuka sendiri (P31-80).
  useEffect(() => {
    if (queue === null || queue.kind !== 'ok' || selected !== null) return;
    const first = queue.value.open[0] ?? queue.value.closed[0];
    if (first !== undefined) setSelected(first.id);
  }, [queue, selected]);

  const move = async (id: string, status: HandoffStatus) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const problem = await setHandoffStatus(id, status);
    setBusy(false);
    if (problem !== null) {
      setError(BOARD.errors['generic'] ?? '');
      return;
    }
    await load();
  };

  if (queue === null) return <p className={styles.muted}>{BOARD.loading}</p>;
  if (queue.kind === 'forbidden') {
    return (
      <div className={styles.notice}>
        <p>{BOARD.forbidden}</p>
        <a className={styles.primary} href="/login">
          {BOARD.signIn}
        </a>
      </div>
    );
  }
  if (queue.kind === 'failed') {
    return (
      <div className={styles.notice} role="alert">
        <p>{BOARD.failed}</p>
        <button type="button" className={styles.secondary} onClick={() => void load()}>
          {BOARD.retry}
        </button>
      </div>
    );
  }

  const all = [...queue.value.open, ...queue.value.closed];
  const open = queue.value.open;
  const closed = queue.value.closed;
  const overdue = open.filter((item) => item.overdue);
  const current = all.find((item) => item.id === selected) ?? null;

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

      {/* Tiga angka yang ditanyakan lebih dulu: berapa yang menunggu, berapa yang sudah
          lewat janji 1×24 jam kerja, dan berapa yang sudah ditutup. Antrean yang belum
          pernah terisi tidak perlu tiga nol di atas kalimat kosongnya. */}
      {all.length > 0 && (
        <div className={[styles.statRow, styles.queueSummary].join(' ')}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{open.length}</span>
            <span className={styles.statLabel}>{COPY.openTitle}</span>
          </div>
          <div className={styles.stat}>
            <span
              className={[styles.statValue, overdue.length > 0 ? styles.statLate : ''].join(' ')}
            >
              {overdue.length}
            </span>
            <span className={styles.statLabel}>{COPY.lateTitle}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{closed.length}</span>
            <span className={styles.statLabel}>{COPY.closedTitle}</span>
          </div>
        </div>
      )}

      {all.length === 0 && <EmptyState mood="confused" text={COPY.empty} />}

      {all.length > 0 && (
        <div className={styles.leadLayout}>
          <ul className={styles.leadList} aria-label={COPY.title}>
            {open.map((item) => (
              <li key={item.id}>
                <CaseButton
                  item={item}
                  locale={locale}
                  selected={selected === item.id}
                  onPick={() => setSelected(item.id)}
                />
              </li>
            ))}

            {closed.length > 0 && (
              <>
                <li className={styles.navGroup}>{COPY.closedTitle}</li>
                {closed.map((item) => (
                  <li key={item.id}>
                    <CaseButton
                      item={item}
                      locale={locale}
                      selected={selected === item.id}
                      onPick={() => setSelected(item.id)}
                    />
                  </li>
                ))}
              </>
            )}
          </ul>

          <section className={styles.leadDetail} aria-live="polite">
            {current === null ? (
              <p className={styles.muted}>{COPY.pick}</p>
            ) : (
              <CaseDetail
                item={current}
                locale={locale}
                busy={busy}
                onMove={(status) => void move(current.id, status)}
              />
            )}
          </section>
        </div>
      )}
    </>
  );
}

function CaseButton({
  item,
  locale,
  selected,
  onPick,
}: {
  item: HandoffCase;
  locale: ReturnType<typeof useLocale>['locale'];
  selected: boolean;
  onPick: () => void;
}) {
  const COPY = dashboardCopy(locale).queue;
  return (
    <button
      type="button"
      className={[styles.leadItem, selected ? styles.leadItemOn : ''].join(' ')}
      aria-pressed={selected}
      onClick={onPick}
    >
      <span className={styles.name}>{item.submitter?.name ?? COPY.anonymous}</span>
      {/* Perkaranya, dalam kalimat pengguna sendiri: tanpa ini daftarnya hanya deretan
          nama, dan tidak ada cara memilih mana yang dikerjakan lebih dulu. */}
      <span className={styles.caseReason}>{item.reason}</span>
      <span className={styles.leadTags}>
        <span className={styles.stageTag}>{COPY.status[item.status]}</span>
        <span className={[styles.priority, overdueClass(item)].join(' ')}>{age(item, locale)}</span>
      </span>
    </button>
  );
}

function CaseDetail({
  item,
  locale,
  busy,
  onMove,
}: {
  item: HandoffCase;
  locale: ReturnType<typeof useLocale>['locale'];
  busy: boolean;
  onMove: (status: HandoffStatus) => void;
}) {
  const COPY = dashboardCopy(locale).queue;
  const stated = item.captured.filter(
    (kv) => !kv.label.startsWith(ASSUMPTION) && !kv.label.startsWith(ATTACHMENT),
  );
  const assumptions = item.captured.filter((kv) => kv.label.startsWith(ASSUMPTION));
  const attachments = item.captured.filter((kv) => kv.label.startsWith(ATTACHMENT));

  return (
    <div className={styles.leadBody}>
      <div className={styles.leadHead}>
        <span className={styles.leadName}>{item.submitter?.name ?? COPY.guest}</span>
        {/* Dibungkus baris sendiri: di kolom flex, tag yang berdiri sendiri melar selebar panel. */}
        <span className={styles.leadTags}>
          <span className={[styles.priority, overdueClass(item)].join(' ')}>
            {age(item, locale)}
          </span>
        </span>
      </div>

      {item.submitter !== null ? (
        <p className={styles.contactRow}>
          <a href={`mailto:${item.submitter.email}`}>{item.submitter.email}</a>
          {item.submitter.phone !== null && <span>{item.submitter.phone}</span>}
        </p>
      ) : (
        <p className={styles.muted}>{COPY.guest}</p>
      )}

      <p className={styles.contextText}>{item.reason}</p>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>{COPY.captured}</h2>
        {stated.length === 0 ? (
          <p className={styles.muted}>{COPY.noCaptured}</p>
        ) : (
          <dl className={styles.factGrid}>
            {stated.map((kv) => (
              <div key={kv.label}>
                <dt>{kv.label}</dt>
                <dd>{kv.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {assumptions.length > 0 && (
        <section className={styles.block}>
          <h2 className={styles.blockTitle}>{COPY.assumption}</h2>
          <ul className={styles.factList}>
            {assumptions.map((kv) => (
              <li key={kv.label}>{kv.value}</li>
            ))}
          </ul>
        </section>
      )}

      {attachments.length > 0 && (
        <section className={styles.block}>
          <h2 className={styles.blockTitle}>{COPY.attachment}</h2>
          <ul className={styles.factList}>
            {attachments.map((kv) => (
              <li key={kv.label}>{kv.value}</li>
            ))}
          </ul>
        </section>
      )}

      <p className={styles.actionRow}>
        {item.status === 'QUEUED' && (
          <button
            type="button"
            className={styles.primary}
            disabled={busy}
            onClick={() => onMove('IN_REVIEW')}
          >
            {COPY.take}
          </button>
        )}
        {(item.status === 'QUEUED' || item.status === 'IN_REVIEW') && (
          <button
            type="button"
            className={styles.secondary}
            disabled={busy}
            onClick={() => onMove('RESOLVED')}
          >
            {COPY.resolve}
          </button>
        )}
        {(item.status === 'RESOLVED' || item.status === 'CLOSED') && (
          <button
            type="button"
            className={styles.secondary}
            disabled={busy}
            onClick={() => onMove('QUEUED')}
          >
            {COPY.reopen}
          </button>
        )}
      </p>
    </div>
  );
}

/** Merah hanya untuk yang benar-benar lewat janji; selebihnya netral. */
function overdueClass(item: HandoffCase): string {
  return item.overdue ? (styles['priority_hot'] ?? '') : (styles['priority_cold'] ?? '');
}

/**
 * Umur kasus dalam bahasa biasa. Yang terbuka dihitung sampai sekarang, yang tertutup
 * sampai saat ditutup — "menunggu 40 hari" untuk kasus yang selesai minggu lalu adalah
 * angka yang benar secara aritmetika dan salah secara makna.
 */
function age(item: HandoffCase, locale: ReturnType<typeof useLocale>['locale']): string {
  const COPY = dashboardCopy(locale).queue;
  const from = new Date(item.createdAt).getTime();
  const until = item.resolvedAt !== null ? new Date(item.resolvedAt).getTime() : Date.now();
  const span = COPY.span(Math.max(0, Math.floor((until - from) / 60_000)));
  if (item.resolvedAt !== null) return COPY.closedAfter(span);
  if (item.overdue) {
    const late = Math.floor((Date.now() - new Date(item.dueAt).getTime()) / 60_000);
    return COPY.overdue(COPY.span(Math.max(0, late)));
  }
  return COPY.waiting(span);
}
