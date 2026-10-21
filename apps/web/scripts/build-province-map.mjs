#!/usr/bin/env node
/**
 * Membangun aset peta provinsi Indonesia untuk dashboard pasar (P26-12).
 *
 *   node scripts/build-province-map.mjs [berkas-ne-50m.geojson]
 *
 * Sumber: Natural Earth admin-1 (**domain publik**, naturalearthdata.com) — dipilih karena lisensinya
 * jelas dan namanya mutakhir. Berkas sumbernya 2,3 MB; yang masuk repo hanya Indonesia, disederhanakan
 * Douglas–Peucker dan dibulatkan 3 desimal (±100 m) — cukup untuk peta selebar layar.
 *
 * Tanpa argumen, berkasnya diunduh ke direktori sementara. Hasil: src/components/dashboard/provinces.json
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson';
const OUT = new URL('../src/components/dashboard/provinces.json', import.meta.url);
/** Derajat; ±0,02° ≈ 2 km — garis pantai tetap terbaca pada peta selebar 900 px. */
const TOLERANCE = 0.02;
const DECIMALS = 3;

/** Nama Natural Earth → nama yang dipakai event pasar (`market-intelligence/domain/region.ts`). */
const RENAME = {
  'Jakarta Raya': 'DKI Jakarta',
  Yogyakarta: 'DI Yogyakarta',
  'Bangka-Belitung': 'Kepulauan Bangka Belitung',
};

function perpendicularDistance([x, y], [x1, y1], [x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function simplify(points, tolerance) {
  if (points.length < 3) return points;
  let index = 0;
  let max = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (d > max) {
      max = d;
      index = i;
    }
  }
  if (max <= tolerance) return [points[0], points[points.length - 1]];
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ];
}

const round = (ring) => ring.map(([x, y]) => [Number(x.toFixed(DECIMALS)), Number(y.toFixed(DECIMALS))]);

/** Pulau kecil yang menyusut jadi garis dibuang: tidak terlihat, tetapi tetap memakan byte. */
function simplifyRings(rings) {
  return rings
    .map((ring) => round(simplify(ring, TOLERANCE)))
    .filter((ring) => ring.length >= 4);
}

const source = process.argv[2];
let raw;
if (source) {
  raw = readFileSync(source, 'utf8');
} else {
  const response = await fetch(SOURCE);
  if (!response.ok) throw new Error(`unduhan gagal: ${response.status}`);
  raw = await response.text();
  writeFileSync(join(mkdtempSync(join(tmpdir(), 'ne-')), 'ne50.geojson'), raw);
}

const features = JSON.parse(raw).features.filter((f) => f.properties.admin === 'Indonesia');
if (features.length === 0) throw new Error('tidak ada fitur Indonesia di sumber');

const provinces = features
  .map((feature) => {
    const name = RENAME[feature.properties.name] ?? feature.properties.name;
    const polygons =
      feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const rings = polygons.flatMap((polygon) => simplifyRings(polygon)).filter((r) => r.length > 0);
    // Titik tengah dari kotak pembatas cincin terbesar: tempat label dan gelembung jumlah.
    const largest = rings.reduce((a, b) => (b.length > a.length ? b : a), rings[0] ?? []);
    const xs = largest.map(([x]) => x);
    const ys = largest.map(([, y]) => y);
    return {
      name,
      center: [
        Number(((Math.min(...xs) + Math.max(...xs)) / 2).toFixed(DECIMALS)),
        Number(((Math.min(...ys) + Math.max(...ys)) / 2).toFixed(DECIMALS)),
      ],
      rings,
    };
  })
  .filter((p) => p.rings.length > 0)
  .sort((a, b) => a.name.localeCompare(b.name));

const bounds = provinces
  .flatMap((p) => p.rings.flat())
  .reduce(
    (box, [x, y]) => [
      Math.min(box[0], x),
      Math.min(box[1], y),
      Math.max(box[2], x),
      Math.max(box[3], y),
    ],
    [180, 90, -180, -90],
  );

const asset = {
  source: 'Natural Earth admin-1 (public domain, naturalearthdata.com)',
  bounds: bounds.map((v) => Number(v.toFixed(DECIMALS))),
  provinces,
};
writeFileSync(OUT, `${JSON.stringify(asset)}\n`);
const kb = (JSON.stringify(asset).length / 1024).toFixed(0);
console.log(`✓ ${provinces.length} provinsi · ${kb} KB · ${OUT.pathname.split('/').pop()}`);
