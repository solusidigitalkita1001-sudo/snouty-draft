# SNOUTY — Progress

Last updated: 2026-10-08 · Current phase: **4 — Context Engine, intent, ekstraksi, SSE** · Current phase: **5 — Policy Engine, scope routing, klarifikasi** · Current phase: **6 — Engineering Rule Engine** · Current phase: **7 — Product Matching & perakitan rekomendasi** · Current phase: **8 — Riwayat, solusi tersimpan, laporan, handoff** · Current phase: **9 — Schematic Engine** · Current phase: **10–13** · Seluruh pekerjaan yang tidak terhalang **selesai**. Delapan keputusan yang membuka sisanya dirangkum di **`docs/KEPUTUSAN_DIBUTUHKAN.md`**

## Summary

| Phase                                      | Status          | Done / Total |
| ------------------------------------------ | --------------- | ------------ |
| 0a Analysis                                | **approved**    | 7/7          |
| 0b Core docs                               | **disetujui**   | 9/9          |
| 0c Remaining docs                          | **disetujui**   | 15/15        |
| 0d Claude Code config                      | menunggu review | 14/14        |
| 0e Skeleton                                | not started     | 0/8          |
| 1 Product Catalog                          | not started     | —            |
| 2 Product Knowledge Assistant              | not started     | —            |
| 3 Auth / Guest / Conversation / Onboarding | not started     | —            |
| 4 Context Engine + Intent Router + SSE     | not started     | —            |
| 5 Policy + Clarification + Scope routing   | not started     | —            |
| 6 Engineering Rule Engine                  | not started     | —            |
| 7 Product Matching                         | not started     | —            |
| 8 Material Estimator / BOM                 | not started     | —            |
| 9 Schematic Generator                      | not started     | —            |
| 10 History / Saved / Report / Handoff      | not started     | —            |
| 11 Email Intelligence                      | not started     | —            |
| 12 Market Intelligence                     | not started     | —            |
| 13 Hardening & audit                       | not started     | —            |

## Blockers

- ~~`[!]` **P0a-04** — read-only MySQL inspection not performed.~~ Resolved 2026-09-30: credentials
  supplied, inspection done. The `snouty` database exists and is **completely empty**.
- `[!]` **P1 (all)** — cannot start without OQ-07 (catalog source).
- `[!]` **Security, before any deployment** — the only non-system account on the shared server is
  `ict`, which holds `ALL PRIVILEGES ON *.* WITH GRANT OPTION` over seven other databases. SPEC §17
  requires least privilege and forbids the app user holding DROP. Waiting on **OQ-34**.
- `[!]` **P6 (validation)** — every engineering rule stays `REQUIRES_DOMAIN_VALIDATION` until a Pralon
  domain expert is named. Waiting on **OQ-06**.
- ~~Decision needed before Phase 5/10 design work: **OQ-15** (guest entitlement) — it determines whether
  the solution workspace (screen 06) is reachable without an account.~~ Resolved 2026-10-05: owner
  accepted the default (onboarding promise); `ENTITLEMENTS` already matched it. Only the register-gate
  screen remains, under OQ-27/OQ-21.

## Phase 0a — Analysis

- [x] P0a-01 Inspect repository & old codebase — repo had no commits and only the design bundle; no old
      codebase exists (`/Users/f/Documents/pralon/snouty/` is empty). Recorded as OQ-01.
- [x] P0a-02 Read spec — saved verbatim to `docs/SPEC.md`.
- [x] P0a-03 Read design-input (newer prototype first) — bundle relocated to `design-input/handoff/`
      per §33a; prototype, handoff README, mascot sheet, report, both board themes, and the standalone
      onboarding wizard all read; both dark palettes extracted programmatically.
- [x] P0a-04 Inspect `snouty` DB schema (read-only) — MySQL 8.0.46 (Ubuntu 22.04). `snouty` exists,
      `utf8mb4` / `utf8mb4_0900_ai_ci`, and is **empty**: 0 tables, views, routines, triggers, events.
      `snouty_dev` and `snouty_staging` do not exist. Seven other databases share the server (~110 MB,
      301 tables). Only `SELECT`/`SHOW`/`information_schema` statements were issued. New finding
      raised as OQ-34 (privileges).
- [x] P0a-05 Create PROGRESS.md
- [x] P0a-06 Write PHASE0_PROPOSAL.md
- [x] P0a-07 Write OPEN_QUESTIONS.md — 33 questions raised (OQ-01…OQ-33), including 11 design conflicts
      found beyond the 8 listed in SPEC §33h.
- [x] ✋ CHECKPOINT — **disetujui pemilik 2026-09-30** ("ok gas"); berjalan dengan proposed default untuk OQ yang belum dijawab

## Phase 0b — Core docs

Ditulis dalam Bahasa Indonesia (kode, identifier, enum, SQL, dan istilah teknis baku tetap Inggris).

- [x] P0b-01 ARCHITECTURE.md
- [x] P0b-02 DOMAIN_MODEL.md
- [x] P0b-03 POLICY.md
- [x] P0b-04 DATABASE.md — memuat draf SQL akun least-privilege untuk ditinjau (OQ-34)
- [x] P0b-05 CONTEXT_ENGINE.md
- [x] P0b-06 ENGINEERING_RULES.md
- [x] P0b-07 API_CONTRACTS.md
- [x] P0b-08 PRIVACY.md
- [x] P0b-09 DESIGN_IMPLEMENTATION.md — memuat peta token terang→gelap lengkap dari kedua berkas
- [x] ✋ CHECKPOINT — **disetujui pemilik 2026-09-30** ("lanjut")

## Phase 0c — Remaining docs

Seluruh berkas Bagian 48 kini lengkap (28 dokumen).

- [x] P0c-01 PRODUCT.md
- [x] P0c-02 AI_BEHAVIOR.md
- [x] P0c-03 PRODUCT_KNOWLEDGE.md
- [x] P0c-04 PRODUCT_MATCHING.md
- [x] P0c-05 SCHEMATIC_ENGINE.md
- [x] P0c-06 REPORT.md
- [x] P0c-07 EMAIL_INTELLIGENCE.md
- [x] P0c-08 MARKET_INTELLIGENCE.md
- [x] P0c-09 BACKOFFICE.md
- [x] P0c-10 INFRASTRUCTURE.md
- [x] P0c-11 SECURITY.md
- [x] P0c-12 PERFORMANCE.md
- [x] P0c-13 EVALUATION.md
- [x] P0c-14 CODING_STANDARDS.md
- [x] P0c-15 ROADMAP.md
- [x] ✋ CHECKPOINT — **disetujui pemilik 2026-09-30** ("lanjut gass")

## Phase 0d — Claude Code configuration

- [x] P0d-01 `.claude/CLAUDE.md` — 67 baris, aturan saja
- [x] P0d-02 skill `snouty-architecture`
- [x] P0d-03 skill `product-knowledge`
- [x] P0d-04 skill `ai-orchestration`
- [x] P0d-05 skill `snouty-policy`
- [x] P0d-06 skill `engineering-rule-engine`
- [x] P0d-07 skill `schematic-generator`
- [x] P0d-08 skill `async-infrastructure`
- [x] P0d-09 skill `email-intelligence`
- [x] P0d-10 skill `market-intelligence`
- [x] P0d-11 skill `security-guardrails`
- [x] P0d-12 skill `performance-optimization`
- [x] P0d-13 skill `testing-and-review`
- [x] P0d-14 skill `design-implementation`
- [x] ✋ CHECKPOINT — **disetujui pemilik 2026-09-30** ("lanjut gass")

## Phase 0e — Skeleton

- [x] P0e-01 Monorepo scaffold (pnpm workspaces) — 3 app + 4 paket; `packages/engineering` tanpa dependensi runtime
- [x] P0e-02 `.env.example` — seluruh kunci SPEC §17b
- [x] P0e-03 Docker Compose (Redis, RabbitMQ; CI-only MySQL) — compose divalidasi; `mysql-test` di balik profil
- [x] P0e-04 Lint / format / typecheck / test tooling — + 2 skrip pagar arsitektur
- [x] P0e-05 CI pipeline — berkas `.github/workflows/ci.yml` ada dan **sudah divalidasi** (tanpa tab ilegal, setiap job punya `runs-on` dan steps, dan setiap skrip pnpm yang dirujuk benar-benar ada di `package.json`; `pnpm eval` di job evaluasi hanya di-`echo`, bukan dijalankan). Tetap `[ ]` karena pipeline-nya **belum pernah benar-benar berjalan** — itu butuh git provider, **terhalang OQ-09**, dan tidak bisa saya jalankan dari sini. **Update 2026-10-05:** OQ-09 dijawab (GitHub + Actions) dan remote sudah ada; tinggal memastikan run pertama hijau.
      **Selesai 2026-10-08:** CI ternyata tidak pernah berjalan — pemicunya hanya `main` dan PR,
      sedangkan kerja selalu di branch fase. Pemicu ditambah `phase-*/**` + `workflow_dispatch`;
      gitleaks diberi pengecualian hanya untuk nilai dummy `rahasia-…`/`contoh-…` (3 temuan, semuanya
      dummy, bukan secret produksi); data mentah (`data/catalog/`, `data/company/`) keluar dari
      prettier; job pagar tanpa cache pnpm (langkah penutup setup-node gagal). Run
      `37765988785` (commit `cf77463`): pagar arsitektur, format/lint/typecheck, tes (MySQL + Redis
      sungguhan, termasuk 64 cek migration), build — semua hijau; evaluasi AI dilewati sampai
      `EVAL_ENABLED` dan kunci model diset.
- [x] P0e-06 `packages/ui` design tokens (light + dark) + preview page — 74 token; `/tokens` dirender & diverifikasi
- [x] P0e-07 Self-hosted IBM Plex Sans/Mono — diverifikasi: 0 rujukan ke gstatic
- [x] P0e-08 API health check (DB connectivity, read-only) — diuji terhadap DB sungguhan **dan** DB mati
- [x] ✋ CHECKPOINT — **disetujui pemilik 2026-09-30** ("lanjut ke task berikutnya")

## Phase 1 — Product Catalog

Katalog harus lebih dulu: matching, BOM, skema, dan laporan semuanya membaca darinya
(`docs/ROADMAP.md` §2). Layar terkait: **10** (drawer detail produk) dan back-office katalog.

**Yang terhalang, dan semuanya menunggu jawaban — bukan menunggu kode:**

| Tertunda                               | Menunggu                                                           |
| -------------------------------------- | ------------------------------------------------------------------ |
| P1-05b adapter format katalog          | **OQ-07** — format katalog Pralon yang sebenarnya                  |
| P1-06b transport RabbitMQ              | **OQ-40** — jalan `apps/worker` memakai kode domain `apps/api`     |
| P1-10 layar back-office                | **OQ-21** — back-office belum punya desain                         |
| Penerapan migration ke `192.168.1.136` | persetujuan pemilik + backup terkonfirmasi (`docs/DATABASE.md` §4) |

Kontrak impor sengaja dibuat bebas format, jadi menambahkan pembaca Excel atau ERP nanti adalah
menambah satu adapter — bukan merombak validasi, job, maupun layar.

- [x] P1-01 Skema katalog (Drizzle) + berkas migration `.sql` — **tidak diterapkan** ke server; 7 tabel, CHECK constraint, jaminan satu versi aktif
  - [x] P1-01a Tes: migration up/down berjalan di kontainer MySQL sekali pakai — **17 pemeriksaan lolos**
  - [x] P1-01b Foreign key dalam konteks katalog — **tujuh FK ditambahkan** lewat migration 0011 (`products`→`catalog_versions`, lima anak produk→`products`, dan **dua** FK pada `product_compatibility` karena kedua sisi relasi harus produk nyata). `CASCADE` karena anak-anak ini tak berarti tanpa induknya. `scripts/check-catalog-orphans.mjs` memeriksa yatim lebih dulu, karena MySQL menolak menambah FK bila yatim sudah ada dan galatnya tidak menyebut baris mana.
    - [x] Diverifikasi: cek yatim bersih di DB lokal, FK diterapkan, dan sisipan ukuran yatim ditolak `ER_NO_REFERENCED_ROW_2`.
    - [x] **Temuan serius di sepanjang jalan:** `scripts/test-migration.mjs` punya daftar `UP` sendiri yang **tertinggal di 0005 sejak Fase 3** — migration 0006–0011 tidak pernah dijalankannya, sehingga "44/44 lolos" yang saya laporkan berulang kali hanya mencakup katalog/identity/conversation. Daftarnya kini lengkap (50 pemeriksaan, 11 migration), dan ada pemeriksaan baru yang membandingkan daftar `UP` dengan isi direktori `drizzle/` supaya kealpaan yang sama tidak terulang.
- [x] P1-02 Tipe domain katalog di `packages/shared-types` — field spesifikasi kosong bertipe eksplisit `UNAVAILABLE`, bukan dihilangkan
- [x] P1-03 Value object `PipeSize` (parsing kanonik, perbandingan, format tampilan)
  - [x] P1-03a Tes: `1¼"` dan `1.25"` adalah ukuran yang sama; urutan benar — 13 tes lolos
- [x] P1-04 Repository katalog (produk, ukuran, spesifikasi, kompatibilitas, versi) — port di `domain`, implementasi MySQL di `infrastructure`; pagination cursor atas `sku`, bukan `OFFSET`
  - [x] P1-04a Tes integrasi terhadap kontainer MySQL; tes penghitung query (tanpa N+1) — **25 tes lolos**; `listProducts` tetap 3 query untuk 1 maupun 20 produk
- [x] P1-05 Kontrak impor bebas format + validasi per baris — validator murni tanpa I/O; `rowHash` ikut dihitung di sini supaya P1-06 tidak perlu menurunkannya ulang
  - [x] P1-05a Tes: semua galat baris dilaporkan sekaligus, bukan satu per satu — **28 tes lolos**; kolom wajib yang hilang dilaporkan sekali, bukan sekali per baris
  - [ ] `[!]` P1-05b Adapter untuk format sebenarnya — **terhalang OQ-07**
  - [x] P1-05c Kolom dokumen & gambar pada kontrak impor — `Judul|URL|halaman` dan daftar URL gambar; jalur "Lihat dokumen teknis" kini **bisa dicapai dari data impor**, diverifikasi terhadap aplikasi yang berjalan
- [x] P1-06 Job `catalog.ingest` — inti selesai (Fase 1) dan **transport selesai** (P1-06b, OQ-40 diterapkan): antrean, retry berbackoff, DLQ. Konsumer ingest-nya sendiri menunggu bentuk berkas katalog (OQ-07); kontraknya sudah terdaftar di `@snouty/jobs`.
  - [x] P1-06 inti: migration 0001 (`products.row_hash` + `catalog_import_runs`), `CatalogIngestService`, `MysqlCatalogWriter` — idempotensi berlapis tiga, lapisan terdalamnya `uq_products_version_row_hash`
  - [x] P1-06a Tes: impor yang sama dua kali menghasilkan satu versi — **72 tes lolos**; migration 24 pemeriksaan
  - [x] P1-06b Transport RabbitMQ — publisher di API (kegagalan antrean **tidak** menjatuhkan permintaan: laporan tetap `PENDING` dengan nomor yang sudah dialokasikan), konsumer prefetch-1 di worker, retry berbackoff lewat publikasi ulang berjeda (bukan `nack(requeue)` yang akan memutar kegagalan secepat mungkin), DLQ untuk payload tak valid **tanpa** percobaan ulang
    - [x] P1-06a Tes kontrak (11): versi kontrak ditolak bila tak dikenal, `.strict()` menolak field asing, payload hanya membawa id
- [x] P1-07 Promosi versi katalog + invalidasi cache — migration 0002 (`audit_logs`), `CatalogPromotionService`, cache Redis dengan SCAN (bukan `KEYS`)
  - [x] P1-07a Tes: tepat satu versi `active`; promosi membatalkan cache dan menulis audit — **87 tes lolos**, 11 di antaranya terhadap MySQL **dan** Redis sungguhan
- [x] P1-08 API baca katalog — `GET /products`, `/products/:id`, `/products/:id/compatible`, `/catalog/version` `[layar 10]` — keempatnya dipanggil terhadap API yang benar-benar berjalan, bukan hanya lewat tes
  - [x] P1-08a Tes: field spesifikasi null dikembalikan sebagai `UNAVAILABLE`, bukan dihilangkan — **130 tes lolos**; diuji pada hasil `JSON.stringify`, tempat kegagalannya sebenarnya terjadi
  - [x] Lintas-potong yang dibutuhkan kontrak: prefix `/api/v1`, correlation ID, dan bentuk galat tunggal (`ApiErrorFilter`)
- [x] P1-09 Pemetaan provenance untuk field katalog kosong — `domain/spec-value.ts` menjadi satu-satunya tempat nilai spesifikasi dibuat; `SpecValue` kini union terdiskriminasi, sehingga C-1 dan P-2 menjadi galat kompilasi
  - [x] P1-09a Tes: invarian C-1 — spesifikasi kosong tidak pernah diisi tebakan — **155 tes lolos**; lima di antaranya berjalan saat kompilasi lewat `@ts-expect-error`
- [x] P1-10 Back-office katalog — API selesai (Fase 1), dan **layar minimal selesai** (P1-10b) bertanda MENUNGGU DESAIN. Formulir unggah tetap menunggu bentuk berkas sebenarnya (OQ-07), bukan menunggu desain.
  - [x] P1-10 API: `GET /internal/catalog/versions`, `GET /internal/catalog/imports/:id`, `POST /internal/catalog/versions/:id/promote` + `InternalRoleGuard`
  - [x] P1-10a Tes: rute `/internal/catalog/*` menolak peran selain `catalog_admin`; setiap tulis diaudit — **173 tes lolos**; guard **gagal tertutup**, jadi seluruh rute internal menjawab `401` sampai modul `auth` ada di Fase 3
  - [x] P1-10b Layar back-office katalog — **cangkang minimal bertanda "MENUNGGU DESAIN"** di `/internal/catalog`; menyebut bahwa formulir unggah menunggu bentuk berkas sebenarnya (OQ-07) sementara daftar versi & promosi sudah tersedia lewat API
  - [ ] `[!]` P1-10c Endpoint unggah berkas — **terhalang OQ-07** (butuh adapter P1-05b)
- [x] P1-11 Katalog contoh untuk pengembangan (bukan data Pralon asli) — `pnpm seed:sample`; disemai lewat jalur impor sungguhan, bukan `INSERT` mentah, jadi contohnya tidak bisa menyimpang dari hasil importer nyata
- [x] P1-12 `docs/PRODUCT_KNOWLEDGE.md` diperbarui sesuai implementasi akhir — nama berkas dan nama constraint disebutkan; yang masih menunggu ditandai nomor OQ-nya
- [x] ✋ CHECKPOINT — **disetujui pemilik 2026-10-01** ("gass")

Fase 1 selesai sejauh yang bisa dikerjakan tanpa jawaban. Yang tersisa — P1-05b, P1-06b, P1-10b,
P1-10c — semuanya menunggu **OQ-07**, **OQ-21**, dan **OQ-40**.

## Phase 2 — Asisten pengetahuan produk

Modul `product-knowledge` (`docs/ARCHITECTURE.md` §6): lookup terstruktur + orkestrasi retrieval.
Layar terkait: **01**, **02**, dan **10**.

Aturan yang membentuk seluruh fase ini: **bila jawabannya ada di kolom, jangan mencarinya di dokumen.**
LLM hanya merangkai kalimatnya, tidak pernah menjadi sumber faktanya.

**Yang perlu diketahui sejak awal:** permukaan tempat tanya jawab ini terlihat pengguna adalah chat,
dan chat baru ada di Fase 3–4. Jadi Fase 2 menghasilkan service yang matang dan teruji, bukan layar —
"tanya jawab produk yang jujur" di `docs/ROADMAP.md` §4 baru bisa didemokan setelah Fase 4. Ini
bukan penundaan; urutan di roadmap memang begitu.

- [x] P2-01 Modul `product-knowledge` + arah dependensi — **nol impor MySQL**; dokumen produk pun dibaca lewat port baca katalog
  - [x] P2-01a Tes: pagar lint menolak impor MySQL dari modul ini — diverifikasi dengan menjalankan eslint terhadap berkas yang sengaja melanggar, bukan dengan membaca konfigurasinya
- [x] P2-02 Kosakata `ProductAspect` + pemetaan deterministik ke data katalog — sembilan aspek; enam di antaranya bernama persis seperti `spec_key`-nya
  - [x] P2-02a Tes: setiap aspek punya jalur data; tidak ada aspek yang jatuh ke LLM — kelengkapan peta diperiksa dua arah, jadi aspek yang dihapus pun ketahuan
- [x] P2-03 Perakitan jawaban produk dengan provenance — empat jalur jawaban, **nol panggilan LLM**
  - [x] P2-03a Tes: kolom kosong tidak pernah ditambal hasil pencarian dokumen — termasuk kasus dokumen berjudul "Tekanan kerja 10 bar", godaan paling langsungnya
- [x] P2-04 Jawaban "data belum cukup" + tawaran tim teknis — dibedakan tegas dari "Lihat dokumen teknis"
  - [x] P2-04a Tes: tidak ada jalur yang mengembalikan angka tanpa sumber — kedelapan aspek diperiksa membawa provenance, dokumen, dan halaman
- [x] P2-05 `AssistantCard` union tertutup + `ProductCardDto` di `packages/shared-types`
  - [x] P2-05a Tes: tidak ada varian kartu yang menerima HTML atau markdown bebas — enam tes berjalan saat **kompilasi** lewat `@ts-expect-error`
- [x] P2-06 Port `KnowledgeRetriever` + implementasi di atas data katalog
  - [x] P2-06a Tes: setiap potongan membawa dokumen + halaman; di bawah ambang → tidak ada potongan sama sekali
- [x] P2-07 Logger terstruktur + penghitung pertanyaan tak terjawab — kriteria adopsi RAG #2 kini **terukur**
  - [x] P2-07a Tes: log tidak pernah memuat isi pertanyaan pengguna — daftar field tertutup, diuji dari keluaran log sungguhan
- [x] P2-08 `docs/PRODUCT_KNOWLEDGE.md` §4–§5 diperbarui + keputusan "Qdrant belum diadopsi" dicatat beserta cara mengukurnya
- [x] ✋ CHECKPOINT — **disetujui pemilik 2026-10-01** ("gas")

**Qdrant tetap tidak diadopsi.** Ketiga kriteria di `docs/PRODUCT_KNOWLEDGE.md` §5 belum terpenuhi, dan
yang pertama terbukti langsung dari kode: sistem ini belum menyimpan isi dokumen sama sekali —
`product_documents` memuat judul, URL, dan halaman. Tidak ada korpus untuk di-embed.

## Phase 3 — Auth, sesi tamu, percakapan, onboarding, consent, peran

Empat modul: `auth`, `users`, `onboarding-consent` (konteks identity), dan `conversation`
(`docs/ARCHITECTURE.md` §6). Layar terkait: **01** (welcome), **14** (onboarding), serta
login/register.

Fase ini yang pertama kali menghasilkan **layar sungguhan** — sampai sekarang yang ada hanya
`/` dan `/tokens`. Ia juga yang melepas satu hal yang sengaja saya tinggalkan tertutup: guard
`/internal/*` menjawab `401` untuk semua orang karena belum ada yang mengisi `internalActor`
(lihat P1-10a). P3-07 yang mengisinya.

**Yang terhalang desain:** layar login/register dan halaman privasi/ketentuan menunggu **OQ-21**
dan **OQ-12**; register-gate menunggu **OQ-27**. Logika di baliknya tidak terhalang — API dan
use case bisa selesai lebih dulu, dan itu urutan yang benar karena layar yang dibangun di atas
API yang belum ada akan dibongkar lagi.

**Dua keputusan produk yang akan menghadang, dan keduanya bukan milik saya:** tingkat pengguna
`registered` vs `advanced` (**OQ-05** — untuk MVP keduanya setara), dan entitlement tamu
(**OQ-15**, yang menggerbangi Fase 5 dan 10). Fase 3 tidak perlu menjawabnya; ia hanya tidak boleh
memutuskannya diam-diam.

- [x] P3-01 Migration 0003: `users`, `user_roles`, `refresh_tokens`, `guest_sessions`, `consents` — **tidak diterapkan** ke server; memakai foreign key sungguhan, sesuai `docs/DATABASE.md` §5
  - [x] P3-01a Tes: migration naik/turun + setiap constraint — **44 pemeriksaan lolos**, dan skripnya kini membersihkan dirinya sendiri sehingga bisa dijalankan berulang
- [x] P3-02 Hash password Argon2id — port + implementasi; parameter OWASP minimum ditulis eksplisit, `@node-rs/argon2` dipilih karena binary prebuilt (tanpa kompilasi native di CI)
  - [x] P3-02a Tes: password tidak pernah dicatat maupun dikembalikan; hash berbeda untuk password sama — **244 tes lolos**; Argon2 sungguhan, bukan mock
  - [x] Aturan password: panjang minimum 12, **tanpa aturan komposisi** — panjang satu-satunya ukuran yang berkorelasi dengan kekuatan
- [x] P3-03 Token: access JWT pendek (HS256, klaim minimum) + refresh buram dengan **rotasi** dan deteksi pemakaian ulang per family
  - [x] P3-03a Tes: refresh token lama yang dipakai lagi mencabut **seluruh rantai**, bukan satu token — **268 tes lolos**; termasuk urutan "pemakaian ulang diperiksa SEBELUM kedaluwarsa" dan "family lain milik pengguna yang sama tidak ikut tercabut"
- [x] P3-04 Sesi tamu — cookie `httpOnly` + `SameSite=Lax`, ULID, sliding TTL dari config; hanya pada rute publik (bukan `/health` atau `/internal`)
  - [x] P3-04a Tes: sesi tamu terbentuk pada permintaan pertama tanpa diminta — **281 tes lolos**; cookie diperlakukan sebagai klaim, bukan bukti (fixation, kedaluwarsa, dan sesi tertaut semuanya diganti sesi baru)
- [x] P3-05 Register / login / logout / refresh sebagai use case — email ganda ditangkap dari unique index (anti balapan); login membayar biaya Argon2 juga saat emailnya tidak terdaftar (anti enumerasi lewat waktu, diukur tes)
  - [x] P3-05a Tes: logout mencabut di sisi server, bukan hanya menghapus cookie — **297 tes lolos**; termasuk balapan dua registrasi serentak terhadap MySQL sungguhan
- [x] P3-06 Penautan tamu → akun dalam **satu transaksi** — invarian G-1; `FOR UPDATE` pada sesi supaya dua register serentak dengan cookie yang sama tidak dua-duanya menautkan
  - [x] P3-06a Tes: seluruh percakapan berpindah tanpa kehilangan satu pun; kegagalan di tengah tidak meninggalkan percakapan tanpa pemilik — **345 tes lolos**; snapshot Fase 4 akan ikut otomatis karena berkunci `conversation_id`. Diverifikasi hidup: tamu ngobrol → register → `resumedConversationId` menunjuk percakapan aktifnya, pesan utuh, cookie tamu lama diganti
- [x] P3-07 `users` + peran internal; `internalActor` terisi sehingga `/internal/*` berhenti menjawab `401` — middleware **mengisi, tidak pernah menolak**; guard di rutenya yang memutuskan. `scripts/grant-role.mjs` untuk pengembangan lokal (menolak host non-lokal — pemberian peran sungguhan lewat `/internal/users/*` yang diaudit)
  - [x] P3-07a Tes: peran tidak diwariskan — `admin` tetap ditolak rute `catalog_admin` — **301 tes lolos**; diverifikasi hidup: tanpa token 401, token tanpa peran 403, token `catalog_admin` 200, token rusak 401 (bukan 500), dan audit promosi membawa id + peran + correlation-id sungguhan
- [x] P3-08 Consent sebagai baris database dengan `policyVersion`; pencabutan mengisi `revokedAt` — append-only; `policyVersion` dari config server, bukan dari klien
  - [x] P3-08a Tes: baris consent tidak pernah dihapus; penolakan tidak menghalangi alur — **311 tes lolos**; "terbaru" ditentukan `id` ULID (urutan total), bukan stempel waktu yang bisa seri
- [x] P3-09 Onboarding state dari **server** (`done` \| `guest` \| `skip` \| `pending`) + manfaat dibangkitkan dari `ENTITLEMENTS` — `pending` = ketiadaan baris; tabel entitlement lahir di modul `policy` (leaf, data murni)
  - [x] P3-09a Tes: daftar manfaat diturunkan dari tabel entitlement, bukan ditulis tangan — **326 tes lolos**; tag AKUN/LANJUTAN/TAMU JUGA diturunkan dari tier, dan konsistensinya diperiksa untuk SEMUA kapabilitas
- [x] P3-10 Migration 0005 + modul `conversation`: percakapan, pesan, status, judul — kepemilikan diperiksa di lapisan application; milik orang lain menjawab `NOT_FOUND`, bukan `403`
  - [x] P3-10a Tes: status hanya dari enum; daftar riwayat terurut `updated_at DESC` — **337 tes lolos**; `transferOwnership` (fondasi G-1) ikut teruji: seluruh percakapan pindah dan yang terbaru ditunjuk untuk `resumedConversationId`
- [x] P3-11 API auth / sesi / consent / onboarding / percakapan + guard autentikasi — refresh token di cookie `httpOnly` ber-`path=/api/v1/auth`; `resumedConversationId` diambil dari cookie tamu yang diverifikasi middleware, bukan dari body
  - [x] P3-11a Tes: tamu tidak bisa menyentuh kapabilitas khusus terdaftar lewat API meski UI dilewati — **353 tes lolos**; dipaku untuk SEMUA kapabilitas non-tamu, dan dibuktikan hidup lewat HTTP: tamu memanggil `GET /conversations` → `403 NOT_ENTITLED {capability: CONVERSATION_HISTORY}`
- [x] P3-12 Layar **14 onboarding** — layar sungguhan pertama, dari prototipe baru (860×580, hero merah, bottom sheet < 720px); state dari server, manfaat dari `/onboarding/benefits`, consent lokasi → baris database, keyboard → / ← / Enter / Esc, `prefers-reduced-motion`
  - [x] P3-12b Layar 01 welcome (cangkang chat) — sempat ditunda ke Fase 4 karena composer tanpa pipeline pesan akan dibongkar ulang. **Ditutup 2026-10-05:** di prototipe welcome adalah state awal ruang konsultasi (`isWelcome`), dan state itu sudah dibangun di `ChatWorkspace` (07f38ca). Beranda `/` kini merender `ChatWorkspace` + onboarding sebagai overlay, menggantikan placeholder Fase 0e; `/consultation` tetap sebagai rute tanpa onboarding. Diverifikasi live: keduanya 200 dan memuat composer
  - [x] P3-12c Layar **masuk** dan **daftar** — dibangun **minimal dan ditandai "MENUNGGU DESAIN"**, persis seperti yang diperintahkan `docs/DESIGN_IMPLEMENTATION.md` §11 untuk layar yang belum didesain. Saya sebelumnya salah menganggap OQ-21 memblokir ini; yang dilarang adalah membuatnya _tampak selesai_, bukan membangunnya. Tombol "Daftar Akun" onboarding kini mengarah ke `/register`.
    - [x] P3-12ca Tes (12): banner tak bisa disembunyikan (satu prop saja), petunjuk sandi lewat `aria-describedby` **bukan** di dalam label (teks dalam label ikut menjadi nama aksesibelnya), kode galat API dipetakan ke teks Indonesia, formulir menolak kirim saat field wajib kosong
    - [x] P3-12cb Diverifikasi live: `/login` dan `/register` 200 dengan banner terpasang; registrasi nyata lewat proxy mengembalikan `tier: registered` + access token
  - [ ] `[!]` P3-12cc Layar register-gate (panel yang muncul saat tamu menyentuh fitur berakun) — tetap **terhalang OQ-27**: bentuknya adalah keputusan desain, bukan layar yang bisa dibuat minimal tanpa menebak alurnya
- [x] P3-13 `docs/SECURITY.md` §3 dan `docs/PRIVACY.md` §3 disesuaikan implementasi — parameter Argon2/token konkret, consent append-only; `API_CONTRACTS.md` sudah cocok apa adanya
- [x] ✋ CHECKPOINT — **lanjut atas goal berjalan "sampe selesai"** (pola checkpoint sesi ini selalu disetujui "gas"/"lanjut"); dua sisa murni terhalang desain

Fase 3: **11/13 selesai.** Dua tersisa murni terhalang desain — **P3-12b** (layar 01 welcome, dipindah ke Fase 4 karena butuh pipeline pesan) dan **P3-12c** (login/register/register-gate — OQ-21, OQ-12, OQ-27). Logika auth, sesi, consent, onboarding, dan percakapan seluruhnya hidup dan teruji; yang kurang hanya tampilan di atasnya.

## Phase 4 — Context Engine, intent router, requirement parser, SSE

Konteks `conversation`, modul `context` + `ai` (`docs/ARCHITECTURE.md` §6). Layar: **02** (konsultasi
aktif) dan indikator tahap. Di sinilah LLM pertama kali masuk sistem.

Aturan yang membentuk seluruh fase (docs/AI_BEHAVIOR.md, docs/CONTEXT_ENGINE.md):

- **LLM tidak pernah menghitung apa pun teknik** — itu Fase 6. Di sini LLM hanya memahami bahasa,
  mendeteksi intent, dan mengekstrak terstruktur.
- **Jalur edit & mutasi follow-up = NOL panggilan LLM.** Nilainya sudah terstruktur; tinggal merge.
- **Konteks ke model adalah state terstruktur, bukan transkrip mentah.**

**Yang terhalang:** panggilan LLM sungguhan butuh `OPENROUTER_API_KEY` dan model Pralon-nya belum
ditetapkan (bagian OQ-09/§17b). Strateginya sama seperti selama ini: `ai` di belakang port, inti
deterministik diuji penuh tanpa model, adapter OpenRouter digerbang keberadaan kunci, dan **evaluasi
(docs/EVALUATION.md) dijalankan saat dataset + kunci ada** — bukan sebelum.

- [x] P4-01 Tipe `RequirementState` + `Intent` di `packages/shared-types` — setiap field `TrackedValue`; `CORE_REQUIREMENT_FIELDS` satu sumber angka 4
- [x] P4-02 `ContextMerger` — fungsi murni di modul `context`; presedensi `user_edited>user_stated>inferred>default_applied`, `undefined`/`null` ≠ hapus, `now` disuntikkan
  - [x] P4-02a Tes §9 #1, #3, #4 + presedensi penuh + kemurnian (8 tes); #5 ke P4-06a, #2/#8 ke P4-04a
- [x] P4-03 `CompletenessEvaluator` — tepat empat field inti (`CORE_REQUIREMENT_FIELDS`), caption desain, `withCompleteness` satu-satunya penulis turunan
  - [x] P4-03a Tes §9 #6 (6 tes; value 0 dihitung terisi, field non-inti tidak)
- [x] P4-04 Default "Belum tahu" + kartu asumsi (ENG-014) — `reason` dari tabel (bukan LLM), `default_applied` terlemah jadi tak pernah menimpa
  - [x] P4-04a Tes §9 #2, #8 (6 tes; kartu melempar bila ASSUMED tanpa reason)
- [x] P4-05 `ClarificationEngine` — satu engine dua bentuk (tunggal <3, kartu ≥3), urutan prioritas ENG-007, maks 4, "Belum tahu" selalu ada
  - [x] P4-05a Tes §9 #7 (7 tes)
- [x] P4-06 Migration 0006 `requirement_snapshots` (unique `(conversation_id, version)` = monoton di DB) + repo append-only (tanpa update/delete) + store write-through (MySQL dulu, Redis menyusul; version dari MySQL bukan cache)
  - [x] P4-06a Tes §9 #5 (7 tes, MySQL+Redis nyata): monoton, duplikat ditolak DB, cache miss dilayani MySQL lalu diisi ulang
- [x] P4-07 Routing model (fungsi murni, ID model dari env — tak pernah di kode) + port `ai` (layanan, tak sentuh domain) + skema ekstraksi zod `.strict()` `optional` bukan `nullable` + `extractionToUpdates`
  - [x] P4-07a Tes (13): routing deterministik & tanpa tingkat untuk teknik; skema menolak null/enum asing/batas/properti tak dikenal; intent confidence 0–1
- [x] P4-08 Intent router — klasifikasi lewat port `ai`, keputusan deterministik di kode; ambang keyakinan 0,6 → `CLARIFICATION_NEEDED`; `shouldExtract`/`mutatesState` diturunkan dari intent
  - [x] P4-08a Tes §9 #10 (6, fake ai): mutasi & jawaban klarifikasi memutasi; penjelasan/lookup/pernyataan-awal tidak; ragu → bertanya
- [x] P4-09 Adapter OpenRouter — transport (satu-satunya jaringan) di belakang port; retry 1× ke tingkat `strong` lalu **lempar** (tanpa percobaan ketiga); migration 0007 `llm_calls`; perekam biaya tanpa field isi prompt
  - [x] P4-09a Tes (7): retry-lalu-lempar, tiap percobaan tercatat, `LlmCallRecord` & tabel tak punya kolom prompt/message/content, CHECK outcome
- [x] P4-10 Pipeline pesan + SSE `POST /conversations/:id/messages` — ruas UNDERSTANDING (sisanya Fase 6/7); `AssistantStreamEvent` union; tanpa kunci → `error LLM_UNAVAILABLE` (giliran tak jatuh); diverifikasi live (buat percakapan → stream event)
  - [x] P4-10a Tes (9): bentuk event sesuai kontrak, lengkap→CTA / kurang→klarifikasi, ekstraksi gagal→klarifikasi, edit inline nol-LLM (§9 #9)
- [x] P4-11 Layar 02 konsultasi aktif + indikator tahap — sidebar 236/rail 60/header 52/panel 300 lewat token; klien SSE membaca `ReadableStream` (bukan `EventSource`, karena giliran ber-body); panel kanan diisi `requirement.updated`, kartu klarifikasi dari `card`, indikator lima tahap dari `stage` (bukan timer); `UNAVAILABLE` tidak merender nilai
- [x] P4-12 `docs/CONTEXT_ENGINE.md` §10 + `docs/AI_BEHAVIOR.md` §12 — status implementasi Fase 4 (inti deterministik terbangun & teruji; adapter digerbang kunci; evaluasi menunggu dataset + ID model Pralon)
- [x] P4-13 **Ruas PRODUCT_LOOKUP disambungkan** (2026-10-05, dari laporan pemilik "apa bedanya PVC dan HDPE" dijawab kartu klarifikasi) — sebelumnya intent ini menutup giliran **tanpa jawaban** dan web tidak punya renderer kartu produk, padahal `product-knowledge` (Fase 2) sudah lengkap. Kini: port `ai.parseProductQuestion` memetakan ke produk + aspek (kosakata tertutup, disamakan dengan `PRODUCT_ASPECTS` oleh tes; OpenRouter `product_question` tingkat fast, adapter dev kata kunci), produk dicari di katalog aktif ("A dan B" → dua pencarian; yang tidak ada dikatakan tidak ada + tawaran tim teknis), `ProductQuestionService` menjawab dengan provenance, kalimat templat deterministik membawa sumber (`product-answer-text.ts`), kartu `product` dirender web (`ProductLookupCards`, MENUNGGU DESAIN) dan membuka drawer layar 10 tanpa label "dipakai di solusi". Sekalian: kartu analisis tidak lagi terbuka oleh event tahap pesan biasa (regresi P13-05). Tes: pipeline 7, adapter dev +5, pagar kosakata 1, web +3
- [x] P4-14 Giliran tanpa ekstraksi **dibalas** (2026-10-05, dari laporan pemilik "hai jo" dijawab formulir) — `OUT_OF_SCOPE` (sapaan/di luar topik) → sapaan yang mengarahkan, `EXPLANATION_REQUEST` → rujukan ke "Tampilkan detail teknis", `CLARIFICATION_NEEDED` → bertanya balik; sebelumnya ketiganya menutup giliran tanpa sepatah kata, juga di jalur LLM. Kalimatnya tetap (`reply-copy.ts`), tanpa fakta teknis; teks balasan kini ikut disimpan di pesan asisten. Adapter dev mengenali sapaan utuh ("hai jo", "selamat pagi", "makasih") sebagai `OUT_OF_SCOPE`; sapaan yang membawa kebutuhan tetap diekstrak. Percakapan yang benar-benar kontekstual tetap menunggu kunci model (OQ-09). Tes: pipeline +2, adapter +2
- [x] P4-15 **Model sungguhan pertama kali hidup** (2026-10-05) — jalur OpenRouter dicoba dengan kunci milik pemilik (akun free, limit $0 → 403), lalu **model offline** `qwen2.5:7b-instruct` lewat Ollama (OpenAI-compatible, `OPENROUTER_BASE_URL`) di laptop; `scripts/server-ollama-setup.sh` untuk server kantor (cp-1, 4 vCPU/16 GB, tanpa GPU). Empat temuan yang tidak pernah muncul di stub, semua ditutup: (1) skema zod tidak pernah DIKIRIM ke model — `callStructured` kini melampirkan `z.toJSONSchema`, prompt intent mendefinisikan 8 label; (2) model menolak (403/limit) menjadi 503 generik — kini `LlmUnavailableError` → event `LLM_UNAVAILABLE`; (3) tanda inci `"` memotong string JSON prosa → konteks memakai "inci"; (4) model kecil "melengkapi" `floorHeightM`/`mainRunMeters` yang tidak diucapkan → pagar grounding di `extractionToUpdates`. Plus **`ReplyWriter`**: sapaan/komplain/jawaban produk ditulis model dari konteks 6 giliran terakhir dengan blok DATA sebagai satu-satunya fakta, pagar angka + merek, fallback teks tetap. Tes +14; api 673. Latensi CPU laptop 2–30 detik per panggilan
- [x] P4-16 **Layar 02 fungsional + responsif** (2026-10-05, dari laporan pemilik: "tombol plus statis, panel solusi nggak guna, belum responsive") — audit elemen per elemen terhadap prototipe lalu: sidebar 236 ↔ rail 60 saling tukar lewat «/» (tidak pernah keduanya); "+ Konsultasi Baru" dan "+" rail = `reset()` (percakapan baru, state bersih, riwayat dimuat ulang); item riwayat membuka kembali percakapan (`fetchConversation` + endpoint baru `GET /conversations/:id/requirement` untuk mengisi panel), blok aktif dengan status SEDANG BERLANGSUNG / SOLUSI SIAP / DIBUKA KEMBALI, meta tanggal "12 SEP"; footer akun (inisial + nama/Pelanggan, tamu → Masuk · Daftar); header: judul "Konsultasi Baru" → judul turunan kebutuhan, badge "KATALOG PRALON · v…" dari `/catalog/version`, toggle panel ekstra dihapus; chip klarifikasi langsung mengirim jawaban (bukan mengisi draft); CTA "Susun rekomendasi"; panel: tersembunyi di sambutan, tertutup secara bawaan, label/nilai polos prototipe ("Tipe bangunan", "2"), baris kosong amber + garis putus, hitungan rail = field terbaca (sampai 7), titik hijau saat solusi siap, empat saran LANJUTKAN PERCAKAPAN yang mengirim pesan. **Responsif (JS `matchMedia`, seperti `narrow` prototipe):** <1080 sidebar/rail hilang, header dapat "+ Baru" + menu "Riwayat" 260px, panel jadi overlay + scrim dan menutup saat menyempit; <720 composer pil + kirim bulat 40px "→", chip radius 18 target ≥44px, "Kebutuhan (n)" di header membuka panel. "Lampirkan denah" tetap nonaktif dengan alasan — juga tanpa aksi di prototipe, dan `POST /uploads` baru kontrak (lihat P13-06)
- [x] P4-17 **Edit inline panel kanan** (2026-10-05) — `PATCH /conversations/:id/requirement` (kontrak §3, nol LLM): tujuh field panel divalidasi zod per path dengan batas yang sama seperti skema ekstraksi, masuk merger sebagai `user_edited`, snapshot `user_edit` hanya bila berubah. Web: "Ubah" ↔ "Selesai" di caption KEBUTUHAN ANDA, input 120px rata kanan (select untuk enum, angka untuk hitungan), hanya field yang berubah yang dikirim; bila solusi sudah ada, analisis dijalankan ulang otomatis (satu-satunya jalur yang menghasilkan trace). "Perbaiki asumsi ini" di solusi membuka panel langsung dalam mode Ubah (prototipe). Tes service +2
- [x] P4-18 **Jalur `PRODUCT_FAQ` — pertanyaan konsep produk** (2026-10-06) — "apa bedanya PVC dan HDPE?" sebelumnya hanya dijawab fakta katalog ("HDPE tidak ada… CONTOH Pipa PVC AW…"), terbaca sebagai bukan jawaban. Kini pertanyaan dengan aspek `null` (perbedaan bahan, "apa itu", kapan dipakai) ditulis model lewat `ReplyWriter` + `PRODUCT_FAQ_SYSTEM_PROMPT`: penjelasan kualitatif di atas blok DATA katalog; angka di luar DATA dan merek lain ditolak kode, fakta katalog ditempel bila model tidak menyebut produknya. Pertanyaan SPESIFIKASI (aspek terisi) tetap tanpa model. Tes pipeline +2; `docs/PRODUCT_KNOWLEDGE.md` + `docs/AI_BEHAVIOR.md` diperbarui
- [x] P4-19 **Pengetahuan teknik terpisah dari katalog; katalog contoh ditandai dan dipagari** (2026-10-06, dari laporan pemilik: jawaban memuat "HDPE tidak ada di katalog Pralon" + "CONTOH Pipa PVC AW … Bukan produk Pralon") — OQ-46. Basis pengetahuan terstruktur `pipe-knowledge.ts` (4 bahan × bentuk/sambungan/ketahanan/pemakaian + 3 konsep; tanpa angka, standar, merek — dites); "bedanya A dan B" dirakit per dimensi, utuh tanpa katalog dan tanpa model. Migration **0013** `catalog_versions.kind` (`pralon`/`sample`; seed menulis `sample`); `catalog-visibility.ts` satu tempat untuk `isAuthoritative` / `sampleCatalogAllowed` / `isAnswerable`; `CatalogQueryService` gagal tertutup atas versi `sample` di luar development (juga dari cache), `AnalysisService` dipindah ke service ini. Pipeline produk: KONSEP = pengetahuan → katalog pendukung (hanya `pralon`) → model perangkai; SPESIFIKASI = katalog → product-knowledge; klaim "tidak ada di katalog Pralon" hanya atas katalog `pralon`; katalog gagal dibaca → penjelasan tetap, tanpa klaim. Badge "KATALOG CONTOH · dev-0.1" saat `sample`. Tes: pipeline 13, pengetahuan 4, visibilitas 3, query service +3, mapper +1; migration test 55/55 (+3)
- [x] P4-20 **Balasan asisten dirender sebagai Markdown ringan** (2026-10-06, dari laporan pemilik: jawaban tampil sebagai paragraf polos) — akar: `chat-workspace.tsx` merender `turn.text` sebagai text node (tanpa `pre-wrap`, jadi baris dan butir melebur), tidak ada renderer, preflight Tailwind menghapus bullet. Kini `AssistantMarkdown` (react-markdown 10, daftar putih: p/strong/em/ul/ol/li/judul→label kecil/code/br/blockquote/hr; `skipHtml`, tautan & gambar dibuang isinya tinggal; tanpa `dangerouslySetInnerHTML`), CSS terkurung di `.md` (disc/decimal, indentasi, jarak paragraf). Streaming tidak berubah: token dikumpulkan lalu dirender sekali di akhir giliran. `MARKDOWN_FORMAT_RULE` ditambahkan ke prompt balasan + FAQ; teks deterministik `pipe-knowledge.ts` ditulis dalam bentuk yang sama (ringkasan → blok per bahan → simpulan); pagar angka `ReplyWriter` mengabaikan penanda daftar bernomor. Tes komponen 9 (paragraf, tebal/miring, daftar + tebal di butir, judul→label, HTML/skrip, tautan/gambar, Markdown rusak, blok kode, 300 butir); docs AI_BEHAVIOR §6/§8, API_CONTRACTS
- [x] P4-22 **Jawaban klarifikasi ditampung + overlay analisis modal** (2026-10-06, dari laporan pemilik: tiap chip jadi satu giliran dengan "Data inti sudah lengkap" berulang; kartu analisis nongkrong di stream, hasil tak terlihat) — `POST /conversations/:id/requirement/clarification` (nol LLM: label chip → nilai domain lewat `answerToUpdate`, "Belum tahu" → default ASSUMED, snapshot `clarification_answer`, satu gelembung pengguna ringkasan + satu kartu lanjutan dari `followUpCard` yang kini dipakai juga setelah ekstraksi). Web: `ClarificationCard` menandai pilihan, "Kirim jawaban" aktif setelah semua terjawab, "Lewati…" = semua "Belum tahu"; satu pertanyaan tetap langsung terkirim (bentuk tunggal prototipe); kartu lama terkunci. Analisis jadi **overlay modal** seperti "ANALYSIS OVERLAY" prototipe (scrim, 470px, tanpa tombol tutup, Escape diabaikan, fokus ke dialog); tombol hanya saat gagal (Coba lagi / Kembali ke percakapan); "Memahami kebutuhan" ditandai selesai sejak awal (sebelumnya bar berhenti di 80% dan judul tak pernah "Solusi siap!"); setelah "Solusi siap!" overlay menutup. Tes: klarifikasi +3, service +2
- [x] P4-28 **Irigasi dihitung mesin teknik (Kelompok E)** (2026-10-06, pemilik: "AI-nya harusnya bisa ngitung juga") — `packages/engineering`: ENG-101 debit rencana (1,5 / 0,8 / 0,5 l/s/ha genangan/sprinkler/tetes — KP-01 & praktik umum), ENG-102 diameter dari debit (D = √(4Q/πv), v = 1,5 m/s, tabel nominal), ENG-103 pompa & kelas tekanan, ENG-104 bahan per segmen (≥ 200 m → HDPE), ENG-105 panjang & BOM estimasi (lahan bujur sangkar, lateral tiap 25 m); `computeIrrigation` dengan trace per aturan; semua `REQUIRES_DOMAIN_VALIDATION` → ASSUMED; registry 19 aturan. API: `irrigation-input.ts` (label → angka, rentang/`Belum tahu` → asumsi per field), `irrigation-view.ts` (statistik, baris sistem, BOM, asumsi, prosa deterministik), `AnalysisService.runIrrigation` (pencocokan produk main/branch/fitting, simpan, `kind: 'irrigation'`), klarifikasi lengkap → CTA "Susun rekomendasi"; skema irigasi → 404 (menunggu desain). Shared: `Recommendation.kind` + `irrigationStats`, `BomUnit` + `meter`. Web: statistik irigasi di layar solusi. Tes: engineering +4 (86), input +2; suite API 739. Rujukan rumus & kebutuhan validasi di OQ-47
- [x] P4-27 **Jalur irigasi: kebutuhan terpandu + arahan + handoff terstruktur** (2026-10-06, keputusan pemilik atas "irigasi sawah 1 hektar" — OQ-47) — `RequirementState.useCase` (`irrigation`, terpisah dari field bangunan); `context/domain/irrigation.ts` (fakta tersurat: ha, sumber, jenis, jarak m/km, beda tinggi, pompa; kartu maks 4 berprioritas; `Belum tahu` tidak menimpa; lengkap = 5 field wajib); `irrigation-guidance.ts` (arahan produk umum tanpa angka dari `pipe-knowledge`); pipeline mengenali irigasi dari pesan **sebelum** ekstraksi (nol LLM); jawaban `irrigation.*` lewat endpoint klarifikasi yang sama; lengkap → kartu handoff `TECHNICAL_VALIDATION_REQUIRED` dengan data terbaca; antrean handoff kini memakai label bahasa pengguna (`capturedFrom`) untuk semua jalur. Guna lain di luar cakupan (tambak, air panas, cairan proses) tetap kartu validasi teknis (`useCasePolicy`). Belum ada: sizing otomatis (butuh aturan Pralon), panel kanan untuk field irigasi (menunggu desain). Tes irigasi 4, pipeline +2, service +1, policy +1
- [x] P4-24 **Latensi: jalur cepat tanpa model, batas waktu yang membatalkan, judul di latar** (2026-10-06, laporan pemilik: "nge-prompt sampai 40 detik") — pengukuran `llm_calls` (qwen2.5:7b di CPU): judul rata-rata 57 s, prosa balasan 43 s, intent 12,6 s, ekstraksi 17,7 s. Perubahan: (1) `ai/domain/heuristics.ts` — sapaan, merek pesaing, konsep produk ("apa bedanya PVC dan HDPE") dan parse pertanyaan produk dengan keluarga yang tersurat dipetakan **tanpa model** di adapter live (dulu hanya di adapter pengembangan; keduanya kini satu sumber); pesan berisyarat kebutuhan tetap ke model. (2) Judul: potongan pesan dipasang instan, model memperhalusnya di latar — 0 detik di jalur jawaban. (3) `LLM_FAQ_REWRITE` baku nonaktif: teks FAQ deterministik langsung (model 7B toh ditolak pagar struktur). (4) `LLM_REPLY_TIMEOUT_MS` (20 s) untuk balasan percakapan dengan **pembatalan nyata** (`AbortSignal` sampai ke `fetch`, supaya antrean serial Ollama tidak tersumbat). Diukur setelahnya (end-to-end lewat proxy web): "hai" 40 s → **8 s**, "Pralon atau Rucika?" 12 s → **0 s**, "apa itu PPR?" 60 s → **1 s**; giliran kebutuhan tetap 1 panggilan intent + 1 ekstraksi (±30–70 s di CPU ini — batasnya perangkat, lihat AI_BEHAVIOR §10). Ditambah `LLM_CALL_TIMEOUT_MS` (90 s, pembatalan nyata) setelah satu percobaan ulang ekstraksi nyangkut 524 s di laptop yang kehabisan RAM, dan `isSaneTitle` membuang judul model beraksara campur. Tes heuristik 5, service +3
- [x] P4-25 **Tema gelap bisa diaktifkan** (2026-10-06, laporan pemilik: "dark mode belum ada") — palet gelap sudah ada di token sejak Fase 0 (`[data-theme='dark']`), yang tidak ada hanya pengalihnya di layar konsultasi. `ThemeToggle` (varian `compact`) di footer sidebar dan rail; skrip init inline di `layout.tsx` memasang tema sebelum cat pertama (pilihan tersimpan > preferensi sistem). Penempatan tombol belum didesain — minimal, ditandai di DESIGN_IMPLEMENTATION
- [x] P4-26 **Skema digambar di tab Skema** (2026-10-06, laporan pemilik: "skema denahnya belum ada gambarnya") — prototipe menggambar skema DI DALAM tab layar solusi; sebelumnya tab hanya berisi tautan ke /schematic. `SchematicTab` memuat `GET /recommendations/:id/schematic` dan merender `SchematicView` + panel samping (renderer SVG yang sama dengan halaman penuh); tautan ke halaman penuh tetap ada
- [x] P4-23 **Solusi sebagai layar sendiri** (2026-10-06, dari laporan pemilik: "hasilnya ngga bisa diliat user") — akar: `SolutionView` ditempel di dalam `.stream` (flex column) dan `overflow:auto`-nya membuatnya menciut ke sisa ruang (strip ±90px dengan scrollbar sendiri). Prototipe memang memperlakukannya sebagai `screen: 'solution'` (layar 06): kini aliran chat DIGANTIKAN layar solusi dengan bar tab `tabDefs` prototipe (Ringkasan · Produk Pralon · Skema · Estimasi Material) + Simpan, isi menggulir penuh, composer disembunyikan; `SolutionView` menerima `tab` (tanpa `tab` tetap merender semua). "← Percakapan" di bar tab dan "Lihat solusi" di header adalah tambahan minimal (prototipe merender lanjutan di layar solusi); saran LANJUTKAN PERCAKAPAN mengirim pesan dan kembali ke chat. Tab Skema berisi pengantar + tautan ke /schematic (gambarnya hidup di sana)
- [x] P4-21 **Intent sadar konteks + jawaban rekomendasi bahan + anti-ulang** (2026-10-06, dari laporan pemilik: "lebih bagus PVC atau HDPE buat rumah 2 lantai?" dijawab perbandingan yang sama lagi) — `withRequirementPrecedence` di `IntentRouter`: isyarat kebutuhan di teks (`context/domain/message-signals.ts`) mengalahkan label `PRODUCT_LOOKUP`/`OUT_OF_SCOPE`/ragu → `REQUIREMENT_STATEMENT`; giliran terakhir diteruskan ke klasifikasi model (`IntentInput.recentTurns`, prompt diminta membaca maksud, bukan kata kunci); dev-AI tidak lagi menganggap "lebih bagus" sebagai kompetitor. Pipeline ekstraksi: bila pesan meminta rekomendasi dan menyebut bahan, teks `adviseMaterials` (apa yang menentukan, aturan praktis per bahan, "keduanya bisa dipakai di bagian berbeda", ajakan mengisi data) mendahului kartu klarifikasi — kebutuhan tetap diekstrak (lantai=2), data yang ditanya hanya yang masih kosong. FAQ: `withoutRepeating` — penjelasan yang baru diberikan dipadatkan jadi "Seperti tadi: …" untuk pertanyaan berbeda. Tes router +4, pipeline +2, FAQ +1, pengetahuan +1
- [x] P13-06 Unggah denah — **selesai 2026-10-08** (default OQ-56: disimpan + ikut handoff, tidak dibaca model; migration 0021 `uploads`, modul `uploads`, tombol "Lampirkan denah" aktif; tes kebijakan berkas, service, migration). Catatan asli: (`POST /uploads`, multipart, `UPLOAD_MAX_MB`, allowlist MIME, `uploads_per_day`) — kontrak ada di API_CONTRACTS, modul `uploads/` di SPEC §uploads, belum pernah dijadwalkan di fase mana pun; UI "Lampirkan denah" menunggu ini. Butuh keputusan: penyimpanan (`STORAGE_PATH` sudah ada untuk PDF), pemindaian berkas (SPEC mewajibkan), dan apa yang dilakukan sistem dengan denahnya (belum ada ekstraksi dari gambar)
- [ ] ✋ CHECKPOINT — reviewed by owner

Fase 4: **12/12 selesai.** Context Engine, routing intent, ekstraksi, snapshot, SSE, dan layar 02 hidup. Jalur LLM live menunggu `OPENROUTER_API_KEY` + ID model Pralon (OQ-09/§17b); tanpa itu sistem mengalirkan `LLM_UNAVAILABLE` dan jalur deterministik tetap bekerja. Evaluasi AI (`docs/EVALUATION.md`) dijalankan saat golden dataset + kunci ada.

## Phase 5 — Policy Engine, scope routing, clarification surfaces

Modul `policy` — **wajib leaf** (`docs/ARCHITECTURE.md` §7): tanpa I/O, setiap pemeriksaan fungsi
murni. Itu yang membuat tes "tamu menembus API" murah dan mustahil terlupa. Layar: **03** (klarifikasi),
**04** (data kurang), **08** (kriteria netral), **11** (validasi teknis).

Dua dari tiga tes release blocker lahir di fase ini (`docs/EVALUATION.md`):
pertanyaan kompetitor tidak pernah menghasilkan kartu produk kompetitor, dan aturan
`REQUIRES_DOMAIN_VALIDATION` tidak pernah menghasilkan `VERIFIED`. Yang ketiga (tamu menembus API)
sudah ada sejak Fase 3.

**Terhalang:** **OQ-15** menentukan apakah workspace solusi (layar 06) terjangkau tanpa akun — itu
keputusan pemilik, bukan saya. Tabel `ENTITLEMENTS` saat ini sudah mengikuti **usulan default**
(janji onboarding: tamu dapat tanya-jawab + rekomendasi + klarifikasi; BOM, skema, simpan, laporan
butuh akun). Penegakannya tidak terhalang; yang menunggu adalah panel register-gate (OQ-27) dan
layar 06.

- [x] P5-01 Policy 1 (hanya Pralon) + Policy 5 (scope routing) — fungsi murni; industri menang atas jenis instalasi; >4 lantai → validasi teknis; pembuangan diakui & dicatat
  - [x] P5-01a Tes **release blocker** (11): hasil kebijakan tidak punya field produk untuk diisi; kriteria netral tanpa satu pun nama merek
- [x] P5-02 Policy 3 (batas rekomendasi) — `scopePolicy` memutuskan di luar cakupan, `policyCard` merender kartu `criteria` (layar 08) / `unsupported` + SLA (layar 11) dengan kebutuhan terkumpul dibawa serta
- [x] P5-03 Policy 4 gerbang provenance — satu-satunya jalan nilai jadi `VERIFIED`; `REJECTED` → `UNAVAILABLE`; tidak menaikkan yang sudah rendah
  - [x] P5-03a Tes **release blocker** (7): sapuan seluruh kombinasi status × provenance — `VERIFIED` hanya dari aturan `VALIDATED`
- [x] P5-04 Policy 2 (anti-halusinasi) — `filterToCatalog` (lapisan 3 dari 5, satu-satunya yang tak bisa ditembus prompt karena tak membaca teks); SKU yang dibuang dilaporkan; spesifikasi kosong → `UNAVAILABLE`, tidak pernah `ASSUMED`
- [x] P5-05 Kebijakan masuk pipeline: Policy 1 **sebelum ekstraksi** (kompetitor tak pernah menyentuh jalur rekomendasi), Policy 5 atas state **ter-merge** (scope dari kebutuhan nyata, bukan kata-kata pesan)
  - [x] P5-05a Tes (4 tambahan, total 9 di pipeline): kompetitor → kriteria & nol panggilan ekstraksi; industri/pembuangan → `unsupported` + SLA + kebutuhan terkumpul; air bersih lengkap → tetap CTA
- [x] P5-06 Layar 03 kartu klarifikasi **bernomor** (01…04 — nomornya membuat panjangnya terbaca "ada ujungnya") + jalan pintas "gunakan asumsi standar" saat ≥3 pertanyaan; layar 04 (data kurang) dilayani kartu & meter yang sama
- [x] P5-07 Layar 08 kartu kriteria netral bernomor + layar 11 kartu validasi teknis (judul desain, alasan, kebutuhan terkumpul, catatan SLA 24 jam; tombol handoff dinonaktifkan sampai Fase 9)
- [x] P5-08 `docs/POLICY.md` §12 — pemetaan kebijakan → berkas, titik penegakan di pipeline, status tes release blocker. (`SPEC.md` tidak diedit: ia dokumen pemilik, disalin apa adanya.)
- [ ] ✋ CHECKPOINT — reviewed by owner

Fase 5: **8/8 selesai.** Policy Engine leaf tanpa I/O, dua tes release blocker hijau, empat permukaan kebijakan (03/04/08/11) hidup di layar 02. **OQ-15 masih terbuka** — ia memblokir layar 06 dan panel register-gate, bukan penegakannya. _(OQ-15 dijawab 2026-10-05: default diterima; yang tersisa hanya panel register-gate, OQ-27.)_

## Phase 6 — Engineering Rule Engine

`packages/engineering` — TypeScript murni, **tanpa I/O, tanpa framework, tanpa dependensi runtime**
(dijaga `scripts/check-engineering-isolation.mjs`). Itulah yang membuat SPEC §25 benar secara
struktural: tidak ada apa pun untuk dipanggil.

**Semua 14 aturan lahir `REQUIRES_DOMAIN_VALIDATION`** dan tetap begitu sampai ahli domain Pralon
ditunjuk (**OQ-06**). Konsekuensinya bukan administratif: gerbang provenance (sudah ada, P5-03)
menurunkan setiap keluaran engine menjadi `ASSUMED`, jadi **tidak ada satu pun angka teknik yang
tampil "TERVERIFIKASI" di fase ini** — dan itu memang perilaku yang benar, bukan kekurangan.

- [x] P6-01 Kerangka `RuleVersion` + `RuleRegistry` yang menolak aturan tanpa tes (R-1) dan penulisan ulang versi yang sama; tipe payung `AnyRule` (registry memang heterogen); guard `requireInt`/`requireNumber` menggantikan zod (OQ-42)
- [x] P6-02 Kelompok A — ENG-001/002/003/005/010/013; ENG-002 memakai ambang prototipe baru (`loadUnits >= 8`, OQ-22) dan dicatat sebagai prioritas validasi tertinggi
- [x] P6-03 Kelompok B — ENG-004/008/011; batas 3 lantai prototipe TIDAK dibawa (keterbatasan rendering, bukan aturan teknik — OQ-33)
- [x] P6-04 Kelompok C — ENG-009/006/012; baris "Lem PVC" dari laporan dua halaman **tidak dikarang** (formulanya belum ada — menunggu OQ-06), dan ada tes yang menjaga ketiadaannya
- [x] P6-05 Kelompok D — ENG-007/014 terdaftar sebagai aturan yang menunggu validasi; implementasinya tetap satu di Context Engine, bukan salinan kedua
- [x] P6-06 `explain()` per aturan; tes memastikan **setiap** aturan menghasilkan kalimat (penjelasan dan perhitungan keluar dari sumber yang sama, jadi tak bisa berbeda)
- [x] P6-07 `CalculationTrace` per aturan + gerbang provenance keluar engine; **seluruh keluaran `ASSUMED` hari ini** dan ada tes yang menegaskan tak ada angka teknik `VERIFIED`
- [x] P6-08 Orkestrator `computeSolution` — contoh kerja desain keluar benar (8 titik, 11 unit, jalur 1", BOM 5 baris); ENG-004 hanya berjalan bila tinggi lantai tak diberikan
  - [x] P6-08a Tes (54 total di paket): contoh board, trace, kemurnian, batas masukan, < 300 ms
- [x] P6-09 Back-office alur validasi aturan — cangkang minimal di `/internal/rules`, bertanda menunggu desain, dan menegaskan bahwa seluruh keluaran `ASUMSI` adalah **perilaku yang benar** sampai OQ-06 terjawab (bukan kekurangan yang perlu disembunyikan). Engine sudah siap: `validationStatus`/`validatedBy`/`validatedAt` + `RULE_REGISTRY.awaitingValidation()`.
- [x] P6-10 `docs/ENGINEERING_RULES.md` §8 — pemetaan bagian → berkas, tiga penyimpangan yang disengaja (OQ-22/33 + lem PVC), dan alasan guard murni menggantikan zod (OQ-42)
- [ ] ✋ CHECKPOINT — reviewed by owner

Fase 6: **9/10 selesai.** Satu sisa (P6-09) terhalang desain back-office, bukan kode. Engine hidup, 54 tes, nol dependensi runtime, dan **nol angka teknik `VERIFIED`** — tepat seperti yang seharusnya selagi OQ-06 terbuka.

## Phase 7 — Product Matching dan perakitan rekomendasi

Modul `recommendation` + `product-catalog`. Layar: **06** (workspace solusi) dan **07** (kartu & drawer
produk). Di sinilah hasil engine bertemu katalog nyata dan menjadi sesuatu yang bisa dibaca pengguna.

Yang menentukan fase ini: **invarian REC-1** — prosa LLM tidak boleh memuat angka di luar hasil
hitungan. Diverifikasi pasca-generasi dengan mengekstrak angka dari prosa dan mencocokkannya; tidak
cocok → minta ulang sekali → gagal lagi → templat deterministik. Tanpa pemeriksaan ini, "LLM tidak
menghitung" hanya benar di atas kertas: model tetap bisa menyelipkan "sekitar 12 batang" di kalimat.

Dan **invarian C-2**: kartu produk hanya pernah berasal dari baris `products` — penyaringnya sudah ada
(P5-04), di sini ia dipakai sungguhan.

**Catatan data:** katalog nyata terhalang **OQ-07**. Pencocokan dibangun dan diuji terhadap data seed
lokal (`scripts/seed-sample-catalog.mjs`, jalur impor sungguhan) — bukan fixture dalam memori, supaya
yang diuji adalah query yang benar-benar akan dipakai.

- [x] P7-01 Tipe `Recommendation`, `SystemLine`, `SelectedProduct`, `BomItem`, `Assumption` di shared-types; `traceIds` wajib pada baris sistem dan BOM (invarian T-1 jadi bagian bentuk tipe)
- [x] P7-02 Migration 0008 `recommendations` + `calculation_traces` (append-only, FK cascade); `catalog_version_id` dibekukan tanpa FK (lintas konteks); isi solusi JSON karena selalu dibaca utuh
- [x] P7-03 `ProductMatcher` — fungsi murni yang **hanya bisa memilih dari daftar kandidat**, jadi C-2 struktural; ukuran belum terdaftar tetap menampilkan produknya dengan catatan, bukan menyembunyikannya
  - [x] P7-03a Tes (7): katalog kosong → nol kartu; tiga `matchState`; produk nonaktif tak pernah dipilih; peran fitting tak dipaksakan ke pipa
- [x] P7-04 `SystemLine` dari hasil engine; `reason` dan `provenance` diturunkan dari trace, bukan ditulis ulang
- [x] P7-05 `BomItem` dari ENG-009; `basis` = `explanation` trace (ada tes yang membuktikan prosa LLM berbeda tidak mengubahnya)
- [x] P7-06 Daftar `Assumption` ber-`fieldPath`; asumsi kebutuhan pengguna didahulukan dari asumsi aturan; ENG-004 hanya muncul bila benar-benar berjalan
- [x] P7-07 **Pemeriksa REC-1** — ekstrak angka + label ukuran, cocokkan dengan hasil hitungan; bilangan campuran (`2 1/2`) ditangani khusus agar tak menyusut menjadi `1/2`
  - [x] P7-07a Tes (10): angka asing ditolak, ukuran asing ditolak, 0/1/2 dianggap wajar, pecahan ukuran tak dipecah
- [x] P7-08 Orkestrator `assembleRecommendation` — hitung dulu, baru jelaskan; REC-1 gagal → retry sekali → templat deterministik (yang lulus pemeriksaannya sendiri); LLM mati tidak menggagalkan solusi
  - [x] P7-08a Tes (14): T-1 setiap baris punya trace, REC-1 tiga jalur prosa, provenance ASSUMED, urutan asumsi
- [x] P7-09 Layar 06 workspace solusi + kartu produk layar 07 — ringkasan 5 statistik, tabel Rekomendasi Sistem dengan bar peran, BOM dengan kolom "DASAR PERHITUNGAN" dari trace, daftar asumsi ber-"Perbaiki asumsi ini →", `<ProvenanceTag>` sebagai satu-satunya perender tag
  - [x] P7-09a Endpoint `POST /conversations/:id/analyze` (SSE, empat tahap terakhir) + `GET /recommendations/:id`; kepemilikan diperiksa lewat percakapannya
  - [x] P7-09b Drawer produk penuh (layar 10) — dibangun 2026-10-05 dari prototipe: kartu produk layar 07 kini tombol yang membuka drawer maks 600px berisi kategori, nama, deskripsi, tag "DIPAKAI DI SOLUSI INI · ukuran", ukuran tersedia (ukuran solusi disorot), grid enam spesifikasi, fitting sepadan dari `product_compatibility`, dan baris sumber katalog. `UNAVAILABLE` → "Lihat dokumen teknis" tanpa nilai; nilai dari dokumen membawa "Sumber: … hal. N". Ditambahkan di luar prototipe karena §12: focus trap, Esc, fokus kembali ke kartu. Tamu boleh membuka (rute katalog terbuka, `PRODUCT_QA`); OQ-15 hanya menyangkut layar 06 secara keseluruhan
    - [x] P7-09ba Tes (8): UNAVAILABLE tanpa nilai, sitasi hanya untuk nilai dari dokumen, baris sumber katalog selalu ada, ukuran solusi disorot, fitting dari tabel kompatibilitas, tanpa harga, empat jalur tutup, produk tidak ditemukan
    - [x] P7-09c Daftar dokumen teknis ("Buka dokumen teknis") — 2026-10-05: endpoint `GET /products/:id/documents` ({ items }) dari `findProductDocuments` yang sudah ada, tercatat di API_CONTRACTS; drawer memuatnya paralel dan merender bagian "DOKUMEN TEKNIS" sebagai tautan tab baru dengan halaman, **ditandai MENUNGGU DESAIN** karena prototipe tidak punya bagiannya (PRODUCT_KNOWLEDGE §4 hanya menjanjikan tawarannya). Dokumen ditawarkan, tidak pernah dibaca untuk mengisi spesifikasi kosong. Tes: controller +1, drawer +2 (tautan + halaman; tanpa dokumen bagian tidak dirender). Teks pemuatan/galat drawer tetap menunggu desain
- [x] P7-10 `docs/DOMAIN_MODEL.md` §7a — status implementasi, pemetaan tipe → berkas, dan catatan packaging `@snouty/engineering`
- [x] P7-11 **`ProseWriter` disambungkan ke LLM** — `writeProse` di port `ai` mengembalikan keluaran **mentah** (skema prosa milik pemanggil; REC-1 hanya bisa diperiksa pihak yang tahu angka mana yang sah), `LlmProseWriter` memvalidasi zod `.strict()` lalu melempar supaya perakitan punya **satu** tempat yang memutuskan jalur cadangan, konteks yang dikirim adalah state terstruktur berpembatas "data bukan instruksi" — bukan transkrip, prompt `explanation_prose` tanpa satu pun aturan bisnis, routing `balanced`, dan adapter pengembangan mengembalikan `null` alih-alih mengarang prosa
  - [x] P7-11a Tes (16): skema menolak field asing/body panjang/null, konteks memuat angka terhitung dan penanda data, percobaan ulang menyebut angka yang ditolak, adapter tidak retry sendiri (REC-1 yang mengaturnya), audit biaya tanpa isi prompt
  - [x] P7-11b Verifikasi hidup terhadap stub OpenRouter lokal — tiga jalur REC-1 terbukti end-to-end: prosa patuh dipakai (1 panggilan), angka asing → minta ulang → lolos (2 panggilan), ngotot → **templat deterministik tanpa percobaan ketiga** (2 panggilan). `2 1/2"` dan `18 meter` tidak pernah sampai ke pengguna. Tanpa kunci model: `llm_calls` nol baris dan prosa memakai templat
  - [ ] `[!]` Operasi LLM sungguhan tetap tertahan **OQ-09** (kunci + tiga ID model); yang terverifikasi adalah seluruh jalurnya, bukan model tertentu. Celah audit tercatat sebagai **OQ-44**
  - [x] P7-11c Celah audit OQ-44 ditutup mengikuti usulan default (2026-10-05): migration **0012** menambah `recommendations.prose_source` (`llm` / `llm_retry` / `template`, NULL untuk baris lama), ditulis perakitan lewat `save(…, { proseSource })`. Laju prosa yang ditolak REC-1 kini satu `GROUP BY`; `ai` dan `llm_calls` tidak disentuh. Test migration 52/52 dengan dua pagar baru (ketiga nilai + NULL diterima, nilai lain ditolak database). Diverifikasi live: konsultasi tamu → analisis → baris `recommendations` baru berisi `template` (tanpa kunci model, sesuai harapan)
- [ ] ✋ CHECKPOINT — reviewed by owner

Fase 7: **10/10 selesai.** Rantai lengkap hidup: kebutuhan → engine → katalog → rekomendasi tersimpan → dibaca UI. Diverifikasi live terhadap katalog seed: empat tahap SSE mengalir dengan detail nyata, 4 produk `VERIFIED_SELECTED`, setiap baris punya trace, seluruhnya `ASSUMED`. Sisa: drawer produk penuh (P7-09b) dan akses tamu (OQ-15).

## Phase 8 — Riwayat terdaftar, solusi tersimpan, laporan PDF, antrean handoff

Layar: **11** (validasi teknis — permukaannya sudah ada dari Fase 5), **12** (riwayat), dan laporan dua
halaman. Di sinilah entitlement yang sudah ada mulai benar-benar membedakan tamu dan akun.

Prinsip laporan yang membentuk seluruh item di bawah (`docs/REPORT.md` §1): **laporan dirakit dari data
`Recommendation` yang tersimpan, LLM tidak pernah dipanggil ulang.** Konsekuensinya laporan yang sama
dibuat dua kali identik, dan laporan tahun ini tetap terbaca sama tahun depan meski katalog dan aturan
sudah berubah.

**Terhalang:** pembuatan PDF memakai Chromium di `apps/worker`, dan jalan `worker` memakai kode domain
`apps/api` masih **OQ-40** (juga memblokir P1-06b transport RabbitMQ). Strateginya: seluruh jalur yang
bisa dibangun di `api` dibangun sekarang — tabel `Report`, alokasi nomor, endpoint, dan **halaman cetak
HTML** — sehingga yang tersisa untuk worker hanyalah "buka halaman ini, cetak ke PDF".

- [x] P8-01 Simpan solusi — `POST /conversations/:id/save` digerbang `SAVE_SOLUTION`; status dan tahap bergerak bersama (`SAVED` + `SOLUSI`), dan analisis kini menandai `SOLUTION_READY` supaya riwayat tidak berbohong tentang konsultasi yang sudah selesai
  - [x] P8-01a Tes (3, MySQL nyata); diverifikasi live: tamu ditolak 403 `NOT_ENTITLED`
- [x] P8-02 Riwayat di sidebar layar 02 — digerbang `CONVERSATION_HISTORY`; tamu melihat **ajakan mendaftar**, bukan daftar kosong (daftar kosong terbaca "Anda belum pernah berkonsultasi"); percakapan aktif ditandai garis merek seperti prototipe
- [x] P8-03 Migration 0009 `reports` + `report_number_counters` + `technical_handoffs`; alokasi nomor dalam transaksi dengan `FOR UPDATE` (baris dipastikan ada lebih dulu — `FOR UPDATE` atas baris yang belum ada tidak mengunci apa pun)
  - [x] P8-03a Tes (7, MySQL nyata): empat permintaan serentak mendapat 1–4 tanpa tabrakan; laporan gagal tidak melepas nomornya; `payload` dibekukan
- [x] P8-04 Perakit laporan dari `Recommendation` + `CalculationTrace`, **nol panggilan LLM**; kebutuhan yang belum diisi tidak menjadi baris kosong; harga nonaktif → nilainya nol dan bloknya tidak dirender (bukan Rp 0, yang terbaca "gratis")
  - [x] P8-04a Tes (7): perakitan dua kali identik; DASAR PERHITUNGAN dari trace; PPN dari subtotal BOM
- [x] P8-05 Halaman cetak HTML dua halaman A4 — kop, identitas, ringkasan, tabel sistem, asumsi, material, DASAR PERHITUNGAN, blok "Diperiksa oleh (opsional)", footer disclaimer; seluruh nilai di-escape (nama pelanggan adalah jalur injeksi)
  - [x] P8-05a Tes (9 + 2 palet): dua halaman, disclaimer utuh ×2, harga aktif/nonaktif, escape, palet terikat `tokens.css` agar tak menyimpang
- [x] P8-06 `POST /reports` + `GET /reports/:id` (pratinjau, alur yang dipilih desain §8); rute cetak internal di **controller terpisah** dengan guard peran
  - [x] P8-06a Tes (5) regresi keamanan — lihat catatan di bawah
- [x] P8-07 Antrean handoff teknis — kebutuhan **disalin** ke barisnya (tim teknis melihat apa yang dilihat pengguna saat diserahkan, bukan percakapan yang sudah berubah); asumsi ikut disertakan; tombol layar 11 tersambung
  - [x] P8-07a Tes (6, MySQL nyata): salinan beku, antrean terlama-dulu, CHECK status, cascade
- [x] P8-08 Worker PDF (Playwright + Chromium) — **OQ-40 diterapkan dengan usulan defaultnya**: paket `@snouty/jobs` memuat kontrak, dan worker tidak pernah mengimpor `apps/api` maupun memegang kredensial database. Rantai lengkap: `POST /reports` → antrean → worker ambil HTML dari rute internal → Chromium cetak A4 → `POST /internal/reports/:id/ready`
  - [x] P8-08a Tes (9, browser palsu): nama berkas dari `reportId` (job diulang menimpa, bukan menumpuk), browser selalu ditutup walau cetak gagal, halaman gagal → melempar TANPA menulis berkas rusak
  - [x] P8-08b Diverifikasi live dengan Chromium sungguhan: **PDF dua halaman A4, 251 KB**, dari data tersimpan; `/ready` memindahkan status `PENDING`→`READY`; rute internal menolak tanpa token (401) dan `fileRef` kosong (400)
- [x] P8-09 Register-gate & resume (2026-10-08) — dikerjakan dengan **usulan default OQ-27**; tampilannya **MENUNGGU DESAIN** (OQ-21). Dulu tamu yang menekan "Simpan hasil konsultasi" menerima 403 tanpa apa pun di layar. Kini muncul panel di dalam percakapan (bukan modal), juga di layar solusi: apa yang dibuka akun, "Daftar akun" / "Masuk" / "Nanti saja". Tautannya membawa percakapan dan aksinya (`?resume=…&then=save`, ULID dan aksi divalidasi). Setelah daftar/masuk, server memindahkan percakapan (G-1), lalu web membuka percakapan yang SAMA dan langsung menyimpannya, tanpa mengetik ulang. Pindah daftar ↔ masuk mempertahankan tautannya. Tes web +3 (`resume-link`)
- [x] P8-10 `docs/REPORT.md` §11 — pemetaan bagian → berkas, catatan alokasi nomor, catatan keamanan rute cetak, dan apa yang menunggu OQ-40/OQ-03
- [x] P8-11 **Pratinjau laporan di web** (2026-10-05) — overlay "Buat laporan" dari prototipe (REPORT.md §8): tombol di header begitu solusi ada; banner ESTIMASI dengan kalimat kebijakan utuh, ringkasan, tabel material (kolom harga dan total hanya bila `pricing.enabled`), status PDF dipantau sampai READY, "Unduh PDF" tidak menyala sebelum itu. Formulir identitas (API mewajibkan nama + lokasi untuk kop) dan pesan hak akses dibangun minimal, **MENUNGGU DESAIN**. Bentuk kawat laporan (`ReportPayload`, `ReportPreview`, …) pindah ke `@snouty/shared-types`; API memakainya ulang. Tes web +7. Belum ada: rute unduh (`/reports/:id/download`, tautan bertanda tangan §7) dan `/reports/:id/email` — tombolnya tidak berpura-pura
  - [x] P8-11b Rute unduh `GET /reports/:id/download` — berbasis sesi (pemilik lewat `findForActor`), PENDING → "belum siap", FAILED → `REPORT_GENERATION_FAILED`, `STORAGE_PATH` tidak diset → 503; `fileRef` dari database tetap diperlakukan sebagai masukan: `resolveReportFile` menolak jalur yang keluar dari akar penyimpanan (tes 4). Nama berkas = nomor laporan. Web mengunduh lewat `fetch` + blob karena access token hidup di memori, bukan cookie. `scripts/set-tier.mjs` untuk menaikkan tier akun lokal. Tautan bertanda tangan untuk dibagikan (§7) menyusul bersama rute email
  - [x] P8-11a **Celah kebijakan ditutup**: `POST /reports` ternyata tidak memeriksa `REPORT_PDF` — dibuktikan live, tamu mendapat 201. Kini `requireEntitled(actor.tier, 'REPORT_PDF')` sebelum layanan tersentuh (lapis kedua setelah UI, POLICY §6), 202 sesuai kontrak. Tes +3: tamu dan `registered` ditolak NOT_ENTITLED tanpa menyentuh layanan, `advanced` lolos
- [ ] ✋ CHECKPOINT — reviewed by owner

Fase 8: **8/10 selesai.** Dua sisa terhalang: P8-08 worker PDF (**OQ-40**) dan P8-09 register-gate (**OQ-27/OQ-21**). Halaman cetak sudah final sehingga worker tinggal mencetaknya.

## Phase 9 — Schematic Engine

Layar: **06** (pratinjau skema) dan **09** (skema penuh). `docs/SCHEMATIC_ENGINE.md`.

Prinsipnya tegas: **tidak ada gambar hasil generasi AI yang diperlakukan sebagai kebenaran teknik.**
Skema adalah **topologi terstruktur** yang dibentuk deterministik dari requirement state dan keluaran
engine; renderer membacanya dan **tidak menambahkan informasi apa pun**. Pemisahan itu memberi tiga
hal sekaligus: gambar selalu konsisten dengan tabel sistem dan BOM (sumbernya sama), skenario
"bagaimana kalau" hanyalah perhitungan ulang, dan topologi bisa diuji tanpa merender apa pun.

Invarian **S-1**: setiap tampilan skema membawa "SKEMATIK · BUKAN GAMBAR KERJA" dan catatan skema —
tidak ada mode yang menghilangkannya. Itu bukan disclaimer yang ditempel belakangan, melainkan
pernyataan tepat tentang apa yang sistem memang tahu: ia tidak punya denah, jadi tidak tahu posisi
fisik apa pun.

- [x] P9-01 Tipe `Schematic` di shared-types — elevasi `TrackedValue`, jadi tinggi lantai default membuat seluruh elevasi `ASSUMED`
- [x] P9-02 Pembentukan topologi di `packages/engineering` — tujuh langkah §3, penamaan desain; **tidak disimpan** (dibentuk ulang dari snapshot, sehingga "bagaimana kalau" hanya perhitungan ulang)
  - [x] P9-02a Tes (19): 5 lantai → 5 lantai & 5 riser (OQ-33), jumlah titik air sama dengan `outletCount` engine, tidak ada segmen menggantung, determinisme
- [x] P9-03 Provenance node & segmen mewarisi engine; elevasi dari tinggi default `ASSUMED` ber-`ruleId: ENG-004`, dan blok judul menyebut "· ASUMSI" **di dalam gambar**
- [x] P9-04 Renderer SVG — kisi 24px, kolom lantai 84px, riser 76px, ketebalan 4/3/2 px (ketebalan membawa makna, bukan hanya warna), muka tanah berarsir, `overflow-x` dengan lebar minimum 500px
- [x] P9-05 Panel DAFTAR JALUR + blok judul 2×2 + legenda; blok judul memakai **label** katalog, bukan ULID (ketangkap verifikasi live)
- [x] P9-06 Catatan wajib S-1 dirender tanpa syarat
  - [x] P9-06a Tes (11, lapisan komponen baru): kedua catatan ada untuk 1/2/5 lantai, dan `SchematicView` hanya menerima satu prop sehingga tidak ada mode untuk dimatikan
- [x] P9-07 Aksesibilitas: `role="img"` berlabel + **uraian teks terstruktur per lantai** (bukan `alt` satu kalimat yang memberitahu ada gambar yang tak bisa dilihat)
  - [x] P9-07b Lapisan tes komponen dibuat (jsdom + Testing Library, `fsModuleCache`: 150 s → 0,9 s); utang tes `<ProvenanceTag>` (POLICY §11 #8) dibayar — 7 tes
- [x] P9-08 `docs/SCHEMATIC_ENGINE.md` §10 — pemetaan, alasan skema tidak disimpan, dan catatan lapisan tes komponen
- [ ] ✋ CHECKPOINT — reviewed by owner

Fase 9: **8/8 selesai.** Skema hidup sebagai topologi terstruktur yang dibentuk ulang deterministik — bukan gambar yang disimpan. Lapisan tes komponen akhirnya ada, dan utang tes dari Fase 5/7 ikut terbayar.

## Phase 10 — Riwayat terdaftar, entitlement lanjutan, register-gate, laporan, handoff

**Sebagian besar sudah dikerjakan di Fase 8**, karena item-itemnya memang pasangan alami dari laporan
dan riwayat. Yang tercatat di sini adalah sisanya.

- [x] P10-01 Riwayat terdaftar + solusi tersimpan → dikerjakan sebagai P8-01/P8-02
- [x] P10-02 Entitlement lanjutan → tabel `ENTITLEMENTS` sejak Fase 3, ditegakkan di API sejak P3-11
- [x] P10-03 Antrean handoff teknis → dikerjakan sebagai P8-07
- [x] P10-04 Register-gate & resume → dikerjakan sebagai P8-09
- [x] P10-05 Laporan PDF (worker) → dikerjakan sebagai P8-08
- [x] P10-06 Pengiriman handoff ke tim teknis (2026-10-08) — sesuai jawaban **OQ-08**: email lewat n8n + baris antrean. Penyerahan kasus menerbitkan job `snouty.handoff.deliver` (hanya id); worker mengambil isi email dari `GET /internal/handoff-messages/:id` (token worker), lalu POST ke `N8N_HANDOFF_WEBHOOK_URL` bertanda tangan HMAC (`x-snouty-signature` atas `timestamp.body`, rahasia `N8N_WEBHOOK_SECRET`) dengan `to: TECH_HANDOFF_TARGET`; n8n yang mengirim emailnya. Isi email teks polos: kebutuhan pengguna, asumsi sistem terpisah, lampiran. Antrean mati tidak menggagalkan penyerahan; konfigurasi kosong = job dicatat dan selesai, kasus tetap di antrean. `WorkerTokenMiddleware` pindah ke `shared/http` (dipakai dua modul). Tes: API +6, worker +3. **Aktif setelah pemilik mengisi tiga variabel itu di `.env.production` dan menyiapkan alur n8n**
- [ ] ✋ CHECKPOINT — reviewed by owner

## Phase 11 — Email Intelligence

Aturan yang tidak bisa ditawar (`docs/EMAIL_INTELLIGENCE.md` §1): **AI menganalisis → AI membuat draf
→ manusia meninjau → manusia mengirim.** Tidak ada balasan otomatis, dan manusia di ujung rantai bukan
hambatan — dia bagian dari desain.

**Redaksi adalah intinya.** Ini jalur paparan data pribadi terbesar di seluruh sistem, dan berbeda dari
chat dalam satu hal yang menentukan: **pengirim email tidak pernah menyetujui isinya diproses model
pihak ketiga.** Karena itu redaksi berjalan sebelum teks menyentuh LLM, bukan sesudahnya.

- [x] P11-01 Redaktor — fungsi murni; **berlebihan, bukan presisi** (lebih baik meredaksi nomor yang bukan telepon daripada melewatkan satu yang memang telepon); pembersihan riwayat balasan dan pemisahan tanda tangan jadi satu jalur `prepareForModel`
  - [x] P11-01a Tes (22): tujuh bentuk telepon Indonesia, NPWP berpola, rekening, alamat (termasuk `RT 05 / RW 03`), tiga gaya riwayat balasan, tiga penanda tanda tangan; **dan** bahwa isi teknis + lokasi kota TETAP ada — redaksi yang membuang kebutuhan membuat modulnya tak berguna
- [x] P11-02 Skema ekstraksi zod `.strict()` (§4) + **skor lead deterministik** (§6) — bukan penilaian model, jadi bisa diaudit ("kenapa 65?" punya jawaban) dan disetel tanpa menyentuh prompt; `requestedProducts` disimpan apa adanya, tidak dipaksa jadi SKU
  - [x] P11-02a Tes (21): ambang suhu, setiap bobot, rincian skor berjumlah sama dengan skornya, skema menolak enum asing/properti tak dikenal/register kacau
- [x] P11-03 Verifikasi HMAC webhook — perbandingan waktu-konstan, tanda tangan atas **badan mentah** (bukan JSON yang di-stringify ulang), timestamp ikut ditandatangani, jendela 300 s
  - [x] P11-03a Tes (12): hilang/kedaluwarsa/salah rahasia/badan diubah/panjang beda; **memakai ulang tanda tangan dengan timestamp baru gagal**
- [x] P11-04 Migration 0010 `emails` + `email_analyses` + `market_events`; `message_id` unik (ingest idempoten), badan asli DAN badan bersih disimpan, rincian skor ikut tersimpan
- [x] P11-05 Back-office peninjauan email — cangkang minimal di `/internal/email`; menegaskan aturan yang tidak bisa ditawar (AI menganalisis → manusia mengirim) dan menyebut apa yang menunggu OQ-09/OQ-08
- [x] P11-06 `docs/EMAIL_INTELLIGENCE.md` §11 — pemetaan, alasan `nullable()` di sini berbeda dari chat, dan dua jebakan HMAC yang dihindari

## Phase 12 — Market Intelligence

- [x] P12-01 Event + enam agregat sebagai fungsi murni; **ambang k-anonimitas 5** diterapkan di lapisan agregasi (bukan di dashboard — agregat tersimpan tanpa ambang berarti datanya sudah bocor sebelum ada yang melihat), dan yang ditahan **dilaporkan** agar pembaca tidak menyimpulkan permintaan nol
  - [x] P12-01a Tes (15): ambang menahan 4 & menerbitkan 5, kota kecil ditahan sementara kota besar terbit, sinyal cakupan sengaja tidak diambang (rasio tak bisa menunjuk orang)
- [x] P12-02 Lokasi tingkat kota — ditegakkan **struktural**: `occurred_on` bertipe `DATE` (pembulatan ke hari oleh tipe kolom, bukan kedisiplinan), bentuk `MarketEvent` tidak punya field untuk pengenal/teks bebas, dan **pagar lint baru** melarang `recommendation`/`engineering`/`context` mengimpor `market-intelligence`
  - [x] P12-02a Pagar dibuktikan menolak impor terlarang; tes memeriksa tidak ada field terlarang di bentuk event
- [x] P12-03 Dashboard pasar — cangkang minimal di `/internal/market`; agregasi dan ambang k-anonimitas sudah ada di belakangnya
- [x] P12-04 `docs/MARKET_INTELLIGENCE.md` §9 — tiga penegakan struktural dan alasan ambang hidup di lapisan agregasi

## Phase 13 — Audit keamanan, performa, aksesibilitas, evaluasi

- [x] P13-01 Audit keamanan terhadap checklist — **satu temuan nyata ditutup: rate limiting belum ada sama sekali.** Kini penghitung Redis (lintas instans), batas pesan per tier, dan batas **per IP** di `register`/`login`/`refresh`. Diverifikasi live: percobaan ke-11 → `429` + `retryAfterSec: 900`
  - [x] P13-01a Tes (10, Redis nyata): kuota per subjek & per dimensi, jendela tidak diperpanjang terus-menerus, **Redis mati tidak menolak permintaan** (menolak semua orang saat cache mati mengubah gangguan menjadi pemadaman)
  - [x] P13-01b Hasil audit dicatat di `docs/SECURITY.md` §12, termasuk dua hal yang tampak temuan tetapi ternyata benar
- [x] P13-02 Audit aksesibilitas — **dua temuan**: (1) cincin fokus tidak terpasang di `solution` & `schematic` → ditutup dengan token yang sudah ada; (2) `--snouty-caption` gagal AA (3,17:1) pada ukuran pakainya 10–12px → dicatat OQ-43, tidak diubah sendiri karena token adalah sumber kebenaran visual; **ditutup 2026-10-05** setelah pemilik menerima default — token kini `#6B7376`, lulus AA di `surface` dan `canvas`
  - [x] P13-02a Hasil dicatat di `docs/DESIGN_IMPLEMENTATION.md` §12; amber yang paling dikhawatirkan ternyata lulus (5,76–6,33:1)
- [x] P13-03 Pipeline CI — sudah ada sejak Fase 0 dan masih akurat: pagar arsitektur (isolasi engine, host DB, pindai secret), format/lint/typecheck, tes dengan MySQL+Redis sekali pakai, tes migration, build. Tes web ikut otomatis lewat `pnpm -r test`
- [x] P13-04 Evaluasi AI — harness + golden dataset awal (2026-10-06). `apps/api/evals/cases.json` (18 kasus: 14 dari EVALUATION §2 + 4 dari laporan pemilik: sapaan, FAQ PVC/HDPE, rekomendasi bahan rumah 2 lantai, kos 3 lantai) dan `scripts/eval.mjs` (`pnpm eval`, `--tag`, `--compare`, `--no-cache`): adapter + pipa produksi dari `dist/`, metrik §3 per field dengan ambang yang ditegakkan (halusinasi 0%, kebijakan 100%), cache respons per hash, hasil JSON tersimpan, job CI `evals` nyata tetapi dinyalakan pemilik (`EVAL_ENABLED` + secret) karena Ollama lokal tak terjangkau dari GitHub. Hasil pertama terhadap qwen2.5:7b lokal dicatat di `docs/EVALUATION.md` §4. Yang masih terbuka: model yang terjangkau CI (**OQ-09**) dan perluasan dataset oleh pemilik
- [x] P13-05 Kesesuaian motion dengan prototipe (2026-10-05, dari laporan pemilik "animasi belum sesuai Claude Design") — audit seluruh `@keyframes`/`animation`/`transition`/timer prototipe vs `apps/web`: (1) `snoutyIn` .25s di setiap giliran, kartu analisis, toast; titik berpikir `snoutyPulse`; bar progres bergaris `snFlow` + lebar .5s dengan judul "Menyusun solusi Anda / Solusi siap! / Gagal"; jeda 1500 ms "Solusi siap!" sebelum solusi; toast "Solusi tersimpan" 2800 ms; onboarding `snoutyIn` 6px (bukan 8px); slide-in drawer yang tidak ada di prototipe dibuang; timer latensi palsu 620/750 ms sengaja tidak disalin. (2) **Mascot animasi penuh** diport dari prototipe — 13 mood, 42 keyframe — menggantikan PNG statis di semua tempat; `moodFor(state)` murni dengan tes dua aturan lembar mascot. `prefers-reduced-motion` tetap dihormati. Tes web 59 (+10)
- [ ] ✋ CHECKPOINT akhir — reviewed by owner

## Phase 14 — Asisten Teknik Perpipaan Umum

Brief pemilik 2026-10-06 (§1–45); penilaian dan rencana 7 fase di
`docs/ENGINEERING_ASSISTANT_ASSESSMENT.md`. Prinsip: solusi dulu, produk kemudian; tidak ada angka
tanpa asal; kesiapan per keluaran; LLM tidak pernah menghitung.

- [x] P14-01 Fase 1 — State & registry (2026-10-06). `packages/engineering/src/parameters/`:
      `ParameterRegistry` (±60 kunci universal, satuan, importance, pertanyaan bahasa pengguna),
      `EngineeringAssumptionRegistry` (15 asumsi ber-ID + rujukan + keyakinan; ENG-101/104/105 dan
      `computeIrrigation` membaca nilainya dari sini, bukan konstanta lokal), grafik ketergantungan
      transitif (`missingInputsFor`), `ReadinessResolver` per keluaran (ready/partial/missing_data).
      API: `engineeringStateFrom(RequirementState)` — proyeksi murni jalur bangunan + irigasi ke
      parameter universal (known/assumed), asumsi yang dipakai, laporan kesiapan; kartu asumsi irigasi
      kini membawa `assumptionId`. Tes engineering 93 (+7), API rekomendasi/context 173 (+4).
      Docs: CONTEXT_ENGINE §11, ENGINEERING_RULES §3
- [x] P14-02 Fase 2 — Kasus & ekstraksi (2026-10-06). `packages/engineering/src/cases/`:
      `CaseProfileRegistry` (9 profil: rumah, gedung bertingkat, cluster, irigasi, transfer pompa,
      gravitasi/drainase, air hujan, gorong-gorong, sumur — parameter kritis/penting/opsional,
      keluaran, kalkulasi, `calculatorStatus`), `TechnicalCaseClassifier` (isyarat berbobot,
      primer + sekunder + keyakinan; model tidak dipanggil), `TechnicalContextExtractor` (fakta
      tersurat → parameter universal dengan konversi satuan: l/s, m³/jam, km, m², mm/jam, %, bar,
      tinggi statis bertanda dari subjek kalimat), `MissingParameterResolver` (≤ 4 pertanyaan
      registry, kritis dulu, menyebut keluaran yang dibuka). API: jalur **kasus teknis umum** di
      pipeline (`context/domain/technical.ts`, `RequirementState.useCase.kind = 'technical'`,
      parameter universal known/assumed), lanjutan percakapan teknis tanpa model, jawaban kartu
      berpilihan + angka lewat kalimat, muara validasi teknis terstruktur sampai kalkulator kasusnya
      ada (fase 3–4). Web: panel kanan `use-case-rows.ts` (irigasi + teknis). Tes engineering 109
      (+16), API 748 (+8), web 88. Docs: ARCHITECTURE §7 (`context → packages/engineering` murni),
      CONTEXT_ENGINE §11
- [~] P14-03 Fase 3 — Kalkulator hidraulik bertekanan (2026-10-06, **engine selesai, integrasi API
  belum**). `packages/engineering`: `units.ts` (l/s ↔ m³/jam ↔ l/menit, bar ↔ m, inci ↔ mm, label
  inci), Kelompok F ENG-201 kecepatan (A = πD²/4, V = Q/A), ENG-202 Hazen-Williams, ENG-203
  kerugian minor (fraksi), ENG-204 TDH (+ tekanan sisa), ENG-205 sizing multi-kriteria dengan
  kandidat berstatus (ok/terlalu cepat/rugi tinggi/terlalu lambat) + rekomendasi + alternatif,
  ENG-206 titik kerja pompa (Q/H, daya hidraulik, daya poros indikatif — tanpa merek/kurva);
  `computePressurized()` orkestrator dengan trace per aturan dan `appliedAssumptionIds`; 5 asumsi
  registry baru (VELOCITY_MAX/MIN, HEADLOSS_GRADIENT_MAX, PUMP_EFFICIENCY_INDICATIVE,
  TRANSFER_DISCHARGE_MARGIN). Docs ENGINEERING_RULES Kelompok F. **Selesai (2026-10-06)**:
  `runPressurized` di analysis service untuk `pump_transfer` dan `well_distribution` (sumur: tinggi
  statis = kedalaman + tinggi tandon), `pressurized-view.ts` (highlights: pipa utama, kecepatan,
  kerugian gesek, head total, titik kerja pompa; baris sistem utama + pompa + **alternatif satu
  ukuran di atas**; BOM; asumsi ber-ID; prosa REC-1), keluarga dari bahan yang disebut atau dari
  panjang jalur (HDPE ≥ 200 m, asumsi ber-ID). Peran fitting kini dicocokkan lewat `category` memuat
  "FITTING" di keluarga pipa yang sama (OQ-48) — sebelumnya tidak pernah terisi. Sisa untuk fase 6:
  tampilan kandidat/opsi sebagai pilihan di layar solusi
- [x] P14-03b Kasus kolam/tambak end-to-end (2026-10-06, laporan pemilik "tambak lele 4 x 4 meter,
      produknya apa aja" → masih kartu "di luar cakupan"). Kelompok G ENG-301 volume, ENG-302 debit
      pengisian, ENG-303 pipa kuras gravitasi, ENG-304 BOM + `computePond()` (pipa masuk lewat
      ENG-102); profil kasus `fish_pond` (kalkulator tersedia), klasifikasi (tambak/lele/kolam/…),
      ekstraksi "4 x 4 meter" → panjang × lebar (bukan panjang jalur), kedalaman cm/m, jumlah kolam,
      jam pengisian; 5 asumsi registry (tinggi air 1 m, isi 3 jam, kuras 1 jam, v kuras 1 m/s, jalur
      10 m). API: migration 0015 (`kind` 'technical' + `highlights`), `runPond` di analysis service
      (produk per peran: masuk PVC AW, kuras PVC D, fitting), `pond-view.ts`, skema → NOT_FOUND
      untuk kind selain bangunan; `tambak`/`kolam` dicabut dari kebijakan di luar cakupan dan
      kebijakan itu kini diperiksa SEBELUM klasifikasi kasus ("air panas boiler hotel" tetap
      validasi teknis). Web: statistik `highlights` di ringkasan solusi. **Redaksi balasan jalur
      teknis dirombak jadi prosa teknisi** (aturan pemilik: tanpa metatext — tidak ada judul bagian
      "Data yang diketahui", "Jawab langsung di sini", dsb.). Registry 29 aturan; tes engineering
      129, API 749, web 88; migration test 59/59
- [x] P14-04 Fase 4 — Gravitasi, air hujan, gorong-gorong, cluster (2026-10-06). Kelompok H ENG-401
      Manning, ENG-402 sizing gravitasi dengan kandidat berstatus atas tabel ½"–16", ENG-403 metode
      rasional (intensitas hujan wajib, tidak pernah dikarang), ENG-404 penanda struktural
      gorong-gorong, ENG-405 kebutuhan puncak; `computeGravity` + `computeNetwork`; 7 asumsi registry
      (Manning n, rasio isi 80 %, kemiringan min 0,5 %, timbunan 0,6 m, 150 l/orang/hari, 4
      orang/unit, faktor puncak 2). API: `runGravity` (PVC D + fitting) dan `runNetwork` (puncak →
      Kelompok F) di analysis service, `gravity-view.ts`; profil drainase/air hujan/gorong-
      gorong/cluster kini "kalkulator tersedia" dan parameter yang punya asumsi (kemiringan, C,
      sumber) turun dari kritis ke penting; ekstraktor membaca timbunan. Registry 34 aturan. **Belum**:
      zonasi gedung bertingkat (profil `multistorey_building_water` tetap validasi teknis)
- [~] P14-05 Fase 5 — Matcher produk dari kebutuhan teknis (2026-10-06, sebagian). Peran per kasus
  sudah dinyatakan sebagai `{ role, size, family, categoryIncludes? }` dari hasil engine (pipa
  utama/kuras/alternatif + fitting lewat kategori, OQ-48); keluarga dipilih dari bahan yang
  disebut atau panjang jalur. **Belum**: kelas tekanan (AW/D/PN) sebagai kriteria pencocokan —
  menunggu field tekanan kerja di master data Pralon (`docs/PRODUCT_MASTER_DATA.md` §3); golden
  dataset kini memuat 7 kasus teknis deterministik (`expected.technical`, metrik
  `technicalMatch` wajib 100 %)
- [x] P14-08a Katalog Pralon asli — Tahap A: adapter CSV + impor inci (2026-10-06).
      `CsvCatalogImportAdapter` (RFC 4180, UTF-8/BOM, CRLF, `""`, baris baru dalam sel; nilai jamak
      dibiarkan untuk validator), 8 tes; validator memeriksa batas panjang kolom sesuai skema (SKU 64,
      nama 160, family 80, category 120, source_document 255, image_url 512); CLI
      `apps/api/scripts/import-catalog-file.mjs` (`--dry-run`, `--label`, `--source-document`,
      `--issues-out`, gabung beberapa berkas, tolak host bersama, tidak pernah promosi). Dry-run
      `snouty_catalog_import_inch.csv`: **2.644 diterima, 0 ditolak, 0 issues**; diimpor ke MySQL lokal
      sebagai versi draft `erp-2026-10-06` (kind pralon): 2.644 produk, 3.313 ukuran, 2.631 spec
      VERIFIED. Katalog sample tetap aktif
- [x] P14-08b Tahap B: `PipeSize` bersatuan (2026-10-06). `(unit, valueX1000, label)`; `110 mm`,
      `12,5 mm` → mm; tanpa satuan tetap inci; tanpa konversi; banding/urut hanya satuan sama; pecahan
      ambigu `11/2` ditolak; `parsePipeSize/comparePipeSize/samePipeSize`; tes lama lulus tanpa diubah
      (+12 tes mm)
- [x] P14-08c Tahap C: migration 0016 + validator + impor mm (2026-10-06). `product_sizes`:
      `size_unit` + `size_value_x1000`, PK (produk, satuan, nilai), CHECK satuan & rentang, indeks;
      migrasi turun **gagal dengan SIGNAL** bila ada baris mm (diuji naik → turun(gagal) → turun → naik,
      63/63). Validator: mm diterima, pesan "di luar rentang (1–3000 mm)" dan "pecahan ambigu … tulis
      1 1/2", **peringatan** satuan campuran (`warnings` di hasil validasi). Writer/repository memakai
      satuan; matcher/engine tidak disentuh. Sample di-seed ulang setelah migrasi: 21 baris ukuran
      **identik** (sku, label, nilai). Dry-run gabungan inci + mm: **7.680 diterima, 9 ditolak** — 8 SKU
      73 karakter (HDPE PN-10/Telkom, 1 faucet socket) + 1 ukuran "3150 mm" di luar rentang (baris 4958
      berkas mm). Impor gabungan **ditunda** menunggu keputusan pemilik atas baris ke-9 (lihat laporan)
- [x] P14-08d Tahap D: usulan matcher v2 (2026-10-06, dokumen saja) — `docs/MATCHER_V2_PROPOSAL.md`:
      kandidat ganda (rata-rata 11,1 SKU per keluarga+ukuran pipa, maks. 21) → himpun + pilih
      deterministik ber-trace (panjang batang → ujung sesuai aturan → varian baku → SKU); fitting
      lintas seri (627 D, 618 W, 675 tanpa token) → saring `pressure_class`, token W tidak ditebak;
      HDPE mm → tabel aturan ENG-102/104/105/201/202/205 + data OD/tebal. Uji nyata 10 skenario,
      sample vs Pralon (draft inci dipromosikan sementara, lalu sample baru dipromosikan kembali):
      **temuan utama — analisis hanya melihat 50 produk pertama versi aktif** (`listProducts({limit:50})`),
      di katalog Pralon jendela itu 45 fitting + 5 PVC D tanpa satu pun PVC AW → semua peran "tidak
      ada". Perbaikan paling murah dan mendesak: kandidat per peran dari repository (family + ukuran
      bersatuan)
- [x] P14-08e Batas mm 4000 + impor gabungan (2026-10-06, keputusan pemilik). Migration 0017
      (CHECK rentang mm 4000; turun gagal sendiri bila ada baris > 3000 mm). Impor inci + mm tanpa 8
      SKU 73 karakter (dicatat di `data/catalog/2026-10-06-erp/excluded-2026-10-06-mm.json`): **7.681
      diterima, 0 issues** → draft `erp-2026-10-06-mm`
- [x] P14-08f Engine memilih ukuran HDPE dalam mm (2026-10-06). `parameters/size-tables.ts`:
      `PVC_INCH_SIZES` + `HDPE_MM_SIZES` (OD ISO 4427 20–400 mm, diameter dalam dari SDR 17 — asumsi
      ber-ID `HDPE_SDR17_PN10`); ENG-102/ENG-205 v2 menerima `sizeTable`; `computePressurized`
      memilih tabel dari bahan; `computeIrrigation` menentukan bahan dulu lalu ukuran utama (HDPE mm)
      dan ukuran distribusi PVC AW (inci) terpisah (ENG-105 v2 `distributionSize`)
- [x] P14-08g Matcher v2 (2026-10-06). Kandidat **per peran dari repository** (`candidatesFor`:
      keluarga + ukuran bersatuan + aktif) menggantikan jendela 50 produk; keluarga fitting Pralon
      (`FITTING PVC`/`FITTING HDPE`) dicari dulu, fallback keluarga pipa + kategori FITTING;
      `pressure_class`: VERIFIED sama → VERIFIED_SELECTED, UNAVAILABLE (seri "W", tidak ditebak) →
      SIZE_NEEDS_VALIDATION, VERIFIED berbeda → peran kosong; kandidat ganda dipilih deterministik
      (batang 4 m → varian baku → SKU) dengan alasan dan ≤ 10 `alternatives`. OQ-48 direvisi. API 774
      tes
- [x] P14-08h Fallback kandidat keluarga-saja (2026-10-06): bila ukuran tidak ada di katalog,
      `matchRoles` tetap menampilkan produk keluarga itu sebagai SIZE_NEEDS_VALIDATION. Hasil matcher
      v2 pada katalog Pralon penuh (7.681 SKU): 33 peran → 27 VERIFIED, 6 SIZE_NEEDS_VALIDATION
      (fitting seri W). `docs/MATCHER_V2_PROPOSAL.md` §4b
- [x] P14-09 Deploy produksi ke 192.168.1.10 / ai.pralon.co.id (2026-10-06). Paket deploy
      (`Dockerfile`, `deploy/docker-compose.prod.yml`, `deploy/deploy.sh`, nginx compose profil
      `edge` yang juga melayani bagspace.pralon.co.id), runbook `docs/DEPLOYMENT.md`. Di server:
      migration 0000–0017, katalog `erp-2026-10-06` (7.681 SKU, 8 SKU panjang dibuang) aktif,
      cut-over 80/443 dari nginx proyek lama; https://ai.pralon.co.id live. Catatan: `up
--remove-orphans` sempat menghapus kontainer proyek lama (image + volume `snouty_db_data`
      tetap ada; flag dicabut). Token worker → OQ-49
- [x] P14-09b Token layanan worker (2026-10-06, OQ-49 disetujui pemilik): `WorkerTokenMiddleware`
      hanya pada `InternalReportController`, perbandingan waktu-tetap `WORKER_INTERNAL_TOKEN`
      (env API opsional ≥ 32 karakter), aktor `worker`/`admin` tercatat di audit; 6 tes. Kontainer
      proyek lama dibangkitkan lagi dalam keadaan stop sebagai proyek compose `snouty-old`
      (volume `snouty_db_data`, restart `no`) untuk rollback
- [x] P14-09c Perbaikan pasca-live (2026-10-06 malam): nginx `location /api/v1/conversations/`
      membuat `POST /conversations` dijawab 301 → browser mengulang sebagai GET riwayat → 403 untuk
      tamu dan percakapan tak pernah dibuat (gejala "tamu kena 403", `POST …/undefined/messages`
      400); prefix diganti `^~ /api/v1/conversations`. Badge "KATALOG PRALON · label" di header
      sambutan dihapus (keputusan pemilik: label impor bukan teks pengguna). Keputusan pemilik:
      aturan tamu **tetap** — konsultasi penuh tanpa riwayat tersimpan; riwayat/simpan butuh akun
- [x] P14-09d Model bahasa produksi (2026-10-06 malam). Akun OpenRouter proyek lama: kredit 0,
      batas kunci 0, slug `:free` dihapus — semua panggilan gagal ("Pemahaman bahasa sedang tidak
      tersedia"). Keputusan pemilik: **Ollama di server** (service compose profil `ollama`,
      `qwen2.5:7b-instruct`, timeout 30 s/180 s). Keluaran 7B menulis `null` untuk field yang tidak
      disebut → dua kali gagal validasi → tahap pemahaman gugur; `withoutNulls` di batas AI
      menyamakan `null` dengan "tidak disebut" (skema tetap strict), 2 tes. `deploy.sh up` me-restart
      nginx edge (IP kontainer api berubah → 502)
- [x] P14-09e Pesan pembuka (2026-10-06 malam): "mau nanya2 dong" / "boleh tanya?" diberi label
      REQUIREMENT_STATEMENT oleh model 7B (tidak deterministik) → ekstraksi kosong → formulir
      klarifikasi 4 pertanyaan. Aturan di kode (`runUnderstanding`): pernyataan kebutuhan pertama
      dengan ekstraksi kosong dijawab sebagai ajakan bertanya (`OPENER_REPLY`, lewat ReplyWriter
      bila ada model), tanpa kartu dan tanpa menyentuh state; jawaban klarifikasi/mutasi kosong
      tetap jalur biasa. 2 tes; API 784 tes
- [x] P14-09f Pagar angka dan jenis bangunan (2026-10-06 malam). Dari "mau tanya soal pipa" model 7B
      menulis rumah 2 lantai, 3 kamar mandi, 2 wastafel, 1 dapur (menyalin contoh di prompt) dan
      semuanya masuk state **VERIFIED**. `extractionToUpdates`: jumlah (lantai, kamar mandi,
      wastafel, dapur, titik) hanya dipercaya bila angkanya — digit/kata bilangan/awalan "se-" —
      berdekatan dengan kata bendanya; `0` hanya dengan peniadaan; jenis bangunan hanya bila kata
      bendanya ada; angka model yang tidak tersurat jatuh ke angka dari teks. Contoh berangka
      dihapus dari prompt ekstraksi. 3 tes; API 787 tes
- [x] P14-06 Fase 6 — ResponseComposer (2026-10-07). `composeResponse()` (fungsi murni,
      `recommendation/domain/response-composer.ts`): data diketahui vs parameter diasumsikan dari
      state, perhitungan dari trace (aturan + versi + penjelasan), **opsi** = seluruh kandidat engine
      (F: kecepatan/gesek/head; H: kapasitas/pemakaian) dengan status, penanda
      rekomendasi/alternatif, catatan tradeoff dari kode; **kesiapan** per keluaran profil kasus
      (`caseReadiness`, label `OUTPUT_LABELS`); data yang masih dibutuhkan = pertanyaan registry.
      Ringkasan/Asumsi/Produk tetap di field lama. Dipasang di keempat jalur teknis; disimpan di
      kolom `recommendations.composition` (migration 0018). Web: kartu "Opsi ukuran" + "Kesiapan
      hasil" di tab Ringkasan, "Data diketahui / Parameter diasumsikan / Perhitungan / Data yang
      masih dibutuhkan" di tab Material — **belum didesain (OQ-50)**, token yang ada. 7 tes
      komposer, migration test 64, API 794, web 88
- [x] P14-07 Fase 7 — Latensi (2026-10-07). **Streaming per event:** `streamedEvents(emit)`
      (`shared/sse/event-stream.ts`) — setiap `events.push` di pipeline pesan dan keempat jalur
      analisis langsung ke controller; `sseWriter` menulis header SSE pada event pertama, sehingga
      galat sebelum itu tetap JSON berstatus benar dan sesudahnya menjadi event `error`.
      **Instrumentasi tahap:** `stageTimer` — log terstruktur per giliran `{load, route, answer,
persist, total}` + intent. **Ekstraksi gabungan satu panggilan: dievaluasi dan DITOLAK** untuk
      qwen2.5 7B di CPU — prompt gabungan ±30 s saat cache prompt dingin, pesan di luar topik yang
      kini 4 s menjadi 18–30 s; keuntungan giliran kebutuhan hanya ±4 s (22 → 18 s). Judul sudah di
      latar sejak P4; registry/profil konstanta in-memory (tanpa cache tambahan). 4 tes baru.
      **Jalur cepat tanpa model** (`fastPathIntent`): pesan pertama berisyarat kebutuhan (bukan
      "kenapa", bukan pesaing) → REQUIREMENT_STATEMENT tanpa klasifikasi model (4–6 s per giliran)
- [x] P14-09g Temuan 12 skenario produksi (2026-10-07, 7B/Ollama): (1) "toren di atap" ditulis
      model `ground_tank` → letak toren tersurat mengalahkan model (`OBVIOUS.source`); (2) "tidak ada
      dapur" dilewatkan model → 0 dari peniadaan tersurat; (3) permintaan penjelasan ditulis ulang
      model menjadi alasan karangan → EXPLANATION_REQUEST memakai teks tetap, tanpa model. Web:
      jawaban asisten diungkap bertahap per kata (`useRevealedText`, giliran baru saja), kartu masuk
      setelah teks selesai, reduced-motion = utuh seketika (permintaan pemilik). Keputusan pemilik
      2026-10-07: **tetap Ollama 7B** (biaya nol); kualitas/latensi setara ChatGPT/Claude tidak
      tercapai dengan itu — dicatat jujur di laporan checkpoint. Bilingual ID/EN penuh disetujui →
      P15
- [ ] ✋ CHECKPOINT — reviewed by owner (12 skenario uji §39 + laporan akhir §45) — laporan siap:
      `docs/PHASE14_CHECKPOINT.md` (2026-10-07), menunggu tinjauan pemilik

## Phase 15 — Bilingual (ID + EN penuh)

Keputusan pemilik 2026-10-07: antarmuka DAN jawaban asisten dalam Bahasa Indonesia dan Inggris.
Bahasa adalah atribut percakapan (ditetapkan saat dibuat); pengalih bahasa berlaku untuk percakapan
berikutnya. Prinsip tetap: teks deterministik hidup di kode per bahasa, bukan diterjemahkan model.

- [x] P15-01 Infrastruktur bahasa (2026-10-07). `Locale` (`id`|`en`) di shared-types;
      `conversations.language` (migration 0019, CHECK) ditetapkan dari body `{language}` atau
      `Accept-Language`; `ConversationSummary.language`. Prompt per bahasa untuk keluaran model
      (balasan, FAQ produk, judul, prosa solusi) lewat `…SystemPrompt(locale)`; `ReplyWriter`
      memilih prompt dan menegaskan bahasa di konteks; `titleFor(…, locale)`; bahasa mengalir dari
      `MessageService`/`AnalysisService` ke pipeline, FAQ, dan prosa. Web: `LocaleProvider` +
      `LocaleToggle` (localStorage, `<html lang>`), bahasa dikirim saat percakapan dibuat. Tes: locale
      5, repository 1, reply-writer 1. **Belum:** teks UI EN (P15-02), templat deterministik API EN
      (P15-03), registry parameter/asumsi EN (P15-04), laporan PDF EN (P15-05)
- [x] P15-01b Drawer sidebar di layar sempit (2026-10-07, laporan pemilik "kok bentukannya ngga
      sidebar kaya ChatGPT/Claude di mobile"): sidebar yang sama dirender sebagai drawer dari kiri
      (backdrop, ×, Escape, menutup saat memilih riwayat/percakapan baru), tombol ☰ di ponsel;
      dropdown "Riwayat" dihapus. OQ-51 (needs design)
- [x] P15-02 Teks UI dua bahasa (2026-10-07). Sembilan objek copy web (chat, solusi, onboarding,
      laporan, produk, auth, skema + catatan wajib, back-office) punya kembaran `*_EN` bertipe
      `CopyShape` (kunci sama dipaksa typecheck + tes runtime); selector `xCopy(locale)` dan hook
      `useXCopy()` per modul; fungsi berbahasa (`stageLabel`, `sourceLine`, `specSourceLine`,
      `completenessNote`, teks galat auth) menerima locale/copy. Kalimat kebijakan diterjemahkan
      setia dan dikunci tes. Nilai protokol (id tab, "Belum tahu" ke API) tetap. 12 tes baru
- [x] P15-02b Giliran kosong di ponsel (2026-10-07, audit tampilan mobile): model 7B mengisi angka
      yang tidak disebut dengan `0` (`floorHeightM: 0` < batas 2) → ekstraksi ditolak dua kali →
      tahap gagal, `missingInformation` state awal kosong → **tanpa kartu, tanpa teks**. Tiga pagar:
      (1) field yang gagal validasi dipangkas lalu divalidasi ulang tanpa panggilan model;
      (2) model gagal → fakta tersurat dari teks tetap dipakai, kartu klarifikasi dihitung dari
      state yang sudah dilengkapi; (3) web menampilkan `emptyReply` bila giliran berakhir kosong.
      3 tes
- [x] P15-02c Audit tampilan ponsel (2026-10-07, "web ini buat branding"): header ponsel cuma + ☰ judul "Kebutuhan (n)" (tema & bahasa pindah ke drawer; judul tidak lagi terpotong/bertumpuk),
      tab layar solusi di baris sendiri dan bisa digulir (sebelumnya hanya "Ringkasan" terlihat),
      baris "Rekomendasi Sistem" bertumpuk rapi dengan garis peran di kiri. Alur penuh (klarifikasi →
      susun rekomendasi → solusi → lembar kebutuhan), gelap, dan EN dicek lewat tangkapan layar 390 px
- [x] P15-02d Tindak lanjut pemilik (2026-10-07): tombol "+" dihapus dari header sempit (sudah ada
      "+ Konsultasi Baru" di drawer); tab Skema tidak lagi meminta skema untuk solusi
      teknis/irigasi (sebelumnya 404 di konsol). `POST /reports` 403 untuk tamu memang kebijakan —
      UI menampilkan ajakan mendaftar
- [x] P15-03a Pemahaman Inggris + inti percakapan dua bahasa (2026-10-07). Pola kode diperluas
      dengan sinonim Inggris: isyarat kebutuhan/nasihat/pesaing/ragam produk, intent pasti (sapaan,
      konsep produk, irigasi, kasus teknis), jalur cepat, penanda grounding, fakta dari teks
      (lantai/kamar mandi/jenis instalasi/jenis bangunan/letak toren), kata bilangan one–twelve,
      kata benda hitungan, peniadaan, "a bathroom" = 1, tanda hubung ("2-storey"), kebijakan cakupan
      (hot water, process water, suhu). Templat: balasan tetap + pembuka EN; pertanyaan klarifikasi
      EN dengan `optionLabels` (nilai pilihan tetap protokol Indonesia), ringkasan jawaban EN,
      "Belum tahu" tampil "Not sure". 6 tes. Sekalian: estimasi material di ponsel jadi daftar
      (permintaan pemilik), favicon dari maskot (404 di konsol), tamu membuka laporan langsung ke
      ajakan mendaftar tanpa POST 403
- [x] P15-03b Templat deterministik API dua bahasa (2026-10-07): pipe-knowledge (pengetahuan
      bahan/konsep `en`, pembanding, nasihat), product-answer-text (`productAnswerCopy`,
      `aspectLabel`, teks ikhtisar/jawaban), kebijakan (scope: alasan semua outcome +
      `neutralCriteria`; entitlements: `capabilityLabel`, `onboardingTagLabel`,
      `onboardingBenefits`; policy-cards), panduan teknis & irigasi, templat irigasi
      (`optionLabels`, label tangkapan), kartu asumsi, label field/nilai. Konvensi: parameter akhir
      `locale = 'id'`, teks Indonesia tak berubah, nilai pilihan/tag tetap protokol Indonesia.
      Locale disambungkan dari percakapan ke pipeline, pertanyaan produk, dan kartu asumsi analisis.
      22 tes baru; API 839. Diverifikasi di produksi (EN): perbandingan PVC/HDPE, kartu kriteria
      pesaing, CTA rumah lengkap, kartu di luar cakupan. **Belum EN:** label/pertanyaan registry
      parameter & asumsi engine, prosa templat per kasus, nama item BOM, label keluaran komposer
      (P15-04), PDF (P15-05)
- [x] P15-04 Engine dan tampilan solusi dua bahasa (2026-10-07). `packages/engineering`:
      `EngineeringLocale`, `registry-en.ts` (`Record<ParameterKey, …>` — parameter baru tanpa
      terjemahan gagal typecheck), aksesor `parameterLabel/Question/Reason/OptionLabels`,
      `caseProfileLabel/Description`, `outputLabel`, `assumptionDescription/Condition`,
      `MissingParameter.labelEn/questionEn/optionLabelsEn`; classifier & extractor membaca
      kalimat Inggris (sinonim kasus, "5 liters per second", "12 m higher", "4 by 4 m", "6 m road",
      "without a pump"). API: lima view solusi (bangunan, irigasi, bertekanan, gravitasi, kolam)
      dan komposer menerima `locale` — prosa, highlight, baris sistem, nama & satuan item BOM
      (`bomItemName`/`bomUnitLabel`), asumsi dari registry, label metrik/kesiapan/data kurang;
      `AnalysisService.run` meneruskan bahasa percakapan ke semuanya. Jalur kasus teknis:
      pertanyaan kartu/teks, label pilihan enum, label data tercatat, dan kartu handoff memakai
      registry EN; label dipilih saat ditampilkan (`technicalParameterLabel`), state tetap
      menyimpan label Indonesia; `technicalAnswerValue` menerima label Inggris & Yes/No → nilai
      protokol. Tes: engineering 175 (+26), API 866 (+27). **Belum EN saat itu (selesai di P15-04b):** `explanation`
      trace aturan engine (dasar perhitungan di detail) dan `structuralNote` gorong-gorong;
      `BomUnit` masih union Indonesia di shared-types (dilebarkan nanti)
- [x] P15-04c Rapi-rapi tampilan atas permintaan pemilik (2026-10-07): composer jadi textarea
      yang tumbuh dengan cincin fokus merek (`ComposerField`), badge "LANGKAH n DARI 4" dan
      tautan mati "Solusi Tersimpan"/"Pengetahuan Produk" dihapus (OQ-52); aturan "Teks yang
      dilihat pengguna" (tanpa metatext/AI slop) masuk `.claude/CLAUDE.md`; halaman profil belum
      ada → OQ-53
- [x] P15-04b Penjelasan trace aturan engine dua bahasa (`reason`/`basis` di detail perhitungan)
      (2026-10-07): `RuleVersion.explain(input, output, locale?)`; ke-34 aturan menulis kedua
      bahasa lewat `localized(locale, { id, en })` (bahasa yang terlupa = galat tipe). Teks
      Indonesia byte-identik, `version` aturan tidak naik. Keenam `compute*` menerima `locale`
      opsional terakhir (bawaan `'id'`), `AnalysisService` meneruskan bahasa percakapan;
      `structuralNote` gorong-gorong via `culvertStructuralNote` (output trace tetap Indonesia).
      Tes: engineering 227 (+52: setiap test case aturan — bawaan tetap, EN berbeda, himpunan
      angka sama), API 923 (+5)
- [x] P15-05 Laporan PDF dua bahasa (2026-10-07): `ReportPayload.locale` diambil dari bahasa
      percakapan saat laporan dibuat dan dibekukan bersama payload; payload tersimpan tanpa field
      itu dibaca sebagai `'id'` (`storedReportPayload`). `report-html.ts` memakai `REPORT_COPY`
      `{ id, en }` (`<html lang>`, judul, kolom, label status, rupiah `id-ID`/`en-US`); kalimat
      kebijakan EN sama persis dengan web (`SOLUTION_COPY_EN`). Baris kebutuhan memakai
      `requirement-labels`, jenis instalasi diisi service (bukan controller). HTML Indonesia
      identik byte demi byte. Tes: API +10. **Belum EN saat itu:** dasar perhitungan (trace; selesai di P15-04b)
- [x] P15-06 Perbaikan dari skenario checkpoint (2026-10-07): giliran kebutuhan selalu membawa kalimat
      "sudah saya catat" (ID/EN, fixture bernama), irigasi EN (deteksi + fakta), aspek & ketersediaan
      ukuran EN, pencarian katalog membaca keluarga ("pvc aw" menemukan pipa AW), label
      COMPANY_QUESTION model dipagari, Ollama keep-alive 24 jam. Tes: API +8
- [ ] ✋ CHECKPOINT — reviewed by owner — laporan siap: `docs/PHASE15_CHECKPOINT.md` (12 skenario EN
      di produksi, pengukuran latensi Ollama, tiga pilihan model untuk pemilik)

## Phase 16 — Routing percakapan: subjek aktif & pengetahuan perusahaan

Pemicu (pemilik, 2026-10-07): "pralon itu apa?" → "PT Pralon yang gw maksud" → "boleh" →
"lengkap dong" → "semuanya" berakhir "Produk mana yang Anda maksud?". Akar masalah: tidak ada intent
perusahaan (semua yang menyebut Pralon jatuh ke `PRODUCT_LOOKUP`), tidak ada subjek percakapan
(setiap lanjutan diklasifikasi ulang sebagai pesan lepas), tidak ada sumber pengetahuan perusahaan
(model 7B mengarang "PT Pralon adalah perusahaan…" tanpa DATA), dan teks "Produk mana…" adalah
jalan keluar ruas produk untuk pertanyaan tanpa produk.

- [x] P16-01 Intent `COMPANY_QUESTION` + subjek percakapan + modul `company-knowledge` (2026-10-07).
      Shared-types: `Intent` +`COMPANY_QUESTION`; `ConversationSubject { kind, entity, topic, depth }`,
      `AnswerDepth`; `RequirementState.subject`; `SnapshotTrigger` +`subject_change` (migration 0020).
      AI: skema/prompt intent +label; `heuristics.asksAboutCompany`/`certainIntent` → perusahaan
      ("PT Pralon", "company profile", sejarah/pabrik/visi/kontak, "pralon itu apa?"), produk
      tetap produk ("PVC AW Pralon itu apa?", "produk HDPE nya gimana?"). Context:
      `domain/subject.ts` (`isFollowUp` bag-of-words ≤ 8 kata, `requestedDepth`,
      `resolveCompanySubject` naik kedalaman, `productSubject`, `intentForSubject`); router
      `subjectContinuation` (lanjutan atas subjek → nol model), `certainIntent` perusahaan di kode,
      `withSubjectPrecedence` (Pralon lagi tanpa produk → tetap perusahaan); `MessageService`
      ruas `runCompanyQuestion`, `rememberSubject` (snapshot `subject_change` hanya bila berubah),
      subjek produk setelah lookup, subjek kasus saat kebutuhan berubah. Modul
      `company-knowledge`: `company-profile.ts` (bagian terverifikasi dengan `source`: ikhtisar,
      situs resmi; ragam produk dari katalog Pralon aktif saat dijawab), `company-answer.ts`
      (kedalaman mengatur jumlah bagian; yang belum terverifikasi disebut apa adanya + CTA tim;
      pertanyaan ambigu dapat kalimat pembeda produk), `CompanyKnowledgeService`; lint boundary
      (tanpa MySQL, tanpa `ai`). Tes: subject 12, company-answer 7, heuristics +1, router +1,
      message.service +3 (percakapan pemilik dimainkan ulang dengan router asli dan model yang
      selalu bilang PRODUCT_LOOKUP → model tidak pernah dipanggil, tidak pernah "Produk mana").
      Docs: AI_BEHAVIOR §4, CONTEXT_ENGINE §2, OQ-54 (data profil resmi dari pemilik). Verifikasi
      produksi: tujuh giliran percakapan pemilik tanpa "Produk mana"; lanjutan atas subjek produk
      ("lebih detail dong" setelah HDPE) memakai entitas subjek sebagai query; ragam produk di
      profil perusahaan = keluarga + jumlah
- [x] P16-03 Halaman akun minimal (OQ-53, "gas" pemilik 2026-10-07): `/akun` — nama bisa diganti,
      email & jenis akun dibaca, ganti sandi dengan sandi saat ini sebagai bukti
      (`CurrentPasswordMismatchError` 400 `reason: current_password`, kebijakan sandi berlaku untuk
      yang baru), pengalih tema/bahasa, keluar (cabut di server lalu buang token). API:
      `GET /auth/me` +`name`/`email` dari database, `PATCH /auth/me`, `POST /auth/password`
      (rate limit per IP), `UserRepository.updateName/updatePasswordHash`. Kaki sidebar menautkan
      avatar/nama ke `/akun`. Ditandai "menunggu desain". Tes: auth.service +3, account-page 3
- [x] P16-03b Akun jadi pop-up, tanpa metatext (pemilik, 2026-10-07): `AccountModal` di dalam
      workspace (scrim, kartu, Escape, focus trap — pola overlay laporan), dibuka dari avatar/nama
      di kaki sidebar; SATU tombol Simpan untuk nama dan kata sandi; `/akun` dihapus. Banner
      "TAMPILAN/BAGIAN SEMENTARA · MENUNGGU DESAIN" dibuang dari layar masuk/daftar, modal laporan,
      dan laci produk (status "needs design" cukup di OQ-21/OQ-53). Tes: account-modal 3,
      auth-form disesuaikan. P16-03c: textarea composer tidak lagi menggambar cincin fokusnya sendiri
      di dalam kartu yang sudah berbingkai fokus (laporan pemilik)
- [x] P16-04 "apa bedanya fitting sama hdpe?" (laporan pemilik 2026-10-07): pertanyaan konsep
      tidak pernah menjadi lookup aspek (`PRODUCT_CONCEPT` → aspek `null` di heuristik DAN di
      pipeline, apa pun kata model); pengetahuan konsep **fitting** + kalimat pembanding
      bahan-vs-komponen (ID/EN); `bestMatch` memilih produk yang keluarganya sama dengan istilah
      (HDPE → keluarga HDPE, bukan pipa kabel bernama HDPE); SKU ekspor ERP disembunyikan di kartu
      (OQ-55). Tes: pipeline +2, pipe-knowledge +1, heuristics +1, lookup-cards +1
- [x] P16-05 Permintaan ubah bentuk jawaban (laporan pemilik 2026-10-07: "bikinin skema
      perbedaannya dalam bentuk table" → "Produk mana yang Anda maksud?"): `requestedFormat`
      (tabel/poin/ringkas) + `isFormatFollowUp` (merujuk jawaban sebelumnya, tanpa entitas baru)
      di domain subjek; router melanjutkan ke subjek aktif tanpa model; ruas produk menyajikan
      ulang dari jawaban asisten terakhir + subjek (`reformat`: `materialsTable`,
      `fittingVsMaterialTable`, butir, ringkasan — isi sama, hanya bentuk). Web: `remark-gfm`,
      tabel diizinkan di `AssistantMarkdown` dengan pembungkus yang menggulir di layar sempit.
      Tes: subject +1, router +1, pipeline +1, pipe-knowledge +1, message.service +1, markdown +1
- [x] P16-05b Perbandingan lintas giliran (laporan pemilik 2026-10-07, "bandingin sama pipa PVC dalam
      bentuk table", "bedanya sama pipa AW … yang lu jelasin tadi"): "AW" dikenali PVC AW (token +
      konsep kelas AW/D), subjek perbandingan menggabungkan entitas ("hdpe dan pvc"), tabel atas
      gabungan bahan pesan + subjek, perbandingan satu bahan dengan subjek, lookback jawaban asisten
      yang memuat bahan (melewati tanya-balik). Tes: message.service +1 (harness kini mengembalikan
      giliran sebelumnya)
- [x] P16-06 Jawaban kartu klarifikasi kasus teknis ditolak 400 (laporan pemilik 2026-10-07):
      DTO endpoint hanya menerima field bangunan + irigasi, padahal kartu teknis memakai kunci
      parameter engine (`design_flow`, `pump_required`, …). Kini satu predikat domain
      `isClarificationAnswerId` (field inti, irigasi, kunci parameter) dipakai validasi; batas
      `option` 80 karakter. Gelembung pengguna memakai label registry ("Jenis cairan: Air
      limbah"), bukan kunci mentah; label irigasi per bahasa. Giliran jawaban kartu tidak pernah
      bisu: API mengembalikan `text` (teknis: data tercatat + sisa pertanyaan tanpa pembuka; irigasi:
      arahan; bangunan: "sudah saya catat"), web merendernya. Tes: clarification +2, technical +1
- [x] P16-07 Jajaran model gratis (keputusan pemilik 2026-10-07: "yang gratis aja, yang nggak kepake
      hapus"): dicoba `qwen2.5:3b-instruct` untuk tingkat `FAST` (judul, pemetaan pertanyaan produk) —
      benchmark ±2× lebih cepat dari 7B, tetapi di CPU Ollama melayani satu permintaan sekali waktu,
      jadi judul 3B yang berjalan bersamaan dengan ekstraksi 7B tetap 99 s. Tidak ada untungnya →
      dikembalikan ke satu model `qwen2.5:7b-instruct` untuk ketiga tingkat, 3B dihapus dari server.
      Hanya 7B yang disimpan. `docs/DEPLOYMENT.md` §4
- [x] P16-08 Uji proaktif percakapan Indonesia lazim (2026-10-07, 11 giliran di produksi, 7 celah):
      "pipa buat air panas pake apa?" → konsep air panas (PPR) + jalur cepat pertanyaan guna/bahan
      tanpa model (tadinya 121 s lalu "Produk mana"); "ok makasih"/"sip"/"bye" → balasan sosial tetap
      tanpa model (`domain/social.ts`; tadinya 49 s lalu teks pembuka); "yang mana buat kamar mandi?"
      → lanjutan pilihan atas subjek (kelas AW/D), tadinya pembuka; "ukuran hdpe ada apa aja?" →
      aspek ukuran dari katalog; "harganya berapa?" → jawaban tetap harga nonaktif + CTA (OQ-03),
      tadinya "Produk mana"; "jalan desa lebar 6 meter" → lebar jalan, bukan panjang jalur;
      giliran teknis lanjutan tanpa mengulang kalimat pembuka kasus. Tes: social 3, heuristics +1,
      pipe-knowledge +1, pipeline +2, subject +1, router +1, extractor +1, message-pipeline +1
- [x] P16-02 Profil perusahaan & pengetahuan pipa dari materi internal (2026-10-07, dokumen HRGA
      "Snouty Product Knowledge Master — uPVC PRALON" v1.0 di `data/company/`): 9 bagian profil
      bersumber (ikhtisar, portofolio, sektor, produksi, mutu, sertifikasi tanpa nomor, tonggak
      tanpa klaim "pelopor", kontak, situs); 11 konsep pengetahuan pipa baru (uPVC, istilah
      dimensi, kelas AW/D/C/JIS/SNI/PIPPO, sambungan lem, rubber ring, jenis fitting, penyimpanan,
      perawatan & gangguan, proses produksi, uji mutu, penimbunan, uji tekanan lapangan) +
      jalur cepat intent untuk pertanyaan pengetahuan pipa tanpa model. Angka yang dokumen tandai
      konflik tidak dibawa (OQ-54). Tes: company-answer disesuaikan, pipe-knowledge +1, heuristics +1
- [x] P16-08b Ruas produk tidak memanggil model pemeta sebelum jalur deterministik (harga, ubah
      bentuk, lanjutan subjek, pengetahuan tanpa keluarga produk) — tadinya 61–87 s per giliran
      hanya untuk memetakan
- [x] P16-09 Laporan pemilik 2026-10-07 malam (pesan masjid 2 lantai → "Pemahaman bahasa sedang
      tidak tersedia"): model 7B kehabisan waktu pada pesan panjang → kini diperlakukan seperti
      keluaran tidak valid — fakta tersurat (2 lantai, 2 kamar mandi, masjid → komersial ringan)
      tetap dicatat, pengantar + klarifikasi, bukan galat. Sekalian dari verifikasi produksi:
      "cara nyambung pipa pvc pakai lem" tidak lagi dijawab sebagai aspek sambungan katalog
      (pertanyaan cara = pengetahuan), "harganya berapa?" tanpa subjek langsung kebijakan harga
      (tanpa model), pertanyaan topik (penyimpanan, cara) dibuka dengan topiknya sebelum ikhtisar
      bahan. Toren tanpa letak ("mau pasang 2 toren") tidak lagi ditebak "toren bawah" oleh model —
      sumber air masuk klarifikasi. Tes: message-pipeline +1, heuristics +1, grounding +1
- [x] P16-10 Diet panggilan model (pemilik 2026-10-07: "kok masih lama bgt buat ambil jawabannya").
      Diagnosis dari `llm_calls` 6 jam: ekstraksi rata-rata 103 s (maks 181), 9 ulang ekstraksi
      36 s, intent 41 s, judul 40 panggilan 17 s, prosa solusi 70 s — di CPU server <1 tok/s
      jawaban. Keputusan: (1) ekstraksi model DILEWATI bila kode sudah membaca ≥ 2 data inti dari
      teks (pesan masjid: 0 s, bukan 100+ s); kode kini juga membaca wastafel/dapur dan pompa/sumur
      sebagai sumber (bukan pompa pendorong); (2) tiga saklar env baku nonaktif:
      `LLM_CHAT_REPLY` (sapaan/pembuka/judul oleh model), `LLM_STRUCTURED_RETRY` (percobaan kedua
      JSON), `LLM_SOLUTION_PROSE` (headline/body solusi) — nyalakan hanya dengan model cepat;
      judul dari klausa pertama pesan (`fallbackTitle`). Yang tersisa memanggil model: ekstraksi
      untuk kebutuhan yang tidak terbaca kode, intent di luar pola, pemetaan produk tanpa keluarga.
      Sekalian `docs/brainstorm/` (skema arsitektur `.md` + konteks ringkas + daftar dokumen) untuk
      brainstorming pemilik. Tes: message-pipeline +2, openrouter +1, grounding +1, service judul ×2
- [x] P16-11 Hapus pola kalimat hardcode (aturan pemilik 2026-10-07, `.claude/CLAUDE.md`
      "Pemahaman pertanyaan pengguna") — selesai 2026-10-08. Modul baru `understanding`
      (`docs/AI_BEHAVIOR.md` §4a): contoh kalimat sebagai DATA di `data/understanding/` (katalog
      `intent` 28 label halus, `depth`, `format`, `company-topic`, `product-aspect`,
      `knowledge-topic` multi-label; ±1.300 kalimat dua bahasa, `threshold` + `margin` per katalog)
      dan kosakata entitas `vocabulary.json` (keluarga produk kanonis + alias, merek sendiri, merek/
      rujukan pesaing, hal-hal kebutuhan). Penyandi: port `TextEncoder` di `ai` +
      `OpenAiEmbeddingEncoder` (`/embeddings`, env `LLM_MODEL_EMBEDDING`, Ollama `bge-m3`); contoh
      disandikan sekali saat boot (cache vektor berkas), satu penyandian per pesan, pengklasifikasi
      tetangga terdekat (skor label = contoh terdekat). Dihapus: `ai/domain/heuristics.ts`,
      `context/domain/message-signals.ts`, seluruh regex di `subject.ts`, `social.ts`,
      `product-question-pipeline.ts`, dan pola `MATERIALS`/`CONCEPTS` di `pipe-knowledge.ts`
      (kini `families`/`topic` kanonis). Kode menyisakan: label (`labels.ts`, data dengan label asing
      ditolak saat boot), pemetaan label → intent kasar + pagar (`certainIntent`: pesaing hanya bila
      pesan menyebut pesaing; perusahaan yang menyebut Pralon tetap perusahaan walau ada "pabrik";
      lanjutan yang menyebut produk/kebutuhan baru bukan lanjutan; mutasi/jawaban klarifikasi butuh
      kebutuhan yang ada), presedensi kebutuhan/subjek, parser ukuran (`size-parser.ts`), subjek
      `fitting_vs_material`. Ragu (`intent: null`) → model generatif seperti sebelumnya; tanpa
      penyandi semua keputusan makna kosong (jujur, lambat). Adapter dev tanpa regex intent/produk;
      `SNOUTY_FAKE_AI` memakai penyandi trigram cadangan. Evaluasi: `evals/understanding-cases.json`
      (110 kalimat, bukan salinan contoh) lewat `understanding.eval.spec.ts` terhadap `bge-m3` lokal:
      intent 114/114 (100%) termasuk kasus negatif faset; ambang intent ditala 0,62 → 0,65
      supaya kalimat asing dibiarkan ragu. Temuan produksi (verifikasi live 2026-10-08): katalog
      faset terpicu oleh kalimat biasa ("apa bedanya pvc dan hdpe?" → format tabel; "pralon itu
      apa?" → topik sertifikasi) karena kalimat sedomain saling mirip 0,65–0,80 — diperbaiki dengan
      label contoh negatif `none` di tiap katalog faset (kode: `NONE_LABEL`, contoh terdekat `none`
      = tidak ada) plus ambang faset 0,72–0,74 dan `window` untuk katalog multi-label (topik lain ikut hanya
      dalam 0,12 di bawah topik teratas — "pipa buat air panas pake apa?" sempat ikut menyeret
      sambungan lem). Dua pagar pipeline dari verifikasi live: perbandingan yang menyebut konsep
      (fitting vs HDPE) tidak menarik bahan subjek sebelumnya; pertanyaan pengetahuan tanpa bahan
      tidak membandingkan ulang bahan subjek. Volume cache vektor harus milik `node` (Dockerfile
      chown; kegagalan tulis cache kini tercatat di log). Pemanasan di server: 1.272 contoh ±0,4 s/kalimat
      (±7 menit) → cache vektor dipindah ke volume compose `understanding-cache`. Per pesan di
      server: pemahaman 31–44 ms, giliran tanpa model 40–60 ms. Dockerfile menyalin `data/`;
      `DEPLOYMENT.md` + env example: `ollama pull bge-m3`, `LLM_MODEL_EMBEDDING=bge-m3`. Tes: +6
      spec modul `understanding` (klasifikator, katalog, kosakata, data asli, penyandi cadangan,
      service); spec subjek/sosial/router/pipeline produk/pengetahuan pipa/Inggris/adapter AI
      ditulis ulang atas helper `understood()` (label eksplisit + kosakata asli); 825 tes unit
      `@snouty/api` hijau.
- [x] P16-12 Mutasi RELATIF kebutuhan — selesai 2026-10-08. Katalog data baru `mutation-op`
      (`add`/`remove`/`none`): arah dari contoh, angka dari teks (tanpa angka = 1), dihitung atas
      state (`context/domain/relative-counts.ts`), tidak di bawah nol; model ekstraksi dilewati bila
      arahnya dikenali. "tambah satu kamar mandi" atas 3 → 4 (sebelumnya 1).
- [x] P16-13 Audit sistem 2026-10-08 (tinjauan kode adversarial + uji hitam-kotak di produksi, ±70
      giliran). Diperbaiki: (1) merek pesaing di kalimat kebutuhan kini selalu Policy 1; (2) subjek
      perusahaan aktif menang atas jalur cepat kebutuhan ("pabriknya di mana?"); (3) pertanyaan
      produk yang hanya menyebut "rumah saya" tanpa data inti tetap pertanyaan produk; (4) ragam
      produk dan pertanyaan aspek atas subjek produk tidak lagi memanggil model pemeta (sempat 23–38
      s; "standarnya apa?" kini dijawab dari subjek); (5) "pvc aw vs pvc d" tidak menarik HDPE dari
      subjek; (6) "tee pvc 3/4" dicari sebagai satu istilah, galvanis tidak dicari ke katalog
      (`knowledgeOnlyFamilies`/`fittingFamilies` di kosakata); (7) parser ukuran: kelas produk (PE
      100, PN, SDR) dan jumlah bangunan bukan ukuran, mm tidak lagi dibaca inci, pecahan campuran;
      (8) kebutuhan bangunan ber-sumur/pompa tidak lagi dibelokkan ke kasus distribusi sumur; (9)
      pertanyaan harga di dalam kebutuhan tetap dijawab kebijakan harga; (10) "torennya" (klitik)
      terbaca; "pvcnya"/"pralonnya" dikenali kosakata; (11) di luar topik dijawab batasnya, bukan
      sapaan pembuka; (12) "mending pvc apa hdpe?" langsung nasihat tanpa ekstraksi model; (13)
      pesan tanpa huruf/angka tidak disandikan (" ?" sempat dijawab kebijakan harga); (14)
      pemanasan penyandi yang gagal dicoba ulang setelah 60 s dan disimpan per katalog; (15) penyandi
      tidak lagi butuh kunci API; cache vektor dibulatkan 5 desimal dan dipangkas dari contoh yang
      dihapus; (16) urutan konsep mengikuti topik terdekat ("bocor di sambungan" dibuka dengan
      gangguan); (17) pertanyaan harga di dalam kebutuhan bangunan dikenali (data) dan dijawab; (18)
      pencarian katalog fitting memakai alias kosakata (elbow HDPE Pralon bernama "Bend (Segmented) PE")
      dan memilih produk yang memang berukuran yang ditanya; angka ukuran telanjang > 12 = mm; (19)
      pesan tanpa huruf/angka dijawab tanpa model. Diverifikasi live: "tambah satu kamar mandi" 3 → 4,
      "elbow hdpe 63 ada?" → Bend 90º PE 63 mm tersedia, "tee pvc 3/4" → tee 3/4 tersedia, semua
      giliran tanpa model < 0,4 s. Tes: `audit-2026-10-08.spec.ts` (13), `size-parser.spec.ts`,
      `file-vector.cache.spec.ts`, mutasi relatif +3; golden set 125/125. Sisa yang BUKAN cacat kode
      (dicatat, tidak diubah): katalog Pralon aktif hampir seluruh spesifikasinya `UNAVAILABLE` (data
      impor ERP, OQ-55); irigasi belum punya field debit; jawaban "pabrik di mana" menunggu data
      lokasi resmi (OQ-54); laporan untuk tamu memang terkunci (entitlement).
- [x] P16-14 Sisa pola kalimat dipindah ke data — selesai 2026-10-08. (1) Pengklasifikasi kasus
      regex berbobot di `packages/engineering` (`classifyCase`) dihapus; jenis kasus kini katalog data
      `use-case` (label = `CaseId`, ±130 contoh dua bahasa + `none`), dibaca `detectTechnicalCase`;
      kesamaan label ↔ `CaseId` dijaga tes. Sekaligus memperbaiki regresi audit P16-13: pagar
      "kebutuhan bangunan bukan kasus sumur" ikut menutup kasus gedung bertingkat ("gedung kantor 6
      lantai"); kini dibedakan contoh, pagar dihapus. (2) Deteksi irigasi (`IRRIGATION_SIGNALS`) diganti
      label `use-case`/intent. (3) Kebijakan cakupan (`policy/scope.ts`) tidak membaca bahasa lagi:
      menerima isyarat — nama fluida dari kosakata `outOfScopeFluids`, suhu dari `temperature-parser.ts`;
      batas 45 °C tetap aturan kebijakan. (4) Rujukan dokumen ke `message-signals.ts`/`heuristics.ts`
      dibersihkan; `dist` lokal dibangun ulang tanpa berkas lama. Yang sengaja tetap regex: parser nilai
      (angka, satuan, suhu, ukuran, jumlah, enum sumber air/irigasi) dan penilai nama produk katalog —
      bukan tebakan pertanyaan. Verifikasi live: gedung 6 lantai → kasus
      bertingkat, kos/boarding house + sumur → jalur bangunan, sumur bor/irigasi/gorong-gorong/tambak/drainase
      air hujan → kasusnya masing-masing. Dua temuan live ikut diperbaiki: tempat + fluida di luar cakupan
      ("pipa jalur air panas boiler hotel") kini kena kebijakan cakupan, bukan "Produk mana"; "toren atas"
      tercatat sebagai toren atap. Golden set 146/146; tes API 988, engineering 199.
- [x] P16-15 Update kasus teknis tidak berefek (laporan pemilik 2026-10-08) — selesai. (1) "ubah beda
      tingginya jadi 20 meter" tidak terbaca (klitik "-nya" + "jadi") dan angkanya menimpa panjang jalur;
      kini penanda beda tinggi menerima klitik dan kata sambung. (2) Penanda netral "beda tinggi 15 m" dari
      sumur ke tandon tercatat −15; kini positif (air dinaikkan) — arah hanya dari "lebih rendah/lebih
      tinggi". (3) "Perbaiki asumsi ini" pada solusi kasus teknis/irigasi membuka panel mode ubah yang
      tidak punya editor (diam); kini kembali ke chat, panel terbuka, kolom ketik terfokus. Diverifikasi
      live: 15 → 20 m, panjang jalur tetap 500 m. Tes: extractor +3, ComposerField +1.
- [x] P16-16 "Ubah" di panel Kebutuhan Anda terasa tidak berefek (laporan pemilik 2026-10-08, dengan
      tangkapan layar) — selesai. Diuji headless (Playwright) di produksi: PATCH dan analisis ulang
      selalu berjalan, tetapi (1) hasil ENG-011 (pompa pendorong, dari tipe bangunan + sumber air) dan
      ENG-013 (kelas pipa AW/D) dihitung lalu dibuang — mengubah tipe bangunan, sumber air, atau jenis
      instalasi tidak mengubah apa pun di solusi; kini keduanya tampil sebagai ASUMSI yang bisa
      diperbaiki (tanpa ukuran jalur pembuangan karangan — dihitung tim teknis); (2) analisis ulang
      selalu memaksa tab ke Ringkasan, sehingga perubahan kuantitas di Estimasi Material/Skema (efek
      jumlah lantai) tersembunyi — kini tab dipertahankan; (3) teks ENG-011 mencetak enum mentah
      ("sumber municipal") — kini "PDAM"/"pompa"/"toren bawah"; (4) judul percakapan toko/kantor
      "Rumah N lantai" — kini "Bangunan N lantai". Tes: solution-view +2, judul +1.
- [x] P16-17 Jawaban enak dibaca seperti asisten chat umum (permintaan pemilik 2026-10-08) — selesai.
      Fakta dan angka tidak berubah; hanya bentuknya. (1) Jawaban perusahaan: prosa per paragraf tanpa
      judul tebal dan tanpa "materi internal"/"verifikasi"; lanjutan ("boleh", "lengkap dong") hanya
      menambah bagian yang belum diceritakan, lalu satu tawaran lanjutan. (2) Pertanyaan topik (cara
      sambung lem, penyimpanan, gangguan, istilah ukuran) dijawab topiknya saja, sebagai kalimat
      pembuka + daftar langkah/butir; gangguan dibuka dengan penyebab bocor sambungan. (3) Ikhtisar
      bahan tanpa pengulangan templat. (4) Teks produk: "belum tercantum di katalog", ikhtisar tanpa
      kategori huruf besar, daftar keluarga produk paling banyak tiga contoh per keluarga. (5) Ubahan
      kebutuhan hanya menyebut yang berubah ("Oke, sudah saya ubah: 4 kamar mandi."). (6) Kasus
      teknis: pertanyaan kartu tidak diulang di teks, "1%", "a dan b". (7) Irigasi tidak mengulang
      arahan bahan setiap jawaban kartu. (8) Kartu air panas/cairan khusus menyebut alasannya yang
      benar (dulu menyebut irigasi), kartu kebijakan dan kompetitor punya satu kalimat pengantar.
      (9) "Kenapa 1 inci?" sebelum ada solusi dijawab kapan ukurannya dihitung. (10) Ringkasan solusi
      berbahasa Inggris di mode EN. Tes API 1006 hijau.
- [x] P16-18 UI/UX nyaman di semua perangkat (audit 12 temuan, 2026-10-08) — selesai. Aliran chat
      menempel ke bawah saat jawaban tumbuh (pil "Pesan baru" bila pengguna sedang membaca ke atas);
      animasi jawaban panjang maksimal ±2,2 detik; mode EN tidak lagi mengirim dalam bahasa Indonesia
      (dependensi `locale` callback) dan pengalih tema ikut bahasa; kartu "Yang sudah saya pahami"
      tidak berulang di ujung aliran; judul header ponsel tidak ambruk; skema mengecil di ponsel;
      tabel markdown dengan kolom pertama menempel; tab solusi memudar di tepi dan menggulir ke tab
      aktif; panel bisa ditutup dengan × 44 px dan Escape; target sentuh 44 px di layar sentuh; teks
      mikro naik ukurannya di bawah 720 px. Tes web 109 hijau.
- [x] P16-19 Tab Skema selalu "belum tersedia" untuk pengguna yang sudah masuk (laporan pemilik
      2026-10-08, tangkapan layar) — selesai. Permintaan skema (tab dan halaman /schematic) tidak
      membawa access token, padahal akun memegangnya di memori, bukan cookie; tamu tidak terkena
      karena memakai cookie. Kini token ikut dikirim, dan halaman /schematic memulihkan sesi dulu.
      Tautan "Lihat skema instalasi" hanya tampil bila skemanya memang ada (dulu tetap tampil di
      solusi irigasi/kasus teknis yang memang belum punya desain skema, OQ-47). Tes web +2.
- [x] P16-20 Salam yang sama terulang (laporan pemilik 2026-10-08: "hai" lalu "gw mau nanya2
      nih" dijawab perkenalan yang persis sama) — selesai. Perkenalan "Halo! Saya SNOUTY…" kini
      hanya untuk giliran pertama; sapaan atau ajakan bertanya di tengah percakapan dijawab ajakan
      bertanya. Aturan di kode (riwayat giliran), bukan daftar frasa. Tes +1.
- [x] P16-21 Hapus dari riwayat seperti ChatGPT (permintaan pemilik 2026-10-08) — selesai. Tombol
      hapus per baris riwayat (muncul saat diarahkan; selalu terlihat di layar sentuh), soft delete
      (`deleted_at` sudah ada, tanpa migration), notifikasi "Percakapan dihapus · Urungkan" 6 detik
      lewat rute baru `POST /conversations/:id/restore` (hanya pemilik, idempoten). Menghapus
      percakapan yang sedang dibuka kembali ke sambutan. Tes MySQL +1.
- [x] P16-22 "PT Pralon produknya apa aja?" dibalas "Produk mana yang Anda maksud?" (laporan
      pemilik 2026-10-08) — selesai. Pertanyaan produk tanpa produk yang disebut kini dijawab ragam
      keluarga produk Pralon; nama yang disebut tetapi tidak ada di katalog dikatakan dulu, lalu
      ragamnya. Teks bertanya-balik dihapus. Tes diperbarui.
- [ ] P16-02b Sisa OQ-54: visi/misi/distribusi, Certificate Register, profil korporat resmi,
      Product Specification resmi (angka)
- [ ] ✋ CHECKPOINT — reviewed by owner

## Design Coverage

| Screen | Description                                               | Phase               | Status                            |
| ------ | --------------------------------------------------------- | ------------------- | --------------------------------- |
| 01     | Welcome                                                   | 3                   | [ ]                               |
| 02     | Active consultation                                       | 4                   | [ ]                               |
| 03     | Clarification                                             | 5                   | [ ]                               |
| 04     | Requirement review                                        | 5–6                 | [ ]                               |
| 05     | Analysis tracker                                          | 6–7                 | [ ]                               |
| 06     | Recommendation workspace                                  | 7–9                 | [ ]                               |
| 07     | Product card states                                       | 7                   | [ ]                               |
| 08     | Competitor question                                       | 5                   | [ ]                               |
| 09     | Schematic                                                 | 9                   | [ ]                               |
| 10     | Product detail drawer                                     | 1–2                 | [ ] _API siap (P1-08); UI Fase 2_ |
| 11     | Technical validation                                      | 5, 10               | [ ]                               |
| 12     | History & saved                                           | 10                  | [ ]                               |
| 13     | Mobile (13a/13b/13c)                                      | all                 | [ ]                               |
| 14     | Onboarding                                                | 3                   | [ ]                               |
| —      | Report PDF                                                | 10                  | [ ]                               |
| —      | Mascot moods                                              | 3+                  | [x]                               |
| —      | Dark mode                                                 | all                 | [ ]                               |
| —      | Stage indicator (Kebutuhan → Analisis → Solusi → Laporan) | 4                   | [ ]                               |
| —      | Toast + error states                                      | each phase          | [ ]                               |
| —      | Login / register                                          | 3                   | [ ] _needs design — OQ-21_        |
| —      | Register-gate + resume                                    | 10                  | [ ] _needs design — OQ-27_        |
| —      | Back-office (6 areas)                                     | 1, 3, 6, 10, 11, 12 | [ ] _needs design — OQ-21_        |
| —      | Answer feedback                                           | 13                  | [ ] _needs design — OQ-21_        |
| —      | Privacy / terms pages                                     | 3                   | [ ] _needs design — OQ-12, OQ-21_ |
| —      | Onboarding re-open entry point                            | 3                   | [ ] _partly designed — OQ-21_     |

## Domain Validation Tracker

All rules are `REQUIRES_DOMAIN_VALIDATION` until a Pralon domain expert is named (OQ-06). While that
holds, **no sizing value may render as TERVERIFIKASI** (Policy 4).

| Rule ID | Description                                                                                                                       | Origin                      | Status                     | Validated by | Date |
| ------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------- | ------------ | ---- |
| ENG-001 | Fixture load units `bath*2 + basin + kitchen`; outlet count ("titik air") `bath + basin + kitchen`                                | newer prototype             | REQUIRES_DOMAIN_VALIDATION | —            | —    |
| ENG-002 | Main/riser size threshold `loadUnits >= 8 → 1"`, else `3/4"` — ⚠ the older prototype and SPEC §33b say `fixtures >= 6`; see OQ-22 | newer prototype             | REQUIRES_DOMAIN_VALIDATION | —            | —    |
| ENG-003 | Maximum 4 outlets per branch                                                                                                      | both prototypes             | REQUIRES_DOMAIN_VALIDATION | —            | —    |
| ENG-004 | Default floor height 3.5 m                                                                                                        | both prototypes             | REQUIRES_DOMAIN_VALIDATION | —            | —    |
| ENG-005 | Fixture connection size 1/2"                                                                                                      | both prototypes             | REQUIRES_DOMAIN_VALIDATION | —            | —    |
| ENG-006 | Field variance 10–15% on estimated quantities                                                                                     | both prototypes             | REQUIRES_DOMAIN_VALIDATION | —            | —    |
| ENG-007 | Clarification priority order `source → install → floors → bath`; see OQ-23                                                        | prototype                   | REQUIRES_DOMAIN_VALIDATION | —            | —    |
| ENG-008 | Fixture-to-floor distribution heuristic (`ceil` on top floor, `floor` below, kitchen on floor 1); see OQ-33                       | prototype                   | REQUIRES_DOMAIN_VALIDATION | —            | —    |
| ENG-009 | BOM quantity formulas (`2+nFloors` batang main, `3+bath` batang branch, `bath+2` tees, `bath*3` elbows, `nFloors` reducers)       | prototype                   | REQUIRES_DOMAIN_VALIDATION | —            | —    |
| ENG-010 | Target flow velocity 1–2 m/s                                                                                                      | prototype ("DETAIL TEKNIS") | REQUIRES_DOMAIN_VALIDATION | —            | —    |
| ENG-011 | Rooftop-tank gravity is sufficient without a booster pump for this building class                                                 | prototype copy              | REQUIRES_DOMAIN_VALIDATION | —            | —    |
| ENG-012 | Assumption "each bathroom contains 1 shower + 1 closet"                                                                           | prototype                   | REQUIRES_DOMAIN_VALIDATION | —            | —    |
| ENG-013 | Pressure class guidance: AW for pressurised clean water, D for drainage                                                           | board screen 08             | REQUIRES_DOMAIN_VALIDATION | —            | —    |
| ENG-014 | "Belum tahu" defaults (`source → Toren atap`, `install → Air bersih`); see OQ-32                                                  | prototype                   | REQUIRES_DOMAIN_VALIDATION | —            | —    |

## Session Log

| Date       | Items worked on                   | Result                                                                      | Branch / commits                   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | --------------------------------- | --------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-30 | P0a-01 … P0a-07                   | 6 done, P0a-04 blocked                                                      | `phase-0/P0a-analysis`             | Design bundle moved to `design-input/handoff/`. 33 open questions raised; 11 design conflicts found beyond SPEC §33h.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-09-30 | P0a-04                            | done — Phase 0a now 7/7                                                     | `phase-0/P0a-analysis`             | Credentials supplied. `snouty` is empty; server is shared with 7 other databases. Raised OQ-34: the supplied account is a server-wide superuser, contrary to SPEC §17 least privilege.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-09-30 | Checkpoint 0a                     | disetujui ("ok gas")                                                        | —                                  | Lanjut dengan proposed default untuk OQ yang belum dijawab. Bahasa dokumen baru: Indonesia.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-09-30 | P0b-01 … P0b-09                   | 9/9 selesai                                                                 | `phase-0/P0b-core-docs`            | Sembilan dokumen inti ditulis dalam Bahasa Indonesia. `DATABASE.md` memuat draf SQL akun least-privilege (OQ-34); `DESIGN_IMPLEMENTATION.md` memuat peta token gelap lengkap (OQ-16).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-09-30 | Checkpoint 0b                     | disetujui ("lanjut")                                                        | —                                  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-09-30 | P0c-01 … P0c-15                   | 15/15 selesai                                                               | `phase-0/P0c-remaining-docs`       | Seluruh 28 dokumen Bagian 48 kini ada.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-09-30 | Checkpoint 0c                     | disetujui ("lanjut gass")                                                   | —                                  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-09-30 | P0d-01 … P0d-14                   | 14/14 selesai                                                               | `phase-0/P0d-claude-config`        | `.claude/CLAUDE.md` + 13 skill; frontmatter divalidasi, nama cocok dengan folder. Skill merujuk ke `docs/*.md`, tidak menduplikasinya. Menunggu review sebelum Fase 0e.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-09-30 | P0e-01 … P0e-08                   | 7/8 selesai, P0e-05 tertunda                                                | `phase-0/P0e-skeleton`             | Monorepo, token, font self-hosted, health check. CI ditulis tetapi provider masih OQ-09.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-09-30 | P1-01 … P1-03                     | 3/3 selesai                                                                 | `phase-1/P1-01-catalog-foundation` | Skema katalog + migration reversibel (17 pemeriksaan), tipe domain, value object `PipeSize` (13 tes). Migration **tidak** diterapkan ke `192.168.1.136`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-10-01 | P1-04, P1-04a                     | 2/2 selesai                                                                 | `phase-1/P1-01-catalog-foundation` | Repository katalog + 16 tes integrasi terhadap kontainer MySQL sekali pakai; total 25 tes `@snouty/api` lolos. Ditambahkan `tsconfig.spec.json` karena berkas `*.spec.ts` sebelumnya tidak pernah di-typecheck. Redis/RabbitMQ lokal tidak bisa menyala: port 6379 dan 5672 sudah dipakai kontainer proyek lain (bukan blocker Fase 1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-10-01 | P1-05, P1-05a                     | 2/2 selesai (P1-05b tetap terhalang OQ-07)                                  | `phase-1/P1-01-catalog-foundation` | Kontrak impor bebas format + validator murni; total 53 tes `@snouty/api` lolos. Dua ambiguitas dicatat: **OQ-38** (dokumen memuat dua model impor yang bertentangan — seluruhnya atau sebagian) dan **OQ-39** (konvensi sel untuk nilai jamak). Definisi kunci spesifikasi dipindahkan ke `domain/` supaya validator impor dan mapper pembacaan memakai satu daftar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-01 | P1-06 (inti), P1-06a              | inti selesai; P1-06b terhalang OQ-40                                        | `phase-1/P1-01-catalog-foundation` | Migration 0001 + use case ingest idempoten; 72 tes `@snouty/api` dan 24 pemeriksaan migration lolos. Migration **tidak** diterapkan ke `192.168.1.136`. Port Redis/RabbitMQ lokal digeser ke 6380/5673 karena 6379 dan 5672 dipakai kontainer proyek lain. Dicatat **OQ-40**: konsumer RabbitMQ tinggal di `apps/worker` tetapi kode domain di `apps/api`, dan belum ada jalan di antaranya — menyangkut semua job, bukan hanya katalog.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-10-01 | P1-07, P1-07a                     | 2/2 selesai                                                                 | `phase-1/P1-01-catalog-foundation` | Promosi `draft` → `active` dengan pengarsipan, audit, dan invalidasi cache dalam urutan yang mengikat; 87 tes `@snouty/api` dan 24 pemeriksaan migration lolos. Migration 0002 menambah `audit_logs`; **tidak** diterapkan ke `192.168.1.136`. `ioredis` dipasang sebagai klien Redis pertama (dokumen tidak menyebut klien tertentu); CI mendapat service Redis karena tes invalidasi menyentuh Redis sungguhan.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-10-01 | P1-08, P1-08a                     | 2/2 selesai                                                                 | `phase-1/P1-01-catalog-foundation` | Empat endpoint katalog + cache read-through; 130 tes `@snouty/api` lolos dan keempat endpoint diverifikasi terhadap API yang berjalan. Tiga temuan di luar item: (1) `packages/shared-types` tidak punya build sehingga tidak bisa dipakai saat runtime — ketahuan hanya setelah API dijalankan sungguhan, bukan oleh tes; (2) dua spec berbagi satu keyspace Redis dan saling menghapus kunci saat vitest berjalan paralel; (3) `packages/engineering` masih punya masalah paketisasi yang sama dan akan menabraknya di Fase 6.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-10-01 | P1-09, P1-09a                     | 2/2 selesai                                                                 | `phase-1/P1-01-catalog-foundation` | Provenance spesifikasi sebelumnya disusun di tiga tempat terpisah dengan salinan aturan yang sama; kini satu konstruktor, dan tipenya menolak `UNAVAILABLE` yang membawa nilai maupun fakta produk bertanda `ASSUMED`. 155 tes `@snouty/api` lolos. Jalur "nilai dari dokumen teknis" ditutup sekaligus: sitasi tidak lengkap menurunkan nilainya menjadi `UNAVAILABLE`, bukan menampilkannya tanpa sumber. `apps/api/vitest.config.ts` kini mengarahkan `@snouty/shared-types` ke sumbernya supaya `dist` usang tidak lagi menggagalkan tes dengan pesan menyesatkan.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-10-01 | P1-10 (API), P1-10a, P1-11, P1-12 | Fase 1 10/12; sisanya terhalang OQ                                          | `phase-1/P1-01-catalog-foundation` | Rute `/internal/catalog/*` dengan guard yang **gagal tertutup** — tanpa modul `auth`, seluruhnya menjawab `401`, dan itu keadaan yang benar. Katalog contoh disemai lewat jalur impor sungguhan; skripnya menolak host bersama dan menolak berjalan tanpa `SEED_SAMPLE_CATALOG=1`. 173 tes `@snouty/api` dan 24 pemeriksaan migration lolos. Dua temuan: berkas `*.spec.ts` dikecualikan `tsconfig.json` sehingga oxc tidak tahu dekorator diizinkan (struktur tsconfig dirapikan: `tsconfig.json` mencakup tes, `tsconfig.build.json` yang memancarkan); dan kunci cache katalog tidak memuat nama database, jadi satu Redis untuk dua database pengembangan menyajikan katalog yang salah — skrip semai kini membuang cache sungguhan.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-10-01 | Checkpoint Fase 1                 | disetujui ("gass")                                                          | —                                  | Fase 1 10/12. Empat item tertunda semuanya menunggu jawaban OQ, bukan menunggu kode. Fase 2 dipecah menjadi 8 item.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-10-01 | P2-01 … P2-08                     | 8/8 selesai                                                                 | `phase-1/P1-01-catalog-foundation` | Modul `product-knowledge` tanpa satu pun impor MySQL (pagar lint diverifikasi dengan berkas yang sengaja melanggar). 231 tes lolos: 210 `@snouty/api` + 21 `shared-types`. Diuji terhadap aplikasi yang berjalan memakai katalog contoh: kedelapan aspek dijawab benar, `pressure_class` mengembalikan `unavailable` beserta dokumen yang ditawarkan **tanpa** field nilai, dan retrieval mengembalikan 0 potongan di bawah ambang alih-alih memaksakan yang paling mirip. Ketahuan satu celah nyata: kontrak impor belum membawa dokumen/gambar, dicatat sebagai **P1-05c**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-01 | Checkpoint Fase 2, P1-05c         | disetujui ("gas"); P1-05c selesai                                           | `phase-1/P1-01-catalog-foundation` | Fase 2 8/8. P1-05c menutup celah yang ketahuan saat memverifikasi Fase 2: kontrak impor kini membawa dokumen (`Judul\|URL\|halaman`) dan gambar, jadi jalur "Lihat dokumen teknis" bisa dicapai dari data impor — bukan hanya ada di kode. Sisipan langsung di skrip semai dihapus; dokumen contoh kini lewat importer seperti data lainnya. 224 tes `@snouty/api` lolos.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-10-02 | P3-01, P3-01a                     | 2/2 selesai                                                                 | `phase-1/P1-01-catalog-foundation` | Skema identity dengan FK dalam konteks. Tes migration menangkap **tiga** cacat sebelum migration pernah dijalankan ke mana pun: helper `createdAt()` menerbitkan `granted_at` sebagai `created_at` sehingga CHECK merujuk kolom yang tidak ada; MySQL menolak CHECK pada kolom yang dipakai FK `ON DELETE SET NULL`, dan ALTER yang gagal itu menghentikan migration sehingga FK sesudahnya tidak terpasang (dua gejala, satu penyebab); dan skrip tesnya sendiri mengandaikan database kosong, sehingga jalan keduanya melaporkan kegagalan palsu sambil menyembunyikan yang asli. Dicatat **P1-01b**: tujuh tabel katalog tidak punya FK dalam konteks, berlawanan dengan konvensi.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-10-02 | Infrastruktur: database lokal     | selesai                                                                     | `phase-1/P1-01-catalog-foundation` | Keputusan pemilik: pengembangan memakai MySQL lokal, bukan `192.168.1.136`. Ditambahkan kontainer `mysql` persisten (volume, port 3316) **terpisah** dari `mysql-test` yang `tmpfs` — satu kontainer untuk keduanya berarti tes yang mengosongkan tabel ikut mengosongkan katalog contoh. `db-apply.mjs` kini membedakan tujuan dari alamat loopback, bukan dari nama host; ke lokal langsung jalan, ke host lain seluruh upacara §4 tetap berlaku. `.env.example` tidak lagi memuat alamat server bersama: `cp .env.example .env` yang mengarahkan mesin pengembang ke infrastruktur bersama adalah kesalahan yang cukup terjadi sekali.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-10-02 | P3-02, P3-02a                     | 2/2 selesai                                                                 | `phase-1/P1-01-catalog-foundation` | Argon2id dengan parameter OWASP minimum (19 MiB, 2 iterasi, paralelisme 1) ditulis eksplisit supaya bisa diaudit. `verify` mengembalikan `false` untuk hash rusak alih-alih melempar: satu baris rusak tidak boleh mengubah login menjadi galat 500 untuk semua orang. Aturan password hanya panjang (min 12), tanpa komposisi — aturan komposisi menghasilkan `Password1!`. 244 tes lolos, memanggil Argon2 sungguhan.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-10-02 | P3-03, P3-03a                     | 2/2 selesai                                                                 | `phase-1/P1-01-catalog-foundation` | Access token JWT HS256 dengan klaim minimum (`sub`, `tier`, `roles` — tanpa email/nama, karena JWT hanya base64); refresh token buram 256-bit, disimpan sebagai SHA-256, dirotasi per family. Deteksi pemakaian ulang mencabut seluruh family: tidak bisa diketahui apakah yang terlambat itu penyerang atau pemilik asli, dan justru karena itu keduanya di-logout. Semua penolakan memakai satu pesan — penyebab (`unknown`/`expired`/`revoked`/`reused`) hanya untuk log. `revoked_at` tidak tertimpa pencabutan kedua: ia stempel kejadian untuk forensik. 24 tes baru, 3 di antaranya terhadap MySQL sungguhan.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-02 | P3-04, P3-04a                     | 2/2 selesai                                                                 | `phase-1/P1-01-catalog-foundation` | Sesi tamu dengan sliding TTL; id dari cookie tidak pernah dipercaya tanpa baris database (anti-fixation), bentuk ULID diperiksa sebelum menyentuh query, dan middleware hanya terpasang di rute publik — `/health` yang dipanggil tiap 10 detik akan menulis ribuan baris sesi sehari. Ditemukan lewat probe aplikasi berjalan (bukan tes unit): pola rute middleware Nest **relatif terhadap prefix global**, jadi `api/v1/...` menjadi `/api/v1/api/v1/...` yang tidak pernah cocok — middleware mati tanpa satu galat pun. Lima perilaku diverifikasi live: cookie terbit httpOnly+Lax, dipakai ulang, fixation gagal, `/health` dan `/internal` bersih.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-10-02 | P3-05, P3-05a                     | 2/2 selesai                                                                 | `phase-1/P1-01-catalog-foundation` | Use case auth lengkap. Anti-enumerasi di dua lapis: satu pesan untuk email tak dikenal/password salah/akun nonaktif, dan jalur email-tak-ada membayar verifikasi Argon2 terhadap hash boneka SUNGGUHAN (hash karangan gagal diurai dan kembali cepat — justru mengalahkan pertahanannya; ini sempat terjadi dan ketahuan sebelum commit). Status nonaktif diperiksa SETELAH password. Refresh memuat ulang peran dari database, jadi pencabutan peran berlaku paling lambat satu umur access token. Email dinormalkan huruf kecil + trim saja — titik tidak dibuang. Diverifikasi hidup: register→login(email kapital)→refresh→logout→refresh ditolak.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-10-02 | P3-07, P3-07a                     | 2/2 selesai                                                                 | `phase-1/P1-01-catalog-foundation` | `AccessTokenMiddleware` mengisi `internalActor` dari Bearer token — rantai yang ditunggu guard gagal-tertutup P1-10 kini tersambung. Diverifikasi hidup empat status (401/403/200/401) dan audit promosi dengan aktor sungguhan. Urutan dikoreksi: P3-06 (G-1) menunggu P3-10 karena memindahkan kepemilikan tabel percakapan yang belum ada.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-02 | P3-08, P3-08a                     | 2/2 selesai                                                                 | `phase-1/P1-01-catalog-foundation` | Consent append-only: memberi/menolak/memberi-lagi = baris baru, mencabut = mengisi `revokedAt`; tidak ada method `delete` di port-nya. `policyVersion` dari config — klien yang bisa memilihnya bisa menyetujui versi yang tidak pernah ditampilkan kepadanya. Penolakan tercatat tanpa menghalangi apa pun. 10 tes integrasi vs MySQL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-10-02 | P3-09, P3-09a                     | 2/2 selesai                                                                 | `phase-1/P1-01-catalog-foundation` | Modul `policy` lahir lebih awal sebagai data murni (tetap leaf — pagar lint diverifikasi dengan berkas pelanggar): `ENTITLEMENTS` satu sumber untuk guard dan manfaat onboarding; enam manfaat adalah konsekuensi tabel, bukan konstanta. `REPORT_PDF` mengikuti default `docs/POLICY.md` (hanya advanced) — tanda `?` di SPEC §4.6 tetap milik OQ-15. Onboarding state: `pending` = ketiadaan baris, completion di-upsert (riwayat penutupan modal bukan bukti apa pun — beda dari consent). Satu bug jam ditemukan: `revoked_at` dari jam Node bisa kalah milidetik dari `granted_at` jam MySQL dan melanggar CHECK — kini kedua stempel dari jam database.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-02 | P3-10, P3-10a                     | 2/2 selesai                                                                 | `phase-1/P1-01-catalog-foundation` | Tabel `conversations` + `messages` (migration 0005); `requirement_snapshots` dan `conversation_events` SENGAJA belum — penulisnya Context Engine Fase 4, dan tabel tanpa penulis hanya menambah skema. Kepemilikan di lapisan application: milik orang lain = `NOT_FOUND` (konfirmasi keberadaan adalah informasi). `catalog_version_id` nullable dan belum diisi — dibekukan saat pipeline rekomendasi berjalan (Fase 7), bukan saat percakapan dibuat. `transferOwnership` satu transaksi sudah ada sebagai fondasi P3-06.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-10-02 | P3-06, P3-06a                     | 2/2 selesai                                                                 | `phase-1/P1-01-catalog-foundation` | G-1 dalam SATU transaksi lintas konteks (`MysqlGuestAccountLinker`) — satu-satunya tempat yang menulis dua konteks sekaligus, dan itulah titik temunya. `transferOwnership` di repo percakapan DIHAPUS: dua jalur ke operasi yang sama pasti menyimpang. Cookie yang disalin tidak memindahkan percakapan korban (sesi yang sudah tertaut = no-op). Dua perbaikan fixture/perkakas: fixture tes kini memakai POOL (koneksi tunggal membuat dua transaksi paralel saling menyelip sehingga `FOR UPDATE` tak pernah mengunci — tes balapan sempat gagal karena ini); dan `db-apply` kini berjurnal `_migrations` (tanpa itu jalan kedua mengulang CREATE TABLE dan gagal justru saat hanya butuh dua berkas baru).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-10-02 | P3-11, P3-11a                     | 2/2 selesai                                                                 | `phase-1/P1-01-catalog-foundation` | Seluruh endpoint Fase 3 hidup dan diverifikasi lewat HTTP sungguhan ujung-ke-ujung: onboarding pending → manfaat 6 item dari tabel → consent tamu v0-draft → percakapan tamu → riwayat tamu 403 → register membawa cookie tamu → `resumedConversationId` = percakapan tamunya → riwayat sebagai user 1 → `/auth/me` dengan entitlements → refresh via cookie → replay cookie lama 401 → cookie terbaru ikut 401 (family tercabut). `guestSessionId` untuk penautan diambil dari cookie terverifikasi, bukan body — body bisa menyebut sesi orang lain.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-10-02 | P3-12 (onboarding)                | layar 14 selesai; 01 ke Fase 4, login/register terhalang                    | `phase-1/P1-01-catalog-foundation` | Layar sungguhan pertama SNOUTY. Dari prototipe baru (sumber kebenaran #2 — menang atas berkas standalone & README): 860×580 kolom hero merah di desktop, bottom sheet 88vh < 720px. Semua warna lewat token (lint hex bersih), copy di satu modul (empat butir lokasi tak diparafrase), state & consent ke API Fase 3 yang sudah ada — `localStorage` hanya anti-kedip, server berwenang. Diverifikasi ujung-ke-ujung lewat proxy Next→API: state pending → benefits 6 item urut desain → complete 204 → state 'guest' → outcome ngawur 400. Next 16: `priority`→`preload`, impor web tanpa `.js`. OQ-41 dicatat (REPORT_PDF tak tampil di manfaat).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-02 | P3-13, checkpoint Fase 3          | docs selaras; menunggu review                                               | `phase-1/P1-01-catalog-foundation` | `SECURITY.md` §3 dan `PRIVACY.md` §3 kini menyebut yang terlaksana: Argon2id 19MiB/2/1, access JWT HS256 klaim minimum, refresh buram 256-bit per-family dengan cookie ber-path /api/v1/auth, sesi tamu anti-fixation, consent append-only dengan policy_version dari config, G-1 satu transaksi FOR UPDATE. `API_CONTRACTS.md` sudah akurat (resumedConversationId, /auth/me, /onboarding/benefits). Fase 3 11/13 — sisa P3-12b (Fase 4) & P3-12c (OQ-21/12/27).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-10-02 | P4-11, Fase 4 selesai             | layar 02 hidup; 12/12                                                       | `phase-1/P1-01-catalog-foundation` | Layar 02 konsultasi aktif dari prototipe baru, semua metrik lewat token. Klien SSE mem-parse bingkai `event:`/`data:` dari `ReadableStream` karena giliran chat ber-body (`EventSource` hanya GET). Panel kanan, meter 4 segmen, kartu klarifikasi berchip, dan indikator lima tahap semuanya digerakkan event sungguhan — tidak ada timer 620 ms seperti prototipe. Diverifikasi live: `/consultation` 200 dengan panel, meter, janji kebijakan utuh, composer; giliran chat lewat proxy web mengalirkan `message.start` → `LLM_UNAVAILABLE` → `message.end` (tanpa kunci, jalur degradasi jujur). Label tahap memang absen di SSR — ia muncul hanya saat event `stage` tiba.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-10-02 | P5 (seluruhnya)                   | Policy Engine + permukaan kebijakan; 8/8                                    | `phase-1/P1-01-catalog-foundation` | Lima kebijakan SPEC §5 jadi fungsi murni di modul leaf. Dua tes release blocker hijau: hasil kebijakan kompetitor **tidak punya field produk untuk diisi** (bukan sekadar tidak mengisinya), dan gerbang provenance disapu seluruh kombinasi status × provenance. Policy 1 diperiksa sebelum ekstraksi, Policy 5 atas state ter-merge — scope adalah sifat kebutuhan, bukan sifat kalimat. Diverifikasi dengan probe integrasi terhadap MySQL+Redis nyata: empat jalur kebijakan menghasilkan kartu benar, snapshot hanya tertulis saat ada ekstraksi.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-10-02 | P6 (seluruhnya)                   | Engineering Engine; 9/10                                                    | `phase-1/P1-01-catalog-foundation` | 14 aturan, registry yang menolak aturan tanpa tes, trace per eksekusi, orkestrator murni. Contoh kerja desain keluar persis: 8 titik air, 11 unit beban, jalur utama 1", BOM 5 baris. Tiga kali saya menolak mengisi lubang dengan karangan: baris lem PVC (tanpa formula) dibiarkan absen dengan tes penjaga, ambang ENG-002 mengikuti prototipe baru dan ditandai prioritas validasi tertinggi, batas 3 lantai tidak dibawa karena itu batas rendering. Seluruh keluaran `ASSUMED` — diuji — sampai OQ-06 menunjuk ahli domain. OQ-42 dicatat untuk konflik zod vs isolasi paket.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-10-02 | P7 (seluruhnya)                   | pipeline rekomendasi; 10/10                                                 | `phase-1/P1-01-catalog-foundation` | Rantai lengkap pertama kali hidup: kebutuhan → aturan teknik → katalog → rekomendasi tersimpan → dirender. Pemeriksa REC-1 menolak prosa ber-angka asing, retry sekali, lalu templat deterministik yang lulus pemeriksaannya sendiri. Menulis pemeriksa itu memunculkan bug nyata: pola ukuran saya membaca "2 1/2" sebagai "1/2", jadi ukuran asing bisa lolos. Verifikasi live juga menangkap bug packaging: `@snouty/engineering` menunjuk `src/index.ts` sehingga Node tak bisa memuatnya — paket itu kini punya build sendiri dan masuk `build:types`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-10-02 | P8 (sebagian)                     | laporan, riwayat, handoff; 8/10                                             | `phase-1/P1-01-catalog-foundation` | Laporan dirakit dari data tersimpan tanpa satu pun panggilan LLM, jadi dua kali perakitan identik. Alokasi nomor menyisipkan baris penghitung sebelum menguncinya — `FOR UPDATE` atas baris yang belum ada hanya mengunci gap, dan dua permintaan pertama bulan baru akan lolos berdua. **Verifikasi live menemukan lubang keamanan**: rute cetak internal berjalan tanpa gerbang (satu controller dengan rute publik, sementara guard dipasang per controller) dan mengembalikan nama + lokasi pelanggan kepada siapa pun yang menebak id. Diperbaiki dengan memisahkan controller, diverifikasi, dan dipaku 5 tes regresi.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-10-02 | P9 (seluruhnya)                   | Schematic Engine; 8/8                                                       | `phase-1/P1-01-catalog-foundation` | Topologi dibentuk deterministik dari snapshot dan **tidak disimpan** — itu yang menjamin gambar tak bisa bertentangan dengan tabel sistem dan BOM, dan membuat "bagaimana kalau" hanya perhitungan ulang. Invarian S-1 dijaga bentuk API: `SchematicView` menerima satu prop, jadi tak ada mode yang bisa menyembunyikan catatan wajib. Lapisan tes komponen (jsdom + Testing Library) lahir di sini setelah placeholder-nya lama terlewat; `fsModuleCache` memotong 150 detik menjadi 0,9. Verifikasi live memunculkan blok judul yang menampilkan ULID katalog alih-alih labelnya.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-02 | P11/P12 (inti)                    | redaksi, skor lead, HMAC, agregasi                                          | `phase-1/P1-01-catalog-foundation` | Seluruh bagian yang bisa benar tanpa jawaban OQ. Redaksi email — jalur paparan data pribadi terbesar — tidak bergantung pada satu pun jawaban, jadi ia dikerjakan lebih dulu. Skor lead deterministik supaya bisa diaudit dan disetel tanpa menyentuh prompt. Verifikasi HMAC menandatangani badan MENTAH dan menyertakan timestamp, menghindari dua jebakan yang biasanya berakhir dengan verifikasi yang dilemahkan. Janji "lokasi tidak memengaruhi rekomendasi" kini punya pagar lint yang sudah dibuktikan menolak impor terlarang.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-10-02 | P1-01b                            | FK katalog + cakupan tes migration                                          | `phase-1/P1-01-catalog-foundation` | Tujuh FK dalam konteks katalog akhirnya terpasang (migration 0011), dengan pemeriksa yatim lebih dulu karena MySQL menolak menambah FK bila yatim sudah ada. Di tengah pengerjaan muncul temuan yang lebih besar: daftar `UP` di `test-migration.mjs` tertinggal di 0005 sejak Fase 3, jadi enam migration terakhir **tidak pernah diuji skrip itu** — dan saya berulang kali melaporkan "44/44" seolah mencakup semuanya. Kini 50 pemeriksaan atas 11 migration, plus pagar yang membandingkan daftar dengan isi direktori.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-10-02 | OQ-40 + OQ-21 (minimal)           | worker PDF, transport, layar auth & back-office                             | `phase-1/P1-01-catalog-foundation` | Dua hal yang saya **salah anggap terhalang**. OQ-40: aturan proyek adalah mencatat usulan default lalu lanjut — itu yang saya lakukan untuk OQ-42/15/38, jadi OQ-40 mendapat perlakuan sama; kontraknya kini di `@snouty/jobs`, worker tak pernah mengimpor `apps/api` maupun memegang kredensial database, dan **PDF dua halaman A4 251 KB sungguhan** terbukti tercetak. OQ-21: skill desain memerintahkan membangun layar minimal yang belum didesain dan menandainya "needs design" — saya mengutipnya lalu melakukan sebaliknya. Tujuh rute baru kini hidup, semuanya bertanda MENUNGGU DESAIN tanpa prop yang bisa menyembunyikannya.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-10-02 | FE bisa diuji tangan              | adapter dev, tombol analisis, SolutionView tersambung                       | `phase-1/P1-01-catalog-foundation` | Pemilik minta mengecek frontend. Lubangnya bukan UI: seluruh engine selesai, tetapi **satu** langkah memakai LLM (ekstraksi), dan tanpa kunci giliran chat berhenti di `LLM_UNAVAILABLE` — jadi tidak ada yang bisa diklik. Adapter deterministik khusus pengembangan mengisi langkah itu, digerbang **dua** syarat (`NODE_ENV=development` **dan** `SNOUTY_FAKE_AI=1`) dan melempar bila dikonstruksi di luar development. Tombol "Analisis kebutuhan" kini aktif dan `SolutionView` tersambung. Uji tangan lewat proxy web menemukan bug nyata: blok judul skema menulis "3,50 M" tanpa "· ASUMSI" karena kondisinya memeriksa `source === 'default_applied'` padahal field yang belum pernah disentuh bernilai `null` — gambar berbohong tentang asal angkanya.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-10-05 | Pemulihan berkas + P7-11          | 224 berkas dipulihkan; prosa LLM tersambung; 623/623                        | `phase-1/P1-01-catalog-foundation` | Dua hal. **Pertama**, kerusakan berkas yang sempat saya salah diagnosis berkali-kali ternyata **eviction iCloud**: `Documents` ikut disinkronkan, dan 224 berkas berstatus `dataless` — metadata punya ukuran, `blocks=0`, baca mengembalikan nol byte. Saya pernah mengajukan teori iCloud lalu menariknya karena mencari nama `.icloud`, padahal macOS modern memakai flag `dataless` tanpa mengubah nama; verifikasi yang benar adalah `stat -f %Sf`. Materialisasi on-demand gagal, jadi pemulihan lewat objek git (`git restore`) — penulisan baru menghasilkan blok nyata. Yang **ter-commit selamat seluruhnya**; yang hilang hanya berkas belum ter-commit. Buktinya: typecheck 4,6 detik, sebelumnya 2029 detik. **Kedua**, P7-11: `ProseWriter` akhirnya tersambung ke LLM, dan tiga jalur REC-1 diverifikasi hidup lewat stub OpenRouter lokal — bukan hanya unit test. Celah audit yang muncul dari verifikasi itu dicatat sebagai OQ-44, tidak diputuskan sendiri.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-10-05 | Infrastruktur: repo keluar iCloud | `~/dev/snouty-draft`; 133 commit utuh; semua suite hijau                    | `phase-1/P1-01-catalog-foundation` | Penyebab kerusakan berkas yang berulang akhirnya jelas dan bisa ditunjuk: `~/Documents` disinkronkan iCloud Drive, **"Optimize Mac Storage" aktif**, dan disk 95% penuh (11 GiB bebas dari 228 GiB). iCloud meng-evict berkas yang jarang dipakai — dan repo pnpm dengan puluhan ribu berkas kecil adalah sasaran utamanya. Berkas ter-evict berstatus `dataless`: metadata punya ukuran, `blocks=0`, dan baca mengembalikan nol byte alih-alih mengunduh. Eviction terjadi **sambil saya bekerja** (32 berkas menjadi 129 dalam beberapa menit), jadi memulihkan satu per satu kalah cepat. Pemilik memilih memindahkan repo keluar dari `Documents`. `mv` tidak dipakai karena berkas dataless yang dipindah berisiko menjadi 0 byte; yang dipakai `git bundle` ke luar iCloud lalu clone dari bundle, sehingga seluruh isi ditulis ulang dari objek git. Bundle itu sendiri butuh ~4,5 menit karena setiap objek harus diunduh lebih dulu (~0,5 berkas/detik) — tetapi berhasil, dan `git bundle verify` menyatakan riwayatnya lengkap. Satu berkas perlu perhatian setelah clone: `apps/web/next-env.d.ts` ter-gitignore dan dibangkitkan Next, jadi typecheck web gagal sampai `next build` dijalankan sekali. Bukti perbaikannya terukur: `pnpm format:check` yang sebelumnya menggantung 10 menit kini selesai seketika, dan typecheck 2,9 detik. Salinan lama **tidak dihapus** — menunggu pemilik memastikan dulu. |
| 2026-10-08 | P16-11                            | pola kalimat hardcode → modul `understanding`; 825 tes hijau                | `phase-1/P1-01-catalog-foundation` | Pertanyaan pengguna kini dikenali dari CONTOH (data) lewat kemiripan vektor `bge-m3`, bukan regex/daftar frasa. Yang mengejutkan: golden set 110 kalimat paraphrase langsung 98% pada ambang pertama; dua kesalahan sisanya sesama kelas (sosial↔sosial, kebutuhan↔kebutuhan) — tidak mengubah routing. Ambang dinaikkan 0,62 → 0,65 setelah kalimat asing ("kemarin saya beli di toko sebelah") lolos sebagai lanjutan di 0,628: batas yang terlalu rendah lebih berbahaya daripada pesan yang jatuh ke model. Pagar bisnis tetap di kode dan ternyata itulah bagian yang paling banyak diuji: lanjutan yang menyebut produk baru bukan lanjutan, pesaing hanya bila pesan menyebut pesaing, "pabrik Pralon" tetap perusahaan.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-10-08 | P16-12 … P16-18, P13-06, P0e-05   | audit + perbaikan, unggah denah, jawaban enak dibaca, UI/UX semua perangkat | `phase-1/P1-01-catalog-foundation` | Jawaban kini prosa + daftar seperti asisten chat umum tanpa mengubah fakta; 12 temuan UX (scroll, animasi, locale, target sentuh, panel) ditutup; semua naik ke produksi.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
