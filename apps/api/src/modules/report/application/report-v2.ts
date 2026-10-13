/**
 * Laporan v2 (DD-01, P17-09): struktur yang sama dengan layar solusi — ringkasan bergambar, BOQ per
 * sistem, dasar perhitungan dan asumsi berkategori, lalu lampiran produk bergambar.
 *
 * Isi diturunkan dari payload yang dibekukan saat laporan dibuat, lewat modul yang sama dengan
 * layar (`boqFrom`, `@snouty/ui/needs-view`, `@snouty/ui/product-visual`), jadi PDF tidak bisa
 * berbeda dari yang dilihat pengguna. Payload lama (tanpa `products`/`needs`) tetap tercetak:
 * produk tanpa jumlah dibentuk dari `pendingItems`, ringkasan tanpa gambar kebutuhan.
 */

import { readFileSync } from 'node:fs';
import { ASSUMPTION_CATEGORIES, assumptionCategory } from '@snouty/engineering';
import {
  boqFrom,
  type Boq,
  type BoqRow,
  type Locale,
  type ReportPayload,
  type SelectedProduct,
  type SolutionNeed,
} from '@snouty/shared-types';
import {
  PRODUCT_VIEWBOX,
  SCENE_VIEWBOX,
  productHref,
  sceneHref,
  type SceneIllustration,
} from '@snouty/ui/illustrations';
import { buildingSummary, flowSteps, needCards, type NeedsCopy } from '@snouty/ui/needs-view';
import {
  PRODUCT_PHOTO_FILES,
  productVisual,
  type ProductPhoto,
  type ProductVisual,
} from '@snouty/ui/product-visual';

export interface ReportV2Copy {
  readonly needs: NeedsCopy;
  readonly flowTitle: string;
  readonly boqTitle: string;
  readonly boqColumns: {
    readonly no: string;
    readonly item: string;
    readonly size: string;
    readonly quantity: string;
    readonly unit: string;
    readonly note: string;
  };
  readonly systems: Readonly<Record<'clean_water' | 'soil' | 'waste' | 'other', string>>;
  readonly groups: Readonly<Record<'pipe' | 'fitting', string>>;
  readonly pendingPipe: string;
  readonly pendingFitting: string;
  readonly total: string;
  readonly basisAssumptionsTitle: string;
  readonly basisQuantityTitle: string;
  readonly basisSizeTitle: string;
  readonly basisColumns: {
    readonly no: string;
    readonly method: string;
    readonly working: string;
    readonly result: string;
    readonly status: string;
  };
  readonly assumptionsTitle: string;
  readonly assumptionCategories: Readonly<Record<(typeof ASSUMPTION_CATEGORIES)[number], string>>;
  readonly assumptionColumns: {
    readonly text: string;
    readonly value: string;
    readonly origin: string;
  };
  readonly origin: { readonly user: string; readonly standard: string };
  readonly productsTitle: string;
  readonly productNeeded: string;
  readonly productRows: (nos: string) => string;
  readonly productPending: string;
}

const NEEDS_ID: NeedsCopy = {
  floors: 'Lantai',
  floorsCount: (floors) => `${floors} lantai`,
  buildingTypes: {
    residential: 'Rumah tinggal',
    boarding_house: 'Rumah kos',
    light_commercial: 'Ruko / komersial',
    industrial: 'Bangunan industri',
    place_of_worship: 'Tempat ibadah',
    public_building: 'Sekolah / klinik',
  },
  labels: {
    bathroom: 'Kamar mandi',
    water_closet: 'Kloset',
    basin: 'Wastafel',
    kitchen: 'Bak cuci dapur',
    urinal: 'Urinoir',
    wudhu_tap: 'Keran wudhu',
    rooftop_tank: 'Toren atap',
    ground_tank: 'Toren bawah',
    municipal: 'PDAM',
    well_pump: 'Sumur + pompa',
    booster_pump: 'Pompa pendorong',
    drainage: 'Pembuangan',
  },
  buildingSize: (length, width) => `${length} × ${width} m`,
  floorHeight: (height) => `${height} m per lantai`,
  floorCount: (floor, count) => `Lantai ${floor}: ${count}`,
  onFloor: (floor) => `Lantai ${floor}`,
  perBathroom: 'Satu per kamar mandi',
  rooftopTank: 'Di atas atap',
  groundTank: 'Air dipompa ke atas',
  municipal: 'Langsung dari meteran',
  wellPump: 'Air dipompa dari sumur',
  boosterNeeded: (bar) => `Perlu: tekanan di titik tertinggi hanya ${bar} bar`,
  boosterNeededPlain: 'Perlu untuk tekanan di lantai atas',
  boosterFlow: 'Menambah tekanan ke lantai atas',
  drainageSizes: (soil, waste) => `Air kotor ${soil} · air bekas ${waste}`,
  outlets: (count) => `${count} titik air`,
  vent: 'Ventilasi',
  ventCaption: 'Keluar di atas atap',
};

const NEEDS_EN: NeedsCopy = {
  floors: 'Floors',
  floorsCount: (floors) => (floors === 1 ? '1 floor' : `${floors} floors`),
  buildingTypes: {
    residential: 'House',
    boarding_house: 'Boarding house',
    light_commercial: 'Shophouse / commercial',
    industrial: 'Industrial building',
    place_of_worship: 'Place of worship',
    public_building: 'School / clinic',
  },
  labels: {
    bathroom: 'Bathrooms',
    water_closet: 'Toilets',
    basin: 'Basins',
    kitchen: 'Kitchen sinks',
    urinal: 'Urinals',
    wudhu_tap: 'Ablution taps',
    rooftop_tank: 'Roof tank',
    ground_tank: 'Ground tank',
    municipal: 'Mains water',
    well_pump: 'Well + pump',
    booster_pump: 'Booster pump',
    drainage: 'Drainage',
  },
  buildingSize: (length, width) => `${length} × ${width} m`,
  floorHeight: (height) => `${height} m per floor`,
  floorCount: (floor, count) => `Floor ${floor}: ${count}`,
  onFloor: (floor) => `Floor ${floor}`,
  perBathroom: 'One per bathroom',
  rooftopTank: 'On the roof',
  groundTank: 'Water is pumped up',
  municipal: 'Straight from the meter',
  wellPump: 'Water is pumped from the well',
  boosterNeeded: (bar) => `Needed: only ${bar} bar at the highest outlet`,
  boosterNeededPlain: 'Needed for pressure upstairs',
  boosterFlow: 'Adds pressure for the upper floor',
  drainageSizes: (soil, waste) => `Soil ${soil} · waste ${waste}`,
  outlets: (count) => `${count} outlets`,
  vent: 'Vent',
  ventCaption: 'Out above the roof',
};

export const REPORT_V2_COPY: Readonly<Record<Locale, ReportV2Copy>> = {
  id: {
    needs: NEEDS_ID,
    flowTitle: 'Alur air',
    boqTitle: 'Daftar Kebutuhan Material (BOQ)',
    boqColumns: {
      no: 'NO.',
      item: 'URAIAN',
      size: 'UKURAN',
      quantity: 'VOLUME',
      unit: 'SATUAN',
      note: 'KETERANGAN',
    },
    systems: {
      clean_water: 'Air bersih',
      soil: 'Air kotor',
      waste: 'Air bekas',
      other: 'Material',
    },
    groups: { pipe: 'Pipa', fitting: 'Fitting' },
    pendingPipe: 'Menunggu ukuran bangunan',
    pendingFitting: 'Dihitung saat pemasangan',
    total: 'Total',
    basisAssumptionsTitle: 'Dasar Perhitungan &amp; Asumsi',
    basisQuantityTitle: 'Jumlah material',
    basisSizeTitle: 'Ukuran pipa',
    basisColumns: {
      no: 'NO.',
      method: 'CARA HITUNG',
      working: 'HITUNGAN',
      result: 'HASIL',
      status: 'STATUS',
    },
    assumptionsTitle: 'Asumsi',
    assumptionCategories: {
      building: 'Bangunan',
      fixtures: 'Isi ruangan',
      water_source: 'Sumber air',
      route: 'Panjang jalur',
      engineering: 'Teknik',
    },
    assumptionColumns: { text: 'ASUMSI', value: 'NILAI', origin: 'ASAL' },
    origin: { user: 'Dari Anda', standard: 'Standar' },
    productsTitle: 'Produk Pralon',
    productNeeded: 'Dibutuhkan',
    productRows: (nos) => `BOQ no. ${nos}`,
    productPending: 'Jumlah menyusul',
  },
  en: {
    needs: NEEDS_EN,
    flowTitle: 'How the water runs',
    boqTitle: 'Bill of Quantities',
    boqColumns: {
      no: 'NO.',
      item: 'DESCRIPTION',
      size: 'SIZE',
      quantity: 'QTY',
      unit: 'UNIT',
      note: 'NOTES',
    },
    systems: { clean_water: 'Clean water', soil: 'Soil', waste: 'Waste', other: 'Materials' },
    groups: { pipe: 'Pipes', fitting: 'Fittings' },
    pendingPipe: 'Needs the building size',
    pendingFitting: 'Counted at installation',
    total: 'Total',
    basisAssumptionsTitle: 'Calculation Basis &amp; Assumptions',
    basisQuantityTitle: 'Quantities',
    basisSizeTitle: 'Pipe sizes',
    basisColumns: {
      no: 'NO.',
      method: 'METHOD',
      working: 'WORKING',
      result: 'RESULT',
      status: 'STATUS',
    },
    assumptionsTitle: 'Assumptions',
    assumptionCategories: {
      building: 'Building',
      fixtures: 'Fixtures',
      water_source: 'Water source',
      route: 'Pipe runs',
      engineering: 'Engineering',
    },
    assumptionColumns: { text: 'ASSUMPTION', value: 'VALUE', origin: 'SOURCE' },
    origin: { user: 'From you', standard: 'Standard' },
    productsTitle: 'Pralon Products',
    productNeeded: 'Needed',
    productRows: (nos) => `BOQ no. ${nos}`,
    productPending: 'Quantity to follow',
  },
};

/** Helper dari report-html — diteruskan supaya modul ini tidak bergantung balik padanya. */
export interface ReportParts {
  readonly esc: (value: string) => string;
  readonly pill: (status: ReportPayload['overallProvenance']) => string;
  readonly sectionHead: (n: number, title: string) => string;
}

// ── Gambar ───────────────────────────────────────────────────────────────────

const PHOTO_MIME: Readonly<Record<string, string>> = { jpg: 'image/jpeg', webp: 'image/webp' };

/** Foto produk pralon.com disisipkan sebagai data URI — dokumen cetak mandiri. */
const PHOTO_DATA: ReadonlyMap<ProductPhoto, string> = new Map(
  PRODUCT_PHOTO_FILES.flatMap((file) => {
    try {
      const bytes = readFileSync(
        new URL(`../../../../assets/report/products/${file}`, import.meta.url),
      );
      const mime = PHOTO_MIME[file.split('.').pop()!] ?? 'application/octet-stream';
      return [[file, `data:${mime};base64,${bytes.toString('base64')}`] as const];
    } catch {
      // Tanpa berkas (lingkungan uji tanpa aset) kartu memakai gambar jenisnya.
      return [];
    }
  }),
);

function scene(name: SceneIllustration, cls: string): string {
  return `<svg class="${cls}" viewBox="${SCENE_VIEWBOX}" aria-hidden="true"><use href="${sceneHref(name)}"/></svg>`;
}

function productPicture(
  visual: ProductVisual | null,
  label: string,
  cls: string,
  esc: ReportParts['esc'],
): string {
  if (visual === null) return '';
  if (visual.kind === 'photo') {
    const data = PHOTO_DATA.get(visual.file);
    // Latar CSS, bukan <img>: laporan tidak memuat tag <img> sama sekali (pagar injeksi di tes).
    if (data) {
      return `<div class="${cls} r-photo" role="img" aria-label="${esc(label)}" style="background-image:url('${data}')"></div>`;
    }
    return '';
  }
  const { body, line, text } = visual.colors;
  return (
    `<svg class="${cls}" viewBox="${PRODUCT_VIEWBOX}" role="img" aria-label="${esc(label)}" ` +
    `style="--il-pc:${body};--il-pc2:${line};--il-pc3:${text}"><use href="${productHref(visual.name)}"/></svg>`
  );
}

// ── Data ─────────────────────────────────────────────────────────────────────

/** BOQ dari payload. Payload lama: produk tanpa jumlah dibentuk dari `pendingItems`. */
export function payloadBoq(p: ReportPayload): Boq {
  const products: readonly SelectedProduct[] =
    p.products ??
    (p.pendingItems ?? []).map((item) => ({
      productId: item.productId,
      name: item.name,
      size: item.size,
      role: item.kind === 'fitting' ? 'fitting' : 'main',
      matchState: 'VERIFIED_SELECTED',
      reason: '',
    }));
  return boqFrom({ products, bom: p.bom });
}

function decimal(value: number, locale: Locale): string {
  return value.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 });
}

// ── Bagian ───────────────────────────────────────────────────────────────────

/** Kepala ringkasan bergambar + kartu kebutuhan + alur air; kosong untuk payload tanpa `needs`. */
export function summaryPictures(
  p: ReportPayload,
  v: ReportV2Copy,
  parts: ReportParts,
): {
  readonly hero: string | null;
  readonly needs: string;
  readonly flow: string;
} {
  const needs: readonly SolutionNeed[] = p.needs ?? [];
  if (needs.length === 0) return { hero: null, needs: '', flow: '' };
  const { esc } = parts;
  const building = buildingSummary(needs, v.needs, p.locale);
  const cards = needCards(needs, v.needs, p.locale).filter((c) => c.key !== 'building');
  const steps = flowSteps(needs, p.outletCount ?? 0, v.needs, p.locale);
  return {
    hero: building
      ? `<div class="r-hero">${scene(building.image, 'r-hero-img')}<div class="r-hero-text">` +
        `<div class="kicker kicker-action">${esc(p.identity.installationType)}</div>` +
        `<div class="lead-value">${esc(p.headline)}</div>` +
        `<div class="r-meta">${esc(building.meta)}</div>` +
        `<p class="lead-text">${esc(p.body)}</p></div></div>`
      : null,
    needs:
      cards.length > 0
        ? `<div class="r-needs">${cards
            .map(
              (c) =>
                `<div class="r-need${c.attention ? ' r-need-attention' : ''}">${scene(c.image, 'r-need-img')}` +
                `<span class="r-need-count">${String(c.count)}</span><span class="r-need-label">${esc(c.label)}</span>` +
                (c.caption ? `<span class="r-need-caption">${esc(c.caption)}</span>` : '') +
                `</div>`,
            )
            .join('')}</div>`
        : '',
    flow:
      steps.length > 1
        ? `<h3 class="subhead">${v.flowTitle}</h3><ol class="r-flow">${steps
            .map(
              (s) =>
                `<li>${scene(s.image, 'r-flow-img')}<span class="r-need-label">${esc(s.label)}</span>` +
                `<span class="r-need-caption">${esc(s.caption)}</span></li>`,
            )
            .join('')}</ol>`
        : '',
  };
}

export function boqSection(
  p: ReportPayload,
  v: ReportV2Copy,
  parts: ReportParts,
  n: number,
  banner: string,
  exclusions: string,
): string {
  const { esc } = parts;
  const boq = payloadBoq(p);
  const counted = boq.sections.flatMap((s) => s.rows).filter((r) => r.no !== null);
  const totals = new Map<string, number>();
  for (const row of counted) {
    if (row.unit !== null && row.quantity !== null) {
      totals.set(row.unit, (totals.get(row.unit) ?? 0) + row.quantity);
    }
  }
  const note = (row: BoqRow): string =>
    row.pending
      ? row.kind === 'fitting'
        ? v.pendingFitting
        : v.pendingPipe
      : row.netLengthM !== undefined
        ? `${decimal(row.netLengthM, p.locale)} m`
        : '';
  const visualOf = (row: BoqRow) => {
    const selection = row.productId
      ? boq.products.find((x) => x.productId === row.productId)?.selections[0]
      : undefined;
    return productVisual({
      ...(selection?.family !== undefined ? { family: selection.family } : {}),
      ...(selection?.category !== undefined ? { category: selection.category } : {}),
      size: row.size,
      kind: row.kind,
    });
  };
  const rows = boq.sections
    .map((section) => {
      const groups = (['pipe', 'fitting'] as const).filter((k) =>
        section.rows.some((r) => r.kind === k),
      );
      const title =
        boq.sections.length > 1 || section.system !== null
          ? `<tr class="r-sect"><td colspan="7">${v.systems[section.system ?? 'other']}</td></tr>`
          : '';
      return (
        title +
        groups
          .map(
            (kind) =>
              (groups.length > 1
                ? `<tr class="r-group"><td></td><td colspan="6">${v.groups[kind]}</td></tr>`
                : '') +
              section.rows
                .filter((r) => r.kind === kind)
                .map(
                  (r) =>
                    `<tr${r.pending ? ' class="r-pending"' : ''}>` +
                    `<td class="num">${r.no === null ? '—' : String(r.no)}</td>` +
                    `<td class="r-thumb-cell">${productPicture(visualOf(r), r.productName ?? r.item, 'r-thumb', esc)}</td>` +
                    `<td class="strong">${esc(r.purpose ?? r.item)}` +
                    (r.productName && r.productName !== (r.purpose ?? r.item)
                      ? `<span class="sub">${esc(r.productName)}</span>`
                      : '') +
                    `</td><td class="mono">${esc(r.size)}</td>` +
                    `<td class="num">${r.quantity === null ? '—' : String(r.quantity)}</td>` +
                    `<td>${r.unit === null ? '—' : esc(r.unit)}</td><td>${esc(note(r))}</td></tr>`,
                )
                .join(''),
          )
          .join('')
      );
    })
    .join('');
  const total =
    totals.size > 0
      ? `<tr class="r-total"><td></td><td></td><td colspan="2">${v.total}</td>` +
        `<td class="num">${[...totals.values()].map(String).join('<br>')}</td>` +
        `<td>${[...totals.keys()].map(esc).join('<br>')}</td><td></td></tr>`
      : '';
  return `<section class="page">
  ${parts.sectionHead(n, v.boqTitle)}
  <div class="banner">${banner}</div>
  <table class="grid data r-boq">
    <thead><tr><th class="num">${v.boqColumns.no}</th><th></th><th>${v.boqColumns.item}</th><th>${v.boqColumns.size}</th>
    <th class="num">${v.boqColumns.quantity}</th><th>${v.boqColumns.unit}</th><th>${v.boqColumns.note}</th></tr></thead>
    ${rows}${total}
  </table>
  <p class="note">${exclusions}</p>
</section>`;
}

export function basisAssumptionsSection(
  p: ReportPayload,
  v: ReportV2Copy,
  parts: ReportParts,
  n: number,
  sizeColumns: {
    readonly line: string;
    readonly size: string;
    readonly reason: string;
    readonly status: string;
  },
  legend: string,
): string {
  const { esc, pill } = parts;
  const counted = payloadBoq(p)
    .sections.flatMap((s) => s.rows)
    .filter((r) => r.no !== null && (r.calc || r.basis));
  const quantities =
    counted.length > 0
      ? `<h3 class="subhead">${v.basisQuantityTitle}</h3>
  <table class="grid data">
    <thead><tr><th class="num">${v.basisColumns.no}</th><th>${v.basisColumns.method}</th><th>${v.basisColumns.working}</th><th class="num">${v.basisColumns.result}</th><th>${v.basisColumns.status}</th></tr></thead>
    ${counted
      .map(
        (r) =>
          `<tr><td class="num">${String(r.no)}</td>` +
          (r.calc
            ? `<td>${esc(r.calc.method)}</td><td class="mono">${esc(r.calc.working)}</td><td class="num">${esc(r.calc.result)}</td>`
            : `<td colspan="3">${esc(r.basis ?? '')}</td>`) +
          `<td class="status">${r.provenance ? pill(r.provenance) : ''}</td></tr>`,
      )
      .join('\n    ')}
  </table>`
      : '';
  const sizes =
    p.systemLines.length > 0
      ? `<h3 class="subhead">${v.basisSizeTitle}</h3>
  <table class="grid data">
    <thead><tr><th>${sizeColumns.line}</th><th>${sizeColumns.size}</th><th>${sizeColumns.reason}</th><th>${sizeColumns.status}</th></tr></thead>
    ${p.systemLines
      .map(
        (line) =>
          `<tr><td class="strong">${esc(line.name)}<span class="sub">${esc(line.path)}</span></td>` +
          `<td class="mono size">${esc(line.size)}</td><td class="reason">${esc(line.reason)}</td>` +
          `<td class="status">${pill(line.provenance)}</td></tr>`,
      )
      .join('\n    ')}
  </table>`
      : '';
  const assumptions =
    p.assumptions.length > 0
      ? `<h3 class="subhead">${v.assumptionsTitle}</h3>
  <table class="grid data">
    <thead><tr><th>${v.assumptionColumns.text}</th><th>${v.assumptionColumns.value}</th><th>${v.assumptionColumns.origin}</th></tr></thead>
    ${ASSUMPTION_CATEGORIES.map((category) => {
      const rows = p.assumptions.filter((a) => assumptionCategory(a) === category);
      if (rows.length === 0) return '';
      return (
        `<tr class="r-sect"><td colspan="3">${v.assumptionCategories[category]}</td></tr>` +
        rows
          .map(
            (a) =>
              `<tr><td>${esc(a.text)}</td>` +
              `<td class="mono">${
                a.value !== undefined
                  ? esc(`${decimal(a.value, p.locale)}${a.unit ? ` ${a.unit}` : ''}`)
                  : ''
              }</td>` +
              `<td>${a.fieldPath === '' ? '' : a.userSet ? v.origin.user : v.origin.standard}</td></tr>`,
          )
          .join('')
      );
    }).join('\n    ')}
  </table>`
      : '';
  return `<section class="page">
  ${parts.sectionHead(n, v.basisAssumptionsTitle)}
  ${quantities}
  ${sizes}
  ${assumptions}
  ${legend}
</section>`;
}

export function productsSection(
  p: ReportPayload,
  v: ReportV2Copy,
  parts: ReportParts,
  n: number,
): string {
  const { esc } = parts;
  const boq = payloadBoq(p);
  if (boq.products.length === 0) return '';
  const cards = boq.products
    .map((product) => {
      const first = product.selections[0];
      const visual = productVisual({
        ...(first?.family !== undefined ? { family: first.family } : {}),
        ...(first?.category !== undefined ? { category: first.category } : {}),
        ...(first ? { size: first.size } : {}),
        kind: product.kind,
      });
      const purposes = [...new Set(product.selections.map((s) => s.purpose).filter(Boolean))].join(
        ' · ',
      );
      const sizes = [...new Set(product.selections.map((s) => s.size))].join(' · ');
      const need =
        product.quantity !== null
          ? `<span>${v.productNeeded} <span class="sub-inline">(${v.productRows(product.rowNos.join(', '))})</span></span><b>${String(product.quantity)} ${esc(product.unit ?? '')}</b>`
          : `<span>${v.productPending}</span>`;
      return (
        `<div class="r-product"><div class="r-product-img">${productPicture(visual, product.name ?? purposes, 'r-product-pic', esc)}</div>` +
        `<div class="r-product-body">${purposes ? `<div class="r-product-role">${esc(purposes)}</div>` : ''}` +
        `<div class="strong">${esc(product.name ?? product.productId)}</div>` +
        `<div class="mono">${esc(sizes)}</div><div class="r-product-need">${need}</div></div></div>`
      );
    })
    .join('');
  return `<section class="page">
  ${parts.sectionHead(n, v.productsTitle)}
  <div class="r-products">${cards}</div>
</section>`;
}

/** CSS tambahan v2 — nilai warna dari token yang didefinisikan di `:root` laporan. */
export const REPORT_V2_CSS = `
.r-hero { display: grid; grid-template-columns: 46mm 1fr; gap: 6mm; align-items: center; margin-bottom: 5mm; }
.r-hero-img { width: 46mm; height: 38mm; background: var(--snouty-surface-subtle); border: 1px solid var(--snouty-hairline); border-radius: 3mm; padding: 2mm; }
.r-hero-text { display: flex; flex-direction: column; gap: 1.5mm; }
.r-meta { font-family: var(--snouty-font-mono); font-size: 8.5pt; color: var(--snouty-muted); }
.r-needs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2.5mm; margin: 2mm 0 4mm; }
.r-need { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.6mm; padding: 2.5mm; border: 1px solid var(--snouty-hairline); border-radius: 2mm; background: var(--snouty-surface-subtle); break-inside: avoid; }
.r-need-attention { border-color: var(--snouty-assumed-border); background: var(--snouty-assumed-bg); }
.r-need-attention .r-need-caption { color: var(--snouty-assumed-text); }
.r-need-img { width: 24mm; height: 20mm; }
.r-need-count { font-family: var(--snouty-font-mono); font-size: 13pt; font-weight: 600; }
.r-need-label { font-size: 8.5pt; font-weight: 600; }
.r-need-caption { font-size: 7.5pt; color: var(--snouty-caption); }
.r-flow { list-style: none; margin: 0 0 4mm; padding: 0; display: flex; gap: 3mm; align-items: flex-start; }
.r-flow li { flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.6mm; }
.r-flow-img { width: 20mm; height: 17mm; }
.r-boq .r-thumb-cell { width: 15mm; padding-top: 1mm; padding-bottom: 1mm; }
.r-thumb { width: 14mm; height: 8mm; object-fit: contain; display: block; }
.r-sect td { background: var(--snouty-surface-subtle); font-weight: 600; }
.r-group td { font-size: 7.5pt; letter-spacing: 0.06em; text-transform: uppercase; color: var(--snouty-caption); }
.r-pending td { color: var(--snouty-muted); }
.r-total td { font-weight: 600; }
td.num, th.num { text-align: right; font-family: var(--snouty-font-mono); }
.r-products { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
.r-product { border: 1px solid var(--snouty-border); border-radius: 2mm; overflow: hidden; break-inside: avoid; }
.r-product-img { height: 26mm; display: flex; align-items: center; justify-content: center; background: var(--snouty-surface-subtle); border-bottom: 1px solid var(--snouty-hairline); }
.r-product-pic { max-width: 90%; max-height: 23mm; object-fit: contain; }
.r-product-body { padding: 2.5mm; display: flex; flex-direction: column; gap: 0.8mm; font-size: 8.5pt; }
.r-product-role { font-family: var(--snouty-font-mono); font-size: 7pt; letter-spacing: 0.06em; color: var(--snouty-muted); }
.r-product-need { display: flex; justify-content: space-between; border-top: 1px solid var(--snouty-hairline); padding-top: 1mm; margin-top: 0.5mm; }
.sub-inline { color: var(--snouty-caption); font-size: 7.5pt; }
.r-photo { background-size: contain; background-repeat: no-repeat; background-position: center; }
.r-thumb.r-photo { width: 14mm; height: 8mm; }
.r-product-pic.r-photo { width: 40mm; height: 23mm; }
`;
