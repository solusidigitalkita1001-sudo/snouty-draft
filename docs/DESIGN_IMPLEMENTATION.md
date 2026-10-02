# SNOUTY — Implementasi Desain

Fase 0b · P0b-09 · Terakhir diperbarui 2026-09-30

Bagaimana keluaran Claude Design diwujudkan menjadi kode. Sumbernya SPEC §33.
**Desain tidak dirancang ulang.** Bila ada yang tampak perlu diubah, itu menjadi catatan di
`OPEN_QUESTIONS.md`, bukan keputusan saya.

---

## 1. Urutan sumber kebenaran

Sesuai SPEC §33a, dari yang paling berwenang:

1. `design-input/DESIGN_DECISIONS.md` — keputusan Anda (belum ada)
2. `handoff/project/SNOUTY Prototype.dc.html` — **prototipe baru**
3. `handoff/project/design_handoff_snouty/README.md` — token & spesifikasi layar, sebagian usang
4. `SNOUTY Mascot.dc.html`, `SNOUTY Laporan Rekomendasi.dc.html`, `SNOUTY.dc.html` /
   `SNOUTY Dark.dc.html`, `SNOUTY Onboarding.dc.html`

Diabaikan: `design_handoff_snouty/designs/SNOUTY-prototype.dc.html` (versi lama).
Tidak diport: `support.js`, `doc-page.js`, `image-slot.js`, sintaks `<sc-if>` / `<sc-for>` / `{{ }}`.
Tidak dikirim ke produksi: bar DEMO dan tombol `simulateError`.

Nilai dibaca dari sumber HTML/CSS, bukan dari tangkapan layar.

---

## 2. Logika prototipe bersifat ilustratif

Yang **tidak pernah** disalin ke produksi (SPEC §33b), beserta tujuan akhirnya:

| Di prototipe                                                              | Tujuan akhir                                                |
| ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Formula sizing (`loadUnits >= 8 → 1"`, maks 4 titik, 3,5 m, 1/2", 10–15%) | aturan ENG-001…ENG-014, semua `REQUIRES_DOMAIN_VALIDATION`  |
| Tabel `UNIT_PRICE`, `rupiah()`, PPN 11%                                   | tabel harga berversi di MySQL, hanya bila `PRICING_ENABLED` |
| Ekstraksi regex (`/pabrik\|industri/`, `/kos/`), `titleFrom()`            | ekstraksi LLM tervalidasi skema di sisi server              |
| Jawaban follow-up kalengan                                                | keluaran Engineering Engine + penjelasan LLM                |
| Timer palsu (750 ms berpikir, 620 ms per langkah)                         | event SSE dari batas pipeline nyata                         |
| Riwayat dan nomor laporan hardcoded                                       | data nyata                                                  |

"TERVERIFIKASI" hanya boleh muncul untuk provenance `VERIFIED` (SPEC §5 Policy 4).

---

## 3. Token warna

Diimplementasikan satu kali di `packages/ui` sebagai CSS custom property, plus preset Tailwind.
Tidak ada komponen yang menulis hex; lint melarang hex mentah di `apps/`.

### Terang

| Token                                 | Hex                   | Pemakaian                                                          |
| ------------------------------------- | --------------------- | ------------------------------------------------------------------ |
| `--action`                            | `#DF301C`             | tombol primer, garis tab aktif, jalur pipa, item terpilih          |
| `--action-hover`                      | `#B02414`             | hover tombol; juga warna **teks/tautan** merek di permukaan terang |
| `--action-soft-bg`                    | `#FDECE9`             | pill ukuran, kotak avatar, numeral langkah                         |
| `--action-soft-border`                | `#F6C3BB`             | border aksen lembut, titik progres selesai                         |
| `--action-row`                        | `#FDF1EF`             | latar item sidebar aktif (dengan border kiri 2px `#DF301C`)        |
| `--pipe-mid`                          | `#EE7A67`             | cabang per lantai                                                  |
| `--pipe-light`                        | `#F4B0A3`             | sambungan fixture                                                  |
| `--ink`                               | `#14181A`             | teks utama; latar bubble pengguna (teks putih)                     |
| `--ink-2`                             | `#20262A`             | isi pesan asisten                                                  |
| `--ink-3`                             | `#2B3134`             | label chip, teks tombol sekunder                                   |
| `--ink-4`                             | `#42484B`             | isi tabel, deskripsi                                               |
| `--muted`                             | `#5A6468`             | label, teks bantu                                                  |
| `--muted-2`                           | `#7A8285`             | cetakan halus                                                      |
| `--caption`                           | `#8A9295`             | label caption mono 10px kapital                                    |
| `--placeholder`                       | `#9AA3A5`             | placeholder input                                                  |
| `--disabled`                          | `#A8B0B2`             | label langkah tertunda, timestamp                                  |
| `--canvas`                            | `#F7F8F7`             | latar aplikasi                                                     |
| `--surface`                           | `#FFFFFF`             | kartu, panel, header                                               |
| `--surface-subtle`                    | `#FBFCFB`             | footer tabel, baris hover                                          |
| `--border`                            | `#DDE2E1`             | input, tombol, tepi modal                                          |
| `--border-soft`                       | `#E6EAE9`             | border kartu, rel                                                  |
| `--hairline`                          | `#EFF2F1` / `#F3F5F4` | pembatas dalam                                                     |
| `--dot-grid`                          | `#E4E8E7`             | titik kanvas skema                                                 |
| `--verified-text` / `--verified-bg`   | `#1E7A4C` / `#E8F5EC` | "TERVERIFIKASI"                                                    |
| `--assumed-text` / `--assumed-bg`     | `#8A5300` / `#FDF3E3` | "ASUMSI", "DIESTIMASI"                                             |
| `--assumed-strong` / `--assumed-body` | `#B26B00` / `#7A5518` | judul & isi kartu asumsi                                           |
| `--assumed-border`                    | `#F0DFC0` / `#E3C894` | border kartu asumsi                                                |

### Gelap — dua palet, dan yang dipilih

Board dan prototipe memakai palet gelap yang berbeda (OQ-16). Keduanya saya ekstraksi langsung dari
berkasnya secara terprogram, bukan dibaca manual. **Yang dipakai: palet prototipe**, karena peringkat
sumber kebenarannya lebih tinggi (2 vs 4).

Peta lengkap terang → gelap (prototipe):

| Terang                | Gelap                                                      | Peran                          |
| --------------------- | ---------------------------------------------------------- | ------------------------------ |
| `#F7F8F7`             | `#0F1213`                                                  | canvas                         |
| `#FFFFFF`             | `#171B1D`                                                  | surface                        |
| `#FBFCFB`             | `#1B2022`                                                  | surface subtle                 |
| `#FCFDFC`             | `#131719`                                                  | kanvas skema                   |
| `#DDE2E1`             | `#343B3E`                                                  | border                         |
| `#E6EAE9`             | `#2A3033`                                                  | border kartu                   |
| `#EFF2F1`             | `#23292B`                                                  | hairline                       |
| `#F3F5F4`             | `#1F2426`                                                  | hairline 2 / garis placeholder |
| `#F1F3F2`             | `#1F2426` (bg) / `#23292B` (border)                        | pembatas daftar                |
| `#E9EDEC`             | `#262C2E`                                                  | garis placeholder gambar       |
| `#E4E8E7`             | `#262C2E` (titik grid) / `#2A3033`                         | dot grid                       |
| `#EEF1F0`             | `#1D2224`                                                  | garis kisi skema               |
| `#14181A`             | `#ECEFEE` (teks) · `#2B3236` (bubble) · `#8E989B` (border) | ink                            |
| `#20262A`             | `#DDE2E1`                                                  | ink 2                          |
| `#2B3134`             | `#D0D6D5`                                                  | ink 3                          |
| `#42484B`             | `#B4BCBE`                                                  | ink 4                          |
| `#5A6468`             | `#9AA3A6`                                                  | muted                          |
| `#7A8285`             | `#838C8F`                                                  | muted 2                        |
| `#8A9295`             | `#7E878A`                                                  | caption                        |
| `#9AA3A5`             | —                                                          | placeholder                    |
| `#A8B0B2`             | `#626C6F` (teks) / `#5E686B` (border)                      | disabled                       |
| `#AEB6B7`             | `#5E686B`                                                  | garis fixture                  |
| `#B9C1C0`             | `#566064`                                                  | garis lantai skema             |
| `#C9D0CF`             | `#4A5356` (bg) / `#465053` (border)                        | node skema                     |
| `#D5DAD9`             | `#4A5356`                                                  | cincin langkah tertunda        |
| `#DF301C`             | `#DF301C` — **fill saja, tidak berubah**                   | aksi                           |
| `#B02414`             | `#F4806E`                                                  | teks merek                     |
| `#FDECE9`             | `#3A1D19`                                                  | aksen lembut                   |
| `#FDF1EF`             | `#2A1A18`                                                  | baris terpilih                 |
| `#F6C3BB`             | `#5C2A23`                                                  | border aksen lembut            |
| `#F4B0A3`             | `#7A3429`                                                  | pipa terang                    |
| `#1E7A4C`             | `#62C48F`                                                  | teks verified                  |
| `#E8F5EC`             | `#15291E`                                                  | latar verified                 |
| `#12613B`             | `#6FD09A`                                                  | judul kartu sukses             |
| `#F1FAF4` / `#BFE3CD` | `#122219` / `#2A4A37`                                      | kartu lokasi diizinkan         |
| `#8A5300`             | `#E4B56C`                                                  | teks asumsi                    |
| `#FDF3E3`             | `#2B2210`                                                  | latar asumsi                   |
| `#B26B00`             | `#D69A3C`                                                  | asumsi kuat                    |
| `#7A5518`             | `#E0B36A`                                                  | isi asumsi                     |
| `#6E4E17`             | `#D9AE68`                                                  | teks grid asumsi               |
| `#FDF8EF`             | `#261F12`                                                  | latar kartu asumsi             |
| `#F0DFC0` / `#F0E2C6` | `#4A3D22`                                                  | border kartu asumsi            |
| `#E3C894`             | `#5A4A28`                                                  | border asumsi kuat             |

Sebagai catatan, palet board (bila Anda memilih sebaliknya) memakai `#17191B` canvas, `#1D2023`
surface, `#202326` subtle, `#33383C` border, `#2B3034` border kartu, `#5CC98D` verified, `#EEB96E`
asumsi, `#FF8874` teks merek.

### Aturan semantik

Ini yang paling mudah dilanggar dan paling merusak kepercayaan, jadi ditegakkan lewat **nama** token,
bukan hanya nilai:

- merah merek = aksi / seleksi / jalur pipa
- hijau = fakta katalog terverifikasi
- amber = asumsi / estimasi / data kurang

Tidak pernah ada tombol hijau atau amber; tidak pernah merah untuk "terverifikasi". Karena tokennya
bernama `--action-*`, `--verified-*`, `--assumed-*`, penyalahgunaan langsung terbaca saat review —
tidak ada token bernama `--button-green` untuk diraih.

Di mode gelap, merah merek hanya untuk **fill** (selalu dengan teks `#FFFFFF`); semua teks, label, dan
tautan merek memakai `#F4806E`.

---

## 4. Tipografi

**IBM Plex Sans** (400/500/600/700) untuk semua teks; **IBM Plex Mono** (400/500) untuk label teknis,
ukuran pipa, tag status, numeral langkah, timestamp, dan caption. Di-host sendiri lewat `next/font`,
bukan dari Google Fonts.

| px / weight                      | Pemakaian                               |
| -------------------------------- | --------------------------------------- |
| 34 / 600 / -0.025em              | headline welcome (`text-wrap: balance`) |
| 27 / 600 / -0.028em              | judul langkah onboarding                |
| 23–24 / 600 / -0.02em            | judul modal & produk                    |
| 19 / 600 / -0.012em              | headline solusi                         |
| 15–16 / 600                      | judul seksi                             |
| 14.5–15 / 400 / 1.6              | isi pengantar                           |
| 14 / 400 / 1.6                   | isi chat, sel tabel                     |
| 13.5 / 500–600                   | judul daftar, tombol                    |
| 13 / 400 / 1.55                  | deskripsi                               |
| 12.5 / 400                       | teks bantu, tombol sekunder             |
| 11–11.5                          | label field                             |
| **mono** 10 / 500 / ls .06–.07em | caption & status, kapital               |
| **mono** 9–9.5                   | mikro tag                               |

`text-wrap: pretty` pada paragraf, `balance` pada headline welcome.

---

## 5. Metrik, radius, bayangan, animasi

Bila board/README dan prototipe berbeda, prototipe menang (OQ-25):

| Metrik                       | Nilai                                     | Catatan                                      |
| ---------------------------- | ----------------------------------------- | -------------------------------------------- |
| Sidebar                      | **236px**                                 | sama di semua sumber                         |
| Nav rail (sidebar diciutkan) | **60px**                                  | hanya ada di prototipe                       |
| Panel kanan                  | **300px**                                 | README/board bilang 330px — prototipe menang |
| Rail panel kanan             | **44px**                                  | README bilang 48px                           |
| Header                       | **52px**                                  | sama                                         |
| Drawer produk                | maks **600px**                            |                                              |
| Modal                        | 580–620px                                 |                                              |
| Onboarding desktop           | **860 × 580**, kolom hero 300px           | README bilang maks 580px                     |
| Onboarding sempit            | bottom sheet 88vh, radius `14px 14px 0 0` |                                              |
| Frame mobile                 | 390 × 844                                 |                                              |

Radius: 4–5 (pill, tag) · 6 (tombol, input) · 8 (kartu) · 9–12 (modal) · 20 (chip) · 50% (dot, avatar).

Bayangan: kartu `0 1px 2px rgba(20,24,26,.04–.05)` · modal `0 24px 60px rgba(20,24,26,.22)` · drawer
`-12px 0 40px rgba(20,24,26,.14)` · menu `0 14px 34px rgba(20,24,26,.16)` · scrim
`rgba(20,24,26,.32–.38)`.

Fokus/seleksi: `box-shadow: 0 0 0 3px rgba(223,48,28,.14)` dengan `border-color: #DF301C`.

Animasi: masuk konten `opacity/translateY(6–8px)` 250 ms ease · bottom sheet 280 ms · titik berpikir
`opacity .35→1` 1 s, bertahap 0 / .2 / .4 s · indikator lebar 200 ms.

**`prefers-reduced-motion` wajib ditambahkan** — prototipe tidak memilikinya, SPEC §33c
mensyaratkannya. Saat aktif: semua animasi mascot berhenti di frame statis, animasi masuk menjadi
langsung, titik berpikir menjadi indikator statis.

Titik putus responsif: di bawah **1080px** sidebar menciut (header mendapat "+ Baru" dan menu
"Riwayat") dan panel kanan menjadi overlay; di bawah **720px** onboarding menjadi bottom sheet; target
sentuh ≥ 44px.

---

## 6. Peta layar

| #   | Layar                                                         | Ketergantungan backend            | Fase      |
| --- | ------------------------------------------------------------- | --------------------------------- | --------- |
| 01  | Welcome + composer + disclaimer                               | conversation, guest session       | 3         |
| 02  | Konsultasi aktif, kartu "Yang sudah saya pahami", panel kanan | context engine, ekstraksi, SSE    | 4         |
| 03  | Klarifikasi (maks 4 pertanyaan bernomor)                      | clarification engine, policy      | 5         |
| 04  | Tinjau & edit kebutuhan                                       | context engine, hitung ulang      | 5–6       |
| 05  | Tracker analisis 5 langkah + gagal/ulang/batal                | tahap SSE                         | 6–7       |
| 06  | Workspace rekomendasi (4 tab)                                 | engineering, matching, BOM, skema | 7–9       |
| 07  | Tiga keadaan kartu produk                                     | matcher + provenance              | 7         |
| 08  | Pertanyaan merek kompetitor                                   | policy engine                     | 5         |
| 09  | Skema + legenda + skenario                                    | schematic engine                  | 9         |
| 10  | Drawer detail produk                                          | product catalog                   | 1–2       |
| 11  | Validasi teknis                                               | policy, handoff, report           | 5, 10     |
| 12  | Riwayat & solusi tersimpan                                    | auth, history                     | 10        |
| 13  | Mobile (13a/13b/13c)                                          | —                                 | tiap fase |
| 14  | Onboarding 5 langkah                                          | onboarding-consent                | 3         |
| —   | Laporan PDF 2 halaman                                         | report + job PDF                  | 10        |
| —   | Indikator tahap Kebutuhan → Analisis → Solusi → Laporan       | conversation state                | 4         |
| —   | Toast, keadaan error                                          | kode error                        | tiap fase |

Layar yang belum punya desain (OQ-21): login, register, register-gate + resume, seluruh back-office,
umpan balik jawaban, halaman privasi/ketentuan. Dibangun minimal dengan token yang sama dan dicatat
sebagai "needs design".

Dua catatan dari membaca board yang perlu diingat saat implementasi: board layar 14 sebenarnya adalah
pop-up tiga butir yang lebih sederhana, bukan wizard 5 langkah (OQ-24 — wizard yang dipakai); dan
board layar 03 mengajukan set pertanyaan klarifikasi yang berbeda dari prototipe (OQ-23 — keduanya
dilayani satu engine).

---

## 7. Mascot

Satu fungsi murni, mood diturunkan dari **state sistem**, tidak pernah dipilih LLM.

```ts
function moodFor(s: SystemState): Mood;
```

| Kondisi (dievaluasi berurutan)                                                     | Mood                                            |
| ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| error sistem sedang tampil                                                         | `fail` — sekali jalan, lalu diam di frame akhir |
| rate limited / koneksi putus / data tidak ada di katalog                           | `sorry`                                         |
| pesan tidak dipahami → klarifikasi                                                 | `confused`                                      |
| validasi teknis / di luar cakupan                                                  | `focus`                                         |
| perubahan besar setelah edit, atau skenario tak terduga                            | `surprised`                                     |
| tahap `UNDERSTANDING` / `ANALYZING_INSTALLATION`                                   | `think`                                         |
| tahap `MATCHING_PRODUCTS` / `COMPOSING` / `PREPARING_SCHEMATIC`, atau hitung ulang | `write`                                         |
| solusi siap, laporan terunduh                                                      | `happy`                                         |
| feedback diberikan, solusi disimpan, registrasi berhasil                           | `thanks`                                        |
| tips / kartu kriteria netral                                                       | `wink`                                          |
| loading ringan / tips perawatan                                                    | `drip`                                          |
| welcome diam ≥ 15 detik dengan composer kosong, atau offline                       | `sleep`                                         |
| menyapa pengguna terdaftar                                                         | `greet`                                         |
| daftar kosong (riwayat, solusi tersimpan, hasil pencarian)                         | `peek`                                          |
| selain itu                                                                         | `idle`                                          |

Dua aturan dari lembar mascot menjadi tes:

- `fail` **tidak pernah** untuk di luar cakupan (pakai `focus`) maupun data kurang (pakai `confused`).
  `fail` hanya untuk error sistem.
- `greet` dan `peek` berasal dari lembar mascot dan tidak ada di tabel SPEC §33f (OQ-30).

Implementasi: komponen `<Snouty mood="…" size={n} />` yang melapisi mata, gelembung pikiran, tetesan,
dan percikan ber-CSS di atas dua PNG (`snouty-base.png`, `snouty-pencil.png`) pada koordinat tetap di
ruang 1254px. Ukuran yang dipakai desain: 128 / 56 / 32 / 24; di bawah 32px diperlukan varian garis
lebih tebal.

Seni mascot saat ini adalah **placeholder** — `snouty-mascot.png` identik byte-per-byte dengan
gambar hasil ChatGPT di folder `uploads/`, dan tidak ada logo Pralon resmi di bundel (OQ-18).
Komponennya dibuat agar mudah diganti.

---

## 8. Laporan

Dua halaman A4, dirakit di server dari data Recommendation tersimpan, dirender ke PDF oleh Chromium
di worker. LLM tidak pernah dipanggil ulang saat pembuatan laporan.

Halaman 1: kop (nomor laporan, pelanggan, lokasi proyek, tanggal konsultasi, jenis instalasi) ·
RINGKASAN SOLUSI · KEBUTUHAN YANG TERCATAT · REKOMENDASI SISTEM dengan tag status · Asumsi yang
digunakan · footer "PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS".

Halaman 2: Estimasi Kebutuhan Material (+ biaya bila diaktifkan) · DASAR PERHITUNGAN · LANGKAH
BERIKUTNYA · blok "Disusun oleh" dan "Diperiksa oleh (opsional)" · versi katalog · footer yang sama.

Nomor laporan `SNTY-YYYY-MM-NNNN`, dialokasikan dari penghitung per bulan dengan unique constraint.
Kolom harga hanya bila `PRICING_ENABLED` (OQ-03); komponen laporan di desain sudah memparameterkan
tarif pajak (`taxRate`, default 11) dan blok tanda tangan (`showSignature`).

Keadaan gagal mengikuti lembar mascot: "Laporan gagal diunduh" → "Unduh ulang" / "Kirim ke email".

---

## 9. Aksesibilitas

Target WCAG 2.1 AA (SPEC §33i).

| Aspek       | Ketentuan                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| Kontras     | diverifikasi di kedua tema; yang paling berisiko: amber di latar krem (`#8A5300` pada `#FDF8EF`) dan tingkat teks muted |
| Keyboard    | seluruh alur bisa dijalankan tanpa tetikus; onboarding: → / Enter maju, ← mundur, Esc lewati                            |
| Fokus       | cincin fokus selalu terlihat, tidak pernah `outline: none` tanpa pengganti                                              |
| ARIA        | tab, drawer, modal, bottom sheet memakai peran yang benar                                                               |
| Focus trap  | di modal dan drawer, dengan fokus dikembalikan saat ditutup                                                             |
| Live region | jawaban streaming dan progres analisis diumumkan (`aria-live="polite"`)                                                 |
| Provenance  | tidak pernah hanya lewat warna — tag selalu memuat teks                                                                 |
| Gerak       | `prefers-reduced-motion` dihormati di semua animasi                                                                     |

Baris provenance layak ditegaskan: seluruh sistem kejujuran SNOUTY bersandar pada perbedaan hijau dan
amber. Bagi pengguna dengan buta warna merah-hijau, perbedaan itu hilang total — karenanya teks
"TERVERIFIKASI" / "ASUMSI" adalah pembawa makna utamanya, bukan pelengkap.

---

## 10. Salinan teks (copy)

Seluruh salinan UI dalam Bahasa Indonesia dan diambil **apa adanya** dari desain. Semuanya tinggal di
satu modul pesan yang siap i18n (`packages/ui/messages`), bukan tersebar sebagai literal di komponen.

Kalimat yang tidak boleh diparafrase karena membawa makna kebijakan:

- "PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS"
- "SKEMATIK · BUKAN GAMBAR KERJA"
- "Skema menunjukkan hubungan antar jalur, bukan posisi fisik pipa di bangunan."
- "SNOUTY hanya mencocokkan dengan katalog Pralon. Nilai yang tidak tersedia ditandai sebagai
  estimasi."
- "Saya tidak membandingkan merek lain…"
- "Data wilayah dipakai untuk analisis kebutuhan pasar, bukan untuk menentukan rekomendasi."
- "Perkiraan perencanaan, bukan penawaran resmi."
- "Balasan biasanya 1×24 jam kerja."

Kalimat-kalimat itu adalah kebijakan yang menyamar sebagai teks antarmuka. Mengubahnya berarti
mengubah janji produk.

---

## 12. Hasil audit aksesibilitas (Fase 13, P13-02)

Diperiksa terhadap kode, bukan diklaim.

**Dua temuan.**

1. **Cincin fokus tidak terpasang** di `solution.module.css` dan `schematic.module.css`, padahal
   keduanya punya elemen interaktif (tombol "Tampilkan detail teknis", "Perbaiki asumsi ini →", dan
   `<summary>` uraian teks). WCAG 2.1 AA mewajibkan indikator fokus yang terlihat. **Ditutup** dengan
   memakai token `--snouty-focus-ring` yang sudah ada — bukan nilai baru. Sidebar layar 02 juga ikut
   dilengkapi.

2. **`--snouty-caption` gagal AA pada ukuran pakainya** — 3,17:1 terhadap `surface`, dipakai pada
   10–12px. Dicatat sebagai **OQ-43** dengan usulan default, **tidak diubah sendiri**: token adalah
   sumber kebenaran visual, dan menggelapkannya tanpa desainer berarti merancang ulang (§1).

**Diperiksa dan bersih:**

- Kontras lain lulus AA: amber `#8A5300` 5,76–6,33:1 (yang paling dikhawatirkan ternyata aman), hijau
  terverifikasi 4,74:1, merek 6,76:1, muted 6,07:1.
- `prefers-reduced-motion` ada di setiap modul yang memang punya animasi (onboarding 6 animasi + guard;
  chat guard; `solution`/`schematic` tanpa animasi sehingga tidak perlu).
- Warna tidak pernah menjadi satu-satunya pembawa makna: `<ProvenanceTag>` selalu memuat teks, dan
  ketebalan garis skema (4/3/2 px) membawa makna sejajar dengan warnanya.
- Elemen tanpa teks terbaca punya `aria-label` (tombol tutup onboarding, titik progres, toggle panel);
  skema punya `role="img"` berlabel **dan** uraian teks terstruktur per lantai.
- Modal onboarding: `role="dialog"`, `aria-modal`, fokus masuk ke dialog, keyboard → / ← / Enter / Esc.

**Belum:** uji dengan pembaca layar sungguhan dan audit kedua tema di perangkat nyata — keduanya butuh
sesi manual, bukan pemeriksaan kode.
