# SNOUTY — Arsitektur

Fase 0b · P0b-01 · Terakhir diperbarui 2026-09-30

Dokumen ini menjabarkan keputusan arsitektur yang diusulkan di `PHASE0_PROPOSAL.md` menjadi aturan
yang bisa ditegakkan. Bila dokumen ini bertentangan dengan `SPEC.md`, `SPEC.md` yang menang.

---

## 1. Prinsip yang menentukan bentuk sistem

Satu kalimat dari SPEC §3 menentukan hampir seluruh arsitektur ini:

> **LLM bukan sumber kebenaran teknik.**

Konsekuensinya bukan sekadar "hati-hati memakai LLM", melainkan pemisahan struktural: modul yang
melakukan perhitungan teknik **tidak boleh punya akses ke LLM sama sekali**. Bukan karena kami
berjanji tidak memanggilnya, tetapi karena dependensinya memang tidak ada. Empat prinsip turunannya:

1. **Kebenaran berlapis.** Katalog (MySQL) dan aturan teknik (kode deterministik) adalah fakta; LLM
   hanya menerjemahkan bahasa manusia ke struktur dan struktur kembali ke bahasa manusia.
2. **Setiap nilai membawa asal-usulnya.** Tidak ada nilai tampil ke pengguna tanpa `Provenance`.
3. **Kebijakan adalah kode, bukan prompt.** Aturan bisnis yang hanya hidup di dalam prompt dianggap
   tidak ada, karena tidak bisa diuji dan bisa ditembus.
4. **Eksekusi selektif.** Tidak semua pesan menjalankan seluruh pipeline (SPEC §23).

---

## 2. Gaya arsitektur

**Modular monolith**, bukan microservices (SPEC §16). Satu basis kode, satu database, batas modul
yang tegas di dalamnya.

Alasan memilih ini di awal: batas domain SNOUTY belum stabil. Context Engine, Policy Engine, dan
Engineering Engine akan banyak berubah selama Fase 4–9. Memindahkan batas modul di dalam satu proses
itu murah; memindahkan batas jaringan itu mahal. Monolith modular menunda keputusan yang belum perlu
diambil, tanpa mengorbankan kerapian.

Yang tetap dipisah sejak awal hanyalah dua hal yang profil operasionalnya memang berbeda:

- `apps/worker` — konsumer RabbitMQ. Job panjang, butuh Chromium untuk PDF, tidak menerima trafik
  masuk. Kalau digabung ke API, setiap replika API ikut membawa Chromium dan ikut mengonsumsi antrean.
- `packages/engineering` — paket TypeScript murni tanpa framework dan tanpa I/O.

---

## 3. Peta deployment

```
                    ┌──────────────────────────────────────────┐
  Internet ──► Nginx ──► apps/web (Next.js)                     │
                    │         │ fetch + SSE                     │
                    │         ▼                                 │
                    │    apps/api (NestJS) ──┬──► MySQL 8       │
                    │      stateless, N×     ├──► Redis         │
                    │                        ├──► RabbitMQ ─────┼──► apps/worker
                    │                        └──► OpenRouter    │      (PDF, email,
                    └──────────────────────────────────────────┘       ingest, agregasi)
                                                                        │
                                                       n8n ◄────────────┘ (email, notifikasi, CRM)
```

Catatan operasional yang mengikat implementasi:

- **SSE harus lolos Nginx.** Route streaming wajib `proxy_buffering off;` dan `X-Accel-Buffering: no`,
  kalau tidak seluruh jawaban baru muncul di akhir (SPEC §21).
- **API stateless.** Tidak ada state percakapan di memori proses. Semua state aktif ada di Redis,
  semua state permanen di MySQL. Ini syarat agar bisa di-scale horizontal nanti.
- **MySQL adalah infrastruktur bersama** di `192.168.1.136`, berisi tujuh database aplikasi lain.
  Lihat `DATABASE.md` untuk aturan yang mengikat.

---

## 4. Struktur repositori

```text
snouty/
├── apps/
│   ├── web/          Next.js — aplikasi pelanggan + /internal (back-office)
│   ├── api/          NestJS — HTTP + SSE
│   └── worker/       NestJS standalone — hanya konsumer RabbitMQ
├── packages/
│   ├── shared-types/ Provenance, RequirementState, event SSE, kode error, skema DTO
│   ├── config/       eslint, tsconfig, prettier, preset tailwind
│   ├── ui/           design token + komponen bersama (mascot, tag provenance)
│   └── engineering/  rule engine deterministik — TS murni, tanpa I/O
├── evals/            golden dataset + runner evaluasi
├── docs/
├── design-input/
└── docker/
```

`apps/web` memuat aplikasi pelanggan **dan** back-office di bawah `/internal`. Back-office belum punya
desain (OQ-21) dan volumenya kecil; memecahnya menjadi aplikasi terpisah hanya menambah pipeline build
tanpa manfaat.

---

## 5. Lapisan di dalam `apps/api`

```
presentation  controller, SSE gateway, DTO, guard        ← tahu HTTP
     │
application   use case, orkestrasi, transaksi            ← tahu alur, tidak tahu HTTP
     │
domain        entity, value object, service domain       ← tidak tahu apa pun di luar dirinya
     │
infrastructure repository, klien LLM, queue, storage     ← implementasi dari port di domain
```

Arah dependensi selalu ke bawah. `infrastructure` mengimplementasikan interface yang **dideklarasikan
di `domain`**, sehingga panah dependensi tetap masuk ke dalam meskipun alirannya keluar.

Tidak semua modul perlu empat lapis. `uploads` dan `feedback` cukup satu service dan satu repository.
Menerapkan Clean Architecture penuh ke modul sepele adalah upacara, bukan kualitas (SPEC §26).
Aturannya: **empat lapis hanya untuk modul yang punya aturan domain sendiri** — `context`, `policy`,
`engineering`, `recommendation`, `product-catalog`, `email-intelligence`.

---

## 6. Katalog modul dan kepemilikan

| Modul                 | Milik          | Tanggung jawab                                                 | Fase |
| --------------------- | -------------- | -------------------------------------------------------------- | ---- |
| `auth`                | identity       | JWT access+refresh, guest session, penautan guest → akun       | 3    |
| `users`               | identity       | akun, peran internal                                           | 3    |
| `onboarding-consent`  | identity       | catatan consent + versi kebijakan                              | 3    |
| `conversation`        | conversation   | percakapan, pesan, status, judul                               | 3    |
| `context`             | conversation   | Requirement State Manager                                      | 4    |
| `policy`              | — (leaf)       | entitlement, Pralon-only, scope routing, gerbang provenance    | 5    |
| `ai`                  | — (service)    | abstraksi LLM, prompt, ekstraksi terstruktur, routing model    | 4    |
| `product-catalog`     | catalog        | produk, ukuran, spesifikasi, versi katalog, impor              | 1    |
| `product-knowledge`   | catalog        | lookup terstruktur + orkestrasi retrieval                      | 2    |
| `pricing`             | catalog        | daftar harga berversi (hanya bila OQ-03 = ya)                  | 8    |
| `engineering`         | engineering    | adapter tipis di atas `packages/engineering`, registry + trace | 6    |
| `recommendation`      | recommendation | orkestrasi pipeline, persistensi hasil                         | 7    |
| `material-estimator`  | recommendation | baris BOM + dasar perhitungan                                  | 8    |
| `schematic`           | recommendation | pembentukan topologi                                           | 9    |
| `report`              | report         | perakitan laporan + dispatch job PDF                           | 10   |
| `technical-handoff`   | handoff        | "Kirim ke tim teknis Pralon" + antrean internal                | 10   |
| `uploads`             | ops            | lampiran denah                                                 | 3    |
| `feedback`            | ops            | thumbs up/down per jawaban                                     | 13   |
| `email-intelligence`  | email          | parsing, analisis, klasifikasi lead                            | 11   |
| `market-intelligence` | market         | event, agregasi, anonimisasi                                   | 12   |
| `admin`               | ops            | agregasi back-office                                           | 1+   |

---

## 7. Aturan dependensi antar modul

Ditegakkan oleh lint rule (`eslint-plugin-boundaries`), bukan oleh kesepakatan lisan. Pelanggaran
menggagalkan CI.

```
policy            → (tidak ke mana-mana)   WAJIB leaf
engineering       → packages/engineering   TIDAK BOLEH ke ai/ atau product-catalog/
ai                → (tidak ke domain)      ai adalah layanan, bukan pengambil keputusan
context           → ai, policy
recommendation    → context, engineering, product-catalog, material-estimator, schematic, policy
material-estimator→ engineering, product-catalog
schematic         → engineering
report            → recommendation, product-catalog
modul             → shared → infrastructure   (tidak pernah sebaliknya)
```

Tiga aturan itu yang paling penting, dan masing-masing punya alasan konkret:

**`policy` wajib leaf.** Karena tidak punya dependensi, setiap pemeriksaan kebijakan adalah fungsi
murni `(actor, capability, state) → PolicyDecision`. Inilah yang membuat tes wajib SPEC §31 — "tamu
tidak bisa mengakses kapabilitas lanjutan lewat API meskipun UI dilewati" — murah ditulis dan mustahil
terlupa. Kalau `policy` boleh memanggil repository, ia akan pelan, sulit diuji, dan cepat atau lambat
ada yang melewatinya.

**`engineering` tidak boleh menyentuh `ai`.** Ini penegakan struktural SPEC §25 ("Engineering
calculation → NO LLM"). Bukan disiplin, tapi ketiadaan jalur.

**`ai` tidak boleh menyentuh domain.** Supaya tidak ada godaan menaruh aturan bisnis di dalam prompt.
Kalau sebuah aturan penting, ia hidup di `policy` atau `packages/engineering`, bukan di string.

---

## 8. Jalur permintaan (eksekusi selektif)

Pipeline ini bukan satu pipeline. Intent router memilih **satu** dari lima jalur (SPEC §23):

| Permintaan                            | Jalur                                                                       | Panggilan LLM |
| ------------------------------------- | --------------------------------------------------------------------------- | ------------- |
| FAQ produk                            | policy → MySQL/retrieval → penjelasan → SSE                                 | 1 (fast)      |
| Lookup produk                         | policy → MySQL → penjelasan                                                 | 1 (fast)      |
| Rekomendasi                           | ekstraksi → context → engineering → matcher → penjelasan                    | 2 (balanced)  |
| Kasus lanjutan                        | ekstraksi → klarifikasi → engineering → matching → BOM → skema → penjelasan | 2–3           |
| **Edit kebutuhan / mutasi follow-up** | **context → engineering → matching → BOM → skema**                          | **0**         |

Baris terakhir adalah penghematan terbesar di sistem ini. Ketika pengguna menekan "Ubah" di panel
kanan (layar 04) atau bertanya "kalau kamar mandi saya tambah satu?", nilainya sudah terstruktur —
tidak ada yang perlu diekstraksi ulang. Yang berjalan hanya `ContextMerger` lalu hitung ulang
deterministik. Targetnya < 300 ms, dan itu realistis karena tidak ada satu pun panggilan jaringan
keluar.

Alur lengkap untuk jalur rekomendasi:

```
pesan ──► IntentRouter ──► Policy.evaluate ──► [ditolak? → kartu kebijakan, selesai]
                                   │
                                   ▼
                          ai.extractStructured (zod)  ──► gagal? retry 1× ──► gagal? pertanyaan klarifikasi
                                   │
                                   ▼
                          ContextMerger ──► RequirementSnapshot (append-only)
                                   │
                                   ▼
                          CompletenessEvaluator ──► ada yang kurang? → ClarificationEngine, selesai
                                   │ lengkap
                                   ▼
   ┌── stage: UNDERSTANDING ───────┤
   ├── stage: ANALYZING_INSTALLATION ──► packages/engineering ──► CalculationTrace[]
   ├── stage: MATCHING_PRODUCTS ──────► ProductMatcher ──► katalog MySQL
   ├── stage: COMPOSING ──────────────► Recommendation tersimpan
   └── stage: PREPARING_SCHEMATIC ────► topologi
                                   │
                                   ▼
                          ai.stream (penjelasan) ──► SSE token ──► solution.ready
```

Setiap `stage` adalah batas pipeline nyata yang dipancarkan sebagai event SSE, **bukan timer**. Angka
620 ms per langkah di prototipe hanya ilustrasi (SPEC §33b).

---

## 9. Batas sinkron vs asinkron

| Sinkron (jalur permintaan)    | Asinkron (RabbitMQ)                      |
| ----------------------------- | ---------------------------------------- |
| pesan chat, streaming jawaban | pembuatan PDF laporan                    |
| ekstraksi kebutuhan           | pengiriman handoff teknis                |
| perhitungan teknik            | ingest & validasi katalog                |
| product matching              | embedding dokumen (bila Qdrant diadopsi) |
| BOM & topologi skema          | pemrosesan email masuk                   |
|                               | agregasi market intelligence, notifikasi |

Aturannya: **chat tidak pernah lewat RabbitMQ** (SPEC §19). Antrean dipakai untuk pekerjaan yang boleh
selesai belakangan dan boleh gagal lalu diulang. Jawaban chat tidak termasuk keduanya.

---

## 10. Hal lintas-potong

| Aspek          | Penanganan                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------- |
| Correlation ID | dibuat di middleware, ikut ke log, ke `llm_calls`, ke pesan RabbitMQ, dan ke header respons       |
| Logging        | Pino terstruktur. Dilarang mencatat secret dan data pribadi (SPEC §26, §30)                       |
| Error          | exception domain → mapper → kode error stabil. Stack trace tidak pernah keluar ke klien           |
| Validasi       | zod di batas: setiap DTO masuk, setiap output LLM. Tidak ada data tak tervalidasi masuk ke domain |
| Transaksi      | dimulai di lapisan application, tidak pernah di repository                                        |
| Konfigurasi    | hanya dari env, divalidasi saat boot. Proses menolak start bila config wajib hilang               |
| Audit          | setiap tulis oleh peran internal menulis `audit_logs`                                             |

---

## 11. Bagaimana batas ini dijaga

Arsitektur yang hanya ada di dokumen akan luntur dalam tiga bulan. Yang menjaganya:

1. **Lint boundary** — pelanggaran arah dependensi menggagalkan CI, bukan sekadar ditegur saat review.
2. **`packages/engineering` tanpa dependensi runtime** — `package.json`-nya kosong dari dependensi,
   jadi menambahkan klien HTTP ke sana adalah perubahan yang terlihat jelas di diff.
3. **Tiga tes kebijakan sebagai release blocker** (SPEC §31): pertanyaan kompetitor tidak pernah
   menghasilkan kartu kompetitor; aturan `REQUIRES_DOMAIN_VALIDATION` tidak pernah menghasilkan
   `VERIFIED`; tamu tidak bisa menembus entitlement lewat API.
4. **Larangan hex mentah di `apps/`** — semua warna lewat token `packages/ui`.
5. **Assertion host database di bootstrap tes** — CI menolak jalan bila `DB_HOST` mengarah ke
   `192.168.1.136`.

---

## 12. Yang sengaja belum dibangun

| Ditunda                    | Alasan                                               | Kapan ditinjau                       |
| -------------------------- | ---------------------------------------------------- | ------------------------------------ |
| Microservices              | batas domain belum stabil                            | tidak dalam roadmap                  |
| Qdrant / RAG               | pertanyaan produk masih terjawab oleh query MySQL    | kriteria di `PHASE0_PROPOSAL.md` §13 |
| Python                     | belum ada kebutuhan ML/numerik yang nyata (SPEC §16) | bila muncul kebutuhan konkret        |
| OpenTelemetry / Prometheus | belum ada trafik untuk diamati                       | Fase 13                              |
| Read replica               | satu instance MySQL masih jauh dari jenuh            | bila baca > 70% kapasitas            |
| Multi-region               | tidak relevan                                        | —                                    |

Menuliskan ini eksplisit supaya penundaan terbaca sebagai keputusan, bukan kelalaian.
