'use client';

/**
 * Peta permintaan (P26-12, dirapikan P26-13 setelah pemilik menilai versi pertama "jelek banget").
 *
 * Tiga hal yang membuat versi pertama buruk dan diperbaiki di sini:
 *   1. **Proporsi melar** — tinggi bingkai dulu ditetapkan 380, padahal rentang Indonesia 45,8° × 16,8°.
 *      Sekarang tinggi diturunkan dari bounds (dengan koreksi kosinus lintang), jadi pulau tidak gepeng.
 *   2. **Teks dan titik ikut membesar saat zoom** — ukurannya dalam satuan peta. Sekarang skalanya
 *      dibagi faktor zoom, jadi label dan titik tetap seukuran di layar.
 *   3. **Zoom melompat** — perpindahan bingkai kini dianimasikan (dan langsung bila pengguna meminta
 *      gerak dikurangi).
 *
 * Zona diwarnai satu hue terang→gelap menurut jumlah konsultasi; warna tidak pernah satu-satunya
 * pembawa makna — ada label angka, tooltip, dan daftar teks di bawah peta.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from '../locale';
import { dashboardCopy } from './dashboard-copy';
import type { MapDemand } from './dashboard-api';
import { MapPinIcon, ZoomOutIcon } from './dashboard-icons';
import styles from './province-map.module.css';
import atlas from './provinces.json';

interface Atlas {
  readonly bounds: readonly number[];
  readonly provinces: readonly {
    readonly name: string;
    readonly center: readonly number[];
    readonly rings: readonly (readonly (readonly number[])[])[];
  }[];
}

const MAP = atlas as Atlas;
const [MIN_LNG = 95, MIN_LAT = -11, MAX_LNG = 141, MAX_LAT = 6] = MAP.bounds;
const W = 1000;
/** Tinggi dari rentang sebenarnya: 1° bujur ≈ 1° lintang × cos(lintang) di dekat khatulistiwa. */
const H = Math.round(
  (W * (MAX_LAT - MIN_LAT)) /
    ((MAX_LNG - MIN_LNG) * Math.cos((((MAX_LAT + MIN_LAT) / 2) * Math.PI) / 180)),
);
const STEPS = 5;
const ZOOM_MS = 420;

type Box = { x: number; y: number; w: number; h: number };
const FULL: Box = { x: 0, y: 0, w: W, h: H };

function project(lng: number, lat: number): [number, number] {
  return [((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * W, ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * H];
}

const pathOf = (rings: Atlas['provinces'][number]['rings']) =>
  `${rings
    .map((ring) =>
      ring
        .map(([lng = 0, lat = 0], i) => {
          const [x, y] = project(lng, lat);
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' '),
    )
    .join(' Z ')} Z`;

/** Kotak provinsi, dipaskan ke rasio bingkai supaya zoom tidak menggepengkan isinya. */
function boxOf(rings: Atlas['provinces'][number]['rings']): Box {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of rings) {
    for (const [lng = 0, lat = 0] of ring) {
      const [x, y] = project(lng, lat);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const pad = Math.max(10, (maxX - minX) * 0.14);
  let w = maxX - minX + pad * 2;
  let h = maxY - minY + pad * 2;
  const ratio = W / H;
  if (w / h > ratio) h = w / ratio;
  else w = h * ratio;
  return { x: (minX + maxX) / 2 - w / 2, y: (minY + maxY) / 2 - h / 2, w, h };
}

/** Perpindahan bingkai yang mulus; langsung bila pengguna meminta gerak dikurangi. */
function useAnimatedBox(target: Box): Box {
  const [box, setBox] = useState(target);
  const from = useRef(target);
  const frame = useRef(0);

  useEffect(() => {
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      from.current = target;
      setBox(target);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    const ease = (t: number) => 1 - (1 - t) ** 3;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ZOOM_MS);
      const k = ease(t);
      const next = {
        x: origin.x + (target.x - origin.x) * k,
        y: origin.y + (target.y - origin.y) * k,
        w: origin.w + (target.w - origin.w) * k,
        h: origin.h + (target.h - origin.h) * k,
      };
      setBox(next);
      from.current = next;
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [target]);

  return box;
}

export function ProvinceMap({ map }: { map: MapDemand }) {
  const { locale } = useLocale();
  const COPY = dashboardCopy(locale);
  const [focus, setFocus] = useState<string | null>(null);
  const [hover, setHover] = useState<{ label: string; count: number; x: number; y: number } | null>(
    null,
  );

  const shapes = useMemo(() => MAP.provinces.map((p) => ({ ...p, d: pathOf(p.rings) })), []);
  const counts = useMemo(
    () => new Map(map.provinces.map((p) => [p.name, p.count])),
    [map.provinces],
  );
  const max = Math.max(...map.provinces.map((p) => p.count), 1);

  const focused = shapes.find((p) => p.name === focus) ?? null;
  const target = useMemo(() => (focused ? boxOf(focused.rings) : FULL), [focused]);
  const view = useAnimatedBox(target);
  /** Faktor zoom: dipakai membagi ukuran teks dan titik supaya tetap seukuran di layar. */
  const k = view.w / W;

  const points = focus === null ? [] : map.points.filter((point) => point.province === focus);
  const maxPoint = Math.max(...points.map((p) => p.count), 1);
  const radius = (count: number) => (5 + 11 * Math.sqrt(count / maxPoint)) * k;

  const open = (name: string) => {
    setHover(null);
    setFocus(name);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.title}>
          <MapPinIcon />
          {focus === null ? COPY.map.title : COPY.map.focus(focus)}
        </span>
        {focus !== null && (
          <button type="button" className={styles.back} onClick={() => setFocus(null)}>
            <ZoomOutIcon />
            <span>{COPY.map.zoomOut}</span>
          </button>
        )}
      </div>

      <div className={styles.canvas}>
        <svg
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          className={styles.svg}
          role="img"
          aria-label={
            map.provinces.length === 0
              ? COPY.map.empty
              : map.provinces.map((p) => `${p.name}: ${COPY.map.count(p.count)}`).join('; ')
          }
          onMouseLeave={() => setHover(null)}
        >
          {shapes.map((province) => {
            const count = counts.get(province.name) ?? 0;
            const step = count === 0 ? 0 : Math.max(1, Math.ceil((count / max) * STEPS));
            const [cx, cy] = project(province.center[0] ?? 0, province.center[1] ?? 0);
            const dim = focus !== null && focus !== province.name;
            return (
              <path
                key={province.name}
                d={province.d}
                className={[
                  styles.zone,
                  styles[`step${step}`],
                  count > 0 ? styles.zoneLive : '',
                  focus === province.name ? styles.zoneOn : '',
                  dim ? styles.zoneDim : '',
                ].join(' ')}
                onMouseEnter={() =>
                  count > 0 && setHover({ label: province.name, count, x: cx, y: cy })
                }
                onClick={() => count > 0 && open(province.name)}
              />
            );
          })}

          {/* Angka provinsi hanya saat seluruh Indonesia terlihat; saat fokus, kota yang bicara. */}
          {focus === null &&
            map.provinces.map((province) => {
              const shape = shapes.find((s) => s.name === province.name);
              if (shape === undefined) return null;
              const [cx, cy] = project(shape.center[0] ?? 0, shape.center[1] ?? 0);
              return (
                <text
                  key={province.name}
                  x={cx}
                  y={cy}
                  className={styles.zoneLabel}
                  style={{ fontSize: 11 * k, strokeWidth: 3 * k }}
                >
                  {province.count}
                </text>
              );
            })}

          {points.map((point) => {
            const [cx, cy] = project(point.lng, point.lat);
            const r = radius(point.count);
            return (
              <g key={`${point.city}|${point.lat}|${point.lng}`}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  className={styles.point}
                  onMouseEnter={() =>
                    setHover({ label: point.city, count: point.count, x: cx, y: cy })
                  }
                />
                <text
                  x={cx}
                  y={cy + r + 11 * k}
                  className={styles.pointLabel}
                  style={{ fontSize: 10 * k, strokeWidth: 3 * k }}
                >
                  {point.city}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip sebagai elemen HTML: ukurannya tidak ikut zoom, dan teksnya tajam. */}
        {hover !== null && (
          <div
            className={styles.tip}
            style={{
              left: `${((hover.x - view.x) / view.w) * 100}%`,
              top: `${((hover.y - view.y) / view.h) * 100}%`,
            }}
            role="status"
          >
            <strong>{hover.label}</strong>
            <span>{COPY.map.count(hover.count)}</span>
          </div>
        )}
      </div>

      {map.provinces.length === 0 ? (
        <p className={styles.note}>{COPY.map.empty}</p>
      ) : (
        <ul className={styles.legend}>
          {map.provinces.map((province) => (
            <li key={province.name}>
              <button
                type="button"
                className={focus === province.name ? styles.legendOn : undefined}
                onClick={() => (focus === province.name ? setFocus(null) : open(province.name))}
              >
                <span className={styles.legendName}>{province.name}</span>
                <span className={styles.legendCount}>{province.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {focus !== null && points.length === 0 && <p className={styles.note}>{COPY.map.noPoints}</p>}
      {(map.withoutRegion > 0 || map.suppressedPoints > 0) && (
        <p className={styles.note}>{COPY.map.hidden(map.withoutRegion, map.suppressedPoints)}</p>
      )}
    </div>
  );
}
