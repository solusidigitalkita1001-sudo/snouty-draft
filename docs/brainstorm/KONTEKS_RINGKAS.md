# SNOUTY — Konteks Ringkas untuk Brainstorming

Dokumen ini berdiri sendiri: cukup untuk Claude (atau orang baru) memahami SNOUTY tanpa membaca
seluruh repositori. Status per **12 Oktober 2026**.

## 1. Apa itu SNOUTY

Asisten solusi pipa milik PT Pralon (produsen pipa plastik Indonesia: uPVC, HDPE, MDPE, fitting,
pipa jacking, conduit). Pengguna — kontraktor, pemilik rumah, konsultan, sales — bercerita dalam
bahasa sehari-hari (Indonesia atau Inggris), lalu SNOUTY:

1. memahami kebutuhannya (rumah, gedung bertingkat, kolam/tambak, drainase, transfer pompa, sumur,
   irigasi, air hujan, gorong-gorong, cluster perumahan);
2. menanyakan data yang kurang lewat kartu pilihan, bukan menebak;
3. **menghitung** ukuran pipa, pompa, tangki, zona tekanan, dan material dengan aturan teknik
   ber-ID (tidak pernah oleh model bahasa);
4. mencocokkan hasilnya ke produk Pralon aktif di katalog;
5. menjawab pertanyaan produk dan pengetahuan perpipaan dari sumber yang bisa ditelusuri;
6. menggambar skema, membuat laporan PDF, dan meneruskan kasus ke tim teknis Pralon bila perlu.

Live di https://ai.pralon.co.id. Prinsip pemilik: **hitung dulu**; tim teknis adalah tambahan,
bukan jalan keluar ketika sistem tidak mau menghitung.

## 2. Prinsip yang tidak bisa ditawar

- Model bahasa bukan sumber kebenaran teknik. Perhitungan tidak pernah memanggil model.
- Tidak mengarang data produk, nilai teknik, atau harga. Tidak tahu → `UNAVAILABLE`, pertanyaan
  balik, atau validasi teknis.
- Setiap nilai membawa provenance: `VERIFIED` / `ASSUMED` / `ESTIMATED` / `UNAVAILABLE`. Aturan yang
  belum divalidasi ahli (semuanya, hari ini) tidak pernah menghasilkan `VERIFIED`.
- Hanya produk Pralon yang direkomendasikan; pesaing hanya konteks.
- Aturan bisnis di kode, bukan di prompt.
- **Pertanyaan pengguna tidak pernah di-hardcode**: tidak ada regex/daftar frasa yang menebak apa
  yang ditanya. Pemahaman dari contoh kalimat sebagai data (kemiripan vektor) atau dari model.
- Tanpa metatext dan "AI slop": SNOUTY bicara seperti teknisi Pralon.
- Monolith modular, tanpa microservices, tanpa Python.

## 3. Bentuk sistem

- pnpm monorepo: `apps/web` (Next.js), `apps/api` (NestJS + Drizzle/MySQL, SSE), `apps/worker`
  (RabbitMQ + Chromium untuk PDF), `packages/engineering` (TypeScript murni tanpa I/O — semua
  rumus), `packages/shared-types`.
- Produksi: satu server, seluruhnya di kontainer — web, API, pekerja latar, basis data,
  cache, antrean pekerjaan, dan layanan model.
- Model bahasa berjalan di server sendiri, tanpa mengirim data ke luar, dan bisa diganti tanpa
  mengubah sistem. Pemahaman pertanyaan memakai layanan terpisah dari layanan penjawab, supaya
  keduanya tidak saling mengantre.
- Setiap commit langsung dirilis ke produksi dan dicek di situs.
- Skema lengkap: `ARSITEKTUR_SKEMA.md`. Rumus: `MESIN_HITUNG.md`.

## 4. Yang sudah ada

- **Katalog**: impor ERP 2026-10-06 — 7.681 SKU aktif, 24 keluarga; dihitung sebagai 7.664 produk
  berbeda (salinan ERP dan SKU bernama sama dihitung sekali, jumlah SKU tetap disebut).
- **Pemahaman**: ±1.900 contoh kalimat berlabel (intent, topik pengetahuan, jenis kasus, aspek
  produk, format, kedalaman) di `data/understanding/`, disandikan jadi vektor. Golden eval: intent
  139/139 + 15 kasus topik.
- **Mesin hitung** (58 aturan ber-ID, semua menunggu validasi ahli):
  rumah air bersih (debit puncak kurva Hunter + hidraulik), rumah pembuangan (unit beban buangan,
  jalur air kotor/air bekas + ventilasi), gedung bertingkat (kebutuhan, zona tekanan per lantai,
  pompa transfer, riser, tangki bawah/atap), transfer bertekanan/sumur, gravitasi/drainase/air
  hujan/gorong-gorong, kolam, irigasi, cluster perumahan.
- **Jawaban pengetahuan**: fakta bersumber (`data/knowledge/pipe-facts.json`, dari Knowledge Master
  HRGA + katalog) dirangkai deterministik; saklar **Hemat | Kualitas** — hemat menampilkan DATA
  langsung (±0,1 s), kualitas membiarkan model merangkai ulang DATA itu (angka dijaga pagar).
- **Layar solusi v2 (13 Okt, DD-01)**: ringkasan bergambar (gambar bangunan, kartu kebutuhan per
  lantai, alur air); tab Produk bergambar (foto pralon.com untuk AW/VP/Jacking, gambar jenis untuk
  lainnya) yang diturunkan dari BOQ; Estimasi Material = BOQ per sistem (air bersih/air kotor/air
  bekas) + tabel dasar perhitungan + tabel asumsi berkategori yang bisa diubah; tab Denah = potongan
  instalasi + denah jalur per lantai + "Coba ubah" (skenario dihitung ulang engine, tanpa simpan);
  kartu pertanyaan bergambar; laporan PDF dengan struktur yang sama.
- **Akun**: tamu + akun terdaftar (wajib nomor HP sejak 12 Okt), laporan PDF untuk akun terdaftar.
- **Audit 9–12 Oktober**: diameter dalam dari OD resmi (bukan nominal), presisi rantai hitung, zona
  tekanan dari elevasi, BOM tanpa angka karangan, pagar keluaran model atas penanda teknis
  (PN/SDR/SNI) — rincian `docs/ENGINEERING_AUDIT.md`.

- **Masukan pengguna awam (16 Okt, Fase 22)**: contoh rumah bergambar di layar sambutan (subsidi tipe
  30/36, 2 lantai, ganti pipa lama) — nilainya asumsi bertanda contoh yang bisa diubah; kartu **Tinggi
  toren** (dak vs tiang toren 3–8 m, tekanan tiap pilihan, mana yang cukup tanpa pompa) di solusi dan PDF;
  jawaban chat tentang solusi aktif dibangun di atas angka hasil hitung (ukuran, pompa, BOQ) dan
  pertanyaan bentuk sistem membawa gambar potongan instalasi; field "ganti pipa lama ke Pralon"; dua
  kasus proyek baru: jaringan air minum (SPAM) dan jaringan air limbah (sewerage). 58 aturan.

## 5. Angka yang mengubah keputusan

| Hal                                                          | Nilai                                     |
| ------------------------------------------------------------ | ----------------------------------------- |
| Giliran pengetahuan/produk mode hemat                        | ±0,1 s di server                          |
| Analisis "Susun rekomendasi" di server                       | ±50 ms (engine 3 ms, katalog 31 ms)       |
| Rangkai ulang model 9B (mode kualitas)                       | 20–25 s                                   |
| Model 4B                                                     | 12–14 s, tetapi lebih sering salah        |
| Perencana giliran (model) bila kalimat tidak dikenali        | ±8 s                                      |
| SKU / produk berbeda                                         | 7.681 / 7.664                             |
| Aturan teknik ber-ID                                         | 45, semuanya `REQUIRES_DOMAIN_VALIDATION` |
| FAQ pemilik (52 pertanyaan) dijawab layak, uji live terakhir | ±47/52                                    |

## 6. Keputusan pemilik yang sudah diambil

- Model gratis/lokal dulu; model berbayar hanya bila terbukti perlu (bandingkan kualitas, latensi,
  biaya dulu).
- Setiap commit langsung naik ke produksi.
- Harga tidak ditampilkan (OQ-03); pertanyaan harga diarahkan ke sales.
- Gedung > 4 lantai **dihitung** (bukan dioper ke tim teknis). Pembuangan rumah **dihitung**.
- Pertanyaan pengguna tidak di-hardcode (2026-10-07).
- Laporan PDF tersedia untuk akun terdaftar.
- Nomor HP wajib saat daftar (2026-10-12).
- Layar solusi & laporan v2 (2026-10-13, `design-input/DESIGN_DECISIONS.md` DD-01): BOQ tanpa harga,
  ilustrasi digambar khusus untuk semua kasus dan pilihan, ringkasan maksimal 2 kalimat, label versi
  internal tidak dicetak ("Data produk per …"). Keputusan pemilik diajukan sebagai pilihan.

## 7. Pertanyaan terbuka yang paling menentukan arah

Rincian dan pilihan di `TOPIK_BRAINSTORM.md`; daftar lengkap di `docs/OPEN_QUESTIONS.md`.

- **Validasi domain**: siapa di Pralon memvalidasi 58 aturan dan nilai asumsinya (OQ-06, OQ-57,
  OQ-58). Semua angka masih IPC/buku acuan, belum padanan SNI 8153.
- **Data resmi yang belum ada**: tabel tebal dinding per kelas, tekanan kerja resmi AW/D/PN, TDS
  solvent cement, tabel ketahanan kimia, umur pakai, kode produk pelanggan (OQ-54, OQ-55).
- **Model**: tetap di server sendiri, perangkat yang lebih kencang, atau berbayar per giliran.
- **Denah**: pengguna sudah bisa melampirkan denah, tetapi sistem belum membacanya (OQ-56). Denah
  yang digambar SNOUTY (13 Okt) skematik: alat berurutan di cabangnya, letak ruang tidak dikarang.
- **Foto produk**: foto PVC D/VU dan per jenis fitting diminta ke tim Pralon (OQ-62); fitting
  (elbow, sok, Y, clean out) belum dihitung jumlahnya — "dihitung saat pemasangan".
- **Kebutuhan air per jenis gedung** (kantor/hotel/rumah sakit) masih satu nilai untuk semua.
- **Lanjutan produk**: email/market intelligence, back-office, nomor HP ke tim teknis saat handoff.
- **Default Fase 22 yang belum ditinjau pemilik** (OQ-67–70): tinggi tiang toren 3/4/5/6/8 m dan ambang
  "deras di shower" 0,7 bar; gaya gambar sistem pipa (isometrik?) butuh Claude Design; estimasi ganti pipa
  tanpa rupiah selama katalog tanpa harga; kriteria SPAM/sewerage (100 l/jiwa/hari, 5 jiwa/SR, faktor
  puncak, minimum pipa air limbah 6", keluarga PVC D).

## 8. Glosarium

- **Provenance**: label asal nilai (`VERIFIED`, `ASSUMED`, `ESTIMATED`, `UNAVAILABLE`).
- **Data inti rumah**: sumber air, jenis instalasi, jumlah lantai, kamar mandi. Penyempurna: ukuran
  rumah, dapur, wastafel.
- **Kartu klarifikasi**: pertanyaan berpilihan untuk data yang kurang ("Belum tahu" selalu ada).
- **Asumsi registry**: nilai yang dipakai ketika pengguna tidak menyebutnya — tampil di layar, bisa
  diganti, lalu dihitung ulang.
- **WSFU / DFU**: unit beban alat plambing untuk suplai / pembuangan.
- **Subjek aktif**: hal yang sedang dibicarakan, untuk memahami "boleh", "yang tadi", "lengkap dong".
- **Handoff**: paket terstruktur ke tim teknis Pralon.
- **OQ-nn**: nomor pertanyaan terbuka di `docs/OPEN_QUESTIONS.md`.
