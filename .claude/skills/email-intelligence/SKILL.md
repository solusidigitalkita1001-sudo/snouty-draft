---
name: email-intelligence
description: Gunakan saat mengerjakan pemrosesan email masuk ke sales@pralon.com — parsing, pembersihan kutipan, lampiran, ekstraksi terstruktur dari email, klasifikasi lead, pembuatan draf balasan, atau layar tinjauan email di back-office. Juga saat menghubungkan n8n ke pipeline email.
---

# Email Intelligence — Fase 11

Rujukan lengkap: `docs/EMAIL_INTELLIGENCE.md`.

## Aturan yang tidak bisa ditawar

> **AI menganalisis → AI membuat draf → manusia meninjau → manusia mengirim.**

Tidak ada balasan otomatis. Tidak ada jalur kode yang mengirim email tanpa `approvedBy`. Tulis ini
sebagai pemeriksaan arsitektur, bukan hanya tes unit.

Alasannya bukan kehati-hatian belaka: email ke `sales@pralon.com` memuat harga, komitmen, dan nama
baik Pralon. Manusia di ujung rantai adalah bagian dari desain.

## Pipeline

```
penyedia email → n8n → RabbitMQ (email.process, idempoten per messageId, DLQ) → worker
  parse → bersihkan kutipan → tanda tangan → lampiran
  → REDAKSI → analisis AI → ekstraksi → skor lead → MySQL → dashboard → peninjau
```

n8n **hanya** integrasi. Tidak ada logika bisnis di dalamnya.

## Parsing — bagian yang menentukan kualitas

- Prefer `text/plain`; konversi HTML dengan menjaga struktur daftar.
- **Bersihkan riwayat kutipan** (`>`, "Pada … menulis:", "From: … Sent: …"). Tanpa ini, balasan
  kesepuluh mengirim seluruh rantai ke model — mahal, dan analisisnya tertuju ke pesan lama.
- **Pisahkan blok tanda tangan** — di situlah sebagian besar data pribadi berada, dan memisahkannya
  membuat redaksi jauh lebih andal.
- Threading via `In-Reply-To`: satu rantai = satu lead, bukan lima.
- Lampiran disimpan di luar web root, MIME dan ukuran dibatasi.

## Redaksi sebelum dikirim ke model — WAJIB

Pengirim email **tidak pernah menyetujui** isinya diproses model pihak ketiga. Ini berbeda dari
pelanggan chat yang memang meminta layanan.

| Diredaksi | Menjadi |
|---|---|
| Nomor telepon | `[TELEPON]` |
| Alamat lengkap | `[ALAMAT]` |
| NPWP, nomor rekening | `[NOMOR]` |
| Alamat email | `[EMAIL]` |
| Blok tanda tangan | dibuang |

Teks asli tetap di MySQL untuk ditinjau manusia; nilai asli hanya muncul kembali di layar peninjau
berwenang. Lokasi proyek dipertahankan **di tingkat kota** — itu nilai analitiknya.

## Ekstraksi

Skema zod, sama disiplinnya dengan chat. Field penting: `intent`, `leadType`, `company`,
`projectType`, `projectLocation`, `projectScale`, `unitCount`, `requestedProducts`,
**`quotationIntent`**, **`missingTechnicalInfo`**, `urgency`.

Dua yang paling berguna bagi tim penjualan:

- `quotationIntent` memisahkan "berapa harga 500 batang" dari "apa bedanya AW dan D".
- `missingTechnicalInfo` mengubah draf dari balasan sopan menjadi balasan yang memajukan percakapan.

`requestedProducts` dicocokkan ke katalog **setelah** ekstraksi; nama yang tidak cocok disimpan
sebagai teks, **tidak** dipaksa menjadi SKU.

## Skor lead — deterministik, bukan penilaian model

Dihitung dari hasil ekstraksi dengan bobot yang terlihat dan bisa disetel tanpa menyentuh prompt
(`docs/EMAIL_INTELLIGENCE.md` §6). Bobot awal adalah tebakan dan perlu dikalibrasi setelah ada data
nyata.

## Draf balasan

Kebijakan produk berlaku identik dengan chat — email bukan celah.

- Hanya fakta katalog; tidak pernah mengarang spesifikasi.
- **Tidak pernah memuat harga** kecuali `PRICING_ENABLED` dan harga dari tabel.
- Menanyakan hal di `missingTechnicalInfo`.
- Kebutuhan industri diarahkan ke tim teknis.
- Menyimpan `llmCallId` untuk audit.

## Model data

`emails` · `email_analyses` · `email_drafts` · `leads`.
**`leads` per thread, bukan per email** — lima email tentang satu proyek adalah satu peluang.

## Back-office

Peran `sales_reviewer`. Email asli **berdampingan** dengan analisis terstruktur, sunting draf,
setujui & kirim, dan tombol **"tandai analisis salah"** — yang mengubah kesalahan menjadi kasus di
golden dataset alih-alih keluhan yang menguap. Setiap tindakan menulis audit.

## Market intelligence

Setiap analisis memancarkan satu event anonim: wilayah, tipe & skala proyek, produk diminat,
`quotationIntent`. **Tanpa identitas pengirim, tanpa nama perusahaan.**

## Checklist

- [ ] Kutipan dan tanda tangan bersih sebelum ke model?
- [ ] Redaksi berjalan sebelum panggilan LLM?
- [ ] Konsumer idempoten per `messageId`?
- [ ] Ekstraksi gagal validasi → tidak membuat lead?
- [ ] Draf bebas harga saat `PRICING_ENABLED=false`?
- [ ] Tidak ada jalur kirim tanpa persetujuan manusia?
- [ ] Event market tanpa identitas?
