/**
 * Manifest token — daftar nama, bukan nilai.
 *
 * Nilainya hidup di tokens.css. Halaman pratinjau /tokens membangkitkan dirinya
 * dari manifest ini, sehingga pratinjau tidak bisa menyimpang dari token yang
 * sebenarnya dipakai: menambah token tanpa mendaftarkannya di sini akan
 * ketahuan karena ia tidak muncul di pratinjau.
 */

export interface TokenEntry {
  /** Nama custom property tanpa prefiks `--`. */
  readonly name: string;
  /** Untuk apa token ini dipakai. */
  readonly use: string;
}

export interface TokenGroup {
  readonly title: string;
  /** Catatan aturan semantik, bila ada. */
  readonly rule?: string;
  readonly kind: 'color' | 'shadow' | 'metric' | 'type';
  readonly tokens: readonly TokenEntry[];
}

export const TOKEN_GROUPS: readonly TokenGroup[] = [
  {
    title: 'Aksi / merek',
    rule: 'Merah merek = aksi, seleksi, jalur pipa. Tidak pernah dipakai untuk "terverifikasi". Di mode gelap ia fill saja — teks merek memakai --snouty-action-text.',
    kind: 'color',
    tokens: [
      { name: 'snouty-action', use: 'tombol primer, garis tab aktif, item terpilih' },
      { name: 'snouty-action-hover', use: 'hover tombol' },
      { name: 'snouty-action-text', use: 'teks & tautan merek' },
      { name: 'snouty-action-soft-bg', use: 'pill ukuran, kotak avatar, numeral langkah' },
      { name: 'snouty-action-soft-border', use: 'border aksen lembut, titik progres selesai' },
      { name: 'snouty-action-row', use: 'latar item sidebar aktif' },
    ],
  },
  {
    title: 'Jalur pipa',
    rule: 'Ketebalan garis (4/3/2 px) ikut membawa makna — merah dan salmon nyaris tidak terbedakan bagi buta warna merah-hijau.',
    kind: 'color',
    tokens: [
      { name: 'snouty-pipe-main', use: 'jalur utama & riser — 4px' },
      { name: 'snouty-pipe-mid', use: 'cabang per lantai — 3px' },
      { name: 'snouty-pipe-light', use: 'legenda sambungan fixture' },
      { name: 'snouty-pipe-fixture', use: 'garis sambungan fixture — 2px' },
    ],
  },
  {
    title: 'Mascot',
    rule: 'Warna seni mascot — bagian dari gambar, bukan antarmuka, jadi tanpa padanan gelap.',
    kind: 'color',
    tokens: [
      { name: 'snouty-mascot-line', use: 'garis mata, alis, tepi properti' },
      { name: 'snouty-mascot-dark', use: 'percikan gelap, huruf Z, tanda tanya' },
      { name: 'snouty-mascot-paper', use: 'gelembung pikiran, goresan tinta' },
      { name: 'snouty-mascot-water', use: 'tetesan, semburan, genangan' },
      { name: 'snouty-mascot-blush', use: 'pipi merona (mood thanks)' },
    ],
  },
  {
    title: 'Teks',
    kind: 'color',
    tokens: [
      { name: 'snouty-ink', use: 'teks utama' },
      { name: 'snouty-ink-fill', use: 'latar bubble pengguna (teks putih) — gelap: #2B3236' },
      {
        name: 'snouty-ink-border',
        use: 'bingkai & bayangan komik (gelembung sambutan, toast, bar progres) — gelap: #8E989B',
      },
      { name: 'snouty-ink-2', use: 'isi pesan asisten' },
      { name: 'snouty-ink-3', use: 'label chip, tombol sekunder' },
      { name: 'snouty-ink-4', use: 'isi tabel, deskripsi' },
      { name: 'snouty-muted', use: 'label, teks bantu' },
      { name: 'snouty-muted-2', use: 'cetakan halus' },
      { name: 'snouty-caption', use: 'caption mono 10px kapital' },
      { name: 'snouty-placeholder', use: 'placeholder input' },
      { name: 'snouty-disabled', use: 'langkah tertunda, timestamp' },
    ],
  },
  {
    title: 'Permukaan & garis',
    kind: 'color',
    tokens: [
      { name: 'snouty-canvas', use: 'latar aplikasi' },
      { name: 'snouty-surface', use: 'kartu, panel, header' },
      { name: 'snouty-surface-subtle', use: 'footer tabel, baris hover' },
      { name: 'snouty-surface-schematic', use: 'kanvas skema' },
      { name: 'snouty-border', use: 'input, tombol, tepi modal' },
      { name: 'snouty-border-soft', use: 'border kartu, rel' },
      { name: 'snouty-hairline', use: 'pembatas dalam' },
      { name: 'snouty-hairline-2', use: 'pembatas dalam tipis' },
      { name: 'snouty-dot-grid', use: 'titik kanvas skema' },
      { name: 'snouty-grid-line', use: 'kisi kanvas skema' },
      { name: 'snouty-floor-line', use: 'garis lantai skema' },
      { name: 'snouty-node-border', use: 'border node fixture' },
      { name: 'snouty-step-pending', use: 'cincin langkah tertunda' },
    ],
  },
  {
    title: 'Provenance — terverifikasi',
    rule: 'Hijau HANYA untuk fakta katalog terverifikasi. Tidak pernah untuk tombol.',
    kind: 'color',
    tokens: [
      { name: 'snouty-verified-text', use: '"TERVERIFIKASI"' },
      { name: 'snouty-verified-bg', use: 'latar tag terverifikasi' },
      { name: 'snouty-verified-strong', use: 'judul kartu sukses' },
      { name: 'snouty-verified-soft-bg', use: 'kartu lokasi diizinkan' },
      { name: 'snouty-verified-soft-border', use: 'border kartu sukses' },
    ],
  },
  {
    title: 'Provenance — asumsi & estimasi',
    rule: 'Amber HANYA untuk asumsi, estimasi, dan data kurang. Tidak pernah untuk tombol. Hari ini hampir semua nilai teknik akan amber, karena belum ada aturan yang divalidasi ahli (OQ-06).',
    kind: 'color',
    tokens: [
      { name: 'snouty-assumed-text', use: '"ASUMSI", "DIESTIMASI"' },
      { name: 'snouty-assumed-strong', use: 'judul kartu asumsi' },
      { name: 'snouty-assumed-body', use: 'isi kartu asumsi' },
      { name: 'snouty-assumed-grid', use: 'teks grid asumsi' },
      { name: 'snouty-assumed-bg', use: 'latar tag asumsi' },
      { name: 'snouty-assumed-bg-soft', use: 'latar kartu asumsi' },
      { name: 'snouty-assumed-border', use: 'border kartu asumsi' },
      { name: 'snouty-assumed-border-strong', use: 'border asumsi tegas' },
    ],
  },
  {
    title: 'Bayangan & scrim',
    kind: 'shadow',
    tokens: [
      { name: 'snouty-shadow-card', use: 'kartu' },
      { name: 'snouty-shadow-modal', use: 'modal' },
      { name: 'snouty-shadow-drawer', use: 'drawer produk' },
      { name: 'snouty-shadow-menu', use: 'menu' },
    ],
  },
  {
    title: 'Metrik tetap',
    rule: 'Nilai prototipe menang saat berbeda dari board/README (OQ-25).',
    kind: 'metric',
    tokens: [
      { name: 'snouty-sidebar-w', use: 'sidebar' },
      { name: 'snouty-nav-rail-w', use: 'nav rail saat sidebar diciutkan' },
      { name: 'snouty-panel-w', use: 'panel kanan (README bilang 330px)' },
      { name: 'snouty-panel-rail-w', use: 'rail panel kanan (README bilang 48px)' },
      { name: 'snouty-header-h', use: 'header' },
      { name: 'snouty-drawer-max-w', use: 'drawer produk' },
      { name: 'snouty-onboarding-w', use: 'onboarding desktop' },
      { name: 'snouty-tap-min', use: 'target sentuh minimum' },
    ],
  },
  {
    title: 'Skala tipografi',
    kind: 'type',
    tokens: [
      { name: 'snouty-text-hero', use: 'headline welcome' },
      { name: 'snouty-text-onb-title', use: 'judul langkah onboarding' },
      { name: 'snouty-text-title', use: 'judul modal & produk' },
      { name: 'snouty-text-headline', use: 'headline solusi' },
      { name: 'snouty-text-section', use: 'judul seksi' },
      { name: 'snouty-text-body', use: 'isi chat, sel tabel' },
      { name: 'snouty-text-list', use: 'judul daftar, tombol' },
      { name: 'snouty-text-desc', use: 'deskripsi' },
      { name: 'snouty-text-helper', use: 'teks bantu' },
      { name: 'snouty-text-label', use: 'label field' },
      { name: 'snouty-text-caption', use: 'caption mono kapital' },
      { name: 'snouty-text-micro', use: 'mikro tag mono' },
    ],
  },
];
