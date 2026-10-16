/**
 * Denah instalasi (DD-01 #7, P17-07): potongan bangunan dan denah jalur per lantai, sebagai SVG.
 *
 * Satu modul untuk layar dan laporan. Isinya hanya data hitungan yang tersimpan di kebutuhan
 * rekomendasi (`SolutionNeed`): jumlah lantai dan tingginya, ukuran bangunan, cabang air bersih per
 * lantai beserta alat yang dilayaninya, sumber air, pompa, dan ukuran pembuangan. Letak ruang
 * TIDAK dikarang: alat digambar berurutan di cabangnya, bukan di posisi ruangan; gambarnya
 * skematik, tidak berskala (kecuali kotak bangunan di denah, yang mengikuti panjang × lebar).
 * Warna lewat token `--snouty-*`; gambar alat dari sprite ilustrasi (`#il-…`).
 */

import type { NeedBranch, SolutionNeed } from '@snouty/shared-types';
import { sceneHref, type SceneIllustration } from './illustrations.js';

export type DrawingSource = 'rooftop_tank' | 'ground_tank' | 'municipal' | 'well_pump';

export interface DrawingInput {
  readonly floors: number;
  readonly floorHeightM: number;
  readonly lengthM?: number;
  readonly widthM?: number;
  readonly mainSize?: string;
  readonly branches: readonly NeedBranch[];
  readonly source: DrawingSource | null;
  readonly boosterPump: boolean;
  readonly drainage: {
    readonly soilSize?: string;
    readonly wasteSize?: string;
    readonly soilVentSize?: string;
    readonly wasteVentSize?: string;
  } | null;
}

export interface DrawingCopy {
  readonly floor: (level: number, elevation: string) => string;
  readonly roof: (elevation: string) => string;
  readonly ground: string;
  readonly floorHeight: (height: string) => string;
  readonly length: (meters: string) => string;
  readonly width: (meters: string) => string;
  readonly tank: string;
  readonly groundTank: string;
  readonly meter: string;
  readonly well: string;
  readonly pump: string;
  readonly septic: string;
  readonly vent: string;
  readonly riser: string;
  readonly soilStack: string;
  /** Pipa tegak air bekas di denah (dirapikan 2026-10-16). */
  readonly wasteStack: string;
  /** Label pendek pipa tegak di denah ("Air kotor", "Air bekas"), diikuti ukurannya. */
  readonly planSoil: string;
  readonly planWaste: string;
  /** Nama ruang basah di denah: kamar mandi, wastafel, dapur, toilet. */
  readonly rooms: Readonly<Record<'bathroom' | 'basin' | 'kitchen' | 'toilet', string>>;
  /** Catatan di atas denah: letak ruang mengikuti denah pengguna. */
  readonly planNote: string;
  readonly fixtures: Readonly<Record<FixtureKind, string>>;
  readonly decimal: (value: number) => string;
}

export type FixtureKind = 'shower' | 'wc' | 'basin' | 'kitchen' | 'urinal';

const FIXTURE_IMAGE: Readonly<Record<FixtureKind, SceneIllustration>> = {
  shower: 'shower',
  wc: 'wc',
  basin: 'basin',
  kitchen: 'kitchen',
  urinal: 'urinal',
};

/** Data gambar dari kebutuhan; `null` bila tidak ada bangunan (kasus teknis, rekomendasi lama). */
export function drawingInputFrom(needs: readonly SolutionNeed[]): DrawingInput | null {
  const building = needs.find((n) => n.kind === 'building')?.building;
  if (!building) return null;
  const has = (kind: SolutionNeed['kind']) => needs.some((n) => n.kind === kind);
  const source: DrawingSource | null = has('rooftop_tank')
    ? 'rooftop_tank'
    : has('ground_tank')
      ? 'ground_tank'
      : has('municipal')
        ? 'municipal'
        : has('well_pump')
          ? 'well_pump'
          : null;
  const drainage = needs.find((n) => n.kind === 'drainage');
  const branches = building.branches ?? [];
  if (branches.length === 0 && !drainage) return null;
  return {
    floors: building.floors,
    floorHeightM: building.floorHeightM,
    ...(building.lengthM !== undefined ? { lengthM: building.lengthM } : {}),
    ...(building.widthM !== undefined ? { widthM: building.widthM } : {}),
    ...(building.mainSize !== undefined ? { mainSize: building.mainSize } : {}),
    branches,
    source,
    boosterPump: has('booster_pump'),
    drainage: drainage
      ? {
          ...(drainage.soilSize !== undefined ? { soilSize: drainage.soilSize } : {}),
          ...(drainage.wasteSize !== undefined ? { wasteSize: drainage.wasteSize } : {}),
          ...(drainage.soilVentSize !== undefined ? { soilVentSize: drainage.soilVentSize } : {}),
          ...(drainage.wasteVentSize !== undefined
            ? { wasteVentSize: drainage.wasteVentSize }
            : {}),
        }
      : null,
  };
}

/** Alat di satu cabang, berurutan: tiap kamar mandi shower + kloset, lalu wastafel, dapur, urinoir. */
export function branchFixtures(branch: NeedBranch): readonly FixtureKind[] {
  return [
    ...Array.from({ length: branch.bathrooms }, () => ['shower', 'wc'] as const).flat(),
    ...Array.from({ length: branch.basins }, () => 'basin' as const),
    ...Array.from({ length: branch.kitchens }, () => 'kitchen' as const),
    ...Array.from({ length: branch.urinals }, () => 'urinal' as const),
  ];
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const pathEl = (d: string, color: string, width: number, dashed = false) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${dashed ? ' stroke-dasharray="6 5"' : ''}/>`;

const textEl = (
  x: number,
  y: number,
  value: string,
  opts: { size?: number; anchor?: string; color?: string; weight?: number } = {},
) =>
  `<text x="${x}" y="${y}" font-size="${opts.size ?? 11}" text-anchor="${opts.anchor ?? 'start'}" fill="${opts.color ?? 'var(--snouty-ink)'}"${opts.weight ? ` font-weight="${opts.weight}"` : ''}>${esc(value)}</text>`;

function tag(x: number, y: number, label: string): string {
  const w = label.length * 7 + 12;
  return (
    `<rect x="${x - w / 2}" y="${y - 9}" width="${w}" height="17" rx="3" fill="var(--snouty-surface)" stroke="var(--snouty-border)"/>` +
    `<text x="${x}" y="${y + 4}" font-size="11" text-anchor="middle" font-weight="600" fill="var(--snouty-ink)" font-family="var(--snouty-font-mono, monospace)">${esc(label)}</text>`
  );
}

function icon(name: SceneIllustration, cx: number, bottom: number, size: number): string {
  const h = size * (100 / 120);
  return `<svg x="${cx - size / 2}" y="${bottom - h}" width="${size}" height="${h}" viewBox="0 0 120 100"><use href="${sceneHref(name)}"/></svg>`;
}

const SOIL = 'var(--snouty-muted)';
const WASTE = 'var(--snouty-muted-2)';
const MAIN = 'var(--snouty-pipe-main)';
const BRANCH = 'var(--snouty-pipe-mid)';
const DROP = 'var(--snouty-pipe-light)';

/** Potongan instalasi: lantai, sumber, pompa, pipa utama, cabang per lantai, pembuangan, ventilasi. */
export function sectionSvg(input: DrawingInput, copy: DrawingCopy): string {
  const W = 900;
  const floorPx = 128;
  const roofY = 150;
  const n = Math.max(1, input.floors);
  const groundY = roofY + n * floorPx;
  const H = groundY + 96;
  const X0 = 110;
  const X1 = 790;
  const RX = 330;
  const SX = 720;
  const WX = 752;
  const slabY = (level: number) => roofY + (n - level + 1) * floorPx;
  const out: string[] = [];

  // Tanah, bangunan, pelat lantai.
  out.push(
    `<rect x="0" y="${groundY}" width="${W}" height="${H - groundY}" fill="var(--snouty-hairline)"/>`,
  );
  out.push(
    `<line x1="0" y1="${groundY}" x2="${W}" y2="${groundY}" stroke="var(--snouty-floor-line)" stroke-width="2"/>`,
  );
  out.push(
    `<rect x="${X0}" y="${roofY}" width="${X1 - X0}" height="${groundY - roofY}" fill="var(--snouty-surface)" stroke="var(--snouty-floor-line)" stroke-width="2"/>`,
  );
  out.push(
    `<rect x="${X0 - 12}" y="${roofY - 9}" width="${X1 - X0 + 24}" height="9" fill="var(--snouty-border)"/>`,
  );
  const elevation = (level: number) => copy.decimal((level - 1) * input.floorHeightM);
  for (let level = 2; level <= n; level += 1) {
    out.push(
      `<rect x="${X0 - 6}" y="${slabY(level) - 6}" width="${X1 - X0 + 12}" height="8" fill="var(--snouty-border)"/>`,
    );
  }
  for (let level = 1; level <= n; level += 1) {
    const top = level === n ? roofY : slabY(level + 1);
    out.push(
      textEl(X0 + 8, top + 20, copy.floor(level, elevation(level)), {
        size: 10.5,
        color: 'var(--snouty-caption)',
      }),
    );
    // Ukuran tinggi lantai di kiri.
    out.push(
      pathEl(
        `M70 ${slabY(level)} V${top} M64 ${slabY(level)} H76 M64 ${top} H76`,
        'var(--snouty-caption)',
        1,
      ),
    );
    out.push(
      textEl(58, (slabY(level) + top) / 2 + 4, `${copy.decimal(input.floorHeightM)} m`, {
        size: 10.5,
        anchor: 'end',
        color: 'var(--snouty-caption)',
      }),
    );
  }
  out.push(
    textEl(X0 + 8, roofY - 16, copy.roof(copy.decimal(n * input.floorHeightM)), {
      size: 10.5,
      color: 'var(--snouty-caption)',
    }),
  );

  // Sumber air dan pompa → titik masuk pipa utama.
  let mainEntry: { x: number; y: number } | null = null;
  if (input.source === 'rooftop_tank') {
    out.push(icon('tank', 200, roofY - 10, 84));
    out.push(textEl(200, roofY - 86, copy.tank, { size: 10.5, anchor: 'middle' }));
    if (input.boosterPump) {
      out.push(icon('pump', 272, roofY - 10, 52));
      out.push(
        textEl(272, roofY - 56, copy.pump, {
          size: 10.5,
          anchor: 'middle',
          color: 'var(--snouty-assumed-text)',
        }),
      );
      out.push(pathEl(`M236 ${roofY - 22} H250 M296 ${roofY - 24} H${RX} V${roofY + 10}`, MAIN, 5));
    } else {
      out.push(pathEl(`M236 ${roofY - 22} H${RX} V${roofY + 10}`, MAIN, 5));
    }
    mainEntry = { x: RX, y: roofY };
  } else if (input.source !== null) {
    const image: SceneIllustration =
      input.source === 'ground_tank'
        ? 'groundtank'
        : input.source === 'municipal'
          ? 'meter'
          : 'well';
    const label =
      input.source === 'ground_tank'
        ? copy.groundTank
        : input.source === 'municipal'
          ? copy.meter
          : copy.well;
    out.push(icon(image, 52, H - 6, 70));
    out.push(textEl(52, H - 66, label, { size: 10, anchor: 'middle' }));
    if (input.boosterPump || input.source !== 'municipal') {
      out.push(icon('pump', 170, groundY + 40, 46));
      out.push(
        textEl(170, groundY + 54, copy.pump, {
          size: 10,
          anchor: 'middle',
          color: 'var(--snouty-assumed-text)',
        }),
      );
      out.push(
        pathEl(`M88 ${groundY + 30} H150 M192 ${groundY + 30} H${RX} V${groundY - 10}`, MAIN, 5),
      );
    } else {
      out.push(pathEl(`M88 ${groundY + 30} H${RX} V${groundY - 10}`, MAIN, 5));
    }
    mainEntry = { x: RX, y: groundY };
  }

  // Cabang per lantai dan alatnya.
  const branchYs: number[] = [];
  const firstOf: Record<number, { wc?: number; other?: number }> = {};
  for (let level = 1; level <= n; level += 1) {
    const onFloor = input.branches.filter((b) => b.floor === level);
    const kinds = onFloor.map(branchFixtures);
    const total = kinds.reduce((sum, k) => sum + k.length, 0);
    const space = SX - 40 - (RX + 44);
    const step = total > 0 ? Math.min(58, space / total) : 58;
    const size = Math.max(24, Math.min(40, step - 4));
    let cursor = RX + 44;
    onFloor.forEach((branch, i) => {
      const y = slabY(level) - 52 - i * 13;
      branchYs.push(y);
      const fixtures = kinds[i]!;
      const xs = fixtures.map(() => {
        const x = cursor;
        cursor += step;
        return x;
      });
      const end = xs.length > 0 ? xs[xs.length - 1]! : RX + 60;
      out.push(pathEl(`M${RX} ${y} H${end}`, i === 0 ? MAIN : BRANCH, i === 0 ? 4 : 3));
      out.push(`<circle cx="${RX}" cy="${y}" r="4" fill="${MAIN}"/>`);
      fixtures.forEach((kind, k) => {
        const x = xs[k]!;
        out.push(pathEl(`M${x} ${y} V${slabY(level) - size * 0.83 - 2}`, DROP, 2));
        out.push(icon(FIXTURE_IMAGE[kind], x, slabY(level) - 2, size));
        // Nama alat hanya bila ada ruang; yang berdempetan cukup dikenali dari gambarnya.
        if (step >= 50)
          out.push(
            textEl(x, slabY(level) + 13, copy.fixtures[kind], {
              size: 9,
              anchor: 'middle',
              color: 'var(--snouty-caption)',
            }),
          );
        const slot = (firstOf[level] ??= {});
        if (kind === 'wc') slot.wc ??= x;
        else slot.other ??= x;
      });
      // Ukuran cabang di ujungnya — cabang sejajar di lantai yang sama tidak saling tumpuk.
      out.push(tag(end + 30, y, branch.size));
    });
  }
  // Pipa utama (riser) menghubungkan sumber dan semua cabang.
  if (branchYs.length > 0) {
    const ys = [...branchYs, ...(mainEntry ? [mainEntry.y] : [])];
    out.push(pathEl(`M${RX} ${Math.min(...ys)} V${Math.max(...ys)}`, MAIN, 5));
    if (input.mainSize)
      out.push(tag(RX - 30, (Math.min(...ys) + Math.max(...ys)) / 2, input.mainSize));
  }

  // Pembuangan: pipa tegak air kotor dan air bekas, ventilasi di atas atap, septic/saluran.
  if (input.drainage) {
    const d = input.drainage;
    for (let level = 1; level <= n; level += 1) {
      const slot = firstOf[level];
      // Di bawah nama alat, supaya garis buang tidak melintasi teks.
      const y = level === 1 ? groundY + 24 : slabY(level) + 22;
      if (d.soilSize && slot?.wc !== undefined)
        out.push(pathEl(`M${slot.wc} ${y} H${SX}`, SOIL, 4));
      if (d.wasteSize && slot?.other !== undefined)
        out.push(pathEl(`M${slot.other} ${y + 8} H${WX}`, WASTE, 3));
    }
    if (d.soilSize) {
      out.push(pathEl(`M${SX} ${roofY - 40} V${groundY + 50} H866`, SOIL, 6));
      out.push(tag(SX - 30, (roofY + groundY) / 2, d.soilSize));
      if (d.soilVentSize) {
        out.push(pathEl(`M${SX} ${roofY - 40} V${roofY - 76}`, WASTE, 3, true));
        out.push(tag(SX - 28, roofY - 60, d.soilVentSize));
      }
    }
    if (d.wasteSize) {
      out.push(pathEl(`M${WX} ${roofY - 40} V${groundY + 28} H866`, WASTE, 4));
      out.push(tag(WX + 30, (roofY + groundY) / 2 + 30, d.wasteSize));
      if (d.wasteVentSize) {
        out.push(pathEl(`M${WX} ${roofY - 40} V${roofY - 76}`, WASTE, 3, true));
        out.push(tag(WX + 32, roofY - 60, d.wasteVentSize));
      }
    }
    out.push(
      textEl((SX + WX) / 2, roofY - 86, copy.vent, {
        size: 10,
        anchor: 'middle',
        color: 'var(--snouty-caption)',
      }),
    );
    out.push(
      `<rect x="852" y="${groundY + 16}" width="40" height="46" rx="4" fill="var(--snouty-border)" stroke="${SOIL}"/>`,
    );
    // Rata kanan di dalam bidang gambar — label di tengah kotak terpotong tepi kanan (review 0015).
    out.push(textEl(W - 4, groundY + 78, copy.septic, { size: 10, anchor: 'end' }));
  }

  // Panjang bangunan di bawah.
  if (input.lengthM !== undefined && input.widthM !== undefined) {
    const long = Math.max(input.lengthM, input.widthM);
    out.push(
      pathEl(
        `M${X0} ${groundY + 70} H${X1} M${X0} ${groundY + 64} V${groundY + 76} M${X1} ${groundY + 64} V${groundY + 76}`,
        'var(--snouty-caption)',
        1,
      ),
    );
    out.push(
      textEl((X0 + X1) / 2, groundY + 88, copy.length(copy.decimal(long)), {
        size: 11,
        anchor: 'middle',
        color: 'var(--snouty-caption)',
      }),
    );
  }

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" font-family="inherit">${out.join('')}</svg>`;
}

/** Denah jalur satu lantai: kotak bangunan sesuai panjang × lebar, cabang dan titik airnya. */
/** Alat yang buangannya ke jalur air kotor; sisanya air bekas. */
const SOIL_FIXTURES: ReadonlySet<FixtureKind> = new Set(['wc', 'urinal']);

type RoomKind = 'bathroom' | 'basin' | 'kitchen' | 'toilet';

interface Room {
  readonly kind: RoomKind;
  readonly fixtures: readonly FixtureKind[];
}

/**
 * Alat sebuah cabang dikelompokkan per ruang: tiap kamar mandi = shower + kloset, wastafel,
 * dapur, toilet urinoir. Letak ruang di denah tetap tidak dikarang (DD-01 #7): ruang-ruang berjajar
 * sepanjang cabangnya, dan catatan di gambar menyebut letaknya mengikuti denah pengguna.
 */
function branchRooms(branch: NeedBranch): readonly Room[] {
  return [
    ...Array.from({ length: branch.bathrooms }, () => ({
      kind: 'bathroom' as const,
      fixtures: ['shower', 'wc'] as const,
    })),
    ...Array.from({ length: branch.basins }, () => ({
      kind: 'basin' as const,
      fixtures: ['basin'] as const,
    })),
    ...Array.from({ length: branch.kitchens }, () => ({
      kind: 'kitchen' as const,
      fixtures: ['kitchen'] as const,
    })),
    ...Array.from({ length: branch.urinals }, () => ({
      kind: 'toilet' as const,
      fixtures: ['urinal'] as const,
    })),
  ];
}

/**
 * Denah jalur satu lantai (DD-01 #7, dirapikan atas masukan pemilik 2026-10-16): kotak bangunan
 * berskala, pipa tegak air bersih di dinding kiri, cabang ke ruang-ruang basah (kamar mandi, dapur)
 * yang digambar dengan ikon alat, dan — bila ada pembuangan — jalur air kotor/air bekas dari tiap
 * alat ke pipa tegak buangnya di dinding kanan. Skematik: letak ruang mengikuti denah pengguna.
 */
export function floorPlanSvg(input: DrawingInput, level: number, copy: DrawingCopy): string {
  const known = input.lengthM !== undefined && input.widthM !== undefined;
  const long = known ? Math.max(input.lengthM!, input.widthM!) : 15;
  const short = known ? Math.min(input.lengthM!, input.widthM!) : 8;
  const onFloor = input.branches.filter((b) => b.floor === level);
  const drainage = input.drainage;
  const hasWaste = drainage !== null && drainage.wasteSize !== undefined;
  const hasSoil = drainage !== null && (drainage.soilSize !== undefined || !hasWaste);
  // Tinggi minimum supaya tiap cabang punya satu baris ruang basah yang terbaca.
  const ROW = 124;
  // Dua pipa tegak buang butuh dua baris label di atas ruang pertama.
  const header = hasSoil && hasWaste ? 88 : 64;
  const minH = header + ROW * Math.max(1, onFloor.length);
  const k = Math.max(Math.min(520 / long, 300 / short, 40), minH / short);
  const w = long * k;
  const h = Math.max(short * k, minH);
  const ox = 36;
  const oy = 40;
  const out: string[] = [];

  // Catatan skala di atas bidang: tidak menimpa label apa pun.
  out.push(textEl(ox, oy - 14, copy.planNote, { size: 10, color: 'var(--snouty-caption)' }));
  out.push(
    `<rect x="${ox}" y="${oy}" width="${w}" height="${h}" fill="var(--snouty-surface)" stroke="var(--snouty-ink)" stroke-width="3"/>`,
  );
  if (known) {
    for (let i = 1; i < Math.floor(long); i += 1)
      out.push(
        `<line x1="${ox + i * k}" y1="${oy}" x2="${ox + i * k}" y2="${oy + h}" stroke="var(--snouty-hairline)"/>`,
      );
    for (let j = 1; j < Math.floor(short); j += 1)
      out.push(
        `<line x1="${ox}" y1="${oy + j * k}" x2="${ox + w}" y2="${oy + j * k}" stroke="var(--snouty-hairline)"/>`,
      );
  }

  // Pipa tegak air bersih di dinding kiri; pipa tegak buang di dinding kanan.
  const rx = ox + 18;
  const ry = oy + 18;
  out.push(`<circle cx="${rx}" cy="${ry}" r="7" fill="${MAIN}"/>`);
  out.push(
    textEl(rx + 12, ry + 4, `${copy.riser}${input.mainSize ? ` ${input.mainSize}` : ''}`, {
      size: 10.5,
      weight: 600,
    }),
  );
  const soilX = ox + w - 18;
  const wasteX = ox + w - 18 - (hasSoil && hasWaste ? 22 : 0);
  const soilY = ry;
  const wasteY = hasSoil ? ry + 20 : ry;
  if (hasSoil) {
    out.push(`<circle cx="${soilX}" cy="${soilY}" r="7" fill="${SOIL}"/>`);
    out.push(
      textEl(
        wasteX - 12,
        soilY + 4,
        `${copy.planSoil}${drainage?.soilSize ? ` ${drainage.soilSize}` : ''}`,
        { size: 10.5, anchor: 'end', weight: 600 },
      ),
    );
  }
  if (hasWaste) {
    out.push(`<circle cx="${wasteX}" cy="${wasteY}" r="7" fill="${WASTE}"/>`);
    out.push(
      textEl(wasteX - 12, wasteY + 4, `${copy.planWaste} ${drainage!.wasteSize}`, {
        size: 10.5,
        anchor: 'end',
        weight: 600,
      }),
    );
  }

  const ICON = 28;
  const STEP = 44;
  const PAD = 12;
  const GAP = 18;
  const x0 = ox + 64;
  let deepestSoil = soilY;
  let deepestWaste = wasteY;
  onFloor.forEach((branch, i) => {
    const y = oy + header + i * ROW;
    const rooms = branchRooms(branch);
    // Lebar tiap ruang dari jumlah alatnya; seluruh baris dibatasi bidang bangunan.
    const widths = rooms.map((r) => PAD * 2 + STEP * (r.fixtures.length - 1) + ICON);
    const total = widths.reduce((a, b) => a + b, 0) + GAP * Math.max(0, rooms.length - 1);
    const available = soilX - 40 - x0;
    const squeeze = total > available ? available / total : 1;
    const lineEnd = x0 + Math.min(total, available);
    out.push(
      pathEl(
        `M${rx} ${ry} V${y} H${Math.max(lineEnd, x0 + 24)}`,
        i === 0 ? MAIN : BRANCH,
        i === 0 ? 4 : 3,
      ),
    );
    out.push(tag(x0 - 32, y + 16, branch.size));
    let x = x0;
    rooms.forEach((room, r) => {
      const boxW = widths[r]! * squeeze;
      const step = STEP * squeeze;
      // Kotak ruang putus-putus: nama ruang di atas, alat di bawah garis cabang.
      out.push(
        `<rect x="${x}" y="${y - 24}" width="${boxW}" height="${82}" rx="6" fill="none" stroke="var(--snouty-border)" stroke-dasharray="4 3"/>`,
      );
      out.push(
        textEl(x + 6, y - 11, copy.rooms[room.kind], { size: 9.5, color: 'var(--snouty-muted)' }),
      );
      room.fixtures.forEach((kind, f) => {
        const cx = x + PAD * squeeze + ICON / 2 + step * f;
        out.push(pathEl(`M${cx} ${y} V${y + 14}`, DROP, 2));
        out.push(icon(FIXTURE_IMAGE[kind], cx, y + 14 + ICON * (100 / 120), ICON));
        out.push(
          textEl(cx, y + 50, copy.fixtures[kind], {
            size: 8.5,
            anchor: 'middle',
            color: 'var(--snouty-caption)',
          }),
        );
        if (drainage !== null) {
          // Buangan tiap alat: kloset/urinoir ke jalur air kotor, lainnya ke air bekas — ke pipa
          // tegaknya masing-masing di dinding kanan, serupa dengan potongan instalasi.
          const toSoil = SOIL_FIXTURES.has(kind) || !hasWaste;
          const collectorY = toSoil ? y + 74 : y + 66;
          const stackX = toSoil ? soilX : wasteX;
          out.push(pathEl(`M${cx} ${y + 58} V${collectorY} H${stackX}`, toSoil ? SOIL : WASTE, 2));
          if (toSoil) deepestSoil = Math.max(deepestSoil, collectorY);
          else deepestWaste = Math.max(deepestWaste, collectorY);
        }
      });
      x += boxW + GAP * squeeze;
    });
  });
  // Pipa tegak buang digambar setelah jalurnya supaya lingkarannya tetap di atas garis.
  if (hasSoil && deepestSoil > soilY) {
    out.push(pathEl(`M${soilX} ${soilY} V${deepestSoil}`, SOIL, 3));
  }
  if (hasWaste && deepestWaste > wasteY) {
    out.push(pathEl(`M${wasteX} ${wasteY} V${deepestWaste}`, WASTE, 3));
  }

  if (known) {
    out.push(
      pathEl(
        `M${ox} ${oy + h + 18} H${ox + w} M${ox} ${oy + h + 12} V${oy + h + 24} M${ox + w} ${oy + h + 12} V${oy + h + 24}`,
        'var(--snouty-caption)',
        1,
      ),
    );
    out.push(
      textEl(ox + w / 2, oy + h + 36, copy.length(copy.decimal(long)), {
        size: 11,
        anchor: 'middle',
        color: 'var(--snouty-caption)',
      }),
    );
    out.push(
      pathEl(
        `M${ox + w + 18} ${oy} V${oy + h} M${ox + w + 12} ${oy} H${ox + w + 24} M${ox + w + 12} ${oy + h} H${ox + w + 24}`,
        'var(--snouty-caption)',
        1,
      ),
    );
    out.push(
      textEl(ox + w + 30, oy + h / 2 + 4, copy.width(copy.decimal(short)), {
        size: 11,
        color: 'var(--snouty-caption)',
      }),
    );
  }
  return `<svg viewBox="0 0 ${ox + w + 100} ${oy + h + 48}" xmlns="http://www.w3.org/2000/svg" role="img" font-family="inherit">${out.join('')}</svg>`;
}
