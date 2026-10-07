# SNOUTY — Aturan Proyek

SNOUTY adalah AI Pipe Solution Assistant untuk Pralon. Dokumen ini hanya aturan; penjelasan
lengkapnya ada di `docs/`.

## Setiap sesi

1. Baca `docs/SPEC.md`, `docs/PROGRESS.md`, dan `design-input/DESIGN_DECISIONS.md` (bila ada).
2. Laporkan: fase saat ini, item terakhir yang selesai, blocker, item berikutnya.
3. Perbarui `docs/PROGRESS.md` setiap item selesai, lalu commit.

## Bahasa

Balas pengguna dalam **Bahasa Indonesia**. Dokumen di `docs/` juga Bahasa Indonesia.
Kode, identifier, enum, SQL, dan pesan commit tetap Inggris.

## Aturan inti

- **LLM bukan sumber kebenaran teknik.** Perhitungan teknik tidak pernah memanggil LLM.
- **Jangan pernah mengarang** data produk, nilai teknik, atau harga. Tidak tahu → `UNAVAILABLE`,
  pertanyaan klarifikasi, atau rute validasi teknis.
- **Setiap nilai yang ditampilkan membawa provenance.** Aturan `REQUIRES_DOMAIN_VALIDATION` tidak
  pernah menghasilkan `VERIFIED`.
- **Hanya produk Pralon.** Kompetitor boleh dibahas sebagai konteks, tidak pernah direkomendasikan.
- **Aturan bisnis hidup di kode, bukan di prompt.** Aturan yang hanya ada di prompt dianggap tidak
  ada.
- **State percakapan terstruktur**, bukan riwayat chat mentah.
- Eksekusi selektif: jangan jalankan seluruh pipeline untuk setiap pesan.

## Pemahaman pertanyaan pengguna

**Pertanyaan pengguna tidak pernah di-hardcode** (keputusan pemilik 2026-10-07).

- Tidak ada daftar kalimat, frasa, atau regex di kode yang menebak *apa yang ditanya* pengguna
  ("harganya berapa", "ukuran apa aja", "boleh", "lengkap dong", "cara nyambung"). Pemahaman
  bahasa adalah tugas model, atau mekanisme umum berbasis data (contoh intent sebagai data,
  kemiripan semantik) yang bisa ditambah tanpa mengubah kode.
- Yang boleh di kode: aturan bisnis dan pagar (intent mana boleh ke mana, apa yang tidak boleh
  dikarang, presedensi), parser nilai terstruktur (angka, satuan, enum), dan jawaban yang
  bersumber.
- Latensi bukan alasan menambah pola kalimat. Bila model lambat, pilihannya model yang lebih
  cepat atau mekanisme umum, bukan daftar frasa baru.
- Pola kalimat yang sudah ada dianggap utang teknis yang harus dimigrasi, bukan contoh untuk
  diikuti.

## Teks yang dilihat pengguna

**Tidak pernah ada metatext dan AI slop.** SNOUTY tampil sebagai teknisi Pralon, bukan bot.

- Balasan chat: prosa mengalir atau pertanyaan poin biasa. Tanpa judul bagian tebal, tanpa
  bagian bernomor "data/asumsi", tanpa kalimat tentang data, asumsi, model, atau AI sebagai
  konsep, tanpa pembuka basa-basi ("Tentu!", "Berikut adalah…"), tanpa penutup ringkasan.
- UI: tanpa label internal (versi katalog, ID impor, nama aturan, "langkah n dari m"), tanpa
  tautan atau tombol yang tidak punya layar di baliknya, tanpa placeholder yang berpura-pura.
- Struktur terstruktur milik layar solusi, bukan gelembung chat.
- Ragu apakah sebuah teks "kelihatan bikinan AI" → anggap iya, tulis ulang seperti teknisi.

## Kode

- Clean Code, keterbacaan lebih dulu. OOP hanya bila membantu. Komentar menjelaskan **mengapa**.
- Tidak ada logika bisnis di controller atau komponen React.
- Jaga batas modul dan arah dependensi (`docs/ARCHITECTURE.md` §7).
- Periksa kode yang sudah ada lebih dulu; jangan menulis ulang modul yang berfungsi tanpa alasan.
- Perubahan perilaku disertai perubahan tes, dalam commit yang sama.

## Database

**Pengembangan memakai MySQL lokal** (`docker compose up -d mysql`, port 3316). Migration diterapkan
ke sana langsung, tanpa upacara persetujuan. Prosedur: `docs/DATABASE.md` §4a.

MySQL 8 di `192.168.1.136` adalah **infrastruktur bersama** yang memuat tujuh database aplikasi lain.
Ia tujuan akhir, bukan tujuan harian — dan aturan di bawah berlaku penuh begitu ia disentuh:

- **Tidak ada migration tanpa persetujuan pemilik** dan backup yang dikonfirmasi.
- Tidak pernah `DROP DATABASE`, reset skema, `TRUNCATE` tanpa izin, atau force-reset.
- Inspeksi selalu read-only lebih dulu. CI tidak pernah terhubung ke host ini.
- Prosedur lengkap: `docs/DATABASE.md` §4.

## Desain

Keluaran Claude Design adalah sumber kebenaran visual. **Jangan merancang ulang.**
Logika prototipe (formula sizing, harga, regex, timer) bersifat ilustratif — jangan disalin.
Urutan sumber kebenaran: `docs/DESIGN_IMPLEMENTATION.md` §1.

## Ambiguitas

Ambiguitas dan konflik masuk ke `docs/OPEN_QUESTIONS.md` dengan usulan default — **tidak pernah
menjadi asumsi diam-diam**. Lanjutkan pekerjaan yang tidak terhalang.

## Git

- Branch per fase/item: `phase-<n>/<item-id>-<nama-singkat>`.
- Commit diawali ID item: `P1-03: add catalog import validator`.
- Tidak pernah commit secret atau `.env`. Tidak pernah push ke `main`. Tidak pernah force-push.

## Deploy

**Setiap perubahan yang di-commit langsung naik ke server produksi** (keputusan pemilik 2026-10-07).
Setelah commit + push: `git pull` di `~/snouty` pada `snouty@192.168.1.10`, lalu
`deploy/deploy.sh release` (pull → build → up → smoke). Bila ada migration baru, urutannya
`build → migrate → up → smoke`. Verifikasi di https://ai.pralon.co.id sebelum melapor selesai.
Prosedur dan batasan server: `docs/DEPLOYMENT.md`.

## Batasan teknis

Monolith modular — tidak ada microservices. Tidak ada Python kecuali ada kebutuhan konkret.
Qdrant hanya bila kriteria di `docs/PRODUCT_KNOWLEDGE.md` §5 terpenuhi.
