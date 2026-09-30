---
name: testing-and-review
description: Gunakan saat menulis tes apa pun, mengubah perilaku yang sudah ada, menambah kasus ke golden dataset evaluasi, menyiapkan atau mengubah pipeline CI, atau melakukan review kode sebelum menyelesaikan sebuah item. Juga saat hendak mengklaim sebuah item selesai.
---

# Pengujian, Evaluasi, dan Review

Rujukan lengkap: `docs/EVALUATION.md` dan `docs/CODING_STANDARDS.md` §7, §11.

## Piramida

| Lapisan | Cakupan |
|---|---|
| Unit | setiap aturan teknik, setiap policy object, `ContextMerger`, `moodFor`, gerbang provenance |
| Kontrak | setiap skema zod, bentuk event SSE |
| Integrasi | repository + orkestrasi, terhadap **kontainer MySQL sekali pakai** |
| Komponen | rendering provenance di kedua tema, mood mascot, reduced motion |
| E2E | alur konsultasi: welcome → klarifikasi → analisis → solusi → laporan |

Cakupan: `packages/engineering` dan `policy` **≥ 95%**; sisanya seperlunya. Angka tidak seragam
disengaja — mengejar 95% di kode glue infrastruktur menghasilkan tes yang menguji mock.

## Tiga tes release blocker

1. Pertanyaan kompetitor tidak pernah menghasilkan kartu produk kompetitor.
2. Aturan `REQUIRES_DOMAIN_VALIDATION` tidak pernah menghasilkan `VERIFIED`.
3. Tamu tidak bisa mengakses kapabilitas lanjutan lewat API meski UI dilewati.

Ketiganya punya berkas sendiri dan tidak boleh di-skip.

## Invarian = spesifikasi tes

14 invarian di `docs/DOMAIN_MODEL.md` §9 adalah daftar tes, bukan catatan. Saat menyentuh area yang
terkait, pastikan invariannya masih diuji.

## Aturan menulis tes

- Nama menyatakan perilaku: `menolak VERIFIED saat aturan belum divalidasi`.
- Satu perilaku per tes.
- Tanpa tanggal nyata, acak, atau urutan yang tidak deterministik.
- **Perubahan perilaku disertai perubahan tes, dalam commit yang sama.**
- Tes N+1 memakai penghitung query, bukan pemeriksaan manual.
- Tes degradasi: chat tetap jalan saat RabbitMQ mati dan saat Redis dikosongkan.

## Evaluasi AI

Berbeda dari tes: tes menjawab "apakah kode benar", evaluasi menjawab "apakah model masih memahami
pengguna kita". Keluaran model bisa berubah tanpa satu baris kode berubah.

Golden dataset di `evals/`, kasus awal diambil dari alur contoh di desain — perilaku yang sudah
ditinjau manusia.

| Metrik | Ambang |
|---|---|
| Akurasi intent | ≥ 95% |
| Akurasi per field | ≥ 90% |
| **Laju halusinasi** | **0%** |
| **Kesesuaian kebijakan** | **100%** |
| Kelolosan validasi skema | ≥ 95% |

Dua ambang mutlak: model yang **mengisi** `floors: 2` dari kalimat yang tidak menyebut lantai lebih
berbahaya daripada yang mengosongkannya (yang kosong akan ditanyakan, yang salah akan dihitung); dan
kegagalan kebijakan berarti ada jalur yang melewati penegakan.

Ukur **per field** — 90% yang selalu meleset di `waterSource` adalah masalah berbeda dari 90% yang
menyebar merata.

Evaluasi berjalan di CI **hanya** saat berkas terkait AI berubah (prompt, skema, routing, intent
router, dataset). Perubahan CSS tidak mengubah akurasi ekstraksi, dan panggilan model berbiaya.

Kasus yang gagal di produksi (jempol bawah, "tandai analisis salah") **masuk ke golden dataset** —
itu yang mengubah keluhan menjadi perbaikan terukur.

## CI

Setiap PR: install → lint → typecheck → unit → integrasi (kontainer MySQL) → suite policy &
engineering → build `web` dan `api`. Evaluasi kondisional. Pemindaian secret dan dependensi.

**CI tidak pernah terhubung ke `192.168.1.136`** — ditegakkan oleh assertion host di bootstrap tes,
bukan hanya oleh konfigurasi. Konfigurasi bisa salah; assertion tidak.

## Checklist review

- [ ] Aturan bisnis ada di kode, bukan hanya di prompt?
- [ ] Setiap nilai yang ditampilkan membawa provenance?
- [ ] Bisakah aturan belum tervalidasi menghasilkan `VERIFIED` di jalur ini?
- [ ] Batas modul dan arah dependensi terjaga?
- [ ] Controller dan komponen bebas logika bisnis?
- [ ] Perubahan perilaku disertai tes?
- [ ] Ada data katalog, nilai teknik, atau harga yang dikarang?
- [ ] Ada secret, data pribadi, atau stack trace bocor?
- [ ] Ada panggilan LLM yang sebenarnya bisa dihindari?
- [ ] **Asumsi baru dicatat sebagai OQ, bukan diputuskan diam-diam?**

Poin terakhir paling mudah terlewat dan paling penting di fase ini.

## Sebelum menandai item `[x]`

Item hanya `[x]` bila **selesai dan tesnya lulus** (item kode) atau **pemilik sudah menyetujui**
(checkpoint). Jalankan tesnya; jangan klaim dari asumsi. Lalu perbarui `docs/PROGRESS.md` dan commit
dengan ID item.
