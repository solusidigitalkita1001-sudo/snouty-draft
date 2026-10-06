# SNOUTY — Business Requirements Document (BRD)

Versi 0.1 · 2026-10-06 · Pemilik: Bagus (produk) · Status: draf untuk diskusi dengan Pralon

## 1. Latar belakang

Pralon menjual pipa dan fitting (PVC AW/D, HDPE/PE, PPR, dan lainnya) lewat distributor dan toko
bangunan. Calon pembeli — pemilik rumah, kontraktor kecil, petani, pembudidaya ikan — sering tidak
tahu **ukuran dan jenis pipa apa yang mereka butuhkan**, sehingga pertanyaan teknis dasar membebani
tim teknis Pralon atau dijawab seadanya oleh penjual. SNOUTY adalah asisten perencanaan perpipaan
berbasis AI yang menjawab "butuh produk apa dan ukuran berapa" secara konsisten, dapat dijelaskan,
dan selalu bermuara ke produk Pralon.

## 2. Tujuan bisnis

| #   | Tujuan                                                                             | Ukuran keberhasilan (usulan)                                            |
| --- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| B1  | Mengubah pertanyaan teknis awam menjadi rekomendasi produk Pralon yang bisa dibeli | ≥ 70 % konsultasi berakhir dengan daftar produk + BOM                   |
| B2  | Mengurangi beban tim teknis untuk kasus rutin (rumah, irigasi kecil, kolam)        | Handoff ke tim teknis hanya untuk kasus di luar kalkulator (< 30 %)     |
| B3  | Menghasilkan lead yang terkualifikasi (lokasi, skala proyek, kontak)               | Setiap handoff dan laporan membawa data kebutuhan terstruktur           |
| B4  | Konsistensi dan akuntabilitas: tidak ada angka tanpa dasar                         | 0 % angka tanpa provenance; 0 % rekomendasi merek lain (diuji otomatis) |
| B5  | Pengetahuan pasar: kebutuhan per wilayah/kasus                                     | Agregasi anonim; lokasi **tidak** memengaruhi rekomendasi               |

## 3. Cakupan

**Dalam cakupan (fase sekarang)**

- Percakapan Bahasa Indonesia: tamu dan akun terdaftar, riwayat percakapan.
- Kasus: air bersih rumah tinggal/kos/komersial kecil; irigasi lahan; kolam/tambak ikan;
  transfer pompa, drainase gravitasi, air hujan, gorong-gorong, sumur, cluster, gedung bertingkat
  (kasus terakhir ini: kebutuhan dikumpulkan terstruktur, kalkulator bertahap).
- Keluaran: ukuran pipa per segmen, bahan/kelas, daftar produk Pralon, BOM, skema (bangunan),
  laporan PDF (tier lanjutan), handoff ke tim teknis.
- Pengetahuan produk: perbedaan bahan, ketersediaan ukuran, spesifikasi dari katalog.
- Back-office: impor katalog berversi, promosi versi, validasi aturan teknik, antrean handoff.

**Di luar cakupan**

- Harga dan penawaran resmi (OQ-03); transaksi/pemesanan.
- Desain final bersertifikat: semua keluaran adalah **panduan perencanaan, bukan sertifikasi teknis**.
- Fluida khusus (air panas, uap, kimia, gas, minyak) dan jaringan kota besar → validasi teknis manual.
- Merek lain: boleh dibahas sebagai konteks, tidak pernah direkomendasikan.

## 4. Pemangku kepentingan

| Peran                      | Kepentingan                                  | Yang dibutuhkan dari mereka                         |
| -------------------------- | -------------------------------------------- | --------------------------------------------------- |
| Pemilik produk (Bagus)     | Arah produk, prioritas fase                  | Keputusan OQ, akses data                            |
| Tim teknis Pralon          | Validasi aturan teknik; menerima handoff     | Tanda tangan per aturan (OQ-06), SLA 1×24 jam kerja |
| Tim produk/katalog Pralon  | Master data produk                           | Sumber katalog resmi (OQ-07), dokumen teknis        |
| Pemasaran/penjualan Pralon | Lead, pengetahuan pasar                      | Format lead, target CRM/email (OQ-08)               |
| Pengguna akhir             | Jawaban cepat yang bisa dipercaya dan dibeli | —                                                   |

## 5. Kebijakan produk (mengikat, hidup di kode)

1. **LLM bukan sumber kebenaran teknik.** Perhitungan tidak pernah memanggil model.
2. **Tidak ada karangan.** Data produk, nilai teknik, harga yang tidak ada → `UNAVAILABLE`,
   pertanyaan, atau validasi teknis.
3. **Provenance di setiap nilai.** Aturan yang belum divalidasi tidak pernah `VERIFIED`.
4. **Hanya Pralon.** Perbandingan merek dijawab kriteria netral, tanpa kartu produk pesaing.
5. **Aturan bisnis di kode, bukan prompt.** Yang hanya ada di prompt dianggap tidak ada.
6. **Balasan seperti teknisi Pralon**, bukan templat — tanpa metateks.
7. **Data wilayah untuk analisis pasar, bukan untuk menentukan rekomendasi.**

## 6. Model layanan dan tier

| Tier      | Siapa                                  | Kapabilitas                                                             |
| --------- | -------------------------------------- | ----------------------------------------------------------------------- |
| Tamu      | Tanpa akun                             | Konsultasi penuh, solusi, produk, BOM; riwayat tidak tersimpan permanen |
| Terdaftar | Akun email                             | Riwayat tersimpan, kirim ke tim teknis                                  |
| Lanjutan  | Ditetapkan admin (gratis/berbayar: OQ) | Laporan PDF, ekspor                                                     |

## 7. Ketergantungan bisnis (yang menahan nilai)

| Ketergantungan                    | Dampak bila belum ada                                       | Pemilik           |
| --------------------------------- | ----------------------------------------------------------- | ----------------- |
| Master data produk Pralon (OQ-07) | Rekomendasi memakai katalog contoh; tidak boleh ke produksi | Pralon            |
| Validasi aturan oleh ahli (OQ-06) | Semua hasil bertanda ASUMSI                                 | Tim teknis Pralon |
| Dokumen pengetahuan produk        | Jawaban FAQ bersifat umum, bukan klaim Pralon               | Pralon            |
| Target handoff/CRM (OQ-08)        | Handoff tersimpan internal saja                             | Pemasaran         |

## 8. Risiko

| Risiko                                      | Mitigasi yang sudah ada                                                     |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| Hasil dipercaya sebagai desain final        | Label "PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS", provenance, handoff |
| Data contoh bocor ke produksi               | `catalog_versions.kind`; versi `sample` ditolak di luar development         |
| Model menyebut merek lain / mengarang angka | Kebijakan di kode, pagar angka REC-1, evaluasi otomatis                     |
| Latensi model lokal (puluhan detik)         | Jalur cepat tanpa model untuk kasus pasti; streaming                        |
| Aturan teknik salah                         | Setiap aturan ber-ID, berversi, bertes, menunggu validasi; trace per hasil  |

## 9. Keputusan yang masih terbuka untuk Pralon

- OQ-07 sumber dan format master data produk (lihat `docs/PRODUCT_MASTER_DATA.md`).
- OQ-06 siapa yang memvalidasi aturan dan lewat proses apa.
- OQ-03 harga dalam cakupan atau tidak.
- OQ-08/21 target handoff dan halaman privasi/ketentuan.
