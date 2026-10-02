# SNOUTY — Email Intelligence

Fase 0c · P0c-07 · Terakhir diperbarui 2026-09-30 · **Fase 11**

Mengubah email masuk ke `sales@pralon.com` menjadi intelijen penjualan terstruktur.
Sumbernya SPEC §14.

---

## 1. Aturan yang tidak bisa ditawar

> **AI menganalisis → AI membuat draf → manusia meninjau → manusia mengirim.**

Tidak ada balasan otomatis. Tidak ada sekarang, tidak ada rencana mengubahnya nanti tanpa keputusan
eksplisit.

Alasannya bukan kehati-hatian belaka. Email ke `sales@pralon.com` adalah komunikasi bisnis: di
dalamnya ada harga, komitmen, dan nama baik Pralon. Model yang salah membaca satu angka lalu
membalas sendiri bisa menciptakan masalah komersial yang nyata. Manusia di ujung rantai bukan
hambatan — dia bagian dari desain.

---

## 2. Pipeline

```
Penyedia email ──► n8n ──► RabbitMQ ──► Email Worker
                                             │
                    parse ──► bersihkan kutipan ──► lampiran
                                             │
                    analisis AI ──► ekstraksi kebutuhan ──► klasifikasi lead
                                             │
                                          MySQL
                                             │
                            Dashboard penjualan / notifikasi
                                             │
                          sales_reviewer ──► sunting ──► setujui ──► kirim
```

n8n hanya integrasi: menarik email dan mendorongnya ke antrean. Tidak ada logika bisnis di dalam n8n
(SPEC §20).

Antrean `email.process`, idempoten dengan kunci `messageId`, dengan DLQ. Email yang sama diproses dua
kali tidak menghasilkan dua lead.

---

## 3. Parsing

Bagian yang paling tidak glamor dan paling menentukan kualitas hasil.

| Langkah               | Catatan                                                                       |
| --------------------- | ----------------------------------------------------------------------------- |
| Header                | pengirim, penerima, subjek, tanggal, `Message-ID`, `In-Reply-To`              |
| Badan                 | prefer `text/plain`; bila hanya HTML, konversi dengan menjaga struktur daftar |
| **Bersihkan kutipan** | buang riwayat balasan (`>`, "Pada … menulis:", "From: … Sent: …")             |
| **Tanda tangan**      | deteksi dan pisahkan — sering memuat telepon dan alamat                       |
| Bahasa                | deteksi; Indonesia dan Inggris didukung                                       |
| Lampiran              | simpan di luar web root; PDF/gambar/spreadsheet; pindai ukuran & MIME         |
| Threading             | kelompokkan berdasarkan `In-Reply-To` agar satu percakapan = satu lead        |

Pembersihan kutipan penting melebihi kesannya: tanpa itu, balasan kesepuluh dalam satu rantai
mengirim seluruh riwayat ke model — mahal, dan membuat analisis tertuju pada pesan lama alih-alih
yang baru.

Pemisahan tanda tangan juga bukan kerapian: di situlah sebagian besar data pribadi berada, dan
memisahkannya membuat redaksi (§5) jauh lebih andal.

---

## 4. Ekstraksi

Skema tervalidasi zod, sama disiplinnya dengan ekstraksi chat.

```ts
const EmailAnalysis = z.object({
  intent: z.enum([
    'permintaan_penawaran',
    'pertanyaan_produk',
    'pertanyaan_teknis',
    'keluhan',
    'kemitraan',
    'lainnya',
  ]),
  leadType: z.enum([
    'kontraktor',
    'developer',
    'distributor',
    'pemilik_bangunan',
    'konsultan',
    'tidak_diketahui',
  ]),
  company: z.string().nullable(),
  projectType: z.enum(['hunian', 'komersial', 'industri', 'infrastruktur']).nullable(),
  projectLocation: z.string().nullable(), // tingkat kota
  projectScale: z.enum(['kecil', 'sedang', 'besar']).nullable(),
  unitCount: z.number().int().nullable(),
  buildingInfo: z.string().nullable(),
  requestedProducts: z.array(z.string()),
  quotationIntent: z.boolean(),
  missingTechnicalInfo: z.array(z.string()),
  urgency: z.enum(['rendah', 'sedang', 'tinggi']).nullable(),
});
```

Dua field yang paling berguna bagi tim penjualan, dan keduanya sering terlewat di sistem sejenis:

**`quotationIntent`** — memisahkan "berapa harga 500 batang PVC AW 4 inci" dari "apa bedanya AW dan
D". Keduanya email, hanya satu yang peluang.

**`missingTechnicalInfo`** — daftar hal yang perlu ditanyakan balik. Ini yang mengubah draf dari
sekadar balasan sopan menjadi balasan yang memajukan percakapan.

`requestedProducts` dicocokkan ke katalog setelah ekstraksi; nama yang tidak cocok disimpan sebagai
teks, **tidak** dipaksa menjadi SKU.

---

## 5. Privasi — redaksi sebelum dikirim ke model

Jalur paparan data pribadi terbesar di seluruh sistem, dan berbeda dari chat: **pengirim email tidak
pernah menyetujui isinya diproses model pihak ketiga.**

Karena itu, sebelum dikirim ke LLM:

| Diredaksi                  | Menjadi     |
| -------------------------- | ----------- |
| Nomor telepon              | `[TELEPON]` |
| Alamat lengkap             | `[ALAMAT]`  |
| NPWP, nomor rekening       | `[NOMOR]`   |
| Blok tanda tangan          | dibuang     |
| Alamat email selain domain | `[EMAIL]`   |

Teks asli tetap di MySQL untuk ditinjau manusia; nilai asli hanya muncul kembali saat ditampilkan
kepada peninjau internal yang berwenang.

Lokasi proyek tetap dipertahankan di **tingkat kota**, karena itulah nilai analitiknya, dan itu tetap
sejalan dengan kebijakan lokasi di `PRIVACY.md`.

Retensi: email + analisisnya 24 bulan, lalu dianonimkan.

---

## 6. Klasifikasi lead

Deterministik dari hasil ekstraksi — bukan penilaian model. Skor bisa diaudit dan disetel tanpa
mengubah prompt.

```
skor = 0
+40  quotationIntent === true
+20  projectScale === 'besar'        (+10 'sedang')
+15  leadType ∈ {kontraktor, developer, distributor}
+10  unitCount ≥ 50
+10  urgency === 'tinggi'
+5   requestedProducts cocok dengan katalog

≥ 60  panas   → notifikasi langsung
30–59 hangat  → antrean tinjauan normal
< 30  dingin  → hanya masuk dashboard
```

Bobotnya tebakan awal dan perlu disetel setelah melihat data nyata; yang penting, ia **terlihat dan
bisa diubah** tanpa menyentuh AI.

---

## 7. Draf balasan

AI membuat draf; manusia yang memutuskan.

| Aturan                                                                               |     |
| ------------------------------------------------------------------------------------ | --- |
| Draf hanya memakai fakta katalog — tidak pernah mengarang spesifikasi                |     |
| **Tidak pernah memuat harga** kecuali `PRICING_ENABLED` dan harga diambil dari tabel |     |
| Menanyakan hal di `missingTechnicalInfo`                                             |     |
| Kebutuhan industri diarahkan ke tim teknis, sama seperti di chat                     |     |
| Nada mengikuti panduan di `AI_BEHAVIOR.md` §6                                        |     |
| Setiap draf menyimpan `llmCallId` untuk audit                                        |     |

Kebijakan produk berlaku identik di sini: hanya Pralon, tanpa halusinasi, batas rekomendasi. Email
bukan celah untuk melewati kebijakan yang berlaku di chat.

---

## 8. Back-office peninjauan

Peran `sales_reviewer`. Layar belum didesain (OQ-21).

| Kemampuan                                                         |     |
| ----------------------------------------------------------------- | --- |
| Kotak masuk dengan filter skor lead, intent, tanggal              |     |
| Tampilan email asli **berdampingan** dengan analisis terstruktur  |     |
| Sunting draf sebelum kirim                                        |     |
| Setujui & kirim (lewat n8n)                                       |     |
| Tandai analisis salah — menjadi umpan balik untuk evaluasi        |     |
| Tautkan ke konsultasi SNOUTY bila pengirimnya pelanggan yang sama |     |

Setiap tindakan menulis `audit_logs`. Tombol "tandai analisis salah" bernilai khusus: ia mengubah
kesalahan menjadi data latih untuk golden dataset alih-alih keluhan yang menguap.

---

## 9. Model data

| Tabel            | Isi                                                          |
| ---------------- | ------------------------------------------------------------ |
| `emails`         | header, badan bersih, badan asli, lampiran, thread           |
| `email_analyses` | hasil ekstraksi, skor, versi model, `llmCallId`              |
| `email_drafts`   | draf, versi suntingan, status, siapa yang mengirim           |
| `leads`          | entitas gabungan per thread: perusahaan, proyek, skor, tahap |

`leads` per thread, bukan per email. Lima email bolak-balik tentang satu proyek adalah satu peluang,
dan dashboard yang menghitungnya sebagai lima akan menyesatkan.

---

## 10. Yang memicu market intelligence

Setiap analisis email memancarkan satu event anonim ke market intelligence: wilayah, tipe proyek,
skala, produk yang diminat, `quotationIntent`. Tanpa identitas pengirim, tanpa nama perusahaan
(`MARKET_INTELLIGENCE.md`).

---

## 11. Pengujian

| #   | Tes                                                                                    |
| --- | -------------------------------------------------------------------------------------- |
| 1   | Pembersihan kutipan menghapus riwayat balasan di format Gmail, Outlook, dan Apple Mail |
| 2   | Redaksi menghapus telepon, alamat, dan tanda tangan sebelum dikirim ke model           |
| 3   | Konsumer idempoten: `messageId` sama diproses dua kali → satu lead                     |
| 4   | Ekstraksi yang gagal validasi tidak pernah membuat lead                                |
| 5   | Draf tidak pernah memuat harga saat `PRICING_ENABLED=false`                            |
| 6   | Draf tidak pernah memuat produk di luar katalog                                        |
| 7   | Tidak ada jalur kode yang mengirim email tanpa persetujuan manusia                     |
| 8   | Skor lead deterministik untuk analisis yang sama                                       |
| 9   | Event market tidak memuat identitas pengirim                                           |

Tes 7 sebaiknya ditulis sebagai pemeriksaan arsitektur, bukan hanya tes unit: tidak ada pemanggil
`sendEmail` selain use case yang memerlukan `approvedBy`.

---

## 11. Status implementasi (Fase 11)

| Bagian                                       | Berkas                                          |
| -------------------------------------------- | ----------------------------------------------- |
| Redaksi + pembersihan riwayat + tanda tangan | `modules/email/domain/redactor.ts`              |
| Skema ekstraksi (§4)                         | `modules/email/domain/email-analysis.schema.ts` |
| Skor lead (§6)                               | `modules/email/domain/lead-score.ts`            |
| Verifikasi HMAC webhook                      | `modules/email/domain/webhook-signature.ts`     |
| Tabel                                        | migration 0010 (`emails`, `email_analyses`)     |

Catatan tentang `nullable()` di skema ekstraksi: pada chat, aturannya `optional()` karena "tidak
disebut" harus dibedakan dari "dinyatakan tidak ada" — state di-merge bertahap, dan `null` di sana akan
membuat sistem menanyakan ulang hal yang sudah dijawab. Analisis email dibuat **sekali untuk satu email
utuh**, jadi `null` berarti "tidak ada di email ini" dan tidak ada giliran berikutnya yang menimpanya.
Situasinya berbeda, jadi jawabannya berbeda.

Verifikasi webhook menghindari dua jebakan yang lazim: perbandingan waktu-konstan (`a === b` keluar
pada byte pertama yang berbeda dan membocorkan panjang prefiks yang benar), dan tanda tangan dihitung
atas **badan mentah** — bukan JSON yang di-parse lalu di-stringify ulang, yang mengubah urutan kunci
sehingga tanda tangan sah ditolak dan "perbaikan" yang biasa dilakukan adalah melemahkan verifikasinya.
Timestamp ikut ditandatangani supaya tanda tangan lama tidak bisa dipakai ulang dengan timestamp baru.

**Belum:** parsing MIME sungguhan (header, HTML→teks, lampiran) menunggu bentuk payload n8n yang nyata;
pemanggilan model untuk ekstraksi menunggu **OQ-09**; back-office peninjauan (§8) menunggu **OQ-21**;
tujuan pengiriman draf menunggu **OQ-08**. Yang sudah ada adalah seluruh bagian yang bisa benar tanpa
jawaban itu — dan yang terpenting di antaranya, redaksi, justru tidak bergantung pada satu pun.
