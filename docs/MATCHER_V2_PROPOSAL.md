# Usulan Matcher v2 — mencocokkan kebutuhan teknis ke katalog Pralon asli

2026-10-06 · Status: usulan, **tanpa implementasi** · Terkait: `PRODUCT_MASTER_DATA.md`,
`PRODUCT_MASTER_DATA_SCHEMA.md`, `PIPE_SIZE_MM_EXTENSION.md`, OQ-48.

Dasar angka: versi draft `erp-2026-10-06` (2.644 produk inci) di MySQL lokal, dan dry-run gabungan
inci + mm (7.680 baris diterima). Matcher hari ini (`product-matcher.ts`): per peran
`{ role, size, family, categoryIncludes? }` → produk pertama di keluarga itu yang `sizes` memuat
ukurannya → `VERIFIED_SELECTED`; ada keluarga tetapi ukuran tidak ada → `SIZE_NEEDS_VALIDATION`
(produk pertama ditampilkan); keluarga tidak ada → peran tidak terisi.

## 1. Kandidat ganda: satu (family, ukuran) = belasan SKU

**Temuan.** Di katalog asli, satu kombinasi keluarga + ukuran pipa punya **rata-rata 11,1 SKU
(maks. 21; 60 kombinasi)**. PVC AW ½" saja ada 19 SKU: ujung Plain/TS, warna Abu/Putih, panjang
1/2/4/5,1/5,8/6 m, dan varian merek (PIPPO, PIPPO150). Matcher hari ini mengambil **produk pertama
yang cocok** — urutan hasil query — jadi kartu yang tampil tidak deterministik secara makna
(bisa "Pipa Abu AW ½" × 1 Meter") dan tidak bisa dijelaskan lewat trace.

**Usulan: dua lapis, deterministik, ber-trace.**

1. **Himpun** semua SKU yang cocok (family + ukuran + status active) → `candidates[]` disimpan di
   `SelectedProduct` (field baru `alternatives: { productId, name, reason }[]`, ≤ 10), bukan
   dibuang. Kartu produk menampilkan satu, drawer menampilkan semuanya.
2. **Pilih** satu dengan urutan kriteria tetap, setiap kriteria dicatat di `reason`:
   1. **Panjang batang sesuai BOM**: engine sudah menghitung batang 4 m (ENG-010/105/304); pilih
      `rod_length = 4 m` bila ada, lalu 5,8 m, lalu 6 m — selisih panjang mengubah kuantitas BOM,
      jadi ini kriteria teknis, bukan selera. BOM lalu dihitung ulang dari `rod_length` SKU terpilih.
   2. **Ujung/sambungan sesuai aturan**: ENG-012 memakai solvent cement → `joint_type` "Plain end"
      untuk pipa yang disambung socket; "TS end" (bell/rubber ring) untuk PVC D jalur buang bila
      aturan menyebutnya. Bila aturan tidak menyebut, **tidak memilih** berdasarkan ujung.
   3. **Varian merek/warna**: tidak pernah jadi kriteria otomatis — ini preferensi pengguna/stok.
      Pilih varian baku (tanpa sufiks merek) bila ada, dan simpan sisanya sebagai alternatif.
   4. **Sisa seri**: urut `sku` naik — deterministik, dan dicatat sebagai "pilihan pertama abjad".

   Semua kriteria 1–4 adalah fungsi murni atas `ValidatedCatalogRow`/`Product`; hasilnya trace
   `MATCH-001` (ruleId baru di kelompok matcher, bukan engine) dengan input/output per peran, supaya
   "Tampilkan detail teknis" bisa menjelaskan _mengapa_ SKU ini.

**Yang ditanya ke pengguna** (hanya bila mengubah hasil): panjang batang yang tersedia di toko
(4 m vs 6 m) — satu pertanyaan opsional di layar solusi, bukan di chat. **Yang jadi asumsi ber-ID**
di registry: `ROD_LENGTH_DEFAULT_4M` (sudah implisit di ENG-105/304 sebagai `ROD_METERS = 4` —
angkat ke registry), `PIPE_END_SOLVENT_CEMENT` (ujung plain untuk solvent cement). Warna dan merek
tidak pernah diasumsikan.

## 2. Fitting lintas seri: "FITTING PVC" memuat seri D dan W

**Temuan.** `FITTING PVC` (1.920 SKU inci, 2.190 mm) bercampur: token nama `- D` 627 SKU,
`- W` 618, tanpa token 675. Kolom `pressure_class` VERIFIED hanya terisi `D` (627) — token `W`
tidak diterjemahkan karena artinya belum terverifikasi. Pipa AW tidak boleh dipasangkan fitting D.
Konvensi OQ-48 (fitting = keluarga pipa yang sama + kategori "FITTING") **tidak berlaku** untuk
data asli: fitting punya keluarga sendiri.

**Usulan (tanpa mengarang padanan seri):**

1. Matcher peran `fitting` mencari di keluarga `FITTING <bahan>` (PVC/HDPE/FRP) yang dipetakan dari
   keluarga pipa (`PVC AW`/`PVC D`/`PVC C` → `FITTING PVC`; `HDPE`/`MDPE` → `FITTING HDPE`) — pemetaan
   ini tabel ber-ID di kode, 3 baris, mudah dikonfirmasi Pralon. Konvensi OQ-48 dipertahankan hanya
   sebagai fallback untuk katalog yang tidak punya keluarga fitting (katalog contoh).
2. **Saring `pressure_class`**: fitting diterima bila `pressure_class` VERIFIED-nya **sama** dengan
   kelas pipa (AW ↔ AW, D ↔ D). Fitting dengan `pressure_class` `UNAVAILABLE` (seluruh token `W` dan
   tanpa token) **tidak dipasangkan otomatis** → peran fitting `SIZE_NEEDS_VALIDATION` dengan alasan
   "kelas fitting belum terverifikasi" — bukan dipasangkan sebagai AW karena "W mungkin AW".
3. Konsekuensi jujur: untuk pipa AW, hari ini **tidak ada** fitting PVC yang lolos (627 fitting D,
   0 fitting bertanda AW). Itu temuan data, bukan bug matcher: Pralon perlu menyatakan arti token
   `W` (dan fitting tanpa token) dalam `pressure_class`. Begitu `build_snouty_catalog.py` mengisi
   `pressure_class = AW` untuk token yang dikonfirmasi, matcher v2 langsung bekerja tanpa diubah.
4. Jenis fitting (tee/elbow/reducer/socket) dibaca dari `category` (`FITTING · TEE`, `FITTING · RED
SOCKET`, …), bukan dari `compatible_skus` yang sengaja kosong; `category` sudah konsisten di
   export (10 kategori terbesar terdaftar di `PRODUCT_MASTER_DATA_SCHEMA.md` §6 bila diperlukan).

## 3. Satuan: engine masih menyebut HDPE dalam inci

**Temuan.** Semua HDPE/MDPE di export berukuran **mm** (1.334 + 110 SKU, plus 561 fitting HDPE),
sementara engine memilih ukuran HDPE dari tabel inci `NOMINAL_SIZES` (ENG-102, ENG-205) — jadi
jalur irigasi ≥ 200 m dan transfer pompa HDPE selalu berakhir "produk tidak ada", apa pun matcher-nya.
Sesuai desain, **tidak ada konversi** 2½" ≈ 75 mm di kode.

**Aturan yang harus berubah dan data yang dibutuhkan:**

| Aturan                                                | Hari ini                            | Perubahan                                                                                                                                                | Data dari Pralon                    |
| ----------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| ENG-102 (diameter jalur utama irigasi)                | `NOMINAL_SIZES` inci, ID pendekatan | Pilih tabel per **keluarga**: PVC → tabel inci; HDPE → `HDPE_SIZES` mm (OD 20…630) dengan **ID = OD − 2·tebal**; `mainSize` menjadi `PipeSize` bersatuan | OD, tebal dinding (per PN/SDR) HDPE |
| ENG-104 (HDPE ≥ 200 m)                                | hanya memilih keluarga              | juga menetapkan satuan ukuran jalur utama = mm                                                                                                           | —                                   |
| ENG-105 / ENG-304 (BOM)                               | batang 4 m                          | HDPE gulungan 50/100 m atau batang 6/12 m dari `rod_length` SKU                                                                                          | panjang jual HDPE                   |
| ENG-201/202/205 (kecepatan, Hazen-Williams, kandidat) | `innerDiameterMm` dari tabel inci   | menerima daftar kandidat `{ size: PipeSize, innerMm }` dari pemanggil; rumusnya tidak berubah                                                            | ID nyata per OD/PN                  |
| ENG-402 (gravitasi)                                   | `GRAVITY_SIZES` inci sampai 16"     | PVC D besar di export: 8"–12" (inci) — cukup; HDPE drainase mm bila dipakai                                                                              | —                                   |
| ENG-206 (pompa)                                       | —                                   | tidak berubah                                                                                                                                            | —                                   |

Urutan aman: (1) tambah `HDPE_SIZES` ber-ID (OD/PN dari datasheet Pralon, `confirmationRequired`),
(2) `RoleRequirement.size: PipeSize` (bukan string) dan matcher memakai `samePipeSize`, (3) engine
memilih tabel per keluarga. Sampai (1) ada, HDPE tetap `INFORMATION_UNAVAILABLE` secara jujur.

## 4. Hasil uji nyata: katalog contoh vs versi Pralon (draft inci)

Metode: 10 skenario golden/§39 dijalankan lewat API tamu (dev stack lokal, migration 0016), status
tiap peran dicatat; lalu versi `erp-2026-10-06` dipromosikan **sementara** ke `active`, skenario
diulang, dan katalog contoh dikembalikan ke `active`. Versi mm belum diimpor (menunggu keputusan
baris "3150 mm"), jadi pembandingnya versi inci.

| Skenario                    | Peran (ukuran engine)                    | Katalog contoh (6 SKU)                                                | Katalog Pralon `erp-2026-10-06` (2.644 SKU)                                      |
| --------------------------- | ---------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| rumah-2-lantai              | —                                        | tidak ada rekomendasi (`UNDERSTANDING` gagal 63 s: ekstraksi model)   | sama — bukan soal katalog                                                        |
| irigasi 1 ha sprinkler      | main 1¼" · branch 1¼" · fitting          | VERIFIED · VERIFIED · VERIFIED                                        | **tidak ada** · tidak ada · tidak ada                                            |
| irigasi ≥ 200 m (HDPE)      | main 2½" HDPE · branch 2½" · fitting     | SIZE_NEEDS_VALIDATION ×3 (HDPE tak ada di sample; fitting dipaksakan) | **tidak ada** ×3                                                                 |
| tambak lele 4 × 4           | main 1½" AW · branch 3" D · fitting      | VERIFIED · VERIFIED · SIZE_NEEDS_VALIDATION                           | tidak ada · **SIZE_NEEDS_VALIDATION** (PVC D ada, 3" tidak terlihat) · tidak ada |
| transfer pompa (HDPE 2½")   | main · pompa · alternatif 3"             | tidak ada                                                             | tidak ada                                                                        |
| transfer pompa PVC 150 m    | main 2½" AW · fitting · alternatif 3" AW | SIZE_NEEDS_VALIDATION · SIZE_NEEDS_VALIDATION · VERIFIED              | tidak ada ×3                                                                     |
| gorong-gorong 8" D          | main 8"                                  | SIZE_NEEDS_VALIDATION                                                 | SIZE_NEEDS_VALIDATION                                                            |
| drainase 8" D               | main 8"                                  | SIZE_NEEDS_VALIDATION                                                 | SIZE_NEEDS_VALIDATION                                                            |
| air hujan 12" D             | main 12"                                 | SIZE_NEEDS_VALIDATION                                                 | SIZE_NEEDS_VALIDATION                                                            |
| cluster 120 unit (HDPE 1½") | main · pompa · alternatif                | tidak ada                                                             | tidak ada                                                                        |

**Temuan utama — ini yang membuat katalog Pralon tampak "lebih kosong" dari katalog contoh:**

1. **Jendela pencarian 50 produk.** `AnalysisService` memanggil `listProducts({ limit: 50 })` lalu
   menyaring di memori. Di katalog Pralon, 50 SKU pertama (urut `sku`) adalah 45 fitting + 5 PVC D —
   **tidak ada satu pun PVC AW**, padahal PVC AW ½"–8" ada 235 SKU. Semua "tidak ada" di kolom kanan
   adalah akibat jendela ini, bukan katalog. Matcher v2 harus **meminta kandidat per peran ke
   repository** (`family` + `size` bersatuan + status, pakai filter ukuran yang sudah ada di
   `listProducts`), bukan menerima satu halaman umum. Ini perubahan paling mendesak dan paling murah.
2. **Fitting = keluarga sendiri** (`FITTING PVC`, bukan `PVC AW` + kategori) — konvensi OQ-48 harus
   dibalik untuk data asli (§2), dan `pressure_class` fitting (D/AW) harus menyaring (§2 butir 2).
3. **HDPE dalam mm** — seluruh jalur HDPE (irigasi ≥ 200 m, transfer, cluster) tetap kosong sampai
   engine memilih ukuran mm (§3).
4. **Kandidat ganda** (§1): begitu jendela diperbaiki, irigasi 1¼" AW akan mendapat 16 kandidat;
   tanpa aturan pemilihan ber-trace, kartunya acak.

Catatan status DB lokal setelah uji: versi `erp-2026-10-06` kini `archived` (promosi hanya dari
`draft`, dan mengembalikan sample berarti mempromosikan versi sample baru `dev-restore-204426`).
Untuk uji berikutnya, impor ulang dengan label baru. Skenario rumah gagal di ekstraksi model
(Ollama lokal, 63 s) pada kedua katalog — bukan bagian dari perbandingan ini.

## 5. Keputusan yang dibutuhkan

1. Arti token `W` pada fitting PVC (dan fitting tanpa token): AW? Isi `pressure_class` di
   `build_snouty_catalog.py` hanya setelah dikonfirmasi.
2. Pemetaan keluarga pipa → keluarga fitting (PVC AW/D/C → FITTING PVC; HDPE/MDPE → FITTING HDPE).
3. Data OD/tebal dinding HDPE per PN untuk `HDPE_SIZES` ber-ID.
4. Kriteria pemilihan kandidat (§1): setuju panjang batang 4 m sebagai asumsi ber-ID default?
