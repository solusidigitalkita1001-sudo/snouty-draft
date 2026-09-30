# SNOUTY — Laporan

Fase 0c · P0c-06 · Terakhir diperbarui 2026-09-30

Laporan Rekomendasi & Estimasi Material — dua halaman A4. Sumbernya SPEC §33g dan
`SNOUTY Laporan Rekomendasi.dc.html`.

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

### Halaman 1

| Blok | Isi |
|---|---|
| Kop | SNOUTY · PRALON PIPE SOLUTION ASSISTANT · "Laporan Rekomendasi & Estimasi Material" · `NO. SNTY-YYYY-MM-NNNN · HAL. 1 DARI 2` |
| Identitas | Pelanggan · Lokasi proyek · Tanggal konsultasi · Jenis instalasi |
| RINGKASAN SOLUSI | headline + paragraf penjelas dari `Recommendation` |
| KEBUTUHAN YANG TERCATAT | tipe bangunan, jumlah lantai, sumber air, kamar mandi, wastafel, dapur |
| REKOMENDASI SISTEM | tabel JALUR / UKURAN / ALASAN / **STATUS** |
| Asumsi yang digunakan | daftar dari `Assumption` |
| Footer | SNOUTY · ASISTEN SOLUSI PERPIPAAN PRALON — **PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS** |

Kolom STATUS memuat TERVERIFIKASI / ASUMSI dan tunduk pada aturan provenance yang sama seperti di
layar. Karena semua aturan teknik masih `REQUIRES_DOMAIN_VALIDATION` (OQ-06), laporan hari ini akan
menampilkan ASUMSI di keempat baris — sementara mockup menampilkan tiga TERVERIFIKASI.

### Halaman 2

| Blok | Isi |
|---|---|
| Kop | "Estimasi Kebutuhan Material & Biaya" · `HAL. 2 DARI 2` |
| Banner ESTIMASI | "Perkiraan perencanaan, bukan penawaran resmi. Harga final mengikuti daftar harga distributor Pralon yang berlaku." |
| Tabel material | MATERIAL / UKURAN / QTY (+ HARGA SATUAN / SUBTOTAL bila harga aktif) |
| Total | Subtotal material · PPN *n*% · Total estimasi — **hanya bila harga aktif** |
| Catatan | "Belum termasuk jasa instalasi, aksesori non-pipa, dan pengiriman." |
| DASAR PERHITUNGAN | dirakit dari `CalculationTrace`, bukan prosa LLM |
| LANGKAH BERIKUTNYA | "Bawa laporan ini ke toko atau distributor Pralon untuk penawaran resmi…" |
| Blok tanda tangan | "Disusun oleh: SNOUTY" + versi katalog · "Diperiksa oleh (opsional): Instalatur / Tim Teknis Pralon" |
| Footer | `REF. KONSULTASI SNTY-…` — **PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS** |

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

| Aktif | Nonaktif |
|---|---|
| Kolom HARGA SATUAN + SUBTOTAL tampil | kolom tidak dirender |
| Blok total + PPN tampil | blok tidak dirender |
| Banner ESTIMASI tampil | banner tetap tampil, tanpa kalimat harga |

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

| Aspek | Ketentuan |
|---|---|
| Renderer | Playwright + headless Chromium di `apps/worker` |
| Halaman | dirender server-side dari data tersimpan; token bertanda tangan berumur pendek |
| Format | A4, margin dari CSS `@page` |
| Idempotensi | kunci `reportId` — job diulang tidak membuat dua berkas |
| Timeout | 60 detik, lalu `FAILED` |
| Retensi | 12 bulan (`PRIVACY.md`) |

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

| Peran | Akses |
|---|---|
| Pemilik konsultasi | unduh, kirim ke email |
| `technical_team` | baca, pada kasus yang di-handoff kepadanya |
| `admin` | baca, teraudit |
| Lainnya | tidak ada |

Laporan memuat data pribadi — nama pelanggan dan lokasi proyek — sehingga kontrol akses adalah
kewajiban UU PDP, bukan sekadar kerapian (invarian RP-2). Setiap unduhan oleh peran internal menulis
`audit_logs`.

Tautan unduhan bertanda tangan dan berumur pendek; tidak ada URL berkas yang bisa ditebak.

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

| # | Tes |
|---|---|
| 1 | Laporan dirakit tanpa satu pun panggilan LLM (invarian RP-1) |
| 2 | Membuat laporan dua kali dari rekomendasi yang sama menghasilkan isi identik |
| 3 | Nomor laporan unik di bawah 50 permintaan bersamaan |
| 4 | Nomor tidak dipakai ulang setelah kegagalan |
| 5 | `PRICING_ENABLED=false` → tidak ada kolom atau total harga |
| 6 | Tag status mencerminkan provenance nyata, bukan nilai tetap |
| 7 | Non-pemilik mendapat 403 |
| 8 | Unduhan oleh peran internal menulis audit log |
| 9 | Kegagalan menghasilkan `FAILED` + kartu "Unduh ulang" / "Kirim ke email" |
| 10 | Footer "PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS" ada di kedua halaman |
