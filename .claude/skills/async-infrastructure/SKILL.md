---
name: async-infrastructure
description: Gunakan saat menambah atau mengubah konsumer RabbitMQ, membuat job baru (PDF, handoff, impor katalog, embedding, email, agregasi, notifikasi), memakai Redis untuk cache/sesi/rate limit/lock, atau memutuskan apakah sepotong pekerjaan harus sinkron atau masuk antrean.
---

# Infrastruktur Asinkron

Rujukan lengkap: `docs/INFRASTRUCTURE.md` §6–§7.

## Sinkron atau antrean?

Satu pertanyaan: **apakah pengguna sedang menunggunya di layar?**

| Sinkron | Antrean |
|---|---|
| pesan chat, ekstraksi | pembuatan PDF |
| perhitungan teknik | pengiriman handoff |
| product matching | impor katalog |
| BOM, topologi skema | embedding dokumen |
| | pemrosesan email, agregasi pasar, notifikasi |

**Chat tidak pernah lewat RabbitMQ.** Antrean menambah latensi dan kerumitan; itu sepadan hanya
untuk pekerjaan yang boleh selesai belakangan **dan** boleh gagal lalu diulang. Jawaban chat bukan
keduanya.

Jangan membuat sesuatu asinkron hanya karena terdengar lebih baik.

## Queue

Topic exchange `snouty.events`, satu queue durable per konsumer, masing-masing dengan **DLQ** dan
queue retry backoff eksponensial (maks 5 percobaan).

| Queue | Kunci idempotensi |
|---|---|
| `report.generate` | `reportId` |
| `handoff.deliver` | `handoffId` |
| `catalog.ingest` | `catalogVersionId + rowHash` |
| `document.embed` | `documentId + chunkIndex` |
| `email.process` | `messageId` |
| `market.aggregate` | `eventId` |
| `notification.send` | `notificationId` |

## Checklist konsumer baru

- [ ] Idempoten? (insert-or-ignore pada kunci — job **akan** dijalankan dua kali)
- [ ] DLQ terpasang?
- [ ] Strategi retry dengan backoff, batas percobaan jelas?
- [ ] Menulis `job_runs` supaya status bisa ditanyakan UI?
- [ ] Correlation ID ikut dari pesan pemicunya?
- [ ] Timeout ditentukan?
- [ ] Kegagalan permanen menghasilkan keadaan yang **terlihat pengguna**, bukan diam?

Baris terakhir sering terlewat: job yang gagal diam-diam sama saja dengan pekerjaan yang dibuang.
**DLQ yang tidak pernah dilihat memicu notifikasi**, bukan menumpuk.

## Redis — cache, bukan kebenaran

| Kunci | TTL |
|---|---|
| `snouty:ctx:{conversationId}` | 24 jam |
| `snouty:guest:{sessionId}` | `GUEST_SESSION_TTL` |
| `snouty:rl:{tier}:{actorId}:{window}` | jendela |
| `snouty:job:{jobId}` | 1 jam setelah selesai |
| `snouty:idem:{key}` | 24 jam |
| `snouty:lock:{resource}` | 60 s, diperbarui otomatis |
| `snouty:cache:product:{id}` | 1 jam |

**Redis tidak pernah menjadi sumber kebenaran.** Requirement state ditulis **write-through**: MySQL
dulu, baru Redis. Mengosongkan Redis harus kehilangan kecepatan, bukan data — dan itu wajib ada
tesnya.

## Lock terdistribusi

Dipakai pada impor katalog dan pembuatan laporan — dua operasi yang berjalan ganda akan kacau.
Selalu dengan TTL dan perpanjangan otomatis; jangan pernah lock tanpa kedaluwarsa.

## Alokasi nomor laporan

Bukan pekerjaan Redis. Nomor `SNTY-YYYY-MM-NNNN` dialokasikan dari tabel penghitung MySQL dengan
unique constraint dan `SELECT … FOR UPDATE`, saat `Report` dibuat — bukan saat PDF selesai, supaya
nomor tetap sama meski pembuatan gagal lalu diulang.

## Worker

`apps/worker` terpisah dari API: job panjang, memuat Chromium, tidak menerima trafik masuk.
Chromium **hanya** di image worker supaya image API tetap kecil.

## n8n

Hanya integrasi. **Tidak pernah** memuat sizing, perhitungan, kelayakan produk, atau aturan bisnis —
logika di dalam workflow n8n tidak bisa diuji unit, tidak masuk review, dan tidak terlihat di diff.
Webhook diautentikasi dengan `N8N_WEBHOOK_SECRET` + verifikasi tanda tangan.

## Degradasi

| Mati | Akibat |
|---|---|
| RabbitMQ | job tertunda — **chat tetap jalan** |
| Redis | lebih lambat — state dipulihkan dari MySQL |
| MySQL | sistem berhenti; `/health` down, galat aman |

Hanya MySQL yang fatal. Pertahankan sifat ini saat menambah ketergantungan baru.
