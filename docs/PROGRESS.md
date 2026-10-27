# SNOUTY — Progress

Last updated: 2026-10-23 · Current phase: **29 — Back-office yang akhirnya bisa dipakai** · empat item selesai

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
      ragamnya. Teks bertanya-balik dihapus. Kalimatnya juga belum dikenali dari contoh, jadi jatuh ke
      model generatif (±25 detik): +6 contoh `product_range` di `data/understanding/intent.json`,
      +3 kasus golden; evaluasi intent 132/132. Tes diperbarui.
- [x] P16-23 "Bikinin dalam bentuk table" setelah daftar ragam produk menghasilkan tabel PVC vs HDPE
      (laporan pemilik 2026-10-08) — selesai. Bahan dibaca dari teks jawaban terakhir, dan daftar ragam
      menyebut HDPE dan PVC. Kini lanjutan ubah-bentuk tepat setelah daftar ragam menyajikan ulang
      RAGAM itu: tabel Keluarga | Jumlah produk | Contoh, atau satu kalimat bila diminta ringkas;
      kartu produk tidak diulang. Tes +1.
- [x] P16-25 Ragam produk dari SELURUH katalog + jenis per keluarga (laporan pemilik 2026-10-09:
      "HDPE di pralon jenisnya apa aja?" dijawab penjelasan bahan + satu produk) — selesai. Temuan
      lebih besar: ikhtisar "produk Pralon apa aja" membaca 50 produk pertama — 8 dari 24 keluarga,
      "HDPE 23 produk" padahal 1.327, PVC AW tidak muncul (katalog produksi 7.681 produk). Kini
      repository punya `familyCounts` (GROUP BY) dan `productNamesInFamily`; ikhtisar menampilkan
      seluruh keluarga dengan jumlah sebenarnya (keluarga sekata digabung: "PVC — AW, D, VP, …").
      Jenis dalam keluarga dibaca dari nama produk (`productTypesOf`: jenis sebelum ukuran pertama,
      tanpa PN dan warna; PN dikumpulkan): HDPE → PE 100 (PN-6 sampai PN-16), Telkom, Gas SDR-11, ….
      Tabel/ringkas atas ikhtisar maupun jenis. +8 contoh `product_range`, +2 golden; evaluasi intent
      135/135. Tes: product-types +10, pipeline diperbarui.
- [x] P16-26 Lanjutan atas jawaban jenis + keluhan (laporan pemilik 2026-10-09: "boleh" setelah
      "Mau saya rinci ukuran…?" dijawab penjelasan bahan; "dongo" dijawab ajakan bertanya) — selesai.
      "boleh" kini memberi rentang ukuran tiap jenis (dibaca dari nama produk, `sizesByType`), dan
      menyebut jenis ("yang telkom") menampilkan semua ukurannya; nama jenis dicocokkan dari katalog,
      bukan pola kalimat. Label baru `complaint` (data, 18 contoh): minta maaf dan minta diperjelas.
      Pertanyaan ragam tidak pernah masuk jalur spesifikasi. Evaluasi intent 138/138.
- [x] P16-27 Model lokal diganti qwen3.5:4b (permintaan pemilik 2026-10-09) — selesai. Diukur di
      server (Xeon E-2324G 4 core, 16 GB, tanpa GPU), model sudah termuat: ekstraksi 2,3 s, intent 0,8 s,
      paragraf 6 s — lebih cepat dan sama akurat dengan qwen2.5:7b (4,4 / 1,1 / 8,7 s); qwen3.5:9b
      4,8 / 1,6 / 10,2 s dan sekali salah label. qwen3.5 "berpikir" kecuali `reasoning_effort: none`
      (297 s vs 4,6 s untuk satu kalimat) → `LLM_REASONING_EFFORT`. qwen2.5:7b dihapus; qwen3.5:9b
      tetap di disk. Bagspace di-stop (bukan dihapus) atas permintaan pemilik. Catatan: model hanya
      cadangan pemahaman + ekstraksi; jawaban tetap dirangkai kode sampai perannya dinaikkan.
- [x] P16-28 Balasan percakapan ditulis model di atas DATA kasus (laporan pemilik 2026-10-09: "enaknya
      makan apa" → ajakan bertanya; "mana perhitungan teknisnya" atas kasus yang diserahkan → "dasar
      setiap angka ada di solusi"; "itung ulang, luasnya belum gw kasih" → giliran bisu). `caseFacts`:
      kebutuhan tercatat, yang kurang, status kasus (diserahkan/belum lengkap/lengkap), dan cara SNOUTY
      menghitung (unit beban, lantai, sumber; luas tidak menentukan ukuran). `LLM_CHAT_REPLY` dinyalakan
      (qwen3.5:4b ±5 s); angka di luar DATA tetap ditolak `ReplyWriter`. Teks tetap: di luar topik di
      tengah percakapan, alasan kasus diserahkan, dan penjaga giliran bisu. +8 contoh `out_of_scope`;
      evaluasi intent 139/139. Tes +5.
- [x] P16-29 Perencana giliran (permintaan pemilik 2026-10-09, setelah uji 13 pertanyaan: 7 meleset —
      "kalau yang pvc?", "paling kecil berapa?", "luasnya ngaruh ga?", "kamu siapa?") — selesai. Di tengah
      percakapan (atau untuk pesan yang tak dikenali contoh), model membaca 4 giliran terakhir + topik
      aktif + daftar keluarga katalog dan MEMILIH tindakan dari daftar tertutup (`product_types`,
      `product_sizes` + terkecil/terbesar, `product_overview`, `product_question`, `requirement`,
      `case_question`, `company`, `chat`); keluaran divalidasi skema, keluarga dicocokkan ke nama
      katalog. Kode menjalankannya: jenis/ukuran dari katalog, pertanyaan kasus dan obrolan ditulis
      model di atas DATA kasus + identitas SNOUTY (pagar angka), sisanya diteruskan ke jalur lama.
      Gagal/lambat → router contoh. Flag `LLM_TURN_PLANNER`. Tes +11. Uji ulang 13 pertanyaan: 11 nyambung
      (dari 6). Susulan: keluarga yang disebut pesan mengalahkan pilihan model ("kalau yang pvc?" →
      semua keluarga PVC, bukan FITTING PVC); jumlah sesudah kata benda terbaca ("kamar mandi 2",
      "dapur: 1").
- [x] P16-30 Model qwen3.5:9b + waktu tanggap (permintaan pemilik 2026-10-09) — semua tier ke 9b (satu
      model generatif di RAM). Diukur: qwen3.5 di Ollama TIDAK memakai ulang cache prompt, bahkan untuk
      awalan identik, dan prompt dievaluasi ±40 token/s (9b) — waktu tunggu didominasi panjang prompt,
      bukan jawaban. Maka: perencana dilewati untuk intent utuh yang yakin (skor ≥ 0,85: perusahaan,
      harga, pesaing, kebutuhan baru, ragam produk); riwayat ke model 4 giliran × ±250 karakter (dulu
      6 giliran utuh, termasuk daftar produk 1.000+ karakter); prompt perencana diringkas; DATA kasus
      hanya untuk pertanyaan kasus. Dua slot Ollama dicoba dan dikembalikan (tanpa manfaat). Tes +1.
- [x] P16-31 Urutan: kode yang terbukti dulu, perencana belakangan (laporan pemilik 2026-10-09: "makin
      dongo" — perencana di depan merusak "boleh"/"tampilin semua" setelah daftar jenis, dan pesan
      berisi data bangunan dijawab daftar produk). Kini: lanjutan tepat setelah daftar jenis/ragam
      langsung ke jalur produk (kode), pesan berisi data bangunan langsung ke router kebutuhan,
      perencana hanya untuk sisanya. Model: perencana qwen3.5:4b, balasan qwen3.5:9b, batas balasan
      60 s. Catatan operasi: server di-reboot untuk perawatan 08:09–08:12 (RAM 16 → 24 GB); giliran
      pemilik saat itu gagal karena server mati, bukan karena kode. Tes +2.
- [x] P16-32 Judul riwayat dari isi percakapan (laporan pemilik 2026-10-09: riwayat berisi "Hai",
      "Halo", "Hai") — selesai. `conversationTitle` (fungsi murni atas state + subjek tersimpan): "Rumah 3
      lantai", "Bangunan 2 lantai", "Produk HDPE", "PVC vs HDPE", "Tentang PT Pralon", label kasus teknis;
      dihitung ulang setelah setiap giliran, judul kalimat pertama hanya sementara. Percakapan lama
      diperbarui sekali dari snapshot terakhir (pasangan judul lama→baru dicatat). Tes +4.
- [x] P16-33 Fitting dan "jawab ulang" (laporan pemilik 2026-10-09: "fitting pvc kok sampe ada 4109,
      dibagi berapa kelas?" dijawab penjelasan bahan PVC; "jawab ulang" dibalas permintaan maaf yang
      sama) — selesai. Nama keluarga katalog yang tersurat di pesan ("fitting pvc" → FITTING PVC)
      mengalahkan kosakata (`familiesInMessage`); satu keluarga fitting dijawab rinciannya — jumlah
      jenis, rentang ukuran, seri menurut penanda di nama produk, jenis terbanyak. Keluhan menjawab
      ulang pertanyaan terakhir lewat perencana bila hasilnya berbeda dari yang dikeluhkan. Tes +1.
- [x] P16-34 Rilis lebih cepat (2026-10-09) — setiap rilis ±10 menit karena tahap worker dibangun di
      atas tahap build (Chromium diunduh ulang setiap ubahan kode) dan seluruh kode disalin sebelum
      `pnpm install`. Dockerfile disusun ulang: `deps` hanya manifest, `build-server` (api + worker) dan
      `build-web` terpisah, Chromium di image dasar sendiri. Diukur lokal setelah ubahan satu berkas API:
      web 2 s, worker 40 s, api 4 s.
- [x] P16-35 Pencarian fitting sadar-kategori (2026-10-09, audit akurasi) — "apa bedanya fitting pvc dan
      fitting hdpe?" dijawab perbandingan PIPA dengan contoh produk pipa: kosakata hanya membaca bahan, lalu
      contoh diambil dengan pencarian teks bebas tanpa filter. Kini nama keluarga katalog di pesan (atau
      subjek aktif untuk lanjutan "kalau ukuran 110 mm?") menjadi lingkup terstruktur: filter `family`,
      jenis fitting → `categoryIncludes` pada kategori resmi, ukuran → tabel ukuran. Tidak ada hasil →
      dikatakan, tidak diganti kategori lain. Perbandingan memisahkan "secara umum" (cara sambung bahan)
      dari data katalog (jumlah SKU, jenis terbanyak). Ikhtisar katalog menyebut cara hitung (per SKU
      aktif). Tes regresi `catalog-scope.spec.ts` (8 kasus) dan rute planner.
- [x] P16-36 Gedung bertingkat dihitung (2026-10-09, permintaan pemilik "tetep itung") — "gedung 100 x
      30, 12 lantai" dulu berhenti di kartu "perlu dihitung tim teknis" (Policy 5, > 4 lantai) dan
      kalkulator `multistorey_building_water` masih `pending`. Kini gedung > 4 lantai masuk kasus
      gedung bertingkat; "100 x 30" tercatat sebagai luas per lantai, jumlah penghuni ditanya bila
      luas tidak ada; "Susun rekomendasi" menghitung kebutuhan harian, jam/menit puncak, zona tekanan,
      booster, pipa transfer + titik kerja pompa, dan riser (Kelompok I ENG-501…504 + Kelompok F),
      lalu mencocokkan transfer, riser, dan fitting ke master produk. Asumsi baru OQ-57. Judul web
      jenis bangunan tak diketahui → "Bangunan N lantai", bukan "Rumah".
- [x] P16-37 Percakapan gedung bertingkat (2026-10-09, laporan pemilik "lu belum nanya kamar mandi",
      "kasih gw pilihan") — kamar mandi/toilet dan wastafel PER LANTAI ditanya dan dibaca ("6 toilet per
      lantai"); pipa induk tiap lantai + sambungan titik dihitung (ENG-505 + ENG-001/003/005) dan
      dicocokkan ke katalog. Pertanyaan angka tampil di kartu dengan pilihan cepat (data registry
      `suggestions`; tinggi bangunan dihitung dari jumlah lantai). Pesan lanjutan tanpa data baru
      dijawab di atas DATA kasus teknis, bukan template yang sama diulang. DATA "cara menghitung" tidak
      lagi menyebut kolam/drainase dihitung tim teknis.
- [x] P16-38 Pilihan tampil di kasus yang sudah bisa dihitung (2026-10-09, uji ulang percakapan pemilik) —
      kasus gedung dengan lantai + luas dianggap lengkap, jadi hanya kartu Susun rekomendasi yang dikirim
      dan pertanyaan berpilihan tidak pernah tampil; model lalu menanyakannya ulang dalam kalimat. Kini
      kartu pertanyaan berpilihan tampil di samping Susun rekomendasi (juga setelah jawaban kartu,
      `cards` di respons jawaban), kalimat pengantar menunjuk kartunya, dan seruan pembuka model
      ("Benar sekali!") dibuang bila balasan berdasar DATA.
- [x] P16-39 Skema untuk semua kasus (2026-10-09, permintaan pemilik "ai ini bisa generate skemanya")
      — sebelumnya hanya rumah yang punya skema; kasus teknis dan irigasi menampilkan "Skema belum
      tersedia". Kini kolam, transfer pompa, sumur, cluster, irigasi, drainase, air hujan,
      gorong-gorong, dan gedung bertingkat punya skema aliran yang dibentuk dari hasil hitungannya
      (docs/SCHEMATIC_ENGINE.md §9a), tampil di tab Skema dan halaman /schematic.
- [x] P16-40 Balasan lanjutan kasus teknis tanpa jeda model (2026-10-09, "balasan 30 detik") — benchmark
      prompt produksi di server: 9B 20–25 s (memangkas prompt ~40 % tidak mempercepat), 4B 12–14 s
      dengan kesalahan teknis; model tidak diganti. Pesan lanjutan tanpa data baru yang bukan
      pertanyaan penjelasan (protes, "kasih pilihan", "lanjut") kini dijawab langsung dari daftar
      pertanyaan kasus — instan; pertanyaan penjelasan (maksud konsep/kegunaan/saran/…) tetap ke 9B di
      atas DATA kasus. "Data baru" hanya parameter milik kasus itu.
- [x] P16-41 Sesi akun yang kedaluwarsa (2026-10-09, "analyze 404") — access token berumur 15 menit; token
      kedaluwarsa dulu diturunkan diam-diam menjadi tamu, sehingga "Susun rekomendasi" pada percakapan
      milik akun menjawab 404 dan web tidak memperbarui sesi. Kini token yang dikirim tetapi tidak sah
      dijawab 401 di rute publik (`RejectStaleTokenMiddleware`; bukan /internal yang memakai token worker,
      bukan /auth), dan web memakai `apiFetch`: 401 → pulihkan sesi dari cookie refresh → ulang sekali.
- [x] P16-42 Asumsi tanpa kode aturan (2026-10-09, "gw gak paham rumus itu") — baris pertama "Asumsi yang
      digunakan" di gedung, pompa/sumur, cluster, drainase, kolam, dan irigasi dulu berbunyi "Rumus (ENG-501,
      ENG-502, …) …" — label internal di UI. Kini "Cara hitungnya: …" dalam bahasa teknisi (dari apa angkanya
      keluar, apa menentukan apa), tanpa tombol Perbaiki (`fieldPath` kosong = penjelasan, bukan asumsi).
- [x] P16-43 Detail teknis yang bisa dibaca (2026-10-09, "gas yang detail teknis juga") — panel "Tampilkan detail
      teknis" dulu mengulang alasan baris dalam paragraf padat berjargon ("gradien", "head", titik desimal). Kini
      tiap jalur tampil sebagai langkah hitung bernomor (judul langkah dari engine `ruleStepTitle` + penjelasan
      aturan, `SystemLine.steps`), angka berformat Indonesia, tanpa kode aturan; penjelasan aturan bertekanan
      ditulis ulang dengan bahasa teknisi (kehilangan tekanan, tinggi angkat, pompa yang dicari).
- [x] P16-44 Volume tangki gedung (2026-10-09, dipilih pemilik) — gedung bertingkat kini menghitung tangki bawah
      (kebutuhan 1 hari) dan tangki atap ((debit menit puncak − debit pompa transfer) × 30 menit) lewat ENG-506;
      tampil di ringkasan, baris sistem "Tangki bawah dan atap", langkah hitung, dan skema. Contoh 12 lantai
      100 × 30: 540 m³ dan 27 m³. Asumsi baru di OQ-57.
- [x] P16-45 Ganti asumsi lalu hitung ulang (2026-10-09, "kalau gw perbaiki asumsi ini SNOUTY ngitung kembali?")
      — dulu "Perbaiki asumsi ini" pada kasus teknis hanya membuka chat dan nilai baku registry (150 l/orang,
      10 jam, faktor puncak, 4 bar per zona, tangki 1 hari, kecepatan, kekasaran, …) tidak bisa diganti. Kini
      setiap kalkulator menerima nilai pengganti per ID asumsi (`assumptionReader`), disimpan di kasus
      (`assumptionOverrides`) lewat `PUT /conversations/:id/assumptions` dengan hitung coba; baris asumsi
      membawa nilai + satuan dan bisa diubah di tempat (angka → Hitung ulang → solusi baru di tab yang sama;
      "Kembalikan nilai awal" untuk nilai dari pengguna). Nilai dari pengguna tidak lagi ditandai asumsi.
      Editor di tempat belum punya desain Claude Design — memakai gaya kartu solusi yang ada.
- [x] P16-46 FAQ pemilik: pengetahuan bersumber sebagai DATA (2026-10-09) — uji live 18 pertanyaan dari daftar
      pemilik: ±3 terjawab. Kini: 16 topik pengetahuan baru dengan contoh (VP/VU, injection fitting TS/DV, jacking,
      conduit HIC, pipa gas MDPE, ketahanan kimia, umur pakai, solvent cement, ukuran inci→mm, panjang batang,
      jumlah batang, tekanan kerja, PIPPO, SNI, jenis ujung, kesalahan umum); fakta bersumber di
      `data/knowledge/pipe-facts.json` (Snouty Product Knowledge Master + katalog; angka berstatus "perlu validasi"
      tidak dibawa) dengan data katalog yang dihitung saat itu (jumlah, rentang ukuran, panjang batang, kelas PN/SDR,
      jumlah batang dari panjang jalur); topik bersumber didahulukan dari daftar katalog dan dari ekstraksi
      kebutuhan; nilai "N bar" membawa kelas tekanan katalog; jendela multi-topik 0,12 → 0,04 (topik tempelan
      hilang); pesaing "ruchika". Eval golden: intent 139/139, +15 kasus topik. Daftar pemilik disimpan di
      `apps/api/evals/owner-faq.json`.
- [x] P16-47 Mode hemat / kualitas + perbaikan FAQ putaran 2 (2026-10-09) — saklar "Hemat | Kualitas" di kotak ketik
      (diingat per browser; `mode` di POST pesan): hemat = jawaban pengetahuan langsung dari DATA, kualitas = model
      merangkai jawaban untuk pertanyaan itu di atas DATA yang sama (pagar angka tetap). Uji live 52 pertanyaan
      pemilik → perbaikan: pemilih langkah dilewati untuk topik bersumber (jacking, suhu, PIPPO), topik berfakta
      didahulukan dan maks. dua, perbandingan bahan hanya untuk pertanyaan bertekanan, topik baru "sambungan rumah"
      dan "aplikasi" (jenis produk HDPE dari katalog), fakta uPVC (lini produk), lingkup fitting dari jenis + bahan
      ("elbow 90 buat uPVC 3/4" → FITTING PVC).
- [x] P16-48 Laporan bisa dibuat pengguna terdaftar (2026-10-09, "user belum bisa melihat hasil report") — tabel
      `reports` produksi kosong: `REPORT_PDF` hanya untuk tier `advanced`, seluruh akun `registered`. Kini
      `registered` + `advanced` (OQ-41); pesan untuk tamu mengajak masuk/daftar; kop laporan memakai nama versi
      katalog (bukan ID) dan jenis instalasi sesuai kasus (gedung bertingkat, kolam, irigasi, air bersih rumah).
- [x] P16-49 Audit akurasi teknik (brief "SNOUTY Engineering Accuracy", docs/ENGINEERING_AUDIT.md) —
      diameter dalam dari OD resmi − tebal dinding (bukan 6" = 150 mm); debit tidak dibulatkan di tengah
      rantai (pompa 300 m³/jam, bukan 299,99); daya hidraulik/poros dipisah, daya motor tidak diklaim; zona
      tekanan dari elevasi tiap lantai dan batas min/maks dengan tabel lantai/tekanan; tangki atap + suku
      siklus pompa, asumsi pasokan tertulis; BOM dari panjang batang produk katalog terpilih, panjang
      bersih vs jumlah beli, pipa per lantai tidak lagi dari √luas × lantai (360 batang); data yang
      bertentangan ditanya balik (bukan "layanan tidak tersedia"); durasi tahap analisis di log;
      regresi 5 000 m² × 20 lantai × 90 m dengan hitungan acuan independen. Sisa → OQ-58.
- [x] P16-50 Audit anti-halusinasi katalog (docs/ENGINEERING_AUDIT.md §6) — produk dihitung per nama
      kanonik (salinan ERP "(copy)", koma/titik desimal, SKU bernama sama dihitung sekali) di SQL dan di
      daftar nama, jumlah SKU disebut bila berbeda; kelas PN/SDR hanya yang tertulis, satu penulisan, urut;
      perbandingan umum HDPE/uPVC setiap dua bahan disebut, kelas tidak ditempel ke pipa tanam; pagar
      keluaran model memeriksa penanda teknis dan angka bersatuan. Tes MySQL sungguhan untuk hitungan. OQ-59.
- [x] P16-51 Pembuangan rumah dihitung (2026-10-12, "kok ngga mau ngitung … malah nyuruh ngubungin org
      teknis") — Policy 5 tidak lagi mengoper "Pembuangan"/"Keduanya" ke tim teknis; Kelompok J (ENG-601 beban
      buangan, ENG-602 ukuran jalur + ventilasi) menghitung jalur air kotor ke septic tank dan air bekas ke
      saluran/resapan, digabung ke solusi air bersih rumah atau berdiri sendiri; produk PVC D dicocokkan.
- [x] P16-52 Hitungan air bersih rumah dikoreksi + ukuran rumah ditanyakan (2026-10-12, "kurang parameter luas
      … koreksi itungannya") — ambang prototipe dan material karangan diganti: debit puncak kurva Hunter, jalur dan
      beda tinggi dari ukuran rumah/lantai/sumber, ukuran pipa dari kecepatan dan kehilangan tekanan, tekanan toren
      atap / kebutuhan tekanan PDAM / titik kerja pompa; kamar mandi = 2 titik; ukuran rumah, dapur, wastafel
      ditanya di samping Susun rekomendasi dan dibaca dari teks ("rumah 8x15", "luas 120 m2").
- [x] P16-53 Nomor HP wajib saat daftar (2026-10-12, "pastiin user nyantumin no hp yang bisa di hubungin") —
      migration 0022 `users.phone` (NULL untuk akun lama), nomor seluler Indonesia dinormalkan +628…, kolom
      "Nomor HP (WhatsApp)" di form daftar dengan pesan galat sendiri.
- [x] P16-56 Temuan laporan SNTY-2026-10-0002 (docs/ENGINEERING_AUDIT.md §7) — laporan dicetak dari rekomendasi
      versi lama; aturan mati ENG-002/009/011 dihapus; cabang per lantai (ENG-003 v2); skema memakai cabang engine,
      tee bila ukuran sama; BOM satu baris per SKU; matcher tanpa reducer berujung sama / fitting pengganti; stempel
      versi aturan di laporan, tanda versi lama + "Susun ulang" (laporan baru) dan "Hitung ulang" di layar solusi.
- [x] P16-57 Desain ulang PDF laporan (permintaan pemilik 2026-10-12, mengikuti templat rapor dengan warna SNOUTY):
      sampul gelap berlogo Pralon + maskot SNOUTY, empat bagian (ringkasan berupa kotak ukuran, rekomendasi sistem,
      estimasi material, dasar perhitungan + pengesahan), footer "Halaman x dari n" dari Chromium; dasar perhitungan
      memakai judul langkah, bukan kode aturan; penjelasan sebaran lantai tanpa kalimat tentang "sistem".
- [x] P16-58 Masukan pemilik atas PDF P16-57: sampul merah-putih (tanpa latar hitam), ringkasan tanpa kotak warna —
      tabel ukuran per jalur + tabel material & jumlah; produk Pralon terpilih tetap didaftar dengan jumlah
      "Menyusul" bila panjang jalur/ukuran bangunan belum ada (keputusan pemilik 2026-10-12, juga di pratinjau web);
      dasar perhitungan berupa rumus singkat berangka dari trace (`stepFormula`, engine); tanpa harga, bagian estimasi
      material tidak dicetak; judul ENG-102 jadi "Ukuran pipa dari debit".
- [x] P16-59 Skema instalasi di laporan ("skema denahnya mana?"): topologi dari jalur endpoint skema web dibekukan ke
      payload saat laporan dibuat, digambar sebagai SVG di API dengan metrik dan warna layar skema (bangunan per
      lantai atau skema aliran), kedua catatan wajib S-1 apa adanya; payload lama tanpa bagian ini.
- [x] P16-60 Temuan laporan SNTY-2026-10-0007 ("kok banyak yang menyusul?"): dengan ukuran rumah, cabang,
      sambungan, tee, air kotor, air bekas, dan ventilasi ikut dihitung (ENG-704, ENG-603, asumsi
      HOUSE_FIXTURE_DROP_1_5M / HOUSE_VENT_ABOVE_ROOF_1M, OQ-60 — rumus baku disetujui pemilik); fitting dipilih
      menurut fungsi (tee / Y) dan ukuran utama di nama — tidak lagi "Cap" atau "Long TY 10" x 4""; jumlah batang
      hanya dari produk yang ukurannya memang ada.
- [x] P16-61 Ukuran diisi sendiri, tanah dan bangunan dibedakan (2026-10-12): kartu pertanyaan berisi isian angka
      bangunan (wajib) dan tanah (opsional), panel kebutuhan punya baris "Ukuran bangunan" dan "Ukuran tanah"
      yang diketik bebas; teks chat "tanah 10x20" / "LT/LB" dibaca ke bagian yang benar; ukuran digabung per
      kelompok; halaman dari ukuran tanah masuk jalur PDAM/pompa dan buangan (ENG-705, ENG-702 v2, ENG-603 v2);
      luas bangunan = total semua lantai.
- [x] P16-62 Ponsel setelah solusi siap (laporan pemilik 2026-10-12): tiga lapis tombol di atas (header, baris "Buat
      laporan", baris "Simpan hasil konsultasi") diganti bilah bawah "Simpan" + "Buat laporan"; di layar chat hanya
      baris tipis "Lihat solusi"; label kelompok isian ukuran di barisnya sendiri.
- [x] P16-63 Pipa pengisi toren atap dihitung (ENG-706, asumsi ¾" TANK_FILL_PIPE_3_4IN): baris sistem dan baris
      material; layar solusi ponsel satu baris (panah kembali ringkas + tab).
- [x] P16-64 Temuan laporan 0009 — A: pembuangan bangunan bertingkat dicek terhadap cabang mendatar per lantai dan
      pipa tegak (ENG-604, IPC 2021 Tabel 710.1(2), ENG-602 v2); masjid 0009 air bekas 2" → 2½"; rumah 0002 tetap 2";
      nomor pasal standar tidak lagi diubah menjadi desimal berkoma.
- [x] P16-65 Temuan laporan 0009 — B: ukuran cabang air bersih dari isi tiap cabang (ENG-707 + ENG-102 per beban),
      bukan rata-rata; baris sistem dan material per ukuran cabang; 0009: cabang 2 KM 1", cabang 4 wastafel ½";
      rumah 0002: lantai 2 1", lantai 1 ¾".
- [x] P16-66 Temuan laporan 0009 — C: fitting hanya dipilih bila kedua ukurannya persis sama dengan jalur yang disambung
      (tanpa ukuran terdekat; "Y 4" × 2½"" tidak lagi untuk jalur 4"); sambungan cabang per ukuran cabang: tee sama sisi,
      tee reduksi bila ada di katalog, selain itu tee + reducer; fitting tanpa jumlah tercetak "– pcs" dengan keterangan
      sendiri di PDF dan pratinjau.
- [x] P16-67 Temuan laporan 0009 — D: air bekas juga turun dari lantai atas (ENG-603 v3); "Ada N produk Pralon" = jumlah
      baris material yang tercetak; batas kecepatan satu sumber (ENG-010 v2 dari registry: 0,6–2 m/s, rencana 1,5);
      teks asumsi/alasan tanpa "rumah" untuk bangunan lain; PDF tanpa halaman kosong di akhir (`section.page:last-of-type`).
- [x] P16-68 Temuan laporan 0009 — E: data yang disebut pengguna dicetak "DISEBUT PENGGUNA" (bukan TERVERIFIKASI) di tabel
      kebutuhan laporan, dengan legendanya; arti VERIFIED di kode tidak diubah (pemetaan saat render, berlaku juga untuk
      laporan lama yang dicetak ulang). Di layar data pengguna tidak pernah diberi tag TERVERIFIKASI.
- [x] P16-70 TC-H-01: ENG-001 v3 hanya menghitung titik air (kalimat "unit beban … bobot" dihapus; beban suplai
      satu-satunya WSFU ENG-701); ENG-006 (cadangan 10–15 % tanpa efek) dihapus. Dipertahankan: ENG-001/004/005/008/
      010/012/013 (dijalankan jalur rumah), ENG-003 (gedung bertingkat), ENG-007/014 (aturan di API, ID-nya catatan
      validasi).
- [x] P16-71 TC-H-02 / TC-G-01: tinggi tiap lantai dibaca dari kalimat (parser nilai bersatuan "tinggi … lantai N m" /
      "floor height N m"; "plafon" sengaja tidak dibaca); nilai di luar 2–10 m disimpan sebagai kata pengguna tetapi
      menahan kelengkapan → kartu "Berapa tinggi tiap lantai?" berisian angka, analisis menolak (VALIDATION_FAILED);
      4 m dipakai tanpa asumsi 3,5 m. Kartu kamar mandi / wastafel ikut punya isian "lebih dari …".
- [x] P16-72 TC-H-03 / TC-H-04: "keran/tempat wudhu" dipetakan ke wastafel lewat kamus kata benda parser (seperti
      "washtafel", "bak cuci"); field wastafel ditandai WUDHU_TAP_AS_BASIN sehingga trace ENG-001 menyebut "keran wudhu
      (dihitung sebagai wastafel)" dan asumsinya tampil (sementara, OQ-61); kartu wastafel/kamar mandi punya isian angka.
- [x] P16-73 TC-H-05 / TC-H-06: satu daftar SKU (`skuLines` di shared-types) untuk tab Produk, material, ringkasan,
      `stats.productCount`, dan item menyusul di laporan; produk membawa nama katalog dan peruntukan dua bahasa ("Pipa utama",
      "Air kotor", "Ventilasi air bekas"); pipa ventilasi dan pengisi toren masuk daftar produk; tab Produk satu kartu
      per SKU dengan peruntukannya; fitting tanpa jumlah tampil di material sebagai "– pcs" dengan keterangannya.
- [x] P16-74 TC-H-07: penjelasan baris pembuangan hanya untuk jalurnya sendiri — beban per jalur (`drainLoadSentence`),
      cabang/stack (ENG-604) hanya disebut bila memang menentukan ukuran; air kotor menyebut kloset sebagai penentu 4".
      Catatan: `VERIFIED` di state hanya dibaca laporan (dicetak "DISEBUT PENGGUNA"), panel web (hanya membedakan
      ASUMSI) dan engineering-state (diketahui/asumsi).
- [x] P16-75 Temuan laporan SNTY-2026-10-0010 (dibuat 08.37 dari solusi 05.43): laporan BARU dari rekomendasi berversi
      aturan lama kini disusun ulang dulu dengan aturan terbaru (laporan lama tidak disentuh); `ulid()` monoton dalam
      satu milidetik sehingga langkah dasar perhitungan tidak lagi tercetak acak; rumus mengikuti versi trace (ENG-603
      v1/v2 tidak ditulis dengan rumus v3).
- [x] P16-76 Kelompok hitung tempat ibadah (Kelompok L, ENG-801…803; laporan pemilik "masih nganggep kran itu
      wastafel, pdhl masjid"): masjid/musala → `place_of_worship`; keran wudhu, tempat wudhu, dan urinoir menjadi field
      sendiri (bukan wastafel; asumsi WUDHU_TAP_AS_BASIN dihapus). Air bersih: toilet umum lewat Hunter (IPC E103.3(2)
      public: kloset 5, keran/wastafel 1,5, urinoir 3) + keran wudhu 0,1 l/s semua serentak; kamar mandi = kloset + keran;
      tanpa dapur kecuali disebut. Keran dibagi per tempat wudhu (deret), pipa pembagi tiap deret dari debitnya, panjang =
      keran × 0,8 m. Pembuangan: satu talang per deret, 2 DFU/gpm (IPC 709.3) → ukuran dari IPC 710.1(2), masuk air
      bekas; urinoir 4 DFU ke air kotor. Skema: deret wudhu dan urinoir di lantai dasar. ENG-001 v4, ENG-601 v2,
      ENG-707 v2. Pertanyaan penyempurna khusus tempat ibadah (keran wudhu, tempat wudhu, urinoir).
- [x] P16-77 Asumsi angka di hitungan bangunan (rumah, tempat ibadah) bisa diubah setelah hitungan selesai, seperti kasus
      teknis (pemilik 2026-10-12: jarak keran wudhu default 0,8 m tapi bisa di-adjust). Nilai pengganti disimpan di
      `RequirementState.assumptionOverrides`, diuji dengan hitung coba, lalu solusi dihitung ulang.
- [x] P16-78 Sekolah dan klinik (`public_building`) memakai hitungan toilet umum yang sama dengan tempat ibadah, tanpa
      wudhu (keputusan pemilik 2026-10-12); jenis bangunan yang tersurat di pesan menang atas tebakan model. Volume toren
      masjid sengaja belum dihitung (keputusan pemilik).
- [x] P16-79 Susun rekomendasi selalu menghitung ulang di server (`/analyze`, tidak ada solusi di localStorage);
      solusi di memori halaman kini dibuang begitu data kebutuhan berubah lewat chat, sehingga "Lihat solusi" tidak
      menampilkan hasil dari data lama (pemilik 2026-10-12).
- [x] P16-80 Tes FAQ 6 — batas pesan: pesan menyebut lama menunggu (±N menit); tamu ditawari daftar akun dengan batas
      akun terdaftar dari tabel kebijakan (60/jam) dan panel daftar/masuk. Angka batas tidak diubah: tamu 20 pesan/jam per
      sesi tamu (cookie), terdaftar 60, lanjutan 180; jendela tetap 1 jam di Redis.
- [x] P16-81 Tes FAQ 5 — pertanyaan merek pesaing, keputusan pemilik (b): merek lain tidak dinilai; jawabannya ragam
      produk, standar/sertifikasi, dan kontrol mutu Pralon dari profil perusahaan terverifikasi, lalu tombol tim teknis.
      Kartu kriteria netral (masih dipakai kebijakan lain) kini berlabel per butir.
- [x] P16-82 Tes FAQ 1–4 (pertanyaan sales DE/MA): golden eval jawaban baru (19 kasus, skrip faq-eval); fakta punya
      subjek (fakta HDPE untuk HDPE, uPVC untuk uPVC), kalimat pembuka per bahan ("Tidak — PVC tidak menggantikan PPR"),
      dan penanda data yang belum ada (tombol tim teknis + log "data pengetahuan belum ada"); blok perbandingan bahan hanya
      untuk pertanyaan perbandingan; angka tekanan di pertanyaan memilih kelas HDPE di atas tekanan tertinggi (dengan
      selisihnya) dan PVC dirujuk ke tim teknis; topik baru "fungsi vs bahan" dan "jenis pipa baru", contoh fitting AW/D;
      kasus perumahan + angka ("50 unit") dihitung sebagai kasus cluster; peringkat topik ikut di probe pemahaman.
- [ ] P16-69 Temuan laporan 0009 — F: tempat ibadah (P16-76) dan sekolah/klinik (P16-78) selesai; pengesahan nilai oleh
      ahli Pralon masih → OQ-61. Dampak aturan A pada laporan lama: dari 6 laporan berpembuangan, hanya 0009 yang
      berubah (air bekas 2" → 2½").
- [ ] P16-02b Sisa OQ-54: visi/misi/distribusi, Certificate Register, profil korporat resmi,
      Product Specification resmi (angka)
- [ ] ✋ CHECKPOINT — reviewed by owner

## Phase 17 — Layar solusi & laporan v2 (DD-01)

Keputusan pemilik 2026-10-13: `design-input/DESIGN_DECISIONS.md` DD-01, mockup
`design-input/mockups/2026-10-13-solusi-laporan-v2.html`. Layar dan PDF memakai struktur yang sama.

- [x] P17-01 BOQ satu sumber (`boqFrom` di shared-types): baris material membawa sistem (air bersih / air kotor /
      air bekas), peruntukan, dan panjang bersih; tab Produk diturunkan dari BOQ (nama katalog, jumlah, nomor baris
      BOQ), dikelompokkan per sistem; produk tanpa jumlah tetap jadi baris BOQ tanpa angka ("Menunggu ukuran
      bangunan" / "Dihitung saat pemasangan"); dasar perhitungan pindah ke tabel terpisah di bawah BOQ (bentuk
      sederhana; P17-02 merapikannya). Kolom Kelas belum ada — kelas ikut nama produk.
- [x] P17-02 Dasar perhitungan dipisah dari BOQ: tabel jumlah (No · Cara hitung · Hitungan · Hasil · Status) dari
      `BomItem.calc` yang ditulis kode penghitungnya (bukan dipecah dari kalimat; baris lama memakai kalimat utuh) +
      tabel alasan ukuran per jalur dari `systemLines`
- [x] P17-03 Tabel asumsi terklasifikasi (Bangunan · Isi ruangan · Sumber air · Panjang jalur · Teknik), kolom
      Asumsi · Nilai · Asal · Ubah; kategori diturunkan dari registry (asumsi → parameter → domain, `assumptionCategory`
      di engineering), bukan daftar; ubah-nilai di tempat tetap
- [x] P17-04 (+ tata letak 2026-10-13: gambar bangunan di samping judul, kebutuhan menempel, alur air kartu sendiri)
      Pustaka ilustrasi `@snouty/ui/illustrations` (85 gambar kebutuhan/pilihan + 8 gambar produk, dibuat
      dari mockup oleh `scripts/gen-illustrations.cjs`, warna token → terang/gelap) + Ringkasan bergambar: kartu
      kebutuhan dan alur air dari `Recommendation.needs` (`needsFrom`, hasil engine; migration 0023 kolom `needs`).
      Rekomendasi lama tanpa `needs` tetap tampil seperti sebelumnya
- [x] P17-05 Kartu pertanyaan bergambar: pilihan sumber air, jenis instalasi, irigasi, dan semua parameter enum
      registry (proyek, bangunan, tujuan, cairan, lokasi/cara pasang, kontur, bentuk lahan, metode irigasi, tanaman,
      pemakaian, buangan air hujan, beban jalan, tanah) tampil sebagai ubin bergambar; peta = data (id pertanyaan +
      nilai protokol), dites cocok penuh dengan registry. Pilihan angka dan ya/tidak tetap chip teks. Bahan pipa
      menunggu gambar produk (P17-06)
- [x] P17-06 Gambar kartu produk: foto pralon.com (disimpan di `apps/web/public/products`, sumber
      `data/catalog/images-pralon-com/`) untuk PVC AW, PVC VP, Pipa Jacking; keluarga lain gambar jenis SNOUTY dari
      kategori katalog (tee/tee reduksi, elbow/bend, sok, dop, Y, clean out; pipa putih/abu); kategori tanpa gambar
      jenis tidak diberi gambar. Produk terpilih membawa `family` + `category`. Sisa: foto D/VU/fitting dari Pralon
      → OQ-62; tautan "Lihat di pralon.com" belum (kartu = tombol drawer)
- [x] P17-07 Denah (tab "Skema" → "Denah"): potongan instalasi (toren/sumber, pompa, pipa utama, cabang per lantai
      dengan alat dan ukurannya, pembuangan + ventilasi + septic, ukuran lantai dan bangunan) dan denah jalur per lantai
      berskala ukuran bangunan; SVG dari `@snouty/ui/installation-drawing` untuk layar dan halaman Denah di PDF. Data
      cabang per lantai (ENG-707) dan ukuran ventilasi ikut disimpan di kebutuhan. Letak ruang tidak dikarang
- [x] P17-08 "Coba ubah" di tab Denah: tombol bergambar (toren dinaikkan satu lantai, tambah 1 kamar mandi, PDAM,
      toren bawah + pompa, toren atap) dan tabel Sekarang ↔ skenario dengan perubahan ditandai. `GET
/recommendations/:id/scenarios` menghitung ulang engine dari kebutuhan tersimpan — tanpa menyimpan, tanpa LLM
- [x] P17-09 Laporan PDF v2: ringkasan bergambar, BOQ per sistem dengan gambar produk, dasar perhitungan & asumsi
      berkategori, lampiran produk Pralon bergambar; payload membekukan `products`/`needs`/`outletCount`; modul
      gambar dipindah ke `@snouty/ui` (dibangun ke `dist` untuk API) supaya layar dan PDF memakai logika yang sama.
      Gambar pipa SNOUTY tidak lagi bertuliskan nomor standar (tulisan karangan dari mockup dihapus)
- [x] P17-10 Audit teks: koma desimal di semua penjelasan aturan berbahasa Indonesia (`localized` di engine;
      nomor pasal seperti "IPC 710.1(2)" utuh); ringkasan maksimal 2 kalimat ditegakkan di kode (`firstSentences`,
      keputusan pemilik 2026-10-13); label versi katalog dan versi aturan tidak dicetak — PDF menulis "Data produk
      per 6 Oktober 2026", stempel aturan tetap di payload; sel "KATALOG <versi>" di blok judul skema dihapus;
      petunjuk opsi ukuran ditulis ulang tanpa metatext
- [ ] ✋ CHECKPOINT Fase 17 — ditinjau pemilik

## Phase 18 — Hitung fitting otomatis

Keputusan pemilik 2026-10-13 (pilihan "Hitung fitting otomatis", usulan angka disetujui, tanpa cadangan).

- [x] P18-01 Fitting rumah dihitung engine: ENG-708 (air bersih — elbow pipa utama, pengisi toren, per cabang,
      elbow + faucet elbow per titik) dan ENG-605 (pembuangan — Y per alat dan per lantai atas, elbow 45° di kaki
      pipa tegak, clean out per jalur). 9 asumsi `FITTING_*` di registry (bisa diganti), semua ASUMSI → OQ-63.
      Baris BOQ fitting dengan dasar perhitungan dan produk Pralon per jenis/ukuran (`fittingKindOf` mengenali elbow,
      elbow 45°, faucet elbow, clean out dari nama katalog — diuji pada katalog ERP); ukuran tanpa produk tetap
      berjumlah tanpa nama. Fitting tidak butuh ukuran rumah; panjang pipa, tee, dan reducer tetap butuh
      (regresi laporan 0002 diperbarui sesuai keputusan ini)

## Phase 19 — Review laporan SNTY-2026-10-0015

Review pemilik 2026-10-13 (5 kelompok, urut prioritas). Keputusan: sisa kamar mandi ke lantai atas, sisa
wastafel ke lantai 1; sisa potong pipa 10% (bisa diubah); sok/stop kran/dop/lem sebagai "dihitung saat
pemasangan"; tebal dinding resmi per kelas menunggu tabel Pralon (OQ-64).

- [x] P19-01 [KRITIS] Satu sumber jumlah alat. Akar masalah: ENG-008 v1 memberi setiap lantai minimal 1 wastafel
      (`Math.max(1, round(basins / floors))`) dan membulatkan kamar mandi per lantai, sehingga sebaran (cabang,
      skema, DFU per lantai, kebutuhan bergambar) tidak sama dengan total (titik, WSFU, DFU total). ENG-008 v2
      membagi rata dengan jumlah selalu sama dengan masukan; pemeriksaan keseimbangan di engine (per lantai,
      Σ titik cabang, Σ WSFU cabang, Σ DFU per lantai) melempar `EngineConsistencyError` — analisis gagal tanpa
      coba ulang dan tercatat di log; laporan menolak kebutuhan yang tidak seimbang. Sebaran tampil di tabel
      asumsi. Tes: kasus 0015, 2 wastafel eksplisit, 1 lantai
- [x] P19-02 Teks, logika, asumsi: ENG-604 v2 menerapkan ukuran alat terbesar di cabang dan pipa tegak (langkah 21
      kini "→ 4", kloset minimal 4""); ukuran bangunan/tanah dan tinggi lantai tampil di Kebutuhan tercatat dengan
      statusnya; kamar mandi ditulis "2 ruang (4 titik: shower + kloset)" (toilet umum: kloset + keran); jumlah produk
      di ringkasan hanya produk yang punya jumlah di BOQ
- [x] P19-03 Perhitungan teknis: kurva Hunter diperiksa — sama dengan IPC 2021 Tabel E103.3(3) (7,9 WSFU → 12,7 gpm
      = 0,80 l/s; angka 6,5 gpm di review adalah nilai 3 WSFU), total dan cabang memakai kurva yang sama; tidak
      diubah tanpa sumber → OQ-65. Ujung pipa utama memakai elbow (+ reducer), bukan tee: ENG-704 v2 (tee = cabang
      − 1), ENG-708 v2, BOQ, dan skema (EL-n). Tebal dinding resmi per kelas → OQ-64 (menunggu tabel Pralon)
- [x] P19-04 BOQ: sisa potong 10% (`PIPE_CUTTING_ALLOWANCE_10PCT`, bisa diubah) ditambahkan sebelum pembulatan dan
      tertulis di Dasar Perhitungan; sok, dop, stop kran, lem PVC tampil "dihitung saat pemasangan" (`BomItem.pending`);
      penggabungan SKU per sistem sehingga ventilasi air kotor 2" tidak masuk seksi air bekas; subjudul Pipa/Fitting
      selalu ada di setiap seksi (layar + PDF)
- [x] P19-05 Layout PDF: label septic di potongan rata kanan di dalam gambar (tidak terpotong); tulisan "PDAM" di gambar
      meteran dihapus (tidak dobel dengan labelnya); subjudul `break-after: avoid` dan blok "Langkah berikutnya" tidak
      terpisah (tidak yatim). Kasus 0015 dibuat ulang lokal dan diperiksa per halaman (ringkasan, denah, BOQ)

## Phase 20 — Review putaran 3 (audit live, kasus U1/U2/U3)

Review pemilik 2026-10-13, dikerjakan berurutan 1 → 6. Kurva Hunter tidak diubah. Keputusan: tombol Susun
rekomendasi tetap boleh ditekan, pertanyaan yang tidak dijawab dicatat di tabel Asumsi dan tombol lama
dinonaktifkan; pertanyaan wastafel jadi "total (termasuk di kamar mandi)"; kedalaman sumur ditanya (default
6 m sebagai asumsi, peringatan di atas 7 m); ambang tekanan tetap berbeda dan alasannya dijelaskan.

- [x] P20-01 Pompa dan tekanan. 1a akar masalah: `boosterPumpNeeded = pumped` membuat sumber pompa/toren bawah
      tampil dengan pompa pendorong kedua — kini `boosterPumpNeeded` hanya dari ENG-703 (toren atap kurang
      tekanan) dan pompa sumber punya `sourcePumped`. 1b: field `water.wellDepthM` (kartu penyempurna bila sumber
      sumur: < 5 / 5–9 / > 9 m / angka pasti / belum tahu), ENG-702 v3 menambah muka air ke tinggi angkat, asumsi
      `WELL_WATER_DEPTH_6M`, ENG-709 baru (batas sedot `SURFACE_PUMP_SUCTION_7M` → pompa jet / submersible).
      1c: deskripsi `RESIDUAL_GRAVITY_0_3BAR` dan `RESIDUAL_PRESSURE_FIXTURE` menjelaskan beda ambangnya. 1d:
      ENG-703 v2 menghitung dudukan toren minimum (per 0,5 m) dan menyebut bila beda tinggi sendiri kurang
      sehingga pipa lebih besar tidak menolong; kartu pompa menawarkan "atau naikkan toren ke X m"; teks pompa
      tanpa "lantai atas". Tes U1/U2 di engine dan kebutuhan
- [x] P20-02 Validasi kewajaran: `houseInputIssues` (engine) — luas lantai < 2 m² per kamar mandi
      (`MIN_FLOOR_AREA_PER_BATHROOM_M2`) dan tanah lebih kecil daripada bangunan → kartu tanya balik ("Sudah benar" +
      isian ukuran) sebelum tombol Susun; penegasan disimpan di `confirmedOutliers`, hitungan jalan, dan tabel Asumsi
      (layar + PDF) mencatat "Data di luar kewajaran, mohon diverifikasi: …". Lantai < 1 dan kedalaman < 0 dari teks
      ditolak. Tes U3
- [x] P20-03 Percakapan. 3a: pasangan "N x M" pertama = bangunan, kecuali kata benda terakhir di klausanya
      tanah/lahan (ukuran tanah) atau ruangan ("kamar mandi 2x3"); jumlah ruangan ("4 km 10x8") tidak dihitung pemilik.
      3b akar masalah: CTA dikirim bersama kartu penyempurna dan wastafel kosong = 0 tanpa asumsi — kini tombol tetap
      boleh ditekan, wastafel kosong memakai `HOUSE_BASINS_0` (tampil di tabel Asumsi bersama dapur/ukuran/sumur), tombol
      Susun dan Simpan di giliran lama nonaktif. 3c: "Ada berapa wastafel total, termasuk yang di kamar mandi?". 3d:
      sapaan menyebut air bersih sekaligus pembuangan (juga deskripsi diri untuk model). 3e: "PDAM" tetap huruf besar
      di kalimat; pilihan jenis instalasi "Air bersih + pembuangan" (nama lama "Keduanya" tetap dibaca)
- [x] P20-04 BOQ. 4a: pipa ber-SKU sama digabung lalu dibulatkan sekali (Σ panjang bersih + 10% ÷ batang; U1 ¾" =
      14 batang). 4b: fitting terpilih tanpa baris jumlah tidak tampil lagi (tee sisa). 4c/4g: ENG-605 v2 — rumah 1
      lantai tanpa elbow 45° pipa tegak, Y = jumlah alat (Y per lantai atas dulu dobel). 4d: baris tanpa SKU Pralon
      terverifikasi (tidak ada di katalog atau seri/kelas belum terverifikasi) bertanda "LIHAT DOKUMEN TEKNIS" (layar +
      PDF); sok/dop punya SKU di ukuran jalurnya. 4e: nama di BOQ = nama katalog; seri D lebih dulu, seri lain
      bertanda dokumen teknis. 4f: sambungan ventilasi (Y/tee) dan topi ventilasi per jalur (`FITTING_VENT_JOIN_1`,
      `FITTING_VENT_CAP_1`), sok/dop/lem untuk air kotor dan air bekas. Tes U1/U2/U3 dengan katalog ERP di repo
- [x] P20-05 Tekanan di meteran untuk pipa pengisi toren: ENG-710 baru (muka air toren + gesek Hazen-Williams + 10%
      sambungan pada debit pengisian `TANK_FILL_FLOW_0_25LS`, diameter dalam dari SDR yang berlaku), tampil sebagai
      baris sistem "Tekanan untuk mengisi toren" dengan langkah hitungnya. 5a (ID per kelas) tetap OQ-64
- [x] P20-06 UI. 6a akar masalah: pesan pertama mengosongkan draf SETELAH menunggu pembuatan percakapan, jadi
      huruf yang diketik selama menunggu ikut terhapus — kini dikosongkan sebelum menunggu, dan dikembalikan bila
      gagal terkirim. 6b: tombol "Lebih dari X" (atau "Isi sendiri") setelah pilihan angka, isian Jumlah baru tampil
      setelah dipilih. 6c: sprite ilustrasi `display:none` — label simbol ("KOS", "HOTEL", "0 %", "semua
      sekaligus?") dulu terbaca sebagai teks halaman; gambar tidak berubah (dicek tangkapan layar)

## Phase 21 — Review putaran 4 (uji ulang live, 14 Okt 2026)

Review pemilik 2026-10-14, dikerjakan berurutan 1 → 6. Hunter, tinggi angkat pompa, dan tekanan toren tidak diubah;
kasus U1/U2/U3 putaran 3 tetap jadi regresi.

- [x] P21-01 Ketik cepat kehilangan huruf (React #185). Akar masalah: efek `sleepy` di `ChatWorkspace` bergantung
      pada `draft` dan memanggil `setSleepy(false)` di setiap ketikan; update bersarang itu menumpuk saat mengetik
      cepat sampai React melempar #185 di `onChange` dan huruf itu dibuang. Kini maskot dibangunkan di event ketik
      (`changeDraft`), efek hanya memasang timer. Tidak ada parsing live di composer. Tes e2e
      `apps/web/e2e/composer-typing.e2e.mjs` (playwright-core: ketik 0/5/10 ms, tempel/IME) — gagal di build lama,
      lolos di build baru
- [x] P21-02 Teks sprite di HTML tamu. `display:none` (P20-06) menyembunyikan tampilan, tetapi isi simbol ("KOS",
      "HOTEL", "0 %", "semua sekaligus?") tetap terkirim di HTML server dan payload RSC. `IllustrationSprite` kini
      komponen klien yang mengisi simbol hanya di browser (`useSyncExternalStore`); HTML server berisi `<svg>`
      kosong. Tes: markup server tanpa `<symbol>`, render browser memuat simbol
- [x] P21-03 Sapaan pendek. Akar masalah: "oi" tidak mirip contoh mana pun, jadi jatuh ke perencana + klasifikasi
      model (±30 detik) yang ragu → "kurang paham". Sesuai aturan "pertanyaan tidak di-hardcode", sapaan ditambah
      sebagai CONTOH di `data/understanding/intent.json` (oi, woi, p, ping, halo min, assalamualaikum, punten, …),
      bukan daftar frasa di kode; sapaan pertama sudah teks tetap tanpa model. Eval bge-m3: intent 145/146 (99,3%),
      satu-satunya meleset "tes 123" (bge-m3 menilai angka jauh; contoh "tes 1 2 3" tidak menolong). Klasifikasi
      model kini dibatasi `LLM_REPLY_TIMEOUT_MS` (dibatalkan sungguhan); lewat batas atau keluaran rusak → balasan
      klarifikasi, bukan giliran gagal. Tes router + e2e `greeting.e2e.mjs` (`E2E_SEND=1`, < 2 detik)
- [x] P21-04 Diameter dalam per kelas — selesai lewat P21-09 (PROD/STD-04). Catatan awal: terhalang OQ-64. Handbook Pralon dari pemilik disimpan sebagai sumber
      (`data/standards/2026-10-14-pralon-handbook/`: PROD/STD-001, 002, 003, 014), tetapi tidak memuat AW dan D;
      VP bukan pengganti (½" VP 2,7 mm). SDR 26,5 tetap asumsi tercatat; ukuran tidak berubah. Pemilik akan
      mengirim tabel AW/D
- [x] P21-05 BOQ. 5a akar masalah: status dokumen teknis menempel pada setiap baris yang produknya tidak
      `VERIFIED_SELECTED`, termasuk fitting ber-SKU seri Ts/W/DV yang kelasnya kosong di export ERP. Kini status
      (`BoqRow.availability`) hanya untuk baris tanpa SKU: "Tidak tersedia di katalog Pralon, gunakan produk setara"
      (stop kran, topi ventilasi, clean out/sambungan ventilasi 2½") atau, untuk lem, "Solvent Cement Pralon,
      tanyakan ketersediaannya ke tim Pralon" (keputusan pemilik). Tidak ada tautan datasheet: kolom `documents`
      katalog kosong. 5c: nama = nama katalog, spasi sebelum tanda inci dibuang (`displayName`); pemetaan seri →
      kelas menunggu data produk dari pemilik (OQ-48). Angka BOQ U1/U2/U3 identik dengan putaran 3
- [x] P21-06 Minor. 6a: kalimat "sudah saya catat" menyebut "muka air sumur ±9 m", bukan "…, dan 9 m". 6b: asumsi
      di luar kewajaran membawa `needsVerification` → banner di atas Ringkasan dan di sampul PDF. 6c: tidak
      terulang di live (klik dan keyboard, U2 → "5–9 m" tercatat 9 m); pemetaan tiap pilihan dikunci tes. 6d
      (keputusan pemilik): wastafel tidak disebut = 1 per kamar mandi untuk rumah (`HOUSE_BASINS_PER_BATHROOM_1`,
      tercatat sebagai asumsi; toilet umum tetap 0). Akibatnya **U3 berubah**: 6 wastafel asumsi → air bekas 2½" →
      3", ventilasi air bekas 1¼" → 1½", pipa ¾" 1 → 2 batang, ½" 6 → 9 batang, elbow ½" 14 → 21, faucet elbow
      13 → 19, Y air bekas 7 → 13, tambah tee 1¼" × ½". U1 (wastafel 0 disebut) dan U2 (2 disebut) tidak berubah.
      Regresi laporan 0002 dipatok ke 0 wastafel lewat ganti asumsi, dan default barunya diuji tersendiri
- [x] P21-07 Diameter dalam HDPE dari tebal dinding resmi PE100 Pralon (PROD/STD/014 Rev. 04, handbook pemilik):
      `pe100-walls.ts` dibangkitkan `scripts/gen-pe100-walls.mjs` dari `data/standards/`; dalam = OD − 2 × (tebal
      nominal + ½ toleransi). OD yang tidak diproduksi di SDR itu kembali ke rumus SDR. `HDPE_SDR17_PN10` kini hanya
      asumsi kelas (PN 10), tebalnya resmi. Kasus acuan 20 lantai: transfer tetap 280 mm, dalam 247,1 → 245,0 mm.
      PVC inci tidak berubah (OQ-64)
- [x] P21-08 Pertanyaan tebal dinding, diameter dalam, dan berat per meter dijawab dari tabel standar Pralon
      (handbook: SNI kelas S, SNI Kelas A/B, JIS VP/VU, PE100) — aspek baru `dimensions` dikenali dari contoh
      (`product-aspect.json`, eval 149/150), kelas dibaca parser nilai (SDR/PN/S/Kelas A-B/VP/VU), nol model dan
      nol katalog; dokumen sumber disebut di jawaban. Ukuran yang ada di beberapa jenis pipa → ditanya jenisnya;
      PRALON AW/D/C → diakui belum ada tabelnya + tim teknis (OQ-64). `data/standards` ikut image Docker
- [x] P21-09 Tebal dinding PRALON uPVC AW/D/C dari PROD/STD-04 Rev. 11 (PDF pemilik, menutup OQ-64). Transkripsi
      `data/standards/2026-10-14-prod-std-004/pralon-upvc.json` dicek silang: berat dari OD rata-rata × WT maks ×
      1,485 g/cm³ sama dengan dokumen untuk 29 baris. Engine: `pralon-upvc-walls.ts` (`scripts/gen-pralon-upvc-walls.mjs`),
      dalam = OD rata-rata − 2 × tebal rata-rata: ½" 20,3 → 18,9, ¾" 24,0 → 22,3, 1" 29,6 → 27,9, 1¼" 38,8 → 37,3,
      1½" 44,4 → 43,3 mm (2" ke atas ±0,5 mm). `PVC_AW_WALL_SDR` dihapus — hilang dari tabel Asumsi. **Perubahan
      ukuran:** U1 tetap (sisa tekanan toren 0,12 → 0,06 bar, pengisi 0,48 → 0,49 bar); **U2 pipa utama 1" → 1¼",
      cabang 1 KM + 1 wastafel ½" → ¾"**, tinggi angkat pompa 29,55 → 26,61 m, BOQ: 1¼" 12 btg, 1" 3, ¾" 6, ½" 5, tee
      1¼"×¾" 2, reducer 1¼"×1" (tidak ada di katalog); U3 tetap (meteran PDAM 1,57 → 1,58 bar). Contoh desain 2 lantai
      3 KM: utama 1" → 1¼" (1" AW 27,9 mm: gesekan ±10,9 m/100 m > 10). Jawaban "tebal pipa AW/D/C" kini memakai
      tabel ini. Verifikasi live: U2 → pipa utama 1¼", tanpa "SDR 26,5". "tebal pipa d 4 inch" dulu tidak dikenali
      (122 s, dijawab fakta ukuran inci): contoh dimensi ber-inci ditambah, aspek `dimensions` langsung PRODUCT_LOOKUP
      di router dan melewati perencana (eval 151/153)
- [x] P21-10 Kecocokan fitting seri Ts/W/DV dengan pipa AW/D (OQ-48 ditutup, keputusan pemilik: data pabrik
      cukup). Dasar: PROD/STD-04 — AW, D, C seukuran ber-OD sama, soket fitting mengikuti OD. Matcher: fitting
      berkelas kosong di ukuran yang pipa kelasnya dibuat → `VERIFIED_SELECTED` dengan alasan bersumber; ukuran
      yang kelasnya tidak dibuat (D ½") tetap perlu dikonfirmasi; fitting berkelas lain tetap ditolak. U1–U3: 77
      baris terverifikasi, 0 perlu dikonfirmasi
- [x] P21-11 Temuan QA smoke live (17/20 lolos): (1) "pipa pvc aw ada ukuran apa saja?" dijawab ukuran SATU
      produk teratas → kini `familySizeAnswer` untuk seluruh keluarga; (2) "tebal pipa d 3 inch berapa?" di tengah
      percakapan dijawab soal harga → dimensi didahulukan dari harga, dan aspek produk dicocokkan dengan angka/ukuran
      DISAMARKAN (`maskValues`, opsi data katalog) karena bge-m3 menyamakan "harga pipa d 4 inch" dengan "tebal pipa d
      4 inch" lewat token ukurannya; (3) kartu produk di chat tidak lagi bertanda "LIHAT DOKUMEN TEKNIS" (produk ber-SKU)
      dan sumber jawaban katalog "katalog produk Pralon", bukan nama berkas impor ERP. Eval 152/155 (98,1%)
- [x] P21-12 Audit keamanan live (docs/SECURITY.md §13): Next.js 16.3.8 + source-map-js ≥ 1.2.2 (audit bersih),
      CSP + Permissions-Policy ditegakkan setelah report-only bersih, `/health` ditutup dari publik, user DB aplikasi
      tanpa DROP/ALTER/CREATE (`db-grants`, cadangan `db-backup` 2,1 MB sebelum diubah). Temuan di luar SNOUTY:
      container bagspace-* berhenti sejak ±5 hari (bukan akibat perubahan ini)
- [x] P21-13 Sisa checklist keamanan: uji restore (`deploy/restore-check.sh`: 29 tabel, 0 selisih, 2 detik),
      cadangan harian 02.30 + uji pemulihan mingguan (cron, retensi 14 hari), runbook insiden `docs/INCIDENT.md`
      (kontak/PIC diisi pemilik), audit dependensi di CI (`pnpm audit --audit-level=high`). Model AI lokal (Ollama)
      → perjanjian dengan penyedia LLM belum diperlukan. Terbuka: enkripsi at-rest, cadangan di luar server,
      `audit_logs` baru 1 baris
- [x] P21-14 Keputusan pemilik keamanan: (1) **audit log** tindakan pengguna — `@Audited` + `AuditInterceptor`
      global pada 14 endpoint (daftar, login + login gagal, keluar, ubah profil/kata sandi, simpan/hapus/pulihkan
      percakapan, kirim ke tim teknis, buat/bangun ulang laporan, unggah, consent, onboarding): aktor, peran, IP,
      correlation ID, entitas — tanpa isi; gagal tulis tidak menggagalkan aksi. (2) **Salinan cadangan luar server**
      `db-backup-offsite`: gpg kunci publik + rsync, aktif bila `BACKUP_REMOTE`/`BACKUP_GPG_RECIPIENT` diisi.
      (3) **Enkripsi at-rest**: langkah admin di DEPLOYMENT.md §8b (LUKS untuk volume data SNOUTY)
- [x] P21-15 IP klien di belakang nginx: `request.ip` selalu IP kontainer nginx → rate limit login per IP menjadi
      satu kuota global dan audit log tanpa IP asal. `trust proxy` = 1 lompatan (`trustReverseProxy`), tes HTTP nyata

## Phase 22 — Masukan pengguna awam: rumah subsidi, gambar sistem, SPAM/sewerage (16 Okt 2026)

Masukan dari kenalan pemilik (bapak-bapak yang mengulik rumahnya sendiri) lewat pemilik, 2026-10-16. Pemilik
meninggalkan sesi dengan "kerjain sampai selesai": keputusan desain diambil sebagai default dan dicatat di
`docs/OPEN_QUESTIONS.md` (OQ-67 dst.), bukan ditanyakan. Lima butir:

1. Aplikasi mudah dipakai orang awam segmen perumahan subsidi (alur, penjelasan, contoh rumah).
2. Gambar sistem pipa yang lebih nyata (arah, jumlah pipa, jumlah aksesoris) bila ditanya.
3. Estimasi bila sistem pipa rumah subsidi (pipa murah) diganti produk Pralon.
4. Pertanyaan paling sering: rumah subsidi, aliran kencang ke tiap titik tanpa pompa pendorong — toren di
   ketinggian berapa, dak atau tiang toren, pipa dari toren berapa inci, di dalam instalasi berapa.
5. Siapkan use case proyek SPAM (jaringan air minum) dan sewerage (jaringan air limbah).

- [x] P22-04 Tinggi toren tanpa pompa (butir 4). **ENG-711** v1 (Kelompok K): tekanan di titik air tertinggi
      untuk tiap dudukan — dak atap (pelat atap + TANK_STAND_1M) dan tiang toren `TANK_TOWER_HEIGHTS_M`
      3/4/5/6/8 m — dengan kehilangan pipa utama yang sama; tiang yang tidak lebih tinggi dari dak tidak
      ditawarkan; `recommendedIndex` = terendah ≥ 0,3 bar, `comfortableIndex` = terendah ≥ asumsi baru
      `RESIDUAL_GRAVITY_COMFORT_0_7BAR` (shower deras, Noerbambang & Morimura). Contoh U1 (1 lantai 3,5 m,
      shower 2 m): dak 0,2 bar kurang; tiang 5 m cukup; tidak ada yang 0,7 bar tanpa pompa → dikatakan apa
      adanya. Tersimpan sebagai `Recommendation.tankStand` (migration 0024 `tank_stand`), kartu **Tinggi
      toren** di tab Ringkasan (tiap pilihan bergambar `tank`/`tankup`, yang cukup ditandai, ukuran pipa dari
      toren dan cabang di dalam rumah disebut), bagian **Tinggi Toren** di PDF dengan kata yang sama.
      **Jawaban chat tentang solusi aktif** (dulu model hanya diberi kebutuhan, tanpa satu pun angka hasil):
      port `ActiveSolutionRegistry` di context diikat modul recommendation saat init (arah dependensi tetap),
      `solutionFacts` memberi ukuran pipa, pompa, pilihan tinggi toren, dan BOQ ke penulis balasan — ditandai
      usang bila snapshot kebutuhan sudah berubah. Contoh pertanyaan ditambah ke `explanation_request`
      (toren setinggi berapa, dak atau tiang, pipa dari toren berapa inci, berapa batang, fitting apa saja,
      arah jalur); eval bge-m3 lolos. 55 aturan; tes engine 389, API 527 (report/context/recommendation),
      web kartu 2. OQ-67 (tinggi tiang, ambang deras).
- [x] P22-01 Contoh rumah dan bahasa awam (butir 1). **Dicabut pemilik 2026-10-16** ("hapus woi biar user prompt
      sendiri"): kartu contoh rumah, endpoint GET /house-examples dan POST …/house-examples/:exampleId, data
      data/house-examples, dan tesnya dihapus (P22-07); yang tersisa dari item ini hanya skema edit kebutuhan di
      domain (RequirementEditSchema). Catatan asli: Layar sambutan kini punya **contoh rumah bergambar**
      ("Atau mulai dari contoh rumah yang mirip, lalu ubah yang berbeda"): rumah subsidi tipe 30, tipe 36, rumah
      2 lantai — DATA di `data/house-examples/examples.json` (pemilik menambah contoh tanpa kode; tiap nilai
      diperiksa skema edit panel kanan `RequirementEditSchema`, yang dipindah ke domain). Memilih satu membuat
      percakapan dan menerapkan nilainya di server tanpa LLM (`POST /conversations/:id/house-examples/:exampleId`)
      sebagai **asumsi bertanda contoh** — kalah dari apa pun yang pengguna sebut, tampil di tabel Asumsi dengan
      alasan "Dari contoh …; ubah bila rumah Anda berbeda" dan tombol Ubah. Balasan teknisi: contoh yang dipakai,
      cara mengubah ("ketik saja bedanya, misalnya 'kamar mandinya 2', atau ubah di panel kanan"), lalu kartu
      Susun rekomendasi + pertanyaan penyempurna yang sudah ada. `GET /house-examples` publik. Tes: loader,
      domain (nilai ASUMSI beralasan, tidak menimpa pernyataan pengguna, kartu CTA), komponen web.
- [x] P22-02 Gambar sistem pipa saat ditanya (butir 2). Label pemahaman baru `system_layout_question`
      (contoh di `intent.json`: arah jalur, jumlah pipa, fitting/aksesoris, "gambar sistem pipanya dong",
      "where do the pipes run", …) — dirutekan seperti permintaan penjelasan, dijawab di atas fakta solusi aktif
      (P22-04: ukuran tiap jalur, BOQ pipa dan fitting), dan **membawa kartu gambar** `{ kind: 'drawing',
needs }` — potongan instalasi yang sama dengan tab Denah (ukuran per segmen, toren/meteran/pompa, alat
      per lantai, pipa buang dan ventilasi), digambar klien dari kebutuhan bergambar solusi. Hanya bila
      solusinya sudah dihitung dan belum usang; jalur perencana (`case_question`) ikut membawa gambar dan
      kartunya kini tersimpan di riwayat. Varian kartu jadi tujuh (spec, API_CONTRACTS). "Lebih nyata"
      dalam arti gaya gambar (isometrik, foto) butuh keputusan desain → OQ-68. Tes: `drawingCardFor`,
      urutan event (teks → kartu → selesai), daftar varian; eval bge-m3 lolos.
- [x] P22-03 Estimasi ganti pipa lama ke Pralon (butir 3). Field kebutuhan baru `water.replaceExisting`
      ("Pekerjaan": instalasi baru / ganti pipa lama) — diekstrak model hanya bila penggantiannya disebut
      (penanda ganti/renovasi/lama/replace), bisa diubah di panel kanan (pilihan boolean) dan lewat
      `PATCH /requirement`, tampil di kebutuhan yang tercatat, kop PDF ("Ganti pipa lama · Air bersih +
      pembuangan") dan tabel kebutuhan laporan. Engine dan BOQ **tidak berubah**: pipa lama diganti pada jalur
      yang sama, jadi daftar materialnya sama dengan instalasi baru — itu dikatakan di judul dan kalimat pembuka
      solusi ("Penggantian pipa ke Pralon untuk N titik air"; "pipa lama dilepas saat pemasangan"). Contoh rumah
      keempat di sambutan: "Ganti pipa rumah subsidi ke Pralon" (tipe 36, pipa lama diganti). Contoh kalimat
      permintaan ganti pipa masuk `requirement_building`. **Tanpa rupiah**: katalog tidak memuat harga dan DD-01
      #8 menetapkan BOQ tanpa harga → OQ-69. Tes: penanda ekstraksi, label nilai, templat prosa, baris panel.
- [x] P22-05 Use case SPAM dan sewerage (butir 5). Dua kasus teknis baru. **Jaringan air minum (SPAM)**
      `water_supply_network`: SR (atau jiwa → SR lewat **ENG-408**), panjang, beda tinggi → kebutuhan puncak
      ENG-405 dengan asumsi SPAM (100 l/jiwa/hari, 5 jiwa/SR, faktor jam puncak 1,75 — tercatat, bisa diganti)
      → Kelompok F; `computeNetwork` kini berjenis (`cluster` | `water_supply`), cluster tidak berubah.
      **Jaringan air limbah (sewerage)** `sewerage`: SR/jiwa → **ENG-406** (80 % kembali, puncak 2,5) → Manning
      ENG-402 → **ENG-407** ukuran minimum 6" (150 mm) → ENG-401; `computeGravity` jenis `sewer` dengan blok
      `sewer` (sambungan, rata-rata, puncak, ukuran hidraulik vs minimum). Contoh 200 SR: 0,93 → 2,31 l/s,
      hidraulik 3" → dipakai 6". Profil kasus (alternatif: jiwa menggantikan SR; debit langsung untuk air limbah),
      pilihan jenis proyek + gambar, ekstraktor mengenal "jiwa"/"penduduk"/"SR", contoh use-case (bge-m3),
      kalimat pembuka kasus, label/highlight/prosa/skema "SK-08 AIR LIMBAH" (sambungan rumah → pipa air limbah →
      IPAL). 58 aturan. OQ-70 (kriteria per kategori kota, keluarga pipa air limbah Pralon, batas diteruskan ke
      tim teknis). Tes: engine 8 (sewer/SPAM) + registry; API pemetaan parameter → engine, prosa, highlight,
      skema; eval bge-m3.
- [x] Smoke test produksi 2026-10-16 (permintaan pemilik "coba jo lakukan smoke test"): rilis ok (API, DB, web, katalog,
      migration 0024); contoh rumah → analisis → kartu Tinggi toren (dak 0,1 bar, tiang 6 m 0,35 bar); chat "toren
      setinggi berapa" dan "arah jalur pipanya, fitting apa saja" dijawab dari solusi, yang kedua membawa gambar;
      SPAM 500 SR → HDPE 75 mm; sewerage 200 SR → PVC D 6". Dua temuan diperbaiki di sesi yang sama: pertanyaan
      tentang solusi tidak lagi lewat perencana (bisa tersasar ke jalur kebutuhan), dan teks tetap penjelasan
      dibangun dari solusinya, bukan kalimat generik.
- [x] P22-06 Denah jalur per lantai dirapikan (pemilik 2026-10-16: "skema denahnya masih kurang proper"). Temuan dari
      tangkapan layar produksi: satu denah rumah 1 lantai membesar sampai teks raksasa dan label panjang terpotong;
      alat digambar lingkaran polos berjajar; tidak ada jalur buangan; label pipa tegak menimpa tag ukuran. Kini:
      skala maksimal 40 px/m dan lebar maksimal 560 px; alat dengan ikon yang sama seperti potongan, dikelompokkan
      per ruang basah (Kamar mandi = shower + kloset, Wastafel, Dapur, Toilet) dalam kotak putus-putus — letak ruang
      tetap tidak dikarang (DD-01 #7, catatan "letak ruang mengikuti denah Anda" di atas gambar); jalur buangan tiap
      alat ke pipa tegak air kotor (kloset/urinoir) atau air bekas (lainnya) di dinding kanan, konsisten dengan
      potongan; tag ukuran cabang di bawah garis; dua baris label pipa tegak buang berukuran. Dicek render lokal
      untuk 1 lantai 6 × 6 m, 2 lantai 10 × 6 m, dan 2 lantai 15 × 8 m dengan tiga cabang. PDF memakai SVG yang sama.
- [x] P22-08 Kelengkapan hitungan SPAM dan sewerage (pemilik 2026-10-16: "pastiin dari segala aspek ... terpenuhi
      semuanya"). Audit terhadap kriteria perencanaan SPAM dan SPALD-T, lalu yang kurang ditambah. **SPAM**: ENG-409
      kebutuhan = domestik + non-domestik 15 % ÷ (1 − NRW 20 %), hari maksimum × 1,15 (transmisi/reservoir) dan
      jam puncak × 1,75 (distribusi); ENG-410 reservoir 20 % hari maksimum; ENG-411 kelas tekanan PN dari
      max(statis, head pompa) + 10 % (PE100 PN ↔ SDR). **Sewerage**: ENG-406 v2 + infiltrasi 10 %; ENG-412 aliran
      sebagian Manning segmen lingkaran — d/D dan kecepatan pada debit rencana, ≥ 0,6 m/s dan ≤ 3 m/s, d/D ≤ 0,8,
      kemiringan minimum S × (0,6 ÷ v)²; ENG-413 profil jalur — manhole tiap 50 m, penurunan, kedalaman galian
      akhir, > 4 m → stasiun pompa angkat; manhole masuk BOQ sebagai baris di luar perpipaan. Contoh 200 SR, 1,5 km,
      0,5 %: 2,41 l/s, 6" terisi ±27 % pada ±0,55 m/s → pasang ≥ 0,6 %; 31 manhole; dasar pipa turun 7,5 m → perlu
      pompa angkat. Contoh 500 SR SPAM: 4,16 l/s rata-rata (359 m³/hari), jam puncak 7,28 l/s, reservoir 83 m³.
      Highlight, prosa, dan BOQ ikut. Di luar cakupan (ke tim teknis): pemodelan jaringan bercabang/loop,
      penempatan reservoir, desain IPAL, pompa angkat. 63 aturan; OQ-70 diperluas.
- [x] P22-09 Smoke test semua use case di produksi (pemilik 2026-10-16: "jalanin smoke test lagi semua use case"):
      19 kasus — rumah 2 lantai, rumah subsidi, gedung bertingkat, cluster, irigasi, transfer pompa, drainase, air hujan,
      gorong-gorong, sumur ke tandon, kolam lele, SPAM, sewerage, masjid, industri (handoff), ukuran produk, tebal
      dinding, harga, pesaing. Sembilan menghasilkan solusi, lainnya bertanya/handoff sesuai desain. Tiga temuan
      diperbaiki: "tinggi lantai 4 m" terbaca panjang jalur 4 m (kini tinggi lantai dikonsumsi dan menjadi tinggi
      bangunan 8 × 4 m), "tandon di bukit 40 meter" tidak terbaca beda tinggi (kata bukit/hill jadi penanda), dan
      "Kedalaman sumur 40 m" kehilangan labelnya karena "m" substring label (cek per kata).
- [x] P22-10 Kartu pertanyaan kasus teknis seperti alur rumah (pemilik 2026-10-16: "kenapa konsepnya ngga kaya yang
      sebelum2nya"). Dulu angka inti (jarak, beda tinggi, jumlah SR) hanya ditanya di teks yang diulang tiap giliran,
      sementara kartu menanyakan hal sekunder (bahan, kontur, tekanan) satu per satu. Kini angka inti masuk kartu
      sebagai isian (kritis lebih dulu, wajib; sekunder opsional), jawabannya `kunci=angka` seperti ukuran bangunan,
      lalu tombol Susun rekomendasi begitu data inti lengkap.
- [x] P22-11 Audit jaringan distribusi PDAM — temuan 1 dan 2 (brief pemilik 2026-10-16). (1) "1.500 meter" terbaca
      1,5 m: akar masalah di parser angka extractor kasus teknis (NUM dan num() menganggap titik selalu desimal);
      kini kelompok ribuan Indonesia ("1.500", "2.500.000") dikenali, koma tetap desimal, angka pengguna tidak
      diubah; parser jumlah sambungan/jiwa ikut memakainya ("2.000 sambungan" dulu terbaca 0). (2) HDPE dipilih
      tetapi BOM PVC AW: akar masalah networkInputFrom tidak membaca parameter material dan runNetwork/flowSchematic
      memilih keluarga hanya dari panjang jalur (HDPE_MAIN_FROM_200M); kini bahan pilihan pengguna menjadi constraint
      (networkFamilyOf: pilihan menang, aturan panjang hanya tanpa pilihan, dan asumsi panjang tidak lagi dicatat
      bila pengguna yang memilih). Regresi: extractor (1.500 m, 1,5 km, 2.000 SR, 12,5 m, 2.5 l/s) dan pemetaan
      bahan (HDPE/PVC/tanpa pilihan × 150 m/1 500 m). Temuan 3–6 (hidraulika per segmen, verifikasi pompa dan
      tekanan sumber, validasi kelas PN, fitting tanpa topologi) dilaporkan sebagai rencana — menunggu pilihan pemilik.
- [x] P22-12 Audit PDAM — temuan 3–6 (keputusan pemilik 2026-10-16, semua pilihan rekomendasi). **Topologi** ENG-414:
      pipa induk + N cabang seragam dari `number_of_branches`; induk pada debit puncak, tiap cabang pada bagiannya
      (tidak ada segmen memikul debit yang sudah diambil cabang lain); tanpa N → satu pipa bertanda asumsi. **Hidraulika
      per segmen**: induk dan cabang diukur sendiri (Kelompok F, diameter dalam aktual); ENG-415 head titik kritis =
      statis + kehilangan induk + cabang + tekanan sisa. **Mode sistem** ENG-416 dari tekanan sumber (`source_pressure`,
      penting untuk PDAM): gravitasi / suplai langsung / booster sebesar kekurangan / pompa penuh; titik kerja pompa
      hanya sebesar kekurangan dan dinyatakan "cocokkan dengan kurva pabrikan". **Kelas tekanan** ENG-411 v2 = (tekanan
      kerja maks + surja a·v/g pada mode berpompa) × 1,10; katalog HDPE tidak memuat PN → produk ditandai perlu
      dikonfirmasi, kelas disebut di solusi. **BOM**: pipa induk, pipa cabang N × panjang, tee per cabang, reducer bila
      ukuran turun; elbow/katup/check valve menjadi baris tertunda "dihitung saat pemasangan". Skema menampilkan N cabang.
      Regresi: cabang vs tunggal, 1,5 m vs 1.500 m, debit naik, elevasi naik, tekanan sumber naik/turun, PN dengan
      surja. 66 aturan. Di luar cakupan: jaringan loop/pemodelan EPANET, penempatan reservoir, kurva pompa pabrikan.
- [x] P22-13 Tur ujung-ke-ujung di produksi (pemilik 2026-10-16: "coba lakukan testing end to end, gw pengen
      liat"). Playwright menjalankan dua alur sebagai tamu di ai.pralon.co.id (SPAM PDAM 500 SR bercabang 4 dengan
      tekanan sumber; rumah subsidi 1 lantai dengan toren atap), 15 tangkapan layar dilaporkan sebagai artifact. Dua
      cacat teks yang terlihat diperbaiki: prosa SPAM membuka dua kali dengan kebutuhan puncak (prefiks generik jaringan
      kini hanya untuk jaringan non-SPAM), dan judul menurunkan "PDAM" menjadi "pdam" (huruf pertama saja yang
      diturunkan, singkatan utuh). Pengamatan UX yang belum diubah: pada kartu kasus teknis, pertanyaan opsional yang
      tidak disentuh menahan tombol "Kirim jawaban" sampai "Belum tahu" dipilih.
- [x] P22-14 Produk jaringan air minum mengikuti kelas PN (temuan tur 2026-10-16, tab Estimasi Material SPAM).
      Katalog ERP 2026-10-06 ternyata memuat `pressure_class` untuk pipa HDPE (PN 4–24, sebagian SDR) — klaim P22-12
      "katalog HDPE tidak memuat PN" keliru dan prosa yang menyebutnya diganti. `RoleRequirement.minimumPn`: pipa PE
      dipilih dari kelas terendah yang ≥ PN hasil ENG-411 (PN-20 untuk jaringan contoh, bukan PN-8 batang 4 m); PN tidak
      tercatat (kosong/SDR) atau hanya kelas di bawahnya → produk tampil "perlu dikonfirmasi" dengan alasan yang menyebut
      kelasnya; tidak ada tebakan dari SDR. Peran fitting generik dihapus untuk kasus SPAM (tee dan reducer sudah peran
      eksplisit) — sebelumnya terisi "HDPE Pejal 90 mm" dan muncul sebagai baris BOQ tertunda. Regresi matcher: 4 tes.
- [x] ✋ CHECKPOINT Fase 22 — pemilik menerima keempat default (OQ-67 ambang 0,7 bar, OQ-68 tetap skematik, OQ-69
      tanpa harga, OQ-70 kriteria umum divalidasi bersama aturan lain), 2026-10-16

## Phase 23 — Renovasi untuk semua kasus (19 Okt 2026)

Pemilik 2026-10-19: "snouty bisa mencakup itung-itungan yang sifatnya renov belum? kalo belum segera lakukan
development. inget dari semua case yah". Sebelumnya hanya rumah dengan mode "ganti semua pipa" (P22-03, kata-kata
saja). Keputusan pemilik lewat AskUserQuestion (ketiganya pilihan rekomendasi): tiga mode (ganti semua, ganti
sebagian, perluasan); perluasan menanyakan ukuran pipa lama lalu menghitung beban total — tanpa ukuran, seluruh
sistem diukur seperti baru dan hasilnya menyebut jalur lama harus dicek; sambungan ke pipa galvanis/besi lewat
sok drat dari katalog. Dicatat sebagai OQ-71.

- [x] P23-01 Engine renovasi. Parameter registry `work_type` (enum; optional — ditanya hanya bila ada isyarat
      renovasi tanpa jenis), `existing_pipe_size` (enum ukuran inci + mm), `existing_pipe_material`,
      `existing_outlets`, `existing_connections`, `replacement_length`; ekstraktor membaca semuanya dari kalimat
      ("pipa lama 3/4 inch galvanis", "sudah ada 4 titik", "ganti 300 meter", "pipa induk lama 110 mm hdpe sudah
      melayani 300 sr") sebelum panjang jalur/diameter/jumlah sambungan baru, plus `renovationCue` untuk "renovasi"
      tanpa jenis. Resolver pertanyaan bersyarat (`renovationParameters`): isyarat → `work_type` kritis paling dulu;
      perluasan → ukuran pipa lama, beban lama (`existingLoad` profil), bahan lama; ganti sebagian → panjang + bahan;
      ganti semua → bahan. Kelompok M ENG-901 kapasitas pipa lama (diameter luar), ENG-902 sambungan ke pipa lama,
      ENG-903 penggantian sebagian, ENG-904 beban total; asumsi RENOV_COUPLINGS_PER_SEGMENT_2, RENOV_REPLACE_WHOLE_ROUTE,
      RENOV_EXISTING_OUTLET_1_WSFU; `computeRenovation` murni. 70 aturan. Tes: aturan, orkestrator, ekstraksi, resolver.
- [x] P23-02 Lapisan renovasi di API untuk semua jalur hitung (`renovation-view.ts`, `AnalysisService.renovate`):
      irigasi, transfer pompa/sumur, gravitasi (air limbah mengecek pipa lama dengan sambungan total), jaringan
      cluster/SPAM (pipa induk lama dicek dengan `computeNetwork` beban total), gedung, kolam, dan rumah
      (`computeSolution` dengan titik air lama sebagai 1 WSFU). Hasil: judul berawalan jenis pekerjaan, kalimat
      pembuka dari engine, baris sistem "Pipa utama lama" (ENG-904 + ENG-901) dan "Sambungan ke pipa lama"
      (ENG-902) atau "Segmen yang diganti" (ENG-903), BOM: tee/sok drat sambungan (dicocokkan ke katalog; jenis
      fitting baru `faucet_socket`), pipa × rasio + sok untuk ganti sebagian; asumsi renovasi di tabel asumsi;
      kapasitas yang tidak bisa dicek DITULIS dengan alasannya. Isyarat renovasi kasus teknis
      (`TechnicalUseCase.renovationHinted`) membuat jenis pekerjaan ditanya di kartu sebelum tombol hitung.
- [x] P23-03 Alur rumah: field `water.workType` (new/replace_all/replace_partial/extend/renovation),
      `existingMainSize`, `existingPipeMaterial`, `existingOutlets`, `replacementLengthM` — skema ekstraksi +
      prompt + stub dev, grounding per field (ukuran dinormalkan lewat `PipeSize`, tidak terbaca → dibuang),
      `renovation` tanpa jenis menahan rekomendasi dan ditanya paling dulu ("Renovasinya seperti apa?"), kartu
      penyempurna menanyakan data pipa lama sesuai jenisnya (`renovationRefinementFields`), label nilai dua bahasa,
      kalimat "sudah saya catat" berfrasa, panel kebutuhan (baris jenis pekerjaan + data pipa lama bila relevan),
      kop laporan dan tabel masukan laporan. `replaceExisting` lama tetap dibaca sebagai ganti semua.
- [x] P23-04 Data pemahaman: contoh kalimat renovasi di `use-case.json` untuk 12 kasus dan di `intent.json`
      (requirement_building / requirement_technical); eval bge-m3 dijalankan ulang.
- [x] P23-05 Smoke produksi pertama: kasus teknis (SPAM perluasan/ganti sebagian, air limbah perluasan, transfer
      pompa ganti semua) sudah benar; alur rumah tidak merekam jenis pekerjaan karena model ekstraksi produksi
      melewatkan field barunya, dan "sudah ada 4 titik air" terbaca sebagai 4 titik air baru. Perbaikan: kosakata
      renovasi yang tersurat dibaca kode bila model melewatkannya (pola OBVIOUS yang sudah ada — satu parser dengan
      kasus teknis: `workTypeOf`/`extractTechnicalContext` diekspor dari engine), titik air lama tidak pernah menjadi
      `outletCount`, dan "tambah …" hanya berarti perluasan bila kalimatnya menyebut instalasi yang ada ("tambah satu
      kamar mandi" tetap perubahan kebutuhan). Catatan: "ganti semua pipa transfer lama dari sumur ke tandon, 300 m"
      membaca 300 m sebagai kedalaman sumur (perilaku ekstraktor sumur yang sudah ada, bukan renovasi).
- [x] P23-06 Smoke produksi kedua: ketiga mode rumah kini jalan (perluasan: pipa lama 3/4" galvanis kurang untuk
      8 titik → diganti ke 1", sok drat 2 + tee 1 ber-SKU; renovasi tanpa jenis → "Renovasinya seperti apa?"; ganti
      sebagian 12 m). Dua rapian: material ganti sebagian hanya pipa jalur utama sepanjang segmen + sok (cabang,
      sambungan alat, dan fitting per titik tidak ikut; baris tertunda tetap, sok tertunda digantikan yang dihitung —
      sebelumnya semua baris pipa dikali rasio dan sok bergabung menjadi "Sok + Sok …"), dan asumsi 1 WSFU/titik lama
      hanya tampil bila beban total memang dihitung.
- [ ] ✋ CHECKPOINT Fase 23 — uji langsung di produksi tiga mode untuk rumah dan SPAM; pemilik menilai.

## Phase 24 — Fitur akun: proyek, sematan, tautan bagikan (19 Okt 2026)

Pemilik 2026-10-19: "tambahin bbrp fitur dong untuk akun yang terdaftar yg dmn itu kaya claude: itu ada
project, pin, dll" dan "manual booknya daftar isinya ngga ada, serta ngga ada gambar dokumentasinya".
Pilihan pemilik (AskUserQuestion): Proyek + Pin + Bagikan tautan baca-saja; proyek sebagai bagian di
sidebar dengan halamannya sendiri. Belum ada desain — OQ-72.

- [x] P24-01 Sematan. Migration 0025: `conversations.pinned_at` (+ indeks). `PATCH /conversations/:id` menerima
      `{ title?, pinned?, projectId? }` (minimal satu); sematan dan proyek digerbang `CONVERSATION_HISTORY`.
      `GET /conversations?pinned=true` urut waktu disematkan; menyematkan tidak mengubah urutan riwayat
      (`updated_at` ditulis apa adanya). Ringkasan percakapan membawa `projectId` dan `pinnedAt`.
- [x] P24-02 Proyek. Tabel `projects` (pemilik akun, nama ≤ 80, catatan ≤ 2 000, hapus lunak) dan
      `conversations.project_id`. `/projects` GET/POST, `/projects/:id` GET (dengan konsultasinya)/PATCH/DELETE
      — akun saja, milik orang lain NOT_FOUND, tercatat di audit. `POST /conversations` menerima `projectId`.
      Hapus proyek melepas konsultasinya (tetap di riwayat). Catatan proyek dibaca pada giliran pertama
      konsultasi di proyek itu sebagai bagian cerita (pesan tersimpan tetap kalimat pengguna).
- [x] P24-03 Tautan bagikan baca-saja. Tabel `share_links` (hash SHA-256 token 256-bit, satu tautan aktif per
      solusi). `POST/GET/DELETE /recommendations/:id/share` (akun pemilik, audit); `GET /shared/:token` publik,
      dibatasi 120/jam per IP, tanpa sesi tamu, tanpa percakapan dan data akun. Halaman web `/shared?t=…`
      (noindex) memakai layar solusi dalam mode `shared`: tanpa skenario, perbaiki asumsi, dan tautan halaman skema.
- [x] P24-04 Web. Sidebar akun: PROYEK (+ proyek baru) → DISEMATKAN → RIWAYAT; menu ⋯ per baris (Sematkan /
      Lepas sematan, Pindahkan ke proyek, Keluarkan dari proyek, Hapus) menggantikan tombol hapus; halaman proyek
      di area utama (nama, catatan, Konsultasi baru di proyek ini, daftar konsultasi, hapus dengan konfirmasi);
      chip "Proyek: …" di layar sambutan; tombol Bagikan di layar solusi (tamu → register-gate) dengan pop-up
      buat/salin/cabut. Tes: unit service (fake), MySQL pin/proyek (CI), komponen web.
- [x] P24-05 Manual book v2 (31 tangkapan layar produksi, daftar isi diperbarui oleh Word, ekspor PDF) dan BRD/PRD/FRD
      v2 dengan fitur Fase 24 — di Downloads pemilik, tidak di repo. Tur tangkapan layar menemukan dan memperbaiki:
      (1) regresi Fase 23 — kartu "Yang sudah saya pahami" dan panel kebutuhan menampilkan "Jenis pekerjaan / Bahan
      pipa lama: Belum diisi" untuk rumah bangun baru (baris renovasi kini butuh jenis pekerjaan yang tersurat);
      (2) nilai mentah "renovation" di kartu; (3) "ukuran pipa hdpe ada apa aja?" dijawab sebagai konsep karena aspek
      ukuran tidak dikenali — contoh ditambahkan ke `product-aspect.json`, eval tetap lolos; (4) dialog bagikan tidak
      menutup dengan Escape setelah fokus lepas; (5) konsultasi tersemat yang sedang dibuka pindah ke RIWAYAT;
      (6) bilah bawah ponsel memecah tiga tombol menjadi dua baris.
- [x] P24-06 Menu ⋯ baris sidebar terpotong dan tertimpa baris lain di mode gelap (laporan pemilik 2026-10-19, "apa ini?
      ayolah"): menu kini dirender lewat portal ke `document.body` dengan posisi tetap terhadap tombolnya, membuka ke
      atas bila ruang di bawah kurang, dan menutup saat digulir. Diverifikasi di produksi (mode gelap, baris terbawah).
- [ ] ✋ CHECKPOINT Fase 24 — pemilik mencoba proyek, sematan, dan tautan bagikan di produksi.

## Phase 25 — Bahasa balasan mengikuti kalimat pengguna (19 Okt 2026)

Pemilik 2026-10-19: "harusnya jawaban bhs ing itu berdasarkan prompt user, bukan berdasarkan bilingual
button". Sebelumnya bahasa ditetapkan sekali dari tombol bahasa saat percakapan dibuat.

- [x] P25-01 Setiap pesan dikenali bahasanya oleh model n-gram tinyld yang dibatasi ke Indonesia/Inggris — bukan
      daftar kata atau kalimat. Bila jelas, balasan memakai bahasa itu dan `conversations.language` ikut diganti
      (tanpa mengubah urutan riwayat), sehingga kartu jawaban, judul, dan laporan setelahnya sebahasa. Bila tidak
      jelas ("ok", "pralon jis vs sni"), bahasa percakapan tetap. Tombol bahasa kini hanya bahasa antarmuka dan
      bahasa awal. Pustaka dipilih dari tiga calon lewat `apps/api/evals/reply-language-cases.json` (95 kalimat
      berlabel): franc salah membaca "pralon itu apa?" sebagai Inggris, eld salah 22 kalimat; tinyld tidak salah
      bahasa dan memutuskan ≥ 90%. Kalimat yang salah dikenali di produksi ditambahkan ke berkas itu. OQ-73.
- [x] P25-02 Audit live pertanyaan perpipaan (permintaan pemilik 2026-10-19: "audit ai.pralon.co.id, tanya mengenai
      pertanyaan perpipaan, kalo salah langsung perbaikan"). 20 pertanyaan dikirim ke produksi; yang salah dan
      perbaikannya: (1) "pipa ppr pralon ada ga?" dijawab pipa gas + conduit → contoh negatif topik, jawaban dibuka
      "PPR tidak ada di katalog Pralon"; (2) "kemiringan pipa air kotor" dan "pipa wc ukuran berapa" → topik baru
      `pipa pembuangan` dari acuan engine (kemiringan 2 %, kloset 4", IPC, belum divalidasi); (3) "talang air hujan
      atap 150 m2" dan pertanyaan "jelaskan" lain tanpa kebutuhan dijawab "tekan Susun rekomendasi" → router memulai
      kasusnya bila ada hal kebutuhan, selain itu model; contoh kasus air hujan + kosakata talang/atap; (4) "sumur bor
      40 meter" dijawab hitungan batang → contoh negatif; (5) "sambungan pipa hdpe" memilih satu produk acak → topik
      baru `sambungan hdpe`; (6) "conduit ukuran apa aja" menyeret panjang batang semua pipa → contoh conduit;
      (7) gedung 5 lantai (Inggris) terbaca cluster dan "5 lantai" → contoh kasus gedung + terjemahan satuan
      `unitLabel`; (8) "is pralon pipe safe for drinking water" dijawab ketahanan kimia → topik baru `air minum`
      (SNI seri S, Calcium-Zinc bebas timbal); (9) "hdpe pn 10" dibuka kelas PVC → kalimat pembuka HDPE; (10) "tee 2
      inch" hanya reducer → tee sama ukuran didahulukan; metatext ("Kelas tekanan hanya disebut…", "data saya belum
      memuat…") dihapus. Eval pemahaman tetap 98,1 %; 10 parafrase audit ditambahkan ke golden set; tes regresi di
      `audit-2026-10-19.spec.ts`. Audit ulang setelah rilis (putaran 2) menemukan dan memperbaiki: "elbow pvc 3 inch
      ada?" dijawab bahasa Inggris (nilai bersatuan dan nama produk kini disisihkan sebelum bahasa dikenali, skor seri =
      tidak jelas); "pralon punya pipa ppr ga?" tidak dikenali (contoh intent); talang 150 m2 tercatat "0,02 ha" (luas
      < 1 ha ditampilkan m²); judul daftar fitting "FITTING PVC, jenis tee, ukuran 2" → "Tee PVC 2""; bell tee 200 mm x
      2" dianggap tee sama ukuran; "kenapa pipa bisa pecah?" dibuka kalimat bocor sambungan; nilai pilihan berhuruf
      kapital di tengah kalimat ("sumber air Sumur"). Putaran 3: "butuh berapa batang pipa 4 meter untuk jalur 30
      meter?" dijawab model meminta data bangunan (topik hitung kini menang atas bentuk pertanyaan sistem; panjang
      jalur = nilai meter terbesar, batang yang disebut dipakai); "harga pipa hdpe 110 mm per meter" dijawab daftar
      ukuran (contoh intent harga, eval 98,7 %); "pipa pvc bisa buat solar/bensin?" dijawab air panas (contoh
      ketahanan kimia); "pdam ke rumah 25 m" menyeret topik pembuangan (contoh sambungan rumah); "kolam lele 10
      kolam" mencatat sumber air "embung / kolam" yang tidak disebut (kolam hanya sumber bila disebut asal air).
- [x] P25-03 Sisa audit + onboarding sekali (pemilik 2026-10-19: "gas selesaiin" dan "kalo user ini udh pernah buka
      website nya tolong wizardnya jangan tampilin lagi"). (1) Topik `sinar matahari` dari teks bersumber (PVC melemah
      karena UV, HDPE hitam tahan matahari) — dulu dijawab cara menyimpan. (2) Contoh produk per bahan dari keluarga
      wakil di kosakata (`representativeFamilies`: PVC → PVC AW, HDPE → HDPE, pipa terkecil) — dulu PVC diwakili "Pipa
      (Bell End) Kelas B 355 mm". (3) Contoh intent harga vs tebal pipa AW diimbangi; eval intent 99,4 %. (4) Wizard:
      status onboarding tamu ikut ke akun saat daftar/masuk (dalam transaksi penautan, tanpa menimpa milik akun);
      browser yang pernah melihatnya tidak menampilkannya lagi walau server bilang pending (server disusulkan); wizard
      ditandai sudah dilihat begitu tampil, jadi menutup tab di tengah jalan tidak memunculkannya lagi; e2e
      `onboarding-once.e2e.mjs` lolos di produksi. (5) Beban: 20 pesan serentak membuat tahap pemahaman menunggu bge-m3
      sampai 73 s di Ollama yang sama dengan 7B, lalu router/penulis timeout ("belum menangkap maksudnya"; "apa itu pipa
      jacking?" bahkan dijawab model "belum tercatat di katalog"). Embedding kini di service `ollama-embed` sendiri, dan
      contoh "apa itu …" serta ketersediaan ukuran fitting ditambah: uji serentak yang sama 21/22 giliran < 5 s, nol
      gagal (sisa: jawaban kartu yang memakai ekstraksi model ±90 s).
- [x] P25-04 Simulasi test case perpipaan (pemilik 2026-10-19: "coba lakukan simulasi menggunakan testcase sambil di
      uji, dari perpipaan dulu, kalo udh ok nanti masuk ke perhitungan"). `evals/live-piping-cases.json` (48 kasus:
      ragam, ketersediaan, ukuran, fitting, dimensi, tekanan, kelas, bahan, aplikasi, pemasangan, pembuangan, harga,
      pesaing, perusahaan, bahasa Inggris, lanjutan multi-giliran) dijalankan `scripts/live-eval.mjs` ke produksi,
      berurutan, dengan aturan teks global (tanpa metatext/basa-basi/"belum menangkap maksud"). Putaran 1: 45/48 lolos
      otomatis, tetapi pembacaan manual menemukan 11 jawaban salah — pemeriksaan diperketat lalu diperbaiki: galvanis
      "katalog belum terpasang" → "bukan produk Pralon"; ukuran jacking dijawab conduit; "pvc d 4 inch ada?" dijawab
      penjelasan kelas dan "7 inch" dijawab proses produksi → jawaban ketersediaan ukuran per keluarga (contoh produk,
      atau "tidak ada" + ukuran tersedia); panjang batang satu produk acak → per keluarga; "pipa pvc aw tahan berapa
      bar?" ditempeli HDPE/MDPE; "yang pe 100 aja" mengulang daftar jenis; "lebih detail dong" dan "boleh" lewat
      perencana model (10–30 s, "luasan bangunan") → lanjutan bersubjek diputuskan kode; "tee pvc ada ukuran apa aja?"
      → daftar ukuran (sempat gagal diam-diam di produksi karena perbandingan inci vs mm melempar); "kalau yang 3/4?"
      dijawab tabel diameter → tee PVC 3/4"; tee HDPE 110 x 110 dianggap reducer. Hasil akhir 48/48. Alat diagnosis
      `understanding.probe.spec.ts` (opt-in `PROBE=`) jadi permanen. Berikutnya: simulasi perhitungan.
- [x] P25-05 Simulasi test case perhitungan (pemilik 2026-10-19: "gas"). `evals/live-calc-cases.json` (17 kasus: rumah
      toren/PDAM/booster/kos, pembuangan, gedung bertingkat, sumur, air hujan, irigasi, kolam, cluster, transfer,
      renovasi ganti semua dan perluasan, bahasa Inggris, dua kasus "Belum tahu") dijalankan
      `scripts/live-calc-eval.mjs`: pesan → kartu klarifikasi → analisis → JSON rekomendasi, dengan aturan global (tanpa
      VERIFIED, produk katalog nyata, kuantitas BOM positif kecuali baris pending, tanpa NaN/metatext). Angka diperiksa
      tangan: 11 titik / 12,6 WSFU / 1,03 l/s Hunter; panjang pipa + 10 % ÷ 4 m per batang; gedung 400 orang × 150 l
      = 60 m³, 3,33 l/s, head 34,16 m, 1,12 kW; air hujan 0,6 × 120 × 150 / 3,6e6 = 3 l/s; kolam 160 m³ / 3 jam.
      Putaran 1: 2/15 — temuan dan perbaikan: (1) lima kasus teknis "Datanya sudah cukup" lalu analisis gagal
      "layanan tidak tersedia" karena "Belum tahu" tercatat diasumsikan tanpa nilai → profil kasus `unknownDefaults`
      (pompa mengisi tandon: `TANK_FILL_FLOW_0_25LS`, tercatat di hasil), parameter kritis lain tetap ditanya
      dengan penjelasan, analisis menjawab VALIDATION_FAILED dan web menampilkan "Hitungannya butuh beberapa angka
      lagi" (dulu "pemahaman bahasa tidak tersedia"); galat analisis tak terduga kini dicatat di log; (2) "hitung pipa
      pembuangannya juga" tidak terbaca (klitik -nya) → air bersih + pembuangan; (3) "tandon … setinggi 7 meter" tidak
      dibaca dan tinggi tandon diam-diam 0 m (head 45,97 m) → dibaca, dan tanpa angkanya sumur tidak dihitung (head kini
      52,97 m); (4) kalimat gedung panjang berbahasa Indonesia dijawab Inggris → franc boleh membatalkan tinyld pada
      kalimat ≥ 8 kata. Hasil akhir: perhitungan 17/17, perpipaan 48/48, FAQ sales 19/19. OQ-74 mencatat default
      dan yang perlu diputuskan (intensitas hujan dan tinggi tandon bersumber, makna "tambah N titik air").
- [x] P25-06 Perbaikan temuan simulasi perhitungan (pemilik 2026-10-19: "lakukan perbaikan dari temuan lu tadi").
      Keputusan pemilik (AskUserQuestion): intensitas hujan "Belum tahu" → 150 mm/jam (`RAINFALL_INTENSITY_150MMH`,
      dipakai engine seperti koefisien limpasan, tercatat di hasil); perluasan "rumah … mau tambah N titik air" →
      rumah yang disebut = beban lama, N = beban baru (`water.addedOutlets`, parser angka "tambah N titik"): pipa
      utama lama dicek terhadap total (`RENOV_ADDED_OUTLET_1_WSFU`, 1 WSFU per titik tambahan), dan BOM hanya untuk
      titik baru — pipa ke alat 1,5 m per titik + 10 %, elbow dan drat kran per titik, cabang dari pipa lama menunggu
      jaraknya (`extension-view.ts`). Tanpa keputusan baru: tinggi toren atap untuk kasus sumur dari jumlah lantai
      (lantai × 3,5 m + dudukan 1 m, asumsi registry yang sama dengan hitungan rumah). Simulasi ulang menemukan dan
      memperbaiki: rumah dengan kamar mandi "Belum tahu" dihitung 0 kamar mandi ("1 titik air") → analisis menolak
      (VALIDATION_FAILED) bila jumlah lantai atau kamar mandi belum diketahui, kecuali tempat ibadah/toilet umum;
      "sumur bor 40 m ke toren atap rumah 2 lantai" masuk jalur rumah (kedalaman hilang, toren dianggap sumber) →
      contoh kasus sumur; tee sambung perluasan memakai cabang terbesar rumah (3/4" × 1") → 3/4" × 1/2". Hasil:
      perhitungan 19/19, perpipaan 48/48, FAQ 19/19.
- [x] P25-07 Antarmuka ikut bahasa pengguna (OQ-73, pemilik 2026-10-20: "Ikut bahasa pengguna"). `message.start`
      membawa `language` giliran (hasil pengenal bahasa P25-01), dan web memasang bahasa antarmuka ke situ. Membuka
      riwayat memasang bahasa terakhir percakapan itu. Tombol bahasa tetap bisa dipakai, dan kalimat berikutnya yang
      bahasanya jelas memindahkannya lagi.
- [x] P25-08 Audit live campuran + daftar pertanyaan sales (pemilik 2026-10-20). Campuran 8/16 → 14/16
      (`evals/live-mixed-cases.json`), daftar sales 69 pertanyaan (`evals/live-sales-faq-2026-10-20.json`), semua
      jawaban dibaca. Perbandingan kelas PVC ("AW sama D", "AW, D, C") jadi satu tabel kelas dengan baris katalog;
      perbandingan bahan dan data katalog ≥ 2 keluarga jadi tabel (> 4 keluarga: keluarga di baris). Topik
      `sambungan transisi` (PVC ke galvanis lewat Faucet Socket/Valve Socket, Master §20.2). Lanjutan terstruktur
      atas subjek produk (ukuran terbaca, atau jenis fitting) melewati perencana model; ukuran di pesan berlaku untuk
      semua aspek; kelas tekanan per ukuran dari semua produk keluarga ("HDPE 110 mm"). Sisa: "which sizes…" Inggris
      dijawab daftar jenis; "galvanis karatan ganti apa" langsung kartu kasus; "yang paling besar" masih lewat
      perencana model. Laporan: Downloads/TESTCASE*SNOUTY*{campuran,pertanyaan-sales}\_2026-10-20.md.

- [x] P25-09 Study case rumah dihitung dulu + jawaban langsung (OQ-75, pemilik 2026-10-20). Rumah yang lantainya
      disebut langsung dihitung: kamar mandi yang belum disebut dianggap 1 per lantai (HOUSE_BATHROOMS_PER_FLOOR_1),
      toren atap, air bersih — ditulis di jawaban, ditanya di kartu, kartu ANALYZE ber-auto dijalankan web. Panjang jalur
      utama dibaca dari teks ("±15 meter"), grounding "15m" diperbaiki. Pertanyaan pesaing satu produk (solvent cement)
      dijawab fakta produk Pralon; "x 6 Meter = 1 batang?" dibuka "Ya"; topik standar pralon. Tekanan kerja per kelas
      tetap ke tim teknis. Hitung live 23/23, sales 69/69.
- [x] P25-10 Pesan rumah tanpa model ekstraksi (pemilik 2026-10-21, AskUserQuestion: "Lewati model utk rumah").
      SC-03/SC-04 (rumah tanpa jumlah lantai) masih 20–40 s menunggu 7B. Kini setiap pesan rumah tinggal dibaca parser
      nilai saja: jumlah dengan kata bilangan ("dua lantai", "kamar mandinya tiga"), titik air tersurat (bukan keran
      wudhu/titik tambahan), kedalaman sumur, dan pompa pendorong ("booster pump", "tanpa pompa booster" = tidak);
      yang tidak disebut ditanya kartu. "Rumah sakit/makan/pompa" bukan rumah tinggal. Live: SC-03 0,3 s, SC-04 0,4 s
      (dulu 20–40 s). Uji ulang menemukan "air limbah perumahan 100 rumah" jatuh ke jalur rumah — contoh `sewerage`
      ditambah di `use-case.json` (eval pemahaman tetap ≥ 95%). Hitung live 23/23, campuran 8/8.

## Phase 26 — Prospek 5A dan penugasan sales (21 Okt 2026)

Pemilik 2026-10-21: SNOUTY juga alat Pralon untuk memantau user yang potensial membeli (konsep 5A); admin
melempar data customer ke sales, dan sales menangkap ringkasan percakapan user dengan AI. Keputusan dan
sisa pertanyaan: OQ-76. Konsep: `docs/PROSPECT_5A.md`.

- [x] P26-01 Dokumen konsep: dua lapis (agregat anonim untuk semua, prospek hanya akun terdaftar), tahap 5A
      dari sinyal nyata, prioritas panas/hangat/dingin, alur admin → sales, ringkasan terstruktur + paragraf
      model, lokasi IP → kota, privasi UU PDP, urutan kerja.
- [x] ✋ CHECKPOINT P26-01 — sisa OQ-76 diputuskan pemilik 2026-10-21: opt-in kontak sales, peran `sales`
      melihat prospek miliknya saja, bobot prioritas dari dokumen, DB-IP Lite.
- [x] P26-02 Instrumentasi (migration 0026): `messages.intent` (label pemahaman, ditulis di latar; jawaban kartu
      = `clarification_answer`) dan `prospect_signals` lewat `@RecordsSignal` di unduh laporan, buka produk (hanya
      pengguna terdaftar), dan kunjungan tautan bagikan (SHA-256 token). Satu baris per jenis × rujukan × pengguna ×
      hari, tanpa IP/teks. Aktivitas terakhir = `MAX(conversations.updated_at)`, tanpa kolom baru. Bukan RabbitMQ:
      insert kecil tanpa ditunggu, seperti jejak audit. Pagar lint: modul `prospect` tidak boleh diimpor
      rekomendasi/engineering/context. 1585 tes (termasuk MySQL) hijau.
- [x] P26-03 Aturan tahap 5A + prioritas, domain murni `modules/prospect/domain/prospect-stage.ts` (11 tes). Label
      pemahaman → tahap lewat `Record<FineIntent, …>` (label baru gagal typecheck sampai tahapnya diputuskan);
      basa-basi, keluhan, dan lanjutan tidak menggeser tahap. Tahap = tertinggi yang dicapai; prioritas = bobot
      tahap TERBESAR × skala proyek terbesar × 0,5^(hari diam/14); skala tak diketahui = rumah. Pagar lint
      diperbaiki: pola lama `**/modules/prospect/**` tidak menangkap impor relatif — kini per lapisan
      (`**/prospect/domain/**` dst.), diverifikasi menolak impor dari rekomendasi.
- [x] P26-04 "Minta dihubungi tim Pralon" (pemilik 2026-10-21: di layar solusi + saat tanya harga; tamu diminta
      daftar dulu). Migration 0027: consent `SALES_CONTACT` + tabel `sales_requests` (sumber `solution`/`price`,
      penekanan ulang dalam 24 jam = permintaan yang sama). `POST /conversations/:id/contact-request` digerbang
      kapabilitas `CONTACT_SALES` (terdaftar). Kartu jawaban harga kini `CONTACT_SALES` (penawaran = sales, bukan
      tim teknis). Gate tamu meneruskan permintaannya setelah daftar/masuk (`then=contact_*`). Opt-in tidak
      tercentang di form daftar + sakelar di menu Akun. PRIVACY.md diperbarui. Layar daftar/akun tetap needs
      design (OQ-21).
- [x] P26-05 Dashboard admin (pemilik 2026-10-21) di `/internal/prospects`: corong 5A (klik = filter), papan prospek
      (prioritas, skala proyek, aktivitas terakhir, dasar kontak) dengan filter dan pencarian, penugasan ke sales,
      dan tab Tim sales (admin menambah lewat email akun terdaftar / mencabut). Migration 0028: peran `sales`,
      tabel `sales_leads` (satu per prospek, dipindah bukan digandakan), admin pertama = akun pemilik (AskUserQuestion).
      Aturan di kode: staf internal bukan prospek; penugasan hanya bila ada opt-in atau "minta dihubungi"
      (OQ-76); izin TERAKHIR yang berlaku. Kejadian dibaca per pengguna sebagai waktu pertama/terakhir per jenis
      dari tabel yang ada, dinilai `assessProspect`. `RequiresRole` kini menerima beberapa peran (admin ATAU
      sales_reviewer). Tautan "Dashboard prospek" di sidebar untuk admin/peninjau. Layar belum didesain (OQ-21),
      tanpa label internal di layar.
- [x] P26-06 Dashboard sales (pemilik 2026-10-21) di `/internal/leads`: daftar prospek yang ditugaskan (urut
      prioritas), ringkasan per prospek — kontak (email, tautan WhatsApp), tahap/prioritas/skala, status baru →
      dihubungi → penawaran → menang/kalah (kalah wajib beralasan), jejak (minta dihubungi, laporan, bagikan),
      konsultasi dari snapshot kebutuhan + rekomendasi terakhir (bangunan, lantai, kamar mandi, sumber air, kasus,
      hasil hitungan engine, pipa utama, produk), kalimat pelanggan terakhir, dan transkrip baca-saja (diaudit).
      Paragraf konteks dari model (tugas `lead_summary`, tier balanced) disusun di latar saat penugasan dan bisa
      disusun ulang; pagar REC-1 (`passesGuards`): angka yang tidak ada di DATA → tanpa paragraf. Sales hanya
      melihat prospek miliknya (lainnya NOT_FOUND); admin/peninjau melihat semua dan membuka ringkasan dari papan.
      Tautan "Prospek saya" di sidebar untuk peran `sales`. Mock `auth-api` di tes menu Akun dilengkapi (galat
      tak tertangani sejak P26-04 yang lolos karena grep hasil tes tidak menangkap baris "Errors").
- [x] P26-07 Penulis `market_events` + tab Pasar + wilayah dari IP. Event lahir saat solusi pertama dihitung atau
      kasus diserahkan ke tim teknis (`@RecordsMarketEvent` dari `shared/market`; rekomendasi tetap tidak
      mengimpor market-intelligence), satu per konsultasi (migration 0029 `conversations.market_recorded_at`),
      tanpa identitas. Wilayah = provinsi dari DB-IP Lite (berkas lokal `deploy.sh geoip`, CC BY 4.0, IP tidak
      disimpan; tanpa berkas event tetap tercatat). Tab Pasar di dashboard admin (`/internal/market` kini
      membukanya): corong, sinyal cakupan, pembuangan, permintaan per provinsi, minat produk, pola proyek, dengan
      kelompok < 5 disebut ditahan. OQ-77 (default berjalan): provinsi bukan kota, wilayah tidak tampil per
      orang, kota dari izin browser belum. Galat tipe di tes P26-06 diperbaiki (tsc tidak dijalankan ulang
      setelah tes ditulis).
- [x] P26-08 Dashboard dirapikan (pemilik 2026-10-21: "pake sidebar ae jo, terus hias dengan chartnya"). Navigasi
      pindah dari tab ke sidebar, tiap bagian punya alamat sendiri (/internal/prospects, /internal/leads,
      /internal/market, /internal/sales-team) dan menunya mengikuti peran; di layar sempit sidebar jadi panel.
      Chart: tahap 5A dan prioritas sebagai batang/stat yang sekaligus filter, corong pasar, tren konsultasi per
      bulan (garis + crosshair, bulan kosong = nol), peringkat provinsi/produk/pola proyek, beban tim sales.
      Satu seri per chart = satu warna token, jadi tidak ada palet kategorikal; makna selalu dibawa teks, dan mode
      gelap ikut sendiri. Gaya tab lama dibuang.
- [x] P26-09 Temuan uji pemilik 2026-10-21 di dashboard: (1) "Halaman ini untuk tim Pralon" padahal perannya
      admin — halaman memanggil API sebelum sesi dipulihkan, 401-nya dibaca sebagai tidak berhak. `apiFetch`
      kini memulihkan sesi juga saat token belum ada tetapi penanda sesi ada (berlaku untuk semua layar),
      dan cangkang dashboard menahan isinya sampai pemulihan selesai. (2) "tulisannya gede2 banget sama
      tebel2" — skala tipografi diturunkan (judul 22→17 px, angka stat 24→20, tebal 600→500 di baris data).
      (3) Ikon garis di menu sidebar, tombol menu, dan tautan kembali; `aria-hidden`, label teks tetap pembawa makna.
- [x] P26-10 Uji alur penuh DI PRODUKSI 2026-10-21, 15/15 (dua akun uji berlabel, dihapus setelah uji; sisa
      hanya satu event pasar yang tidak bisa ditarik karena memang anonim): izin dihubungi → konsultasi →
      analisis → minta dihubungi → papan admin (Act, bisa ditugaskan) → tambah sales → tugaskan → Prospek saya →
      ringkasan (2 lantai, 3 kamar mandi, "Sistem distribusi untuk 10 titik air", pipa utama 1¼") → ubah status →
      kalah tanpa alasan ditolak → transkrip → sales ditolak di papan admin → paragraf konteks dari model
      produksi lolos pagar angka. Login pemilik terbukti membawa peran admin dan keempat endpoint dashboard
      menjawab 200.
- [x] P26-11 Tampilan dirapikan + maskot (pemilik 2026-10-21: "sumpah jelek", "tambahin beberapa maskotnya").
      Skala tipografi turun, ketebalan dikurangi, ikon garis di sidebar. Maskot dipakai TERBATAS — hanya di layar
      kosong (papan, tim sales, prospek sales, pasar) lewat satu komponen `EmptyState`, `aria-hidden`, kalimatnya
      yang membawa makna. Ini mengesampingkan pedoman desain "maskot tidak dipakai di back-office" atas permintaan
      pemilik.
- [x] P26-12 Peta permintaan (pemilik 2026-10-21: "zone by province, klik → zoom ke sebaran titiknya"). Geometri
      Natural Earth (domain publik) disaring + disederhanakan jadi aset 47 KB lewat `apps/web/scripts/build-province-map.mjs`;
      tanpa ubin dari pihak luar. Zona provinsi diwarnai satu hue terang→gelap menurut jumlah konsultasi, hover
      memberi angkanya, klik mem-fokus provinsi dan menggambar titik kota. Migration 0030: `market_events` menyimpan
      kota perkiraan dan koordinat DIBULATKAN 0,1° (±11 km) — tetap anonim, dan ambang k-anonimitas 5 berlaku untuk
      zona maupun titik; yang ditahan dan yang tanpa wilayah disebut di bawah peta.
- [x] P26-13 Peta dan papan dibenahi setelah pemilik menilai ("map nya jelek banget ketika di klik zone nya",
      "halaman prospek ui ux nya jelek dan ngga rapi"). Peta: tinggi bingkai diturunkan dari bounds + koreksi
      kosinus (dulu 380 ditetapkan sendiri sehingga pulau gepeng); label dan titik dibagi faktor zoom supaya
      tetap seukuran di layar; perpindahan bingkai dianimasikan (langsung bila reduced-motion); provinsi lain
      meredup saat satu difokuskan; tooltip jadi elemen HTML supaya teksnya tajam; legenda jadi chip + lencana
      angka. Papan: avatar inisial, ikon per tahap 5A / skala proyek / dasar kontak, kolom pencarian berikon,
      baris lebih lega, kepala tabel menempel saat menggulir, hover baris.
- [x] P26-14 Batang 5A tidak tergambar (laporan pemilik 2026-10-21 + tangkapan layar): `li` DAN tombol di
      dalamnya sama-sama grid tiga kolom, jadi seluruh isi tombol terjepit di kolom pertama dan treknya nyaris
      tak terlihat. Grid kini hanya di satu tingkat. Sekaligus permintaan pemilik "bikin memanjang dan berwarna":
      kartu Tahap 5A dan Prioritas memanjang penuh, batang lebih tinggi (14 px), dan deret 5A bergradasi satu hue
      terang→pekat menurut URUTAN tahapnya (bukan besar angkanya). Tes baru memeriksa isian batang benar-benar
      ada dan lebarnya sebanding.
- [x] P26-15 Tahap 5A jadi lima kartu angka (pemilik 2026-10-21: "card yang isinya counting aja"): angka besar,
      nama tahap berikon, artinya di bawah; tetap tombol filter. Latarnya bergradasi satu hue menurut urutan tahap,
      dan angka pada dua kartu terpekat memakai warna teks aksi agar kontrasnya tetap. Di layar sempit lima kartu
      menjadi tiga lalu dua kolom.
- [x] P26-16 Kartu halaman Pasar dibuat berisi (pemilik 2026-10-21: "minat produk masa cuma tulisan doang? dan
      uppercase semua?"). Kapital semua dibuang dari judul kartu, tag tahap, kepala tabel, judul blok, dan judul
      peta — hanya kicker merek yang tetap kapital. Tiga daftar peringkat (produk, provinsi, pola proyek) memakai
      komponen baru `RankList`: nomor urut, ikon, nama, lencana ukuran, batang, jumlah, dan porsinya terhadap
      keseluruhan. Di atas halaman ada empat angka ringkas (konsultasi, sampai solusi + persennya, menanyakan
      harga, porsi ke tim teknis). Ikon pipa baru untuk kartu produk.
- [x] ✋ CHECKPOINT Fase 26 — **ditutup pemilik 2026-10-21** atas dasar uji produksi 15/15 (P26-10) dan simulasi
      lokal 21/21; penilaian tampilan dicatat terpisah bila ada temuan. OQ-77 diputuskan
      2026-10-21: wilayah tetap agregat, kota dari browser belum perlu. Seluruh item P26-01..07 sudah live. Simulasi HTTP
      ujung-ke-ujung di stack lokal (akun uji admin/sales/pelanggan, bukan produksi) 21/21: opt-in, analisis, minta
      dihubungi → papan (Act, admin bukan prospek) → tambah sales → tugaskan → pasar → Prospek saya, ringkasan, status,
      kalah tanpa alasan ditolak, transkrip, sales ditolak di papan admin, tamu ditolak.
      Uji penulis konteks dengan model PRODUKSI (tanpa akun/data baru) menemukan dan memperbaiki dua hal: paragraf
      menyapa pelanggan ("Pak…") → prompt catatan internal + pagar sapaan; "1 inci" ditolak terhadap DATA `1"` →
      pagar prosa bersama menyamakan 1" = 1 inci = 1 inch. Kini 3/3 paragraf rumah lolos (13–18 s). Suite perpipaan
      live menemukan regresi sejak P25-08 ("pralon jual pipa galvanis?" dijawab cara menyambung) → contoh negatif
      di data topik; 48/48.

## Phase 27 — Masukan pemilik dan Leo atas SNOUTY yang berjalan (23 Okt 2026)

Pemilik 2026-10-23 menyerahkan dua belas hal yang kurang, plus masukan Leo atas laporan
SNTY-2026-10-0020. Urutan kerja: perhitungan dulu (paling bisa diperiksa), lalu percakapan,
lalu layar, lalu data.

- [x] P27-01 Masukan Leo soal perhitungan. (1) **Sok sambungan batang pipa** — Leo: "pipa sisa itu
      di asumsikan bisa langsung nyambung ya?, kan butuh socket buat nyambungnya lagi". Aturan baru
      `ENG-015`: sambungan per jalur menerus = ⌈panjang ÷ panjang batang⌉ − 1, dikali jumlah jalur;
      panjang batang dari produk katalog yang terpilih. Baris BOQ "Sok" kini berangka dengan dasar
      hitungnya, bukan lagi "Dihitung saat pemasangan" — untuk air bersih maupun air kotor/bekas;
      dop, stop kran, dan lem tetap menyusul. (2) **Kerugian tekanan bisa dicek** — Leo: "rumus
      pressure loss di pipa sama fitting nya gw gk bisa langsung cek gitu". Aturan baru `ENG-207`
      menghitung kerugian sambungan dari DAFTAR fitting di jalur kritis (ΣK · v²/2g) dan mencetak
      tiap sukunya; delapan nilai K masuk registry asumsi (`MINOR_K_*`) supaya bisa diganti tim
      teknis tanpa menyentuh rumus. ENG-203 (10 % kerugian gesek) tinggal untuk kasus yang daftar
      fittingnya belum ada. (3) **Satuan di rumus** — rumus Hazen-Williams, kecepatan, dan ukuran
      dari debit kini mencetak substitusinya dalam satuan yang memang dipakai rumusnya (m³/s, m),
      bukan hanya l/s dan mm; tanpa itu angkanya memang tidak bisa dimasukkan ulang. Akibat ikutan:
      `ENG-703` naik ke v3 — dudukan toren yang disarankan ikut menanggung kerugian di pipa tegak
      yang ditambahkan, karena dengan kerugian fitting yang benar saran lamanya masih kurang.
      Rumah contoh Leo: kehilangan sambungan 0,19 m → 0,66 m, tekanan di meteran 1,74 → 1,78 bar.
      Tes baru `checkable-hydraulics.spec.ts` menghitung ulang Hazen-Williams, kecepatan, dan
      ΣK·v²/2g DARI LUAR engine dan membandingkannya — persis cara Leo memeriksa.

- [x] P27-02 Jangan menanyakan ulang apa yang sudah disebut (pemilik 2026-10-23: "spesifikasi beberapa udah
      disebutin, tp snouty malah menanyakan ulang"). Pagar grounding hanya menerima angka yang tersurat PERSIS
      di dekat kata bendanya, lalu diam-diam memakai angka lain yang ada di teks: "tiap lantai ada 2 kamar
      mandi" di rumah 2 lantai tercatat 2, "lantai 1 ada 1 kamar mandi, lantai 2 ada 2" tercatat 1, dan "ada
      dapur" tanpa angka hilang sama sekali lalu ditanyakan lagi. `confirmCount` kini menerima: angka tersurat,
      JUMLAH beberapa angka tersurat, angka tersurat DIKALI jumlah lantai, dan — bila kata bendanya disebut
      lebih sering daripada angkanya ditemukan — bacaan model, asal tidak lebih kecil dari yang tersurat dan
      masih wajar. Tidak cocok satu pun → field tetap kosong dan ditanyakan sekali, bukan diisi angka salah.
      Pagar halusinasi tetap: kata benda yang tidak disebut sama sekali tetap menolak angkanya. Sekalian
      diperbaiki: `(?:a|an)` tanpa batas kata di belakangnya membaca "ada dapur" sebagai "a … dapur" = 1.
- [x] P27-03 Balasan tidak lagi seperti buku teks (pemilik 2026-10-23: "format deliver answer di snouty terlalu
      text book"). Perbandingan bahan dijawab tiga paragraf pendek — apa bedanya, cara menyambungnya, kapan
      memilih yang mana — bukan ringkasan + tabel aspek + simpulan; tebal yang berfungsi sebagai judul dibuang
      dari ikhtisar bahan, ringkasan, dan perbandingan singkat. Tabel yang sama tetap ada dan dipakai saat
      pengguna memintanya ("bikinin tabelnya"), lewat label `format` dari modul understanding — bukan pola
      kalimat. Prompt balasan dan FAQ ditulis ulang: paragraf mengalir, tanpa judul, tanpa tabel atau butir
      yang tidak ada di DATA, tanpa pembuka basa-basi dan penutup ringkasan. Pagarnya hidup di KODE
      (`addsNoStructure`), bukan di prompt: balasan model yang memuat judul Markdown, tabel, butir, atau baris
      seluruhnya tebal yang tidak ada di DATA jatuh ke teks deterministik.

- [x] P27-04 Persetujuan ikut ke akun saat tamu mendaftar (pemilik 2026-10-23: "pastiin ketika udh pernah
      akses, lokasinya nempel"). Keadaan onboarding sudah pindah sejak P24, tetapi consent tidak: izin lokasi
      yang diberikan sebagai tamu hilang begitu orangnya daftar, dan ia ditanya lagi. Penaut tamu→akun kini
      menyalin baris consent TERAKHIR per jenis ke akun, di transaksi yang sama; consent tetap append-only
      (jejak tamunya tidak diubah) dan jenis yang sudah diputuskan akun itu sendiri tidak ditimpa.
- [x] P27-05 Layar muat pertama (pemilik 2026-10-23: "loading snouty untuk awal2 masuk"). `BootGate` menahan
      isi aplikasi sampai sesi dipulihkan dan keadaan onboarding diketahui — dulu ruang konsultasi kosong
      tampil dulu lalu wizard berkedip di atasnya. Layarnya bermaskot, bernama, dan berbar tak tentu (tanpa
      persen yang dikarang); ia menyerah setelah 5 detik supaya API yang diam tidak menyandera siapa pun, dan
      berhenti bergerak pada `prefers-reduced-motion`. Sekalian: keputusan lokasi disimpan di browser dan
      DISUSULKAN ke server saat subjeknya berganti (cookie tamu baru), jadi langkah lokasi tidak muncul lagi.

- [x] P27-06 Tautan bagikan dibenahi (pemilik 2026-10-23: "ui ux pada share link masih perlu dibenahi").
      Pop-up: tiga keadaan dibedakan tegas — belum ada tautan, tautan baru (token di tangan), dan tautan
      aktif dari kunjungan lalu yang tokennya memang tidak disimpan siapa pun; dulu dua tombol "Buat
      tautan"/"Buat tautan baru" berdiri berdampingan dan tidak jelas sedang ada tautan atau tidak. Tautan
      langsung tersalin begitu dibuat (token hanya diterima sekali), ada kirim lewat WhatsApp — ke sanalah
      tautan ini pergi — dan mencabut turun jadi tautan kecil berkonfirmasi, bukan tombol merah sejajar
      "Salin". Halaman `/shared`: memuat, tidak ada, dan gagal masing-masing kartu bermaskot dengan jalan
      keluarnya (gagal punya tombol coba lagi), judul ditemani lencana baca-saja, ada tombol cetak dan gaya
      cetak yang membuang header serta tab — tautan ini sering berakhir di tangan tukang.

- [x] P27-07 Pemberitahuan di dalam aplikasi (pemilik 2026-10-23: "notifikasi belum ada"). Migration 0031
      `notifications`; barisnya menyimpan KEJADIAN (`kind`, `subject_id`, `data`), bukan kalimat — teks
      yang dibaca orang dirakit di web per bahasa, karena kalimat Indonesia yang dibekukan di database
      tidak bisa berbahasa Inggris nanti dan tidak bisa diperbaiki tanpa migration. Tiga kejadian:
      prospek ditugaskan (ke sales itu), ada yang minta dihubungi (ke admin dan peninjau), laporan siap
      (ke pemiliknya, hanya akun). Modul penghasil kejadian bergantung pada port `NOTIFIER` di
      `shared/notification`, bukan pada modul notifikasi — arah dependensinya satu arah, dan menulis
      pemberitahuan tidak pernah menggagalkan pemanggilnya. Loncengnya satu komponen yang dipakai di
      cangkang dashboard dan di ruang konsultasi; tamu tidak merendernya sama sekali, dan "tidak ada
      apa-apa" juga tidak — bukan lonceng kosong yang mengundang klik. Menandai terbaca selalu membawa
      `user_id` di WHERE: id dari klien tidak bisa menyentuh baris orang lain.

- [x] P27-08 Peran sales diuji di jalur perannya (pemilik 2026-10-23: "role sales belum di testing untuk
      melihat summary chat antara user dan snouty"). Tes P26-06 memeriksa `LeadService` langsung; yang
      belum pernah diuji adalah penjaga rute, aktor internal, dan bentuk respons controller. 13 tes baru
      (`sales-role.spec.ts`) memakai MySQL, controller, dan `InternalRoleGuard` sungguhan: peran sales
      lolos ke daftar/ringkasan/status/transkrip, admin dan peninjau lolos, akun biasa ditolak, tanpa akun
      gagal tertutup; ringkasan memuat kebutuhan, kalimat pelanggan (bukan jawaban SNOUTY), dan dasar
      kontaknya; transkrip membawa keempat giliran berurutan; sales lain mendapat NOT_FOUND di semua
      jalur; paragraf konteks menyusul di latar dan bisa disusun ulang.
- [x] P27-09 CRM prospek diperdalam (pemilik 2026-10-23: "CRM mengenai prospek harus di dalemin lebih
      lanjut"). Sampai sekarang yang tercatat hanyalah status SEKARANG — tidak ada jejak kapan dihubungi,
      apa katanya, atau kapan harus ditengok lagi. Migration 0032: `sales_leads.follow_up_at` dan tabel
      `lead_activities` (append-only: catatan, perubahan status beserta alasan kalahnya, penjadwalan,
      penugasan — masing-masing dengan pencatat dan waktunya). Rute `GET :id/activity`,
      `POST :id/notes`, `POST :id/follow-up`, semuanya digerbang peran yang sama. Di layar sales:
      kotak catatan, pemilih tanggal menengok yang menandai jadwal yang sudah lewat, dan garis waktu
      jejaknya; kalimat tiap baris dirakit dari jenis barisnya, bukan dari teks yang dikirim server.
      Gagal mencatat jejak tidak membatalkan tindakannya — ia sudah terjadi.

- [x] P27-10 Dataset FAQ dimatangkan (pemilik 2026-10-23: "matengin lagi mengenai dataset FAQ"). Delapan
      pertanyaan lapangan yang sering datang belum punya topik sama sekali: memotong pipa, membersihkan
      pipa, perbaikan bocor, warna pipa, pipa dicor, pukulan air, kemiringan buangan, bau saluran.
      Semuanya kini punya fakta bersumber di `data/knowledge/pipe-facts.json` — kualitatif, mengutip apa
      yang memang tertulis di materi perusahaan; angka berstatus "perlu validasi" tidak dibawa, dan yang
      belum ada jawabannya (pipa dicor, aturan pukulan air, kemiringan resmi) mendapat `gap` sehingga
      jawabannya menawarkan tim teknis, bukan karangan. Fakta "warna pipa" menjawab salah paham yang
      paling sering: warna menandai lini produk, bukan kelas tekanannya. Dua invarian baru dipaku: tiap
      topik yang bisa dikenali punya fakta atau konsep (topik tanpa jawaban = SNOUTY mengangguk lalu
      diam), dan tiap topik punya minimal lima contoh kalimat.
- [x] P27-11 Contoh pemahaman ditebalkan (pemilik 2026-10-23: "data set tolong matengin lagi tiap poin2
      nya tebelin lagi isiannya"). Delapan kasus emas baru untuk topik lapangan membuktikan masalahnya
      lebih dulu: akurasi intent turun ke 94,8 % dan tidak satu pun topik baru dikenali. Yang ditambah:
      pertanyaan berbentuk GEJALA ("pipanya bunyi", "rembes", "bau got") di `knowledge_question`, contoh
      per topik baru dari arah gejala (orang menyebut "bunyi gedebuk", bukan "water hammer"), contoh
      negatif di `use-case none`, dan penebalan 25 label lama yang paling tipis di intent, company-topic,
      product-aspect, use-case, depth, dan mutation-op. Akurasi intent 99,4 % (171/172) dengan `bge-m3`,
      di atas ambang 95 % (docs/EVALUATION.md). Satu contoh yang hampir menyalin kasus emasnya diparafrase
      — contoh yang sama persis hanya mengukur hafalan — dan satu regresi yang sempat terjadi ("kemarin
      saya beli di toko sebelah" terbaca pertanyaan kompetitor) ditarik kembali: yang menandai kompetitor
      adalah mereknya, bukan kata "toko". Sekalian: `hookTimeout` vitest dinaikkan ke 60 detik — fixture
      MySQL menurunkan lalu menaikkan seluruh migration tiap suite, dan sejak migration bertambah batas
      10 detik terlampaui, meninggalkan skema setengah jadi yang menggagalkan jalan berikutnya.

- [x] P27-12 Format perhitungan teknis ditinjau ulang terhadap laporan SNTY-2026-10-0020 (pemilik
      2026-10-23: "format perhitungan teknis perlu divalidasi lagi"). Dua cacat penyajian yang terlihat
      di laporan itu: (1) langkah hitung bernomor memuat judul yang sama persis dua kali — ENG-102 untuk
      tiap ukuran cabang, ENG-602/604 untuk air kotor dan air bekas — sehingga pembaca tidak tahu baris
      mana membicarakan jalur mana; judulnya kini dibedakan oleh UKURAN yang dihasilkan langkah itu
      sendiri (`stepQualifier`), hanya bila aturannya memang berulang. (2) Baris "Pipa air kotor" dan
      "Pipa ventilasi air kotor" di tabel ukuran memuat paragraf alasan yang identik — seluruh cerita
      beban diulang di baris yang sebenarnya hanya soal ventilasi; baris ventilasi kini menjelaskan
      ventilasinya: ukurannya, setengah diameter jalur yang dilayaninya, dan mengapa ia ada. Satuan dan
      rincian per fitting sudah diperbaiki di P27-01.

- [x] P27-13 Uji 67 pertanyaan pemilik DI PRODUKSI, lalu jawabannya dibaca satu per satu (pemilik
      2026-10-23: "coba testing dari pertanyaan2 ini lalu lu review jawabannya masuk akal apa ngga").
      Daftar Duta/Angel/Edo (52) + product knowledge + study case; skrip baru `ask-eval.mjs` hanya
      bertanya dan menyimpan jawabannya — tanpa pola yang dicocokkan, karena pola yang lolos tidak
      berarti jawabannya masuk akal. Suite emas FAQ tetap 19/19. Enam jawaban memang tidak masuk akal,
      semuanya karena TOPIK yang nyasar (diagnosa dengan probe bge-m3, bukan tebakan): "lagi ngerjain
      renovasi kamar mandi" dijawab PPR/air panas karena contoh air panas menyebut kamar mandi;
      "butuh pipa conduit" menyeret topik `aplikasi` sehingga dua paragraf tak relevan menempel;
      "air buangan kamar mandi" terbaca `bertekanan vs gravitasi` sehingga dibuka cerita air bersih;
      "uPVC SNI air bersih buat jalur apa aja + boleh air panas?" hanya terjawab separuhnya. Diperbaiki
      di DATA: contoh negatif untuk cerita proyek, penguatan `conduit`, `pipa pembuangan`, `aplikasi`,
      dan `air panas`. Tiga fakta yang tidak menjawab pertanyaannya juga diperbaiki: jumlah jenis
      solvent cement (dua, quick/slow dry), "MDPE itu khusus gas ya?" (bukan — bahan yang sama dipakai
      untuk air; yang membedakan warna dan penandaannya), dan nama lini "Pipa Gold JIS" (bersumber
      pralon.com, tidak ada di katalog ERP). Empat kasus emas baru menjaga semuanya; akurasi intent
      tetap 99,4 %. Sekalian: perbandingan kelas AW/D/C ikut jadi prosa — tabelnya tinggal data
      katalog (ukuran, panjang batang) yang memang berkolom.

- [x] ✋ CHECKPOINT Fase 27 — seluruh dua belas hal yang disebut pemilik 2026-10-23 selesai dan LIVE di
      ai.pralon.co.id (empat rilis: migration 0031–0032 dengan backup dikonfirmasi lebih dulu). Verifikasi
      akhir: 1690 tes API + 248 tes web + 521 tes engineering hijau; akurasi pemahaman intent 99,4 % dengan
      bge-b3 (ambang 95 %); suite emas FAQ 19/19 di produksi; dan 67 pertanyaan pemilik dijawab masuk akal
      66/67 — laporan lengkapnya `~/Downloads/TESTCASE_SNOUTY_pertanyaan-pemilik_2026-10-23.md`.
      Satu catatan yang tidak diperbaiki dan sengaja dilaporkan: pertanyaan produk yang butuh model bahasa
      ("fitting elbow 90 derajat 3/4\"") dijawab 4–8 detik bila ditanya sendiri, tetapi pada uji berurutan
      sempat kehabisan waktu 90 detik karena model 7B di server melayani giliran sebelumnya — jawabannya
      lalu jatuh ke "Maaf, saya belum menangkap maksudnya". Itu soal kapasitas model di server, bukan
      pemahaman; pemisahan penyandi sudah dilakukan di P25-03, yang tersisa adalah model generatifnya.
      Pelajaran yang berulang tiga kali di fase ini dan layak diingat: **contoh berbentuk RANGKA kalimat**
      ("produk Pralon buat … apa") menarik kalimat mana pun yang berangka sama; contoh yang berguna selalu
      membawa kata pembedanya. Dua kali ia membuat jawaban yang tadinya benar jadi salah, dan dua-duanya
      baru ketahuan karena seluruh 67 pertanyaan dijalankan ulang setelah tiap perbaikan.

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
| ENG-711 | Tank stand options: roof slab vs tank tower, residual pressure per support (P22-04)                                               | user feedback 2026-10-16    | REQUIRES_DOMAIN_VALIDATION | OQ-67        |
| ENG-901 | Existing pipe capacity for the total load after an extension, compared by outer diameter (P23-01)                                 | owner request 2026-10-19    | REQUIRES_DOMAIN_VALIDATION | OQ-71        |
| ENG-902 | Tie-in to the existing pipe: solvent tee / threaded sockets + tee / HDPE tee / PPR fusion → technical team (P23-01)               | field practice              | REQUIRES_DOMAIN_VALIDATION | OQ-71        |
| ENG-903 | Partial replacement: replaced length ratio and rejoin couplings (P23-01)                                                          | field practice              | REQUIRES_DOMAIN_VALIDATION | OQ-71        |
| ENG-904 | Total load after an extension = existing + new (P23-01)                                                                           | owner request 2026-10-19    | REQUIRES_DOMAIN_VALIDATION | OQ-71        |
| ENG-015 | Sockets between pipe rods: ⌈run length ÷ rod length⌉ − 1 per continuous run (P27-01)                                              | Leo feedback 2026-10-22     | REQUIRES_DOMAIN_VALIDATION | —            | —    |
| ENG-207 | Minor loss from the fitting list on the critical path: ΣK·v²/2g, K per type (P27-01)                                              | K-factor tables             | REQUIRES_DOMAIN_VALIDATION | —            | —    |
| ENG-406 | Domestic wastewater flow from house connections: 80 % return, peak 2.5 (P22-05)                                                   | planning criteria SPALD-T   | REQUIRES_DOMAIN_VALIDATION | OQ-70        |
| ENG-407 | Minimum network sewer size 6" / 150 mm (P22-05)                                                                                   | planning criteria SPALD-T   | REQUIRES_DOMAIN_VALIDATION | OQ-70        |
| ENG-408 | House connections from population: ceil(people / 5) (P22-05)                                                                      | SPAM planning criteria      | REQUIRES_DOMAIN_VALIDATION | OQ-70        |

## Session Log

| Date       | Items worked on                   | Result                                                                      | Branch / commits                   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | --------------------------------- | --------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-13 | P17-01 … P17-10 (DD-01)           | 10/10 selesai, live                                                         | `phase-1/P1-01-catalog-foundation` | Perbaikan laporan dari 10 butir pemilik: mockup disetujui (`design-input/mockups/2026-10-13-solusi-laporan-v2.html`), BOQ satu sumber dengan tab Produk, dasar perhitungan dan asumsi berkategori, ringkasan bergambar (pustaka 85+8 ilustrasi di `@snouty/ui`), kartu pertanyaan bergambar, foto produk pralon.com (AW/VP/Jacking; D/VU/fitting → OQ-62), PDF v2, denah (potongan + per lantai) dan "Coba ubah" (endpoint skenario tanpa simpan). Migration 0023 (`needs`). Aturan baru: keputusan pemilik selalu berupa pilihan. Kesalahan: satu commit P17-06 sempat lolos tanpa lint (hex mentah) — diperbaiki commit berikutnya. Tulisan "SNI 06-0084" karangan di gambar pipa mockup dihapus.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
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

## Phase 28 — Yang bisa dikerjakan tanpa menunggu siapa pun (23 Okt 2026)

Setelah Fase 27 pemilik ditanyai apa yang masih kurang, lalu menjawab: "kerjain yang bisa lu
kerjain sendiri dulu". Daftar yang tersisa terbagi dua — yang butuh orang Pralon (ahli domain
OQ-06, foto produk OQ-62, daftar harga OQ-04, kredensial n8n OQ-08) dan yang tidak. Fase ini
mengerjakan yang kedua.

- [x] P28-01 Pengingat tindak lanjut yang berbunyi sendiri. P27-09 menyimpan KAPAN sebuah prospek
      perlu ditengok lagi, tapi tidak ada yang membangunkan sales-nya: tanggalnya hanya memerah bila
      layarnya kebetulan dibuka — jadwal yang hanya terlihat oleh yang sudah ingat bukan pengingat.
      Sapuan tiap seperempat jam di `ProspectModule` (pola yang sama dengan pembersihan lampiran
      `UploadsModule`, bukan penjadwal baru) memanggil `LeadService.remindDueFollowUps()`, yang
      mengirim kejadian `follow_up_due` ke sales yang ditugaskan. Migration 0033 menambah
      `sales_leads.follow_up_reminded_for` — menyimpan JADWAL yang sudah diingatkan, bukan `1`/`0`,
      supaya menggeser tanggal tengok membuat pengingatnya berbunyi lagi tanpa ada yang perlu
      meresetnya. Prospek yang sudah menang atau kalah dilewati. Penandaan berjalan SEBELUM
      pemberitahuan: pengingat kembar lebih merusak kepercayaan pada loncengnya daripada satu
      pengingat yang telat sekali sapuan.
  - [x] P28-01a Tes (6, MySQL nyata): yang jatuh tempo diberitahu dengan nama prospeknya, yang belum
        tiba dibiarkan, sapuan kedua tidak mengulang, jadwal yang digeser berbunyi lagi, menang/kalah
        dilewati, prospek tanpa jadwal tidak pernah muncul. Web (2): kalimat Indonesia dan prospek
        tanpa nama tetap utuh

- [x] P28-02 Model yang kehabisan waktu tidak lagi berpura-pura tidak paham. Di uji 67 pertanyaan
      (P27-13) satu pertanyaan produk yang sepenuhnya jelas — "fitting elbow 90 derajat 3/4 inch" —
      dijawab "Maaf, saya belum menangkap maksudnya" semata karena model 7B sedang padat; sendirian
      ia dijawab benar dalam 4–8 detik. Dua perbaikan, keduanya di sisi yang memang bisa diubah
      tanpa menambah mesin (`OLLAMA_KEEP_ALIVE=24h` dan `OLLAMA_NUM_PARALLEL=1` sudah terpasang
      sejak Fase 15/25): (1) **bacaan cadangan** — `rankedFallbackIntent` memakai label teratas
      `intentRanking` milik pemahaman, yang selama ini dibuang begitu saja saat skornya di bawah
      ambang; mekanisme berbasis contoh yang sama, hanya dengan bar lebih rendah, dan HANYA saat
      model generatif tidak menjawab. Pagarnya: cadangan tidak pernah menghasilkan intent yang
      mengekstrak — mengubah kebutuhan atas bacaan lemah justru kesalahan yang paling mahal
      (CONTEXT_ENGINE §6). (2) **Kalimatnya jujur** — bila cadangan pun tidak ada, `modelUnavailable`
      membawa balasan "giliran ini kehabisan waktu di saya, bukan karena pertanyaannya", bukan
      menyuruh pengguna memperjelas kalimat yang sudah jelas.
  - [x] P28-02a Tes (5): label teratas dipakai, intent yang mengekstrak ditolak cadangan, tanpa
        peringkat ditandai model tidak tersedia, keyakinan rendah DARI model tetap ragu biasa, dan
        pipeline mengucapkan kalimat yang benar

- [x] P28-03 Layarnya dilihat sendiri, bukan hanya diuji. Sampai sekarang tampilan yang dikirim
      Fase 27 hanya dibuktikan lewat tes dan smoke HTTP; tidak ada yang pernah membukanya. Chromium
      Playwright (yang memang sudah dipakai worker untuk PDF) dipakai memotret layar produksi dan
      layar lokal yang perlu masuk akun. **Satu cacat nyata ditemukan dan ditutup:** di back-office
      lonceng pemberitahuan duduk di KAKI sidebar kiri, dan panelnya membuka ke bawah-kanan — jadi
      separuhnya terpotong tepi kiri layar dan sisanya jatuh di bawah lipatan. Lonceng kini punya
      `placement`; di kaki sidebar panelnya naik dan berpaut ke tepi kiri. Yang diperiksa dan
      bersih: muat awal, onboarding, konsultasi (desktop dan 390px), tautan bagikan yang tidak
      berlaku (kartu maskot muncul sebagaimana mestinya), papan prospek, pasar, dan panel lonceng
      di ruang konsultasi — keempat jenis kalimatnya terbaca wajar, termasuk `follow_up_due` yang
      baru. Tidak ada galat konsol dan tidak ada gulir mendatar di satu layar pun.
      **Cacat kedua, ditemukan saat memeriksa perbaikan yang pertama:** panel yang sudah naik pun
      masih ditembus teks kepala tabel. Panelnya opak dan ber-`z-index` 60, tetapi sidebar back-office
      `position: sticky` tanpa `z-index` — ia punya konteks tumpukan sendiri, dan kepala tabel yang
      juga melekat (z-index 1, lebih belakang di DOM) menang atas seluruh isi sidebar. Sidebar kini
      `z-index: 20`.
  - [x] P28-03a Tes (2): arah panel baku ke bawah, dan naik saat `placement="above"`.
        Tumpukan diperiksa di browser sungguhan, bukan di jsdom — jsdom tidak menyusun lapisan

- [x] P28-04 Satu navigasi untuk seluruh back-office. Ketahuan saat layarnya dibuka satu per satu:
      back-office punya DUA sidebar yang tidak saling menyebut — papan prospek (prospek, prospek
      saya, pasar, tim sales) dan alat internal (katalog, validasi aturan, peninjauan email, antrean
      teknis). Dari yang satu tidak ada jalan ke yang lain, dan **separuh "alat" tidak punya satu pun
      tautan dari dalam aplikasi**: layar katalog hanya bisa dibuka dengan mengetik alamatnya, jadi
      pemegang `catalog_admin` tidak akan pernah menemukannya. Daftarnya kini satu
      (`back-office-nav.ts`) dan dipakai kedua cangkang. Perannya mengikuti PERSIS apa yang dituntut
      API tiap layar (`RequiresRole`), supaya menu tidak pernah menjanjikan layar yang lalu ditolak.
  - [x] P28-04a Tes (7): admin melihat papan dan alatnya, katalog hanya untuk `catalog_admin`,
        antrean teknis hanya untuk admin, sales hanya prospeknya sendiri, tamu tidak melihat apa pun,
        pasar tidak muncul dua kali walau kedua daftar menyebutnya, label ikut bahasa

- [x] P28-05 Yang harus diisi pemilik akhirnya tertulis. `deploy/env.production.example` tidak pernah
      memuat `N8N_HANDOFF_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `TECH_HANDOFF_TARGET`, atau
      `PRICING_ENABLED` — jadi satu-satunya cara mengetahui bahwa "Kirim ke tim teknis" tidak pernah
      benar-benar mengirim email adalah membaca kode worker. Keempatnya kini ada beserta bentuk
      payload webhook dan cara tanda tangannya diverifikasi, dan `docs/DEPLOYMENT.md` §0 menyebutnya
      di tabel "yang harus disiapkan pemilik" dengan keadaan sebenarnya per 2026-10-23.

**Dua catatan koreksi yang muncul dari memeriksa layarnya sendiri.** (1) Dashboard pasar bukan lagi
"cangkang minimal" seperti yang masih tertulis di P12-03: sejak P26-07/P26-16 ia punya empat angka
ringkas, peta permintaan per provinsi, tren bulanan, dan tiga daftar peringkat, lengkap dengan
penyebutan berapa kelompok yang ditahan ambang k-anonimitas. (2) Halaman akun (OQ-53) juga sudah
ada — sebagai pop-up dari kaki sidebar, sesuai permintaan pemilik, bukan halaman tersendiri.
Keduanya sempat dilaporkan sebagai "yang masih kurang" karena catatan fase lamanya tidak pernah
diperbarui; yang kurang hanyalah catatannya.

**Penutup Fase 28.** Lima item selesai dan live di ai.pralon.co.id (release 2026-10-23, migration
0033 dengan backup dikonfirmasi). Tes: API 1701 lulus (2 dilewati), web 259 lulus, engineering 521
lulus. Yang SENGAJA tidak dikerjakan karena memang butuh orang lain, bukan karena terlewat:
ahli domain (OQ-06), foto produk (OQ-62), daftar harga (OQ-04), kredensial n8n (OQ-08), dan
peninjauan email yang belum punya satu pun email masuk untuk ditinjau.

- [x] P28-06 Jawaban yang mencampur katalog Pralon dengan industri. Pemilik 2026-10-23 mengirim satu
      jawaban produksi: untuk "adakah jenis pipa terbaru setelah HDPE dan uPVC untuk air bersih /
      air minum?", SNOUTY menjawab "tidak tersedia jenis pipa terbaru ... karena keduanya merupakan
      opsi utama" lalu melempar ke tim teknis. Dua kesalahan sekaligus — **tidak ada di katalog
      Pralon disimpulkan sebagai tidak ada di industri**, dan **eskalasi dipakai sebagai pengganti
      jawaban yang sebenarnya ada**. Sumbernya satu fakta tersimpan yang terlalu luas: "selain PVC
      dan HDPE ada bahan pipa apa lagi?" mendapat kalimat yang persis sama, jadi satu fakta
      menyambar seluruh kelompok pertanyaan tentang bahan. Sistem bahkan sudah tahu lebih baik di
      tempat lain — fakta `air panas` menyebut PPR dan menandainya bukan produk Pralon.

      Yang diubah, semuanya di data: (1) fakta `jenis pipa baru` ditulis ulang — menjawab langsung
      bahwa tidak ada satu bahan "generasi berikutnya" yang menggantikan keduanya, menyebut PP-R
      (ISO 15874), PE-X (ISO 15875), dan PE-RT (ISO 22391) beserta keunggulan dan batasnya,
      menyebut HDPE mengikuti ISO 4427 yang diadopsi sebagai SNI 4829, dan menutup dengan
      pemisahan tegas: yang dibuat Pralon uPVC dan HDPE, sisanya bukan produk Pralon. `gap`-nya
      dihapus sehingga kartu "kirim ke tim teknis" tidak lagi muncul untuk pertanyaan yang sudah
      terjawab. (2) Topik baru `bahan di luar katalog` untuk pertanyaan bahan secara umum — PP-R,
      PE-X, PE-RT, tembaga, stainless, ductile iron, baja, GRP, galvanis — dengan penutup bahwa
      yang direkomendasikan tetap produk Pralon dan bahan lain disebut sebagai konteks.
      (3) Fakta `air minum` ditambah aturan yang diminta pemilik: bahan yang lazim dipakai
      mengalirkan air belum tentu dinyatakan aman untuk kontak air minum — yang menentukan
      sertifikat kontaknya (NSF/ANSI 61, WRAS/BS 6920, KTW–DVGW W270), dan skema-skema itu
      nasional, tidak saling menggantikan. Tiap fakta membawa nomor standarnya sebagai sumber.
  - [x] P28-06a Tes: knowledge-answer (2 baru) memaku jawaban menyebut PP-R/PE-X/PE-RT, menutup
        dengan "bukan produk Pralon", dan **tidak lagi menghasilkan gap**; 5 kasus emas baru
        (245 → 250). Contohnya membawa kata pembeda (nama bahan, "selain"), bukan rangka kalimat.
        Evaluasi penyandi sungguhan tetap 99,4% intent dan seluruh topik lulus

**Verifikasi P28-06 di produksi (23 Okt 2026).** Lima pertanyaan yang dulu salah kini dijawab benar
dalam 180–390 ms tanpa kartu eskalasi. Seluruh 67 pertanyaan pemilik dijalankan ulang setelah
perubahan data — tidak ada jawaban lain yang berubah, dan paragraf bahan umum tidak bocor ke satu
pun dari 67 itu. Dua pertanyaan kasus (#65 90 s, #66 17 s) masih terkena kelambatan model di CPU;
keduanya tetap terjawab benar, bukan jatuh ke "belum menangkap maksudnya" seperti sebelum P28-02.

## Phase 29 — Back-office yang akhirnya bisa dipakai (23 Okt 2026)

Lanjutan langsung dari P28-03 ("lihat layarnya sendiri"). P28-03 memotret layar yang sudah jadi;
P28-04 memberi tautan ke empat layar alat internal yang sebelumnya hanya bisa dibuka dengan mengetik
alamatnya. **Keempatnya belum pernah dibuka siapa pun** — dan begitu dibuka, isinya ternyata bukan
layar kerja melainkan catatan pengembang: nomor item di sebelah tiap menu (`P1-10b`, `P6-09`),
spanduk "MENUNGGU DESAIN (OQ-21)", dan satu kartu per layar yang menyebutkan nomor pertanyaan
terbuka. Pemegang `catalog_admin` tidak tahu apa itu OQ-07, dan tidak perlu tahu.

- [x] P29-04 Sesi yang terlempar sendiri. Ditemukan saat memotret: membuka beberapa layar
      back-office berturut-turut membuat layar berikutnya berkata "Halaman ini untuk tim Pralon.
      Masuk dengan akun yang punya akses" — padahal akunnya benar. Sebabnya `POST /auth/refresh`
      berbagi kuota dengan login: **sepuluh per seperempat jam per alamat IP**, dan setiap muat
      halaman menembaknya sekali untuk memulihkan sesi. Satu kantor Pralon duduk di balik SATU
      alamat IP, jadi orang kesembilan hari itu terlempar tanpa pernah salah kata sandi. Kuotanya
      kini terpisah: pemulihan 300 per seperempat jam, sedangkan pemulihan yang **gagal** tetap
      ketat (20) — di situlah tebak-menebak cookie tinggal, dan cookie-nya sendiri rahasia 256-bit
      yang dirotasi tiap pakai. Komentar lama di `rate-limits.ts` sudah menyebut yang dihambat
      adalah credential stuffing; refresh memang tidak pernah termasuk di dalamnya.
  - [x] P29-04a Tes (6): kuota refresh dipakai dan bukan kuota login, keberhasilan tidak menyentuh
        kuota kegagalan, cookie salah dan tanpa cookie sama-sama dihitung gagal, kegagalan bertubi
        berakhir 429 bukan 401, dan kuota refresh jauh lebih longgar daripada login

- [x] P29-01 Antrean teknis yang bisa dilihat dan dikerjakan. Baris handoff tersimpan sejak P8-07
      dan `HandoffService.queue()` sudah ada sejak itu, tetapi **tidak ada satu pun rute yang
      membacanya selain rute worker** — layarnya hanya memuat kalimat "antrean dan isinya sudah
      tersimpan dan bisa dibaca". Selama tujuan email belum diisi (OQ-08), layar inilah satu-satunya
      jalan kasus pengguna sampai ke manusia, jadi sampai hari ini setiap kasus yang diserahkan
      berhenti di tempat yang tidak dibuka siapa pun. Sekarang: `GET /internal/handoff` (daftar yang
      belum selesai dan sepuluh yang terakhir ditutup) dan `POST /internal/handoff/:id/status`,
      keduanya untuk `technical_team` dan `admin`. Layarnya menjawab tiga hal sekali pandang —
      siapa yang menunggu, sudah berapa lama, dan apa yang sudah diceritakannya — dengan asumsi
      sistem dipisah dari yang dinyatakan pengguna, persis seperti di email kasus. **Kontak
      pengirim ikut**, karena menjawab kasus butuh alamat dan dasarnya permintaan pengguna sendiri,
      bukan izin pemasaran (`docs/PRIVACY.md` §3); kasus dari tamu tetap muncul dan dikatakan apa
      adanya. Tenggat "1×24 jam kerja" dihitung di server (`handoff-sla.ts`, fungsi murni): hanya
      hari kerja yang memakan jam, batas harinya WIB tetap, hari libur nasional belum ikut (OQ-78).
      Kasus yang sudah ditutup dinilai pada waktu penutupannya — "terlambat 40 hari" untuk kasus
      yang selesai tepat waktu adalah angka yang benar secara aritmetika dan salah secara makna.
  - [x] P29-01a Tes: SLA (6, termasuk batas hari WIB dan akhir pekan yang tidak memakan jam),
        repository MySQL nyata (5: yang diambil tetap terbuka, penutupan mengisi stempel waktu,
        membuka kembali menghapusnya, kontak terdaftar ikut, tamu tanpa kontak), service (5), dan
        layar (8: kasus benar-benar tampil, kontak bisa dibalas, tamu dikatakan apa adanya,
        keterlambatan ditandai, status berpindah lewat API, yang tertutup bisa dibuka lagi)

- [x] P29-02 Layar katalog menampilkan katalognya. `GET /internal/catalog/versions` dan promosi
      draft sudah ada sejak Fase 1; layarnya tidak menampilkan satu baris pun dan memberi tahu
      pembacanya bahwa daftar versi "sudah tersedia lewat API" — kalimat yang tidak berarti apa pun
      bagi pemegang `catalog_admin`. Sekarang: versi yang sedang dipakai, draft yang bisa
      dipromosikan, dan beberapa arsip terakhir (sisanya cukup disebut jumlahnya — riwayat puluhan
      versi menenggelamkan satu-satunya tindakan di layar itu). Yang disebut paling keras adalah
      **katalog contoh**: selama versi aktifnya `sample`, jawaban produk bukan data Pralon, dan itu
      harus terlihat sebelum ada yang mempercayainya.
  - [x] P29-02a Tes (8): versi aktif beserta sumber dan tanggalnya, peringatan katalog contoh
        muncul untuk versi aktif dan tidak muncul untuk katalog Pralon, draft bisa dipakai, arsip
        tidak menawarkan tombol itu, riwayat dibatasi dan sisanya disebut jumlahnya, draft tidak
        pernah tersembunyi di balik arsip

- [x] P29-03 Satu cangkang, dan tanpa catatan pengembang di layar orang Pralon. P28-04 menyatukan
      daftar navigasinya, tetapi cangkangnya masih dua: papan prospek punya gerbang peran, lonceng
      pemberitahuan, menu layar sempit, dan nama akun — sedangkan cangkang alat internal tidak punya
      satu pun dari itu, sehingga **layar alat terbuka untuk siapa saja yang mengetik alamatnya**
      dan lonceng menghilang begitu seseorang pindah ke sana. `InternalShell` dihapus; keempat
      layar alat kini memakai `DashboardShell`. Nomor item dan nomor pertanyaan terbuka hilang dari
      layar: validasi aturan dan peninjauan email — yang memang menunggu orang, bukan menunggu kode
      — mengatakannya dengan kalimat biasa ("menunggu persetujuan ahli pipa Pralon", "kotak masuknya
      belum tersambung"). Peran antrean teknis di menu disamakan dengan yang dituntut API-nya:
      `technical_team` tidak pernah disebut sama sekali sebelum ini.
  - [x] P29-03a Tes: navigasi (8, termasuk `technical_team` melihat antrean teknis), dan tes
        cangkang lama yang ikut terhapus bersama berkasnya

**Cacat yang baru terlihat setelah dibuka di produksi (P29-03).** Layar validasi aturan dan
peninjauan email tidak memanggil API sama sekali, jadi tidak ada 401 yang menolak siapa pun:
mengetik alamatnya sudah cukup untuk membukanya sebagai tamu. Dua layar lain aman hanya karena
API-nya kebetulan menolak. Gerbangnya kini di cangkang, memakai daftar peran yang sama dengan
menu — "yang tidak boleh dibuka tidak ditampilkan" berlaku untuk alamat yang diketik juga.
Diperiksa ulang di produksi sesudahnya: keempat layar menolak tamu, tanpa galat konsol.

**Penutup Fase 29.** Empat item live di ai.pralon.co.id (dua rilis, 2026-10-23; tanpa migration).
Tes: API 1725 lulus (2 dilewati), web 273 lulus, engineering 521 lulus. Yang dipakai untuk
memeriksanya: Chromium Playwright milik worker, 13 layar × 2 lebar, lokal untuk yang perlu masuk
akun dan produksi untuk yang tidak — cara yang sama dengan P28-03, dan sekali lagi yang menemukan
cacatnya adalah membuka layarnya, bukan menjalankan tesnya.

## Phase 30 — Jawaban pengetahuan pipa (26 Okt 2026)

Keluhan pemilik 2026-10-26: "untuk jawab pertanyaan2 yang tentang pipa yang berupa pengetahuan
masih dongo banget ai jawabnya". Diukur lebih dulu, bukan ditebak: 25 pertanyaan pipa yang wajar —
belum pernah dipakai menyetel data atau kode — dikirim apa adanya ke produksi
(`evals/knowledge-probe-2026-10-26.json`, `scripts/ask-eval.mjs`). **Tujuh terjawab.** Tiga pola
kegagalannya berbeda, dan obatnya juga berbeda:

1. **Topiknya tidak ada** (9): thrust block, kelas kekakuan SN, PVC-O, jarak klem, HDPE memanjang
   kena panas, batas gulungan, kolam renang, akar pohon, pipa sumur bor. Semuanya jatuh ke ikhtisar
   seluruh katalog ("Katalog Pralon memuat 7.664 produk dalam 24 keluarga…") setelah 19–31 detik.
   "Kenapa air keran kecil padahal toren penuh?" dijawab 71 detik lalu "di luar urusan pemasangan
   pipa yang bisa saya bantu".
2. **Topiknya salah ditangkap** (6): "pipa pvc boleh dibengkokkan dengan cara **dipanaskan**?"
   dijawab "Tidak — pipa PVC tidak bisa menggantikan PPR untuk air panas"; "**jarak** klem pipa
   tegak?" dijawab tabel panjang batang; "beda SDR 11 dan SDR 17?" dijawab "Ukuran berapa?";
   "apa itu PVC-O?" dijawab "Material untuk Pipa (Bell End) Kelas B 355 mm belum tercantum di
   katalog"; dan "apa bedanya pipa tekan dan non tekan?" jatuh ke ikhtisar katalog padahal topik
   `bertekanan vs gravitasi` sudah ada.
3. **Jawaban nempel** (3): pertanyaan ventilasi saluran dijawab benar di paragraf pertama, lalu
   disusul dua paragraf kelas AW/D dan tabel panjang batang yang tidak ditanya.

Akarnya satu dan struktural: seluruh pengetahuan pipa SNOUTY adalah 52 topik tulisan tangan (42
fakta + 18 konsep), sementara pertanyaan pengguna tidak terbatas. **Keputusan pemilik 2026-10-26
(lewat pilihan):** tutup ekornya dengan model yang memang mampu, dipagari kode; dan angka umum
boleh muncul asalkan menyebut standarnya dan dinyatakan bukan angka resmi Pralon.

- [x] P30-01 Jalur pengetahuan pipa umum. Pertanyaan teknik pemipaan yang tidak punya topik di data
      kini dijawab model yang ditunjuk sendiri (`LLM_MODEL_KNOWLEDGE` + `KNOWLEDGE_BASE_URL`, pola
      yang sama dengan `EMBEDDING_BASE_URL`: jalur ini boleh ke penyedia hosted sementara
      pemahaman, ekstraksi, dan embedding tetap di Ollama lokal). Gerbangnya sempit — fakta
      bersumber selalu menang, dan jalur ini hanya jalan bila tidak satu pun topik cocok, tidak ada
      aspek spesifikasi yang ditanya, bukan permintaan format, bukan lanjutan, dan intent-nya bukan
      yang sudah dijawab kode (ragam, perbandingan, konsep bahan, harga, perusahaan, pesaing).
      Karena ia **mendahului** pemeta pertanyaan, panggilan model 19–31 detik yang dulu berakhir di
      ikhtisar katalog tidak lagi terjadi.

      Pagarnya di kode, bukan di prompt: jawaban yang menyebut **Pralon** ditolak (tanpa DATA tidak
      ada yang bisa membuktikan klaim tentang Pralon — kalimat Pralon-nya hanya boleh lahir dari
      katalog dan fakta bersumber), merek lain ditolak, dan bentuk buku teks ditolak (judul, tabel,
      daftar butir, label bagian tebal). Setiap jawaban yang memuat angka atau penanda teknis
      ditempeli baris provenance "praktik dan standar umum, bukan spesifikasi Pralon" — ditempelkan
      kode, karena provenance tidak boleh bergantung pada kepatuhan model. Gagal, lewat batas waktu
      (20 detik), atau tidak lolos pagar → giliran itu kembali ke jalur lama.

      **Belum menyala di produksi (OQ-79).** `.env.production` memuat `OPENROUTER_API_KEY=ollama` —
      placeholder Ollama lokal, bukan kunci penyedia berkredit — dan modelnya `qwen3.5:9b` di CPU.
      Jalur ini sengaja tidak memakai model lokal: OQ-45 mencatat qwen2.5:7b menukar sifat PVC dan
      HDPE dua dari dua kali, dan pengetahuan yang membalik sifat bahan lebih buruk daripada
      mengakui batas. Tanpa `LLM_MODEL_KNOWLEDGE` perilakunya sama persis dengan sebelum P30-01.
  - [x] P30-01a Tes (24): pagar keluaran (12 — prosa diterima apa adanya, angka membawa provenance
        dalam dua bahasa, Pralon/merek lain/judul/tabel/butir/kepanjangan/keluaran rusak ditolak,
        model yang mati tidak menjatuhkan giliran), gerbang jalur (6 — pertanyaan tanpa topik
        dijawab pengetahuan umum DAN pemeta pertanyaan tidak dipanggil, topik berfakta tidak pernah
        menyentuh jalur ini, perbandingan/ragam/konsep/lanjutan tetap dijawab kode, jawaban yang
        tidak lolos pagar jatuh ke jalur lama, tanpa konfigurasi perilakunya tidak berubah),
        pemilihan model dan endpoint (3), dan transport (3)

- [x] P30-02 Topik yang salah ditangkap. Diagnosisnya memakai alat probe (`understanding.probe`,
      penyandi bge-m3 sungguhan) atas 25 pertanyaan yang sama — ia mencetak contoh mana yang menang,
      jadi perbaikannya di data, bukan di kode. Yang diperbaiki, semuanya contoh kalimat yang
      membawa KATA PEMBEDA-nya: - **Pertanyaan arti penanda teknis bukan pertanyaan dimensi.** "Beda SDR 11 dan SDR 17" dan
      "apa itu PN 10" terbaca aspek `dimensions`, jadi ruas dimensi menjawabnya lebih dulu dengan
      "Ukuran berapa?" dan daftar ukuran. Keduanya kini aspek kosong dan topik `tekanan kerja` —
      faktanya memang sudah menjelaskan PN dan SDR. - **"Jarak" bukan "panjang".** "Jarak klem atau gantungan pipa tegak berapa?" dijawab tabel
      panjang batang (aspek `rod_length`, topik `panjang batang`). Kini tanpa aspek dan tanpa
      topik — jalur pengetahuan umum yang menjawabnya. - **"Dipanaskan" bukan "air panas".** "Pipa PVC boleh dibengkokkan dengan cara dipanaskan?"
      menarik lima topik sekaligus dengan `air panas` di puncak, lalu dijawab "Tidak — pipa PVC
      tidak bisa menggantikan PPR untuk air panas". Kini tanpa topik. - **PVC-O punya jawabannya sendiri.** "Apa itu pipa PVC-O?" dijawab "Material untuk Pipa
      (Bell End) Kelas B 355 mm belum tercantum di katalog" — kalimat katalog untuk pertanyaan
      bahan, karena kosakata membaca "PVC" di dalam "PVC-O". Topiknya kini `bahan di luar katalog`,
      dan faktanya diperluas: PVC-O adalah uPVC yang molekulnya diorientasikan (ISO 16422),
      dindingnya lebih kuat menahan tekanan sehingga pada tekanan sama bisa lebih tipis dan
      diameter dalamnya lebih besar, disambung rubber ring — dan bukan produk Pralon. - **Yang topiknya ada tetapi tidak pernah tercapai.** "Apa bedanya pipa tekan dan pipa non
      tekan?" berhenti di 0,730 (ambang 0,74) lalu jatuh ke ikhtisar katalog, padahal topik
      `bertekanan vs gravitasi` persis menjawabnya; "butt fusion dan electrofusion" berhenti di
      0,716 padahal fakta `sambungan hdpe` menjelaskannya; "pipa air bersih di dalam dinding"
      tidak pernah mencapai `pipa dicor`. Ketiganya kini tercapai. - **Pertanyaan pipa paling lazim di Indonesia.** "Kenapa air keran kecil padahal toren
      penuh?" terbaca `clarification_answer` lalu dijawab "di luar urusan pemasangan pipa yang
      bisa saya bantu" setelah 71 detik. Kini `knowledge_question`. - **Yang memang tidak punya topik** (akar pohon, HDPE memanjang kena panas, batas suhu PVC,
      batas diameter gulungan) kini tanpa topik, bukan menarik topik terdekat yang kebetulan
      menyebut panas atau daftar gangguan.

      **Satu perubahan dicabut kembali.** Contoh "pipa buat sumur bor pakai pipa apa?" sempat
      ditaruh di `none` use-case supaya tidak masuk mode hitung — dan itu merusak kasus emas "sumur
      bor 50 meter pipanya pakai apa ya?" yang memang harus dihitung. Kalimatnya hampir identik;
      yang membedakan hanya ada-tidaknya angka, dan penyandi tidak bisa diandalkan memisahkannya.
      Jadi pertanyaan sumur bor tetap masuk jalur kasus seperti sebelumnya.

      Dua cacat gerbang P30-01 ikut terlihat dari probe dan diperbaiki di sini: daftar larangan
      intent diganti **daftar izin** (pengetahuan, spesifikasi, pemakaian, saran, dan konsep bahan
      yang tidak dikenali kosakata) supaya label baru tidak otomatis ikut melebar; dan pagar
      "menyebut entitas kebutuhan" dibuang — "toren penuh" dan "pipa saluran" membuat dua
      pertanyaan pengetahuan tertolak, padahal yang memutuskan ini kebutuhan atau bukan adalah
      router sebelum ruas ini.
  - [x] P30-02a Evaluasi penyandi sungguhan: intent 171/172 (99,4%, ambang 95%) dan **tidak satu pun
        kegagalan topik** atas 249 kasus emas; tiga kegagalan yang tersisa sudah ada sebelum fase ini
        (`tes 123`, dua harapan `useCase`) dan tidak tersentuh perubahan ini. Tes ruas +3: pertanyaan
        yang menyebut toren tetap pengetahuan, konsep bahan tak dikenali masuk jalur umum, intent di
        luar daftar izin tidak pernah masuk

- [x] P30-03 Jawaban yang nempel. Pertanyaan ventilasi saluran dijawab benar di paragraf pertama,
      lalu disusul paragraf kelas AW/D dan tabel panjang batang yang tidak ditanya; pertanyaan
      irigasi menarik tiga topik sekaligus. Sebabnya `window` katalog `knowledge-topic`: topik lain
      ikut cocok bila skornya tidak lebih rendah dari 0,04 di bawah topik teratas — dan selisih
      0,02–0,04 ternyata hampir selalu paragraf yang tidak ditanya, bukan topik kedua yang memang
      ditanya. Window-nya kini 0,02. Yang benar-benar dua topik tetap dua ("kenapa lem pipa saya
      tetap bocor" → gangguan lazim + perbaikan bocor, selisih 0,010).
  - [x] P30-03a Dijaga kasus emas yang sudah ada: `topics` dan `topicsOnly` atas 249 kasus lulus
        seluruhnya pada window baru — penyempitan ini tidak menghilangkan satu pun topik yang
        memang diharapkan

- [x] P30-04 Yang tidak terjawab dikatakan apa adanya. Selama kunci penyedia belum ada (OQ-79)
      jalur pengetahuan umum mati, dan tanpa item ini pertanyaan seperti "jarak klem pipa tegak
      berapa?" tetap dijawab ikhtisar seluruh katalog atau contoh produk PVC sembarang — keduanya
      bukan jawaban, dan keduanya terbaca seperti tidak menyimak. Pertanyaan pengetahuan yang tidak
      tercakup data dan tidak terjawab jalur umum (mati, gagal, lewat batas waktu, atau tidak lolos
      pagar) kini dijawab satu kalimat: belum ada acuan yang bisa dipegang, jadi tidak ditebak, dan
      tim teknis Pralon bisa menjawabnya — beserta tombolnya. Pemeta pertanyaan juga tidak lagi
      dipanggil untuk pertanyaan itu: memetakannya ke produk + aspek tidak menambah apa pun selain
      19–31 detik.

      Satu perilaku lama ikut berubah dan itu disengaja: nama yang tidak dikenali kosakata maupun
      katalog ("apa itu xyz?") dulu dijawab catatan "katalog Pralon belum terpasang di sistem ini"
      — catatan tentang katalog untuk pertanyaan yang bukan tentang katalog. Sekarang kalimat yang
      sama dengan di atas.
  - [x] P30-04a Tes (3): jawaban yang tidak lolos pagar dikatakan apa adanya beserta kartu tim
        teknis dan tanpa kartu produk, tanpa penjawab yang dikonfigurasi pun tidak ada ikhtisar
        katalog, dan ragam produk tetap dijawab ikhtisar katalog; satu tes lama disesuaikan pada
        perilaku yang berubah

**Pemeriksaan regresi dengan suite yang sudah ada (produksi, 2026-10-26).** FAQ sales 18/19 dan
pipa 47/48 — lalu dua kegagalannya ditelusuri satu per satu, karena pola yang lolos tidak berarti
jawabannya masuk akal dan pola yang gagal belum tentu regresi.

- **PP-33 regresi nyata, dan penyempitan window yang membukanya.** "Kemiringan pipa air kotor
  berapa persen?" dijawab topik `kemiringan buangan` — yang justru tidak memuat angkanya; angka
  2 % tinggal di fakta tetangga `pipa pembuangan`. Pada window 0,04 fakta tetangga ikut terbawa
  dan angkanya kebetulan muncul; pada 0,02 ia tidak ikut lagi, dan pertanyaan "berapa persen"
  kehilangan angkanya. Yang benar bukan melebarkan window kembali, melainkan menaruh angka itu di
  fakta yang memang menjawabnya: 2 % (±2 cm tiap meter) beserta statusnya — acuan IPC Tabel
  710.1(1) yang dipakai hitungan pembuangan dan belum divalidasi tim teknis Pralon. Angka tanpa
  statusnya adalah angka yang menyesatkan, jadi kalimat statusnya ikut pindah.
- **DE-12 bukan regresi, harapannya yang kedaluwarsa.** Kasusnya masih menuntut kartu eskalasi
  untuk "adakah jenis pipa terbaru setelah HDPE dan uPVC" — padahal P28-06 justru menghapus `gap`
  fakta itu supaya kartu "kirim ke tim teknis" tidak muncul untuk pertanyaan yang sudah terjawab.
  Harapannya disesuaikan pada perilaku yang sudah diputuskan: jawabannya menyebut PP-R beserta
  standarnya dan ditutup pemisahan produk Pralon, tanpa kartu.

Satu perbaikan lain dari membaca jawabannya: "beda SDR 11 dan SDR 17" dijawab arahnya saja ("makin
kecil SDR makin tebal") tanpa mengatakan SDR itu apa — benar, tetapi tidak menjawab. Kalimat
pembuka fakta `tekanan kerja` kini memuat artinya: perbandingan diameter luar terhadap tebal
dinding nominal (ISO 4427, diadopsi SNI 4829). Angka tekanan kerja per kelas tetap tidak dibawa —
statusnya masih menunggu validasi.

**Penutup Fase 30.** Tiga item live di ai.pralon.co.id (tiga rilis, 2026-10-26, tanpa migration) dan
satu item terbangun tetapi sengaja mati sampai pemilik mengisi satu baris env (P30-01, OQ-79). Tes:
API 1756 lulus (2 dilewati), web 273 lulus, engineering 521 lulus; evaluasi penyandi intent 99,4%
tanpa kegagalan topik; di produksi FAQ sales 19/19 dan pipa 48/48.

**25 pertanyaan yang sama, dijalankan ulang ke produksi sesudahnya:** 15 terjawab (dari 7), 8 dijawab
terus terang karena belum ada acuannya, 1 tetap masuk jalur hitung (sumur bor, disengaja), dan 1
masih setengah menjawab (kolam renang dijawab daftar pemakaian uPVC). Giliran terlama 9,6 detik —
sebelumnya ada yang 31 dan 71 detik. Delapan yang dijawab terus terang itulah yang berubah menjadi
jawaban sungguhan begitu `LLM_MODEL_KNOWLEDGE` terisi.

**Yang masih kurang dan diketahui.** (1) Fakta `tekanan kerja` tidak punya `subject`, jadi
pertanyaan tentang HDPE ikut membawa paragraf kelas PVC — benar, tetapi tidak ditanya; memperbaikinya
berarti menyentuh kalimat pembuka beberapa fakta sekaligus, jadi dicatat alih-alih ditambal di akhir.
(2) "Pipa PVC bisa buat kolam renang?" dan "HDPE bisa buat air limbah?" dijawab daftar pemakaian
tanpa "ya" atau "tidak" yang tegas. (3) Angka kedalaman timbunan masih kualitatif. Ketiganya kecil
dibandingkan yang sudah berubah, dan ketiganya lebih murah dikerjakan setelah jalur pengetahuan umum
menyala — supaya yang ditulis tangan hanya yang memang perlu ditulis tangan.

- [x] P30-05 Tiga sisa yang dicatat di penutup fase, dikerjakan. Semuanya data; satu mekanisme kecil
      ikut ditambahkan karena memang kurang. - **Kalimat pembuka yang sudah menjawab tidak lagi menarik paragraf bahan lain.** "Beda SDR 11
      dan SDR 17?" dijawab kalimat pembuka HDPE — lalu disusul paragraf kelas PVC, dan kartu
      "kirim ke tim teknis" dari `gap` tekanan kerja PVC. Dua-duanya salah tempat untuk pertanyaan
      yang sudah terjawab. Fakta kini bisa menandai `leadAnswersFully`: paragraf utamanya dan
      `gap`-nya tidak ikut bila kalimat pembukanya yang menjawab. Data katalognya tetap ikut —
      kelas PN dari katalog memang tentang HDPE. Pertanyaan PVC tidak berubah: tanpa kalimat
      pembuka untuk PVC, paragraf dan `gap`-nya tetap muncul. - **"Bisa dipakai buat X?" dijawab batasnya, bukan daftar pemakaian saja.** Kedua fakta
      `aplikasi` kini ditutup dengan apa yang BUKAN tempatnya dan dengan apa yang menentukan
      pemakaian di luar daftar. uPVC: bukan air panas (melunak, sambungan lemnya melemah) dan
      bukan jalur terbuka tanpa pelindung matahari; di luar daftar, yang menentukan bertekanan
      atau gravitasi, suhu air, terbuka atau ditanam, dan — untuk air berbahan kimia seperti air
      kolam — ketahanan kimia bahannya. HDPE: air limbah dan drainase memang termasuk, gravitasi
      maupun dipompa, karena sambungan lasnya menyatu dengan pipanya; bukan untuk air panas.
      Tidak ada klaim baru di sini — batasnya diambil dari fakta `air panas` dan `sinar matahari`
      yang sudah bersumber. - **Kedalaman timbunan akhirnya menyebut angkanya.** Angkanya tidak dikarang dan tidak baru:
      ia sudah dipakai hitungan SNOUTY sebagai parameter asumsi — ±1 m di bawah jalan
      (`SEWER_START_DEPTH_1M`, kriteria perencanaan jaringan air limbah) dan ±0,6 m atau
      sekurangnya satu kali diameter untuk gorong-gorong (`CULVERT_COVER_MIN_0_6`, praktik umum
      pipa plastik). Keduanya `confirmationRequired`, jadi jawabannya menyebut bahwa angkanya
      belum divalidasi tim teknis Pralon, dan menambahkan yang sama pentingnya: kedalaman saja
      belum menentukan — lapisan pasir di dasar, pemadatan di sisi pipa, dan kelas pipanya ikut
      menentukan apakah jalur itu tahan dilewati kendaraan. `gap`-nya tabel resmi Pralon per
      ukuran pipa dan kelas beban jalan.
  - [x] P30-05a Tes (4 baru, 1.760 lulus): pertanyaan tekanan HDPE tanpa paragraf PVC dan tanpa gap
        tetapi tetap membawa kelas PN katalog, pertanyaan tekanan PVC tetap membawa keduanya,
        kedua fakta pemakaian menyebut batasnya, dan kedalaman timbunan menyebut kedua angka
        beserta statusnya

- [x] P30-06 Pertanyaan pipa yang dibuang dari domain — dan 63 detik untuk membuangnya. Terlihat
      saat menjalankan ulang 25 pertanyaan sesudah P30-05: "apa itu thrust block dan kapan perlu
      dipasang?" memakan 63 detik. Dibaca dari stempel tahap di log, bukan ditebak: `plan` 8,7 s
      lalu 54,2 s lagi — dan intent-nya **OUT_OF_SCOPE**. Jadi pertanyaan itu diklasifikasi model
      generatif sebagai di luar topik, lalu balasan "di luar urusan pemasangan pipa" itu sendiri
      ditulis model di CPU sampai hampir menyentuh batas 60 detik. Dua kesalahan sekaligus,
      keduanya pada pertanyaan pipa yang sah.

      Yang diubah satu pagar di router, bentuknya sama dengan pagar pesaing dan perusahaan yang
      sudah ada: **label di luar topik dari model ditolak bila peringkat contoh teratas justru
      menunjuk pertanyaan pipa** (skor ≥ 0,55 pada label pengetahuan, produk, pemakaian, saran,
      penjelasan, atau bentuk sistem). Untuk thrust block peringkat teratasnya
      `knowledge_question` 0,570 — tidak cukup untuk MENJAWAB (ambang data 0,65), tetapi cukup
      untuk menolak membuang pesannya dari domain. Harga sengaja tidak ikut: "harga tiket pesawat
      berapa?" memang mirip pertanyaan harga, dan menjawabnya dengan kalimat daftar harga
      distributor Pralon lebih buruk daripada mengatakan itu di luar topik. Kebutuhan juga tidak
      ikut — rutenya sendiri.

      **Yang dicoba lebih dulu dan gagal, dicatat supaya tidak diulang:** menambah contoh intent
      berbentuk dua bagian ("apa itu air valve dan kapan dipasang?") untuk menaikkan skornya di
      atas ambang. Skornya bergerak 0,569 → 0,570. Penyandi menimbang istilahnya, bukan rangka
      kalimatnya, jadi istilah yang tidak ada di kosakata tidak bisa diangkat dengan contoh
      berangka sama. Contohnya dicabut kembali — data yang tidak memperbaiki apa pun hanya derau.
  - [x] P30-06a Tes (4): pertanyaan pipa yang dilabeli di luar topik tetap dijawab, peringkat yang
        memang menunjuk di luar topik tidak diganggu, skor derau (0,42) tidak dianggap petunjuk,
        dan pertanyaan harga di luar pipa tidak ditarik ke jalur harga

- [x] P30-07 Pagar P30-06 dipasang di tempat yang salah. Dibaca ulang dari log tahapnya: 63 detik
      itu tidak lewat router sama sekali. Alurnya **perencana giliran** — ia dipanggil untuk pesan
      yang intent-nya ragu walaupun percakapannya baru dimulai, memilih `case_question` (8,7 s),
      lalu pelaksana rencana menulis balasannya dengan model (54,2 s). Router baru dikonsultasi
      bila rencana tidak menjawab, jadi pagar P30-06 tidak pernah dijalankan untuk kasus ini.

      Dua perbaikan di tempat yang benar: (1) perencana **tidak** dipanggil untuk pertanyaan
      pengetahuan yang tidak tercakup data — jawabannya tidak bergantung pada konteks percakapan
      sama sekali, dan ruas pertanyaan produk sudah punya jalurnya; (2) router memutuskannya
      **tanpa model**: peringkat contoh yang menunjuk pertanyaan pipa (≥ 0,55) sudah cukup untuk
      memilih jalur pengetahuan, dan menanyakannya ke model generatif di CPU hanya menambah
      puluhan detik untuk sampai ke kesimpulan yang sama. Giliran thrust block: 63 detik → 0,3
      detik, dan nol panggilan model.

      Predikat `asksGeneralKnowledge` pindah dari ruas pertanyaan produk ke router — di situ ia
      memang tinggal, bersama `answersFromKnowledge` dan pagar-pagar intent lainnya; menaruhnya di
      ruas pertanyaan membuat impornya melingkar. Ia juga diperketat: untuk contoh yang RAGU,
      peringkat teratasnya harus benar-benar menunjuk pertanyaan pipa beserta lantai skornya —
      sebelumnya label apa pun dari daftar izin cukup, tanpa lantai, sehingga derau 0,4-an bisa
      menarik pesan apa pun ke jalur ini.

      **Satu lubang di P30-06 ditemukan tesnya sendiri:** pesan yang menyebut pesaing dan dilabeli
      model di luar topik berakhir di jalur produk — Policy 1 dilangkahi. Pagarnya kini menolak
      pesan yang menyebut pesaing.
  - [x] P30-07a Tes (3): peringkat contoh yang menunjuk pertanyaan pipa diputuskan dengan nol
        panggilan model, pesan yang menyebut pesaing tidak ikut ditarik ke jalur produk, dan
        perencana giliran tidak dipanggil untuk pertanyaan pengetahuan tak tercakup

**Penutup putaran kedua Fase 30 (P30-05 … P30-07).** Enam rilis hari ini, tanpa migration. Tes:
API 1.767 lulus (2 dilewati), web 273, engineering 521. Di produksi: FAQ sales 19/19, pipa 48/48,
perhitungan 23/23 — suite perhitungan sengaja ikut dijalankan karena P30-07 menyentuh routing, dan
di situlah kerusakan akan terlihat lebih dulu.

**25 pertanyaan yang sama, dijalankan ulang untuk ketiga kalinya:** 15 terjawab, 9 dijawab terus
terang, 1 masuk jalur hitung (sumur bor, disengaja). Yang bertambah satu di kolom "terus terang"
justru perbaikan: thrust block dulu dijawab "ini di luar urusan pemasangan pipa" setelah 63 detik —
sebuah jawaban yang salah — dan kini ditolak dengan jujur dalam 0,3 detik. Giliran terlama di
seluruh set **1,8 detik**, dari 63 detik; tidak ada lagi giliran di atas 2 detik.

Yang masih menunggu pemilik tetap satu: `LLM_MODEL_KNOWLEDGE` beserta kuncinya (OQ-79). Sembilan
pertanyaan yang sekarang dijawab terus terang itulah yang berubah menjadi jawaban sungguhan begitu
baris itu terisi — dan sembilan-sembilannya sudah terbukti sampai ke jalur yang benar dalam waktu di
bawah satu detik, jadi yang ditunggu benar-benar hanya modelnya.

## Fase 31 — panggilan model yang tidak perlu

- [x] P31-01 Katalog pemahaman `extreme`: "paling kecil" / "paling besar" sebagai label sendiri

      "pvc aw paling kecil berapa?" dan "ada ukuran apa saja?" sama-sama beraspek ukuran dan
      sama-sama menyebut keluarganya — dari luar tidak terbedakan, sehingga ruas pertanyaan produk
      selalu memanggil `familySizeAnswer` dengan `extreme: null` dan menjawab seluruh daftar.
      Satu-satunya yang bisa membaca kata itu adalah perencana giliran, yang berarti satu panggilan
      model untuk satu kata. Kini kata itu punya katalognya sendiri (`smallest` / `largest` /
      `none`), disandikan seperti katalog lain, dan ruas pertanyaan produk meneruskan
      `u.extreme`.

      Dua kasus emas jatuh di evaluasi pertama — "ukuran paling mini" dan "ada yang lebih
      mungil dari 1/2 inci" — karena kata pembedanya belum pernah muncul di contoh. Yang ditambah
      adalah kata itu sendiri dalam kalimat lain ("yang paling mini ukurannya berapa?", "ada yang
      lebih mungil dari ukuran itu?"), bukan rangka kalimat kasus emasnya, beserta pasangan
      besarnya ("gede", "jumbo") supaya kedua sisi punya kosakata sehari-hari yang sama tebalnya.

      Satu kasus tetap jatuh, dan penyebabnya ternyata lebih dalam: "pvc d ukuran paling mini"
      dijawab `largest` karena "pvc d" hanya ada di contoh sisi besar. Nama keluarga adalah token
      dominan di katalog ini, dan label yang memilikinya sendirian merebut setiap pesan yang
      menyebutnya. Dicabut seluruhnya pun tidak selamat: tanpa nama keluarga katalognya tidak lagi
      terpisah — kasus emas terendah 0,726 sementara "ada ukuran yang pas buat saluran kecil?"
      justru 0,735 di sisi kecil, jadi tidak ada ambang yang memisahkan keduanya. Yang dipakai:
      setiap nama keluarga muncul di **ketiga** label, sehingga tokennya saling menghapus dan yang
      menentukan tinggal kata ujungnya. Ambang 0,74 → 0,72, sebab kasus terendah yang benar
      ("fitting pvc ada yang lebih mungil dari 1/2 inci?") berhenti di 0,731 dengan jarak 0,065 ke
      label berikutnya; lima belas pesan berisiko yang diuji semuanya tetap dipimpin `none`.

- [x] P31-02 Perencana giliran dilewati untuk pesan yang menyebut keluarga katalognya sendiri

      "Gue butuh fitting elbow 90 derajat buat uPVC 3/4". Ada rekomendasi Pralon?" memakan 10,6
      detik di produksi, 10,2 detik di antaranya menunggu perencana — padahal keluarganya datang
      dari kosakata (pencocokan nama) dan ukurannya dari parser nilai, dan ruas pertanyaan produk
      menjawabnya dari katalog tanpa model sama sekali. Pesan yang juga menyebut kebutuhan tidak
      ikut dilewati; itu jalur kebutuhan.

- [x] P31-02a Tes (4): tiga di ruas pertanyaan produk (terkecil, terbesar, daftar penuh bila tidak
      diminta ujung) dan satu yang memastikan perencana tidak dipanggil untuk pertanyaan fitting
      berukuran

- [x] P31-03 Empat cacat dari percakapan pemilik di produksi (2026-10-26)

      Pemilik mencoba SNOUTY sebagai pengguna dan mengirim hasilnya: "masih ngaco". Empat hal, dan
      tiga di antaranya data.

      **"gw mau bikin kolam ikan" dibuang dari domain setelah 34 detik.** Mesinnya punya kasus
      `fish_pond` lengkap dengan asumsinya, dan "bikin kolam ikan ukuran 3x4 meter" memang sampai
      ke situ — tetapi setiap contoh kolam di katalog membawa jenis ikan, jumlah petak, atau
      ukuran. Niat polos tanpa angka tidak punya padanan, intent-nya ragu (0,755 lawan 0,747), dan
      pesan ragu diserahkan ke model yang lalu menyebutnya di luar lingkup. Lima contoh niat polos
      ditambahkan: sekarang 0,955 dan kasusnya `fish_pond`.

      **"itungin gw bisa jawab beberapa parameter yang dibutuhin" 68 detik, lalu minta data.**
      Peringkat teratasnya `complaint` 0,642 — permintaan menghitung terbaca keluhan. Delapan
      contoh ajakan menghitung ditambahkan ke `follow_up_continue`: sekarang 0,933.

      **"apa aja barang2 nya" dijawab serah-terima.** Ragu antara pertanyaan jalur dan ragam produk
      (0,763 lawan 0,756, margin 0,015). Permintaan daftar barang masuk `follow_up_more`.

      **Satu baris katalog ditempel sebagai prosa.** Di bawah penjelasan penerapan HDPE muncul
      "Pipa HDPE PE 100 PN-12.5 20 mm x 270 Meter. Material HDPE." — satu produk yang dipilih
      katalog, dengan deskripsi kosong sehingga prosanya merosot jadi nama plus materialnya, dan
      keduanya sudah ada di kartu di bawahnya. Prosa katalog kini hanya untuk produk yang
      deskripsinya berisi, tempat katalog memang menjelaskan sesuatu ("Pipa PVC AW: Pipa untuk air
      bersih bertekanan"). Tes perbandingan yang memeriksa pilihan produk kini membacanya dari
      kartu, bukan dari prosa yang tidak lagi ada.

- [x] P31-04 Sisi kolam yang disebut satu per satu

      Lanjutan dari P31-03: kolam ikan kini masuk ke jalur hitung, dan di situ muncul cacat
      berikutnya. "panjang 4 meter lebar 3 meter dalam air 1 meter, 2 kolam" tercatat sebagai
      "panjang jalur 4 m" — kedalaman dan jumlah kolam masuk, tetapi panjang dibaca sebagai panjang
      jalur pipa dan lebar hilang tanpa bekas, sehingga SNOUTY tetap meminta panjang dan lebar
      kolam yang baru saja disebutkan. Penyebabnya: dimensi kolam hanya dikenali dari bentuk
      "4 x 3". Parser nilai sekarang juga membaca sisi yang disebut satu per satu, dan yang boleh
      berdiri di antara penanda dan angkanya hanya kata "kolam" — "panjang jalur 30 meter" tetap
      panjang jalur.

- [x] P31-05 Suite pipa membatalkan keputusan P31-01

      Setelah P31-04 rilis, suite 48 pertanyaan pipa jatuh satu: PP-42, "what sizes of hdpe pipe do
      you have?", dijawab "The largest HDPE size in the Pralon catalogue is 900 mm" — satu ukuran
      terbesar, bukan daftarnya. Penyebabnya keputusan P31-01 sendiri: nama keluarga diseimbangkan
      di ketiga label, dan contoh `largest` "hdpe ukuran terbesar berapa?" menang 0,817 atas
      contoh `none` terdekat hanya karena pertanyaannya menyebut HDPE. Ditambal dengan contoh
      `none` bahasa Inggris, dua kasus emas justru berdempet — ujung dan daftar terpisah 0,003 dan
      0,016, di bawah margin.

      Yang dilewatkan di P31-01: `extreme` hanya dibaca ketika aspek pesannya sudah ukuran, jadi ia
      tidak pernah perlu bersaing dengan pertanyaan harga, kebutuhan, atau sizing — tugasnya satu,
      memisahkan permintaan ujung dari permintaan daftar. Dengan contoh bebas nama keluarga ia
      terpisah lebar di tugas itu: ujung paling rendah 0,701 ("hdpe ukuran terbesar berapa?") dan
      tujuh belas pertanyaan daftar serta ketersediaan semuanya dipimpin `none`. Ambang 0,72 → 0,68.
      Empat kasus emas ditambahkan, termasuk kalimat PP-42 sendiri, supaya kelas kekeliruan ini
      tertangkap evaluasi dan bukan produksi.

- [x] P31-06 Pesan ragu yang menyebut keluarga produknya tidak diklasifikasi model

      P31-02 berhasil — perencana giliran benar-benar tidak dipanggil lagi untuk "Gue butuh fitting
      elbow 90 derajat buat uPVC 3/4". Ada rekomendasi Pralon?" — tetapi gilirannya tetap 16,2
      detik, dan log tahapnya menunjukkan di mana: `route` 15.793 ms. Waktunya bukan hilang,
      hanya pindah. Intent pesan itu ragu, dan router menyerahkan pesan ragu ke klasifikasi model
      di CPU.

      Padahal pesan itu menyebut sendiri keluarga produknya, keluarganya datang dari kosakata
      (pencocokan nama), dan ruas pertanyaan produk menjawabnya dari katalog tanpa model sama
      sekali — jawaban yang muncul setelah 16 detik itu memang jawaban katalog. Jadi intent ragu
      yang menyebut keluarga produk dan tidak membawa kebutuhan diputuskan di kode sebagai
      pencarian produk. Pesan yang juga membawa kebutuhan tetap kebutuhan, dan pesan yang menyebut
      pesaing tetap ditolak lebih dulu oleh Policy 1.

- [x] P31-07 Rumah yang sudah tercatat: lanjutannya tanpa model

      Mencoba sebagai pengguna: "rumah gw 2 lantai mau pasang pipa air baru" dijawab 237 ms, lalu
      "kamar mandi 3" memakan **90 detik** dan "airnya dari pdam" 16 detik. Log tahapnya menunjuk
      `answer` — ekstraksi kebutuhan oleh model.

      Pemilik sudah memutuskan 2026-10-21 bahwa pesan rumah melewati model sepenuhnya, tetapi
      gerbangnya membaca pesannya sendiri, bukan state: "rumah gw 2 lantai" memuat kata rumah
      sehingga lewat, "kamar mandi 3" tidak, padahal percakapannya sudah jelas rumah tinggal dan
      angka itu memang dibaca parser nilai. Keputusan itu tentang kasusnya, bukan tentang satu
      kalimat — rumah yang sudah tercatat di state kini ikut melewati model.

- [x] P31-08 "Pralon tidak ada di katalog Pralon"

      Setelah P31-07 memotong model dari percakapan rumah, satu cacat yang selama ini tertutup
      lambatnya model terlihat: "ada yang lebih murah ga" sesudah pertanyaan harga dijawab "Pralon
      tidak ada di katalog Pralon", lalu ikhtisar 7.664 produk.

      Subjek produk yang tidak punya entitas tercatat sebagai merek sendiri — `'Pralon'` sebagai
      penanda "ragam Pralon". Lanjutan pilihan membawa entitas subjek sebagai query katalog, jadi
      katalog dicari dengan kata "Pralon", tidak menemukan apa pun, dan melaporkannya apa adanya.
      Entitas yang hanya menyebut merek sendiri dan tidak memuat satu pun keluarga produk kini
      bukan query katalog.

      Pagar pertama yang saya tulis memakai `isCatalogFamily`, dan itu mati sejak awal: fungsi itu
      menjawab "ya" untuk apa pun yang bukan keluarga khusus-pengetahuan, termasuk kata "Pralon".
      Yang dipakai `productFamilies` — entitas yang tidak memuat keluarga mana pun memang tidak
      punya yang bisa dicari. Tesnya memeriksa kalimatnya, dan sempat merah sebelum pagar kedua.

- [x] P31-09 Dua blok teks yang menempel, dan lanjutan rumah yang ditulis model

      **Dua kalimat tanpa spasi.** Giliran harga mengirim dua event teks: jawaban harga lalu
      catatan kebutuhan. Keduanya blok utuh — tidak ada jalur yang menstream potongan kalimat —
      tetapi web dan penyimpanan menggabungkannya mentah, jadi yang terbaca
      "…yang Anda butuhkan.Oke, sudah saya catat…". Blok kedua kini dimulai sebagai paragraf baru,
      di kedua tempat dengan aturan yang sama.

      **"ada yang lebih murah ga" 18 detik, "oke lanjut" 14 detik.** Keduanya jatuh ke cabang
      PEMBUKA: pernyataan kebutuhan yang ekstraksinya kosong dianggap orang yang baru hendak
      bertanya, lalu balasannya ditulis model. Cabang itu memang hanya dimaksudkan untuk pesan
      pembuka — komentarnya mengatakan begitu — tetapi syaratnya tidak pernah memeriksa apakah
      kebutuhannya sudah tercatat. Dengan kebutuhan di tangan, keduanya sekarang dijawab jalur
      biasa dari DATA kasus: yang sudah tercatat, lalu tombol hitungnya. Yang keluar dari model
      sebelumnya memang berbunyi seperti bot — "Saya paham keinginan Anda mencari harga lebih
      hemat…".

      Penulis balasan di giliran yang tidak menghasilkan kalimat apa pun juga dipagari maksud yang
      memang butuh penjelasan, sama seperti jalur kasus teknis sejak P16-40.

- [x] P31-10 Pertanyaan harga tidak perlu direncanakan

      "berapa duit totalnya" memakan 44,7 detik dan dijawab karangan model yang menjanjikan
      estimasi biaya nanti serta "daftar produk per kamar" yang tidak ada. Pemahamannya sendiri
      benar — `price_question` 0,790 — tetapi pagar "berdiri sendiri" menuntut 0,85, jadi pesan itu
      diserahkan ke perencana giliran lebih dulu dan tidak pernah sampai ke cabang harga yang sudah
      ada di kode.

      Untuk harga, pagar skor itu tidak ada gunanya: jawabannya satu kalimat bersumber dalam
      keadaan apa pun (kebijakan OQ-03), jadi labelnya saja cukup. Katalog pemahaman tidak memberi
      label kecuali ambang dan marginnya terlampaui, dan harga yang keliru terbaca pun hanya
      menghasilkan kalimat kebijakan yang sama.

- [x] P31-11 Subjek produk yang tidak ada tidak lagi dikarang jadi "Pralon"

      Sisa dari P31-08: pangkalnya bukan di hilir, tapi di tempat subjek dibuat. Subjek produk
      tanpa entitas apa pun jatuh ke string `'Pralon'` — benar untuk "produk Pralon apa aja?",
      salah untuk pertanyaan harga di tengah percakapan rumah. Subjek yang tertinggal itu membuat
      lanjutan berikutnya ("ada yang lebih murah ga") dijawab ikhtisar 7.664 produk.

      Sekarang entitas hanya menjadi "Pralon" bila pesannya memang tentang ragam Pralon atau
      menyebut mereknya; tanpa entitas dan tanpa ragam, subjek percakapan tidak berubah.

- [x] P31-12 Pertanyaan kelayakan bahan dan permintaan daftar material dikenali

      Percakapan kontraktor cluster: "material listnya dong" dan "kalo pake hdpe aja bisa?"
      dijawab kalimat yang sama persis — "Yang masih saya perlukan: tinggi statis, pemakaian
      serentak, kontur, dan tekanan yang dibutuhkan." Dua pertanyaan berbeda, satu teks.

      Yang pertama terbaca sebagai permintaan format ulang, yang kedua ragu antara dua label
      produk. Contohnya ditambah ke `advice_request` dan `follow_up_more`, sehingga pertanyaan
      kelayakan bahan dijawab di atas data kasus dan permintaan daftar barang dikenali apa adanya.

- [x] P31-13 Kasus teknis yang sedang berjalan tidak dibajak isyarat irigasi

      "pompanya apa" di tengah kasus sumur bor dijawab penjelasan irigasi yang bicara soal lahan
      dan jenis irigasi. Pompa memang sering irigasi, jadi katalog kasus memberinya label
      `irrigation` — dan cabang irigasi di pipeline berjalan sebelum kasus teknis, tanpa melihat
      bahwa kasus sumur sudah berjalan.

      Sekarang hanya kebutuhan irigasi yang tersurat boleh berganti jalur; isyarat saja tidak
      cukup selama kasus teknis masih berjalan. Pertanyaan pompa polos juga ditambahkan sebagai
      contoh "bukan kasus" di katalog kasus.

      Sekalian: permintaan daftar barang di kasus yang datanya belum lengkap tidak lagi dijawab
      kalimat dorongan yang sama — daftar barangnya memang keluar dari hitungan, dan itu yang
      dikatakan, beserta apa yang masih kurang.

- [x] P31-14 Harga yang disingkat, pilihan bahan, dan pertanyaan pompa

      Ronde dari sisi pengguna lagi, tiga temuan dalam satu item.

      "pipa pvs aw ukran 3/4 hrga brp" dijawab penjelasan kelas PVC beserta satu produk 4" —
      bukan kalimat kebijakan harga. Ejaannya yang membuat harga (0,700) dan spesifikasi produk
      (0,687) berdempet, jadi tidak ada label yang menang, dan nama keluarga di pesan membawanya
      ke jalur katalog. Kalimat harga yang ditulis singkat sekarang ada di contohnya.

      "pipanya yang bagus apa" dan "ganti ke pralon yg mana" dijawab daftar pertanyaan dan profil
      perusahaan; keduanya permintaan rekomendasi, dan contohnya ditambahkan.

      Pompa ditanya terus — di kasus sumur, transfer, dan gedung — dan tiap kali dijawab model:
      25 detik, lalu balik bertanya merek dan daya pompa yang tidak pernah dicatat SNOUTY. Pompa
      bukan produk Pralon, jadi jawabannya kini fakta bersumber: yang keluar dari hitungan adalah
      debit dan head total, dan apa saja yang menyusun head itu.

- [x] P31-15 "Lu bisa ngitung ga sih" dijawab apa yang memang dikerjakan

      Di tengah percakapan produk, pertanyaan ini dijawab ulangan persis penjelasan kelas PVC
      giliran sebelumnya — dua giliran, satu teks. Pertanyaan tentang kemampuan tidak pernah punya
      labelnya sendiri: ia menumpang "di luar topik", padahal jawabannya justru kebalikannya.

      Sekarang ada label `capability_question` dengan jawaban tetap tentang apa yang dikerjakan di
      sini. Sekalian: pesan di luar topik dan pertanyaan kemampuan tidak lagi ditulis ulang model —
      "kamu bisa apa aja?" memakan 24,8 detik untuk mengganti teks yang sudah pas.

      Perencana giliran juga dilewati untuk pertanyaan ini: lewat perencana "lu bisa ngitung ga
      sih" memakan 38,6 detik dan dijawab prosa model, padahal maknanya utuh tanpa konteks.

- [x] P31-16 Pertanyaan bersumber di tengah kasus tidak lagi dibaca sebagai jawaban data

      Fakta pompa P31-14 tidak pernah terpakai di tempat ia paling dibutuhkan: di dalam kasus
      teknis yang berjalan, setiap pertanyaan dialihkan menjadi lanjutan kebutuhan — dijalankan
      ekstraksi lebih dulu, lalu dijawab model. "pompanya apa" di kasus sumur memakan 22,5 detik
      dan dijawab pertanyaan balik soal merek pompa, dengan satu kata Rusia menyelip di dalamnya.

      Sekarang pertanyaan yang punya fakta bersumber keluar dari lanjutan itu dan dijawab dari
      pengetahuan. Pesan yang membawa data ("bahannya pvc", "jaraknya 150 m") tetap lanjutan
      kebutuhan seperti sebelumnya — yang dialihkan hanya pertanyaannya.

- [x] P31-17 Jawaban pengetahuan yang sama tidak dikirim dua kali

      "pompanya apa" lalu "kenapa harus pakai pompa transfer?" mendapat blok empat paragraf yang
      sama persis, dua giliran berurutan. Satu topik memang satu fakta, dan tidak ada yang lebih
      menandai bot daripada mengirimnya ulang kata demi kata.

      Topik yang baru saja dijawab sekarang dijawab satu kalimat: bagian mana yang mau diperjelas,
      atau angka lapangan yang mau dipakai.

- [x] P31-18 Sapaan dan basa-basi tidak lewat perencana, tidak ditulis model

      Percakapan pemilik 2026-10-26: "nanya nih" dijawab "Nah, ini dia pertanyaan yang ada di kartu
      bawah tentang kebutuhan perencanaan pipa Anda." — kalimat yang tidak berarti apa pun, dan
      kartu yang disebutnya tidak ada. Jalannya: 8,7 detik di perencana, tindakan `chat`, lalu 12
      detik model menulis balasan.

      Sapaan, terima kasih, pamit, keluhan, di luar topik, dan pertanyaan kemampuan tidak punya
      apa pun untuk direncanakan — tidak ada keluarga produk yang dicari, tidak ada kasus yang
      dihitung — dan teks tetapnya sudah pas. Keduanya sekarang dilewati: perencana dan model.

- [x] P31-19 "Kalo PVC itu cocoknya dimana?" dijawab pemakaiannya

      Pertanyaan itu dijawab kalimat bahwa pilihan bahan tidak bisa ditentukan dari satu hal saja,
      lalu formulir empat pertanyaan kebutuhan — padahal yang ditanya pemakaian bahannya, dan
      faktanya ada. Topik pemakaian kalah tipis dari "bukan topik" (0,807 vs 0,828) karena bentuk
      "cocoknya dimana" mirip permintaan rekomendasi. Contohnya ditambahkan; permintaan
      rekomendasi yang sesungguhnya ("mending pvc apa hdpe?") dipaku kasus emas supaya tidak
      ikut terseret.

- [x] P31-20 Pertanyaan atas solusi dijawab dari solusinya, bukan ditulis ulang model

      Rumah 2 lantai yang sudah dihitung, lalu tiga pertanyaan wajar: "fitting apa aja yang perlu
      dibeli" 55,7 detik, "berapa batang pipanya" 42,6 detik, "kenapa ukurannya 1 inci" 48,1 detik.
      Ketiganya dijawab kabur — fitting disebut tanpa jumlah lalu ditutup kalimat yang tidak berarti
      apa pun, jumlah batang disebut "dua batang utama 1¼ inci ditambah empat batang cabang", dan
      pertanyaan 1 inci dijawab dengan 1/2 inci. Ukurannya pun bertentangan antar jawaban.

      Teks deterministiknya sudah ada sejak P22-02/P22-04 dan berisi angka yang pasti dari jalur
      dan daftar belanja — ia hanya dipakai bila model gagal. Sekarang ia yang dipakai: pertanyaan
      atas solusi yang sudah dihitung tidak lagi dilewatkan model sama sekali.

- [x] P31-21 Jumlah batang yang belum dihitung dikatakan; balasan tidak terulang

      Dua sisa dari P31-20. Daftar belanja rumah berisi fitting saja — jumlah batang pipa memang
      tidak dihitung tanpa ukuran bangunan (jalur baku 20 m hanya untuk memilih ukuran, bukan untuk
      jumlah), jadi "berapa batang pipanya" dijawab daftar fitting tanpa sepatah kata tentang
      pipanya. Sekarang teks jalur mengatakannya: jumlah batang belum dihitung, dan itu perlu
      ukuran bangunannya.

      Dan dua pertanyaan berbeda yang jatuh ke teks yang sama tidak lagi mengirimnya dua kali —
      pagar yang sama seperti P31-17, sekarang juga di jalur solusi dan teks tetap.

- [x] P31-22 Ukuran bangunan yang disebut pengguna ikut disebut balik

      "rumah 2 lantai 3 kamar mandi, toren atap, rumahnya 10 x 12 meter" dijawab "sudah saya catat:
      rumah tinggal, 2 lantai, 3 kamar mandi, dan toren atap" — tanpa ukurannya, padahal angka itu
      yang membuat jumlah batang pipa bisa dihitung dan memang dipakai di hitungannya. Dari
      `building.dimensions` hanya panjang jalur utama yang pernah disebut balik; tapak bangunan,
      luas bangunan, dan ukuran tanah tidak.

      Semuanya sekarang disebut. Ukuran tanah juga, supaya jelas ia tercatat walau tidak dipakai
      menghitung panjang pipa.

- [x] P31-23 Kantor 3 lantai tidak lagi diperlakukan sebagai gedung bertingkat

      "i need pipes for a 3 storey office, 6 bathrooms per floor, water from the city main" ditanya
      jumlah penghuni, luas per lantai, wastafel per lantai, dan tinggi bangunan — tanpa tombol
      hitung. Kalimat Indonesia yang isinya sama persis dihitung langsung sampai keluar daftar
      belanjanya. Katalog kasus memberi label gedung bertingkat untuk kalimat Inggrisnya; batas
      hitung rumah (> 4 lantai) hanya dipakai di cabang satunya.

      Sekarang label itu tidak berlaku di bawah batas hitung rumah: jalur bangunan biasa yang
      menghitungnya, sama seperti kalimat Indonesianya. Kasus yang sudah berjalan tidak dibatalkan.

- [x] P31-24 "6 kamar mandi per lantai" dihitung per lantai, dan pertanyaan ukuran pipa sendiri
      tidak dijawab angka pembuangan

      Kantor 3 lantai dengan 6 kamar mandi per lantai tercatat 6 kamar mandi, bukan 18 — bebannya
      kurang dari sepertiga, dan ukuran pipanya bisa jatuh terlalu kecil. Pembacaan model memang
      sudah boleh mengalikan jumlah lantai, tetapi untuk pesan rumah dan bangunan model dilewati,
      dan parser nilai hanya membaca angka di depan kata bendanya. Sekarang satuan per lantai
      ("per lantai", "tiap lantai", "per floor") mengalikan jumlah alat dengan jumlah lantai yang
      tersurat; tanpa penanda itu angkanya tetap total.

      "ukuran pipanya berapa" dan "what size pipe do i need" di tengah percakapan air bersih
      dijawab aturan kemiringan dan ukuran pipa pembuangan. Keduanya sekarang bukan topik
      pengetahuan, jadi jatuh ke kebutuhan atau solusi percakapannya sendiri.

- [x] P31-25 Tawar-menawar harga dan permintaan nomor sales dikenali

      "diskon dong kalo beli banyak" memakan 30,9 detik lewat perencana lalu dijawab ajakan
      bertanya; "ada diskon ngga kalau beli banyak?" sudah dijawab kebijakan harga dalam 0,1 detik.
      "nomor sales nya siapa?" dijawab "belum punya acuan", padahal kontak Pralon ada di profil
      perusahaan. Keduanya ditambahkan sebagai contoh pertanyaan, bukan pola kalimat di kode.

- [x] P31-26 Kasus yang sudah diserahkan ke tim teknis tidak diperlakukan sebagai obrolan baru

      "panjang jalurnya 150 meter, dari bak penampung ke 4 mesin" di kasus air pendingin pabrik
      memakan 37,4 detik: 9,3 detik perencana, sisanya menulis prosa ukuran pipa air bersih yang
      tidak ada hubungannya dengan pertanyaannya. Kasus yang sudah diserahkan sekarang dibaca
      sebagai percakapan yang sedang berjalan: datanya dicatat tanpa model, disebut balik, dan
      ditutup dengan ke mana ia pergi — kalimat besar penyerahannya tidak diulang kata per kata.

- [x] P31-27 Pertanyaan atas kebutuhan sendiri dijawab dari kebutuhan itu, dan satu ringkasan tidak
      dikirim dua kali

      "what size pipe do i need" di kantor 3 lantai memakan 49,6 detik dan balik menanyakan sumber
      air yang baru saja disebut pengguna. Pesan yang tidak dikenali dan tidak membawa satu nilai
      pun — di percakapan yang kebutuhannya sudah tercatat — adalah pertanyaan tentang sistem
      pengguna sendiri: dijawab dari solusinya bila sudah dihitung, atau dari kebutuhannya bila
      belum, tanpa perencana dan tanpa model.

      "air kotor dan air bekas dipisah" dijawab ringkasan kebutuhan yang sama persis dengan
      giliran sebelumnya, lalu giliran berikutnya mengulangnya lagi. Ringkasan yang identik
      sekarang diganti kalimat bahwa kebutuhannya tidak berubah.

      "udah, itung aja" dijawab "Tekan Susun rekomendasi" padahal pengguna baru saja memintanya
      menghitung. Permintaan melanjutkan atas kebutuhan yang sudah bisa dihitung sekarang
      dijalankan di giliran itu.

- [x] P31-28 Pertanyaan atas angka yang belum dihitung dijawab teks tetap

      "kenapa pakai 1 inci?" dan pesan lain yang masuk sebagai permintaan penjelasan dijawab model
      selama 27 detik — termasuk satu balasan yang mengaku mencatat sesuatu yang tidak punya tempat
      di kebutuhan. Selama belum ada solusi yang bisa dibuka, jawabannya adalah kapan ukurannya
      dihitung, bukan karangan tentang angka yang belum ada. Pemisahan air kotor dan air bekas
      dicatat sebagai OQ-81, bukan dianggap diam-diam.

- [x] P31-29 Data pipa lama tidak hilang di balik topik hitungan, dan makian dibaca sebagai keluhan

      Di percakapan renovasi, "pipa lamanya 3/4 inci, panjangnya sekitar 40 meter" dijawab cara
      menghitung jumlah batang — ukuran pipa lama dan jenis pekerjaannya hilang tanpa jejak.
      Topik hitungan sekarang kalah terhadap pesan yang membawa nilai kebutuhan di luar panjang
      jalur; pertanyaan yang hanya menyebut panjang jalurnya tetap dijawab cara menghitungnya.

      "goblok ya lu, itu kan udah gw bilang" dijawab kalimat tentang kapan ukuran dihitung.
      Makian tanpa pertanyaan sekarang dikenali sebagai keluhan: satu permintaan maaf dan
      tawaran menjawab ulang.

- [x] P31-30 "Lantainya jadi 3" benar-benar mengubah jumlah lantai, dan permintaan gambar dijawab
      gambar

      "kalau lantainya jadi 3 gimana" dijawab ringkasan kebutuhan yang masih berbunyi 2 lantai —
      perubahannya hilang. Parser nilai hanya membaca arah "3 lantai"; arah terbalik sekarang
      dibaca bila ada kata perubahan ("lantainya jadi 3", "kamar mandinya jadi 5"), sementara
      "torennya di lantai 3" tetap bukan jumlah lantai.

      "minta gambarnya dong" sesudah pertanyaan harga dijawab kalimat kebijakan harga lagi.
      Permintaan gambar sekarang ada di contoh pertanyaan bentuk sistem, jadi yang keluar adalah
      potongan instalasinya.

- [x] P31-31 Kasus irigasi: arahan tidak diulang, kedalaman sumur bukan jarak, dan "oke hitung"
      tidak lewat model

      Blok empat paragraf tentang bahan irigasi keluar tiga giliran berturut-turut, sementara data
      yang baru disebut pengguna tidak disinggung sama sekali. Arahannya sekarang diberikan sekali;
      giliran berikutnya hanya kalimat penutupnya.

      "sumurnya 30 meter" tercatat sebagai jarak ke lahan "Di bawah 50 m" — itu kedalaman sumur.
      Jarak kini hanya dibaca bila jaraknya memang disebut, dan klitik "-nya" tidak lagi
      menyembunyikan sumbernya ("sumurnya" tetap sumur).

      "oke hitung" di kasus irigasi yang berjalan memakai 41,5 detik dan dijawab karangan model;
      pesan di dalam kasus irigasi sekarang tetap di jalur irigasi.

- [x] P31-32 Jawaban irigasi menyebut data yang baru masuk

      Setelah arahan bahannya tidak lagi diulang, yang tersisa adalah kalimat penutup yang sama
      empat giliran berturut-turut — dan pengguna tetap tidak tahu angkanya masuk atau tidak.
      Giliran lanjutan sekarang menyebut nilai yang baru tercatat ("jarak 50–200 m"), dan kalimat
      yang kebetulan sama persis dengan giliran sebelumnya diganti.

- [x] P31-33 Pesan yang membawa nilai kebutuhan tidak lewat perencana giliran

      "pipa lamanya 3/4 inci, panjangnya sekitar 40 meter" memakai 10,0 detik di perencana untuk
      sampai ke jalur kebutuhan yang sama. Pesan yang nilainya terbaca parser nilai sekarang
      langsung dibaca sebagai giliran kebutuhan, walau kata bendanya bukan bangunan.

- [x] P31-34 Percakapan yang bangunannya sudah tercatat tidak menunggu model ekstraksi

      Percakapan kos 4 lantai memakai 28,4 detik lalu 90,5 detik lalu 35,4 detik untuk tiga pesan
      yang nilainya sudah dibaca parser nilai ("torennya di atas", "tanahnya 15 x 25 meter").
      Setelah jenis bangunannya tercatat, pesan lanjutan yang nilainya terbaca kode tidak lagi
      menunggu model; yang tidak disebut tetap ditanya kartu klarifikasi.

- [x] P31-35 Titik air per unit dan tinggi per lantai di gedung bertingkat

      "4 unit per lantai, tiap unit 2 kamar mandi" tercatat 2 titik per lantai — seperempat beban
      sebenarnya — dan "4 unit" jatuh ke jumlah sambungan. Sekarang jumlah unit per lantai dikali
      titik air per unit (8 titik), dan angka unitnya tidak dipakai dua kali.

      "tinggi per lantai 3,2 meter" dibaca lalu dibuang karena lantainya disebut di giliran
      sebelumnya; pengguna tetap ditanya tinggi bangunan. Tinggi bangunan sekarang diturunkan dari
      lantai yang sudah tercatat (12 × 3,2 m = 38,4 m), dibulatkan dua desimal — bukan
      38,400000000000006 m.

- [x] P31-36 "Oke itung" adalah permintaan menghitung, bukan basa-basi

      "oke itung" dibaca basa-basi dan dijawab "Siap. Lanjutkan kapan saja" — padahal pengguna
      meminta hitungannya. Contoh pertanyaannya ditambahkan; "itung aja" dan "hitung sekarang
      dong" sudah benar sebelumnya.

- [x] P31-37 Daftar belanja solusi berbahasa Inggris mengenali baris pipanya

      Di percakapan Inggris, batang pipa tampil di bawah "Fittings" dan jawabannya tetap berbunyi
      "jumlah batangnya belum dihitung" padahal batangnya ada di baris yang sama — satuan dan
      peruntukan BOM solusi Inggris sudah diterjemahkan ("rods", "Main line"), jadi baris pipanya
      tidak lagi dikenali. Sekarang dikenali dari satuannya dalam dua bahasa.

      "what size is the riser" atas solusi yang sudah dihitung dijawab "tidak ada acuan yang bisa
      saya pegang" — padahal ukuran pipa tegaknya ada di solusi. Pertanyaan ukuran riser sekarang
      ada di contoh pertanyaan bentuk sistem. Pertanyaan air minum atas HDPE dicatat sebagai OQ-82,
      karena faktanya memang belum ada dan tidak boleh dikarang.

- [x] P31-38 Pertanyaan atas angka solusi dijawab dari solusinya, bukan 60 detik karangan

      "kenapa toren harus 0,3 bar" memakai 60,7 detik — 12,6 detik merencanakan, 48,0 detik
      menulis — lalu keluar kalimat tentang luas bangunan yang tidak ditanyakan. Pertanyaan kasus
      yang sudah punya solusi sekarang dijawab dari solusinya, tanpa model. "boleh pakai pipa 1/2
      inci aja biar murah" dijawab "tidak ada acuan"; kedua bentuk itu ditambahkan ke contoh
      permintaan penjelasan, jadi jalurnya lewat solusi.

      Permintaan mengganti bahan ("ganti pipanya ke hdpe semua") dicatat sebagai OQ-83: jalur rumah
      tidak punya field bahan, dan mengubahnya diam-diam akan mengubah ukuran serta fittingnya.

- [x] P31-39 Jumlah alat yang dibagi per posisi dalam satu kalimat terbaca totalnya

      "atasnya ada 2 kamar mandi bawahnya 1" tercatat 2 kamar mandi dari 3 — diam-diam, dan
      kartunya tidak menanyakannya lagi karena field-nya sudah terisi. Angka tersurat yang pertama
      tidak lagi dipakai apa adanya: kalimat yang membagi jumlahnya per posisi tercatat sebagai
      totalnya. Kalimat "per lantai" tetap pengali, kalimat pembetulan tidak dijumlahkan, dan
      angka yang menempel di kata benda lain tetap miliknya ("8 keran wudhu di 2 tempat wudhu"
      tetap 8 keran dan 2 tempat, bukan 10 keran).

- [x] P31-40 Satu pertanyaan produk tidak lagi membuat solusi yang baru dihitung dianggap basi

      Subjek percakapan ikut tersimpan sebagai snapshot kebutuhan, jadi satu pertanyaan produk di
      tengah percakapan membuat solusi yang baru dihitung tampak basi — pertanyaan berikutnya pergi
      ke model (12,6 detik merencanakan + 48,0 detik menulis) alih-alih dibaca dari angkanya.
      Sekarang solusi hanya basi bila isi kebutuhannya memang berbeda, bukan karena nomor
      snapshotnya berganti.

- [x] P31-41 Pertanyaan jumlah batang atas solusi sendiri dijawab dari daftar belanjanya

      "how many lengths of pipe" di percakapan yang solusinya sudah dihitung dijawab pelajaran umum
      panjang batang standar, padahal daftar belanjanya memuat "main line 1¼" 4 rods". Pertanyaan
      jumlah batang yang tidak membawa panjang jalurnya sendiri sekarang dijawab dari solusinya;
      yang membawa panjangnya ("butuh berapa batang untuk jalur 30 meter") tetap pengetahuan umum.
      "which pipes do i need to buy" juga masuk contoh pertanyaan bentuk sistem.

- [x] P31-42 Kamar sewa dengan kamar mandi sendiri terbaca, dan jenis bangunan apa pun melewati model

      "kos 4 lantai, tiap lantai 6 kamar, tiap kamar ada kamar mandi sendiri" tercatat tanpa satu
      kamar mandi pun — dan memakai 16,4 detik di model ekstraksi untuk itu. Jumlah kamar sewa kali
      jumlah lantai sekarang terbaca parser nilai (24 titik), dan pesan yang menyebut jenis
      bangunannya melewati model ekstraksi seperti pesan rumah: nilainya dibaca kode, sisanya
      ditanya kartu klarifikasi.

- [x] P31-43 Angka yang tidak punya parameter di kasus teknis dikatakan, bukan didiamkan

      Di kasus sumur ke tandon, "toren 2000 liter di atap" lalu "ukuran bangunannya 10 x 20 meter"
      mendapat kalimat "Yang masih saya perlukan: …" yang sama persis dua giliran berturut-turut.
      Pesan yang membawa angka tetapi tidak mengisi satu parameter kasus pun sekarang dijawab
      dengan menyebut bahwa angkanya belum punya tempat di hitungan itu; kebutuhan parameternya
      sendiri dicatat sebagai OQ-84.

- [x] P31-44 Perumahan dikenali sebagai jaringan cluster, tinggi tower bukan panjang jalur

      "saya kontraktor, mau bangun perumahan 75 rumah tipe 45" tercatat hanya sebagai rumah
      tinggal: 75 rumahnya hilang, dan pesan berikutnya ("jalan utamanya 1,2 km") dijawab "belum
      punya acuan". Bentuk itu sekarang ada di contoh jaringan cluster, sehingga jumlah sambungan
      dan panjang jalurnya masuk ke parameter kasusnya. "toren 10 kubik di atas tower 9 meter"
      tercatat sebagai jalur utama ±9 m — tiang dan menara toren adalah ketinggian, bukan panjang
      jalur.

- [x] P31-45 Solusi yang menghitung pembuangan menyebut ukuran jalur buangannya

      "pipa buangannya ukuran berapa" di rumah yang kebutuhannya air bersih + pembuangan dijawab
      ukuran pipa air bersih saja, padahal jalur air kotor, air bekas, dan ventilasinya sudah
      dihitung. Ketiganya sekarang ikut disebut.

- [x] P31-46 Pertanyaan tidak membajak percakapan rumah ke kasus teknis

      "septic tanknya di mana" di rumah 2 lantai yang solusinya sudah dihitung membuka kasus
      saluran gravitasi, mencatat "jenis cairan air limbah", lalu menanyakan debit rencana dan
      kemiringan saluran. Kasus teknis baru hanya dibuka oleh pernyataan bernilai — pertanyaan
      dijawab di atas kebutuhan dan solusi yang sudah ada.

- [x] P31-47 Tiang toren di kasus teknis bukan panjang jalur

      Di kasus jaringan cluster, "toren 10 kubik di atas tower 9 meter" tercatat sebagai panjang
      jalur 9 m. Tiang dan menara toren tanpa kata "tinggi" sekarang terbaca sebagai ketinggian
      tandon, dan panjang jalur yang memang disebut ("jalan utamanya 1,2 km" → 1.200 m) tetap.

- [x] P31-48 "Butuh berapa batang" dijawab baris pipanya, bukan seluruh daftar belanja

      Jawabannya memuat jalur, pipa, dan dua puluh baris fitting dalam satu paragraf — untuk
      pertanyaan sependek itu. Sekarang baris pipanya saja, dengan satu kalimat bahwa daftar
      lengkapnya ada di layar solusi.

- [x] P31-49 Pesan tanpa perubahan atas solusi yang sudah dihitung dijawab dari solusinya

      "septic tanknya di mana" di rumah yang solusinya sudah dihitung dijawab ringkasan kebutuhan
      plus "Tekan Susun rekomendasi" — tombol untuk hitungan yang sudah ada. Giliran yang tidak
      mengubah apa pun sekarang membacakan solusinya. Sekaligus: giliran yang memang tidak
      memanggil model tidak lagi ditandai "pemahaman tidak tersedia" ketika modelnya tidak ada.

- [x] P31-50 Pertanyaan tanpa fakta pengetahuan pada kasus yang punya solusi dijawab dari solusinya

      "air bekas cucian masuk ke mana" dijawab "belum punya acuan yang bisa saya pegang", padahal
      baris air bekas di solusinya menyebut tujuannya (saluran atau sumur resapan). Kasus yang
      solusinya sudah dihitung tidak lagi dianggap tanpa acuan: jalur-jalur solusinya yang
      dibacakan. "butuh berapa batang pipa buat rumah ini" juga masuk contoh pertanyaan jumlah
      batang, supaya jawabannya baris pipanya saja (P31-48).

- [x] P31-51 Pernyataan kasus bernilai menang atas topik pengetahuan

      Satu contoh pertanyaan bentuk sistem ("which pipes do i need to buy") menarik pertanyaan FAQ
      "Pipa yg cocok buat proyek perumahan 50 unit?" ke jawaban pengetahuan tentang sambungan
      rumah — kasus clusternya hilang (FAQ MA-07, 18/19). Pesan yang menyatakan kasusnya sendiri
      dengan angkanya sekarang selalu kebutuhan, apa pun bentuk kalimatnya.

- [x] P31-52 "udah, itung aja" di ruko: dihitung dengan anggapan, tanpa model

      Percakapan ruko 3 lantai yang datanya lengkap kecuali jenis instalasi menjawab "udah, itung
      aja" dengan ringkasan kebutuhan yang sama persis plus pertanyaan jenis instalasi yang sama
      persis — 13,5 detik, untuk kalimat yang tidak punya satu angka pun. Sekarang permintaan
      menghitung adalah izin memakai anggapan: data inti yang punya default diisi bertanda ASUMSI
      untuk semua jenis bangunan, bukan hanya rumah tinggal, lalu rekomendasinya disusun di
      giliran itu. Percakapan yang jenis bangunannya sudah tercatat juga tidak lagi memanggil
      model ekstraksi untuk pesan tanpa nilai.

- [x] P31-53 Buangan, air hujan, pompa, dan sumur adalah bagian dari bangunannya

      Instalasi pembuangan rumah 2 lantai, lalu "septic tanknya 8 meter dari rumah" membuka kasus
      saluran gravitasi dan menanyakan debit rencana, kemiringan saluran, elevasi hulu, dan
      elevasi hilir — empat angka yang tidak dipunyai pemilik rumah, padahal ukuran pipa
      buangannya dihitung dari jumlah alatnya. Satu angka tentang buangan, air hujan, pompa, atau
      sumur sekarang tetap ukuran pekerjaan bangunannya; kasusnya sendiri baru terbuka bila
      pesannya membawa dua angka parameter atau lebih ("40 meter, beda tinggi 1,5 m").

- [x] P31-54 Pekerjaan pembuangan tidak bicara soal dudukan toren, dan "itung" tidak menuang ulang

      Rumah yang hanya memasang saluran pembuangan dijawab "tidak ada dudukan toren yang mencapai
      0,3 bar tanpa pompa pendorong" beserta ukuran pipa dari toren — dudukan toren sekarang hanya
      ada pada instalasi yang memuat air bersih. Judul solusi pembuangan juga sudah menyebut air
      kotor dan air bekasnya, jadi barisnya tidak diulang kata demi kata. Dan "udah itu aja, itung"
      atas solusi yang sudah dihitung dijawab satu baris berisi hasil dan tempat angkanya, bukan
      seluruh solusi dituang ulang — yang membuat pertanyaan sesudahnya dijawab "itu yang saya
      jelaskan di jawaban sebelumnya".

- [x] P31-55 Pesan yang nilainya sudah terbaca tidak dikenali ulang model

      "titik airnya ada 9, panjang pipa yang diganti kira-kira 35 meter" di percakapan renovasi
      ruko memakai 14,9 detik: 14,5 detik di pengklasifikasi maksud, untuk angka yang sudah dibaca
      parser nilai dan untuk jalur yang memang sudah pasti. Giliran yang membawa nilai kebutuhan
      pada percakapan yang maksudnya bukan sesuatu yang lain sekarang diputuskan kode.

- [x] P31-56 Penanda renovasi tidak menghapus jenis pekerjaan yang sudah disebut

      Proyek renovasi ruko yang dibuka dengan "pipa lama galvanis mau diganti semua" tercatat
      "ganti semua pipa" — lalu "pipa lamanya 3/4 inch" mengubahnya menjadi "renovasi (jenisnya
      belum disebut)", karena kata "pipa lama" di kalimat itu dibaca sebagai renovasi tanpa jenis.
      Kebutuhan yang tadinya bisa dihitung kembali menunggu jawaban, dan "udah, itung" dijawab
      "bagian mana yang mau diubah". Penanda tanpa jenis sekarang tidak menimpa jenis yang sudah
      ada; pengguna tetap bisa menggantinya dengan jenis lain.

- [x] P31-57 Titik air yang disebut tidak dilangkahi anggapan; permintaan hitung menyebut yang kurang

      Renovasi ruko dengan "titik airnya ada 9" dihitung dengan anggapan 1 kamar mandi per lantai,
      dan solusinya mengatakan "penggantian pipa untuk 7 titik air" — angka yang bukan angka
      pengguna. Selama aturan bauran alat per titik belum ada (OQ-85), anggapan kamar mandi tidak
      dipakai bila titik airnya disebut: bauran alatnya ditanyakan. Dan "udah, itung" yang masih
      menunggu data menyebut data itu namanya, bukan "bagian mana yang mau diubah". "berapa batang"
      pendek juga masuk contoh pertanyaan jumlah batang, supaya jawabannya baris pipanya.

- [x] P31-58 Kedalaman sumur terbaca di balik koma dan di belakang angka

      "water comes from a deep well, about 30 m" tercatat sebagai jalur utama ±30 m — kedalaman
      sumur masuk ke kolom panjang jalur, dan hitungan pompanya memakai kedalaman anggapan.
      "water from a borehole, 30 metres deep" tidak tercatat sama sekali. Sekarang kata kedalaman
      boleh terpisah koma dan kata pengisi, boleh berdiri di belakang angkanya, "borehole" diakui
      sebagai sumur, dan angka yang sudah terbaca sebagai kedalaman tidak pernah menjadi panjang
      jalur.

- [x] P31-59 Permintaan menghitung yang membawa nilai tetap permintaan menghitung

      "mau bangun masjid, tempat wudhunya 20 kran" lalu "airnya dari toren di atas, itung aja"
      dijawab ringkasan yang sama plus pertanyaan jenis instalasi — padahal jenis instalasi punya
      anggapan dan pengguna baru saja mengizinkan memakainya. Penyebabnya: permintaan menghitung
      hanya terbaca dari intent, dan pesan yang menyatakan nilai sekaligus memintanya berintent
      pernyataan kebutuhan. Kini ia katalog contohnya sendiri (`compute-request`), dibaca dari
      vektor pesan yang sudah disandikan — tanpa panggilan model tambahan — dengan sisi `none`
      yang memuat pertanyaan tentang menghitung ("lu bisa ngitung ga sih", "gimana cara ngitung")
      supaya kata yang sama tidak terbaca sebagai izin. Enam kasus baru di golden dataset lolos;
      akurasi intent 196/197 (99,5%), dua kegagalan lama tidak berubah.

- [x] P31-60 "Tempat wudhunya 20 kran" adalah 20 keran, bukan 20 tempat wudhu

      Satu tempat wudhu adalah satu deret keran dengan satu talang; 20 di antaranya berarti 20
      talang pembuangan. Pesan itu juga mencatat 20 titik air biasa, jadi masjidnya masuk hitungan
      dengan dua angka yang tidak pernah disebut siapa pun. Dua pangkalnya: angka yang berdiri di
      antara dua kata benda direbut kata benda di depannya — bahkan separuh angkanya, karena "20"
      mundur menjadi "2" demi lolos pagar satuan — dan pagar titik air gugur di balik klitik
      "-nya". Sekarang angka hanya dibaca utuh, kata benda di belakang angka ikut memagari, dan di
      kalimat yang memang bicara wudhu keran telanjang adalah keran wudhu.

- [x] P31-61 Dua sisi di kasus air hujan adalah luas tangkapannya

      "gudang baru 40 x 60 meter, mau pasang pipa air hujan dari atap" tercatat sebagai
      panjang/lebar lahan — parameter yang tidak dipakai kasus air hujan — lalu luas tangkapannya
      ditanyakan dalam hektar kepada orang yang baru saja menyebut ukuran atapnya. Di kasus air
      hujan dan gorong-gorong, pasangan sisi adalah bidang yang airnya masuk ke saluran ini:
      40 × 60 m = 0,24 ha. Lahan irigasi tetap panjang × lebar lahan.

- [x] P31-62 "Itung aja" di kasus teknis dihitung dengan anggapan, bukan daftar angka

      Drainase air hujan yang luas tangkapannya sudah disebut menjawab "itung aja" dengan empat
      angka yang masih diperlukan — intensitas hujan, panjang jalur, kemiringan, koefisien
      limpasan — padahal keempatnya punya anggapan di registry dan dua di antaranya memang
      keputusan pemilik (hujan 150 mm/jam, C 0,6). Permintaan menghitung di jalur teknis kini sama
      dengan di jalur bangunan (P31-52): yang belum diketahui tetapi punya anggapan dicatat
      sebagai anggapan bertanda, hitungannya jalan di giliran itu, dan parameter kritis tanpa
      anggapan tetap ditanya dengan namanya.

      Sekaligus: tiga pelanggaran lint dan satu kesalahan tipe di tes (`supply.boosterPumpNeeded`
      yang tidak pernah ada, sehingga `toBeFalsy()` lulus atas `undefined`) dari putaran kemarin
      dibereskan — `pnpm typecheck` dan `eslint` bersih lagi.

- [x] P31-63 Pertanyaan pengetahuan yang menyebut jenis jalur tetap dijawab dari pengetahuan

      Suite FAQ sales jatuh dari 19/19 ke 16/19 setelah putaran kemarin, dan ketiga yang jatuh
      bentuknya sama: pertanyaan pengetahuan yang kebetulan menyebut jenis jalur. "Apa bedanya
      pipa drainase dan pipa uPVC?" dijawab "Oke, sudah saya catat: pembuangan" setelah 14,7
      detik ekstraksi; "kegunaan pipa HDPE selain air minum dan air bersih" dijawab "Oke, sudah
      saya catat: air bersih"; dan pertanyaan jenis pipa terbaru untuk air bersih membuka kasus
      gedung bertingkat. Sebabnya: kosakata kebutuhan ("drainase", "air bersih") plus intent yang
      ragu sudah cukup membuat sebuah pesan dibaca sebagai kebutuhan, sehingga router tidak pernah
      melihatnya. Presedensinya sudah lama ada di `answersFromKnowledge` — pernyataan kasus
      bernilai dan topik hitungan yang membawa angkanya sendiri tetap kebutuhan — dan sekarang
      pagar itu juga berlaku di tempat giliran kebutuhan diputuskan.

- [x] P31-64 Keran wudhu yang disebut pengguna ikut disebut di judul solusinya

      Masjid 2 lantai dengan 20 keran wudhu dan 6 toilet dihitung benar — debit puncaknya
      menjumlahkan toilet menurut kurva Hunter dan 20 keran wudhu penuh (2 l/s, dibuka
      bersamaan menjelang salat), dan deret wudhunya punya pipa pembagi sendiri — tetapi
      judulnya berbunyi "Sistem distribusi untuk 12 titik air". Dua belas adalah jumlah titik
      toiletnya, dan angka itu benar; yang hilang justru angka yang pengguna sebut sendiri.
      Judul dan kalimat pembukanya sekarang menyebut keran wudhunya di samping titik airnya.

**Penutup putaran 2026-10-27 (P31-59 … P31-64).** Enam item, tiga rilis, tanpa migration. Dua
percakapan baru yang dicoba di produksi — masjid dengan tempat wudhu, dan gudang dengan pipa air
hujan dari atap — memunculkan empat cacat; memeriksa suite sesudahnya memunculkan yang kelima
(FAQ 16/19, regresi dari putaran kemarin) dan membaca hasil hitungan masjidnya memunculkan yang
keenam. Tes: API 1.858 lulus (2 dilewati), engineering 530, web 273; `typecheck` dan `eslint`
bersih. Di produksi: pipa 48/48, perhitungan 23/23, FAQ sales 19/19, dan kedua percakapan baru
itu kini dihitung — masjid 2 lantai 20 keran wudhu + 6 toilet menjadi pipa utama 2" dengan debit
puncak 3,64 l/s, gudang 40 × 60 m menjadi PVC D 12" untuk limpasan 60 l/s.

Yang masih menunggu pemilik di fase ini tetap dua: `LLM_MODEL_KNOWLEDGE` beserta kuncinya
(OQ-79) dan bauran alat per titik air (OQ-85).

- [x] P31-65 Air hujan atap dibagi ke turunan talangnya, bukan satu pipa untuk seluruh atap

      Pilihan pemilik atas OQ-86. Gudang 40 × 60 m keluar sebagai satu pipa PVC D 12" untuk
      seluruh limpasan 60 l/s — padahal atap seluas itu tidak pernah dialirkan satu pipa.
      Sekarang kalimat yang menyebut atap atau talang menandai tangkapannya sebagai atap, dan
      airnya dibagi ke turunan talangnya: jumlah turunan boleh disebut pengguna, kalau tidak
      disebut dianggap satu turunan tiap 15 m sisi atap di dua sisi (anggapan bertanda,
      menunggu ahli Pralon). Gudang itu kini 8 turunan, 7,51 l/s per turunan, pipa 6" — dengan
      jumlah pipa dan fitting mengikuti jumlah turunannya. Tangkapan dari halaman, jalan, atau
      parkir tetap satu saluran seperti sebelumnya.

      Di produksi: perhitungan 23/23 (kasus talang rumah 150 m² sekarang 2 turunan, 1,88 l/s
      per turunan), pipa 48/48, FAQ sales 19/19. Simulasi campuran masih 13/16 — tiga
      kegagalannya tidak menyentuh air hujan dan menjadi item berikutnya: ukuran HDPE dalam
      bahasa Inggris tanpa satuan mm, jawaban renovasi yang tidak menyebut bahan, dan lanjutan
      "yang terbesar" yang tidak dijawab.

- [x] P31-66 Pertanyaan ukuran dalam bahasa Inggris yang menyebut Pralon dijawab ukurannya

      "Which sizes are available for pralon hdpe pipe?" dijawab daftar jenis HDPE beserta
      jumlah produknya — jawaban untuk "jenisnya apa saja", bukan untuk "ukurannya apa saja" —
      sementara kalimat Indonesianya menjawab ukuran per jenis dengan benar. Nama Pralon di
      kalimat Inggris menarik pertanyaannya ke ragam produk, dan tidak ada satu pun contoh
      bahasa Inggris yang menyebut Pralon sekaligus menanyakan sebuah aspek. Contohnya
      ditambahkan (ukuran, kelas tekanan, standar, panjang batang, bahan), jadi yang menentukan
      sekarang aspek yang ditanya, bukan nama perusahaannya. Golden dataset bertambah dua
      kalimat; pengenalan intent 198/199.

- [x] P31-67 "Yang paling besar berapa?" dijawab ukuran terbesar keluarganya

      Sesudah daftar ukuran per jenis HDPE, pertanyaan lanjutan itu dijawab "Ukuran tersedia
      Pipa HDPE PE 100 PN-8 160 mm x 9 Meter: 160 mm" — ukuran satu produk yang kebetulan
      menjadi subjek percakapan, padahal HDPE terbesar 900 mm. Jawaban ujung ukuran sudah ada
      sejak P31-01, tetapi hanya dipakai bila keluarganya disebut di pesan itu juga; pertanyaan
      lanjutan tidak menyebut apa pun. Keluarganya kini boleh datang dari subjek percakapan,
      seperti pada pertanyaan ketersediaan ukuran dan kelas tekanan yang sudah begitu.

- [x] P31-68 "Pipa galvanis karatan, ganti pakai apa?" dijawab bahan penggantinya

      Pertanyaannya tidak dijawab sama sekali: kebutuhan rumahnya dicatat lalu kartu
      klarifikasi, sementara yang ditanya — mau ganti pakai apa — menguap. Dua sebabnya.
      Pertama, tidak ada satu pun contoh permintaan saran yang menyebut pipa lama berbahan lain
      yang mau diganti, jadi kalimatnya ragu antara minta saran dan menyebut kebutuhan rumah;
      contohnya ditambahkan. Kedua, jalur nasihat bahan akan menyarankan galvanis itu sendiri
      ("biasanya lebih cocok untuk instalasi lama") — menyarankan bahan yang bukan produk
      Pralon. Bahan di luar katalog sekarang membawa penggantinya di tabel pengetahuan, dan
      jawabannya menyebut untuk apa bahan itu tidak dipakai lalu pipa Pralon yang
      menggantikannya. Golden dataset bertambah dua kalimat (termasuk kembarannya yang memang
      kebutuhan, "semua pipanya mau diganti ke pralon"); pengenalan intent 200/201.

- [x] P31-69 Bangunan dengan banyak toilet diserahkan ke tim teknis, bukan gagal

      "Sekolah 3 lantai, 24 toilet, airnya dari pdam" dijanjikan dihitung, lalu Susun
      rekomendasi berhenti dengan "layanan tidak tersedia" — yang terjadi sebenarnya: beban
      alatnya 156 unit, di atas 100 unit yang tercakup kurva debit puncak aturan ENG-701 dan
      ENG-801, dan aturannya menolak masukan itu di tengah hitungan. Beban alat sekarang
      dihitung dari kebutuhan yang sudah tercatat sebelum apa pun dijanjikan: di atas tabel,
      percakapannya menyerahkan kasusnya ke tim teknis dengan alasan yang menyebut angkanya,
      dan Susun rekomendasi yang tetap dipanggil menjawab tidak sah — bukan gangguan layanan
      yang mengundang coba lagi. Angka di atas 100 unit tidak dikarang: perlu disahkan ahli
      (OQ-87), dan sampai itu ada bangunan sebesar ini memang diserahkan. Pemilik memilih
      melanjutkan tabelnya begitu tim teknis Pralon mengesahkan daftar angkanya; yang diminta
      ke ahli sudah ditulis di OQ-87 sebagai satu daftar pasangan angka.

- [x] P31-70 Angka teknis menyebut kode sumbernya

      Permintaan pemilik: hitungan teknis harus bersumber, dan salah satu pedoman yang dipakai
      Pralon adalah UPC. Sumber setiap aturan sudah tercatat sejak awal, tetapi tidak satu pun
      sampai ke mata pengguna — angka tabel kode dan angka turunan rumus tampil sama saja.
      Tujuh aturan yang membaca tabel kode (beban dan kapasitas pembuangan, beban air bersih
      rumah dan bangunan umum, cabang, talang wudhu) sekarang mengutip kodenya, dan kutipan itu
      tampil di bawah langkah hitungnya — di layar detail teknis dan di tabel langkah hitung
      laporan PDF. Satu tes menjaga aturan baru: angka dari IPC, UPC, atau SNI tanpa kutipan
      menggagalkan suite. Kode mana yang mengikat angka beban alat jadi pertanyaan tersendiri:
      angka IPC yang dipakai sekarang berbeda dari UPC untuk alat yang sama, dan UPC punya
      kolom bangunan pertemuan untuk masjid dan sekolah — selisihnya ditulis di OQ-88 dengan
      usul memindahkannya, menunggu pilihan pemilik.

- [x] P31-71 Beban alat air bersih mengikuti UPC

      Pemilik memilih kedua kode dibaca, dan UPC yang menang bila angkanya berbeda (OQ-88).
      Beban alat air bersih sekarang dari UPC Tabel A 103.1: rumah memakai kolom pemakaian
      pribadi (kloset 2,5, shower 2,0, wastafel 1,0, bak cuci dapur 1,5), sekolah, klinik, dan
      ruko kolom umum (kloset 2,5, keran 1,0, urinoir 2,0), rumah ibadah kolom pertemuan
      (kloset 3,5, urinoir 3,0) — tiga kolom, dipilih dari jenis bangunannya. Rumah contoh naik
      dari 12,6 ke 19 unit dan pipa utamanya dari 1" ke 1¼"; toilet umum justru turun, sehingga
      sekolah 24 toilet yang kemarin diserahkan ke tim teknis sekarang dihitung dan batas kurva
      debit puncak baru tercapai di 29 toilet. Konversi beban → debit tetap kurva Hunter IPC
      karena kurva UPC hanya terbit sebagai grafik; langkah hitungnya menyebut kedua kode itu.
      Beban dan kapasitas pembuangan masih IPC — bentuk tabel UPC-nya berbeda, jadi itu item
      tersendiri, dan OQ-88 mencatat angkanya yang sudah terbaca.

- [x] P31-72 Beban dan kapasitas pembuangan mengikuti UPC

      Lanjutan keputusan yang sama (OQ-88): beban alat pembuangan sekarang dari UPC Tabel
      702.1 — kloset tangki 1,6 gpf 3 DFU, bukan 4 — dan kapasitas salurannya dari UPC Tabel
      703.2, yang lebih ketat dari IPC di diameter kecil: 2" menampung 8 beban mendatar, bukan
      21. Bentuk aturannya ikut berubah karena UPC tidak memisahkan beban per interval cabang
      seperti IPC: satu batas untuk pipa tegak berapa pun lantainya, satu untuk jalur mendatar.
      Akibatnya dua arah — rumah tiga kamar mandi turun dari 12 ke 9 DFU, sedangkan air bekas
      masjid dua lantai naik dari 2½" ke 3" dan talang wudhunya justru turun ke 2½". Beban
      urinoir dan alat beraliran kontinu masih dari IPC karena barisnya belum terbaca di UPC,
      dan aturannya menyebut kode yang dipakainya, jadi perbedaannya terlihat di layar.

- [x] P31-73 Kartu serah terima menyebut alat toilet umum, bukan shower

      Sekolah 24 toilet yang diserahkan ke tim teknis membawa barisnya sebagai "48 titik:
      shower + kloset" — toilet umum tidak berisi shower, dan laporannya sudah menulis
      "kloset + keran" sejak lama. Dua tempat menurunkan hal yang sama dengan caranya
      sendiri; sekarang satu fungsi yang menentukan bangunan mana berisi toilet umum, dan
      laporan, kartu serah terima, serta antrean tim teknis memakainya bersama.
