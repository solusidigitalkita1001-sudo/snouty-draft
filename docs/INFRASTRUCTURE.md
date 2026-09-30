# SNOUTY — Infrastruktur

Fase 0c · P0c-10 · Terakhir diperbarui 2026-09-30

Bagaimana SNOUTY dijalankan. Sumbernya SPEC §16–§21.

---

## 1. Komponen

| Komponen      | Peran                              | Di mana                                        |
| ------------- | ---------------------------------- | ---------------------------------------------- |
| Nginx         | reverse proxy, TLS, terminasi SSE  | kontainer                                      |
| `apps/web`    | Next.js                            | kontainer                                      |
| `apps/api`    | NestJS, HTTP + SSE                 | kontainer, stateless, bisa N×                  |
| `apps/worker` | konsumer RabbitMQ + Chromium       | kontainer                                      |
| MySQL 8       | sumber kebenaran                   | **`192.168.1.136` — bersama, di luar compose** |
| Redis         | cache, sesi, rate limit, lock      | kontainer                                      |
| RabbitMQ      | antrean asinkron                   | kontainer                                      |
| n8n           | integrasi (email, notifikasi, CRM) | kontainer atau instans yang sudah ada          |
| Qdrant        | vektor — **belum diadopsi**        | —                                              |

MySQL sengaja **tidak** ada di `docker-compose.yml`. Menaruhnya di sana akan mengundang seseorang
menjalankan `docker compose down -v` dan mengira itu aman. Yang bersama tetap di luar.

---

## 2. Topologi

```
Internet
   │ TLS
   ▼
 Nginx ──► apps/web  (Next.js)
   │           │ fetch + SSE
   └──────► apps/api ──┬──► MySQL   192.168.1.136:3306   (bersama)
                       ├──► Redis
                       ├──► RabbitMQ ──► apps/worker
                       └──► OpenRouter
                                            │
                              n8n ◄─────────┘
```

Nanti (SPEC §21): `Load Balancer → API-1..n`, dengan API tetap stateless. Tidak ada yang perlu
diubah untuk itu selain menambah replika — syaratnya sudah dipenuhi sejak sekarang karena tidak ada
state percakapan di memori proses.

---

## 3. Nginx

Konfigurasi terpenting adalah route SSE. Tanpa ini, seluruh jawaban baru muncul di akhir dan
tracker analisis lima tahap tidak pernah terlihat bergerak.

```nginx
location /api/v1/conversations/ {
    proxy_pass http://api;
    proxy_http_version 1.1;

    # WAJIB untuk SSE
    proxy_buffering off;
    proxy_cache off;
    proxy_set_header Connection '';
    proxy_read_timeout 300s;
    add_header X-Accel-Buffering no;
}

location /api/ {
    proxy_pass http://api;
    proxy_read_timeout 60s;
    client_max_body_size 12m;      # selaras dengan UPLOAD_MAX_MB
}

location / {
    proxy_pass http://web;
}
```

Selain itu: TLS (HSTS aktif), gzip/brotli untuk aset statis, header keamanan (`X-Content-Type-Options`,
`Referrer-Policy`, CSP), dan `client_max_body_size` yang dijaga konsisten dengan batas unggahan di
aplikasi — kalau tidak, pengguna mendapat galat Nginx mentah alih-alih pesan yang ramah.

---

## 4. Docker Compose (lokal)

```yaml
services:
  redis: # 7-alpine, appendonly, port 6379
  rabbitmq: # 3-management-alpine, port 5672 + 15672
  mysql-test: # 8, HANYA profil "test" — untuk tes integrasi, bukan pengembangan
  n8n: # opsional, profil "integrations"
```

`mysql-test` berada di balik profil Compose sehingga tidak ikut menyala pada `docker compose up`
biasa. Ia ada khusus untuk tes integrasi dan CI; pengembangan tetap memakai `snouty_dev` di host
bersama.

Volume bernama untuk Redis dan RabbitMQ agar data lokal bertahan antar restart.

---

## 5. Image

| Image    | Basis                   | Catatan                                |
| -------- | ----------------------- | -------------------------------------- |
| `api`    | `node:22-alpine`        | multi-stage, non-root, kecil           |
| `web`    | `node:22-alpine`        | build standalone Next.js               |
| `worker` | `node:22-bookworm-slim` | **memuat Chromium** — jauh lebih besar |

Worker memakai basis Debian karena Chromium di Alpine merepotkan. Ini alasan konkret memisahkan
worker dari API: image API tetap puluhan MB, bukan ratusan.

Semua image berjalan sebagai pengguna non-root, dengan health check dan `.dockerignore` yang
mengecualikan `node_modules`, `.env`, dan `design-input/`.

---

## 6. Redis

| Kunci                                 | Isi                         | TTL                       |
| ------------------------------------- | --------------------------- | ------------------------- |
| `snouty:ctx:{conversationId}`         | snapshot kebutuhan aktif    | 24 jam                    |
| `snouty:guest:{sessionId}`            | sesi tamu + flag consent    | `GUEST_SESSION_TTL`       |
| `snouty:rl:{tier}:{actorId}:{window}` | penghitung rate limit       | jendela                   |
| `snouty:job:{jobId}`                  | status job untuk polling UI | 1 jam setelah selesai     |
| `snouty:idem:{key}`                   | penjaga idempotensi         | 24 jam                    |
| `snouty:lock:{resource}`              | lock terdistribusi          | 60 s, diperbarui otomatis |
| `snouty:cache:product:{id}`           | cache katalog               | 1 jam                     |

`appendonly yes` untuk bertahan dari restart, tetapi **Redis tidak pernah menjadi sumber kebenaran**
(SPEC §18). Kehilangan seluruh isi Redis berarti kehilangan kecepatan, bukan data.

Lock terdistribusi dipakai pada impor katalog dan pembuatan laporan — dua operasi yang menjalankan
dua instansnya bersamaan akan menghasilkan kekacauan.

---

## 7. RabbitMQ

Topic exchange `snouty.events`, satu queue durable per konsumer, masing-masing dengan DLQ dan queue
retry berbackoff eksponensial (maksimum 5 percobaan).

| Queue               | Pemicu                                     | Kunci idempotensi            |
| ------------------- | ------------------------------------------ | ---------------------------- |
| `report.generate`   | permintaan PDF                             | `reportId`                   |
| `handoff.deliver`   | "Kirim ke tim teknis Pralon"               | `handoffId`                  |
| `catalog.ingest`    | impor katalog                              | `catalogVersionId + rowHash` |
| `document.embed`    | dokumen teknis baru (bila Qdrant diadopsi) | `documentId + chunkIndex`    |
| `email.process`     | webhook n8n                                | `messageId`                  |
| `market.aggregate`  | terjadwal + saat percakapan selesai        | `eventId`                    |
| `notification.send` | dari job mana pun                          | `notificationId`             |

Setiap konsumer idempoten dan menulis `job_runs` agar statusnya bisa ditanyakan UI.

**Chat tidak pernah lewat RabbitMQ** (SPEC §19). Antrean untuk pekerjaan yang boleh selesai
belakangan dan boleh gagal lalu diulang; jawaban chat bukan keduanya.

Pesan yang berakhir di DLQ memicu notifikasi — DLQ yang tidak pernah dilihat sama saja dengan
membuang pekerjaan diam-diam.

---

## 8. n8n

Hanya integrasi dan orkestrasi: email, CRM, API eksternal, notifikasi, jadwal, routing lead, pemicu
sinkronisasi pengetahuan, pengiriman handoff, pengiriman laporan via email.

**Tidak pernah di dalam n8n** (SPEC §20): sizing pipa, perhitungan teknik, kelayakan produk,
kebijakan rekomendasi, aturan bisnis inti.

Alasannya sederhana: logika di dalam workflow n8n tidak bisa diuji unit, tidak masuk code review, dan
tidak terlihat di diff. Aturan bisnis yang tinggal di sana akan menyimpang dari aturan di kode tanpa
ada yang menyadarinya.

Webhook n8n → API diautentikasi dengan `N8N_WEBHOOK_SECRET` dan memverifikasi tanda tangan.

---

## 9. Konfigurasi

Hanya dari environment, divalidasi saat boot dengan zod. **Proses menolak start bila config wajib
hilang** — lebih baik gagal keras saat deploy daripada gagal halus saat pengguna pertama datang.

Daftar lengkap kunci ada di `.env.example` (SPEC §17b). Tidak ada nilai default untuk secret, tidak
ada fallback diam-diam ke localhost.

---

## 10. Observabilitas

**Sekarang:** log terstruktur Pino dengan correlation ID di API, worker, dan (sebagai header) di
web; `/health` dan `/health/ready`; tabel `job_runs` dan `llm_calls` sebagai telemetri domain.

**Nanti (Fase 13):** OpenTelemetry, Prometheus, Grafana.

Ditunda karena belum ada trafik untuk diamati. Yang **tidak** ditunda adalah correlation ID — ia
harus ada sejak awal, karena menambahkannya belakangan berarti menyentuh setiap jalur kode.

Aturan log: tidak pernah memuat secret, tidak pernah memuat data pribadi, tidak pernah memuat isi
prompt.

---

## 11. Deploy

Belum ditentukan sepenuhnya (OQ-10); usulan on-prem Docker Compose di balik Nginx, konsisten dengan
MySQL internal.

```
build image  ──►  jalankan migration (disetujui terpisah)  ──►  deploy web+api+worker  ──►  smoke test
```

Migration **tidak pernah** berjalan otomatis saat deploy. Ia adalah langkah tersendiri dengan
persetujuan dan backup terkonfirmasi (`DATABASE.md` §4). Deploy yang menjalankan migration sendiri
adalah cara paling umum merusak basis data bersama pada pukul dua pagi.

Rollback: deploy ulang image sebelumnya. Karena migration destruktif dijalankan dua tahap lintas
rilis, rollback satu rilis tidak pernah kehilangan data.

---

## 12. Ketergantungan eksternal

| Layanan    | Kegagalan berarti        | Penanganan                      |
| ---------- | ------------------------ | ------------------------------- |
| MySQL      | sistem berhenti          | `/health` down, galat aman      |
| Redis      | lebih lambat, bukan mati | state dipulihkan dari MySQL     |
| RabbitMQ   | job tertunda             | chat tetap jalan                |
| OpenRouter | tidak ada jawaban baru   | `LLM_UNAVAILABLE`, mood `sorry` |
| n8n        | integrasi tertunda       | job mengantre                   |

Hanya MySQL yang benar-benar fatal. Sisanya menurunkan kemampuan tanpa menghentikan konsultasi — dan
itu memang tujuan pembagian tanggung jawabnya.
