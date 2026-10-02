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
 * BUKAN SERTIFIKASI TEKNIS" dan "Perkiraan perencanaan, bukan penawaran resmi."
 *
 * Catatan keamanan: seluruh nilai di-escape (`esc`). Nama pelanggan dan lokasi proyek
 * datang dari pengguna, dan halaman ini dirender server-side lalu dicetak — tanpa escape
 * ia menjadi jalur injeksi markup ke dalam dokumen yang dibawa ke distributor.
 */

import type { Provenance } from '@snouty/shared-types';
import type { ReportPayload } from '../domain/report.types.js';

const PROVENANCE_LABEL: Readonly<Record<Provenance, string>> = {
  VERIFIED: 'TERVERIFIKASI',
  ASSUMED: 'ASUMSI',
  ESTIMATED: 'ESTIMASI',
  UNAVAILABLE: 'LIHAT DOKUMEN TEKNIS',
};

const DISCLAIMER = 'PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS';
const PRICE_DISCLAIMER =
  'Perkiraan perencanaan, bukan penawaran resmi. Harga final mengikuti daftar harga distributor Pralon yang berlaku.';

export function renderReportHtml(payload: ReportPayload): string {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>${esc(payload.reportNumber)}</title>
<style>${CSS}</style>
</head>
<body>
${page1(payload)}
${page2(payload)}
</body>
</html>`;
}

function page1(p: ReportPayload): string {
  return `<section class="page">
  <header class="masthead">
    <div>
      <div class="brand">SNOUTY</div>
      <div class="brandsub">PRALON PIPE SOLUTION ASSISTANT</div>
    </div>
    <div class="docmeta">
      <div class="doctitle">Laporan Rekomendasi &amp; Estimasi Material</div>
      <div class="docno">NO. ${esc(p.reportNumber)} · HAL. 1 DARI 2</div>
    </div>
  </header>

  <table class="identity">
    <tr><th>Pelanggan</th><td>${esc(p.identity.customerName)}</td>
        <th>Tanggal konsultasi</th><td>${esc(p.identity.consultationDate)}</td></tr>
    <tr><th>Lokasi proyek</th><td>${esc(p.identity.projectLocation)}</td>
        <th>Jenis instalasi</th><td>${esc(p.identity.installationType)}</td></tr>
  </table>

  <h2 class="kicker">RINGKASAN SOLUSI</h2>
  <p class="headline">${esc(p.headline)}</p>
  <p class="bodytext">${esc(p.body)}</p>

  <h2 class="kicker">KEBUTUHAN YANG TERCATAT</h2>
  <table class="grid">
    ${p.requirements
      .map(
        (row) =>
          `<tr><th>${esc(row.label)}</th><td>${esc(row.value)}</td><td class="status">${esc(
            PROVENANCE_LABEL[row.provenance],
          )}</td></tr>`,
      )
      .join('\n    ')}
  </table>

  <h2 class="kicker">REKOMENDASI SISTEM</h2>
  <table class="grid">
    <tr><th>JALUR</th><th>UKURAN</th><th>ALASAN</th><th>STATUS</th></tr>
    ${p.systemLines
      .map(
        (line) =>
          `<tr><td>${esc(line.name)}<span class="sub">${esc(line.path)}</span></td>` +
          `<td class="mono">${esc(line.size)}</td><td>${esc(line.reason)}</td>` +
          `<td class="status">${esc(PROVENANCE_LABEL[line.provenance])}</td></tr>`,
      )
      .join('\n    ')}
  </table>

  ${
    p.assumptions.length > 0
      ? `<h2 class="kicker">ASUMSI YANG DIGUNAKAN</h2>
  <ul class="assumptions">
    ${p.assumptions.map((a) => `<li>${esc(a.text)}</li>`).join('\n    ')}
  </ul>`
      : ''
  }

  <footer class="pagefoot">
    <span>SNOUTY · ASISTEN SOLUSI PERPIPAAN PRALON</span>
    <strong>${DISCLAIMER}</strong>
  </footer>
</section>`;
}

function page2(p: ReportPayload): string {
  const showPrices = p.pricing.enabled;
  return `<section class="page">
  <header class="masthead">
    <div>
      <div class="brand">SNOUTY</div>
      <div class="brandsub">PRALON PIPE SOLUTION ASSISTANT</div>
    </div>
    <div class="docmeta">
      <div class="doctitle">Estimasi Kebutuhan Material &amp; Biaya</div>
      <div class="docno">NO. ${esc(p.reportNumber)} · HAL. 2 DARI 2</div>
    </div>
  </header>

  <div class="banner">${showPrices ? PRICE_DISCLAIMER : 'Perkiraan perencanaan, bukan penawaran resmi.'}</div>

  <table class="grid">
    <tr>
      <th>MATERIAL</th><th>UKURAN</th><th>QTY</th>
      ${showPrices ? '<th>HARGA SATUAN</th><th>SUBTOTAL</th>' : ''}
      <th>STATUS</th>
    </tr>
    ${p.bom
      .map(
        (item) =>
          `<tr><td>${esc(item.item)}</td><td class="mono">${esc(item.size)}</td>` +
          `<td class="mono">${String(item.quantity)} ${esc(item.unit)}</td>` +
          (showPrices
            ? `<td class="mono">${money(item.unitPrice)}</td><td class="mono">${money(item.subtotal)}</td>`
            : '') +
          `<td class="status">${esc(PROVENANCE_LABEL[item.provenance])}</td></tr>`,
      )
      .join('\n    ')}
  </table>

  ${
    showPrices
      ? `<table class="totals">
    <tr><th>Subtotal material</th><td class="mono">${money(p.pricing.subtotal)}</td></tr>
    <tr><th>PPN ${String(p.pricing.taxRatePercent)}%</th><td class="mono">${money(p.pricing.taxAmount)}</td></tr>
    <tr class="grand"><th>Total estimasi</th><td class="mono">${money(p.pricing.total)}</td></tr>
  </table>`
      : ''
  }

  <p class="note">Belum termasuk jasa instalasi, aksesori non-pipa, dan pengiriman.</p>

  <h2 class="kicker">DASAR PERHITUNGAN</h2>
  <ul class="basis">
    ${p.basis.map((row) => `<li><span class="mono">${esc(row.ruleId)}</span> ${esc(row.explanation)}</li>`).join('\n    ')}
  </ul>

  <h2 class="kicker">LANGKAH BERIKUTNYA</h2>
  <p class="bodytext">Bawa laporan ini ke toko atau distributor Pralon untuk penawaran resmi dan pemeriksaan akhir bersama instalatur.</p>

  <table class="signature">
    <tr>
      <td>Disusun oleh: <strong>SNOUTY</strong><span class="sub">Katalog ${esc(p.catalogVersionLabel)}</span></td>
      <td>Diperiksa oleh (opsional):<span class="sub">Instalatur / Tim Teknis Pralon</span></td>
    </tr>
  </table>

  <footer class="pagefoot">
    <span>REF. KONSULTASI ${esc(p.reportNumber)}</span>
    <strong>${DISCLAIMER}</strong>
  </footer>
</section>`;
}

/** Rupiah tanpa desimal. Nilai kosong dirender sebagai en dash, bukan Rp 0. */
function money(value: number | undefined): string {
  if (value === undefined) return '–';
  return `Rp ${value.toLocaleString('id-ID')}`;
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
  'snouty-caption': '#8a9295',
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
