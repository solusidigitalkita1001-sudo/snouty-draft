'use client';

/**
 * Validasi aturan teknik (P31-82, keputusan pemilik 2026-10-28).
 *
 * Layar ini dulu satu paragraf yang mengatakan ia menunggu seseorang. Yang ditunggu memang
 * orang — ahli pipa Pralon — tetapi tanpa aturannya tampil, orang itu tidak punya apa pun
 * untuk ditandatangani, dan setiap angka SNOUTY tetap berdiri sebagai asumsi.
 *
 * Delapan aturan diminta dibaca lebih dulu; sisanya ada di bawah, tidak disembunyikan. Tiap
 * aturan membawa sumbernya dan satu contoh kerja yang diambil dari test case aturan itu
 * sendiri — kalimat yang sama persis dengan yang dibaca pengguna di layar solusi.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '../locale';
import {
  decideRule,
  fetchRuleBoard,
  withdrawRuleDecision,
  type Loaded,
  type RuleBoard,
  type RuleCard,
} from './dashboard-api';
import { dashboardCopy } from './dashboard-copy';
import styles from './dashboard.module.css';

export function RuleBoardPanel() {
  const { locale } = useLocale();
  const BOARD = dashboardCopy(locale);
  const COPY = BOARD.rules;
  const [board, setBoard] = useState<Loaded<RuleBoard> | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [showRest, setShowRest] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBoard(await fetchRuleBoard(locale));
  }, [locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (card: RuleCard, decision: 'approved' | 'rejected', note: string) => {
    setError(null);
    const problem = await decideRule(card.ruleId, card.version, decision, note);
    if (problem !== null) {
      setError(
        decision === 'rejected' && note === ''
          ? COPY.noteRequired
          : (BOARD.errors['generic'] ?? ''),
      );
      return;
    }
    await load();
  };

  const withdraw = async (card: RuleCard) => {
    setError(null);
    const problem = await withdrawRuleDecision(card.ruleId, card.version);
    if (problem !== null) {
      setError(BOARD.errors['generic'] ?? '');
      return;
    }
    await load();
  };

  if (board === null) return <p className={styles.muted}>{BOARD.loading}</p>;
  if (board.kind === 'forbidden') {
    return (
      <div className={styles.notice}>
        <p>{BOARD.forbidden}</p>
        <a className={styles.primary} href="/login">
          {BOARD.signIn}
        </a>
      </div>
    );
  }
  if (board.kind === 'failed') {
    return (
      <div className={styles.notice} role="alert">
        <p>{BOARD.failed}</p>
        <button type="button" className={styles.secondary} onClick={() => void load()}>
          {BOARD.retry}
        </button>
      </div>
    );
  }

  const { priority, rest, signedOff, total } = board.value;

  return (
    <>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{COPY.title}</h1>
        <p className={styles.subtitle}>{COPY.subtitle}</p>
      </div>

      <p className={styles.contextText}>{COPY.progress(signedOff, total)}</p>

      {error !== null && (
        <p className={styles.rowError} role="alert">
          {error}
        </p>
      )}

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>{COPY.priorityTitle}</h2>
        <p className={styles.muted}>{COPY.priorityHint}</p>
        <ul className={styles.ruleList}>
          {priority.map((card) => (
            <li key={card.ruleId}>
              <RuleRow
                card={card}
                locale={locale}
                expanded={open === card.ruleId}
                onToggle={() => setOpen(open === card.ruleId ? null : card.ruleId)}
                onDecide={(decision, note) => void decide(card, decision, note)}
                onWithdraw={() => void withdraw(card)}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.block}>
        <button
          type="button"
          className={styles.secondary}
          aria-expanded={showRest}
          onClick={() => setShowRest(!showRest)}
        >
          {showRest ? COPY.hideRest : COPY.showRest(rest.length)}
        </button>
        {showRest && (
          <ul className={styles.ruleList}>
            {rest.map((card) => (
              <li key={card.ruleId}>
                <RuleRow
                  card={card}
                  locale={locale}
                  expanded={open === card.ruleId}
                  onToggle={() => setOpen(open === card.ruleId ? null : card.ruleId)}
                  onDecide={(decision, note) => void decide(card, decision, note)}
                  onWithdraw={() => void withdraw(card)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function RuleRow({
  card,
  locale,
  expanded,
  onToggle,
  onDecide,
  onWithdraw,
}: {
  card: RuleCard;
  locale: ReturnType<typeof useLocale>['locale'];
  expanded: boolean;
  onToggle: () => void;
  onDecide: (decision: 'approved' | 'rejected', note: string) => void;
  onWithdraw: () => void;
}) {
  const COPY = dashboardCopy(locale).rules;
  const [note, setNote] = useState('');

  return (
    <article className={[styles.ruleCard, expanded ? styles.ruleCardOn : ''].join(' ')}>
      <button type="button" className={styles.ruleHead} aria-expanded={expanded} onClick={onToggle}>
        <span className={styles.ruleName}>{card.ruleId}</span>
        <span className={styles.leadTags}>
          <span className={[styles.priority, statusClass(card.status)].join(' ')}>
            {COPY.status[card.status]}
          </span>
          {card.standard !== null && <span className={styles.meta}>{card.standard}</span>}
        </span>
      </button>

      {card.why !== null && <p className={styles.contextText}>{card.why}</p>}

      {expanded && (
        <div className={styles.ruleBody}>
          {card.examples.map((example) => (
            <div key={example.name} className={styles.ruleExample}>
              <p className={styles.ruleExampleName}>{example.name}</p>
              <p className={styles.ruleExampleText}>{example.explanation}</p>
            </div>
          ))}

          {card.decision === null ? (
            <>
              <label className={styles.field}>
                <span className={styles.label}>{COPY.note}</span>
                <textarea
                  className={styles.control}
                  rows={2}
                  maxLength={500}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              <p className={styles.actionRow}>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => onDecide('approved', note.trim())}
                >
                  {COPY.approve}
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => onDecide('rejected', note.trim())}
                >
                  {COPY.reject}
                </button>
              </p>
            </>
          ) : (
            <>
              <p className={styles.meta}>
                {COPY.decidedBy(card.decision.by, day(card.decision.at, locale))}
              </p>
              {card.decision.note !== null && (
                <p className={styles.contextText}>{card.decision.note}</p>
              )}
              <p className={styles.actionRow}>
                <button type="button" className={styles.secondary} onClick={onWithdraw}>
                  {COPY.withdraw}
                </button>
              </p>
            </>
          )}
        </div>
      )}
    </article>
  );
}

function statusClass(status: RuleCard['status']): string {
  if (status === 'VALIDATED') return styles['priority_cold'] ?? '';
  if (status === 'REJECTED') return styles['priority_hot'] ?? '';
  return styles['priority_warm'] ?? '';
}

function day(iso: string, locale: ReturnType<typeof useLocale>['locale']): string {
  return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-GB' : 'id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
