/**
 * Skema instalasi di laporan PDF (permintaan pemilik 2026-10-12: "skema denahnya mana?").
 *
 * Gambarnya sama dengan layar skema web (`apps/web/src/components/schematic`): metrik tata letak,
 * warna, dan urutan elemennya disalin dari sana, karena laporan adalah dokumen cetak mandiri yang
 * dirakit di API tanpa React. Seperti renderer web, fungsi ini **tidak menambahkan informasi** —
 * setiap label, ukuran, dan elevasi berasal dari topologi skema yang dibekukan ke payload.
 * **Fungsi murni:** topologi masuk, string SVG keluar; setiap teks di-escape.
 */
import {
  isFlowSchematic,
  type AnySchematic,
  type FlowLinkRole,
  type FlowSchematic,
  type Locale,
  type Schematic,
} from '@snouty/shared-types';

/** Warna skema — token yang sama dengan layar web (`schematic.module.css`), lihat `PRINT_PALETTE`. */
export interface SchematicColors {
  readonly ink: string;
  readonly muted: string;
  readonly actionText: string;
  readonly actionSoftBg: string;
  readonly pipeMain: string;
  readonly pipeMid: string;
  readonly pipeFixture: string;
  readonly surface: string;
  readonly surfaceSchematic: string;
  readonly gridLine: string;
  readonly floorLine: string;
  readonly nodeBorder: string;
}

/** Lebar gambar di halaman A4 (kolom isi ±184 mm); tinggi mengikuti isi. */
const CANVAS_WIDTH = 720;

const GROUND_LABEL: Readonly<Record<Locale, string>> = {
  id: '±0.00 MUKA TANAH',
  en: '±0.00 GROUND LEVEL',
};

const MONO = "'IBM Plex Mono','Liberation Mono',monospace";
const SANS = "'IBM Plex Sans','Liberation Sans',sans-serif";

export function renderSchematicSvg(
  schematic: AnySchematic,
  locale: Locale,
  colors: SchematicColors,
): string {
  return isFlowSchematic(schematic)
    ? flowSvg(schematic, colors)
    : buildingSvg(schematic, locale, colors);
}

// ── Skema bangunan (lantai per lantai) — metrik dari `schematic-view.tsx` ──
const LABEL_COLUMN = 84;
const RISER_COLUMN = 76;
const FLOOR_HEIGHT = 132;
const FIXTURE_WIDTH = 96;
const FIXTURE_HEIGHT = 46;
const FIXTURE_GAP = 14;
const PADDING = 18;
const GROUND_BAND = 34;
const MAX_SLOT = FIXTURE_WIDTH * 3.4;

function buildingSvg(schematic: Schematic, locale: Locale, c: SchematicColors): string {
  const floors = schematic.floors;
  const fixturesOn = (level: number) =>
    schematic.nodes.filter((n) => n.type === 'fixture' && n.floorLevel === level);
  const maxFixtures = Math.max(1, ...floors.map((f) => fixturesOn(f.level).length));
  const riserX = LABEL_COLUMN + RISER_COLUMN / 2;
  const branchStartX = LABEL_COLUMN + RISER_COLUMN;
  const width = Math.max(
    CANVAS_WIDTH,
    branchStartX + maxFixtures * (FIXTURE_WIDTH + FIXTURE_GAP) + PADDING * 2,
  );
  const slot = Math.min(
    MAX_SLOT,
    Math.max(FIXTURE_WIDTH + FIXTURE_GAP, (width - branchStartX - PADDING) / maxFixtures),
  );
  const fixtureX = (position: number) =>
    branchStartX + position * slot + (slot - FIXTURE_WIDTH) / 2;
  const height = PADDING + floors.length * FLOOR_HEIGHT + GROUND_BAND;

  const floorsSvg = floors
    .map((floor, index) => {
      const top = PADDING + index * FLOOR_HEIGHT;
      const baseline = top + FLOOR_HEIGHT;
      const branchY = top + 58;
      const fixtures = fixturesOn(floor.level);
      const branchEnd =
        fixtures.length > 0 ? fixtureX(fixtures.length - 1) + FIXTURE_WIDTH : branchStartX;
      const boxes = fixtures
        .map((node, position) => {
          const x = fixtureX(position);
          const boxTop = branchY + 22;
          return (
            line(x + FIXTURE_WIDTH / 2, branchY, x + FIXTURE_WIDTH / 2, boxTop, c.pipeFixture, 2) +
            `<rect x="${n(x)}" y="${n(boxTop)}" width="${FIXTURE_WIDTH}" height="${FIXTURE_HEIGHT}" rx="4" fill="${c.surface}" stroke="${c.nodeBorder}" stroke-width="1"/>` +
            text(x + 8, boxTop + 17, node.code ?? '', MONO, 10.5, c.actionText) +
            text(x + 8, boxTop + 31, node.label ?? '', SANS, 11.5, c.ink) +
            text(x + 8, boxTop + 42, node.size ?? '', MONO, 9.5, c.muted)
          );
        })
        .join('');
      return (
        line(0, baseline, width, baseline, c.floorLine, 3) +
        text(PADDING, top + 24, floor.shortLabel, MONO, 13, c.ink, 600) +
        text(PADDING, top + 40, floor.elevationLabel, MONO, 9.5, c.muted) +
        line(riserX, top, riserX, baseline, c.pipeMain, 4) +
        line(riserX, branchY, branchEnd, branchY, c.pipeMid, 3) +
        `<circle cx="${n(riserX)}" cy="${n(branchY)}" r="7" fill="${c.surface}" stroke="${c.pipeMain}" stroke-width="3"/>` +
        boxes
      );
    })
    .join('');

  return svg(
    width,
    height,
    c,
    `<pattern id="report-ground" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(135)"><line x1="0" y1="0" x2="0" y2="8" stroke="${c.floorLine}" stroke-width="1"/></pattern>`,
    floorsSvg +
      `<rect x="0" y="${n(height - GROUND_BAND)}" width="${n(width)}" height="${GROUND_BAND}" fill="url(#report-ground)"/>` +
      text(PADDING, height - GROUND_BAND + 20, GROUND_LABEL[locale], MONO, 9.5, c.muted),
  );
}

// ── Skema aliran (kasus teknis) — metrik dari `flow-schematic-view.tsx` ──
const NODE_WIDTH = 330;
const NODE_HEIGHT = 54;
const LINK_HEIGHT = 56;
const LEAF_WIDTH = 96;
const LEAF_HEIGHT = 40;
const LEAF_GAP = 14;
const FLOW_PADDING = 24;
const MAX_LEAF_SLOT = LEAF_WIDTH * 2;

function flowSvg(schematic: FlowSchematic, c: SchematicColors): string {
  const leaves = schematic.leaves;
  const leafCount = leaves?.items.length ?? 0;
  const leavesWidth = leafCount * (LEAF_WIDTH + LEAF_GAP) - LEAF_GAP;
  const width = Math.max(
    CANVAS_WIDTH,
    NODE_WIDTH + FLOW_PADDING * 2 + 180,
    leavesWidth + FLOW_PADDING * 2,
  );
  const left = Math.max(FLOW_PADDING, Math.round((width - NODE_WIDTH) / 2));
  const leafSlot =
    leafCount > 0
      ? Math.min(
          MAX_LEAF_SLOT,
          Math.max(LEAF_WIDTH + LEAF_GAP, (width - FLOW_PADDING * 2) / leafCount),
        )
      : 0;
  const leavesLeft = Math.round((width - leafSlot * leafCount) / 2);
  const leafX = (position: number) =>
    leavesLeft + position * leafSlot + (leafSlot - LEAF_WIDTH) / 2;
  const centerX = left + NODE_WIDTH / 2;
  const nodeTop = (index: number) => FLOW_PADDING + index * (NODE_HEIGHT + LINK_HEIGHT);
  const lastBottom = nodeTop(schematic.nodes.length - 1) + NODE_HEIGHT;
  const leavesTop = lastBottom + 58;
  const height = (leaves ? leavesTop + LEAF_HEIGHT : lastBottom) + FLOW_PADDING;

  const links = schematic.links
    .map((link, index) => {
      const from = nodeTop(index) + NODE_HEIGHT;
      const to = nodeTop(index + 1);
      const role = legendRole(link.role);
      const color = role === 'main' ? c.pipeMain : role === 'branch' ? c.pipeMid : c.pipeFixture;
      return (
        line(centerX, from, centerX, to, color, role === 'main' ? 4 : role === 'branch' ? 3 : 2) +
        (link.label !== ''
          ? text(centerX + 12, (from + to) / 2 + 4, link.label, MONO, 10.5, c.actionText, 500)
          : '')
      );
    })
    .join('');

  const nodes = schematic.nodes
    .map((node, index) => {
      const y = nodeTop(index);
      const fill = node.highlighted ? c.actionSoftBg : c.surface;
      const stroke = node.highlighted ? c.pipeMain : c.ink;
      const strokeWidth = node.type === 'source' && !node.highlighted ? 2 : 1.5;
      return (
        `<rect x="${n(left)}" y="${n(y)}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="5" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>` +
        text(
          left + 14,
          y + (node.detail ? 23 : 32),
          node.title,
          SANS,
          12.5,
          node.highlighted ? c.actionText : c.ink,
          600,
        ) +
        (node.detail ? text(left + 14, y + 40, node.detail, MONO, 10, c.muted) : '')
      );
    })
    .join('');

  const leafSvg = leaves
    ? text(centerX + 12, lastBottom + 24, leaves.title, MONO, 10, c.muted) +
      line(centerX, lastBottom, centerX, leavesTop - 16, c.pipeFixture, 2) +
      line(
        Math.min(centerX, leafX(0) + LEAF_WIDTH / 2),
        leavesTop - 16,
        Math.max(centerX, leafX(leafCount - 1) + LEAF_WIDTH / 2),
        leavesTop - 16,
        c.pipeFixture,
        2,
      ) +
      leaves.items
        .map((item, position) => {
          const x = leafX(position);
          return (
            line(
              x + LEAF_WIDTH / 2,
              leavesTop - 16,
              x + LEAF_WIDTH / 2,
              leavesTop,
              c.pipeFixture,
              2,
            ) +
            `<rect x="${n(x)}" y="${n(leavesTop)}" width="${LEAF_WIDTH}" height="${LEAF_HEIGHT}" rx="4" fill="${c.surface}" stroke="${c.nodeBorder}" stroke-width="1"/>` +
            text(x + 8, leavesTop + 17, item.label, SANS, 11.5, c.ink) +
            (item.detail ? text(x + 8, leavesTop + 31, item.detail, MONO, 9.5, c.muted) : '')
          );
        })
        .join('')
    : '';

  return svg(width, height, c, '', links + nodes + leafSvg);
}

function legendRole(role: FlowLinkRole): 'main' | 'branch' | 'fixture_connection' {
  if (role === 'branch') return 'branch';
  if (role === 'fixture_connection') return 'fixture_connection';
  return 'main';
}

// ── Primitif SVG ──
function svg(
  width: number,
  height: number,
  c: SchematicColors,
  defs: string,
  body: string,
): string {
  return (
    `<svg class="schematic" viewBox="0 0 ${n(width)} ${n(height)}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img">` +
    `<defs><pattern id="report-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0v24" fill="none" stroke="${c.gridLine}" stroke-width="1"/></pattern>${defs}</defs>` +
    `<rect width="${n(width)}" height="${n(height)}" fill="${c.surfaceSchematic}"/>` +
    `<rect width="${n(width)}" height="${n(height)}" fill="url(#report-grid)"/>` +
    body +
    `</svg>`
  );
}

function line(x1: number, y1: number, x2: number, y2: number, stroke: string, width: number) {
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${width}"/>`;
}

function text(
  x: number,
  y: number,
  value: string,
  family: string,
  size: number,
  fill: string,
  weight = 400,
): string {
  return `<text x="${n(x)}" y="${n(y)}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escSvg(value)}</text>`;
}

const n = (value: number) => String(Math.round(value * 10) / 10);

function escSvg(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
