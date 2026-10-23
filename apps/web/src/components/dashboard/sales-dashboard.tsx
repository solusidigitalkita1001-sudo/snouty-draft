'use client';

/**
 * Dashboard sales (P26-06, docs/PROSPECT_5A.md §4): prospek yang ditugaskan, ringkasan percakapan,
 * status, dan transkrip baca-saja. Angka dan produk dari baris terstruktur API; paragraf konteks dari
 * model sudah lolos pagar angka di server. Komponen ini tidak menilai apa pun.
 */
import { useCallback, useEffect, useState } from 'react';

import { useLocale } from '../locale';
import {
  fetchLead,
  fetchMyLeads,
  fetchTranscript,
  refreshLeadContext,
  setLeadStatus,
  type LeadDetail,
  type LeadProject,
  type LeadStatus,
  type Loaded,
  type ProspectItem,
  type TranscriptLine,
} from './dashboard-api';
import { dashboardCopy } from './dashboard-copy';
import styles from './dashboard.module.css';
import { LeadFollowUp } from './lead-followup';
import { salesCopy } from './sales-copy';
import { EmptyState } from './empty-state';

const STATUSES: readonly LeadStatus[] = ['new', 'contacted', 'quoted', 'won', 'lost'];
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Nomor Indonesia ke format wa.me ("0812…" → "62812…"); selain itu tanpa tautan WhatsApp. */
export function whatsappNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return null;
}

export function SalesDashboard() {
  const { locale } = useLocale();
  const COPY = salesCopy(locale);
  const BOARD = dashboardCopy(locale);
  const [list, setList] = useState<Loaded<{ readonly items: readonly ProspectItem[] }> | null>(
    null,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Loaded<LeadDetail> | null>(null);

  useEffect(() => {
    // Admin membuka ringkasan dari papan prospek: `?u=<id pengguna>`.
    const fromBoard = new URLSearchParams(window.location.search).get('u');
    if (fromBoard !== null && ULID.test(fromBoard)) setSelected(fromBoard);
  }, []);

  const loadList = useCallback(async () => {
    setList(await fetchMyLeads());
  }, []);

  const loadDetail = useCallback(async (userId: string) => {
    setDetail(null);
    setDetail(await fetchLead(userId));
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selected !== null) void loadDetail(selected);
  }, [selected, loadDetail]);

  return (
    <>
      {list === null && <p className={styles.muted}>{BOARD.loading}</p>}
      {list?.kind === 'forbidden' && (
        <div className={styles.notice}>
          <p>{BOARD.forbidden}</p>
          <a className={styles.primary} href="/login">
            {BOARD.signIn}
          </a>
        </div>
      )}
      {list?.kind === 'failed' && (
        <div className={styles.notice} role="alert">
          <p>{BOARD.failed}</p>
          <button type="button" className={styles.secondary} onClick={() => void loadList()}>
            {BOARD.retry}
          </button>
        </div>
      )}

      {list?.kind === 'ok' && (
        <>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{COPY.title}</h1>
            <p className={styles.subtitle}>{COPY.subtitle}</p>
          </div>
          <div className={styles.leadLayout}>
            <ul className={styles.leadList} aria-label={COPY.title}>
              {list.value.items.length === 0 && (
                <li>
                  <EmptyState mood="confused" text={COPY.empty} />
                </li>
              )}
              {list.value.items.map((item) => (
                <li key={item.userId}>
                  <button
                    type="button"
                    className={[
                      styles.leadItem,
                      selected === item.userId ? styles.leadItemOn : '',
                    ].join(' ')}
                    aria-pressed={selected === item.userId}
                    onClick={() => setSelected(item.userId)}
                  >
                    <span className={styles.name}>{item.name}</span>
                    <span className={styles.leadTags}>
                      <span
                        className={[styles.priority, styles[`priority_${item.priority}`]].join(' ')}
                      >
                        {BOARD.priority[item.priority]}
                      </span>
                      <span className={styles.stageTag}>{BOARD.stages[item.stage].name}</span>
                      {item.lead && (
                        <span className={styles.meta}>{BOARD.leadStatus[item.lead.status]}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <section className={styles.leadDetail} aria-live="polite">
              {selected === null && <p className={styles.muted}>{COPY.pick}</p>}
              {selected !== null && detail === null && (
                <p className={styles.muted}>{BOARD.loading}</p>
              )}
              {selected !== null && detail !== null && detail.kind !== 'ok' && (
                <p className={styles.muted}>{BOARD.failed}</p>
              )}
              {selected !== null && detail?.kind === 'ok' && (
                <LeadView
                  key={selected}
                  userId={selected}
                  detail={detail.value}
                  onChanged={() => void Promise.all([loadList(), loadDetail(selected)])}
                />
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}

function LeadView({
  userId,
  detail,
  onChanged,
}: {
  userId: string;
  detail: LeadDetail;
  onChanged: () => void;
}) {
  const { locale } = useLocale();
  const COPY = salesCopy(locale);
  const BOARD = dashboardCopy(locale);
  const [status, setStatus] = useState<LeadStatus>(detail.status);
  const [lostReason, setLostReason] = useState(detail.lostReason ?? '');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [context, setContext] = useState(detail.context);
  const [writing, setWriting] = useState(false);
  const person = detail.prospect;
  const wa = person?.phone ? whatsappNumber(person.phone) : null;

  const saveStatus = async () => {
    if (status === 'lost' && lostReason.trim() === '') {
      setNotice({ ok: false, text: COPY.lostReasonRequired });
      return;
    }
    setBusy(true);
    setNotice(null);
    const problem = await setLeadStatus(
      userId,
      status,
      status === 'lost' ? lostReason.trim() : undefined,
    );
    setBusy(false);
    if (problem !== null) {
      setNotice({ ok: false, text: COPY.failed });
      return;
    }
    setNotice({ ok: true, text: COPY.saved });
    onChanged();
  };

  const rewrite = async () => {
    setWriting(true);
    const result = await refreshLeadContext(userId);
    setWriting(false);
    if (result !== 'failed') setContext(result);
  };

  return (
    <div className={styles.leadBody}>
      {person && (
        <div className={styles.leadHead}>
          <h2 className={styles.leadName}>{person.name}</h2>
          <div className={styles.leadTags}>
            <span className={[styles.priority, styles[`priority_${person.priority}`]].join(' ')}>
              {BOARD.priority[person.priority]}
            </span>
            <span className={styles.stageTag}>
              {BOARD.stages[person.stage].name} · {BOARD.stages[person.stage].meaning}
            </span>
            <span className={styles.meta}>{BOARD.scale[person.scale]}</span>
          </div>
          <div className={styles.contactRow}>
            <a className={styles.secondary} href={`mailto:${person.email}`}>
              {COPY.contact.email}: {person.email}
            </a>
            {wa && (
              <a
                className={styles.secondary}
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {COPY.contact.whatsapp}: {person.phone}
              </a>
            )}
            {person.phone && !wa && (
              <a className={styles.secondary} href={`tel:${person.phone}`}>
                {COPY.contact.phone}: {person.phone}
              </a>
            )}
          </div>
        </div>
      )}

      <div className={styles.block}>
        <label className={styles.blockTitle} htmlFor="lead-status">
          {COPY.status}
        </label>
        <div className={styles.addForm}>
          <select
            id="lead-status"
            className={styles.control}
            value={status}
            onChange={(e) => setStatus(e.target.value as LeadStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {BOARD.leadStatus[s]}
              </option>
            ))}
          </select>
          {status === 'lost' && (
            <input
              className={[styles.control, styles.search].join(' ')}
              aria-label={COPY.lostReason}
              placeholder={COPY.lostReasonPlaceholder}
              maxLength={255}
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
            />
          )}
          <button
            type="button"
            className={styles.primary}
            disabled={busy}
            onClick={() => void saveStatus()}
          >
            {busy ? COPY.saving : COPY.saveStatus}
          </button>
        </div>
        {notice && (
          <p className={notice.ok ? styles.muted : styles.rowError} role="status">
            {notice.text}
          </p>
        )}
      </div>

      <div className={styles.block}>
        <div className={styles.blockHead}>
          <span className={styles.blockTitle}>{COPY.context.title}</span>
          <button
            type="button"
            className={styles.secondary}
            disabled={writing}
            onClick={() => void rewrite()}
          >
            {writing ? COPY.context.refreshing : COPY.context.refresh}
          </button>
        </div>
        <p className={context ? styles.contextText : styles.muted}>
          {context ? context.text : COPY.context.none}
        </p>
      </div>

      <div className={styles.block}>
        <span className={styles.blockTitle}>{COPY.activity}</span>
        <ul className={styles.factList}>
          {detail.facts.salesRequest && <li>{COPY.requested(detail.facts.salesRequest.source)}</li>}
          {detail.facts.reports > 0 && <li>{COPY.reports(detail.facts.reports)}</li>}
          {detail.facts.shares > 0 && <li>{COPY.shares(detail.facts.shares)}</li>}
        </ul>
      </div>

      {/* Tindak lanjut: jadwal menengok, catatan, dan jejaknya (P27-09). */}
      <LeadFollowUp userId={userId} followUpAt={detail.followUpAt} onChanged={onChanged} />

      <div className={styles.block}>
        <span className={styles.blockTitle}>{COPY.projects}</span>
        {detail.facts.projects.map((project) => (
          <ProjectCard key={project.conversationId} userId={userId} project={project} />
        ))}
      </div>

      {detail.facts.quotes.length > 0 && (
        <div className={styles.block}>
          <span className={styles.blockTitle}>{COPY.quotes}</span>
          <ul className={styles.quoteList}>
            {detail.facts.quotes.map((quote, index) => (
              <li key={index}>“{quote.text}”</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ProjectCard({ userId, project }: { userId: string; project: LeadProject }) {
  const { locale } = useLocale();
  const COPY = salesCopy(locale);
  const [lines, setLines] = useState<readonly TranscriptLine[] | null>(null);
  const [open, setOpen] = useState(false);

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (lines === null) {
      const result = await fetchTranscript(userId, project.conversationId);
      setLines(result.kind === 'ok' ? result.value.items : []);
    }
  };

  const rows: [string, string | null][] = [
    [COPY.fields.case, project.caseId ? (COPY.cases[project.caseId] ?? null) : null],
    [
      COPY.fields.building,
      project.buildingType ? (COPY.buildingTypes[project.buildingType] ?? null) : null,
    ],
    [COPY.fields.floors, project.floors !== null ? String(project.floors) : null],
    [COPY.fields.bathrooms, project.bathrooms !== null ? String(project.bathrooms) : null],
    [
      COPY.fields.water,
      project.waterSource ? (COPY.waterSources[project.waterSource] ?? null) : null,
    ],
    [COPY.fields.result, project.headline],
    [COPY.fields.mainSize, project.mainSize],
  ];

  return (
    <div className={styles.projectCard}>
      <div className={styles.name}>{project.title ?? COPY.untitled}</div>
      <dl className={styles.factGrid}>
        {rows
          .filter((row): row is [string, string] => row[1] !== null)
          .map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      {project.products.length > 0 && (
        <div>
          <span className={styles.meta}>{COPY.fields.products}</span>
          <ul className={styles.factList}>
            {project.products.map((product, index) => (
              <li key={index}>{product.name}</li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        className={styles.linkButton}
        aria-expanded={open}
        onClick={() => void toggle()}
      >
        {open ? COPY.hideTranscript : COPY.showTranscript}
      </button>
      {open && lines !== null && (
        <ol className={styles.transcript}>
          {lines.map((line, index) => (
            <li key={index} className={line.role === 'user' ? styles.lineUser : styles.lineBot}>
              <span className={styles.meta}>{line.role === 'user' ? COPY.you : COPY.snouty}</span>
              <p>{line.text}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
