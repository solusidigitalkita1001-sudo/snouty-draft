# SNOUTY — Keamanan

Fase 0c · P0c-11 · Terakhir diperbarui 2026-09-30

Sumbernya SPEC §30. Aspek privasi ada di `PRIVACY.md`.

---

## 1. Model ancaman

| Ancaman | Dampak | Mitigasi utama |
|---|---|---|
| Tamu menembus entitlement lewat API | akses fitur berbayar | guard di API + tes release blocker |
| Prompt injection lewat dokumen/email | rekomendasi menyimpang, kebocoran | filter katalog di perakitan respons |
| Kebocoran kredensial database | **database tim lain ikut terancam** | lihat §2 |
| Unggahan berbahaya | RCE, penyimpanan malware | pembatasan MIME/ukuran, di luar web root |
| Pencurian token | pengambilalihan akun | cookie `httpOnly`, rotasi refresh |
| Penyalahgunaan endpoint LLM | biaya membengkak | rate limit per tier |
| Akses data pelanggan oleh internal | pelanggaran privasi | RBAC + audit setiap akses |
| Kebocoran system prompt | pemetaan untuk jailbreak | prompt tidak pernah dikirim ke klien |

Baris ketiga adalah yang paling serius di proyek ini, dan penyebabnya bukan kode SNOUTY.

---

## 2. Risiko terbesar hari ini: hak akses database

Akun yang tersedia, `ict`, memegang `ALL PRIVILEGES ON *.* WITH GRANT OPTION` atas **delapan
database** di `192.168.1.136` — termasuk `partner_db`, `work_order`, dan `digital_book` milik
aplikasi lain, total 301 tabel.

Artinya, dalam konfigurasi sekarang:

- `.env` SNOUTY yang bocor memberi penyerang kendali atas basis data tim lain, bukan hanya SNOUTY.
- SQL injection di SNOUTY (seandainya ada) berpotensi menjangkau seluruh server.
- Satu migration yang salah bisa merusak data yang bukan milik proyek ini.

Ini bertentangan langsung dengan SPEC §17 yang menyebut akun aplikasi tidak boleh memegang `DROP`.

**Mitigasi yang diusulkan:** tiga akun terbatas (`snouty_app`, `snouty_migrator`, `snouty_ro`) dengan
lingkup hanya database SNOUTY. Naskah SQL-nya siap di `DATABASE.md` §3 untuk Anda tinjau dan
jalankan; saya tidak mengubah hak akses di infrastruktur bersama (OQ-34).

Sampai itu dilakukan: kredensial diperlakukan setara produksi (hanya di `.env`, tidak pernah di log
atau dokumen), semua akses lewat query berparameter, dan tidak ada migration yang saya jalankan.

Ini dicatat sebagai **release blocker** di `PROGRESS.md`.

---

## 3. Autentikasi

| Aspek | Ketentuan |
|---|---|
| Password | Argon2id, tidak pernah dicatat, tidak pernah dikembalikan |
| Access token | JWT berumur pendek (`JWT_ACCESS_TTL`), di memori klien |
| Refresh token | cookie `httpOnly` + `Secure` + `SameSite=Lax`, **dirotasi setiap pemakaian** |
| Deteksi pemakaian ulang | refresh token lama yang dipakai lagi → seluruh rantai dicabut |
| Sesi tamu | cookie `httpOnly`, ULID, TTL dari config |
| Logout | mencabut refresh token di sisi server, bukan hanya menghapus cookie |

Rotasi dengan deteksi pemakaian ulang adalah pertahanan yang berbayar: bila token dicuri, pemakaian
oleh penyerang **atau** oleh pengguna asli akan membuat keduanya ter-logout — terlihat, bukan diam.

Penautan tamu → akun memindahkan kepemilikan percakapan dalam satu transaksi; kegagalan di tengah
tidak boleh meninggalkan percakapan tanpa pemilik.

---

## 4. Otorisasi

Tiga lapis (`POLICY.md` §2): UI menyembunyikan, API guard menolak, perakitan respons menyaring.

| Sumber daya | Aturan |
|---|---|
| Percakapan | hanya pemilik (user atau guest session) |
| Rekomendasi, BOM, skema | pemilik + entitlement tier |
| Laporan | pemilik + peran internal berwenang, setiap akses diaudit |
| Rute `/internal/*` | peran spesifik, setiap tulis diaudit |
| Katalog (baca) | publik bagi pengguna terautentikasi maupun tamu |

Pemeriksaan kepemilikan dilakukan di lapisan application, bukan hanya lewat filter query. Perbedaan
ini mencegah kelas bug IDOR: menghilangkan klausa `WHERE owner_id = ?` di satu repository seharusnya
tidak cukup untuk membocorkan data.

---

## 5. Validasi masukan

| Titik | Alat |
|---|---|
| DTO HTTP | zod, `strict()` — properti tak dikenal ditolak |
| Keluaran terstruktur LLM | zod, enum tertutup, batas numerik |
| Berkas unggahan | MIME + magic bytes + ukuran |
| Parameter query | diketik, dibatasi, paginasi dibatasi maksimum |
| Payload webhook n8n | verifikasi tanda tangan HMAC |

`strict()` disengaja: mengabaikan field asing terasa longgar sampai suatu hari ada field asing yang
berfungsi.

Semua akses database lewat query berparameter melalui ORM. Tidak ada SQL yang dirangkai dari string
di luar `infrastructure/mysql`.

---

## 6. Prompt injection

Dua sumber tidak tepercaya: dokumen hasil retrieval dan email masuk. Keduanya bisa memuat instruksi
yang ditujukan kepada model.

Pertahanan berlapis (lihat juga `AI_BEHAVIOR.md` §8):

1. Konten tidak tepercaya dibungkus pembatas dan diberi label sebagai **data, bukan instruksi**.
2. `AssistantCard` adalah union tertutup — tidak ada jalur render untuk HTML/markdown bebas.
3. **Daftar produk difilter terhadap katalog** di perakitan respons.
4. Keluaran terstruktur divalidasi; enum tertutup menolak nilai karangan.
5. Email tidak pernah memicu balasan otomatis.

Lapisan 3 yang menentukan. Semua lapisan lain bisa ditembus dengan prompt yang cukup kreatif; yang
tidak bisa ditembus adalah kenyataan bahwa produk tanpa baris di tabel `products` tidak punya
`productId` untuk dirender.

---

## 7. Unggahan

Fitur "Lampirkan denah" adalah satu-satunya tempat pengguna mengirim berkas.

| Kontrol | |
|---|---|
| Tipe | hanya PDF, PNG, JPG, WEBP — diperiksa MIME **dan** magic bytes |
| Ukuran | `UPLOAD_MAX_MB`, diselaraskan dengan `client_max_body_size` Nginx |
| Penyimpanan | `STORAGE_PATH` di luar web root, nama file dibangkitkan (ULID), nama asli hanya metadata |
| Penyajian | lewat endpoint terautentikasi, tidak pernah sebagai berkas statis |
| Pemindaian | kait antivirus bila tersedia; tanpa itu, tipe dibatasi ketat |
| `Content-Disposition` | `attachment` untuk semua unduhan |
| Retensi | 180 hari (`PRIVACY.md`) |

Nama file dibangkitkan bukan demi kerapian: nama asli dari pengguna adalah vektor path traversal dan
XSS yang klasik.

---

## 8. Rate limiting

Berbasis Redis, per tier (`POLICY.md` §10). Dimensi yang dibatasi: pesan/jam, token/hari, stream
bersamaan, kasus lanjutan/hari, skema/hari, laporan/hari, unggahan/hari.

Batas terpisah untuk endpoint yang mahal: pembuatan laporan dan impor katalog punya kuota sendiri,
karena satu permintaan di sana berharga jauh lebih mahal daripada satu pesan chat.

Endpoint autentikasi punya batas ketat berdasarkan IP untuk menghambat credential stuffing.

---

## 9. Header dan CORS

| Header | Nilai |
|---|---|
| `Strict-Transport-Security` | aktif dengan `preload` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | `default-src 'self'`; font di-host sendiri sehingga tidak perlu izin eksternal |
| `X-Frame-Options` | `DENY` |
| `Permissions-Policy` | `geolocation=(self)` — hanya untuk onboarding |

CORS dibatasi ke origin aplikasi; API tidak ditujukan untuk dipakai pihak ketiga. CSRF ditangani
oleh `SameSite=Lax` pada cookie refresh plus kenyataan bahwa access token dikirim lewat header
`Authorization`, bukan cookie.

Karena font IBM Plex di-host sendiri (SPEC §16), CSP bisa dibuat ketat tanpa pengecualian untuk
Google Fonts.

---

## 10. Secret

| | |
|---|---|
| Hanya dari environment; `.env` di `.gitignore` |
| `.env.example` berisi kunci dengan nilai kosong |
| Tidak pernah di log, dokumen, atau pesan commit |
| Secret yang pernah masuk riwayat Git dianggap bocor dan **wajib dirotasi** |
| Secret JWT berbeda untuk access dan refresh |
| Pemindaian secret berjalan di CI |

Aturan rotasi bukan formalitas: menghapus commit tidak menghapus secret dari klon yang sudah
tersebar.

---

## 11. Logging dan audit

**Tidak pernah dicatat:** password, token, kredensial database, isi prompt, data pribadi, isi berkas
unggahan.

**Selalu dicatat:** correlation ID, aktor, aksi, hasil, latensi.

Audit log untuk semua tulis internal, dengan `before`/`after` terbatas pada field yang berubah
(`BACKOFFICE.md` §6).

Galat yang sampai ke klien hanya berisi kode stabil dan pesan aman. Stack trace tetap di log server.

---

## 12. Daftar periksa sebelum produksi

| | Status |
|---|---|
| Akun database least-privilege dibuat | **belum** — OQ-34 |
| Pemilik backup teridentifikasi & restore pernah diuji | **belum** — `DATABASE.md` §8 |
| Enkripsi at-rest MySQL dikonfirmasi | **belum** |
| Perjanjian pemrosesan data dengan penyedia LLM | **belum** |
| Redaksi email sebelum Fase 11 | direncanakan |
| Pemindaian dependensi di CI | direncanakan Fase 0e |
| Pemindaian secret di CI | direncanakan Fase 0e |
| Uji penetrasi | Fase 13 |
| Prosedur pemberitahuan insiden | **belum** — `PRIVACY.md` §10 |

Empat baris pertama semuanya bermuara pada satu hal: SNOUTY menumpang pada infrastruktur yang
kepemilikan operasionalnya belum jelas. Itu perlu diselesaikan sebelum ada data pelanggan nyata di
dalamnya.

---

## 13. Pengujian

| # | Tes |
|---|---|
| 1 | Tamu tidak bisa mengakses kapabilitas lanjutan lewat API (**release blocker**) |
| 2 | IDOR: pengguna A tidak bisa membaca percakapan pengguna B |
| 3 | Refresh token yang dipakai ulang mencabut seluruh rantai |
| 4 | Unggahan dengan MIME palsu ditolak oleh pemeriksaan magic bytes |
| 5 | Dokumen yang memuat instruksi injeksi tidak mengubah daftar produk |
| 6 | SKU di luar katalog tidak pernah dirender sebagai kartu |
| 7 | Rate limit ditegakkan lintas instans (Redis, bukan memori proses) |
| 8 | Galat tidak pernah membocorkan stack trace atau nama tabel |
| 9 | Rute `/internal/*` menolak peran yang tidak sesuai |
| 10 | Tidak ada secret di keluaran log (uji dengan pencocokan pola) |
