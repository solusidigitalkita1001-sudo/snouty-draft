# SNOUTY — Functional Requirements Document (FRD)

Versi 0.1 · 2026-10-06 · Diturunkan dari `docs/SPEC.md`, `docs/CONTEXT_ENGINE.md`,
`docs/ENGINEERING_RULES.md`, `docs/PRODUCT_KNOWLEDGE.md`, dan kode yang sudah berjalan.
Status per kebutuhan: **Ada** (berjalan dan teruji), **Sebagian**, **Belum**.

## 1. Percakapan

| ID     | Kebutuhan                                                                                            | Status   |
| ------ | ---------------------------------------------------------------------------------------------------- | -------- |
| F-CV-1 | Pengguna tamu dapat memulai percakapan tanpa akun; sesi tamu dapat ditautkan ke akun saat registrasi | Ada      |
| F-CV-2 | Balasan dialirkan (SSE) dengan tahap `UNDERSTANDING` → … → `solution.ready`                          | Ada      |
| F-CV-3 | Judul percakapan dibuat otomatis dan diperhalus di latar                                             | Ada      |
| F-CV-4 | Riwayat percakapan untuk akun terdaftar, status `IN_PROGRESS` / `SOLUTION_READY`                     | Ada      |
| F-CV-5 | Jawaban dalam Markdown ringan, prosa teknisi, tanpa metateks                                         | Ada      |
| F-CV-6 | Lampiran denah (upload)                                                                              | Sebagian |

## 2. Pemahaman kebutuhan (Context Engine)

| ID      | Kebutuhan                                                                                                                                    | Status                       |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| F-CX-1  | Setiap field kebutuhan adalah `TrackedValue` (nilai, provenance, sumber, alasan, waktu)                                                      | Ada                          |
| F-CX-2  | Intent: pernyataan kebutuhan, mutasi, lookup produk, penjelasan, jawaban klarifikasi, pesaing, di luar cakupan; presedensi kebutuhan di kode | Ada                          |
| F-CX-3  | Ekstraksi terstruktur lewat skema ketat; gagal → klarifikasi, bukan giliran jatuh                                                            | Ada                          |
| F-CX-4  | Klarifikasi ≤ 4 pertanyaan per giliran, urut prioritas, selalu ada "Belum tahu"; jawaban dikumpulkan lalu dikirim sekaligus                  | Ada                          |
| F-CX-5  | Default yang diterapkan tercatat sebagai asumsi ber-ID dan bisa diperbaiki ("Perbaiki asumsi ini")                                           | Ada                          |
| F-CX-6  | Edit inline di panel kanan tanpa LLM, solusi dihitung ulang                                                                                  | Ada                          |
| F-CX-7  | Klasifikasi kasus teknis deterministik (10 profil) + ekstraksi fakta tersurat ke parameter universal dengan konversi satuan                  | Ada                          |
| F-CX-8  | Kesiapan dinilai **per keluaran** (bahan, sizing pipa, pompa, tata letak, BOM, produk), bukan satu boolean                                   | Ada (engine) / Sebagian (UI) |
| F-CX-9  | Percakapan kasus teknis berlanjut tanpa model: angka dalam kalimat dibaca ekstraktor                                                         | Ada                          |
| F-CX-10 | Kebijakan cakupan (air panas, kimia, …) diputuskan sebelum ekstraksi; kebutuhan yang terkumpul dibawa ke kartu validasi teknis               | Ada                          |

## 3. Mesin teknik (packages/engineering)

| ID     | Kebutuhan                                                                                                                                                                                                                                                              | Status           |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| F-EN-1 | Setiap aturan: ID, versi, kategori, `parseInput`, `compute` murni, rujukan sumber, status validasi, ≥ 1 test case, `explain`                                                                                                                                           | Ada (29 aturan)  |
| F-EN-2 | Registry parameter universal (±65 kunci: satuan, importance, pertanyaan bahasa pengguna)                                                                                                                                                                               | Ada              |
| F-EN-3 | Registry asumsi ber-ID (nilai, rujukan, keyakinan, `confirmationRequired`); aturan membaca default dari sini                                                                                                                                                           | Ada              |
| F-EN-4 | Grafik ketergantungan keluaran ← masukan; "apa yang kurang untuk menghitung X" transitif                                                                                                                                                                               | Ada              |
| F-EN-5 | Kalkulator bangunan (unit beban, riser, kelas tekanan, bahan), irigasi (debit/ha, diameter, pompa, BOM), hidraulik bertekanan (kecepatan, Hazen-Williams, minor, TDH, sizing multi-kriteria dengan kandidat, titik kerja pompa), kolam (volume, pengisian, kuras, BOM) | Ada              |
| F-EN-6 | Gravitasi (Manning), air hujan Q = C·I·A (intensitas wajib dari pengguna/asumsi berlabel), gorong-gorong, kebutuhan cluster, zonasi gedung                                                                                                                             | Belum (fase 4)   |
| F-EN-7 | Trace per aturan tersimpan bersama rekomendasi; "Tampilkan detail teknis" membaca trace, bukan prosa                                                                                                                                                                   | Ada              |
| F-EN-8 | Gerbang provenance: aturan `REQUIRES_DOMAIN_VALIDATION` → hasil `ASSUMED`; dimensi dari pilihan rentang tidak pernah `VERIFIED`                                                                                                                                        | Ada              |
| F-EN-9 | Validasi aturan oleh ahli lewat back-office (tanda tangan, tanggal, versi)                                                                                                                                                                                             | Sebagian (OQ-06) |

## 4. Katalog dan pengetahuan produk

| ID     | Kebutuhan                                                                                                                                                                                                      | Status                                    |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| F-PC-1 | Katalog berversi (`draft` → `active` → `archived`), satu versi aktif, `kind` `pralon`/`sample`                                                                                                                 | Ada                                       |
| F-PC-2 | Produk: SKU unik per versi, keluarga, kategori, ukuran kanonik, spesifikasi ber-provenance (`VERIFIED` dengan dokumen+halaman, atau `UNAVAILABLE` tanpa nilai), dokumen teknis, gambar, kompatibilitas fitting | Ada                                       |
| F-PC-3 | Impor idempoten dari sumber tabular lewat kontrak bebas format; semua galat dilaporkan sekaligus; versi dibuat hanya bila 0 galat                                                                              | Ada (adapter format Pralon: Belum, OQ-07) |
| F-PC-4 | Versi `sample` tidak pernah aktif di produksi dan tidak pernah mendasari klaim "Pralon punya/tidak punya"                                                                                                      | Ada                                       |
| F-PC-5 | Lookup terstruktur: ukuran tersedia, spesifikasi, perbandingan keluarga, fitting sepadan; jawaban dari MySQL, bukan pencarian semantik                                                                         | Ada                                       |
| F-PC-6 | Pengetahuan konsep (PVC vs HDPE, kegunaan) dari kode, dipisah dari katalog; produk hanya disebut atas versi `pralon`                                                                                           | Ada                                       |
| F-PC-7 | RAG/Qdrant hanya bila kriteria `PRODUCT_KNOWLEDGE.md` §5 terpenuhi                                                                                                                                             | Belum (sengaja)                           |

## 5. Rekomendasi, BOM, skema

| ID     | Kebutuhan                                                                                                                                                           | Status                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| F-RC-1 | Analisis berjalan sinkron saat pengguna menekan "Susun rekomendasi"; overlay tanpa tombol batal; gagal → coba lagi                                                  | Ada                           |
| F-RC-2 | Pencocokan produk per peran (jalur utama, cabang, fitting) atas versi aktif; status kartu `VERIFIED_SELECTED` / `SIZE_NEEDS_VALIDATION` / `INFORMATION_UNAVAILABLE` | Ada                           |
| F-RC-3 | BOM per baris dengan dasar perhitungan dan trace; satuan batang/meter/pcs                                                                                           | Ada                           |
| F-RC-4 | Prosa penjelas lulus pagar REC-1 (setiap angka ada di hasil hitung); fallback templat deterministik                                                                 | Ada                           |
| F-RC-5 | Layar solusi: Ringkasan · Produk Pralon · Skema · Estimasi Material; statistik per jenis solusi (bangunan, irigasi, kasus teknis)                                   | Ada                           |
| F-RC-6 | Skema instalasi bangunan deterministik dari snapshot; skema irigasi/kolam                                                                                           | Ada / Belum (menunggu desain) |
| F-RC-7 | Opsi bersaing (misal 2½" vs 3": kerugian vs biaya) dan kesiapan per keluaran tampil di layar solusi                                                                 | Belum (fase 6)                |

## 6. Laporan, handoff, lead

| ID     | Kebutuhan                                                                                             | Status                        |
| ------ | ----------------------------------------------------------------------------------------------------- | ----------------------------- |
| F-RP-1 | Laporan PDF A4 dua halaman via worker (tier lanjutan), nomor laporan unik, unduh terotorisasi         | Ada                           |
| F-HO-1 | "Kirim ke tim teknis Pralon" dengan kebutuhan terstruktur; antrean internal; SLA 1×24 jam kerja di UI | Ada (target CRM/email: OQ-08) |
| F-EM-1 | Email masuk diparsing, diredaksi, diklasifikasi menjadi lead dengan skor deterministik                | Ada                           |
| F-MI-1 | Agregasi anonim kebutuhan per wilayah; tidak ada jalur impor ke rekomendasi                           | Ada                           |

## 7. Back-office

| ID     | Kebutuhan                                                             | Status                            |
| ------ | --------------------------------------------------------------------- | --------------------------------- |
| F-BO-1 | Impor katalog (unggah, laporan galat per baris, promosi versi, arsip) | Ada (UI minimal, menunggu desain) |
| F-BO-2 | Validasi aturan teknik (daftar aturan, status, tanda tangan ahli)     | Sebagian                          |
| F-BO-3 | Antrean handoff, tier pengguna, audit log                             | Ada                               |

## 8. Kebutuhan non-fungsional

| ID  | Kebutuhan                                                                                                                                                     | Status                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| N-1 | Time-to-first-byte balasan < 2–4 s untuk jalur tanpa model; kasus dengan model ≤ 30–70 s di CPU lokal (target produksi dengan model hosted jauh lebih rendah) | Sebagian                                       |
| N-2 | Keamanan: JWT access/refresh, rate limit per subjek dan IP, redaksi data pribadi, tidak ada secret di repo                                                    | Ada                                            |
| N-3 | Aksesibilitas WCAG 2.1 AA, dark mode, `prefers-reduced-motion`                                                                                                | Ada                                            |
| N-4 | Observabilitas: log terstruktur, correlation id, audit panggilan model + biaya                                                                                | Ada; profil per tahap pipeline: Belum (fase 7) |
| N-5 | Evaluasi otomatis: golden dataset, ambang halusinasi 0 %, kebijakan 100 %                                                                                     | Ada (22 kasus)                                 |
| N-6 | Database bersama Pralon tidak pernah disentuh tanpa persetujuan + backup; migrasi dites naik-turun                                                            | Ada                                            |
