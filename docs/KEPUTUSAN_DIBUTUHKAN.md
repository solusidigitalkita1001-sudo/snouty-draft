# SNOUTY — Keputusan yang Dibutuhkan

Terakhir diperbarui 2026-10-02 · Disusun setelah Fase 1–9 selesai dan seluruh pekerjaan yang tidak
bergantung jawaban habis dikerjakan.

`docs/OPEN_QUESTIONS.md` memuat **42 pertanyaan terbuka**, dan itu terlalu banyak untuk dibaca sebelum
memutuskan apa pun. Berkas ini menyaringnya: **delapan keputusan** di bawah membuka hampir seluruh
pekerjaan yang tertahan. Sisanya bisa menunggu.

Setiap butir sudah punya **usulan default** yang saya rancang dan, di beberapa tempat, sudah saya
terapkan. Untuk sebagian besar, jawaban "ya, pakai default" sudah cukup — satu baris per butir.

---

## 1. Yang menahan deployment · **jawab lebih dulu**

### OQ-34 — Akun database adalah superuser seluruh server

**Risiko tertinggi di proyek ini, dan risikonya bukan milik kita sendiri.**

Akun `ict` yang diberikan memegang `ALL PRIVILEGES ON *.* WITH GRANT OPTION` atas `192.168.1.136` —
termasuk tujuh database aplikasi lain (`partner_db`, `work_order`, `digital_book`, dan seterusnya; 301
tabel). Artinya `.env` SNOUTY yang bocor membahayakan data tim lain, bukan hanya data kita. SPEC §17
mewajibkan least privilege dan melarang akun aplikasi memegang `DROP`.

**Yang dibutuhkan:** persetujuan membuat akun terbatas untuk SNOUTY. SQL-nya sudah siap di
`docs/DATABASE.md` §3 — tinggal dijalankan oleh pemilik server, dan saya tidak akan menjalankannya.

**Sampai itu ada:** pengembangan memakai MySQL lokal (`docker compose up -d mysql`), seluruh skrip
menolak host `192.168.1.136`, dan CI punya assertion yang sama. Tidak ada yang hilang dari kecepatan
kerja — yang tertahan hanya deployment.

---

## 2. Yang menahan kebenaran teknik · **dampaknya paling luas**

### OQ-06 — Ahli domain Pralon untuk memvalidasi aturan teknik

Keempat belas aturan teknik (`docs/ENGINEERING_RULES.md`) berstatus `REQUIRES_DOMAIN_VALIDATION`, dan
gerbang provenance menurunkan setiap keluarannya menjadi `ASSUMED`. Konsekuensinya **bukan
administratif**: hari ini tidak ada satu pun angka teknik yang tampil "TERVERIFIKASI" kepada pengguna,
dan tidak akan pernah ada sampai seseorang menandatanganinya. Itu perilaku yang benar — tetapi berarti
produk belum bisa mengatakan hal yang paling ingin dikatakannya.

**Yang dibutuhkan:** satu nama. Seseorang di Pralon yang berwenang menilai apakah, misalnya, ambang
"≥ 8 unit beban → pipa 1 inci" benar.

**Prioritas tertinggi untuk ditinjau**, dari daftar 14:

| Aturan                | Mengapa paling dulu                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **ENG-002**           | Menentukan angka terbesar di layar. Ambang tunggal tanpa panjang jalur, elevasi, atau kerugian gesek hampir pasti penyederhanaan |
| **ENG-011**           | Mengklaim toren atap cukup tanpa pompa — tanpa mengetahui tinggi toren maupun panjang jalur                                      |
| **ENG-001 + ENG-012** | Bobot 2 per kamar mandi berasal dari "1 kamar mandi = shower + kloset"; keduanya harus dinilai bersama                           |
| **ENG-009**           | Seluruh kuantitas BOM, dan tidak satu pun memakai panjang jalur sebenarnya                                                       |

Tiga pertanyaan menyusul dari ahli yang sama: **OQ-22** (dua prototipe memakai ambang berbeda — saya
pakai yang cocok contoh board), **OQ-32** (nilai default "Belum tahu"), **OQ-33** (heuristik sebaran
titik air antar lantai).

### OQ-07 — Sumber katalog produk

Seluruh sistem berjalan di atas **data seed karangan** (`scripts/seed-sample-catalog.mjs`, berlabel
jelas "BUKAN data Pralon"). Jalur impornya sungguhan dan sudah teruji; yang belum ada adalah datanya.

**Yang dibutuhkan:** bentuk katalog yang sebenarnya — berkas Excel? PDF? basis data yang sudah ada?
Dari itu saya menulis adapter-nya (P1-05b), dan endpoint unggah (P1-10c) menyusul.

---

## 3. Yang menahan fitur · **empat keputusan**

### OQ-15 — Entitlement tamu bertentangan dengan prototipe

Onboarding langkah 5 menandai BOM, skema, dan analisis studi kasus sebagai `LANJUTAN` (butuh akun),
tetapi prototipe memberi tamu seluruh workspace solusi termasuk keduanya.

**Usulan default — sudah diterapkan:** ikuti **janji onboarding**, karena itulah yang diperlihatkan
kepada pengguna. Tamu mendapat tanya-jawab, rekomendasi, dan klarifikasi; BOM, skema, simpan, dan
laporan butuh akun. Tabel `ENTITLEMENTS` sudah mengikuti ini dan ditegakkan di API.

**Yang dibutuhkan:** konfirmasi. Bila jawabannya "tamu boleh melihat semuanya", satu tabel diubah dan
tesnya ikut — pekerjaan kecil, tetapi arahnya harus benar.

### OQ-21 — Layar yang belum didesain

Login, register, register-gate, **seluruh back-office**, umpan balik, halaman privasi/ketentuan.

Ini menahan empat item di tiga fase sekaligus: back-office katalog (P1-10), layar auth (P3-12c),
alur validasi aturan (P6-09), peninjauan email (P11-05), dan dashboard pasar (P12-03). Semua API-nya
sudah ada dan teruji — yang tidak ada hanya tampilannya.

**Yang dibutuhkan:** desain, atau izin membangunnya minimal dengan token yang sama dan menandainya
"needs design". Saya belum melakukan yang kedua karena membuat layar tampak selesai akan menyulitkan
desainer nanti.

### OQ-40 — Bagaimana `apps/worker` memakai kode domain `apps/api`

Menahan: transport RabbitMQ (P1-06b), **pembuatan PDF laporan** (P8-08), konsumer email, agregasi pasar.

**Usulan default:** ekstrak kontrak job dan tipe bersama ke `packages/` yang diimpor keduanya; worker
tidak pernah mengimpor `apps/api` langsung. Halaman cetak laporan sudah final, jadi yang tersisa untuk
worker benar-benar hanya "buka halaman ini, cetak ke PDF".

### OQ-27 — Layar register-gate dan resume

Menahan P8-09/P10-04, dan **OQ-15 bergantung padanya**. Mekanisme G-1 (penautan tamu→akun dalam satu
transaksi) sudah hidup dan teruji sejak Fase 3 — yang belum ada hanya layarnya.

---

## 4. Yang bisa dijawab satu baris

Semuanya sudah punya default yang diterapkan; konfirmasi saja sudah cukup.

| OQ        | Pertanyaan                              | Default saya                                                                     |
| --------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| **OQ-03** | Harga masuk lingkup?                    | **Tidak** — `PRICING_ENABLED=false`; kolom harga tidak dirender                  |
| **OQ-08** | "Kirim ke tim teknis" mendarat di mana? | Email ke `TECH_HANDOFF_TARGET` + baris antrean; SLA "1×24 jam kerja" dari config |
| **OQ-09** | Git remote dan provider CI?             | GitHub Actions; berkas workflow sudah ada dan tervalidasi                        |
| **OQ-12** | Teks kebijakan privasi dan ketentuan?   | `POLICY_VERSION=v0-draft` tersimpan di setiap baris consent                      |
| **OQ-43** | `--snouty-caption` gagal kontras AA     | Gelapkan ke ≈`#6E7679`; **tidak saya ubah sendiri** — token milik desain         |
| **OQ-42** | zod di dalam engine, atau guard murni?  | Guard murni; engine tetap nol dependensi runtime                                 |
| **OQ-18** | Seni mascot final                       | Placeholder satu gambar di belakang `MascotSlot` yang mudah diganti              |
| **OQ-16** | Dua palet gelap berbeda                 | Palet prototipe (`#0F1213` canvas)                                               |

---

## 5. Yang tidak perlu jawaban sekarang

Dua puluh OQ lain bertanda `non-blocking`: penyimpangan metrik kecil, mood mascot tambahan, konvensi
sel impor, tag status ekstra. Semuanya punya default yang sudah berjalan dan tidak menahan apa pun.
Mereka layak dibaca saat meninjau fase terkait, bukan sekarang.

---

## Cara tercepat menjawab

Kalau waktunya terbatas, urutan ini yang membuka paling banyak per menit:

1. **OQ-34** — setujui pembuatan akun database terbatas. Membuka deployment.
2. **OQ-06** — sebut satu nama ahli domain. Membuka "TERVERIFIKASI" di seluruh produk.
3. **OQ-07** — kirim satu contoh berkas katalog. Membuka data produk nyata.
4. **OQ-21** — desain layar auth + back-office, atau izinkan versi minimal. Membuka empat item.
5. Bagian 4 — "pakai default semua" bila setuju.

Setelah 1–3 terjawab, SNOUTY berhenti menjadi sistem yang berjalan di atas data karangan dengan setiap
angka bertanda asumsi, dan mulai menjadi produk.
