---
name: design-implementation
description: Gunakan saat membangun atau mengubah UI apa pun — layar, komponen, warna, tipografi, spacing, dark mode, layout responsif, animasi, mood mascot, tampilan laporan, atau teks antarmuka. Juga saat sebuah layar yang dibutuhkan ternyata tidak ada di desain, atau saat prototipe dan board saling bertentangan.
---

# Implementasi Desain

Rujukan lengkap: `docs/DESIGN_IMPLEMENTATION.md`.

## Jangan merancang ulang

Keluaran Claude Design adalah sumber kebenaran visual. Bila sesuatu tampak perlu diubah, itu masuk
`docs/OPEN_QUESTIONS.md` — bukan keputusan Anda.

Urutan sumber kebenaran:

1. `design-input/DESIGN_DECISIONS.md` (keputusan pemilik)
2. **`SNOUTY Prototype.dc.html`** — prototipe baru
3. `design_handoff_snouty/README.md` — sebagian usang
4. Mascot · Laporan · board light/dark · onboarding

Bila #2 dan #3 berbeda, **#2 menang**. Baca nilai dari sumber HTML/CSS, bukan dari tangkapan layar.

Diabaikan: `designs/SNOUTY-prototype.dc.html` (versi lama).
Tidak diport: `support.js`, `doc-page.js`, `image-slot.js`, sintaks `<sc-if>` / `<sc-for>` / `{{ }}`.
Tidak dikirim: bar DEMO, tombol `simulateError`.

## Logika prototipe ilustratif

Jangan salin ke produksi: formula sizing, tabel `UNIT_PRICE` dan PPN, ekstraksi regex, `titleFrom()`,
jawaban follow-up kalengan, timer palsu (750 ms / 620 ms), riwayat dan nomor laporan hardcoded.

Semuanya punya tujuan akhir yang benar — tabelnya di `docs/DESIGN_IMPLEMENTATION.md` §2.

**"TERVERIFIKASI" hanya untuk provenance `VERIFIED`.**

## Token

Semua warna lewat CSS custom property di `packages/ui`. **Lint melarang hex mentah di `apps/`.**

Aturan semantik, ditegakkan lewat **nama** token:

- `--action-*` merah merek `#DF301C` = aksi / seleksi / jalur pipa
- `--verified-*` hijau = fakta katalog terverifikasi
- `--assumed-*` amber = asumsi / estimasi / data kurang

Tidak pernah ada tombol hijau atau amber; tidak pernah merah untuk "terverifikasi". Tidak ada token
bernama `--button-green` untuk diraih.

**Dark mode: pakai palet prototipe** (`#0F1213` canvas, `#171B1D` surface) — peta lengkap 40+ entri
di `docs/DESIGN_IMPLEMENTATION.md` §3. Merah merek di mode gelap **fill saja**, selalu dengan teks
putih; teks/tautan merek memakai `#F4806E`.

## Metrik — prototipe menang

Sidebar 236px · nav rail 60px · **panel kanan 300px** (README bilang 330) · rail panel 44px ·
header 52px · drawer produk maks 600px · **onboarding 860×580** desktop / bottom sheet 88vh di bawah
1080px · frame mobile 390×844.

Responsif: < 1080px sidebar menciut (header dapat "+ Baru" + menu "Riwayat"), panel kanan jadi
overlay · < 720px onboarding jadi bottom sheet · target sentuh ≥ 44px.

Fokus: `box-shadow: 0 0 0 3px rgba(223,48,28,.14)` + `border-color:#DF301C`.

## Tipografi

IBM Plex Sans 400/500/600/700 + IBM Plex Mono 400/500 (label teknis, ukuran pipa, tag status,
caption). **Di-host sendiri** via `next/font` — bukan Google Fonts. Skala lengkap di §4.

## Provenance di UI

`<ProvenanceTag>` adalah **satu-satunya** cara merender tag status, dan ia menerima `Provenance` —
tidak ada prop yang menerima string "TERVERIFIKASI".

`UNAVAILABLE` → **tidak merender nilai sama sekali**, tampil "Lihat dokumen teknis".

Warna tidak pernah satu-satunya pembawa makna: tag selalu berisi teks. Bagi pengguna buta warna
merah-hijau, perbedaan hijau/amber hilang total — teks yang membawanya.

## Mascot

Mood dari **state sistem**, tidak pernah dipilih LLM. Satu fungsi murni `moodFor(state)` dengan tes.

Dua aturan dari lembar mascot yang wajib jadi tes:
**`fail` tidak pernah** untuk di luar cakupan (pakai `focus`) maupun data kurang (pakai `confused`).
`fail` hanya untuk error sistem, diputar sekali lalu diam di frame akhir.

Tabel lengkap di §7. Seni mascot saat ini **placeholder** (OQ-18) — buat komponennya mudah diganti.
Mascot **tidak dipakai di back-office**.

## `prefers-reduced-motion`

Prototipe **tidak** memilikinya; SPEC §33c mewajibkannya. Saat aktif: semua animasi mascot jadi
frame statis, animasi masuk jadi langsung, titik berpikir jadi indikator statis.

## Aksesibilitas

WCAG 2.1 AA: kontras di kedua tema (paling berisiko: amber di latar krem) · navigasi keyboard penuh ·
cincin fokus selalu terlihat · ARIA untuk tab/drawer/modal/bottom sheet · focus trap + kembalikan
fokus · live region untuk jawaban streaming dan progres analisis.

## Copy

Bahasa Indonesia, **apa adanya dari desain**, dalam satu modul pesan siap i18n — bukan literal yang
tersebar.

Kalimat yang **tidak boleh diparafrase** karena membawa makna kebijakan (daftar lengkap §10):
"PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS" · "SKEMATIK · BUKAN GAMBAR KERJA" ·
"Data wilayah dipakai untuk analisis kebutuhan pasar, bukan untuk menentukan rekomendasi." ·
"Perkiraan perencanaan, bukan penawaran resmi."

Mengubahnya berarti mengubah janji produk, bukan memperbaiki redaksi.

## Layar yang belum didesain

Login, register, register-gate + resume, seluruh back-office, umpan balik, halaman privasi/ketentuan
(OQ-21). Bangun minimal dengan token yang sama, dan **catat sebagai "needs design"** — membuatnya
tampak selesai akan menyulitkan desainer nanti.
