# SNOUTY — Konteks Ringkas untuk Brainstorming

Dokumen ini berdiri sendiri: cukup untuk Claude (atau orang baru) memahami SNOUTY tanpa membaca
seluruh `docs/`. Status per 7 Oktober 2026.

## 1. Apa itu SNOUTY

AI Pipe Solution Assistant milik PT Pralon (produsen pipa plastik Indonesia: PVC, HDPE, PPR,
fitting, dan sistem perpipaan). Pengguna (kontraktor, pemilik rumah, konsultan, tim sales)
menjelaskan kebutuhan dalam bahasa sehari-hari, Indonesia atau Inggris, dan SNOUTY:

1. memahami kebutuhan (jenis bangunan, lantai, kamar mandi, sumber air; atau kasus teknis seperti
   transfer bertekanan, gravitasi, kolam, irigasi);
2. menanyakan data yang kurang lewat kartu klarifikasi, bukan menebak;
3. menghitung ukuran pipa, kebutuhan pompa, dan BOM dengan aturan teknik ber-ID;
4. memetakan hasil ke produk Pralon aktif;
5. menjawab pertanyaan produk, pengetahuan perpipaan, dan profil perusahaan dari sumber yang
   bisa ditelusuri;
6. menghasilkan laporan PDF dua bahasa dan handoff terstruktur ke tim teknis Pralon.

Live di https://ai.pralon.co.id.

## 2. Prinsip yang tidak bisa ditawar

- LLM bukan sumber kebenaran teknik. Perhitungan tidak pernah memanggil model.
- Tidak pernah mengarang data produk, nilai teknik, atau harga. Tidak tahu → `UNAVAILABLE`,
  pertanyaan klarifikasi, atau rute ke validasi teknis.
- Setiap nilai yang ditampilkan membawa provenance (`VERIFIED` / `ASSUMED` / `ESTIMATED` /
  `UNAVAILABLE`). Aturan berstatus `REQUIRES_DOMAIN_VALIDATION` tidak pernah menghasilkan
  `VERIFIED`.
- Hanya produk Pralon yang direkomendasikan.
- Aturan bisnis di kode, bukan di prompt. Aturan yang hanya ada di prompt dianggap tidak ada.
- State percakapan terstruktur, bukan riwayat chat mentah. Eksekusi selektif per pesan.
- Tanpa metatext dan tanpa "AI slop" di teks yang dilihat pengguna.
- Monolith modular, tanpa microservices, tanpa Python, tanpa Qdrant sampai ada kebutuhan konkret.

## 3. Bentuk sistem

- pnpm monorepo: `apps/web` (Next.js 16), `apps/api` (NestJS + Drizzle/MySQL, SSE),
  `apps/worker` (RabbitMQ + Chromium untuk PDF), `packages/engineering` (TypeScript murni, tanpa
  I/O), `packages/shared-types`.
- Produksi: docker compose di satu server 4 CPU tanpa GPU (`192.168.1.10`), nginx bersama,
  MySQL, Redis, RabbitMQ, Ollama dengan `qwen2.5:7b-instruct` (gratis, lokal).
- Setiap commit langsung dirilis ke produksi dan diverifikasi.
- Skema lengkap: `ARSITEKTUR_SKEMA.md` di folder ini.

## 4. Yang sudah ada (ringkas, per fase)

- Fase 0–9: fondasi monorepo, katalog produk (impor ERP, 7.681 SKU), auth (tamu + akun), context
  engine (intent, ekstraksi, klarifikasi, snapshot), mesin teknik bangunan (ENG-001…009),
  matcher katalog, tampilan solusi, laporan PDF, handoff, back-office minimal, kebijakan cakupan.
- Fase 10–13: kasus teknis universal (bertekanan ENG-201…206, gravitasi/gorong-gorong
  ENG-401…404, kolam ENG-301…304, irigasi ENG-101…105), registry parameter dan asumsi,
  klasifikasi kasus dari bentuk kalimat, penjelasan per aturan dua bahasa.
- Fase 14: evaluasi otomatis (skenario, ambang), ekstensi ukuran pipa mm, streaming SSE.
- Fase 15: dua bahasa penuh (ID/EN) di engine, tampilan, laporan; checkpoint 12 skenario EN.
- Fase 16 (sedang berjalan): subjek percakapan aktif dan koreferensi ("boleh", "lengkap dong",
  "bandingin sama PVC", "yang mana buat …"), modul `company-knowledge` dari materi HRGA, modul
  `pipe-knowledge` (bahan dan konsep tanpa angka), balasan sosial tanpa model, akun pop-up,
  komposer baru, format tabel, diet panggilan model.

## 5. Bagaimana satu pesan diproses

Urutan: sosial → lanjutan subjek aktif → intent pasti dari bentuk kalimat (perusahaan, produk,
pengetahuan, harga, kebutuhan bangunan, irigasi, kasus teknis) → baru model untuk klasifikasi
intent bila tidak ada yang cocok → pagar di kode (presedensi kebutuhan, pesaing, perusahaan,
subjek). Untuk kebutuhan bangunan, fakta tersurat dibaca kode; ekstraksi model hanya bila kode
menangkap kurang dari dua data inti. Rincian di `ARSITEKTUR_SKEMA.md` §3.

## 6. Angka yang mengubah keputusan

| Hal                                                                             |                               Nilai |
| ------------------------------------------------------------------------------- | ----------------------------------: |
| Kecepatan model di server (prompt / jawaban)                                    |                23 tok/s / < 1 tok/s |
| Giliran dengan panggilan model (sebelum diet)                                   |                            40–180 s |
| Giliran deterministik (sosial, perusahaan, pengetahuan, harga, lanjutan subjek) |                               0–2 s |
| Model berbayar kelas Sonnet/Haiku per giliran (perkiraan)                       |              3–6 s, kira-kira Rp 20 |
| SKU katalog aktif                                                               |                               7.681 |
| Aturan teknik ber-ID                                                            | ENG-001…ENG-405 (lima profil kasus) |

Eksperimen model 3B di server yang sama: hanya 2× lebih cepat dan Ollama melayani satu permintaan
sekaligus di CPU, jadi tidak ada keuntungan nyata. Dihapus.

## 7. Keputusan pemilik yang sudah diambil

- Hanya model gratis (2026-10-06). Lineup: satu `qwen2.5:7b-instruct` untuk semua tingkat.
- Setiap commit langsung naik ke produksi (2026-10-07).
- Harga nonaktif (OQ-03): kolom harga tidak dirender; pertanyaan harga dijawab dengan arahan ke
  tim sales.
- Tidak ada metatext di chat maupun UI; akun berbentuk pop-up dengan satu tombol Simpan.
- Materi HRGA "Snouty Product Knowledge Master v1.0" (DRAFT_FOR_VALIDATION) dipakai untuk fakta
  kualitatif; angka yang ditandai "perlu validasi" tidak dibawa.

## 8. Pertanyaan terbuka yang relevan untuk brainstorming

Daftar lengkap di `docs/OPEN_QUESTIONS.md`. Yang paling menentukan arah:

- **OQ-52** Latensi: tetap CPU gratis, GPU, atau model berbayar?
- **OQ-53** Field profil akun tambahan (perusahaan, peran, telepon) perlu atau tidak?
- **OQ-54** Sumber korporat: visi/misi, jaringan distribusi, register sertifikat, tahun tonggak,
  spesifikasi produk resmi untuk angka.
- **OQ-55** Kode produk resmi (SKU sekarang ID ekspor ERP, disembunyikan dari pengguna).
- Validasi domain: siapa yang memvalidasi aturan ENG dan dalam bentuk apa.
- Retrieval dokumen dengan embedding gratis untuk pertanyaan di luar konsep yang dikurasi
  (penyandi `bge-m3` sudah terpasang untuk pemahaman pertanyaan sejak P16-11 — langkah berikutnya
  tinggal mengindeks dokumen, bukan memasang infrastruktur baru).
- Siapa yang merawat `data/understanding/` (contoh kalimat per maksud) setelah serah terima.
- Cakupan berikutnya: email intelligence, market intelligence, back-office penuh.

## 9. Glosarium

- **Provenance**: label asal nilai (`VERIFIED` katalog/aturan tervalidasi, `ASSUMED` asumsi
  registry, `ESTIMATED` hasil hitung dari asumsi, `UNAVAILABLE` tidak ada data).
- **Data inti**: empat fakta yang wajib sebelum menghitung bangunan: jenis bangunan, jumlah lantai,
  jumlah kamar mandi, sumber air.
- **Kartu klarifikasi**: pertanyaan terstruktur dengan pilihan, bukan teks bebas, untuk data yang
  kurang.
- **Subjek aktif**: entitas yang sedang dibicarakan (perusahaan, produk/keluarga, bahan, kasus)
  beserta topik dan kedalaman jawaban terakhir.
- **Parameter universal**: masukan kasus teknis lintas profil (`design_flow`, `route_length`,
  `static_head`, `slope`, …) dengan registry label dua bahasa.
- **Snapshot**: rekaman state kebutuhan append-only per perubahan, dengan pemicu.
- **Handoff**: paket terstruktur (state, hasil, asumsi, catatan) untuk tim teknis Pralon.
- **OQ-nn**: nomor pertanyaan terbuka di `docs/OPEN_QUESTIONS.md`.
