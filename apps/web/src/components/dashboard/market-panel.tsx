'use client';

/**
 * Pasar (P26-07/P26-08, docs/MARKET_INTELLIGENCE.md §7): agregat tanpa identitas sebagai chart. Ambang
 * k-anonimitas sudah diterapkan server; panel ini menampilkan dan menyebut berapa kelompok yang ditahan.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '../locale';
import { BarList, TrendLine, type Slice } from './charts';
import {
  fetchMarket,
  type AggregateResult,
  type Loaded,
  type MarketDashboard,
} from './dashboard-api';
import { dashboardCopy } from './dashboard-copy';
import styles from './dashboard.module.css';
import { salesCopy } from './sales-copy';

const PERIODS = [30, 90, 365] as const;
const TOP = 8;

export function MarketPanel() {
  const { locale } = useLocale();
  const COPY = dashboardCopy(locale);
  const LABELS = salesCopy(locale);
  const [days, setDays] = useState<number>(90);
  const [data, setData] = useState<Loaded<MarketDashboard> | null>(null);

  const load = useCallback(async () => {
    setData(null);
    setData(await fetchMarket(days));
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const month = (ym: string) =>
    new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
      month: 'short',
      year: '2-digit',
    }).format(new Date(`${ym}-01T00:00:00Z`));
  const building = (key: string) => LABELS.buildingTypes[key] ?? LABELS.cases[key] ?? key;
  const region = (key: string) => (key === 'tidak_diketahui' ? COPY.market.unknownRegion : key);
  const count = (n: number) => COPY.market.consultations(n);

  return (
    <>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{COPY.market.title}</h1>
        <p className={styles.subtitle}>{COPY.market.subtitle}</p>
      </div>
      <div className={styles.filters}>
        <select
          className={styles.control}
          aria-label={COPY.market.period}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          {PERIODS.map((n) => (
            <option key={n} value={n}>
              {COPY.market.days(n)}
            </option>
          ))}
        </select>
      </div>

      {data === null && <p className={styles.muted}>{COPY.loading}</p>}
      {data !== null && data.kind !== 'ok' && (
        <div className={styles.notice} role="alert">
          <p>{COPY.failed}</p>
          <button type="button" className={styles.secondary} onClick={() => void load()}>
            {COPY.retry}
          </button>
        </div>
      )}
      {data?.kind === 'ok' && data.value.total === 0 && (
        <p className={styles.muted}>{COPY.market.empty}</p>
      )}
      {data?.kind === 'ok' && data.value.total > 0 && (
        <>
          <div className={styles.cards}>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>{COPY.market.funnelTitle}</h2>
              <BarList
                slices={(
                  ['started', 'reachedSolution', 'routedToTechnical', 'requestedQuotation'] as const
                ).map((key) => ({
                  key,
                  label: COPY.market.funnel[key],
                  value: data.value.funnel[key],
                }))}
                valueLabel={count}
              />
              <ul className={styles.factList}>
                <li>
                  {COPY.market.scope(
                    new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
                      style: 'percent',
                      maximumFractionDigits: 0,
                    }).format(data.value.scope.ratio),
                  )}
                </li>
                <li>{COPY.market.drainage(data.value.drainage)}</li>
              </ul>
            </section>

            <section className={styles.card}>
              <h2 className={styles.cardTitle}>{COPY.market.trendTitle}</h2>
              <TrendLine points={monthlyTrend(data.value.regional, month)} valueLabel={count} />
            </section>
          </div>

          <div className={styles.cards}>
            <ChartCard
              title={COPY.market.regional}
              result={data.value.regional}
              copy={COPY}
              count={count}
              label={(key) => {
                const [name = '', ym = ''] = key.split('|');
                return { label: region(name), detail: month(ym) };
              }}
            />
            <ChartCard
              title={COPY.market.products}
              result={data.value.productInterest}
              copy={COPY}
              count={count}
              label={(key) => {
                const [family = '', size = '', ym = ''] = key.split('|');
                return { label: `${family} ${size}`, detail: month(ym) };
              }}
            />
            <ChartCard
              title={COPY.market.projects}
              result={data.value.projects}
              copy={COPY}
              count={count}
              label={(key) => {
                const [type = '', scale = '', place = ''] = key.split('|');
                return {
                  label: building(type),
                  detail: `${COPY.market.scale[scale] ?? scale} · ${region(place)}`,
                };
              }}
            />
          </div>

          <p className={styles.meta}>
            <a
              className={styles.back}
              href="https://db-ip.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              {COPY.market.attribution}
            </a>
          </p>
        </>
      )}
    </>
  );
}

/**
 * Tren bulanan dari agregat wilayah: kuncinya sudah memuat bulan, jadi jumlah per bulan adalah
 * penjumlahan — bukan perhitungan baru di klien. Bulan tanpa kejadian tetap muncul sebagai nol supaya
 * garisnya tidak memadatkan jeda.
 */
export function monthlyTrend(
  regional: AggregateResult,
  label: (ym: string) => string,
): readonly { readonly label: string; readonly value: number }[] {
  const perMonth = new Map<string, number>();
  for (const bucket of regional.buckets) {
    const ym = bucket.key.split('|')[1];
    if (ym === undefined) continue;
    perMonth.set(ym, (perMonth.get(ym) ?? 0) + bucket.count);
  }
  const months = [...perMonth.keys()].sort();
  const first = months[0];
  const last = months[months.length - 1];
  if (first === undefined || last === undefined) return [];
  const points: { label: string; value: number }[] = [];
  for (let cursor = new Date(`${first}-01T00:00:00Z`); ;) {
    const ym = cursor.toISOString().slice(0, 7);
    points.push({ label: label(ym), value: perMonth.get(ym) ?? 0 });
    if (ym === last) break;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return points;
}

function ChartCard({
  title,
  result,
  copy,
  count,
  label,
}: {
  title: string;
  result: AggregateResult;
  copy: ReturnType<typeof dashboardCopy>;
  count: (n: number) => string;
  label: (key: string) => { label: string; detail?: string };
}) {
  const slices: readonly Slice[] = result.buckets.slice(0, TOP).map((bucket) => {
    const parts = label(bucket.key);
    return {
      key: bucket.key,
      label: parts.label,
      value: bucket.count,
      ...(parts.detail !== undefined ? { detail: parts.detail } : {}),
    };
  });
  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>{title}</h2>
      {slices.length > 0 ? (
        <BarList slices={slices} valueLabel={count} />
      ) : (
        <p className={styles.muted}>{copy.market.empty}</p>
      )}
      {result.suppressedGroups > 0 && (
        <p className={styles.meta}>
          {copy.market.suppressed(result.suppressedGroups, result.suppressedEvents)}
        </p>
      )}
    </section>
  );
}
