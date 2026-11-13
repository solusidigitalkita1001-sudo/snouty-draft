# Hasil Perbaikan Smoke Test 13 November 2026

Dokumen ini menjawab satu permintaan: setelah keempat belas temuan dikerjakan, apa yang berubah di
tujuh skenario yang dilaporkan. Tiap baris dijalankan ulang terhadap instance lokal lewat jalur yang
sama dengan produksi (`AnalysisService.run` dengan katalog uji), dan harapannya ditulis dari aturan,
bukan disalin dari keluaran.

Regresinya hidup sebagai tes: `apps/api/src/modules/recommendation/application/smoke-13nov-regression.spec.ts`
(27 tes), ditambah tes aturan di `packages/engineering`.

## 1 · Tujuh skenario wajib

| Skenario                                                                   | Ukuran segmen                                                                                                             | Sambungan                                                                                                | BOM                                                                                 | Error                                                                                                                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ganti-sebagian-hdpe-25mm** · pipa lama HDPE 25 mm, ganti 3 m             | **Sebelum:** 1" (ukuran hitungan seluruh rumah)<br>**Sesudah:** 25 mm, seukuran pipa yang disambungnya                    | **Sebelum:** 2 sok PVC AW<br>**Sesudah:** 2 kopling transisi HDPE 25 mm                                  | **Sebelum:** baris pipa seluruh jalur (22,5 m)<br>**Sesudah:** Pipa HDPE 25 mm, 3 m | —                                                                                                                                                               |
| **ganti-sebagian-tanpa-ukuran-lama** · pipa lama PVC, ukuran belum disebut | **Sebelum:** ukuran hitungan, diakui seukuran pipa lama<br>**Sesudah:** ukuran hitungan, tanpa mengaku seukuran pipa lama | —                                                                                                        | —                                                                                   | **Sesudah:** ukuran pipa lama ditanyakan, bukan ditebak                                                                                                         |
| **ganti-sebagian-pembuangan** · ganti 3 m jalur air kotor 3"               | **Sebelum:** ukuran air bersih<br>**Sesudah:** PVC D 3"                                                                   | **Sebelum:** sok PVC AW (kelas air bersih)<br>**Sesudah:** sambungan PVC D, sistem `soil`                | **Sesudah:** tidak ada baris air bersih di antara material renovasinya              | **Sebelum:** sumber air diminta untuk pekerjaan pembuangan saja<br>**Sesudah:** tidak diminta                                                                   |
| **nol-titik-air** · rumah tanpa satu pun alat                              | —                                                                                                                         | —                                                                                                        | **Sesudah:** tidak ada BOM karangan                                                 | **Sebelum:** `RuleInputError` mentah<br>**Sesudah:** pertanyaan yang bisa dijawab                                                                               |
| **50-lantai-pdam** · 50 lantai dari PDAM                                   | —                                                                                                                         | —                                                                                                        | —                                                                                   | **Sebelum:** dihitung diam-diam<br>**Sesudah:** tekanan di sumber diperiksa; 50 lantai rumah dipertanyakan                                                      |
| **panjang-ganti-melebihi-jalur** · ganti 100 m pada jalur 22,5 m           | **Sebelum:** "ganti sebagian 22,5 m dari 22,5 m (100 %)"<br>**Sesudah:** dikatakan mencakup seluruh jalur                 | **Sebelum:** tetap "2 sok ke pipa lama"<br>**Sesudah:** ditawarkan ganti semua pipa, tanpa dua sambungan | —                                                                                   | —                                                                                                                                                               |
| **mysql-zona-waktu** · sesi MySQL bukan UTC                                | —                                                                                                                         | —                                                                                                        | —                                                                                   | **Sebelum:** register/login gagal satu per satu<br>**Sesudah:** sesi disetel UTC per koneksi; proses menolak start di atas sesi yang bukan UTC, dengan sebabnya |

## 2 · Temuan lain

| Temuan                              | Sebelum                                                                                                            | Sesudah                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 6 · BOQ tidak konsisten             | `calc.result` "8 batang" di baris ber-`quantity: 1`; Total menjumlah lintas satuan                                 | Satu sumber kuantitas per baris; total per satuan; validator pra-render menolak laporan yang angkanya berbeda di dua bagian |
| 8 · Wastafel diisi diam-diam        | `basin: 2` tanpa pernah ditanya, kelengkapan 4/4                                                                   | Anggapannya terlihat, bisa diedit di panel, dan disebut di balasan                                                          |
| 9 · Alat yang tidak bisa diinput    | Tidak ada field mesin cuci, keran taman, water heater, floor drain balkon; "ada mesin cuci dan keran taman" hilang | Empat field penuh: terbaca dari chat, masuk skema ekstraksi, bisa diedit, dan bebannya dihitung (4 WSFU / 3 DFU / 2 DFU)    |
| 9b · Susunan sumber air             | PDAM → tandon bawah → pompa transfer → toren atap tidak bisa dinyatakan                                            | Tiga field baru; pompa transfernya keluar dengan debit dan head minimal (ENG-713)                                           |
| 10 · Tujuan air bekas               | Selalu "saluran atau sumur resapan"; tanpa grease trap                                                             | Tujuan ditanya dan dipakai; resapan hanya atas pilihan pengguna, dengan peringatan; satu grease trap per dapur              |
| 11 · Laporan READY tanpa berkas     | READY lalu unduhan 503                                                                                             | Konfigurasi diperiksa saat start (produksi berhenti); tanpa penyimpanan, laporan GAGAL dengan sebabnya                      |
| 12 · Ukuran hanya inci              | `1"`                                                                                                               | `1" (Ø32 mm)` di jalur, langkah teknis, BOQ, dan kartu produk                                                               |
| 13 · Jalur mepet kapasitas          | 7 dari 8 DFU lolos tanpa sepatah kata                                                                              | "88 % kapasitas jalurnya: masih lolos, tetapi tanpa banyak cadangan"                                                        |
| 14 · Panjang masuk field yang salah | "ganti pipa sepanjang 3 meter" → panjang jalur utama 3 m                                                           | Panjang yang diganti; kasusnya masuk eval live `PP-49`                                                                      |

## 3 · Pertanyaan terbuka yang dibuka

Tujuh. Semuanya non-blocking: pekerjaannya jalan dengan usulan default, dan aturan yang memakai
angka baru tetap menunggu validasi ahli.

| OQ     | Isi                                                                        | Menunggu                                                                |
| ------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| OQ-96  | Tekanan kerja pipa per kelas tidak ada di data mana pun                    | Angka tekanan kerja per kelas dari Pralon                               |
| OQ-97  | Batas jumlah lantai yang masih dibaca rumah tinggal                        | Batas yang disetujui                                                    |
| OQ-98  | Jumlah dop, stop kran, dan lem tidak pernah dihitung                       | Aturan jumlah ketiganya                                                 |
| OQ-99  | Beban mesin cuci (4 WSFU, 3 DFU), floor drain (2 DFU), dan jalur air panas | Tanda tangan atas ketiga angka; perlu-tidaknya jalur air panas dihitung |
| OQ-100 | Debit dan head pompa transfer: lama pengisian 1 jam, muka air tandon 1,5 m | Kedua angka; perlu-tidaknya daya pompa ditampilkan                      |
| OQ-101 | Ukuran grease trap, jarak bak kontrol, kapasitas IPAL                      | Ketiga angka                                                            |
| OQ-102 | Naik satu ukuran di atas 75 % kapasitas jalur pembuangan?                  | Keputusan naik-tidaknya, dan batasnya                                   |

## 4 · Satu cacat yang ditemukan saat menjalankan ulang

Perbaikan temuan 5 menyetel sesi UTC pada tiap koneksi baru lewat event `connection` sebuah pool.
Koneksi yang dibawa event itu bergaya callback, bukan versi promise-nya seperti yang dijanjikan
tipe `mysql2`. Memperlakukannya sebagai promise melempar di dalam emitter: pengambilan koneksi
tidak pernah selesai, dan **setiap permintaan menggantung tanpa satu pun pesan kesalahan**.

Dua puluh tiga spec yang memakai MySQL gagal lebih dulu dengan koneksi ditolak — kontainer ujinya
mati — sehingga cacat ini tidak terlihat. Begitu kontainernya hidup, suite-nya diam 56 menit.
Perintahnya sekarang dikirim dalam bentuk callback dari satu fungsi yang dipakai aplikasi dan
fixture tes sekaligus, dan tesnya memberi listener itu koneksi yang `query()`-nya bukan promise.
Dua puluh tiga spec itu kini selesai dalam 15 detik (P37-17).

## 5 · Yang tidak dirusak

Dijalankan ulang setelah seluruh perbaikan: `packages/engineering` 677 tes, `apps/api` 2.149 tes,
`apps/web` 294 tes, `packages/ui` 14, `packages/shared-types` 45 — semuanya lulus, dengan MySQL
sesi UTC. Cabang toren atap, sizing 4" air kotor dan 2" ventilasi, dan alur
akun → percakapan → analisis → laporan → PDF tidak berubah perilakunya.
