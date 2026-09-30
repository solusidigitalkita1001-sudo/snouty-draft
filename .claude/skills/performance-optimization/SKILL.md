---
name: performance-optimization
description: Gunakan saat menambah jalur permintaan baru, menulis query database, menambah panggilan LLM, membangun streaming SSE, menambah cache, atau saat sesuatu terasa lambat. Juga saat menangani edit kebutuhan dan follow-up yang memutasi — jalur itu wajib nol panggilan LLM.
---

# Optimasi Performa

Rujukan lengkap: `docs/PERFORMANCE.md`.

## Prinsip

**Jangan jalankan seluruh pipeline untuk setiap pesan.** Intent router memilih satu dari lima jalur.

| Permintaan                  | Panggilan LLM | Query DB |
| --------------------------- | ------------- | -------- |
| FAQ produk                  | 1 cepat       | 0–1      |
| Lookup produk               | 1 cepat       | 1        |
| Rekomendasi                 | 2 seimbang    | 1–2      |
| Kasus lanjutan              | 2–3           | 1–2      |
| **Edit / mutasi kebutuhan** | **0**         | **1**    |

Jumlah query tidak naik seiring kerumitan jalur — produk untuk satu rekomendasi diambil dalam
**satu** query, bukan satu per peran.

## Jalur nol-LLM adalah keputusan arsitektur

Setelah pengguna melihat solusinya, sebagian besar interaksi berikutnya adalah penyesuaian. Bila
masing-masing memicu ekstraksi ulang, biaya melonjak dan — lebih buruk — hasilnya bisa berubah untuk
masukan yang sama, sehingga angka di layar bergoyang tanpa sebab yang bisa dijelaskan.

Nilainya sudah terstruktur. Tidak ada yang perlu diekstraksi. **Jangan pernah menambahkan panggilan
LLM ke jalur ini.**

## Anggaran

| Operasi                       | p95          |
| ----------------------------- | ------------ |
| Token pertama                 | < 1,5 s      |
| Rekomendasi lengkap           | < 8 s        |
| **Hitung ulang setelah edit** | **< 300 ms** |
| Lookup produk                 | < 200 ms     |
| Daftar riwayat                | < 300 ms     |
| PDF (asinkron)                | < 20 s       |

## Urutan prioritas optimasi

1. **Hilangkan panggilan LLM** (0,5–5 s masing-masing)
2. Kurangi retrieval (50–300 ms)
3. Cache dan indeks query katalog (5–50 ms)
4. Sisanya (engine < 5 ms, skema < 10 ms — sudah murni CPU)

Satu panggilan model yang dihindari sepadan dengan ratusan optimasi query. Selalu periksa langkah 1
dulu.

## Streaming

Tahap analisis dipancarkan sebagai **batas pipeline nyata**, bukan timer. Pengguna melihat "Memahami
kebutuhan ✓" dalam ratusan milidetik. Waktu total tidak berubah; rasa menunggunya berubah banyak.

Syarat mutlak: `proxy_buffering off` di Nginx. Tanpa itu seluruh manfaat streaming hilang **tanpa
jejak galat** — jadi periksa ini lebih dulu bila streaming terasa tidak bekerja.

## Cache

Katalog: Redis 1 jam, **diinvalidasi saat versi dipromosikan** (bukan sekadar menunggu TTL).
Requirement state: Redis 24 jam, write-through ke MySQL.
Aset dan font: panjang, ber-hash, di-host sendiri.

**Jangan cache jawaban LLM.** Dua pengguna yang mengetik kalimat sama punya konteks kebutuhan
berbeda; cache akan salah lebih sering daripada benar.

## Database

Indeks dibuat berdasarkan bentuk query nyata sejak awal (`docs/DATABASE.md` §6) · **tidak ada N+1,
diuji dengan penghitung query** bukan diperiksa manual · paginasi cursor bukan `OFFSET` · hanya
kolom yang dipakai · pool kecil (API 10, worker 5).

Ukuran pool bukan sekadar tuning: server ini melayani delapan aplikasi. Pool besar "untuk jaga-jaga"
mengambil kapasitas dari tim lain. Naikkan hanya dengan bukti antrean koneksi.

## Frontend

Font IBM Plex di-host sendiri (`next/font`) · komponen berat dimuat lambat (skema, drawer produk,
overlay laporan) · gambar 1:1 dengan dimensi eksplisit untuk mencegah layout shift · SVG skema tanpa
library diagram · tanpa permintaan ke host eksternal.

Anggaran: LCP < 2,0 s · CLS < 0,1 · bundel awal < 200 KB terkompresi.

## Biaya = metrik performa

Token dicatat per panggilan (`llm_calls`). Yang dipantau: biaya per konsultasi, panggilan per
konsultasi, dan **proporsi interaksi di jalur nol-LLM** — ukuran paling langsung apakah eksekusi
selektif benar-benar bekerja.

## Checklist jalur baru

- [ ] Perlukah LLM di sini, atau nilainya sudah terstruktur?
- [ ] Bisakah dijawab dengan query MySQL?
- [ ] Ada N+1? (tulis tes penghitung query)
- [ ] Indeks mendukung bentuk query ini?
- [ ] Pekerjaan berat sudah dipindah ke antrean?
- [ ] Respons di-stream, atau pengguna menunggu diam?
