---
name: security-guardrails
description: Gunakan saat menambah endpoint, guard, atau peran; menangani token, cookie, atau password; memproses unggahan berkas; menulis query database; menangani konten tidak tepercaya dari dokumen atau email; menambah logging; menyentuh kredensial atau file .env; atau mengerjakan consent, retensi data, ekspor, dan penghapusan data pengguna.
---

# Pagar Keamanan

Rujukan lengkap: `docs/SECURITY.md` dan `docs/PRIVACY.md`.

## Risiko terbesar proyek ini

Akun database yang tersedia (`ict`) memegang `ALL PRIVILEGES ON *.* WITH GRANT OPTION` atas
**delapan database** di `192.168.1.136`, termasuk `partner_db`, `work_order`, dan `digital_book`
milik aplikasi lain (301 tabel).

Artinya `.env` SNOUTY yang bocor membahayakan data tim lain, bukan hanya data kita.

Sampai akun terbatas dibuat (OQ-34, SQL siap di `docs/DATABASE.md` §3):
kredensial hanya di `.env` · tidak pernah di log, dokumen, atau commit · semua query berparameter ·
**tidak ada migration yang dijalankan tanpa persetujuan pemilik dan backup terkonfirmasi**.

## Autentikasi

Argon2id · access token JWT pendek · refresh token di cookie `httpOnly`+`Secure`+`SameSite=Lax`,
**dirotasi setiap pemakaian** · pemakaian ulang token lama → seluruh rantai dicabut · logout
mencabut di server.

Penautan tamu → akun dalam **satu transaksi**; kegagalan di tengah tidak boleh meninggalkan
percakapan tanpa pemilik.

## Otorisasi

Tiga lapis: UI menyembunyikan, API guard menolak, perakitan respons menyaring.

Pemeriksaan kepemilikan di lapisan **application**, bukan hanya lewat klausa `WHERE` di repository.
Menghilangkan satu `WHERE owner_id = ?` seharusnya tidak cukup untuk membocorkan data.

Laporan: pemilik + peran internal berwenang saja, setiap akses **diaudit** (memuat data pribadi).

## Validasi masukan

zod `strict()` di setiap DTO — properti tak dikenal **ditolak**, bukan diabaikan. Mengabaikan field
asing terasa longgar sampai ada field asing yang berfungsi.

Keluaran LLM juga divalidasi: enum tertutup, batas numerik. Webhook n8n diverifikasi HMAC.
Semua SQL berparameter; tidak ada perangkaian string di luar `infrastructure/mysql`.

## Prompt injection

Sumber tidak tepercaya: dokumen hasil retrieval dan email.

1. Dibungkus pembatas, ditandai **data bukan instruksi**.
2. `AssistantCard` union tertutup — tidak ada jalur render HTML/markdown bebas.
3. **Daftar produk difilter terhadap katalog** di perakitan respons.
4. Keluaran terstruktur divalidasi.
5. Email tidak pernah memicu balasan otomatis.

Lapisan 3 yang menentukan — semua yang lain bisa ditembus prompt yang cukup kreatif.

## Unggahan

Hanya PDF/PNG/JPG/WEBP, diperiksa MIME **dan magic bytes** · batas `UPLOAD_MAX_MB` diselaraskan
dengan `client_max_body_size` Nginx · disimpan di `STORAGE_PATH` **di luar web root** dengan nama
dibangkitkan (ULID) · disajikan lewat endpoint terautentikasi, `Content-Disposition: attachment` ·
retensi 180 hari.

Nama file dibangkitkan bukan demi kerapian — nama asli dari pengguna adalah vektor path traversal
dan XSS klasik.

## Rate limiting

Berbasis Redis (bukan memori proses — harus berlaku lintas instans), per tier. Kuota terpisah untuk
endpoint mahal (laporan, impor). Batas ketat per IP di endpoint autentikasi.

## Logging

**Tidak pernah:** password, token, kredensial, isi prompt, data pribadi, isi unggahan.
**Selalu:** correlation ID, aktor, aksi, hasil, latensi.
Galat ke klien hanya kode stabil + pesan aman; stack trace tetap di server.

## Privasi (UU PDP)

Consent adalah **baris database** dengan `policyVersion`, bukan flag `localStorage`.
Lokasi **tingkat kota saja**, opsional, dan tidak pernah memengaruhi rekomendasi.
Retensi per jenis data (`docs/PRIVACY.md` §6). `llm_calls` **tidak menyimpan isi prompt**.
Email diredaksi sebelum dikirim ke model.
Hak subjek data: ekspor, perbaikan, penghapusan, penarikan consent.

## Secret

Hanya dari env · `.env` di `.gitignore` · `.env.example` bernilai kosong · **secret yang pernah
masuk riwayat Git dianggap bocor dan wajib dirotasi** (menghapus commit tidak menghapusnya dari klon
yang sudah tersebar).

## Checklist endpoint baru

- [ ] Guard autentikasi + otorisasi?
- [ ] Kepemilikan diperiksa di lapisan application?
- [ ] DTO zod `strict()`?
- [ ] Rate limit sesuai tier?
- [ ] Tulis oleh peran internal → audit log?
- [ ] Galat memakai kode stabil, tanpa stack trace?
- [ ] Tidak ada data pribadi atau secret di log?
- [ ] Kalau memuat data pelanggan: retensi dan hak penghapusan sudah dipertimbangkan?
