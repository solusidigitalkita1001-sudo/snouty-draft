# SNOUTY — Audit Akurasi Teknik (2026-10-09)

Audit atas brief "SNOUTY Engineering Accuracy, Calculation Engine & Performance Improvement".
Dokumen ini mencatat apa yang ditemukan di kode, bukan apa yang diasumsikan. Item perbaikan
bernomor P16-49 dst. di `docs/PROGRESS.md`.

## 1. Arsitektur dan siklus permintaan (hasil inspeksi)

| Lapisan     | Implementasi                                                              |
| ----------- | ------------------------------------------------------------------------- |
| Frontend    | Next.js (`apps/web`), layar chat + layar solusi                           |
| Backend     | NestJS modular monolith (`apps/api`), worker PDF (`apps/worker`)          |
| Database    | MySQL 8 (katalog, percakapan, snapshot state, rekomendasi, trace)         |
| LLM         | Ollama CPU: qwen3.5:4b / 9b; bge-m3 untuk embedding                       |
| Pemahaman   | contoh berlabel sebagai data (`data/understanding`) + kemiripan bge-m3    |
| Perhitungan | `packages/engineering` — fungsi murni TypeScript, aturan berversi + trace |
| Katalog     | `product-catalog` (MySQL + cache), matcher murni `product-matcher.ts`     |

Siklus kasus gedung: pesan → pemahaman (embedding) + ekstraksi nilai (parser + LLM) →
`RequirementState` terstruktur → deteksi parameter kurang (`cases/missing.ts`) → engine
(`computeBuildingWater`) → pencocokan katalog per peran → komposer tampilan deterministik
(`building-water-view.ts`) → simpan rekomendasi + trace.

**LLM tidak mengerjakan aritmetika.** Semua angka di layar solusi berasal dari engine; prosa
gedung adalah templat (`proseSource: 'template'`). LLM hanya dipakai untuk memahami pesan dan
menulis balasan chat.

## 2. Temuan terkonfirmasi

Kasus regresi brief (5.000 m², 20 lantai, 90 m) dijalankan pada engine lama dan menghasilkan
persis keluaran yang dikutip brief: transfer HDPE 280 mm, 4 riser PVC AW 6", induk lantai 2½",
360 batang (⌈70,7 m ÷ 4 m⌉ × 20 lantai).

| #   | Temuan                                                                                                                                                                                              | Sumber                                                             | Dampak                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| C1  | Diameter dalam PVC = angka nominal (6" = 150 mm, ½" = 15 mm). OD resmi tersedia (Knowledge Master §7.1: 6" = 165 mm, ½" = 22 mm), tebal dinding tidak dipakai                                       | `parameters/size-tables.ts`                                        | Kecepatan dan kerugian gesek salah, terbesar di ukuran kecil  |
| C2  | Pembulatan di tengah rantai: debit jam puncak dibulatkan 83,33 l/s lalu dikonversi lagi → pompa 299,99 m³/jam, bukan 300                                                                            | `ENG-502`, `ENG-206`                                               | Angka tidak konsisten antarbagian                             |
| C3  | Daya pompa: efisiensi disebut "keseluruhan" tetapi hasilnya diberi nama daya poros dan dijelaskan sebagai daya motor                                                                                | `ENG-206`, asumsi `PUMP_EFFICIENCY_INDICATIVE`                     | Daya hidraulik, poros, dan motor tercampur                    |
| C4  | Zona tekanan = ⌈tinggi ÷ head 4 bar⌉; tidak memakai tekanan minimum, tidak menyebut lantai/elevasi tiap zona, lantai booster dihitung terpisah dari zona, tidak ada tanda bila desain tidak mungkin | `ENG-503`                                                          | Jumlah zona hanya dari ambang tetap                           |
| C5  | Tangki atap hanya (puncak − pompa) × 30 menit; tangki bawah = 1 hari tanpa menyebut pasokan PDAM                                                                                                    | `ENG-506`                                                          | Satu metode, asumsi pasokan tidak terlihat                    |
| C6  | BOM: panjang batang 4 m di-hardcode di tiga tampilan, bukan dari katalog; induk lantai dari √luas × lantai; panjang bersih dan jumlah beli tidak dibedakan                                          | `building-water-view.ts`, `pressurized-view.ts`, `gravity-view.ts` | Jumlah material tidak bisa dilacak; 360 batang dari luas saja |
| C7  | Satu dasar kebutuhan (150 l/orang/hari, 10 m²/orang) untuk semua jenis gedung                                                                                                                       | asumsi `DEMAND_LPCD_150`, `OCCUPANT_AREA_10M2`                     | Kantor, hotel, rumah sakit dihitung sama                      |
| C8  | Tidak ada pengukuran waktu per tahap di jalur pesan maupun analisis                                                                                                                                 | `message.service.ts`, `analysis.service.ts`                        | Optimasi tidak bisa dibuktikan                                |
| C9  | Kecepatan minimum "membersihkan diri" 0,6 m/s dipakai untuk pipa air bersih bertekanan                                                                                                              | asumsi `VELOCITY_MIN_SELF_CLEANING`                                | Kriteria saluran limbah dipakai di air bersih                 |

## 3. Risiko yang perlu tinjauan teknisi

- Tebal dinding PVC per kelas bertentangan antarsumber (Knowledge Master §7.2). Diameter dalam
  tetap perkiraan sampai Product Specification resmi tersedia (P16-02b).
- Kelas tekanan AW (10 bar menurut materi, "perlu spesifikasi resmi") dibanding tekanan statik
  di kaki riser gedung 90 m (±8,8 bar).
- Metode kebutuhan serentak alat plambing (kurva unit beban) belum ada; pipa per lantai memakai
  bagian debit menit puncak.
- Pompa booster dan setelan katup penurun tekanan belum dihitung; hanya lokasinya.
- Faktor jam/menit puncak, jam pemakaian, dan durasi puncak dari buku acuan plambing
  (Noerbambang & Morimura) — semuanya `REQUIRES_DOMAIN_VALIDATION`.

## 4. Urutan perbaikan

1. C1, C2, C3: diameter dalam dari OD resmi, presisi penuh di rantai hitung, definisi daya.
2. C4, C5: zona dari elevasi dan batas tekanan min/maks, tangki dengan suku siklus pompa dan
   asumsi pasokan yang tertulis.
3. C6: panjang batang dari produk katalog terpilih, panjang bersih vs jumlah beli, induk lantai
   tidak dihitung jumlahnya tanpa jalur.
4. Validasi masukan yang tidak masuk akal atau saling bertentangan.
5. Tes regresi dengan hitungan acuan independen.
6. Pengukuran waktu per tahap.
7. Label status hasil dan dokumentasi.

Risiko regresi: ukuran rekomendasi berubah untuk kasus yang ada (diameter dalam berubah), tes
dengan angka lama harus diperbarui bersama perubahan perilaku.

## 5. Status perbaikan (P16-49)

| #   | Status                                            | Catatan                                                                                            |
| --- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| C1  | Diperbaiki                                        | OD resmi − 2·OD/SDR; SDR PVC dari asumsi `PVC_AW_WALL_SDR` (OQ-58)                                 |
| C2  | Diperbaiki                                        | debit l/s presisi penuh; pembulatan hanya untuk tampilan                                           |
| C3  | Diperbaiki                                        | daya hidraulik, poros, beda tekanan; daya motor tidak diklaim                                      |
| C4  | Diperbaiki                                        | tabel zona per lantai; tekanan sisa ≥ batas zona ditolak                                           |
| C5  | Diperbaiki sebagian                               | suku siklus pompa + asumsi pasokan tertulis; pasokan PDAM menerus belum jadi masukan               |
| C6  | Diperbaiki untuk gedung, transfer pompa, drainase | BOM kolam dan irigasi masih memakai batang 4 m di aturan engine (ENG-105, ENG-30x)                 |
| C7  | Terbuka                                           | kebutuhan per jenis gedung menunggu data (OQ-58)                                                   |
| C8  | Diperbaiki                                        | jalur pesan sudah diukur (P14-07); jalur analisis kini mencatat durasi per tahap di log `analisis` |
| C9  | Terbuka                                           | kecepatan minimum tetap dipakai; perlu keputusan teknisi apakah berlaku untuk air bersih           |

Validasi baru: tinggi per lantai di luar 2–10 m, kepadatan < 1 m²/orang, dan tekanan sisa ≥ batas
zona ditanyakan balik di chat; analisis yang tetap dijalankan dengan data itu berakhir dengan
`VALIDATION_FAILED` yang tidak bisa diulang, bukan `SERVICE_UNAVAILABLE`.
