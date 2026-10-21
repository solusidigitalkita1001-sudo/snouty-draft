'use client';

/**
 * Dashboard admin (P26-05, docs/PROSPECT_5A.md §4): corong 5A, papan prospek dengan filter, penugasan
 * ke sales, dan tim sales. Semua angka dari API (`prospect-stage` di server) — komponen ini tidak
 * menghitung tahap atau prioritas. Mascot tidak dipakai: ini alat kerja (skill desain).
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { getCurrentUser, restoreSession } from '../auth/session';
import { useLocale } from '../locale';
import {
  addSalesMember,
  assignProspect,
  fetchProspects,
  fetchSalesTeam,
  removeSalesMember,
  type Loaded,
  type ProspectFilter,
  type ProspectItem,
  type SalesMember,
  type Stage,
} from './dashboard-api';
import { dashboardCopy } from './dashboard-copy';
import styles from './dashboard.module.css';

const STAGES: readonly Stage[] = ['aware', 'appeal', 'ask', 'act', 'advocate'];

type Board = {
  readonly funnel: Readonly<Record<Stage, number>>;
  readonly items: readonly ProspectItem[];
};

export function ProspectDashboard() {
  const { locale } = useLocale();
  const COPY = dashboardCopy(locale);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<'prospects' | 'team'>('prospects');
  const [filter, setFilter] = useState<ProspectFilter>({});
  const [board, setBoard] = useState<Loaded<Board> | null>(null);
  const [team, setTeam] = useState<readonly SalesMember[]>([]);
  const [rowError, setRowError] = useState<{ userId: string; text: string } | null>(null);
  const isAdmin = getCurrentUser()?.roles?.includes('admin') ?? false;

  useEffect(() => {
    void restoreSession().finally(() => setReady(true));
  }, []);

  const loadTeam = useCallback(async () => {
    const result = await fetchSalesTeam();
    if (result.kind === 'ok') setTeam(result.value.items);
  }, []);

  const loadBoard = useCallback(async () => {
    setBoard(await fetchProspects(filter));
  }, [filter]);

  useEffect(() => {
    if (!ready) return;
    void loadBoard();
  }, [ready, loadBoard]);

  useEffect(() => {
    if (ready) void loadTeam();
  }, [ready, loadTeam]);

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

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>{COPY.brand}</span>
        <nav className={styles.tabs} aria-label={COPY.prospects.title}>
          <button
            type="button"
            className={[styles.tab, tab === 'prospects' ? styles.tabOn : ''].join(' ')}
            aria-pressed={tab === 'prospects'}
            onClick={() => setTab('prospects')}
          >
            {COPY.nav.prospects}
          </button>
          <button
            type="button"
            className={[styles.tab, tab === 'team' ? styles.tabOn : ''].join(' ')}
            aria-pressed={tab === 'team'}
            onClick={() => setTab('team')}
          >
            {COPY.nav.team}
          </button>
        </nav>
        <a className={styles.back} href="/consultation">
          {COPY.nav.back}
        </a>
      </header>

      <main className={styles.main}>
        {board === null && <p className={styles.muted}>{COPY.loading}</p>}

        {board?.kind === 'forbidden' && (
          <div className={styles.notice}>
            <p>{COPY.forbidden}</p>
            <a className={styles.primary} href="/login">
              {COPY.signIn}
            </a>
          </div>
        )}

        {board?.kind === 'failed' && (
          <div className={styles.notice} role="alert">
            <p>{COPY.failed}</p>
            <button type="button" className={styles.secondary} onClick={() => void loadBoard()}>
              {COPY.retry}
            </button>
          </div>
        )}

        {board?.kind === 'ok' && tab === 'prospects' && (
          <>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{COPY.prospects.title}</h1>
              <p className={styles.subtitle}>{COPY.prospects.subtitle}</p>
            </div>

            <ol className={styles.funnel} aria-label="5A">
              {STAGES.map((stage) => (
                <li key={stage}>
                  <button
                    type="button"
                    className={[
                      styles.funnelStep,
                      filter.stage === stage ? styles.funnelOn : '',
                    ].join(' ')}
                    aria-pressed={filter.stage === stage}
                    onClick={() =>
                      setFilter((f) => ({ ...f, stage: f.stage === stage ? undefined : stage }))
                    }
                  >
                    <span className={styles.funnelCount}>{board.value.funnel[stage]}</span>
                    <span className={styles.funnelName}>{COPY.stages[stage].name}</span>
                    <span className={styles.funnelMeaning}>{COPY.stages[stage].meaning}</span>
                  </button>
                </li>
              ))}
            </ol>

            <div className={styles.filters}>
              <select
                className={styles.control}
                aria-label={COPY.columns.priority}
                value={filter.priority ?? ''}
                onChange={(e) =>
                  setFilter((f) => ({
                    ...f,
                    priority: (e.target.value || undefined) as ProspectFilter['priority'],
                  }))
                }
              >
                <option value="">{COPY.filters.allPriorities}</option>
                <option value="hot">{COPY.priority.hot}</option>
                <option value="warm">{COPY.priority.warm}</option>
                <option value="cold">{COPY.priority.cold}</option>
              </select>
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
            </div>

            {board.value.items.length === 0 ? (
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
                    {board.value.items.map((item) => (
                      <tr key={item.userId}>
                        <td data-label={COPY.columns.customer}>
                          <div className={styles.name}>{item.name}</div>
                          <div className={styles.meta}>{item.email}</div>
                          {item.phone && <div className={styles.meta}>{item.phone}</div>}
                          <div className={styles.meta}>
                            {COPY.conversations(item.conversationCount)}
                          </div>
                        </td>
                        <td data-label={COPY.columns.stage}>
                          <span className={styles.stageTag}>{COPY.stages[item.stage].name}</span>
                          <div className={styles.meta}>{COPY.stages[item.stage].meaning}</div>
                        </td>
                        <td data-label={COPY.columns.priority}>
                          <span
                            className={[styles.priority, styles[`priority_${item.priority}`]].join(
                              ' ',
                            )}
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
        )}

        {board?.kind === 'ok' && tab === 'team' && (
          <TeamPanel
            team={team}
            isAdmin={isAdmin}
            copy={COPY}
            errorText={errorText}
            onChanged={() => void Promise.all([loadTeam(), loadBoard()])}
          />
        )}
      </main>
    </div>
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
      {item.lead && <div className={styles.meta}>{copy.leadStatus[item.lead.status]}</div>}
    </>
  );
}

function TeamPanel({
  team,
  isAdmin,
  copy,
  errorText,
  onChanged,
}: {
  team: readonly SalesMember[];
  isAdmin: boolean;
  copy: Copy;
  errorText: (code: string) => string;
  onChanged: () => void;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || email.trim() === '') return;
    setBusy(true);
    setError(null);
    const problem = await addSalesMember(email.trim());
    setBusy(false);
    if (problem !== null) {
      setError(errorText(problem));
      return;
    }
    setEmail('');
    onChanged();
  };

  const remove = async (id: string) => {
    setError(null);
    const problem = await removeSalesMember(id);
    if (problem !== null) {
      setError(errorText(problem));
      return;
    }
    onChanged();
  };

  return (
    <section>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{copy.team.title}</h1>
        <p className={styles.subtitle}>{copy.team.subtitle}</p>
      </div>

      {isAdmin ? (
        <form className={styles.addForm} onSubmit={(e) => void add(e)}>
          <input
            className={[styles.control, styles.search].join(' ')}
            type="email"
            required
            placeholder={copy.team.email}
            aria-label={copy.team.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" className={styles.primary} disabled={busy}>
            {busy ? copy.team.adding : copy.team.add}
          </button>
        </form>
      ) : (
        <p className={styles.muted}>{copy.team.adminOnly}</p>
      )}
      {error !== null && (
        <p className={styles.rowError} role="alert">
          {error}
        </p>
      )}

      {team.length === 0 ? (
        <p className={styles.muted}>{copy.team.empty}</p>
      ) : (
        <ul className={styles.teamList}>
          {team.map((member) => (
            <li key={member.id} className={styles.teamRow}>
              <div>
                <div className={styles.name}>{member.name}</div>
                <div className={styles.meta}>{member.email}</div>
              </div>
              <span className={styles.meta}>{copy.team.openLeads(member.openLeads)}</span>
              {isAdmin && (
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => void remove(member.id)}
                >
                  {copy.team.remove}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
