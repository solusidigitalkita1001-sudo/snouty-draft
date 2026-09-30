# SNOUTY — Performa

Fase 0c · P0c-12 · Terakhir diperbarui 2026-09-30

Sumbernya SPEC §23. Intinya satu kalimat: **jangan menjalankan seluruh pipeline untuk setiap pesan.**

---

## 1. Anggaran

| Operasi                                 | Target p95   | Terikat oleh                  |
| --------------------------------------- | ------------ | ----------------------------- |
| Token pertama (jawaban streaming)       | < 1,5 s      | LLM                           |
| Rekomendasi lengkap (welcome → solusi)  | < 8 s        | 2–3 panggilan LLM + katalog   |
| **Hitung ulang setelah edit kebutuhan** | **< 300 ms** | murni CPU, **tanpa jaringan** |
| Lookup produk                           | < 200 ms     | MySQL + cache                 |
| Drawer detail produk                    | < 250 ms     | MySQL + cache                 |
| Daftar riwayat                          | < 300 ms     | MySQL                         |
| Pembuatan PDF (asinkron)                | < 20 s       | Chromium                      |
| Health check                            | < 50 ms      | `SELECT 1`                    |

Baris hitung ulang adalah yang paling bisa dijamin, karena tidak ada panggilan keluar sama sekali —
dan juga yang paling sering dipakai setelah pengguna melihat solusinya.

---

## 2. Eksekusi selektif

Lima jalur; intent router memilih satu.

| Permintaan        | Jalur                                                  | Panggilan LLM | Query DB |
| ----------------- | ------------------------------------------------------ | ------------- | -------- |
| FAQ produk        | policy → retrieval → jelaskan                          | 1 cepat       | 0–1      |
| Lookup produk     | policy → MySQL → jelaskan                              | 1 cepat       | 1        |
| Rekomendasi       | ekstraksi → context → engineering → matcher → jelaskan | 2 seimbang    | 1–2      |
| Kasus lanjutan    | + klarifikasi, BOM, skema                              | 2–3           | 1–2      |
| **Edit / mutasi** | context → engineering → matcher → BOM → skema          | **0**         | **1**    |

Perhatikan bahwa jumlah query tidak naik seiring kerumitan jalur. Itu disengaja: produk untuk satu
rekomendasi diambil dalam satu query, bukan satu per peran.

### Kenapa jalur nol-LLM adalah keputusan arsitektur

Setelah pengguna melihat solusinya, sebagian besar interaksi berikutnya adalah penyesuaian: ubah
jumlah kamar mandi, pindahkan toren, tambah lantai, perbaiki asumsi. Bila masing-masing memicu
ekstraksi ulang, biaya token melonjak dan — lebih buruk — hasilnya bisa berubah untuk masukan yang
sama, sehingga angka di layar bergoyang tanpa sebab yang bisa dijelaskan.

Karena nilainya sudah terstruktur, tidak ada yang perlu diekstraksi. Ini sebabnya `TrackedValue`
dan snapshot append-only ada di lapisan bawah desain, bukan sebagai penyempurnaan belakangan.

---

## 3. Sumber kelambatan

| Sumber                    | Besaran   | Penanganan                        |
| ------------------------- | --------- | --------------------------------- |
| Panggilan LLM             | 0,5–5 s   | hindari; routing model; streaming |
| Retrieval (bila diadopsi) | 50–300 ms | hanya saat benar-benar perlu      |
| Query katalog             | 5–50 ms   | indeks + cache Redis              |
| Engineering Engine        | < 5 ms    | murni CPU                         |
| Pembentukan skema         | < 10 ms   | murni CPU                         |
| Rendering PDF             | 5–20 s    | asinkron, di worker               |

Perbandingannya jelas: satu panggilan LLM yang dihindari sepadan dengan ratusan optimasi query.
Karena itu urutan prioritas optimasi selalu — kurangi panggilan model dulu, baru yang lain.

---

## 4. Streaming

Jawaban dialirkan lewat SSE. Tahap analisis dipancarkan sebagai batas pipeline nyata, sehingga
tracker lima langkah bergerak karena pekerjaan benar-benar selesai, bukan karena timer.

Efeknya pada persepsi: pengguna melihat "Memahami kebutuhan ✓" dalam ratusan milidetik, jauh sebelum
seluruh rekomendasi siap. Waktu total tidak berubah; rasa menunggunya berubah banyak.

Syarat teknisnya satu dan mutlak: `proxy_buffering off` di Nginx (`INFRASTRUCTURE.md` §3). Tanpa itu
seluruh manfaat streaming hilang tanpa jejak galat.

---

## 5. Cache

| Apa                      | Di mana                    | TTL               | Invalidasi            |
| ------------------------ | -------------------------- | ----------------- | --------------------- |
| Produk per ID            | Redis                      | 1 jam             | promosi versi katalog |
| Versi katalog aktif      | Redis                      | 1 jam             | sama                  |
| Snapshot kebutuhan aktif | Redis                      | 24 jam            | write-through         |
| Aset statis              | Nginx                      | panjang, ber-hash | rebuild               |
| Font                     | di-host sendiri, immutable | 1 tahun           | —                     |

Katalog jarang berubah dan sangat sering dibaca — rasio yang ideal. Invalidasinya dipicu peristiwa
promosi versi, bukan sekadar menunggu TTL habis, agar katalog baru langsung terlihat.

Yang **tidak** di-cache: jawaban LLM. Dua pengguna yang mengetik kalimat sama tetap punya konteks
kebutuhan yang berbeda, jadi cache jawaban akan salah lebih sering daripada benar.

---

## 6. Database

| Praktik                                                                               |     |
| ------------------------------------------------------------------------------------- | --- |
| Indeks dibuat berdasarkan bentuk query nyata, bukan setelah lambat (`DATABASE.md` §6) |
| Tidak ada N+1 — diuji dengan penghitung query, bukan diperiksa manual                 |
| Paginasi berbasis cursor, bukan `OFFSET`                                              |
| Pool kecil (API 10, worker 5) — server ini melayani delapan aplikasi                  |
| Hanya kolom yang dipakai yang diambil                                                 |
| Semua akses lewat repository berparameter                                             |

Ukuran pool layak ditegaskan: membuka koneksi besar "untuk jaga-jaga" di host bersama berarti
mengambil kapasitas dari tim lain. Naikkan hanya dengan bukti antrean koneksi.

---

## 7. Frontend

|                                                                      |     |
| -------------------------------------------------------------------- | --- |
| Font IBM Plex di-host sendiri via `next/font`, `display: swap`       |     |
| Komponen berat (skema, drawer produk, overlay laporan) dimuat lambat |     |
| Panel kanan dan sidebar dirender di server bila memungkinkan         |     |
| Gambar produk 1:1 dengan dimensi eksplisit — mencegah layout shift   |     |
| SVG skema dirender dari topologi, tidak ada library diagram besar    |     |
| Tidak ada permintaan ke host eksternal (CSP ketat)                   |     |

Anggaran: LCP < 2,0 s, CLS < 0,1, bundel awal < 200 KB terkompresi.

Menghosting font sendiri memberi dua hal sekaligus — satu round-trip lebih sedikit, dan CSP yang
bisa dibuat ketat tanpa pengecualian.

---

## 8. Batas asinkron

Di antrean: pembuatan PDF, pengiriman handoff, impor katalog, embedding, pemrosesan email, agregasi
pasar, notifikasi.

**Tidak** di antrean: pesan chat, ekstraksi, perhitungan teknik, product matching, BOM, skema.

Ujinya sederhana — apakah pengguna sedang menunggunya di layar? Kalau ya, ia sinkron. Antrean
menambah latensi dan kerumitan; itu sepadan hanya untuk pekerjaan yang boleh selesai belakangan.

---

## 9. Biaya sebagai metrik performa

Token dicatat per panggilan dan dijumlahkan per percakapan (`llm_calls`). Biaya diperlakukan setara
latensi: keduanya konsekuensi dari memanggil model yang seharusnya tidak dipanggil.

Yang dipantau: biaya per konsultasi, panggilan per konsultasi, dan **proporsi interaksi yang berjalan
di jalur nol-LLM**. Angka ketiga adalah ukuran paling langsung apakah eksekusi selektif benar-benar
bekerja.

---

## 10. Penskalaan

Instans API stateless, jadi menambah replika cukup menambah kontainer — tidak ada state percakapan
di memori proses, rate limit di Redis, sesi di cookie + Redis.

Yang **tidak** bertambah otomatis: worker (dibatasi CPU untuk Chromium) dan MySQL (bersama, di luar
kendali kita). Bila baca melampaui ~70% kapasitas, langkah berikutnya read replica — tetapi itu
keputusan pemilik server, bukan proyek ini.

---

## 11. Pengujian

| #   | Tes                                                        |
| --- | ---------------------------------------------------------- |
| 1   | Edit kebutuhan tidak memicu satu pun panggilan LLM         |
| 2   | Satu rekomendasi tidak melebihi N query (penghitung query) |
| 3   | Tidak ada N+1 di daftar riwayat maupun product matching    |
| 4   | Engineering Engine menyelesaikan kasus tipikal < 5 ms      |
| 5   | Stream SSE mengirim token pertama sebelum pipeline selesai |
| 6   | Cache katalog batal saat versi dipromosikan                |
| 7   | Chat tetap responsif saat RabbitMQ mati                    |
| 8   | Chat tetap berfungsi saat Redis dikosongkan                |

Tes 7 dan 8 menguji hal yang sama dari dua sisi: kegagalan komponen sekunder harus menurunkan
kemampuan, bukan menghentikan konsultasi.
