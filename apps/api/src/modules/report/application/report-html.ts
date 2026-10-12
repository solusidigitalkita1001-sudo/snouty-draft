/**
 * Halaman cetak laporan — HTML A4. docs/REPORT.md §2, §5. **Fungsi murni:** payload masuk, string
 * HTML keluar; Chromium di worker mencetaknya.
 *
 * Tata letak (permintaan pemilik 2026-10-12, mengikuti templat rapor yang dikirim, dengan warna
 * SNOUTY): sampul gelap berlogo Pralon dan maskot SNOUTY, lalu empat bagian — ringkasan solusi,
 * rekomendasi sistem, estimasi material, dasar perhitungan dan pengesahan. Nomor halaman dicetak
 * oleh footer Chromium (`#snouty-pdf-footer`), jadi tetap benar ketika satu bagian meluber ke
 * halaman berikutnya; sampul tanpa footer.
 *
 * Tanpa metatext: tidak ada kalimat tentang cara dokumen dibuat, dan tidak ada kode aturan —
 * dasar perhitungan memakai judul langkah (`ruleStepTitle`). Dua kalimat **tidak diparafrase**
 * karena membawa janji produk: "PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS" dan "Perkiraan
 * perencanaan, bukan penawaran resmi."
 *
 * Dua bahasa (P15-05): teks tetap hidup di `REPORT_COPY`, dipilih menurut `payload.locale`.
 *
 * Keamanan: setiap nilai payload di-escape (`esc`) — nama pelanggan dan lokasi datang dari
 * pengguna. Gambar disisipkan sebagai data URI di CSS, bukan tag `<img>`, sehingga satu-satunya
 * markup gambar di dokumen milik kode.
 */

import { readFileSync } from 'node:fs';
import { hasStepTitle, ruleStepTitle } from '@snouty/engineering';
import type { Locale, Provenance } from '@snouty/shared-types';
import type { ReportPayload } from '../domain/report.types.js';

/**
 * Teks tetap halaman cetak per bahasa. Nilainya **HTML tepercaya** (konstanta kode, sudah
 * memuat `&amp;`), jadi disisipkan tanpa `esc` — berbeda dari nilai payload.
 */
interface ReportCopy {
  readonly htmlLang: string;
  /** Locale `Intl` untuk pemisah ribuan rupiah. */
  readonly numberLocale: string;
  readonly provenance: Readonly<Record<Provenance, string>>;
  readonly provenanceMeaning: Readonly<Record<Provenance, string>>;
  /** Janji produk — jangan diparafrase. */
  readonly disclaimer: string;
  /** Janji produk (kalimat pertama) — jangan diparafrase. */
  readonly priceDisclaimer: string;
  readonly priceDisclaimerWithList: string;
  readonly brandSub: string;
  readonly coverKicker: string;
  readonly coverTitle: string;
  readonly preparedFor: string;
  readonly identity: {
    readonly reportNumber: string;
    readonly consultationDate: string;
    readonly projectLocation: string;
    readonly installationType: string;
  };
  readonly section: (n: number) => string;
  readonly summaryTitle: string;
  readonly installationKicker: string;
  readonly descriptionKicker: string;
  readonly requirementsTitle: string;
  readonly systemTitle: string;
  readonly systemColumns: {
    readonly line: string;
    readonly size: string;
    readonly reason: string;
    readonly status: string;
  };
  readonly assumptionsTitle: string;
  readonly materialTitle: string;
  readonly bomColumns: {
    readonly item: string;
    readonly size: string;
    readonly quantity: string;
    readonly unitPrice: string;
    readonly subtotal: string;
    readonly status: string;
  };
  readonly bomEmpty: string;
  readonly subtotal: string;
  readonly tax: (percent: number) => string;
  readonly total: string;
  readonly exclusions: string;
  readonly closingTitle: string;
  readonly basisTitle: string;
  readonly legendTitle: string;
  readonly nextStepsTitle: string;
  readonly nextSteps: string;
  readonly preparedBy: string;
  readonly catalog: string;
  readonly ruleset: string;
  readonly outdated: string;
  readonly reviewedBy: string;
  readonly reviewer: string;
  readonly footerLeft: string;
  readonly footerPage: string;
  readonly footerOf: string;
}

export const REPORT_COPY: Readonly<Record<Locale, ReportCopy>> = {
  id: {
    htmlLang: 'id',
    numberLocale: 'id-ID',
    provenance: {
      VERIFIED: 'TERVERIFIKASI',
      ASSUMED: 'ASUMSI',
      ESTIMATED: 'ESTIMASI',
      UNAVAILABLE: 'LIHAT DOKUMEN TEKNIS',
    },
    provenanceMeaning: {
      VERIFIED: 'Dari katalog Pralon atau aturan yang sudah divalidasi',
      ESTIMATED: 'Dihitung dari data Anda dengan sebagian perkiraan',
      ASSUMED: 'Memakai nilai baku yang bisa diganti',
      UNAVAILABLE: 'Perlu dokumen teknis Pralon',
    },
    disclaimer: 'PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS',
    priceDisclaimer: 'Perkiraan perencanaan, bukan penawaran resmi.',
    priceDisclaimerWithList:
      'Perkiraan perencanaan, bukan penawaran resmi. Harga final mengikuti daftar harga distributor Pralon yang berlaku.',
    brandSub: 'Asisten solusi perpipaan',
    coverKicker: 'LAPORAN REKOMENDASI',
    coverTitle: 'Rekomendasi Sistem Perpipaan',
    preparedFor: 'DISUSUN UNTUK',
    identity: {
      reportNumber: 'NOMOR LAPORAN',
      consultationDate: 'TANGGAL KONSULTASI',
      projectLocation: 'LOKASI PROYEK',
      installationType: 'JENIS INSTALASI',
    },
    section: (n) => `BAGIAN ${String(n)}`,
    summaryTitle: 'Ringkasan Solusi',
    installationKicker: 'JENIS INSTALASI',
    descriptionKicker: 'DESKRIPSI SOLUSI',
    requirementsTitle: 'Kebutuhan yang tercatat',
    systemTitle: 'Rekomendasi Sistem',
    systemColumns: { line: 'JALUR', size: 'UKURAN', reason: 'ALASAN', status: 'STATUS' },
    assumptionsTitle: 'Asumsi yang digunakan',
    materialTitle: 'Estimasi Material',
    bomColumns: {
      item: 'MATERIAL',
      size: 'UKURAN',
      quantity: 'QTY',
      unitPrice: 'HARGA SATUAN',
      subtotal: 'SUBTOTAL',
      status: 'STATUS',
    },
    bomEmpty:
      'Jumlah pipa dihitung setelah panjang jalur atau ukuran bangunan diketahui. Ukuran setiap jalur ada di Bagian 2.',
    subtotal: 'Subtotal material',
    tax: (percent) => `PPN ${String(percent)}%`,
    total: 'Total estimasi',
    exclusions: 'Belum termasuk jasa instalasi, aksesori non-pipa, dan pengiriman.',
    closingTitle: 'Dasar Perhitungan &amp; Pengesahan',
    basisTitle: 'Dasar perhitungan',
    legendTitle: 'Status nilai',
    nextStepsTitle: 'Langkah berikutnya',
    nextSteps:
      'Bawa laporan ini ke toko atau distributor Pralon untuk penawaran resmi dan pemeriksaan akhir bersama instalatur.',
    preparedBy: 'Disusun oleh:',
    catalog: 'Katalog',
    ruleset: 'Versi aturan hitung',
    outdated:
      'Dihitung dengan versi aturan lama. Susun ulang rekomendasinya untuk memakai perhitungan terbaru.',
    reviewedBy: 'Diperiksa oleh (opsional):',
    reviewer: 'Instalatur / Tim Teknis Pralon',
    footerLeft: 'Laporan Rekomendasi',
    footerPage: 'Halaman',
    footerOf: 'dari',
  },
  en: {
    htmlLang: 'en',
    numberLocale: 'en-US',
    provenance: {
      VERIFIED: 'VERIFIED',
      ASSUMED: 'ASSUMED',
      ESTIMATED: 'ESTIMATED',
      UNAVAILABLE: 'SEE TECHNICAL DOCUMENTS',
    },
    provenanceMeaning: {
      VERIFIED: 'From the Pralon catalogue or validated rules',
      ESTIMATED: 'Calculated from your data with some estimates',
      ASSUMED: 'Uses a standard value that can be changed',
      UNAVAILABLE: 'Needs Pralon technical documents',
    },
    disclaimer: 'PLANNING GUIDANCE — NOT A TECHNICAL CERTIFICATION',
    priceDisclaimer: 'A planning estimate, not an official quotation.',
    priceDisclaimerWithList:
      'A planning estimate, not an official quotation. Final prices follow the current Pralon distributor price list.',
    brandSub: 'Piping solution assistant',
    coverKicker: 'RECOMMENDATION REPORT',
    coverTitle: 'Piping System Recommendation',
    preparedFor: 'PREPARED FOR',
    identity: {
      reportNumber: 'REPORT NUMBER',
      consultationDate: 'CONSULTATION DATE',
      projectLocation: 'PROJECT LOCATION',
      installationType: 'INSTALLATION TYPE',
    },
    section: (n) => `SECTION ${String(n)}`,
    summaryTitle: 'Solution Summary',
    installationKicker: 'INSTALLATION TYPE',
    descriptionKicker: 'SOLUTION DESCRIPTION',
    requirementsTitle: 'Recorded requirements',
    systemTitle: 'System Recommendation',
    systemColumns: { line: 'LINE', size: 'SIZE', reason: 'REASON', status: 'STATUS' },
    assumptionsTitle: 'Assumptions used',
    materialTitle: 'Material Estimate',
    bomColumns: {
      item: 'MATERIAL',
      size: 'SIZE',
      quantity: 'QTY',
      unitPrice: 'UNIT PRICE',
      subtotal: 'SUBTOTAL',
      status: 'STATUS',
    },
    bomEmpty:
      'Pipe quantities are counted once the route length or building size is known. The size of every line is in Section 2.',
    subtotal: 'Material subtotal',
    tax: (percent) => `VAT ${String(percent)}%`,
    total: 'Estimated total',
    exclusions: 'Excludes installation labor, non-pipe accessories, and delivery.',
    closingTitle: 'Calculation Basis &amp; Sign-off',
    basisTitle: 'Calculation basis',
    legendTitle: 'Value status',
    nextStepsTitle: 'Next steps',
    nextSteps:
      'Take this report to a Pralon store or distributor for an official quotation and a final check together with your installer.',
    preparedBy: 'Prepared by:',
    catalog: 'Catalog',
    ruleset: 'Calculation rules version',
    outdated:
      'Calculated with an older version of the rules. Recompose the recommendation to use the latest calculation.',
    reviewedBy: 'Reviewed by (optional):',
    reviewer: 'Installer / Pralon Technical Team',
    footerLeft: 'Recommendation Report',
    footerPage: 'Page',
    footerOf: 'of',
  },
};

/** Logo Pralon dan maskot SNOUTY — berkas di `apps/api/assets/report`, disisipkan sebagai data URI. */
function asset(name: string): string {
  try {
    const bytes = readFileSync(new URL(`../../../../assets/report/${name}`, import.meta.url));
    return `data:image/png;base64,${bytes.toString('base64')}`;
  } catch {
    // Tanpa berkasnya (mis. lingkungan uji yang tidak menyalin aset) laporan tetap tercetak.
    return '';
  }
}
const PRALON_LOGO = asset('pralon-logo.png');
const SNOUTY_MASCOT = asset('snouty-mascot.png');

export function renderReportHtml(payload: ReportPayload): string {
  const t = REPORT_COPY[payload.locale];
  return `<!doctype html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8">
<title>${esc(payload.reportNumber)}</title>
<style>${CSS}</style>
</head>
<body>
${cover(payload, t)}
${summarySection(payload, t)}
${systemSection(payload, t)}
${materialSection(payload, t)}
${closingSection(payload, t)}
<script type="text/plain" id="snouty-pdf-footer">${footerTemplate(payload, t)}</script>
</body>
</html>`;
}

/**
 * Footer setiap halaman kecuali sampul, dicetak Chromium (`displayHeaderFooter`) — `pageNumber` dan
 * `totalPages` diisi Chromium. Gaya harus inline: templat footer tidak mewarisi CSS dokumen.
 */
function footerTemplate(p: ReportPayload, t: ReportCopy): string {
  return (
    `<div style="width:100%;margin:0 13mm;display:flex;justify-content:space-between;` +
    `font-family:'IBM Plex Sans',sans-serif;font-size:7.5pt;color:${C['snouty-caption']};">` +
    `<span>${t.footerLeft} · ${esc(p.identity.customerName)}</span>` +
    `<span>${t.footerPage} <span class="pageNumber"></span> ${t.footerOf} <span class="totalPages"></span></span>` +
    `</div>`
  );
}

function cover(p: ReportPayload, t: ReportCopy): string {
  return `<section class="page cover">
  <div class="hero">
    <svg class="rings" viewBox="0 0 400 400" aria-hidden="true">
      <circle cx="260" cy="190" r="190" class="ring"/>
      <circle cx="260" cy="190" r="140" class="ring"/>
      <circle cx="260" cy="190" r="92" class="ring"/>
      <circle cx="260" cy="190" r="190" class="arc arc-outer"/>
      <circle cx="260" cy="190" r="140" class="arc arc-inner"/>
    </svg>
    <div class="mascot snouty-art" role="img" aria-label="SNOUTY"></div>
    <div class="lockup">
      <div class="logo-tile"><div class="pralon-logo" role="img" aria-label="Pralon"></div></div>
      <div class="lockup-divider"></div>
      <div>
        <div class="brand">SNOUTY</div>
        <div class="brandsub">${t.brandSub}</div>
      </div>
    </div>
    <div class="hero-text">
      <div class="cover-kicker">${t.coverKicker}</div>
      <h1 class="cover-title">${t.coverTitle}</h1>
      <div class="cover-sub">${esc(p.identity.installationType)} · ${esc(p.identity.consultationDate)}</div>
    </div>
  </div>
  <div class="band"></div>
  <div class="cover-body">
    ${p.ruleset?.outdated ? `<div class="banner">${t.outdated}</div>` : ''}
    <div class="kicker">${t.preparedFor}</div>
    <div class="customer">${esc(p.identity.customerName)}</div>
    <div class="info-grid">
      ${info(t.identity.reportNumber, esc(p.reportNumber))}
      ${info(t.identity.consultationDate, esc(p.identity.consultationDate))}
      ${info(t.identity.projectLocation, esc(p.identity.projectLocation))}
      ${info(t.identity.installationType, esc(p.identity.installationType))}
    </div>
    <div class="cover-foot"><strong>${t.disclaimer}</strong></div>
  </div>
</section>`;
}

function info(label: string, value: string): string {
  return `<div class="info"><div class="kicker">${label}</div><div class="info-value">${value}</div></div>`;
}

function sectionHead(p: ReportPayload, t: ReportCopy, n: number, title: string): string {
  return `<header class="section-head">
    <div>
      <div class="section-kicker">${t.section(n)}</div>
      <h2 class="section-title">${title}</h2>
      <div class="section-rule"></div>
    </div>
    <div class="section-meta">
      <strong>${esc(p.identity.customerName)}</strong>
      <span>${esc(p.reportNumber)}</span>
    </div>
  </header>`;
}

/** Warna kotak ukuran per urutan jalur — warna SNOUTY, bergiliran. */
const TILE_TONES = [
  'tone-action',
  'tone-ink',
  'tone-pipe',
  'tone-amber',
  'tone-green',
  'tone-slate',
];

function summarySection(p: ReportPayload, t: ReportCopy): string {
  const tiles = p.systemLines.slice(0, 6);
  return `<section class="page">
  ${sectionHead(p, t, 1, t.summaryTitle)}
  <div class="tiles">
    <div class="tile tile-lead">
      <div class="kicker kicker-light">${t.installationKicker}</div>
      <div class="lead-value">${esc(p.identity.installationType)}</div>
      <span class="pill pill-on-dark">${esc(t.provenance[p.overallProvenance])}</span>
      <div class="lead-note">${esc(p.headline)}</div>
    </div>
    <div class="tile-grid">
      ${tiles
        .map(
          (line, i) => `<div class="tile ${TILE_TONES[i % TILE_TONES.length]!}">
        <div class="tile-value">${esc(line.size)}</div>
        <div class="tile-label">${esc(line.name)}</div>
        <div class="tile-sub">${esc(line.path)}</div>
      </div>`,
        )
        .join('\n      ')}
    </div>
  </div>

  <div class="callout">
    <div class="kicker kicker-action">${t.descriptionKicker}</div>
    <p>${esc(p.body)}</p>
  </div>

  <h3 class="subhead">${t.requirementsTitle}</h3>
  <table class="grid">
    ${p.requirements
      .map(
        (row) =>
          `<tr><th>${esc(row.label)}</th><td>${esc(row.value)}</td><td class="status">${pill(
            row.provenance,
            t,
          )}</td></tr>`,
      )
      .join('\n    ')}
  </table>
</section>`;
}

function systemSection(p: ReportPayload, t: ReportCopy): string {
  return `<section class="page">
  ${sectionHead(p, t, 2, t.systemTitle)}
  <table class="grid data">
    <thead><tr><th>${t.systemColumns.line}</th><th>${t.systemColumns.size}</th><th>${t.systemColumns.reason}</th><th>${t.systemColumns.status}</th></tr></thead>
    ${p.systemLines
      .map(
        (line) =>
          `<tr><td class="strong">${esc(line.name)}<span class="sub">${esc(line.path)}</span></td>` +
          `<td class="mono size">${esc(line.size)}</td><td class="reason">${esc(line.reason)}</td>` +
          `<td class="status">${pill(line.provenance, t)}</td></tr>`,
      )
      .join('\n    ')}
  </table>
  ${
    p.assumptions.length > 0
      ? `<h3 class="subhead">${t.assumptionsTitle}</h3>
  <ul class="assumptions">
    ${p.assumptions.map((a) => `<li>${esc(a.text)}</li>`).join('\n    ')}
  </ul>`
      : ''
  }
  <h3 class="subhead">${t.legendTitle}</h3>
  <div class="legend">
    ${LEGEND.map(
      (status) =>
        `<div class="legend-item legend-${status.toLowerCase()}"><strong>${t.provenance[status]}</strong><span>${t.provenanceMeaning[status]}</span></div>`,
    ).join('\n    ')}
  </div>
</section>`;
}

/** Keterangan status ditaruh dekat tabel yang memakai penandanya. */
const LEGEND: readonly Provenance[] = ['VERIFIED', 'ESTIMATED', 'ASSUMED', 'UNAVAILABLE'];

function materialSection(p: ReportPayload, t: ReportCopy): string {
  const showPrices = p.pricing.enabled;
  const money = (value: number | undefined): string => rupiah(value, t.numberLocale);
  return `<section class="page">
  ${sectionHead(p, t, 3, t.materialTitle)}
  <div class="banner">${showPrices ? t.priceDisclaimerWithList : t.priceDisclaimer}</div>
  ${
    p.bom.length === 0
      ? `<p class="bodytext">${t.bomEmpty}</p>`
      : `<table class="grid data">
    <thead><tr>
      <th>${t.bomColumns.item}</th><th>${t.bomColumns.size}</th><th>${t.bomColumns.quantity}</th>
      ${showPrices ? `<th>${t.bomColumns.unitPrice}</th><th>${t.bomColumns.subtotal}</th>` : ''}
      <th>${t.bomColumns.status}</th>
    </tr></thead>
    ${p.bom
      .map(
        (item) =>
          `<tr><td class="strong">${esc(item.item)}<span class="sub">${esc(item.basis)}</span></td>` +
          `<td class="mono">${esc(item.size)}</td>` +
          `<td class="mono">${String(item.quantity)} ${esc(item.unit)}</td>` +
          (showPrices
            ? `<td class="mono">${money(item.unitPrice)}</td><td class="mono">${money(item.subtotal)}</td>`
            : '') +
          `<td class="status">${pill(item.provenance, t)}</td></tr>`,
      )
      .join('\n    ')}
  </table>`
  }
  ${
    showPrices
      ? `<table class="totals">
    <tr><th>${t.subtotal}</th><td class="mono">${money(p.pricing.subtotal)}</td></tr>
    <tr><th>${t.tax(p.pricing.taxRatePercent)}</th><td class="mono">${money(p.pricing.taxAmount)}</td></tr>
    <tr class="grand"><th>${t.total}</th><td class="mono">${money(p.pricing.total)}</td></tr>
  </table>`
      : ''
  }
  <p class="note">${t.exclusions}</p>
</section>`;
}

function closingSection(p: ReportPayload, t: ReportCopy): string {
  const locale = p.locale;
  return `<section class="page">
  ${sectionHead(p, t, 4, t.closingTitle)}
  <h3 class="subhead">${t.basisTitle}</h3>
  <ol class="basis">
    ${p.basis
      .map(
        (row) =>
          `<li>${
            hasStepTitle(row.ruleId)
              ? `<strong>${esc(ruleStepTitle(row.ruleId, locale))}.</strong> `
              : ''
          }${esc(row.explanation)}</li>`,
      )
      .join('\n    ')}
  </ol>

  <h3 class="subhead">${t.nextStepsTitle}</h3>
  <p class="bodytext">${t.nextSteps}</p>

  <table class="signature">
    <tr>
      <td>
        <div class="sign-mascot snouty-art" role="img" aria-label="SNOUTY"></div>
        ${t.preparedBy} <strong>SNOUTY</strong>
        <span class="sub">${t.catalog} ${esc(p.catalogVersionLabel)}</span>
        ${p.ruleset ? `<span class="sub">${t.ruleset} ${esc(p.ruleset.stamp)}</span>` : ''}
      </td>
      <td>${t.reviewedBy}<span class="sub">${t.reviewer}</span></td>
    </tr>
  </table>
  <div class="closing-foot"><strong>${t.disclaimer}</strong></div>
</section>`;
}

function pill(status: Provenance, t: ReportCopy): string {
  return `<span class="pill pill-${status.toLowerCase()}">${esc(t.provenance[status])}</span>`;
}

/**
 * Rupiah tanpa desimal, pemisah ribuan menurut bahasa laporan ("Rp 1.250.000" /
 * "Rp 1,250,000") — mata uangnya tetap rupiah. Nilai kosong dirender sebagai en dash,
 * bukan Rp 0.
 */
function rupiah(value: number | undefined, numberLocale: string): string {
  if (value === undefined) return '–';
  return `Rp ${value.toLocaleString(numberLocale)}`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Palet cetak.
 *
 * Nilainya **harus literal**: dokumen ini artefak mandiri yang dicetak Chromium tanpa
 * pipeline CSS, jadi tidak ada custom property yang bisa diwarisi dari `packages/ui`.
 * Agar duplikasi ini tidak menyimpang diam-diam, `report-palette.spec.ts` membaca
 * `packages/ui/src/tokens.css` dan menegaskan setiap nilai di sini masih cocok dengan
 * tokennya — perubahan token yang lupa dicerminkan akan menggagalkan tes, bukan
 * menghasilkan laporan berwarna lain.
 *
 * Kuncinya memakai nama token supaya pemetaannya bisa dibaca dan diuji.
 */
/* eslint-disable no-restricted-syntax -- lihat alasan di atas: dokumen cetak mandiri */
export const PRINT_PALETTE = {
  'snouty-ink': '#14181a',
  'snouty-muted': '#5a6468',
  'snouty-caption': '#6b7376',
  'snouty-border': '#dde2e1',
  'snouty-border-soft': '#e6eae9',
  'snouty-canvas': '#f7f8f7',
  'snouty-mascot-paper': '#ffffff',
  'snouty-action': '#df301c',
  'snouty-action-text': '#b02414',
  'snouty-action-soft-bg': '#fdece9',
  'snouty-action-soft-border': '#f6c3bb',
  'snouty-pipe-mid': '#ee7a67',
  'snouty-pipe-light': '#f4b0a3',
  'snouty-verified-text': '#1e7a4c',
  'snouty-verified-bg': '#e8f5ec',
  'snouty-assumed-text': '#8a5300',
  'snouty-assumed-strong': '#b26b00',
  'snouty-assumed-bg': '#fdf3e3',
  'snouty-assumed-border': '#f0dfc0',
} as const;
/* eslint-enable no-restricted-syntax */

const C = PRINT_PALETTE;

const CSS = `
@page { size: A4; margin: 14mm 13mm 16mm; }
@page :first { margin: 0; }
* { box-sizing: border-box; }
html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'IBM Plex Sans', 'Liberation Sans', system-ui, sans-serif; color: ${C['snouty-ink']}; font-size: 9.5pt; }
.page { page-break-after: always; }
.page:last-child { page-break-after: auto; }
.mono { font-family: 'IBM Plex Mono', 'Liberation Mono', monospace; }
.kicker { font-size: 7pt; letter-spacing: 0.16em; font-weight: 600; color: ${C['snouty-caption']}; text-transform: uppercase; }
.kicker-light { color: ${C['snouty-pipe-light']}; }
.kicker-action { color: ${C['snouty-action-text']}; }
.sub { display: block; font-size: 7.5pt; font-weight: 400; color: ${C['snouty-caption']}; margin-top: 0.6mm; }
.bodytext { font-size: 9pt; line-height: 1.6; color: ${C['snouty-muted']}; margin: 0 0 3mm; }

/* ── Sampul ── */
.cover { background: ${C['snouty-mascot-paper']}; position: relative; height: 297mm; overflow: hidden; display: flex; flex-direction: column; }
.hero { position: relative; height: 178mm; background: ${C['snouty-ink']}; color: ${C['snouty-mascot-paper']}; padding: 20mm 18mm 0; overflow: hidden; }
.rings { position: absolute; right: -40mm; top: -6mm; width: 170mm; height: 170mm; }
.ring { fill: none; stroke: ${C['snouty-mascot-paper']}; stroke-opacity: 0.08; stroke-width: 1.2; }
.arc { fill: none; stroke-linecap: round; transform-origin: 260px 190px; }
.arc-outer { stroke: ${C['snouty-action']}; stroke-width: 3; stroke-dasharray: 260 1200; transform: rotate(-95deg); }
.arc-inner { stroke: ${C['snouty-pipe-mid']}; stroke-width: 3; stroke-dasharray: 220 900; transform: rotate(150deg); }
.snouty-art { background: url('${SNOUTY_MASCOT}') center / contain no-repeat; }
.mascot { position: absolute; right: 22mm; top: 44mm; width: 78mm; height: 78mm; }
.lockup { position: relative; display: flex; align-items: center; gap: 5mm; }
.logo-tile { background: ${C['snouty-mascot-paper']}; border-radius: 3mm; padding: 3mm 4mm; }
.pralon-logo { width: 34mm; height: 12.7mm; background: url('${PRALON_LOGO}') center / contain no-repeat; }
.lockup-divider { width: 0.3mm; height: 12mm; background: ${C['snouty-mascot-paper']}; opacity: 0.25; }
.brand { font-size: 14pt; font-weight: 700; letter-spacing: 0.04em; }
.brandsub { font-size: 8pt; color: ${C['snouty-pipe-light']}; }
.hero-text { position: absolute; left: 18mm; bottom: 16mm; right: 18mm; }
.cover-kicker { font-size: 8pt; letter-spacing: 0.3em; font-weight: 600; color: ${C['snouty-pipe-mid']}; margin-bottom: 4mm; }
.cover-title { font-size: 38pt; line-height: 1.05; font-weight: 700; margin: 0 0 4mm; max-width: 120mm; letter-spacing: -0.01em; }
.cover-sub { font-size: 10.5pt; color: ${C['snouty-border']}; }
.band { height: 5mm; background: ${C['snouty-action']}; border-bottom: 1.6mm solid ${C['snouty-pipe-light']}; }
.cover-body { flex: 1; padding: 13mm 18mm 12mm; display: flex; flex-direction: column; }
.customer { font-size: 22pt; font-weight: 700; margin: 2mm 0 8mm; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12mm; }
.info { border-top: 1px solid ${C['snouty-border']}; padding: 3mm 0; }
.info-value { font-size: 10pt; margin-top: 1.2mm; }
.cover-foot { margin-top: auto; font-size: 7.5pt; letter-spacing: 0.08em; color: ${C['snouty-action-text']}; }

/* ── Kepala bagian ── */
.section-head { display: flex; justify-content: space-between; align-items: flex-start;
  border-bottom: 1px solid ${C['snouty-border']}; padding-bottom: 3mm; margin-bottom: 6mm; }
.section-kicker { font-size: 7.5pt; letter-spacing: 0.3em; font-weight: 600; color: ${C['snouty-action']}; }
.section-title { font-size: 19pt; font-weight: 700; margin: 2mm 0 2mm; }
.section-rule { width: 12mm; height: 1mm; background: ${C['snouty-action']}; border-radius: 1mm; }
.section-meta { text-align: right; font-size: 8.5pt; color: ${C['snouty-caption']}; }
.section-meta strong { display: block; color: ${C['snouty-ink']}; font-size: 9.5pt; margin-bottom: 0.8mm; }
.subhead { font-size: 10.5pt; font-weight: 700; margin: 6mm 0 2.5mm; }

/* ── Kotak ringkasan ── */
.tiles { display: grid; grid-template-columns: 62mm 1fr; gap: 3mm; }
.tile { border-radius: 3mm; padding: 4mm; color: ${C['snouty-mascot-paper']}; break-inside: avoid; }
.tile-lead { background: ${C['snouty-ink']}; display: flex; flex-direction: column; gap: 2.5mm; }
.lead-value { font-size: 16pt; font-weight: 700; line-height: 1.15; }
.lead-note { font-size: 8pt; line-height: 1.5; color: ${C['snouty-border']}; }
.tile-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
.tile-value { font-family: 'IBM Plex Mono', 'Liberation Mono', monospace; font-size: 17pt; font-weight: 700; }
.tile-label { font-size: 8.5pt; font-weight: 600; margin-top: 2.5mm; line-height: 1.3; }
.tile-sub { font-size: 7pt; opacity: 0.85; margin-top: 0.8mm; line-height: 1.35; }
.tone-action { background: ${C['snouty-action']}; }
.tone-ink { background: ${C['snouty-muted']}; }
.tone-pipe { background: ${C['snouty-pipe-mid']}; }
.tone-amber { background: ${C['snouty-assumed-strong']}; }
.tone-green { background: ${C['snouty-verified-text']}; }
.tone-slate { background: ${C['snouty-caption']}; }
.callout { margin-top: 5mm; background: ${C['snouty-action-soft-bg']}; border: 1px solid ${C['snouty-action-soft-border']};
  border-radius: 3mm; padding: 4mm 5mm; break-inside: avoid; }
.callout p { margin: 2mm 0 0; font-size: 9pt; line-height: 1.6; color: ${C['snouty-ink']}; }

/* ── Tabel ── */
table { width: 100%; border-collapse: collapse; }
.grid th, .grid td { text-align: left; vertical-align: top; padding: 2.4mm 2mm; border-bottom: 1px solid ${C['snouty-border-soft']}; font-size: 9pt; }
.grid th { font-weight: 500; color: ${C['snouty-caption']}; }
.data thead th { background: ${C['snouty-canvas']}; font-size: 7pt; letter-spacing: 0.12em; font-weight: 600;
  border-bottom: 1.5px solid ${C['snouty-ink']}; }
.data tr { break-inside: avoid; }
.strong { font-weight: 600; }
.size { font-weight: 700; white-space: nowrap; }
.reason { font-size: 8pt; line-height: 1.5; color: ${C['snouty-muted']}; }
.status { white-space: nowrap; text-align: right; }
.pill { display: inline-block; font-size: 6.5pt; letter-spacing: 0.06em; font-weight: 600; padding: 0.8mm 2.2mm; border-radius: 6mm; }
.pill-verified { background: ${C['snouty-verified-bg']}; color: ${C['snouty-verified-text']}; }
.pill-estimated { background: ${C['snouty-action-soft-bg']}; color: ${C['snouty-action-text']}; }
.pill-assumed { background: ${C['snouty-assumed-bg']}; color: ${C['snouty-assumed-text']}; }
.pill-unavailable { background: ${C['snouty-canvas']}; color: ${C['snouty-muted']}; }
.pill-on-dark { align-self: flex-start; background: ${C['snouty-muted']}; color: ${C['snouty-mascot-paper']}; }
.assumptions, .basis { margin: 0; padding-left: 5mm; font-size: 8.2pt; line-height: 1.5; color: ${C['snouty-muted']}; }
.basis li, .assumptions li { margin-bottom: 0.8mm; break-inside: avoid; }
.basis strong { color: ${C['snouty-ink']}; }
.banner { border: 1px solid ${C['snouty-assumed-border']}; background: ${C['snouty-assumed-bg']}; color: ${C['snouty-assumed-text']};
  font-size: 8.5pt; padding: 3mm 4mm; border-radius: 2mm; margin-bottom: 5mm; }
.totals { margin-top: 4mm; width: 60%; margin-left: auto; }
.totals th { text-align: left; font-weight: 400; font-size: 9pt; padding: 1.5mm 0; }
.totals td { text-align: right; font-size: 9.5pt; padding: 1.5mm 0; }
.totals .grand th, .totals .grand td { font-weight: 700; border-top: 1px solid ${C['snouty-ink']}; }
.note { font-size: 8pt; color: ${C['snouty-caption']}; margin: 3mm 0 0; }

/* ── Penutup ── */
.legend { break-inside: avoid; display: grid; grid-template-columns: repeat(4, 1fr); border-radius: 3mm; overflow: hidden; border: 1px solid ${C['snouty-border']}; }
.legend-item { padding: 3mm; display: flex; flex-direction: column; gap: 1mm; font-size: 7.5pt; line-height: 1.4; }
.legend-item strong { font-size: 7.5pt; letter-spacing: 0.06em; }
.legend-verified { background: ${C['snouty-verified-bg']}; color: ${C['snouty-verified-text']}; }
.legend-estimated { background: ${C['snouty-action-soft-bg']}; color: ${C['snouty-action-text']}; }
.legend-assumed { background: ${C['snouty-assumed-bg']}; color: ${C['snouty-assumed-text']}; }
.legend-unavailable { background: ${C['snouty-canvas']}; color: ${C['snouty-muted']}; }
.signature { margin-top: 7mm; break-inside: avoid; }
.signature td { width: 50%; font-size: 9pt; border-top: 1px solid ${C['snouty-ink']}; padding-top: 2.5mm; vertical-align: top; }
.sign-mascot { width: 14mm; height: 14mm; margin-bottom: 1.5mm; }
.closing-foot { margin-top: 5mm; font-size: 7.5pt; letter-spacing: 0.08em; color: ${C['snouty-action-text']}; }
`;
