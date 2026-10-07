/**
 * Halaman cetak laporan — HTML dua halaman A4. docs/REPORT.md §2, §5.
 * **Fungsi murni:** payload masuk, string HTML keluar.
 *
 * Mengapa HTML dan bukan pustaka PDF: laporannya sudah ada sebagai dokumen HTML/CSS yang
 * presisi di `SNOUTY Laporan Rekomendasi.dc.html`. Membangunnya ulang dengan pdfkit
 * berarti memelihara dua model tata letak yang akan saling menyimpang dalam hitungan
 * bulan. Chromium di worker mencetak CSS yang sudah ditulis.
 *
 * Dua kalimat **tidak diparafrase** karena membawa janji produk: "PANDUAN PERENCANAAN —
 * BUKAN SERTIFIKASI TEKNIS" dan "Perkiraan perencanaan, bukan penawaran resmi." Padanan
 * Inggrisnya sama persis dengan yang dipakai web (`SOLUTION_COPY_EN.planningDisclaimer`,
 * `SOLUTION_COPY_EN.priceDisclaimer`) — satu janji, satu redaksi per bahasa.
 *
 * Dua bahasa (P15-05): seluruh teks tetap halaman hidup di `REPORT_COPY`, dipilih menurut
 * `payload.locale` — bahasa percakapan yang dibekukan saat laporan dibuat. Isi yang datang
 * dari rekomendasi (judul, prosa, baris sistem, item BOM, asumsi) sudah dalam bahasa itu
 * dan tidak diterjemahkan di sini.
 *
 * Catatan keamanan: seluruh nilai di-escape (`esc`). Nama pelanggan dan lokasi proyek
 * datang dari pengguna, dan halaman ini dirender server-side lalu dicetak — tanpa escape
 * ia menjadi jalur injeksi markup ke dalam dokumen yang dibawa ke distributor.
 */

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
  /** Janji produk — jangan diparafrase. */
  readonly disclaimer: string;
  /** Janji produk (kalimat pertama) — jangan diparafrase. */
  readonly priceDisclaimer: string;
  readonly priceDisclaimerWithList: string;
  readonly pageOf: (page: number) => string;
  readonly page1Title: string;
  readonly page2Title: string;
  readonly identity: {
    readonly customer: string;
    readonly consultationDate: string;
    readonly projectLocation: string;
    readonly installationType: string;
  };
  readonly summaryKicker: string;
  readonly requirementsKicker: string;
  readonly systemKicker: string;
  readonly systemColumns: {
    readonly line: string;
    readonly size: string;
    readonly reason: string;
    readonly status: string;
  };
  readonly assumptionsKicker: string;
  readonly page1Footer: string;
  readonly bomColumns: {
    readonly item: string;
    readonly size: string;
    readonly quantity: string;
    readonly unitPrice: string;
    readonly subtotal: string;
    readonly status: string;
  };
  readonly subtotal: string;
  readonly tax: (percent: number) => string;
  readonly total: string;
  readonly exclusions: string;
  readonly basisKicker: string;
  readonly nextStepsKicker: string;
  readonly nextSteps: string;
  readonly preparedBy: string;
  readonly catalog: string;
  readonly reviewedBy: string;
  readonly reviewer: string;
  readonly consultationRef: string;
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
    disclaimer: 'PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS',
    priceDisclaimer: 'Perkiraan perencanaan, bukan penawaran resmi.',
    priceDisclaimerWithList:
      'Perkiraan perencanaan, bukan penawaran resmi. Harga final mengikuti daftar harga distributor Pralon yang berlaku.',
    pageOf: (page) => `HAL. ${String(page)} DARI 2`,
    page1Title: 'Laporan Rekomendasi &amp; Estimasi Material',
    page2Title: 'Estimasi Kebutuhan Material &amp; Biaya',
    identity: {
      customer: 'Pelanggan',
      consultationDate: 'Tanggal konsultasi',
      projectLocation: 'Lokasi proyek',
      installationType: 'Jenis instalasi',
    },
    summaryKicker: 'RINGKASAN SOLUSI',
    requirementsKicker: 'KEBUTUHAN YANG TERCATAT',
    systemKicker: 'REKOMENDASI SISTEM',
    systemColumns: { line: 'JALUR', size: 'UKURAN', reason: 'ALASAN', status: 'STATUS' },
    assumptionsKicker: 'ASUMSI YANG DIGUNAKAN',
    page1Footer: 'SNOUTY · ASISTEN SOLUSI PERPIPAAN PRALON',
    bomColumns: {
      item: 'MATERIAL',
      size: 'UKURAN',
      quantity: 'QTY',
      unitPrice: 'HARGA SATUAN',
      subtotal: 'SUBTOTAL',
      status: 'STATUS',
    },
    subtotal: 'Subtotal material',
    tax: (percent) => `PPN ${String(percent)}%`,
    total: 'Total estimasi',
    exclusions: 'Belum termasuk jasa instalasi, aksesori non-pipa, dan pengiriman.',
    basisKicker: 'DASAR PERHITUNGAN',
    nextStepsKicker: 'LANGKAH BERIKUTNYA',
    nextSteps:
      'Bawa laporan ini ke toko atau distributor Pralon untuk penawaran resmi dan pemeriksaan akhir bersama instalatur.',
    preparedBy: 'Disusun oleh:',
    catalog: 'Katalog',
    reviewedBy: 'Diperiksa oleh (opsional):',
    reviewer: 'Instalatur / Tim Teknis Pralon',
    consultationRef: 'REF. KONSULTASI',
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
    disclaimer: 'PLANNING GUIDANCE — NOT A TECHNICAL CERTIFICATION',
    priceDisclaimer: 'A planning estimate, not an official quotation.',
    priceDisclaimerWithList:
      'A planning estimate, not an official quotation. Final prices follow the current Pralon distributor price list.',
    pageOf: (page) => `PAGE ${String(page)} OF 2`,
    page1Title: 'Recommendation &amp; Material Estimate Report',
    page2Title: 'Material &amp; Cost Estimate',
    identity: {
      customer: 'Customer',
      consultationDate: 'Consultation date',
      projectLocation: 'Project location',
      installationType: 'Installation type',
    },
    summaryKicker: 'SOLUTION SUMMARY',
    requirementsKicker: 'RECORDED REQUIREMENTS',
    systemKicker: 'SYSTEM RECOMMENDATION',
    systemColumns: { line: 'LINE', size: 'SIZE', reason: 'REASON', status: 'STATUS' },
    assumptionsKicker: 'ASSUMPTIONS USED',
    page1Footer: 'SNOUTY · PRALON PIPING SOLUTION ASSISTANT',
    bomColumns: {
      item: 'MATERIAL',
      size: 'SIZE',
      quantity: 'QTY',
      unitPrice: 'UNIT PRICE',
      subtotal: 'SUBTOTAL',
      status: 'STATUS',
    },
    subtotal: 'Material subtotal',
    tax: (percent) => `VAT ${String(percent)}%`,
    total: 'Estimated total',
    exclusions: 'Excludes installation labor, non-pipe accessories, and delivery.',
    basisKicker: 'CALCULATION BASIS',
    nextStepsKicker: 'NEXT STEPS',
    nextSteps:
      'Take this report to a Pralon store or distributor for an official quotation and a final check together with your installer.',
    preparedBy: 'Prepared by:',
    catalog: 'Catalog',
    reviewedBy: 'Reviewed by (optional):',
    reviewer: 'Installer / Pralon Technical Team',
    consultationRef: 'CONSULTATION REF.',
  },
};

export function renderReportHtml(payload: ReportPayload): string {
  const copy = REPORT_COPY[payload.locale];
  return `<!doctype html>
<html lang="${copy.htmlLang}">
<head>
<meta charset="utf-8">
<title>${esc(payload.reportNumber)}</title>
<style>${CSS}</style>
</head>
<body>
${page1(payload, copy)}
${page2(payload, copy)}
</body>
</html>`;
}

function page1(p: ReportPayload, t: ReportCopy): string {
  return `<section class="page">
  <header class="masthead">
    <div>
      <div class="brand">SNOUTY</div>
      <div class="brandsub">PRALON PIPE SOLUTION ASSISTANT</div>
    </div>
    <div class="docmeta">
      <div class="doctitle">${t.page1Title}</div>
      <div class="docno">NO. ${esc(p.reportNumber)} · ${t.pageOf(1)}</div>
    </div>
  </header>

  <table class="identity">
    <tr><th>${t.identity.customer}</th><td>${esc(p.identity.customerName)}</td>
        <th>${t.identity.consultationDate}</th><td>${esc(p.identity.consultationDate)}</td></tr>
    <tr><th>${t.identity.projectLocation}</th><td>${esc(p.identity.projectLocation)}</td>
        <th>${t.identity.installationType}</th><td>${esc(p.identity.installationType)}</td></tr>
  </table>

  <h2 class="kicker">${t.summaryKicker}</h2>
  <p class="headline">${esc(p.headline)}</p>
  <p class="bodytext">${esc(p.body)}</p>

  <h2 class="kicker">${t.requirementsKicker}</h2>
  <table class="grid">
    ${p.requirements
      .map(
        (row) =>
          `<tr><th>${esc(row.label)}</th><td>${esc(row.value)}</td><td class="status">${esc(
            t.provenance[row.provenance],
          )}</td></tr>`,
      )
      .join('\n    ')}
  </table>

  <h2 class="kicker">${t.systemKicker}</h2>
  <table class="grid">
    <tr><th>${t.systemColumns.line}</th><th>${t.systemColumns.size}</th><th>${t.systemColumns.reason}</th><th>${t.systemColumns.status}</th></tr>
    ${p.systemLines
      .map(
        (line) =>
          `<tr><td>${esc(line.name)}<span class="sub">${esc(line.path)}</span></td>` +
          `<td class="mono">${esc(line.size)}</td><td>${esc(line.reason)}</td>` +
          `<td class="status">${esc(t.provenance[line.provenance])}</td></tr>`,
      )
      .join('\n    ')}
  </table>

  ${
    p.assumptions.length > 0
      ? `<h2 class="kicker">${t.assumptionsKicker}</h2>
  <ul class="assumptions">
    ${p.assumptions.map((a) => `<li>${esc(a.text)}</li>`).join('\n    ')}
  </ul>`
      : ''
  }

  <footer class="pagefoot">
    <span>${t.page1Footer}</span>
    <strong>${t.disclaimer}</strong>
  </footer>
</section>`;
}

function page2(p: ReportPayload, t: ReportCopy): string {
  const showPrices = p.pricing.enabled;
  const money = (value: number | undefined): string => rupiah(value, t.numberLocale);
  return `<section class="page">
  <header class="masthead">
    <div>
      <div class="brand">SNOUTY</div>
      <div class="brandsub">PRALON PIPE SOLUTION ASSISTANT</div>
    </div>
    <div class="docmeta">
      <div class="doctitle">${t.page2Title}</div>
      <div class="docno">NO. ${esc(p.reportNumber)} · ${t.pageOf(2)}</div>
    </div>
  </header>

  <div class="banner">${showPrices ? t.priceDisclaimerWithList : t.priceDisclaimer}</div>

  <table class="grid">
    <tr>
      <th>${t.bomColumns.item}</th><th>${t.bomColumns.size}</th><th>${t.bomColumns.quantity}</th>
      ${showPrices ? `<th>${t.bomColumns.unitPrice}</th><th>${t.bomColumns.subtotal}</th>` : ''}
      <th>${t.bomColumns.status}</th>
    </tr>
    ${p.bom
      .map(
        (item) =>
          `<tr><td>${esc(item.item)}</td><td class="mono">${esc(item.size)}</td>` +
          `<td class="mono">${String(item.quantity)} ${esc(item.unit)}</td>` +
          (showPrices
            ? `<td class="mono">${money(item.unitPrice)}</td><td class="mono">${money(item.subtotal)}</td>`
            : '') +
          `<td class="status">${esc(t.provenance[item.provenance])}</td></tr>`,
      )
      .join('\n    ')}
  </table>

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

  <h2 class="kicker">${t.basisKicker}</h2>
  <ul class="basis">
    ${p.basis.map((row) => `<li><span class="mono">${esc(row.ruleId)}</span> ${esc(row.explanation)}</li>`).join('\n    ')}
  </ul>

  <h2 class="kicker">${t.nextStepsKicker}</h2>
  <p class="bodytext">${t.nextSteps}</p>

  <table class="signature">
    <tr>
      <td>${t.preparedBy} <strong>SNOUTY</strong><span class="sub">${t.catalog} ${esc(p.catalogVersionLabel)}</span></td>
      <td>${t.reviewedBy}<span class="sub">${t.reviewer}</span></td>
    </tr>
  </table>

  <footer class="pagefoot">
    <span>${t.consultationRef} ${esc(p.reportNumber)}</span>
    <strong>${t.disclaimer}</strong>
  </footer>
</section>`;
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
  'snouty-border-soft': '#e6eae9',
  'snouty-action-text': '#b02414',
  'snouty-assumed-text': '#8a5300',
  'snouty-assumed-bg': '#fdf3e3',
  'snouty-assumed-border': '#f0dfc0',
} as const;
/* eslint-enable no-restricted-syntax */

const C = PRINT_PALETTE;

const CSS = `
@page { size: A4; margin: 14mm 13mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'IBM Plex Sans', system-ui, sans-serif; color: ${C['snouty-ink']}; font-size: 10pt; }
.page { page-break-after: always; display: flex; flex-direction: column; min-height: 265mm; }
.page:last-child { page-break-after: auto; }
.masthead { display: flex; justify-content: space-between; align-items: flex-start;
  border-bottom: 2px solid ${C['snouty-ink']}; padding-bottom: 6mm; margin-bottom: 6mm; }
.brand { font-size: 16pt; font-weight: 700; letter-spacing: -0.01em; }
.brandsub { font-family: 'IBM Plex Mono', monospace; font-size: 7pt; letter-spacing: 0.08em; color: ${C['snouty-caption']}; }
.docmeta { text-align: right; }
.doctitle { font-size: 11pt; font-weight: 600; }
.docno { font-family: 'IBM Plex Mono', monospace; font-size: 7.5pt; color: ${C['snouty-caption']}; margin-top: 1mm; }
.kicker { font-family: 'IBM Plex Mono', monospace; font-size: 7.5pt; letter-spacing: 0.08em;
  color: ${C['snouty-caption']}; margin: 6mm 0 2mm; font-weight: 500; }
.headline { font-size: 13pt; font-weight: 600; line-height: 1.35; margin: 0 0 2mm; }
.bodytext { font-size: 9.5pt; line-height: 1.55; color: ${C['snouty-muted']}; margin: 0; }
table { width: 100%; border-collapse: collapse; }
.identity th, .grid th { text-align: left; font-weight: 500; color: ${C['snouty-caption']}; font-size: 8pt; }
.identity td, .grid td { font-size: 9.5pt; }
.identity th, .identity td, .grid th, .grid td { border-bottom: 1px solid ${C['snouty-border-soft']}; padding: 2mm 2mm 2mm 0; vertical-align: top; }
.mono { font-family: 'IBM Plex Mono', monospace; }
.status { font-family: 'IBM Plex Mono', monospace; font-size: 7pt; letter-spacing: 0.04em;
  color: ${C['snouty-assumed-text']}; white-space: nowrap; }
.sub { display: block; font-size: 8pt; color: ${C['snouty-caption']}; margin-top: 0.5mm; }
.assumptions, .basis { margin: 0; padding-left: 5mm; font-size: 9pt; line-height: 1.6; color: ${C['snouty-muted']}; }
.banner { border: 1px solid ${C['snouty-assumed-border']}; background: ${C['snouty-assumed-bg']}; color: ${C['snouty-assumed-text']};
  font-size: 8.5pt; padding: 3mm 4mm; border-radius: 1.5mm; margin-bottom: 4mm; }
.totals { margin-top: 3mm; width: 60%; margin-left: auto; }
.totals th { text-align: left; font-weight: 400; font-size: 9pt; padding: 1.5mm 0; }
.totals td { text-align: right; font-size: 9.5pt; padding: 1.5mm 0; }
.totals .grand th, .totals .grand td { font-weight: 700; border-top: 1px solid ${C['snouty-ink']}; }
.note { font-size: 8.5pt; color: ${C['snouty-caption']}; margin: 3mm 0 0; }
.signature { margin-top: 8mm; }
.signature td { width: 50%; font-size: 9pt; border-top: 1px solid ${C['snouty-ink']}; padding-top: 2mm; vertical-align: top; }
.pagefoot { margin-top: auto; padding-top: 5mm; border-top: 1px solid ${C['snouty-border-soft']};
  display: flex; justify-content: space-between; font-family: 'IBM Plex Mono', monospace;
  font-size: 7pt; letter-spacing: 0.05em; color: ${C['snouty-caption']}; }
.pagefoot strong { color: ${C['snouty-action-text']}; }
`;
