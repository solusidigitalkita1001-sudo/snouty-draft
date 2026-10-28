'use client';

/**
 * Pasar (P26-07, dirapikan P26-16 setelah pemilik menilai kartunya "cuma tulisan doang").
 *
 * Susunannya: empat angka ringkas di atas, peta permintaan, lalu tren dan tiga daftar peringkat
 * (minat produk, provinsi, pola proyek) yang kini membawa nomor urut, ikon, lencana ukuran, batang,
 * dan porsinya terhadap keseluruhan. Ambang k-anonimitas sudah diterapkan server; panel ini
 * menampilkan dan menyebut berapa kelompok yang ditahan.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLocale } from '../locale';
import { RankList, TrendLine, type RankRow } from './charts';
import {
  fetchMarket,
  type AggregateResult,
  type Loaded,
  type MarketDashboard,
} from './dashboard-api';
import { dashboardCopy } from './dashboard-copy';
import {
  ChartIcon,
  ChatIcon,
  ContactIcon,
  MapPinIcon,
  PipeIcon,
  ScaleIcon,
  StageIcon,
} from './dashboard-icons';
import { ProvinceMap } from './province-map';
import styles from './dashboard.module.css';
import { EmptyState } from './empty-state';
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
  const percent = (ratio: number) =>
    new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
      style: 'percent',
      maximumFractionDigits: 0,
    }).format(ratio);

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
        <EmptyState mood="confused" text={COPY.market.empty} />
      )}

      {data?.kind === 'ok' && data.value.total > 0 && (
        <>
          {/* Empat angka yang paling sering ditanyakan, sebelum grafik apa pun. */}
          <div className={[styles.statRow, styles.statRow4].join(' ')}>
            <Kpi
              icon={<ChatIcon />}
              value={String(data.value.funnel.started)}
              label={COPY.market.funnel.started}
            />
            <Kpi
              icon={<StageIcon stage="act" />}
              value={String(data.value.funnel.reachedSolution)}
              label={COPY.market.funnel.reachedSolution}
              detail={percent(
                data.value.funnel.started === 0
                  ? 0
                  : data.value.funnel.reachedSolution / data.value.funnel.started,
              )}
            />
            <Kpi
              icon={<ContactIcon kind="requested" />}
              value={String(data.value.funnel.requestedQuotation)}
              label={COPY.market.funnel.requestedQuotation}
            />
            <Kpi
              icon={<ChartIcon />}
              value={percent(data.value.scope.ratio)}
              label={COPY.market.funnel.routedToTechnical}
              detail={COPY.market.drainage(data.value.drainage)}
            />
          </div>

          <section className={[styles.card, styles.cardWide].join(' ')}>
            <ProvinceMap map={data.value.map} />
          </section>

          <div className={styles.cards}>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>
                <ChartIcon />
                {COPY.market.trendTitle}
              </h2>
              <TrendCard points={monthlyTrend(data.value.regional, month)} copy={COPY} />
            </section>

            <section className={styles.card}>
              <h2 className={styles.cardTitle}>
                <PipeIcon />
                {COPY.market.products}
              </h2>
              <RankCard
                result={data.value.productInterest}
                copy={COPY}
                total={data.value.total}
                row={(key) => {
                  const [family = '', size = '', ym = ''] = key.split('|');
                  return { label: family, badge: size, detail: month(ym), icon: <PipeIcon /> };
                }}
              />
            </section>
          </div>

          <div className={styles.cards}>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>
                <MapPinIcon />
                {COPY.market.regional}
              </h2>
              <RankCard
                result={data.value.regional}
                copy={COPY}
                total={data.value.total}
                row={(key) => {
                  const [name = '', ym = ''] = key.split('|');
                  return { label: region(name), detail: month(ym), icon: <MapPinIcon /> };
                }}
              />
            </section>

            <section className={styles.card}>
              <h2 className={styles.cardTitle}>
                <ScaleIcon scale="district" />
                {COPY.market.projects}
              </h2>
              <RankCard
                result={data.value.projects}
                copy={COPY}
                total={data.value.total}
                row={(key) => {
                  const [type = '', scale = '', place = ''] = key.split('|');
                  return {
                    label: building(type),
                    detail: `${COPY.market.scale[scale] ?? scale} · ${region(place)}`,
                    icon: <ScaleIcon scale={marketScale(scale)} />,
                  };
                }}
              />
            </section>
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

/** Skala event pasar (kecil/sedang/besar) → ikon proyek yang sama dengan papan prospek. */
function marketScale(scale: string): string {
  if (scale === 'besar') return 'district';
  if (scale === 'sedang') return 'building';
  return 'house';
}

function Kpi({
  icon,
  value,
  label,
  detail,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  detail?: string;
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
      {detail !== undefined && <span className={styles.statDetail}>{detail}</span>}
    </div>
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

/**
 * Garis tren butuh dua titik — sebelum ada bulan kedua `TrendLine` mengembalikan null, dan
 * kartunya tampil sebagai kotak kosong tanpa satu kata pun (P31-78). Sekarang kartunya
 * mengatakan apa yang kurang, sama seperti kartu peringkat di sebelahnya.
 */
function TrendCard({
  points,
  copy,
}: {
  points: readonly { readonly label: string; readonly value: number }[];
  copy: ReturnType<typeof dashboardCopy>;
}) {
  if (points.length < 2) return <p className={styles.muted}>{copy.market.trendThin}</p>;
  return <TrendLine points={points} valueLabel={(n) => copy.market.consultations(n)} />;
}

function RankCard({
  result,
  copy,
  total,
  row,
}: {
  result: AggregateResult;
  copy: ReturnType<typeof dashboardCopy>;
  total: number;
  row: (key: string) => Omit<RankRow, 'key' | 'value'>;
}) {
  const rows: readonly RankRow[] = result.buckets.slice(0, TOP).map((bucket) => ({
    key: bucket.key,
    value: bucket.count,
    ...row(bucket.key),
  }));
  return (
    <>
      {rows.length > 0 ? (
        <RankList rows={rows} total={total} valueLabel={(n) => copy.market.consultations(n)} />
      ) : (
        <p className={styles.muted}>{copy.market.empty}</p>
      )}
      {result.suppressedGroups > 0 && (
        <p className={styles.meta}>
          {copy.market.suppressed(result.suppressedGroups, result.suppressedEvents)}
        </p>
      )}
    </>
  );
}
