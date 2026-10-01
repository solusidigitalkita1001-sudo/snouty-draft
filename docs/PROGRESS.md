# SNOUTY — Progress

Last updated: 2026-10-01 · Current phase: **1 — Product Catalog** · Next item: **P1-07 promosi versi katalog**

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
- Decision needed before Phase 5/10 design work: **OQ-15** (guest entitlement) — it determines whether
  the solution workspace (screen 06) is reachable without an account.

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
- [ ] P0e-05 CI pipeline — berkas `.github/workflows/ci.yml` sudah ada (commit `f467a03`); masih `[ ]` karena pipeline belum pernah benar-benar dijalankan, _provider menunggu OQ-09_
- [x] P0e-06 `packages/ui` design tokens (light + dark) + preview page — 74 token; `/tokens` dirender & diverifikasi
- [x] P0e-07 Self-hosted IBM Plex Sans/Mono — diverifikasi: 0 rujukan ke gstatic
- [x] P0e-08 API health check (DB connectivity, read-only) — diuji terhadap DB sungguhan **dan** DB mati
- [x] ✋ CHECKPOINT — **disetujui pemilik 2026-09-30** ("lanjut ke task berikutnya")

## Phase 1 — Product Catalog

Katalog harus lebih dulu: matching, BOM, skema, dan laporan semuanya membaca darinya
(`docs/ROADMAP.md` §2). Layar terkait: **10** (drawer detail produk) dan back-office katalog.

**Yang terhalang:** parser untuk format berkas tertentu menunggu **OQ-07** (sumber katalog), dan
penerapan migration ke server menunggu persetujuan pemilik + backup terkonfirmasi
(`docs/DATABASE.md` §4). Sisanya tidak terhalang — kontrak impor sengaja dibuat bebas format,
sehingga menambahkan pembaca Excel atau ERP nanti adalah menambah satu adapter, bukan merombak.

- [x] P1-01 Skema katalog (Drizzle) + berkas migration `.sql` — **tidak diterapkan** ke server; 7 tabel, CHECK constraint, jaminan satu versi aktif
  - [x] P1-01a Tes: migration up/down berjalan di kontainer MySQL sekali pakai — **17 pemeriksaan lolos**
- [x] P1-02 Tipe domain katalog di `packages/shared-types` — field spesifikasi kosong bertipe eksplisit `UNAVAILABLE`, bukan dihilangkan
- [x] P1-03 Value object `PipeSize` (parsing kanonik, perbandingan, format tampilan)
  - [x] P1-03a Tes: `1¼"` dan `1.25"` adalah ukuran yang sama; urutan benar — 13 tes lolos
- [x] P1-04 Repository katalog (produk, ukuran, spesifikasi, kompatibilitas, versi) — port di `domain`, implementasi MySQL di `infrastructure`; pagination cursor atas `sku`, bukan `OFFSET`
  - [x] P1-04a Tes integrasi terhadap kontainer MySQL; tes penghitung query (tanpa N+1) — **25 tes lolos**; `listProducts` tetap 3 query untuk 1 maupun 20 produk
- [x] P1-05 Kontrak impor bebas format + validasi per baris — validator murni tanpa I/O; `rowHash` ikut dihitung di sini supaya P1-06 tidak perlu menurunkannya ulang
  - [x] P1-05a Tes: semua galat baris dilaporkan sekaligus, bukan satu per satu — **28 tes lolos**; kolom wajib yang hilang dilaporkan sekali, bukan sekali per baris
  - [ ] `[!]` P1-05b Adapter untuk format sebenarnya — **terhalang OQ-07**
- [ ] P1-06 Job `catalog.ingest` (RabbitMQ, idempoten per `catalogVersionId + rowHash`, DLQ) — **inti selesai, transport tertunda**
  - [x] P1-06 inti: migration 0001 (`products.row_hash` + `catalog_import_runs`), `CatalogIngestService`, `MysqlCatalogWriter` — idempotensi berlapis tiga, lapisan terdalamnya `uq_products_version_row_hash`
  - [x] P1-06a Tes: impor yang sama dua kali menghasilkan satu versi — **72 tes lolos**; migration 24 pemeriksaan
  - [ ] `[!]` P1-06b Transport RabbitMQ (publisher, konsumer, retry berbackoff, DLQ) — **terhalang OQ-40**: `apps/worker` belum punya jalan memakai kode domain `apps/api`
- [ ] P1-07 Promosi versi katalog + invalidasi cache
  - [ ] P1-07a Tes: tepat satu versi `active`; promosi membatalkan cache dan menulis audit
- [ ] P1-08 API baca katalog — `GET /products`, `/products/:id`, `/products/:id/compatible`, `/catalog/version` `[layar 10]`
  - [ ] P1-08a Tes: field spesifikasi null dikembalikan sebagai `UNAVAILABLE`, bukan dihilangkan
- [ ] P1-09 Pemetaan provenance untuk field katalog kosong
  - [ ] P1-09a Tes: invarian C-1 — spesifikasi kosong tidak pernah diisi tebakan
- [ ] P1-10 Back-office katalog: unggah, laporan validasi, pratinjau draft, promosi `[perlu desain — OQ-21]`
  - [ ] P1-10a Tes: rute `/internal/catalog/*` menolak peran selain `catalog_admin`; setiap tulis diaudit
- [ ] P1-11 Katalog contoh untuk pengembangan (bukan data Pralon asli)
- [ ] P1-12 `docs/PRODUCT_KNOWLEDGE.md` diperbarui sesuai implementasi akhir
- [ ] ✋ CHECKPOINT — reviewed by owner

## Phases 2–13

(headings only; broken down at the start of each phase)

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
| 10     | Product detail drawer                                     | 1–2                 | [ ]                               |
| 11     | Technical validation                                      | 5, 10               | [ ]                               |
| 12     | History & saved                                           | 10                  | [ ]                               |
| 13     | Mobile (13a/13b/13c)                                      | all                 | [ ]                               |
| 14     | Onboarding                                                | 3                   | [ ]                               |
| —      | Report PDF                                                | 10                  | [ ]                               |
| —      | Mascot moods                                              | 3+                  | [ ]                               |
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

| Date       | Items worked on      | Result                                     | Branch / commits                   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | -------------------- | ------------------------------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-30 | P0a-01 … P0a-07      | 6 done, P0a-04 blocked                     | `phase-0/P0a-analysis`             | Design bundle moved to `design-input/handoff/`. 33 open questions raised; 11 design conflicts found beyond SPEC §33h.                                                                                                                                                                                                                                                                                                                    |
| 2026-09-30 | P0a-04               | done — Phase 0a now 7/7                    | `phase-0/P0a-analysis`             | Credentials supplied. `snouty` is empty; server is shared with 7 other databases. Raised OQ-34: the supplied account is a server-wide superuser, contrary to SPEC §17 least privilege.                                                                                                                                                                                                                                                   |
| 2026-09-30 | Checkpoint 0a        | disetujui ("ok gas")                       | —                                  | Lanjut dengan proposed default untuk OQ yang belum dijawab. Bahasa dokumen baru: Indonesia.                                                                                                                                                                                                                                                                                                                                              |
| 2026-09-30 | P0b-01 … P0b-09      | 9/9 selesai                                | `phase-0/P0b-core-docs`            | Sembilan dokumen inti ditulis dalam Bahasa Indonesia. `DATABASE.md` memuat draf SQL akun least-privilege (OQ-34); `DESIGN_IMPLEMENTATION.md` memuat peta token gelap lengkap (OQ-16).                                                                                                                                                                                                                                                    |
| 2026-09-30 | Checkpoint 0b        | disetujui ("lanjut")                       | —                                  |                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-09-30 | P0c-01 … P0c-15      | 15/15 selesai                              | `phase-0/P0c-remaining-docs`       | Seluruh 28 dokumen Bagian 48 kini ada.                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-09-30 | Checkpoint 0c        | disetujui ("lanjut gass")                  | —                                  |                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-09-30 | P0d-01 … P0d-14      | 14/14 selesai                              | `phase-0/P0d-claude-config`        | `.claude/CLAUDE.md` + 13 skill; frontmatter divalidasi, nama cocok dengan folder. Skill merujuk ke `docs/*.md`, tidak menduplikasinya. Menunggu review sebelum Fase 0e.                                                                                                                                                                                                                                                                  |
| 2026-09-30 | P0e-01 … P0e-08      | 7/8 selesai, P0e-05 tertunda               | `phase-0/P0e-skeleton`             | Monorepo, token, font self-hosted, health check. CI ditulis tetapi provider masih OQ-09.                                                                                                                                                                                                                                                                                                                                                 |
| 2026-09-30 | P1-01 … P1-03        | 3/3 selesai                                | `phase-1/P1-01-catalog-foundation` | Skema katalog + migration reversibel (17 pemeriksaan), tipe domain, value object `PipeSize` (13 tes). Migration **tidak** diterapkan ke `192.168.1.136`.                                                                                                                                                                                                                                                                                 |
| 2026-10-01 | P1-04, P1-04a        | 2/2 selesai                                | `phase-1/P1-01-catalog-foundation` | Repository katalog + 16 tes integrasi terhadap kontainer MySQL sekali pakai; total 25 tes `@snouty/api` lolos. Ditambahkan `tsconfig.spec.json` karena berkas `*.spec.ts` sebelumnya tidak pernah di-typecheck. Redis/RabbitMQ lokal tidak bisa menyala: port 6379 dan 5672 sudah dipakai kontainer proyek lain (bukan blocker Fase 1).                                                                                                  |
| 2026-10-01 | P1-05, P1-05a        | 2/2 selesai (P1-05b tetap terhalang OQ-07) | `phase-1/P1-01-catalog-foundation` | Kontrak impor bebas format + validator murni; total 53 tes `@snouty/api` lolos. Dua ambiguitas dicatat: **OQ-38** (dokumen memuat dua model impor yang bertentangan — seluruhnya atau sebagian) dan **OQ-39** (konvensi sel untuk nilai jamak). Definisi kunci spesifikasi dipindahkan ke `domain/` supaya validator impor dan mapper pembacaan memakai satu daftar.                                                                     |
| 2026-10-01 | P1-06 (inti), P1-06a | inti selesai; P1-06b terhalang OQ-40       | `phase-1/P1-01-catalog-foundation` | Migration 0001 + use case ingest idempoten; 72 tes `@snouty/api` dan 24 pemeriksaan migration lolos. Migration **tidak** diterapkan ke `192.168.1.136`. Port Redis/RabbitMQ lokal digeser ke 6380/5673 karena 6379 dan 5672 dipakai kontainer proyek lain. Dicatat **OQ-40**: konsumer RabbitMQ tinggal di `apps/worker` tetapi kode domain di `apps/api`, dan belum ada jalan di antaranya — menyangkut semua job, bukan hanya katalog. |
