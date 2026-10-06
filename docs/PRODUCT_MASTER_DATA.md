# Master Data Produk Pralon — bahan brainstorming

2026-10-06 · Menjawab OQ-07 (sumber katalog) dan menyiapkan OQ-06 (validasi aturan). Tujuan:
menyepakati **data apa yang Pralon kirim** supaya SNOUTY bisa merekomendasikan produk sungguhan,
bukan katalog contoh.

## 1. Mengapa master data menentukan

Hari ini mesin teknik sudah menghasilkan kebutuhan teknis yang spesifik — misalnya "pipa masuk
PVC AW 1½", pipa kuras PVC D 3"" atau "jalur utama HDPE 2½" PN 10, 350 m" — tetapi pencocokan
produk masih ke SKU `DEV-*`. Yang dibutuhkan bukan "daftar produk", melainkan data yang menjawab
empat pertanyaan matcher:

1. **Keluarga mana** yang cocok untuk peran ini (jalur utama bertekanan, distribusi, pembuangan, fitting)?
2. **Ukuran nominal mana** yang tersedia di keluarga itu, dan apa diameter luar/dalam sebenarnya?
3. **Kelas tekanan / kekakuan** mana yang memenuhi kebutuhan (AW vs D, PN 6–16, SN)?
4. **Fitting apa** yang sepadan dengan pipa terpilih (tee, elbow, reducer, socket, flens, valve)?

Tanpa #2 dan #3 engine memakai tabel diameter-dalam pendekatan (ENG-102), bertanda asumsi.

## 2. Model data yang sudah ada di SNOUTY (bisa diisi hari ini)

| Entitas                | Field                                                                                                                                                                         | Catatan                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `CatalogVersion`       | `label`, `sourceDocument`, `kind` (`pralon`), `effectiveFrom`, `importedBy`                                                                                                   | Satu versi aktif; laporan lama tetap menunjuk versi saat dibuat |
| `Product`              | `sku` (unik per versi), `name`, `family` (mis. "PVC AW"), `category` (caption), `description`, `status` (`active`/`discontinued`), `sourceDocument`, `sourcePage`, `imageUrl` | `family` dipakai matcher per peran — harus konsisten            |
| `ProductSize`          | `sizeLabel` kanonik (`½"`, `1¼"`, `2½"`, `3"`, `110 mm`?), `sizeInches×1000`, `available`                                                                                     | Hari ini inci; HDPE lazim dalam mm (OD) — perlu keputusan       |
| `ProductSpec`          | `specKey` (`material`, `standard`, `pressureClass`, `rodLength`, `jointType`, `application`, …), nilai + provenance `VERIFIED` (dengan dokumen + halaman) atau `UNAVAILABLE`  | Nilai kosong tidak pernah ditebak                               |
| `ProductCompatibility` | `productId` → `fittingProductId`, `kind` (`tee`/`elbow`/`reducer`/`socket`)                                                                                                   | Fitting sepadan dari tabel, bukan dari kesamaan ukuran          |
| `ProductDocument`      | judul, URL, halaman                                                                                                                                                           | Ditawarkan, tidak dibaca untuk menambal kolom                   |
| `ProductImage`         | URL, urutan                                                                                                                                                                   | Kosong → placeholder, bukan foto produk lain                    |

Format impor hari ini: **satu tabel per produk** (Excel/CSV), nilai jamak dipisah `;`, fitting
`SKU:jenis`, dokumen `Judul|URL|halaman`. Semua galat dilaporkan sekaligus; versi hanya dibuat bila 0 galat.

## 3. Yang masih kurang untuk mesin teknik (usulan perluasan)

| Kebutuhan engine                          | Field baru yang diusulkan                                                      | Dipakai oleh                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Diameter dalam nyata per ukuran dan kelas | `ProductSize.outerDiameterMm`, `wallThicknessMm` (→ ID dihitung)               | ENG-102/201/202 (kecepatan, gesek) menggantikan tabel pendekatan |
| Tekanan kerja nominal                     | `pressureRatingBar` per SKU/ukuran (AW ≈ 10 bar? D ≈ 5 bar? PN 6/8/10/12,5/16) | ENG-103/204: memilih kelas dari TDH                              |
| Kekakuan ring (pipa tanam/drainase)       | `ringStiffnessSn`                                                              | gorong-gorong, drainase tanam                                    |
| Panjang jual                              | `rodLengthM` (4 m, 6 m), HDPE gulungan `coilLengthM` (50/100 m)                | BOM: batang vs meter                                             |
| Metode sambung                            | `jointType` (solvent cement, rubber ring, butt fusion, electrofusion, ulir)    | fitting + BOM lem/alat                                           |
| Suhu dan fluida yang diizinkan            | `maxTemperatureC`, `fluids[]` (air bersih, limbah, air laut, …)                | kebijakan cakupan (air panas → PPR)                              |
| Standar                                   | `standard` (SNI 06-0084, ISO 4427, DIN 8077/8078, …)                           | kartu produk, laporan                                            |
| Peran yang disarankan Pralon              | `recommendedRoles[]` (main, branch, drain, riser, fitting)                     | matcher per peran, menggantikan pemetaan keluarga di kode        |
| Padanan antar-keluarga                    | `equivalentOf` (mis. HDPE 63 mm ≈ 2")                                          | jalur campuran HDPE ↔ PVC                                        |

Semua field baru mengikuti pola yang sama: nilai `VERIFIED` hanya bila ada dokumen sumber + halaman;
selain itu `UNAVAILABLE`.

## 4. Usulan struktur master data (untuk dibahas)

```
Family (keluarga)         PVC AW · PVC D · PVC C · HDPE PE100 · PPR · Fitting PVC · Fitting HDPE · Valve
  ├─ Series / class       AW (10 bar) · D (5 bar) · PN 6/8/10/12,5/16 · SDR 11/17 · SN 2/4/8
  │    └─ Size            nominal (inci/mm) · OD · tebal dinding · ID · panjang jual · berat
  │         └─ SKU        kode barang · nama · status · gambar · dokumen
  ├─ Spec (per family/series)   standar · material · sambungan · suhu maks · fluida · aplikasi
  └─ Compatibility        fitting ↔ pipa (per series + size), valve ↔ pipa, adaptor antar-keluarga
```

Pertanyaan desain: apakah SKU Pralon unik per (family, series, size) — satu baris per SKU — atau
satu kode untuk satu ukuran dengan varian kelas? Ini menentukan bentuk tabel impor.

## 5. Pengetahuan produk (bukan katalog) yang ikut dibutuhkan

| Jenis                                    | Contoh                                                              | Bentuk yang bisa langsung dipakai                                             |
| ---------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Pedoman pemilihan Pralon                 | "AW untuk jalur bertekanan pompa, D untuk gravitasi/pembuangan"     | Kalimat + rujukan dokumen → `pipe-knowledge.ts` dan asumsi registry           |
| Tabel teknis                             | tekanan kerja vs suhu, kehilangan tekanan per meter, diameter dalam | Tabel per family/series → field §3                                            |
| Panduan pemasangan                       | lem, waktu kering, kedalaman tanam, jarak penyangga                 | FAQ terstruktur + BOM aksesori                                                |
| Kriteria perencanaan yang dipakai Pralon | debit per hektar, kecepatan rencana, faktor serentak                | **Mengganti nilai di registry asumsi** (ID tetap, nilai + rujukan diperbarui) |
| Brosur/katalog PDF                       | Katalog produk 2026                                                 | `sourceDocument` + halaman untuk sitasi                                       |

## 6. Pertanyaan untuk Pralon (bahan brainstorming)

1. Dari mana data produk resmi hari ini — ERP, Excel pricelist, katalog PDF, situs web? Siapa pemiliknya
   dan seberapa sering berubah?
2. Apakah tiap SKU sudah membawa OD, tebal dinding, kelas tekanan, dan standar? Kalau tidak, dokumen
   mana yang memuatnya (halaman)?
3. Konvensi ukuran: inci untuk PVC, mm untuk HDPE — atau keduanya? Bagaimana menulis 1¼" di sistem Pralon?
4. Keluarga mana saja yang ingin direkomendasikan lewat SNOUTY (PVC AW/D/C, HDPE, PPR, fitting, valve)?
   Ada yang sengaja dikecualikan (produk proyek, OEM)?
5. Produk `discontinued`: perlu tampil untuk pengguna yang sudah punya pipa lama?
6. Tabel kompatibilitas fitting: ada daftar resmi, atau cukup aturan "fitting AW ukuran sama"?
7. Siapa yang memvalidasi 29 aturan teknik dan 20+ asumsi (debit irigasi 1,5 l/s/ha, kecepatan 1,5 m/s,
   tinggi lantai 3,5 m, tinggi air kolam 1 m, …)? Lewat spreadsheet tanda tangan, atau layar back-office?
8. Harga: masuk cakupan atau tidak? Bila ya, dari daftar harga distributor mana dan berapa sering berubah?
9. Gambar produk dan dokumen teknis boleh dihosting di SNOUTY, atau harus ditautkan ke situs Pralon?
10. Siklus rilis katalog: per tahun, per perubahan, atau ad hoc? (Menentukan proses promosi versi.)

## 7. Usulan langkah

1. Pralon mengirim satu sampel nyata (10–20 SKU lintas keluarga) dalam format apa pun → kami buat
   adapter impor dan laporan galat dari sampel itu.
2. Sepakati kamus `family`/`series`/`size` (§4) dan konvensi ukuran.
3. Impor penuh sebagai versi `draft` `kind = pralon`, ditinjau di back-office, dipromosikan.
4. Sesi validasi aturan + asumsi dengan ahli Pralon; nilai registry diperbarui dengan rujukan.
5. Jalankan evaluasi otomatis ulang (golden dataset) sebelum katalog Pralon dipakai di produksi.
