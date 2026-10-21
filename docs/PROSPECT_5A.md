# SNOUTY — Prospek 5A dan Penugasan Sales

Fase 26 · P26-01 · Dibuat 2026-10-21 · **Konsep — keputusan OQ-76 lengkap**

SNOUTY membantu pengguna, dan di sisi Pralon menunjukkan siapa yang berpotensi membeli. Kerangkanya
5A (Aware → Appeal → Ask → Act → Advocate). Admin menugaskan prospek ke sales, dan sales menerima
ringkasan percakapan pengguna dengan SNOUTY.

Keputusan pemilik yang membentuk dokumen ini (2026-10-21, AskUserQuestion): papan prospek **hanya untuk
pengguna terdaftar**; lokasi dari **IP → kota, ditambah izin browser**; papan dipakai **sales + admin**,
dan kontak lewat jalur handoff; **dokumen dulu**, baru dibangun.

---

## 1. Dua lapis, dua aturan

| Lapis         | Siapa                    | Identitas                                | Dipakai untuk                             |
| ------------- | ------------------------ | ---------------------------------------- | ----------------------------------------- |
| Agregat pasar | semua (tamu + terdaftar) | **tidak ada** (`MARKET_INTELLIGENCE.md`) | permintaan per kota, minat produk, corong |
| Prospek 5A    | **hanya akun terdaftar** | ada — akun pengguna                      | papan prospek, penugasan, ringkasan sales |

- Tamu **tidak pernah** muncul per orang di admin. Ia hanya menjadi angka di agregat. Bila tamu
  mendaftar, percakapannya ikut pindah ke akun (linker tamu → akun yang sudah ada), dan sejak itu ia
  masuk papan prospek.
- Skor prospek **tidak pernah** memengaruhi rekomendasi, sama dengan lokasi. Modul `recommendation` dan
  `engineering` dilarang mengimpor modul prospek (`ARCHITECTURE.md` §7).
- Pencatatan sinyal **asinkron** (RabbitMQ), sama dengan market intelligence: papan mati, chat tetap jalan.

---

## 2. Tahap 5A dari sinyal yang nyata

Tahap = tahap tertinggi yang pernah dicapai pengguna, ditampilkan bersama waktu sinyal terakhirnya.
Pemetaannya aturan di kode (tabel di bawah), bukan tebakan model.

| Tahap        | Sinyal                                                                                                                                | Sudah tersimpan?                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Aware**    | akun dibuat; percakapan pertama; hanya tanya umum (perusahaan, pengetahuan pipa)                                                      | ya (`users`, `conversations`)                 |
| **Appeal**   | tanya/bandingkan produk Pralon (`product_spec`, `product_comparison`, `competitor_question`); buka detail produk; sematkan percakapan | **intent dan buka produk belum disimpan**     |
| **Ask**      | kebutuhan proyek dijawab; analisis dijalankan (`recommendations`); tanya harga (`price_question`)                                     | analisis ya; intent belum                     |
| **Act**      | laporan dibuat/diunduh; **minta dihubungi / minta penawaran**                                                                         | laporan dibuat ya; unduh & minta kontak belum |
| **Advocate** | membagikan tautan solusi; tautannya dibuka orang lain; kembali dengan proyek baru; rating positif                                     | bagikan ya; kunjungan & rating belum          |

### Instrumentasi yang perlu ditambah

1. **Label intent per pesan.** Kolom `messages.intent` (label `FINE_INTENTS` yang sudah dihitung
   pemahaman). Tanpa teks tambahan, hanya label.
2. **Buka detail produk** (`GET products/:id` saat pengguna terdaftar). Hanya keluarga + ukuran.
3. **Unduh laporan** (`GET reports/:id/download`).
4. **Kunjungan tautan bagikan** (`GET shared/:token`): hitungan, bukan identitas pengunjung.
5. **Aktivitas terakhir.** `users.last_seen_at` hari ini hanya diperbarui saat login.
6. **Minta dihubungi.** Handoff jenis baru `sales` (lihat §4). Handoff teknis yang ada tetap terpisah.
7. **Rating** (Advocate). Tabel `feedback` memang belum ada; menyusul, tidak menghalangi tahap lain.

Semua sinyal masuk satu tabel `prospect_signals` (`user_id`, `kind`, `stage`, `conversation_id`,
`occurred_at`, `meta` json kecil tanpa teks bebas), ditulis konsumer antrean `prospect.signal`.

---

## 3. Prioritas: panas, hangat, dingin

Tahap saja tidak cukup: rumah 1 lantai di tahap Act lebih kecil daripada perumahan 80 unit di tahap Ask.
Usulan awal (dikalibrasi ulang dari hasil penugasan, §5):

```
nilai = bobot_tahap × bobot_skala × peluruhan_waktu
bobot_tahap    : Aware 1 · Appeal 2 · Ask 4 · Act 6 · Advocate 5
bobot_skala    : dari RequirementState/kasus — rumah 1 · ruko/kos/gedung 2 · kawasan/SPAM/sewerage 4
peluruhan      : 0,5 ^ (hari sejak sinyal terakhir / 14)
panas ≥ 12 · hangat ≥ 4 · selebihnya dingin
```

Advocate sedikit di bawah Act karena ia sinyal loyalitas, bukan pembelian yang sedang berjalan. Angka di
atas aturan bisnis yang hidup di kode (`prospect/domain`) dan diuji. Tidak ada model yang memberi skor.

---

## 4. Alur admin → sales

```
papan prospek (admin, sales_reviewer)
   │  filter: tahap, prioritas, kota, jenis proyek, belum ditugaskan
   ▼
admin menugaskan → sales_leads (user_id, assigned_to, status, catatan)
   │  ringkasan dibangkitkan SEKALI saat penugasan (dan saat sales minta segarkan)
   ▼
layar sales: hanya prospek miliknya
   status: baru → dihubungi → penawaran → menang / kalah (+ alasan)
```

- Peran baru **`sales`**: hanya melihat prospek yang ditugaskan kepadanya (minimalisasi data).
  `admin` dan `sales_reviewer` melihat semua.
- Penugasan, perubahan status, dan pembukaan ringkasan/transkrip dicatat di `audit_logs`.

### Ringkasan untuk sales

| Bagian               | Sumber                                                                  | Model? |
| -------------------- | ----------------------------------------------------------------------- | ------ |
| Identitas & kontak   | `users` (nama, email, telepon)                                          | tidak  |
| Tahap 5A & prioritas | `prospect_signals`                                                      | tidak  |
| Proyek               | `RequirementState` terakhir per percakapan: jenis, skala, lokasi proyek | tidak  |
| Hasil hitungan & BOM | `recommendations`: ukuran utama, produk, jumlah                         | tidak  |
| Laporan & tautan     | `reports`, `share_links`                                                | tidak  |
| Paragraf konteks     | model merangkum data di atas + kutipan pesan pengguna                   | **ya** |
| Transkrip lengkap    | tautan ke percakapan                                                    | tidak  |

Paragraf model hanya konteks ("sedang renovasi rumah 2 lantai, ragu AW atau D, sempat tanya harga").
Angka teknis dan produk di layar sales selalu dari baris terstruktur, bukan dari paragraf itu. Bila
model gagal, ringkasan tetap tampil tanpa paragraf. Tidak dibangkitkan per pesan: hanya saat penugasan.

---

## 5. Umpan balik

Status akhir (menang/kalah) per prospek dipakai untuk mengecek apakah prioritas benar: proporsi menang per
tingkat prioritas tampil di papan. Bobot §3 diubah dari data itu, lewat perubahan kode yang diuji.

---

## 6. Lokasi

- **Kota pengunjung**: dari IP (DB-IP Lite offline di server, CC BY 4.0 dengan atribusi di halaman privasi, tanpa API luar per permintaan), lalu
  diganti kota dari izin browser bila diberikan. Yang disimpan hanya nama kota/kabupaten; IP dan
  koordinat tidak pernah disimpan untuk keperluan ini. Untuk tamu, kota hanya masuk agregat pasar.
- **Lokasi proyek** (yang disebut di percakapan, mis. "proyek di Cikarang") dicatat di ringkasan prospek
  bila pengguna terdaftar menyebutnya.
- Geo-IP di Indonesia sering meleset ke kota ISP (mis. Jakarta). Papan menandainya "perkiraan" dan
  mendahulukan kota dari browser.

---

## 7. Privasi (UU PDP No. 27/2022)

- Pengguna terdaftar diberi tahu **saat mendaftar** bahwa konsultasinya dapat ditindaklanjuti tim sales
  Pralon, dan kebijakan privasi diperbarui (`PRIVACY.md`). Teks onboarding langkah 4 tentang wilayah ikut
  disesuaikan.
- Kontak oleh sales (OQ-76): **opt-in** "boleh dihubungi tim Pralon" saat daftar, bisa dicabut di profil
  (consent baru `SALES_CONTACT`); tanpa opt-in, sales hanya menghubungi bila pengguna menekan "minta dihubungi".
- Pengguna yang menghapus akun: `prospect_signals` dan `sales_leads` ikut dihapus; agregat anonim tetap.
- Retensi sinyal mengikuti retensi percakapan (`PRIVACY.md` §6).

---

## 8. Layar

Belum ada desain Claude Design untuk back-office (OQ-21). Papan prospek, layar penugasan, dan layar
sales dibangun dengan token yang ada sampai desain tersedia, tanpa label internal (nama aturan, ID).

---

## 9. Urutan kerja yang diusulkan

| Item   | Isi                                                                                        |
| ------ | ------------------------------------------------------------------------------------------ |
| P26-02 | Instrumentasi: `messages.intent`, `prospect_signals`, konsumer antrean, aktivitas terakhir |
| P26-03 | Aturan tahap 5A + prioritas (domain murni + tes)                                           |
| P26-04 | Handoff `sales` ("minta dihubungi") di chat + pemberitahuan saat daftar + PRIVACY          |
| P26-05 | Papan prospek admin (`/internal/prospects`) + penugasan + peran `sales`                    |
| P26-06 | Ringkasan sales (terstruktur + paragraf model) + layar sales + status                      |
| P26-07 | Geo-IP → kota (agregat + prospek) dan penulis `market_events` yang selama ini kosong       |
