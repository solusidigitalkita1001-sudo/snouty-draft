'use client';

/**
 * Papan prospek (P26-05/P26-08, docs/PROSPECT_5A.md §4): corong 5A sebagai chart yang bisa dipakai
 * memfilter, ringkasan prioritas, lalu tabel prospek dengan penugasan ke sales. Semua angka dari API
 * (`prospect-stage` di server) — komponen ini tidak menghitung tahap maupun prioritas.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '../locale';
import { BarList, type Slice } from './charts';
import {
  assignProspect,
  fetchProspects,
  fetchSalesTeam,
  type Loaded,
  type Priority,
  type ProspectFilter,
  type ProspectItem,
  type SalesMember,
  type Stage,
} from './dashboard-api';
import { dashboardCopy } from './dashboard-copy';
import styles from './dashboard.module.css';

const STAGES: readonly Stage[] = ['aware', 'appeal', 'ask', 'act', 'advocate'];
const PRIORITIES: readonly Priority[] = ['hot', 'warm', 'cold'];

type Board = {
  readonly funnel: Readonly<Record<Stage, number>>;
  readonly items: readonly ProspectItem[];
};

export function ProspectBoard() {
  const { locale } = useLocale();
  const COPY = dashboardCopy(locale);
  const [filter, setFilter] = useState<ProspectFilter>({});
  const [board, setBoard] = useState<Loaded<Board> | null>(null);
  const [team, setTeam] = useState<readonly SalesMember[]>([]);
  const [rowError, setRowError] = useState<{ userId: string; text: string } | null>(null);

  const loadTeam = useCallback(async () => {
    const result = await fetchSalesTeam();
    if (result.kind === 'ok') setTeam(result.value.items);
  }, []);

  const loadBoard = useCallback(async () => {
    setBoard(await fetchProspects(filter));
  }, [filter]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const errorText = useCallback(
    (code: string) => COPY.errors[code] ?? COPY.errors['generic'] ?? '',
    [COPY],
  );

  const assign = useCallback(
    async (userId: string, salesUserId: string) => {
      setRowError(null);
      const problem = await assignProspect(userId, salesUserId);
      if (problem !== null) {
        setRowError({ userId, text: errorText(problem) });
        return;
      }
      await Promise.all([loadBoard(), loadTeam()]);
    },
    [errorText, loadBoard, loadTeam],
  );

  const dateFormat = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (board === null) return <p className={styles.muted}>{COPY.loading}</p>;
  if (board.kind === 'forbidden') {
    return (
      <div className={styles.notice}>
        <p>{COPY.forbidden}</p>
        <a className={styles.primary} href="/login">
          {COPY.signIn}
        </a>
      </div>
    );
  }
  if (board.kind === 'failed') {
    return (
      <div className={styles.notice} role="alert">
        <p>{COPY.failed}</p>
        <button type="button" className={styles.secondary} onClick={() => void loadBoard()}>
          {COPY.retry}
        </button>
      </div>
    );
  }

  const items = board.value.items;
  const stageSlices: readonly Slice[] = STAGES.map((stage) => ({
    key: stage,
    label: COPY.stages[stage].name,
    detail: COPY.stages[stage].meaning,
    value: board.value.funnel[stage],
  }));
  const byPriority = (priority: Priority) => items.filter((i) => i.priority === priority).length;

  return (
    <>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{COPY.prospects.title}</h1>
        <p className={styles.subtitle}>{COPY.prospects.subtitle}</p>
      </div>

      <div className={styles.cards}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{COPY.prospects.funnelTitle}</h2>
          <BarList
            slices={stageSlices}
            valueLabel={(n) => COPY.prospects.people(n)}
            selected={filter.stage ?? null}
            onSelect={(key) =>
              setFilter((f) => ({ ...f, stage: f.stage === key ? undefined : (key as Stage) }))
            }
          />
          <p className={styles.meta}>{COPY.prospects.funnelHint}</p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{COPY.prospects.priorityTitle}</h2>
          <div className={styles.statRow}>
            {PRIORITIES.map((priority) => (
              <button
                key={priority}
                type="button"
                className={[styles.stat, filter.priority === priority ? styles.statOn : ''].join(
                  ' ',
                )}
                aria-pressed={filter.priority === priority}
                onClick={() =>
                  setFilter((f) => ({
                    ...f,
                    priority: f.priority === priority ? undefined : priority,
                  }))
                }
              >
                <span className={styles.statValue}>{byPriority(priority)}</span>
                <span className={styles.statLabel}>{COPY.priority[priority]}</span>
              </button>
            ))}
          </div>
          <p className={styles.meta}>{COPY.prospects.priorityHint}</p>
        </section>
      </div>

      <div className={styles.filters}>
        <select
          className={styles.control}
          aria-label={COPY.columns.project}
          value={filter.scale ?? ''}
          onChange={(e) =>
            setFilter((f) => ({
              ...f,
              scale: (e.target.value || undefined) as ProspectFilter['scale'],
            }))
          }
        >
          <option value="">{COPY.filters.allScales}</option>
          <option value="house">{COPY.scale.house}</option>
          <option value="building">{COPY.scale.building}</option>
          <option value="district">{COPY.scale.district}</option>
        </select>
        <select
          className={styles.control}
          aria-label={COPY.columns.sales}
          value={filter.assignment ?? ''}
          onChange={(e) =>
            setFilter((f) => ({
              ...f,
              assignment: (e.target.value || undefined) as ProspectFilter['assignment'],
            }))
          }
        >
          <option value="">{COPY.filters.allAssignments}</option>
          <option value="unassigned">{COPY.filters.unassigned}</option>
          <option value="assigned">{COPY.filters.assigned}</option>
        </select>
        <input
          className={[styles.control, styles.search].join(' ')}
          type="search"
          placeholder={COPY.filters.search}
          aria-label={COPY.filters.search}
          value={filter.q ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value || undefined }))}
        />
        {(filter.stage ?? filter.priority ?? filter.scale ?? filter.assignment ?? filter.q) !==
          undefined && (
          <button type="button" className={styles.secondary} onClick={() => setFilter({})}>
            {COPY.filters.clear}
          </button>
        )}
      </div>

      {/* Papan yang penuh tetapi tak satu pun bisa ditugaskan tampak rusak tanpa alasannya
          (uji pemilik 2026-10-21: 13 baris, nol opt-in, tim sales kosong). */}
      {items.length > 0 && !items.some((item) => item.contactable) && (
        <p className={styles.muted}>{COPY.noneContactable}</p>
      )}
      {items.length > 0 && team.length === 0 && (
        <p className={styles.muted}>{COPY.teamEmptyHint}</p>
      )}

      {items.length === 0 ? (
        <p className={styles.muted}>{COPY.empty}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{COPY.columns.customer}</th>
                <th scope="col">{COPY.columns.stage}</th>
                <th scope="col">{COPY.columns.priority}</th>
                <th scope="col">{COPY.columns.project}</th>
                <th scope="col">{COPY.columns.activity}</th>
                <th scope="col">{COPY.columns.contact}</th>
                <th scope="col">{COPY.columns.sales}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.userId}>
                  <td data-label={COPY.columns.customer}>
                    <div className={styles.name}>{item.name}</div>
                    <div className={styles.meta}>{item.email}</div>
                    {item.phone && <div className={styles.meta}>{item.phone}</div>}
                    <div className={styles.meta}>{COPY.conversations(item.conversationCount)}</div>
                  </td>
                  <td data-label={COPY.columns.stage}>
                    <span className={styles.stageTag}>{COPY.stages[item.stage].name}</span>
                    <div className={styles.meta}>{COPY.stages[item.stage].meaning}</div>
                  </td>
                  <td data-label={COPY.columns.priority}>
                    <span
                      className={[styles.priority, styles[`priority_${item.priority}`]].join(' ')}
                    >
                      {COPY.priority[item.priority]}
                    </span>
                  </td>
                  <td data-label={COPY.columns.project}>{COPY.scale[item.scale]}</td>
                  <td data-label={COPY.columns.activity}>
                    {dateFormat.format(new Date(item.lastActivityAt))}
                  </td>
                  <td data-label={COPY.columns.contact}>
                    {item.salesRequestedAt
                      ? COPY.contact.requested
                      : item.salesContactConsent
                        ? COPY.contact.consent
                        : COPY.contact.none}
                  </td>
                  <td data-label={COPY.columns.sales}>
                    <AssignCell
                      item={item}
                      team={team}
                      copy={COPY}
                      onAssign={(salesUserId) => void assign(item.userId, salesUserId)}
                    />
                    {rowError?.userId === item.userId && (
                      <div className={styles.rowError} role="alert">
                        {rowError.text}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

type Copy = ReturnType<typeof dashboardCopy>;

function AssignCell({
  item,
  team,
  copy,
  onAssign,
}: {
  item: ProspectItem;
  team: readonly SalesMember[];
  copy: Copy;
  onAssign: (salesUserId: string) => void;
}) {
  if (!item.contactable) {
    return (
      <>
        {item.lead && <div>{item.lead.salesName}</div>}
        <span className={styles.meta}>{copy.assignBlocked}</span>
      </>
    );
  }
  if (team.length === 0 && item.lead === null) {
    return <span className={styles.meta}>{copy.noSales}</span>;
  }
  return (
    <>
      <select
        className={styles.control}
        aria-label={`${copy.columns.sales} — ${item.name}`}
        value={item.lead?.salesUserId ?? ''}
        onChange={(e) => {
          if (e.target.value !== '') onAssign(e.target.value);
        }}
      >
        {item.lead === null && <option value="">{copy.assign}</option>}
        {item.lead !== null && !team.some((m) => m.id === item.lead!.salesUserId) && (
          <option value={item.lead.salesUserId}>{item.lead.salesName}</option>
        )}
        {team.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </select>
      {item.lead && (
        <div className={styles.meta}>
          {copy.leadStatus[item.lead.status]} ·{' '}
          <a className={styles.back} href={`/internal/leads?u=${item.userId}`}>
            {copy.summary}
          </a>
        </div>
      )}
    </>
  );
}
