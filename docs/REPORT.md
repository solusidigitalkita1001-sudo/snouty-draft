# SNOUTY — Laporan

Fase 0c · P0c-06 · Terakhir diperbarui 2026-09-30

Laporan Rekomendasi & Estimasi Material — A4: sampul merah-putih (logo Pralon, maskot SNOUTY) lalu bagian
(ringkasan solusi dengan tabel ukuran dan material, rekomendasi sistem, estimasi material bila harga aktif, dasar
perhitungan berupa rumus & pengesahan); tata letak
mengikuti templat rapor yang dipilih pemilik 2026-10-12 (P16-57), awalnya SPEC §33g dan
`SNOUTY Laporan Rekomendasi.dc.html`. Nomor halaman dicetak footer Chromium.

---

## 1. Prinsip

**Laporan dirakit dari data Recommendation yang tersimpan. LLM tidak pernah dipanggil ulang.**

Konsekuensinya: laporan yang sama dibuat dua kali menghasilkan isi yang identik, dan laporan yang
dibuat hari ini tetap bisa dibaca sama persis tahun depan meski katalog dan aturan sudah berubah.
Itu sebabnya `Recommendation` membekukan `catalogVersionId` dan menyalin nilai yang ditampilkan.

Laporan adalah dokumen yang dibawa pengguna ke toko atau distributor. Ia harus bisa
dipertanggungjawabkan, bukan hanya enak dibaca.

---

## 2. Struktur

> **Berlaku sejak 2026-10-13 (DD-01, P17-09):** laporan mengikuti layar solusi v2 — sampul; **Ringkasan**
> bergambar (gambar bangunan + data bangunan, kartu kebutuhan, alur air, ukuran pipa per jalur, kebutuhan
> tercatat); **Skema** (bila ada); **Daftar Kebutuhan Material (BOQ)** per sistem lalu pipa/fitting, dengan
> gambar produk kecil, baris tanpa jumlah tetap tercantum; **Dasar Perhitungan & Asumsi** (jumlah material:
> cara hitung · hitungan · hasil; ukuran pipa: alasan per jalur; asumsi per kategori; legenda status);
> **Produk Pralon** (lampiran kartu produk bergambar, jumlah + nomor baris BOQ); estimasi harga hanya bila
> harga aktif; **Langkah Hitung & Pengesahan**. BOQ dan produk diturunkan dari `boqFrom` yang sama
> dengan layar; gambar dari `@snouty/ui` (sprite ilustrasi, `needs-view`, `product-visual`). Foto
> produk disisipkan sebagai latar CSS, sehingga laporan tetap tanpa tag `<img>`. Payload lama (tanpa
> `products`/`needs`) tetap tercetak. Tabel halaman 1–2 di bawah adalah struktur awal (Fase 8).

### Halaman 1

| Blok                    | Isi                                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Kop                     | SNOUTY · PRALON PIPE SOLUTION ASSISTANT · "Laporan Rekomendasi & Estimasi Material" · `NO. SNTY-YYYY-MM-NNNN · HAL. 1 DARI 2` |
| Identitas               | Pelanggan · Lokasi proyek · Tanggal konsultasi · Jenis instalasi                                                              |
| RINGKASAN SOLUSI        | headline + paragraf penjelas dari `Recommendation`                                                                            |
| KEBUTUHAN YANG TERCATAT | tipe bangunan, jumlah lantai, sumber air, kamar mandi, wastafel, dapur                                                        |
| REKOMENDASI SISTEM      | tabel JALUR / UKURAN / ALASAN / **STATUS**                                                                                    |
| Asumsi yang digunakan   | daftar dari `Assumption`                                                                                                      |
| Footer                  | SNOUTY · ASISTEN SOLUSI PERPIPAAN PRALON — **PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS**                                 |

Kolom STATUS memuat TERVERIFIKASI / ASUMSI dan tunduk pada aturan provenance yang sama seperti di
layar. Karena semua aturan teknik masih `REQUIRES_DOMAIN_VALIDATION` (OQ-06), laporan hari ini akan
menampilkan ASUMSI di keempat baris — sementara mockup menampilkan tiga TERVERIFIKASI.

### Halaman 2

| Blok               | Isi                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Kop                | "Estimasi Kebutuhan Material & Biaya" · `HAL. 2 DARI 2`                                                             |
| Banner ESTIMASI    | "Perkiraan perencanaan, bukan penawaran resmi. Harga final mengikuti daftar harga distributor Pralon yang berlaku." |
| Tabel material     | MATERIAL / UKURAN / QTY (+ HARGA SATUAN / SUBTOTAL bila harga aktif)                                                |
| Total              | Subtotal material · PPN _n_% · Total estimasi — **hanya bila harga aktif**                                          |
| Catatan            | "Belum termasuk jasa instalasi, aksesori non-pipa, dan pengiriman."                                                 |
| DASAR PERHITUNGAN  | dirakit dari `CalculationTrace`, bukan prosa LLM                                                                    |
| LANGKAH BERIKUTNYA | "Bawa laporan ini ke toko atau distributor Pralon untuk penawaran resmi…"                                           |
| Blok tanda tangan  | "Disusun oleh: SNOUTY" + versi katalog · "Diperiksa oleh (opsional): Instalatur / Tim Teknis Pralon"                |
| Footer             | `REF. KONSULTASI SNTY-…` — **PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS**                                       |

Blok "Diperiksa oleh (opsional)" adalah detail desain yang bagus dan perlu dipertahankan: ia memberi
tempat bagi manusia untuk mengambil tanggung jawab yang memang tidak bisa diambil SNOUTY.

---

## 3. Nomor laporan

Format dari desain: **`SNTY-YYYY-MM-NNNN`** (contoh `SNTY-2026-09-0148`).

Alokasi dari tabel penghitung per bulan dengan unique constraint:

```sql
report_number_counters(year_month CHAR(7) PRIMARY KEY, last_seq INT NOT NULL)
```

Penambahan dilakukan dalam transaksi dengan `SELECT … FOR UPDATE`, sehingga dua permintaan bersamaan
tidak pernah mendapat nomor yang sama. Nomor dialokasikan **saat `Report` dibuat**, bukan saat PDF
selesai — supaya nomor yang muncul di UI tetap sama meski pembuatan PDF gagal lalu diulang.

Nomor tidak pernah dipakai ulang, bahkan bila laporannya gagal.

---

## 4. Harga

Hanya bila `PRICING_ENABLED=true` (OQ-03; default **nonaktif**).

| Aktif                                | Nonaktif                                 |
| ------------------------------------ | ---------------------------------------- |
| Kolom HARGA SATUAN + SUBTOTAL tampil | kolom tidak dirender                     |
| Blok total + PPN tampil              | blok tidak dirender                      |
| Banner ESTIMASI tampil               | banner tetap tampil, tanpa kalimat harga |

Harga berasal dari tabel `price_list_items` berversi, tidak pernah hardcoded dan tidak pernah dari
LLM. Tarif pajak dari `TAX_RATE_PERCENT` (11 saat ini). Komponen laporan di desain sudah
memparameterkan keduanya (`taxRate`, `showSignature`), jadi ini sejalan dengan rancangan aslinya.

Label wajib saat harga aktif: **"Perkiraan perencanaan, bukan penawaran resmi."**

---

## 5. Pembuatan PDF

```
POST /reports ──► Report (PENDING) + nomor dialokasikan ──► antrean report.generate
                                                                    │
                                    worker: Chromium ──► /internal/report/:id/print ──► PDF
                                                                    │
                                              Report (READY) + fileRef ──► UI polling / notifikasi
```

| Aspek       | Ketentuan                                                              |
| ----------- | ---------------------------------------------------------------------- |
| Renderer    | Playwright + headless Chromium di `apps/worker`                        |
| Halaman     | dirender server-side dari data tersimpan; token layanan worker (OQ-49) |
| Format      | A4, margin dari CSS `@page`                                            |
| Idempotensi | kunci `reportId` — job diulang tidak membuat dua berkas                |
| Timeout     | 60 detik, lalu `FAILED`                                                |
| Retensi     | 12 bulan (`PRIVACY.md`)                                                |

**Mengapa Chromium, bukan pustaka PDF.** Laporannya sudah ada sebagai dokumen HTML/CSS yang presisi.
Membangunnya ulang dengan pdfkit atau react-pdf berarti memelihara dua model tata letak yang akan
saling menyimpang dalam hitungan bulan. Chromium mencetak CSS yang sudah ditulis.

Chromium hanya ada di image worker, sehingga image API tetap kecil.

---

## 6. Kegagalan

Mengikuti lembar mascot:

> **Laporan gagal diunduh** — "File PDF belum berhasil dibuat. Coba unduh ulang, atau kirim laporan ke
> email Anda." → tombol **Unduh ulang** / **Kirim ke email**

Mood mascot `fail` (ini benar-benar error sistem), diputar sekali lalu diam di frame akhir.

Karena nomor laporan sudah dialokasikan dan data rekomendasi sudah tersimpan, percobaan ulang tidak
memerlukan apa pun dari pengguna.

---

## 7. Akses

| Peran              | Akses                                      |
| ------------------ | ------------------------------------------ |
| Pemilik konsultasi | unduh, kirim ke email                      |
| `technical_team`   | baca, pada kasus yang di-handoff kepadanya |
| `admin`            | baca, teraudit                             |
| Lainnya            | tidak ada                                  |

Laporan memuat data pribadi — nama pelanggan dan lokasi proyek — sehingga kontrol akses adalah
kewajiban UU PDP, bukan sekadar kerapian (invarian RP-2). Setiap unduhan oleh peran internal menulis
`audit_logs`.

Tautan unduhan bertanda tangan dan berumur pendek; tidak ada URL berkas yang bisa ditebak.

_Status 2026-10-05:_ unduhan pemilik lewat `GET /reports/:id/download` **berbasis sesi** — kepemilikan
diperiksa layanan, jalur berkas dipastikan di dalam `STORAGE_PATH`. Tautan bertanda tangan (untuk
dibagikan atau dikirim email) belum ada; ia datang bersama `POST /reports/:id/email`.

---

## 8. Pratinjau di layar

Prototipe membuka **overlay pratinjau** lebih dulu ("Buat laporan"), berisi banner ESTIMASI,
ringkasan, tabel material, total, lalu footer dengan "Kirim ke email" dan "Unduh PDF". Board layar 06
langsung menampilkan "Unduh PDF" di header (OQ-26).

Yang dipakai: **alur prototipe**. Selain peringkat sumber kebenarannya lebih tinggi, alur ini juga
lebih jujur secara teknis — pembuatan PDF adalah job asinkron yang bisa gagal, jadi lebih baik
pengguna melihat isinya lebih dulu daripada menekan "Unduh" dan menunggu sesuatu yang mungkin tidak
datang.

---

## 9. "Unduh ringkasan kebutuhan"

Layar 11 (validasi teknis) menawarkan unduhan berbeda: bukan laporan rekomendasi, melainkan
**ringkasan kebutuhan** — isi blok "YANG SUDAH SAYA CATAT" — untuk dibawa ke tim teknis.

Dokumen satu halaman, dibangkitkan dari `RequirementSnapshot`, tanpa rekomendasi karena memang belum
ada. Ini yang mewujudkan janji "tidak perlu menjelaskan ulang".

---

## 10. Pengujian

| #   | Tes                                                                          |
| --- | ---------------------------------------------------------------------------- |
| 1   | Laporan dirakit tanpa satu pun panggilan LLM (invarian RP-1)                 |
| 2   | Membuat laporan dua kali dari rekomendasi yang sama menghasilkan isi identik |
| 3   | Nomor laporan unik di bawah 50 permintaan bersamaan                          |
| 4   | Nomor tidak dipakai ulang setelah kegagalan                                  |
| 5   | `PRICING_ENABLED=false` → tidak ada kolom atau total harga                   |
| 6   | Tag status mencerminkan provenance nyata, bukan nilai tetap                  |
| 7   | Non-pemilik mendapat 403                                                     |
| 8   | Unduhan oleh peran internal menulis audit log                                |
| 9   | Kegagalan menghasilkan `FAILED` + kartu "Unduh ulang" / "Kirim ke email"     |
| 10  | "PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS" ada di sampul dan penutup   |

---

## 11. Status implementasi (Fase 8)

| Bagian                          | Berkas                                                      |
| ------------------------------- | ----------------------------------------------------------- |
| Tabel + penghitung nomor        | migration 0009, `schema/recommendation.ts`                  |
| Format & alokasi nomor          | `modules/report/domain/report-number.ts`, repo MySQL        |
| Perakit payload (nol LLM)       | `modules/report/application/report-assembler.ts`            |
| Halaman cetak A4                | `modules/report/application/report-html.ts`                 |
| Rute publik                     | `modules/report/presentation/report.controller.ts`          |
| Rute cetak internal (digerbang) | `modules/report/presentation/internal-report.controller.ts` |

Alokasi nomor **menyisipkan baris penghitung lebih dulu, baru menguncinya**: `SELECT … FOR UPDATE`
atas baris yang belum ada hanya mengunci gap, sehingga dua permintaan pertama di bulan baru akan
lolos berdua. Diuji dengan empat alokasi serentak terhadap MySQL nyata.

**Catatan keamanan yang perlu diingat.** Rute cetak semula hidup di controller yang sama dengan rute
publik. Karena `InternalRoleGuard` dipasang **per controller**, rute itu berjalan tanpa gerbang dan
mengembalikan HTTP 200 berisi nama pelanggan dan lokasi proyek kepada siapa pun yang menebak id
laporan — pelanggaran invarian RP-2. Ketangkap saat verifikasi live, bukan oleh tes. Sekarang ia
controller terpisah, dan lima tes regresi menjaga dekoratornya tetap di tempatnya.

Palet cetak harus literal (Chromium merender dokumen mandiri tanpa pipeline CSS), jadi ia konstanta
bernama-token yang **diikat tes** ke `packages/ui/src/tokens.css`: perubahan token yang lupa
dicerminkan menggagalkan tes alih-alih menghasilkan laporan berwarna lain.

**Token worker (2026-10-06, OQ-49):** worker memanggil `/internal/reports/*` dengan
`Bearer $WORKER_INTERNAL_TOKEN`; `WorkerTokenMiddleware` (hanya pada controller itu) membandingkannya
waktu-tetap dan mengisi aktor `worker` berperan `admin`, sehingga gerbang peran yang sama tetap
memutuskan dan audit mencatat `worker`. Tanpa variabel itu di env API, rutenya tetap tertutup dan PDF
tidak dibuat. "Unduh ringkasan kebutuhan" (§9) memakai jalur yang sama. Harga (§4) menunggu OQ-03;
`PRICING_ENABLED` sudah ada dan baku nonaktif.
