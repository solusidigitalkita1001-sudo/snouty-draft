# SNOUTY — Kontrak API

Fase 0b · P0b-07 · Terakhir diperbarui 2026-09-30

REST + SSE, tipe event, dan kode error. Semua tipe di dokumen ini tinggal di
`packages/shared-types` dan dipakai bersama oleh `apps/web` dan `apps/api`, sehingga perubahan kontrak
menjadi galat kompilasi, bukan bug runtime.

---

## 1. Konvensi

| Aspek       | Ketentuan                                                                 |
| ----------- | ------------------------------------------------------------------------- |
| Base path   | `/api/v1`                                                                 |
| Format      | JSON, `utf-8`                                                             |
| Waktu       | ISO-8601 UTC                                                              |
| ID          | ULID 26 karakter                                                          |
| Autentikasi | `Authorization: Bearer <access>`; refresh token di cookie `httpOnly`      |
| Guest       | cookie `snouty_guest` `httpOnly`, dibuat otomatis pada permintaan pertama |
| Correlation | `X-Correlation-Id` diterima atau dibangkitkan, selalu dikembalikan        |
| Idempotensi | `Idempotency-Key` pada POST yang memicu job                               |
| Paginasi    | berbasis cursor: `?cursor=&limit=`                                        |

Bentuk error tunggal untuk seluruh API:

```json
{
  "error": {
    "code": "NOT_ENTITLED",
    "message": "Fitur ini tersedia untuk pengguna terdaftar.",
    "retryable": false,
    "details": { "capability": "MATERIAL_BOM" },
    "correlationId": "01JB…"
  }
}
```

`message` selalu Bahasa Indonesia dan aman ditampilkan apa adanya. Stack trace tidak pernah keluar.

---

## 2. Endpoint

### Auth & sesi

| Metode | Path             | Keterangan                                                            |
| ------ | ---------------- | --------------------------------------------------------------------- |
| `POST` | `/auth/register` | membuat akun; bila ada cookie guest, sesinya ditautkan (invarian G-1) |
| `POST` | `/auth/login`    |                                                                       |
| `POST` | `/auth/refresh`  | rotasi refresh token                                                  |
| `POST` | `/auth/logout`   | mencabut refresh token                                                |
| `GET`  | `/auth/me`       | profil + `tier` + `roles` + `entitlements`                            |
| `POST` | `/guest/session` | membuat sesi tamu (biasanya implisit)                                 |

`POST /auth/register` mengembalikan `resumedConversationId` bila ada percakapan tamu yang berpindah
kepemilikan. Inilah yang membuat alur register-gate melanjutkan kasus yang sama alih-alih membuang
konteks.

### Onboarding & consent

| Metode | Path                   | Keterangan                                                                 |
| ------ | ---------------------- | -------------------------------------------------------------------------- |
| `GET`  | `/onboarding/state`    | `done` \| `guest` \| `skip` \| `pending` — dari server, bukan localStorage |
| `POST` | `/onboarding/complete` | body `{ outcome }`                                                         |
| `GET`  | `/onboarding/benefits` | dibangkitkan dari `ENTITLEMENTS`, bukan ditulis tangan                     |
| `POST` | `/consents`            | `{ kind, granted, policyVersion }`                                         |
| `GET`  | `/consents`            |                                                                            |

`GET /onboarding/benefits` mengembalikan enam manfaat beserta tag `AKUN` / `LANJUTAN` / `TAMU JUGA`
yang diturunkan dari tabel entitlement (SPEC §33e). UI tidak pernah menuliskannya sendiri.

### Percakapan

| Metode     | Path                              | Keterangan                                                                    |
| ---------- | --------------------------------- | ----------------------------------------------------------------------------- |
| `GET`      | `/conversations`                  | daftar riwayat; `?status=&q=&cursor=` — mendukung pencarian & filter layar 12 |
| `POST`     | `/conversations`                  |                                                                               |
| `GET`      | `/conversations/:id`              | percakapan + snapshot terbaru + ringkasan rekomendasi                         |
| `PATCH`    | `/conversations/:id`              | ubah judul                                                                    |
| `DELETE`   | `/conversations/:id`              | soft delete                                                                   |
| **`POST`** | **`/conversations/:id/messages`** | **mengembalikan `text/event-stream` — lihat §3**                              |
| `POST`     | `/conversations/:id/save`         | "Simpan solusi" → status `SAVED`, memicu toast                                |

### Kebutuhan

| Metode  | Path                                                | Keterangan                                        |
| ------- | --------------------------------------------------- | ------------------------------------------------- |
| `GET`   | `/conversations/:id/requirement`                    | snapshot terbaru                                  |
| `PATCH` | `/conversations/:id/requirement`                    | edit inline panel kanan — **tanpa panggilan LLM** |
| `GET`   | `/conversations/:id/requirement/history`            | semua snapshot                                    |
| `POST`  | `/conversations/:id/requirement/skip-clarification` | "lewati dan gunakan asumsi standar"               |

`PATCH` mengembalikan snapshot baru **beserta** rekomendasi yang sudah dihitung ulang bila solusi
sudah ada. Satu permintaan, satu respons — UI tidak perlu mengorkestrasi ulang.

_Status 2026-10-05:_ `GET` dan `PATCH …/requirement` sudah ada (`{ state }`; body `PATCH` =
`{ edits: [{ path, value }] }`, tujuh field panel, nol LLM). Hitung ulang **belum** disatukan di
respons `PATCH`: klien memanggil `POST …/analyze` lagi setelah edit bila solusi sudah ada — itu
satu-satunya jalur yang menghasilkan trace. `history` dan `skip-clarification` belum ada.

### Katalog

| Metode | Path                       | Keterangan                                                                               |
| ------ | -------------------------- | ---------------------------------------------------------------------------------------- |
| `GET`  | `/products`                | `?family=&category=&size=&q=&cursor=`                                                    |
| `GET`  | `/products/:id`            | drawer produk: spesifikasi, ukuran, fitting sepadan, sumber                              |
| `GET`  | `/products/:id/compatible` |                                                                                          |
| `GET`  | `/products/:id/documents`  | "Buka dokumen teknis" — ditawarkan, tidak dibaca untuk mengisi spesifikasi kosong        |
| `GET`  | `/catalog/version`         | versi aktif — `kind` `pralon` → "KATALOG PRALON · v2.4", `sample` → "KATALOG CONTOH · …" |

Field spesifikasi kosong dikembalikan sebagai `{ "value": null, "provenance": "UNAVAILABLE" }`, bukan
dihilangkan dari respons. UI perlu tahu bedanya antara "tidak ada datanya" dan "field tidak berlaku".

### Rekomendasi

| Metode | Path                               | Entitlement                                |
| ------ | ---------------------------------- | ------------------------------------------ |
| `GET`  | `/recommendations/:id`             | pemilik                                    |
| `GET`  | `/recommendations/:id/bom`         | `MATERIAL_BOM`                             |
| `GET`  | `/recommendations/:id/schematic`   | `SCHEMATIC`                                |
| `GET`  | `/recommendations/:id/traces`      | pemilik — sumber "Tampilkan detail teknis" |
| `POST` | `/recommendations/:id/recalculate` | pemilik — dipakai skenario layar 09        |

### Laporan

| Metode | Path                    | Keterangan                                                                                                            |
| ------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/reports`              | `{ recommendationId, customerName, projectLocation }` → `202` + `reportId`, job masuk antrean; digerbang `REPORT_PDF` |
| `GET`  | `/reports/:id`          | `PENDING` \| `READY` \| `FAILED`                                                                                      |
| `GET`  | `/reports/:id/download` | hanya pemilik & peran berwenang (invarian RP-2)                                                                       |
| `POST` | `/reports/:id/email`    | "Kirim ke email"                                                                                                      |

### Handoff teknis

| Metode | Path                                         | Keterangan                                                |
| ------ | -------------------------------------------- | --------------------------------------------------------- |
| `POST` | `/handoffs`                                  | "Kirim ke tim teknis Pralon" — membawa snapshot kebutuhan |
| `GET`  | `/handoffs/:id`                              | status + SLA                                              |
| `GET`  | `/conversations/:id/requirement/summary.pdf` | "Unduh ringkasan kebutuhan"                               |

### Unggahan & umpan balik

| Metode | Path        | Keterangan                                        |
| ------ | ----------- | ------------------------------------------------- |
| `POST` | `/uploads`  | multipart; denah bangunan; MIME + ukuran dibatasi |
| `POST` | `/feedback` | `{ messageId, rating, reason? }`                  |

### Internal (semua butuh peran + audit)

| Path                    | Peran                     |
| ----------------------- | ------------------------- |
| `/internal/catalog/*`   | `catalog_admin`           |
| `/internal/rules/*`     | `domain_expert`           |
| `/internal/handoffs/*`  | `technical_team`          |
| `/internal/emails/*`    | `sales_reviewer`          |
| `/internal/dashboard/*` | `sales_reviewer`, `admin` |
| `/internal/users/*`     | `admin`                   |

### Kesehatan

| Path                | Isi                                                              |
| ------------------- | ---------------------------------------------------------------- |
| `GET /health`       | `{ status, db, redis, rabbitmq, version }` — DB hanya `SELECT 1` |
| `GET /health/ready` | untuk load balancer                                              |

---

## 3. Kontrak SSE

`POST /api/v1/conversations/:id/messages` dengan `Accept: text/event-stream`.

Nginx **wajib** mematikan buffering di route ini; tanpa itu seluruh jawaban baru muncul di akhir.

```
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 300s;
add_header X-Accel-Buffering no;
```

### Tipe event

```ts
type SseEvent =
  | { type: 'message.start'; messageId: string }
  | { type: 'stage'; stage: AnalysisStage; status: 'active' | 'done' | 'failed'; detail?: string }
  | { type: 'token'; text: string }
  | { type: 'requirement.updated'; state: RequirementState }
  | { type: 'card'; card: AssistantCard }
  | { type: 'solution.ready'; recommendationId: string }
  | { type: 'error'; code: ErrorCode; retryable: boolean; retryAfterSec?: number }
  | { type: 'message.end'; messageId: string; usage: TokenUsage };
```

### Lima tahap analisis

Label dirender apa adanya, persis `STEP_LABELS` prototipe:

| `AnalysisStage`          | Label                     | Dipancarkan saat                 |
| ------------------------ | ------------------------- | -------------------------------- |
| `UNDERSTANDING`          | Memahami kebutuhan        | ekstraksi + merge selesai        |
| `ANALYZING_INSTALLATION` | Menganalisis instalasi    | aturan teknik selesai dievaluasi |
| `MATCHING_PRODUCTS`      | Mencocokkan produk Pralon | pencocokan katalog selesai       |
| `COMPOSING`              | Menyusun rekomendasi      | rekomendasi dirakit & disimpan   |
| `PREPARING_SCHEMATIC`    | Menyiapkan skema          | topologi terbentuk               |

Ini **batas pipeline nyata**, bukan timer. Field `detail` mengisi sub-label board layar 05, seperti
"6 DATA · SELESAI" dan "RISER + 2 LANTAI · SELESAI".

### `AssistantCard`

Union tertutup — balasan asisten tidak pernah berisi HTML atau markdown bebas.

```ts
type AssistantCard =
  | { kind: 'summary'; fields: SummaryField[]; readCount: number }
  | { kind: 'clarification'; questions: ClarificationQuestion[] } // maks 4
  | { kind: 'criteria'; items: CriteriaItem[] } // layar 08
  | { kind: 'unsupported'; reasons: string[]; captured: KeyValue[]; slaHours: number }
  | { kind: 'product'; products: ProductCardDto[] }
  | { kind: 'cta'; action: 'ANALYZE' | 'REGISTER' | 'CONTACT_TECHNICAL' };
```

Membatasi kartu pada union tertutup sekaligus menutup satu jalur prompt injection: dokumen atau email
yang disisipi markup tidak bisa menghasilkan markup di layar, karena tidak ada jalur render untuk itu.

### Contoh aliran

```
event: message.start        {"messageId":"01JB…"}
event: requirement.updated  {"state":{…}}
event: stage                {"stage":"UNDERSTANDING","status":"done","detail":"6 DATA"}
event: stage                {"stage":"ANALYZING_INSTALLATION","status":"active"}
event: stage                {"stage":"ANALYZING_INSTALLATION","status":"done","detail":"RISER + 2 LANTAI"}
event: stage                {"stage":"MATCHING_PRODUCTS","status":"done","detail":"4 PRODUK"}
event: stage                {"stage":"COMPOSING","status":"active"}
event: token                {"text":"Sistem distribusi gravitasi "}
event: token                {"text":"dari toren atap…"}
event: stage                {"stage":"COMPOSING","status":"done"}
event: stage                {"stage":"PREPARING_SCHEMATIC","status":"done"}
event: solution.ready       {"recommendationId":"01JB…"}
event: message.end          {"messageId":"01JB…","usage":{"in":1840,"out":420,"costUsd":0.0031}}
```

### Kegagalan di tengah analisis

```
event: stage  {"stage":"MATCHING_PRODUCTS","status":"failed"}
event: error  {"code":"CATALOG_UNAVAILABLE","retryable":true}
```

UI merender kartu gagal desain: judul "Gagal menyusun rekomendasi", pesan "Koneksi ke katalog Pralon
terputus di tengah analisis. Kebutuhan Anda tetap tersimpan, jadi tidak perlu mengetik ulang.", tombol
"Coba lagi" / "Kembali ke percakapan", mood mascot `fail`.

Kalimat "kebutuhan Anda tetap tersimpan" benar secara harfiah, bukan sekadar penghibur: snapshot sudah
ditulis ke MySQL sebelum tahap `MATCHING_PRODUCTS` dimulai.

### Aturan klien

- Sambung ulang memakai `Last-Event-ID`; server memutar ulang dari titik itu.
- Heartbeat komentar `:ka` tiap 15 detik agar proxy tidak menutup koneksi.
- Satu stream aktif per percakapan; stream kedua menggantikan yang pertama.

---

## 4. Kode error

| Kode                       | HTTP      | Retryable | Mood       | Salinan UI                                                  |
| -------------------------- | --------- | --------- | ---------- | ----------------------------------------------------------- |
| `VALIDATION_FAILED`        | 400       | tidak     | `confused` | "Ada isian yang belum sesuai."                              |
| `UNAUTHENTICATED`          | 401       | tidak     | `idle`     | "Silakan masuk terlebih dahulu."                            |
| `NOT_ENTITLED`             | 403       | tidak     | `confused` | "Fitur ini tersedia untuk pengguna terdaftar."              |
| `NOT_FOUND`                | 404       | tidak     | `confused` | "Data tidak ditemukan."                                     |
| `RATE_LIMITED`             | 429       | ya        | `sorry`    | "Terlalu banyak permintaan. Coba lagi sebentar."            |
| `LLM_UNAVAILABLE`          | 503       | ya        | `sorry`    | "Layanan sedang sibuk. Coba lagi."                          |
| `CATALOG_UNAVAILABLE`      | 503       | ya        | `fail`     | "Koneksi ke katalog Pralon terputus…"                       |
| `SERVICE_UNAVAILABLE`      | 503       | ya        | `fail`     | "Layanan sedang tidak tersedia."                            |
| `REPORT_GENERATION_FAILED` | 500       | ya        | `fail`     | "Laporan gagal diunduh." → "Unduh ulang" / "Kirim ke email" |
| `MESSAGE_NOT_SENT`         | — (klien) | ya        | `fail`     | "Pesan belum terkirim. Periksa koneksi internet Anda."      |
| `UPLOAD_REJECTED`          | 400       | tidak     | `sorry`    | "Berkas tidak dapat diterima."                              |

Keputusan kebijakan **bukan** error dan mengembalikan `200` beserta kartu:
`COMPETITOR_COMPARISON_REFUSED`, `INSUFFICIENT_DATA`, `TECHNICAL_VALIDATION_REQUIRED`,
`SCOPE_NOT_YET_SUPPORTED`. Perbedaan ini penting: menolak membandingkan merek adalah jawaban yang
benar, bukan kegagalan sistem — dan mood mascot-nya pun berbeda (`wink` / `focus`, bukan `fail`).

---

## 5. Versi

Path memuat `/v1`. Perubahan yang memecah kontrak mendapat `/v2`; penambahan field bersifat aditif dan
tidak menaikkan versi. Klien mengabaikan field yang tidak dikenal, dan **wajib** mengabaikan tipe
event SSE yang tidak dikenal — ini yang memungkinkan penambahan tahap analisis baru tanpa memaksa
rilis serentak.
