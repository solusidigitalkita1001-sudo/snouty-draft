# SNOUTY — Open Questions

Last updated: 2026-09-30 · Raised during Phase 0a (P0a-07)

Every ambiguity, conflict, and missing input is recorded here instead of being silently assumed.
Each item has a stable ID, a **proposed default** that work proceeds under until you decide, and the
phase it blocks. "Blocks" means work on that phase cannot be _completed_ correctly without an answer;
items marked _non-blocking_ only need an answer before the affected phase ships.

Status values: `open` · `answered` · `superseded`.

Decisions you make here should be transferred into `design-input/DESIGN_DECISIONS.md` (design matters)
or into the relevant `docs/*.md` (engineering/business matters), and this file updated to `answered`.

---

## A. Project context — Section 1 blanks

### OQ-01 — Old codebase and data migration

**Status:** open · **Blocks:** 0b (DATABASE.md), 3 (auth/users)
Section 1 is unfilled. `/Users/f/Documents/pralon/snouty/` exists on this machine but is an **empty
directory**; this repository (`snouty-draft`) has **no commits** and contains only the Claude Design
bundle. I found no previous SNOUTY source anywhere under `/Users/f/Documents/pralon/`.
**Question:** Is there an old SNOUTY codebase elsewhere (another machine, a Git remote), and are there
existing users, conversations, or catalog rows to migrate?
**Proposed default:** Greenfield build, no migration. No legacy data is imported.
**Partially answered 2026-09-30:** the `snouty` database on the shared server is confirmed **empty**
(0 tables, views, routines, triggers, events), so the "Existing `snouty` DB contents" blank in
Section 1 is resolved. Whether an old codebase exists elsewhere is still open.

### OQ-02 — MySQL database name, user, and password

**Status:** **answered** (2026-09-30) · unblocked P0a-04
Credentials supplied: database `snouty` on `192.168.1.136:3306`, user `ict`. Inspection performed with
read-only statements only (`SELECT` / `SHOW` / `information_schema`); nothing was written.

Findings:

|                                |                                                                                                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server                         | MySQL **8.0.46**-0ubuntu0.22.04.4                                                                                                                                                               |
| `sql_mode`                     | `ONLY_FULL_GROUP_BY, STRICT_TRANS_TABLES, NO_ZERO_IN_DATE, NO_ZERO_DATE, ERROR_FOR_DIVISION_BY_ZERO, NO_ENGINE_SUBSTITUTION` (strict — good)                                                    |
| Server charset                 | `utf8mb4` / `utf8mb4_0900_ai_ci`                                                                                                                                                                |
| `snouty` database              | **exists and is completely empty** — 0 tables, 0 views, 0 routines, 0 triggers, 0 events                                                                                                        |
| `snouty_dev`, `snouty_staging` | do not exist                                                                                                                                                                                    |
| Other databases on the host    | `partner_db` (57 tables, 39.7 MB), `work_order` (86, 19.2 MB), `digital_book` (20, 26.1 MB), `wo_dev` (46, 15.6 MB), `asset` (37, 4.7 MB), `bagspace` (12, 4.1 MB), `bagspace_dev` (43, 1.1 MB) |

Two consequences worth carrying forward: the server is genuinely multi-tenant (301 tables of other
people's data), which is exactly why SPEC §17 treats it as non-disposable; and the existing naming
convention here is `<name>` for production with `<name>_dev` alongside it (`work_order`/`wo_dev`,
`bagspace`/`bagspace_dev`) — there is **no `_staging` precedent on this host**. See OQ-35.

This finding also raised **OQ-34** (privileges).

### OQ-03 — Pricing in scope

**Status:** **answered** (2026-10-05, default diterima) · **Blocks:** 8 (BOM), 10 (report) · also drives 33h #1
The report (`SNTY-2026-09-0148`) and the prototype's report overlay both show unit price, subtotal,
PPN 11%, and total; screen 10 explicitly says the product panel carries no price. The report component
already parameterises the tax rate (`taxRate` prop, default 11).
**Question:** Is pricing in MVP scope, and if so what is the authoritative price source?
**Proposed default:** Pricing **out of scope for MVP**, behind a config flag `PRICING_ENABLED=false`.
BOM and report render without price columns. Schema and report template are built so prices can be
switched on later without rework.

### OQ-04 — Price data source and tax configuration

**Status:** open · **Blocks:** 8 (only if OQ-03 = yes) · _non-blocking otherwise_
**Question:** Distributor price list, ERP, or manual upload? Per region? Who owns updates?
**Proposed default:** If enabled, a versioned `price_list` table in MySQL loaded by `catalog_admin`
with effective date + region + currency; `TAX_RATE_PERCENT` from env (11 today), never hardcoded.

### OQ-05 — Premium / advanced tier definition

**Status:** open · **Blocks:** 5 (policy), 10 (entitlement enforcement)
**Question:** Is "Lanjutan" a paid tier, a free-with-account tier, or undecided?
**Proposed default:** Free-with-account. `registered` and `advanced` collapse into one tier for MVP
(every registered user gets advanced capabilities); the Policy Engine still models them separately so
splitting them later is a config change, not a refactor.

### OQ-06 — Pralon domain expert for engineering rule validation

**Status:** open · **Blocks:** 6 (every rule stays `REQUIRES_DOMAIN_VALIDATION` without this)
**Question:** Who at Pralon signs off on sizing rules, and through what process?
**Proposed default:** Rules ship as `REQUIRES_DOMAIN_VALIDATION`, so **no sizing value can ever render
as TERVERIFIKASI** until an expert validates it through the Phase 6 back-office. This is safe but means
the flagship screen shows amber "ASUMSI" everywhere until sign-off happens — please prioritise naming
the expert.

### OQ-07 — Product catalog source

**Status:** open · **Blocks:** 1
**Question:** Where does the real Pralon catalog come from — Excel, ERP export, PDF catalog, other?
The design cites "Katalog produk Pralon 2026 · hal. 14" and "KATALOG PRALON v2.4".
**Proposed default:** Excel/CSV import through the Phase 1 catalog-admin screen, with
`catalog_version`, `source_document`, and `source_page` mandatory per row.

### OQ-08 — Technical handoff target and SLA

**Status:** **answered** (2026-10-05, default diterima) · **Blocks:** 10 (technical handoff), 11 (email)
The design promises "Balasan biasanya 1×24 jam kerja" on screen 11.
**Question:** Where does "Kirim ke tim teknis Pralon" deliver — mailbox, CRM, ticket system? Is 1×24
working hours the contractual SLA we may display?
**Proposed default:** Email to a `TECH_HANDOFF_TARGET` address via n8n, plus a row in the internal
handoff queue. SLA copy stays "1×24 jam kerja" exactly as designed, driven by config not a literal.
**Diterapkan:** P10-06 (2026-10-08) — worker → webhook n8n bertanda tangan. Menunggu pemilik: `N8N_HANDOFF_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `TECH_HANDOFF_TARGET` di `.env.production` dan alur n8n yang memverifikasi tanda tangan lalu mengirim email.

### OQ-09 — Git remote and CI provider

**Status:** **answered** (2026-10-05, default diterima) · **Blocks:** 0e (P0e-05)
No remote is configured on this repository.
**Question:** GitHub, GitLab, or self-hosted?
**Proposed default:** GitHub + GitHub Actions. If you choose GitLab I will swap the pipeline file only;
the job definitions are provider-agnostic.

### OQ-10 — Hosting, scale, and LLM budget

**Status:** open · _non-blocking until 13_
**Question:** On-prem or cloud (which)? Expected users/day and concurrency? Monthly LLM budget?
**Proposed default:** On-prem Docker Compose behind Nginx (consistent with an internal MySQL at
`192.168.1.136`), sized for low hundreds of consultations/day. Cost tracking is built from day one
(Section 24) so a budget can be enforced once you set one.

### OQ-11 — Language scope

**Status:** open · _non-blocking_
**Question:** Bahasa Indonesia only, or also English?
**Proposed default:** Bahasa Indonesia only for MVP, but all copy lives in one i18n-ready messages
module so English can be added without touching components.

### OQ-12 — Privacy policy and terms copy

**Status:** **answered** (2026-10-05, default diterima) · **Blocks:** 3 (onboarding consent), 13
Onboarding and registration must link to a privacy policy; Section 30b requires consent records to
carry a policy version.
**Question:** Who supplies the Indonesian privacy policy and terms text, and what is the version label?
**Proposed default:** Placeholder pages at `/privasi` and `/ketentuan` with policy version `v0-draft`
recorded in consent rows; swapped before any real launch.

### OQ-13 — Data retention periods (UU PDP)

**Status:** open · **Blocks:** 13 · _design-affecting from 3_
**Question:** How long do we keep guest chats, registered chats, emails, uploads, and generated reports?
**Proposed default:** guest conversations 90 days → then anonymised to aggregate market data only;
registered conversations retained until the user deletes them; uploads 180 days; generated reports 12
months; email intelligence 24 months. All values as config, not literals.

### OQ-34 — The supplied account is a server-wide superuser

**Status:** open · **Blocks:** any deployment · **Severity: high**
The only non-system account on `192.168.1.136` is `ict@%` / `ict@localhost`, and it holds
`ALL PRIVILEGES ON *.* WITH GRANT OPTION` — including `DROP`, `SHUTDOWN`, `CREATE USER`, `FILE`,
`SUPER`, `BACKUP_ADMIN`, and `SYSTEM_VARIABLES_ADMIN` — across **all eight databases on the host**.
There is no least-privilege pattern here at all; every application on this server appears to connect
as `ict`.

SPEC §17 requires the opposite: separate least-privilege users per environment, and explicitly "the
app user must not have DROP privileges". As it stands, a bug, a bad migration, or a compromised
`.env` in SNOUTY could drop `partner_db` or `work_order` — other teams' production data.

**Question:** May I write the SQL for three dedicated SNOUTY users (`snouty_app`, `snouty_migrator`,
`snouty_ro`) scoped to the SNOUTY databases only, for **you** to review and run? I will not create
users or grant privileges myself — that is a change to shared infrastructure.
**Proposed default until then:** development continues against `snouty` using `ict`, but the
credential is treated as production-grade: `.env` only, never committed, never in logs or docs. No
migration is executed against the server by me under any account. This is recorded as a release
blocker in `docs/PROGRESS.md`.

### OQ-35 — Environment database naming

**Status:** open · _non-blocking_ · **Blocks:** 0e
My Phase 0 proposal assumed `snouty_dev` / `snouty_staging` / `snouty`. The host's existing convention
is `<name>` + `<name>_dev` with no staging tier anywhere.
**Question:** Do you want a staging database, and should I follow the host convention?
**Proposed default:** Follow the host convention — `snouty_dev` and `snouty` — and add
`snouty_staging` only if you want a staging tier. CI keeps using a disposable container, never this
host.

---

### OQ-36 — Tailwind v4 memakai konfigurasi berbasis CSS, bukan berkas preset

**Status:** open · _non-blocking_ · **Fase:** 0e (sudah diterapkan)
SPEC §32 menyebut `packages/config` memuat "tailwind preset", yang mengikuti pola Tailwind v3.
Tailwind versi sekarang (v4) memakai konfigurasi berbasis CSS lewat blok `@theme`, dan tidak lagi
memakai berkas preset JavaScript.

**Yang saya lakukan:** blok `@theme inline` ditempatkan di `packages/ui/src/tokens.css`, tepat di
bawah definisi tokennya. Hasilnya justru lebih baik daripada preset terpisah — token tetap satu
sumber alih-alih disalin ke berkas konfigurasi yang bisa menyimpang.
**Bila Anda tidak setuju,** ini mudah dipindahkan; tidak ada kode aplikasi yang bergantung padanya.

### OQ-37 — Versi paket jauh lebih baru daripada yang diasumsikan spesifikasi

**Status:** open · _non-blocking_ · **Fase:** 0e (sudah diterapkan)
Beberapa pilihan versi perlu dicatat karena berdampak pada kode:

| Paket      | Dipakai   | Catatan                                                                                                                  |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| TypeScript | **6.0.3** | v7 sudah rilis, tetapi `typescript-eslint` masih mensyaratkan `<6.1.0`                                                   |
| NestJS     | **12**    | **ESM-only** — karena itu `apps/api` dan `apps/worker` memakai `"type": "module"` dan impor relatifnya berekstensi `.js` |
| Next.js    | **16**    | App Router, Turbopack                                                                                                    |
| Tailwind   | **4**     | lihat OQ-36                                                                                                              |
| Vitest     | **5**     |                                                                                                                          |

Yang paling berdampak adalah NestJS 12 yang ESM-only: itu mengubah gaya impor di seluruh backend.
Sudah diverifikasi bekerja (typecheck, build, tes, dan health check terhadap DB sungguhan).

**Drizzle belum dipasang.** Ia menyusul di Fase 1 bersama skema pertama; memasang ORM tanpa skema
hanya menambah bobot tanpa manfaat. Rekomendasi Drizzle di `PHASE0_PROPOSAL.md` §4 tetap berlaku.

### OQ-38 — Impor katalog: seluruhnya atau sebagian?

**Status:** open · _non-blocking_ · **Fase:** 1 (P1-05)
`docs/PRODUCT_KNOWLEDGE.md` §3 memuat dua pernyataan yang tidak bisa benar bersamaan. Diagramnya
berkata **"ada galat → laporan galat per baris, tidak ada yang masuk"** (seluruhnya atau tidak sama
sekali), sementara `CatalogImportResult` membawa `rowsAccepted` **dan** `rowsRejected`, yang
menyiratkan baris baik tetap masuk sementara baris buruk dibuang.

Perhatikan bahwa ini **bukan** pertanyaan yang sama dengan "baris gagal tidak memblokir baris lain".
Aturan itu soal _pelaporan_: validasi tidak berhenti di galat pertama, semua galat dilaporkan
sekaligus. Itu sudah diterapkan dan diuji.

**Usulan default: seluruhnya atau tidak sama sekali.** Versi katalog `draft` hanya dibuat bila
jumlah galatnya nol. Alasannya: versi yang setengah terisi tetap _terlihat_ lengkap di layar
promosi, dan admin yang mempromosikannya akan mengirim katalog berlubang ke pengguna — kegagalan
yang jauh lebih mahal daripada mengunggah ulang satu berkas. Dalam model ini `rowsAccepted` berarti
"baris yang lolos validasi", dan nilainya tetap berguna di laporan meski tidak ada yang tersimpan.

**Yang sudah dikerjakan:** validator (P1-05) mengembalikan `rows` **dan** `issues` sekaligus,
sehingga keputusan ini sepenuhnya milik job `catalog.ingest` (P1-06). Mengubahnya nanti berarti
mengubah satu syarat di job, bukan menulis ulang validasi.

### OQ-39 — Konvensi sel untuk nilai jamak dan rujukan fitting

**Status:** open · _non-blocking_ · **Fase:** 1 (P1-05, sudah diterapkan)
Kontrak impor bebas format, tetapi satu baris katalog tetap harus bisa menyebut **beberapa** ukuran
dan **beberapa** fitting sepadan. Karena format berkas sebenarnya belum ditentukan (OQ-07),
konvensinya saya tetapkan di tingkat kontrak:

| Hal                 | Konvensi                                        | Contoh                    |
| ------------------- | ----------------------------------------------- | ------------------------- |
| Pemisah nilai jamak | `;` atau baris baru dalam satu sel              | `3/4; 1; 1 1/4`           |
| Rujukan fitting     | `SKU:jenis`                                     | `FIT-T:tee; FIT-E:elbow`  |
| Dokumen teknis      | `Judul\|URL\|halaman` — halaman opsional        | `Datasheet\|https://…\|7` |
| Gambar produk       | URL saja; urutan penulisan = urutan tampil      | `/img/a.png; /img/b.png`  |
| Alternatif          | adapter boleh mengirim daftar string apa adanya | `["3/4", "1"]`            |

`|` dipakai sebagai pemisah antar-bagian di dalam satu nilai karena ia tidak muncul di URL maupun di
judul dokumen, sementara `:` muncul di setiap `https://` dan `;` sudah dipakai memisahkan nilai.

Dua baris tengah ditambahkan di **P1-05c**, setelah Fase 2 menunjukkan akibat ketiadaannya: tanpa
dokumen yang bisa diimpor, jalur jawaban "Lihat dokumen teknis" ada tetapi tidak pernah dilewati data
nyata.

Baris terakhir yang membuat ini tidak mengikat: adapter ERP yang sudah punya daftar tidak perlu
merangkainya menjadi string lebih dulu, jadi konvensi pemisah hanya berlaku untuk sumber tabular.

**Bila Anda ingin pemisah lain** (`|` misalnya, kalau katalog Pralon memakai `;` di dalam nilai),
ini satu konstanta di `catalog-import.contract.ts`.

### OQ-40 — Bagaimana `apps/worker` memakai kode domain backend?

**Status:** open · _usulan default SUDAH DITERAPKAN (Fase 8/10)_ · **Blocks:** 1 (P1-06b), 10 (PDF), 11 (email), 12 (pasar)
`docs/ARCHITECTURE.md` §4 menempatkan konsumer RabbitMQ di `apps/worker`, dan §6 menempatkan modul
domain di `apps/api/src/modules/`. Keduanya benar sendiri-sendiri, tetapi **belum ada jalan dari yang
pertama ke yang kedua.** `apps/worker` hanya bergantung pada `pino` dan `@snouty/shared-types`;
`packages/` tidak memuat kode backend bersama; dan mengimpor satu app dari app lain tidak diatur §7.

Ini bukan masalah khusus katalog. Setiap konsumer di tabel `docs/INFRASTRUCTURE.md` §7 — PDF,
handoff, email, agregasi pasar — akan menabraknya.

Tiga kemungkinan, dengan konsekuensinya:

| Pilihan                                                                    | Konsekuensi                                                                                                           |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **A.** `apps/worker` bergantung pada `@snouty/api` sebagai paket workspace | Paling sedikit kode. Tetapi worker ikut memuat NestJS HTTP dan `apps/api` jadi punya dua pemakai yang berbeda bentuk. |
| **B.** Modul backend bersama dipindahkan ke `packages/`                    | Paling bersih dan paling sesuai §5. Tetapi mengubah struktur yang tertulis di §4, dan harus diulang per konteks.      |
| **C.** Worker memanggil API lewat HTTP internal                            | Tidak perlu berbagi kode, tetapi menambah lompatan jaringan di dalam satu monolith — persis yang §1 hindari.          |

**Usulan default: A sekarang, B ketika konsumer kedua muncul.** Alasannya bukan kemalasan: dengan
satu konsumer kita belum tahu batas mana yang benar untuk dipindahkan, dan memindahkan batas modul
itu murah (`docs/ARCHITECTURE.md` §1). Memecah paket sekarang berarti menebak batasnya dari satu
contoh. C ditolak karena alasan yang sudah tertulis di §1.

**Yang sudah dikerjakan tanpa menunggu jawaban:** seluruh inti P1-06 — use case idempoten, writer
MySQL, migration, dan tesnya — ada di `apps/api` dan **tidak menyebut RabbitMQ sama sekali**.
`CatalogIngestService.ingest()` menerima satu perintah, jadi apa pun jawabannya, konsumer nanti
hanya memanggil satu method. Yang tertunda murni transport-nya (P1-06b).

---

## B. Design conflicts carried from SPEC §33h

**Yang saya terapkan (mengikuti pola OQ-42/15/38 — usulan default dijalankan, bukan menunggu):**
paket `@snouty/jobs` memuat nama antrean, skema zod per payload, versi kontrak, dan kebijakan retry.
Keduanya mengimpornya; **`apps/worker` tidak pernah mengimpor `apps/api`**. Worker juga tidak memegang
kredensial database sama sekali — ia meminta HTML dari rute internal, mencetak, lalu melaporkan hasilnya
lewat `POST /internal/reports/:id/ready`. Payload hanya membawa id, sehingga data pribadi tidak pernah
berada di dalam antrean.

**Masih terbuka:** apakah pemilik setuju dengan arah ini, dan apakah token bertanda tangan berumur
pendek (docs/REPORT.md §5) menggantikan gerbang peran `admin` yang dipakai sementara untuk rute cetak.

### OQ-45 — Redaksi primer bahan pipa (jalur `PRODUCT_FAQ`) belum ditinjau tim teknis

**Status:** open · _non-blocking_ · **Fase:** 4 · diterapkan sementara sebagai default

"Apa bedanya PVC dan HDPE?" sebelumnya dijawab hanya dengan fakta katalog ("HDPE tidak ada di
katalog… Pipa PVC AW: Material uPVC…"), yang terbaca sebagai bukan jawaban. Jalur `PRODUCT_FAQ`
(docs/AI_BEHAVIOR.md) kini menjelaskannya. Percobaan pertama membiarkan model menjelaskan dari
ingatannya; qwen2.5:7b **menukar sifatnya** (PVC disebut lentur, HDPE kaku) dalam dua dari dua
jawaban. Itu persis "LLM bukan sumber kebenaran" — meski kualitatif.

**Default yang diterapkan (2026-10-06, direvisi hari yang sama):** pengetahuan teknik umum ditulis
di kode sebagai basis terstruktur (`context/application/pipe-knowledge.ts`): empat keluarga bahan
(PVC, HDPE, PPR, galvanis) masing-masing dengan **bentuk, sambungan, ketahanan, pemakaian lazim**,
plus tiga konsep (pipa tanam, bertekanan vs gravitasi, kaku vs lentur) — **tanpa angka, standar, atau
merek** (tes menjaganya). "Bedanya A dan B" dirakit kode sebagai perbandingan per dimensi, bukan dua
ikhtisar; jawabannya utuh tanpa katalog dan tanpa model. Katalog dan model keduanya opsional (OQ-46).

**Yang dibutuhkan dari pemilik / tim teknis Pralon:** tinjau redaksi basis pengetahuan (benar secara
teknik? ada keluarga yang perlu ditambah — PVC-O, PE-RT?), dan tetapkan apakah ia dianggap "konten
teknis" yang perlu provenance/penanggung jawab, atau cukup sebagai copy produk.

### OQ-47 — Irigasi: aturan teknik sizing belum ada; sementara ini jalur terpandu + handoff terstruktur

**Status:** open · _non-blocking_ · **Fase:** 4/6 · default diterapkan 2026-10-06 atas keputusan pemilik

Pemilik (2026-10-06): "untuk bikin irigasi sawah 1 hektar butuh produk apa aja?" — jawaban "di luar
cakupan" ditolak; "harusnya skemanya sama kek rumah". Yang bisa disamakan adalah **alurnya**
(kumpulkan kebutuhan → arahan → langkah berikutnya). Yang tidak bisa disamakan adalah **mesinnya**:
Engineering Engine menghitung dari unit fixture bangunan (kamar mandi, wastafel), bukan dari luas
lahan, debit, dan beda tinggi — dan aturan sizing irigasi belum pernah diberikan Pralon. Mengisi
celah itu dengan angka dari ingatan model melanggar "jangan mengarang nilai teknik".

**Diterapkan (pilihan pemilik):** jalur guna `irrigation` (`context/domain/irrigation.ts`): fakta
tersurat dibaca dari kalimat (luas ha, sumber, jenis, jarak, pompa), kartu klarifikasi khusus
irigasi (sumber air, luas, jenis irigasi, jarak, beda tinggi; maks 4, "Belum tahu" selalu ada),
arahan produk umum tanpa angka (jalur utama ditanam → HDPE; distribusi → PVC; pompa/katup
menentukan kelas), lalu saat lengkap → kartu handoff dengan data terbaca dan tombol kirim ke tim
teknis. Jawabannya disimpan di `RequirementState.useCase` — terpisah dari field bangunan, supaya
mesin teknik tidak pernah menghitung dari data yang bukan bangunan. Nol LLM di seluruh jalur.

**Revisi hari yang sama (pemilik: "AI-nya harusnya bisa ngitung juga"):** jalur ini kini
**bermuara di rekomendasi otomatis** seperti rumah, dengan cara yang sama seperti aturan bangunan
dibangun: Kelompok E di `packages/engineering` (ENG-101 debit rencana per metode, ENG-102 diameter
dari debit pada kecepatan rencana, ENG-103 kebutuhan tekanan/pompa, ENG-104 bahan per segmen,
ENG-105 panjang & BOM estimasi), semuanya `REQUIRES_DOMAIN_VALIDATION` → setiap keluaran `ASSUMED`,
rujukan rumus tertulis di tiap aturan, kartu asumsi menyebutkannya sebagai asumsi pertama. Nilai
dari rentang pilihan (titik tengah) dan "Belum tahu" dicatat sebagai asumsi per field.

**Yang dibutuhkan dari tim teknis Pralon:** validasi lima aturan itu (debit satuan per metode,
kecepatan rencana, aturan pompa/kelas, ambang HDPE, tata letak BOM) — alur validasinya sama dengan
aturan bangunan (`docs/ENGINEERING_RULES.md` §5) — plus keluarga produk Pralon untuk irigasi (OQ-07)
dan desain skema irigasi (tab Skema untuk solusi irigasi sengaja kosong).

### OQ-48 — Cara membedakan fitting dari pipa di master data produk

**Status:** open, default diterapkan · **Blocks:** impor katalog Pralon (OQ-07)
**Pertanyaan:** Apakah fitting Pralon punya `family` sendiri ("FITTING PVC") atau hidup di keluarga
pipanya ("PVC AW") dan dibedakan lewat `category`?
**Temuan (2026-10-06):** matcher mencari `family = 'FITTING PVC'`, katalog contoh menaruh fitting di
`family = 'PVC AW'` + `category = 'FITTING · SNI'` — peran fitting tidak pernah terisi.
**Default yang diterapkan (direvisi 2026-10-06 malam, setelah export ERP dibaca):** data asli
menaruh fitting di keluarga sendiri — `FITTING PVC` / `FITTING HDPE` / `FITTING FRP`. Matcher v2
(`fittingRequirement()`) mencari keluarga fitting Pralon dulu (pemetaan 3 baris: PVC AW/D/C/VP/VU →
FITTING PVC; HDPE/MDPE → FITTING HDPE), lalu fallback keluarga pipa + kategori "FITTING" untuk
katalog yang tidak memisahkannya (katalog contoh). Fitting diterima penuh hanya bila
`pressure_class` VERIFIED sama dengan kelas pipa; kelas `UNAVAILABLE` (seluruh seri "W", keputusan
pemilik: **tidak ditebak AW**) menjadi `SIZE_NEEDS_VALIDATION`; kelas VERIFIED berbeda (D untuk AW)
ditolak. Masih menunggu Pralon: arti token "W" dan fitting tanpa token (`docs/MATCHER_V2_PROPOSAL.md` §5).
**Ditutup 2026-10-14 (keputusan pemilik, P21-10):** PROD/STD-04 Rev. 11 (data internal pabrik) menunjukkan
pipa PRALON AW, D, dan C berukuran nominal sama ber-OD sama; fitting sambungan lem dibuat per ukuran nominal,
jadi fitting berkelas kosong (Ts, W, DV) di ukuran yang pipa kelasnya dibuat dinyatakan cocok
(`pralonPipeMadeIn`). Fitting berkelas VERIFIED lain (D untuk jalur AW) tetap ditolak. Arti token "W"
tidak lagi menghalangi.
**Pembaruan 2026-10-14 (review putaran 4, 5c):** export ERP mengosongkan kelas untuk SELURUH fitting
seri Ts (294), W (574), dan DV/Dv (255); `compatible_skus` kosong untuk semua produk. Pemilik akan
mengirim data produk Pralon sebagai sumber pemetaan seri → kelas. Sampai itu masuk, fitting ini tetap
`SIZE_NEEDS_VALIDATION` (catatan di tab Produk), tanpa label di BOQ.

### OQ-55 — SKU katalog adalah ID ekspor ERP, bukan kode produk pelanggan

**Status:** open, needs owner input · **Blocks:** tampilan SKU di kartu produk
**Pertanyaan:** Kolom `sku` impor `erp-2026-10-06` berisi ID eksternal Odoo
(`__export__.product_product_10197`, `product.0_S_01_011_016004_00`) — pemilik melihatnya di kartu
produk (2026-10-07) sebagai teks yang tidak berarti. Apakah ERP punya kode produk resmi
(`default_code`/kode internal Pralon) yang bisa diekspor sebagai `sku`?
**Default yang diterapkan:** web menyembunyikan SKU yang berpola ID ekspor (`isCustomerSku`);
nama produk tetap tampil. Begitu kolom kode resmi tersedia, impor ulang katalog dan SKU tampil lagi
tanpa perubahan kode.

### OQ-54 — Data profil perusahaan resmi untuk pengetahuan perusahaan

**Status:** open, needs owner input · **Blocks:** kelengkapan jawaban `COMPANY_QUESTION`
**Pertanyaan:** Pemilik (2026-10-07) meminta SNOUTY menjawab "Pralon itu apa?", "company profile
PT Pralon", "lengkap dong" dengan profil perusahaan yang utuh. Repositori ini tidak memuat satu pun
dokumen profil perusahaan, dan situs `pralon.co.id` menolak akses otomatis (403), jadi tidak ada
sumber yang bisa diverifikasi untuk sejarah, fokus bisnis, pabrik, sertifikasi, mutu, pasar,
distribusi, visi, misi, keberlanjutan, afiliasi, dan kontak.
**Status 2026-10-07 (sebagian terjawab):** pemilik memberi "Snouty Product Knowledge Master — uPVC
PRALON" v1.0 (`data/company/Snouty_Product_Knowledge_Master.md`, disusun bersama HRGA dari deck
product knowledge & BIMTEK). Dari sana diisi: ikhtisar, portofolio/fokus bisnis, sektor pemakaian,
proses produksi, mutu, sertifikasi (daftar nama, tanpa nomor), tonggak sejarah (tanpa klaim
"pelopor/pertama" yang dokumen itu tandai perlu validasi korporat), kontak kantor pusat & email, situs
`www.pralon.com`. Pengetahuan pipa ikut bertambah: uPVC, istilah dimensi, kelas AW/D/C/JIS/SNI/PIPPO,
sambungan lem & rubber ring, jenis fitting, penyimpanan, perawatan & gangguan, proses, uji mutu,
penimbunan, uji tekanan lapangan — semuanya kualitatif; angka yang dokumen tandai "perlu validasi"
(tekanan kerja per kelas, tebal dinding, waktu kering lem, kedalaman galian) **tidak** dibawa.
**Masih terbuka:** visi, misi, distribusi, keberlanjutan, afiliasi; Certificate Register (nomor &
masa berlaku); profil korporat resmi untuk tahun/urutan tonggak; Product Specification resmi
(tekanan kerja, dimensi) supaya angka boleh ditampilkan.

### OQ-79 — Model dan kunci untuk jawaban pengetahuan pipa umum (P30-01, 2026-10-26)

**Status:** open · **Blocks:** P30-01 menyala di produksi
**Konteks:** pemilik memilih (2026-10-26) menutup pertanyaan pengetahuan di luar 52 topik dengan
model yang memang mampu, dipagari kode, dan membolehkan angka umum asalkan standarnya disebut dan
dinyatakan bukan angka Pralon. Jalurnya sudah ada beserta pagarnya; yang belum ada adalah modelnya.
`.env.production` di server memuat `OPENROUTER_API_KEY=ollama` — placeholder untuk Ollama lokal,
bukan kunci penyedia berkredit — dan model lokalnya `qwen3.5:9b` di CPU. OQ-45 mencatat apa yang
terjadi bila pengetahuan diambil dari model kecil: qwen2.5:7b menukar sifat PVC dan HDPE dua dari
dua kali.
**Yang dibutuhkan dari pemilik:** (1) kunci penyedia berkredit (`KNOWLEDGE_API_KEY` +
`KNOWLEDGE_BASE_URL`) dan (2) model yang dipakai (`LLM_MODEL_KNOWLEDGE`). Hanya jalur pengetahuan
yang memakainya; pemahaman, ekstraksi, dan embedding tetap lokal dan gratis.
**Default selama belum diisi:** jalurnya **mati** — pertanyaan tak tercakup dijawab seperti sebelum
P30-01 (tawaran tim teknis). Tidak ada jawaban pengetahuan dari model lokal: lebih baik mengakui
batas daripada menjawab dengan model yang pernah membalik sifat bahan.
**Yang tetap terbuka walau kuncinya terisi:** pengetahuan umum ini **tidak divalidasi tim teknis
Pralon** (sama seperti OQ-45 untuk redaksi primer bahan). Pagarnya menjaga agar ia tidak pernah
menjadi klaim tentang Pralon, tetapi kalimat teknik umumnya tetap tanggung jawab yang belum
berpemilik. Usul default: tinjau 25 jawaban pertama yang keluar dari jalur ini, lalu naikkan yang
benar menjadi fakta bersumber di `data/knowledge/pipe-facts.json` — dengan begitu jawaban yang
sudah ditinjau pindah ke jalur yang tidak memerlukan model sama sekali.

### OQ-78 — Jam kerja dan hari libur untuk janji "1×24 jam kerja" (P29-01, 2026-10-23)

**Status:** open, berjalan dengan default · **Blocks:** tidak ada
**Konteks:** antrean teknis kini menandai kasus yang melewati janji "1×24 jam kerja" yang dibuat
produk kepada pengguna. Untuk menandainya, sistem harus tahu kapan jam itu berjalan.
**Default yang berjalan sekarang:** jam berjalan sepanjang hari Senin–Jumat dan berhenti penuh di
Sabtu–Minggu; batas harinya WIB (+07:00, tetap — Indonesia tidak punya daylight saving); hari libur
nasional **tidak** ikut, karena sistem tidak punya kalendernya dan menebak tanggalnya lebih buruk
daripada mengakui batasnya.
**Yang perlu diputuskan pemilik:** (1) apakah jamnya dibatasi jam kerja kantor (mis. 08.00–17.00)
alih-alih sepanjang hari kerja — ini memperpanjang tenggat kasus yang masuk malam hari; (2) apakah
kalender libur nasional perlu dimuat, dan dari mana sumbernya; (3) apakah Sabtu dihitung setengah
hari di pabrik. Sampai dijawab, penandaan "terlambat" sedikit lebih galak daripada seharusnya —
arah galat yang benar untuk janji kepada pelanggan.

### OQ-77 — Wilayah dari IP: tingkat, siapa yang melihat, dan kota dari izin browser (P26-07, 2026-10-21)

**Status:** diputuskan pemilik (2026-10-21, AskUserQuestion): ketiga default diterima — provinsi dari IP, wilayah hanya di agregat pasar (tidak per orang untuk sales), kota dari izin browser belum perlu. · **Blocks:** tidak ada
**Konteks:** pemilik memilih "IP → kota, ditambah izin browser" (OQ-76). Saat dibangun, tiga hal tidak
tertutup keputusan itu.
**Default sementara:** (1) **provinsi, bukan kota** — DB-IP Lite di Indonesia sering memberi kota
penyedia internet atau kecamatan ("Cicurug"), terlalu sempit untuk ambang k-anonimitas dan terlalu yakin
untuk akurasinya; (2) wilayah **hanya di agregat pasar**, tidak tampil per orang di papan prospek atau
dashboard sales — janji onboarding "data wilayah dipakai untuk analisis kebutuhan pasar" belum mencakup
sales; (3) **kota dari izin browser belum dipakai** — koordinat → kota butuh basis data geografis
tersendiri (mis. GeoNames, CC BY 4.0), izin lokasi tetap dicatat sebagai persetujuan saja.
**Yang perlu diputuskan pemilik:** apakah wilayah per orang boleh tampil untuk sales (perlu teks
persetujuan baru), dan apakah kota dari browser (GeoNames) ditambahkan.

### OQ-76 — Prospek 5A dan penugasan sales (P26-01, 2026-10-21)

**Status:** diputuskan pemilik (2026-10-21, AskUserQuestion): papan prospek hanya untuk pengguna
terdaftar (tamu hanya di agregat anonim); lokasi dari IP → kota ditambah izin browser; papan dipakai sales +
admin, kontak lewat jalur handoff; admin menugaskan prospek ke sales, dan sales menerima ringkasan percakapan.
Konsep: `docs/PROSPECT_5A.md` · **Blocks:** tidak ada
**Diputuskan 2026-10-21 (AskUserQuestion, semua usulan default diterima):** (1) dasar kontak sales — default: opt-in "boleh dihubungi tim
Pralon" saat daftar, dan selalu boleh bila pengguna menekan "minta dihubungi"; (2) bobot prioritas §3 —
default angka di dokumen, dikalibrasi dari status menang/kalah; (3) peran `sales` baru yang hanya melihat
prospek miliknya — default ya; (4) sumber geo-IP — default basis data offline berlisensi gratis (DB-IP Lite,
CC BY 4.0, atribusi di halaman privasi).

### OQ-75 — Study case rumah dihitung dulu dengan anggapan; tekanan kerja per kelas (P25-08, 2026-10-20)

**Status:** diputuskan pemilik (2026-10-20, AskUserQuestion). (1) "Hitung dulu + asumsi": rumah tinggal yang jumlah
lantainya disebut langsung dihitung; kamar mandi yang belum disebut dianggap 1 per lantai
(`HOUSE_BATHROOMS_PER_FLOOR_1`, ENG-014, ASSUMED), sumber air toren atap, air bersih — anggapannya tertulis di
jawaban dan ditanyakan di kartu supaya bisa diubah; tanpa jumlah lantai tetap ditanya dulu (SC-03, SC-04). (2) Tekanan
kerja per kelas PVC **tetap ke tim teknis**: angka Master (AW 10 bar, D 5 bar, SNI S-x) tidak ditampilkan sampai
Product Specification resmi tersedia — PROD-STD-004 Rev.11 hanya memuat tebal dinding dan berat · **Blocks:** tidak ada
**Masih terbuka:** spesifikasi resmi tekanan kerja per kelas, umur pakai HDPE, dan batas suhu operasi dari Pralon;
validasi tim teknis untuk anggapan 1 kamar mandi per lantai.

### OQ-74 — Kasus teknis dengan angka kritis "Belum tahu" dan perluasan rumah (P25-05, 2026-10-19)

**Status:** sebagian diputuskan pemilik (2026-10-19, AskUserQuestion): intensitas hujan "Belum tahu" → 150 mm/jam
(asumsi registry `RAINFALL_INTENSITY_150MMH`, perlu validasi); "rumah … mau tambah N titik air" → rumah yang disebut
= beban lama, N = beban baru (P25-06). Tinggi toren atap untuk sumur diturunkan dari jumlah lantai (3,5 m per
lantai + dudukan 1 m). Masih terbuka: nilai intensitas rencana resmi per daerah dari tim teknis · **Blocks:** tidak ada
**Konteks:** simulasi perhitungan: setiap pertanyaan dijawab "Belum tahu" dulu berakhir "Datanya sudah cukup"
lalu analisis gagal "layanan tidak tersedia".
**Default sementara:** parameter kritis yang punya asumsi registry di profil kasus (`unknownDefaults`) memakai
asumsi itu dan ditandai di hasil — saat ini hanya debit pompa yang mengisi tandon (sumur, transfer:
`TANK_FILL_FLOW_0_25LS`, 0,25 l/s). Parameter kritis lain tanpa nilai bersumber (intensitas hujan, tinggi tandon,
beda tinggi jaringan, penghuni/luas gedung) tetap ditanya; chat menyebut angkanya masih dibutuhkan dan
analisis menjawab VALIDATION_FAILED ("Hitungannya butuh beberapa angka lagi"), bukan angka karangan.
Perluasan rumah ("rumah 3 kamar mandi … mau tambah 2 titik air"): fixture yang disebut dihitung sebagai
bagian baru, dan beban lama ditanya lewat kartu.
**Yang perlu diputuskan pemilik/tim teknis:** nilai acuan bersumber untuk intensitas hujan rencana (mis. dari
SNI/BMKG per daerah) dan tinggi tandon atas yang lazim, supaya keduanya bisa menjadi asumsi; dan apakah
"tambah N titik air" pada rumah yang disebut lengkap harus dibaca sebagai beban lama = rumah itu, beban baru = N.

### OQ-73 — Bahasa balasan dari kalimat pengguna, bukan tombol bahasa (P25-01, 2026-10-19)

**Status:** diputuskan pemilik (2026-10-19): "jawaban bhs ing itu berdasarkan prompt user, bukan berdasarkan
bilingual button". Teks antarmuka juga ikut bahasa pengguna (pemilik 2026-10-20, AskUserQuestion; P25-07) ·
**Blocks:** tidak ada
**Konteks:** sejak Fase 15 bahasa adalah atribut percakapan yang ditetapkan dari tombol bahasa saat dibuat.
**Default sementara:** bahasa dikenali per pesan; pesan yang bahasanya jelas memindahkan bahasa percakapan,
pesan pendek atau netral ("ok", "pralon jis vs sni") tidak. Tombol bahasa tetap mengatur teks antarmuka dan
menjadi bahasa awal sebelum pengguna menulis. Hanya Indonesia dan Inggris; bahasa lain dibaca sebagai yang
paling dekat dari keduanya atau tidak diputuskan.
**Yang perlu diputuskan pemilik:** apakah teks antarmuka (tombol, label panel) juga ikut berpindah mengikuti
bahasa pengguna, atau tetap mengikuti tombol.

### OQ-72 — Fitur akun ala Claude: proyek, sematan, tautan bagikan (Fase 24, 2026-10-19)

**Status:** lingkup diputuskan pemilik (2026-10-19, AskUserQuestion): Proyek dengan catatan konteks, Pin,
dan Bagikan tautan baca-saja; Duplikat konsultasi tidak dipilih; proyek tampil sebagai bagian PROYEK di
sidebar dengan halamannya sendiri · **Blocks:** tidak ada — tampilan bisa diganti saat desainnya datang
**Konteks:** pemilik: "tambahin bbrp fitur dong untuk akun yang terdaftar yg dmn itu kaya claude: itu ada
project, pin, dll". Tidak ada keluaran Claude Design untuk layar ini.
**Default sementara:** tanpa desain, dibangun hanya dari token dan pola yang sudah ada — baris riwayat dan
label mono sidebar, kartu dan isian pop-up akun, tombol aksi tab solusi. Sidebar akun: Konsultasi Baru →
PROYEK (+) → DISEMATKAN → RIWAYAT; menu ⋯ per baris (Sematkan, Pindahkan ke proyek, Hapus). Catatan proyek
dibaca SNOUTY sebagai bagian cerita pada giliran pertama konsultasi baru di proyek itu (grounding tetap
berlaku). Tautan bagikan: token 256-bit sekali tampil, disimpan hash SHA-256; satu tautan aktif per
solusi; memuat ringkasan, produk, denah, material — tanpa percakapan dan data akun; percakapan dihapus →
tautan mati; halaman /shared tidak diindeks.
**Yang perlu diputuskan pemilik/desain:** tata letak final sidebar dan halaman proyek, apakah tautan perlu
masa berlaku, apakah halaman tautan menampilkan merek toko/distributor.

### OQ-71 — Renovasi untuk semua kasus: cara sambung, sok, beban titik air lama (Fase 23, 2026-10-19)

**Status:** default diterima pemilik (2026-10-19, tiga pilihan AskUserQuestion): tiga mode (ganti semua, ganti
sebagian, perluasan); perluasan menanyakan ukuran pipa lama lalu menghitung beban total — tanpa ukuran, seluruh
sistem diukur seperti baru dan hasilnya menyebut jalur lama harus dicek; sambungan ke pipa galvanis/besi memakai
sok drat dari katalog · **Blocks:** pengesahan ENG-901…904 dan asumsi RENOV_* oleh ahli Pralon (OQ-06)
**Konteks:** pemilik: "snouty bisa mencakup itung-itungan yang sifatnya renov belum? kalo belum segera lakukan
development. inget dari semua case yah". Sebelumnya hanya rumah dengan mode "ganti semua" (kata-kata saja).
**Default sementara:** pipa lama cukup bila diameter luarnya ≥ ukuran yang dihitung untuk beban total (ENG-901,
dibandingkan lewat OD: PROD/STD-04 untuk inci, ISO 4427 untuk mm); sambungan ke pipa lama: PVC → tee lem,
galvanis/besi → 2 sok drat + tee, HDPE → tee HDPE, PPR → fitting fusi bukan lini Pralon → tim teknis (ENG-902);
penggantian sebagian: pipa sepanjang segmen + RENOV_COUPLINGS_PER_SEGMENT_2 sok, tanpa panjang → seluruh jalur
(RENOV_REPLACE_WHOLE_ROUTE) (ENG-903); beban total = lama + baru (ENG-904), titik air lama rumah dihitung
1 WSFU/titik (RENOV_EXISTING_OUTLET_1_WSFU) karena jenisnya tidak ditanya. Pipa utama lama yang kurang disebut harus
diganti, tetapi panjangnya tidak diketahui sehingga tidak masuk daftar material. Kapasitas pipa lama hanya dicek pada
kasus berbeban hitungan (rumah, gedung — belum, cluster, SPAM, air limbah); kasus lain menyebut bahwa pipa lama belum
dicek.
**Yang perlu diputuskan ahli Pralon:** apakah perbandingan OD cukup (vs kehilangan tekanan jalur lama yang
panjangnya tidak diketahui), jumlah sok per segmen, cara sambung yang direkomendasikan Pralon untuk pipa besi
(sok drat vs flens), dan beban rata-rata titik air lama.

### OQ-70 — Kriteria perencanaan jaringan air minum (SPAM) dan air limbah (P22-05, 2026-10-16)

**Status:** default diterima pemilik (2026-10-16): kriteria umum dipakai, divalidasi bersama aturan lain (OQ-06); tidak ada ambang handoff proyek besar · **Blocks:** pengesahan ENG-406/407/408 dan asumsi SPAM dan SEWER
**Konteks:** pemilik minta use case proyek SPAM dan sewerage disiapkan. Dua kasus teknis baru dihitung
dengan kriteria perencanaan umum, semuanya `REQUIRES_DOMAIN_VALIDATION`.
**Default sementara:** SPAM — 100 l/jiwa/hari (Permen PUPR 27/2016: 60–150 menurut kategori kota),
5 jiwa/SR, faktor jam puncak 1,75, sisa tekanan di sambungan RESIDUAL_PRESSURE_FIXTURE, HDPE bila jalur
≥ HDPE_MAIN_FROM_200M; air limbah — 80 % pemakaian air kembali sebagai limbah, faktor puncak 2,5, Manning
n plastik, terisi ≤ 80 %, kecepatan penuh ≥ 0,6 m/s, kemiringan 0,5 % bila tidak disebut, ukuran minimum
6" (150 mm), keluarga PVC D. Jaringan besar (ribuan SR), zona tekanan, dan reservoir tidak dihitung.
**Dilengkapi P22-08:** non-domestik 15 %, NRW 20 %, faktor hari maksimum 1,15, reservoir 20 % hari maksimum,
margin kelas tekanan 10 % (PN ↔ SDR PE100), infiltrasi air limbah 10 %, kecepatan maks 3 m/s, manhole tiap 50 m,
kedalaman awal 1 m, galian maks 4 m — semuanya asumsi registry yang bisa diganti.
**Yang perlu diputuskan ahli Pralon:** angka per kategori kota, faktor puncak per ukuran jaringan, ukuran
minimum dan keluarga pipa air limbah Pralon (apakah PVC D atau produk sewer lain), kelas kekakuan (SN) pipa
tanam, dan batas kapan proyek diteruskan ke tim teknis.

### OQ-69 — Estimasi biaya penggantian pipa ke Pralon (P22-03, masukan pengguna 2026-10-16)

**Status:** diputuskan pemilik (2026-10-16): tetap tanpa harga; pertanyaan harga ke tim Pralon · **Blocks:** —
**Konteks:** pengguna rumah subsidi ingin tahu "kalau pipa murahnya diganti Pralon, estimasinya berapa".
SNOUTY kini menghitung daftar material penggantian (sama dengan instalasi baru di jalur yang sama) dan
menyebutnya sebagai penggantian, tetapi tidak bisa memberi rupiah: ekspor katalog ERP tidak memuat kolom harga,
`PRICING_ENABLED` baku `false`, dan DD-01 #8 menetapkan BOQ tanpa harga.
**Default sementara:** estimasi = volume material (batang, pcs) tanpa harga; pertanyaan harga tetap dijawab
"tanyakan ke tim Pralon" (CTA tim teknis).
**Yang perlu diputuskan pemilik:** (1) apakah Pralon mau memberi daftar harga (kolom `price` di impor katalog)
supaya BOQ penggantian bisa membawa subtotal; (2) bila ya, apakah harganya tampil untuk tamu atau hanya pengguna
terdaftar (OQ-14).

### OQ-68 — Gaya gambar sistem pipa "lebih nyata" (P22-02, masukan pengguna 2026-10-16)

**Status:** diputuskan pemilik (2026-10-16): tetap skematik, angka dari engine; tidak ada desain isometrik atau foto · **Blocks:** —
**Konteks:** pengguna meminta "contoh gambar yang lebih real untuk sistem pipa (arah, jumlah pipa, jumlah
aksesoris)". Yang ada: potongan instalasi dan denah jalur per lantai (DD-01 #7) — skematik, SVG token SNOUTY —
kini juga tampil di chat saat bentuk sistemnya ditanya, dengan jumlah pipa dan fitting dari BOQ di jawabannya.
**Default sementara:** gambar skematik yang ada dipakai; angka (ukuran, jumlah, fitting) selalu dari engine.
Tidak ada foto atau gambar isometrik yang dibuat sendiri: DD-01 menetapkan ilustrasi digambar khusus lewat
Claude Design, dan gambar yang "nyata" tanpa denah rumah berarti letak ruang yang dikarang (DD-01 #7 melarang).
**Yang perlu diputuskan pemilik:** apakah perlu gaya isometrik/3D untuk potongan instalasi (desain baru di
Claude Design), dan apakah foto contoh instalasi nyata (milik Pralon) boleh dipakai sebagai acuan di samping
skema.

### OQ-67 — Tinggi tiang toren dan ambang "deras di shower" (P22-04, masukan pengguna rumah subsidi 2026-10-16)

**Status:** default diterima pemilik (2026-10-16): ambang deras tetap 0,7 bar dan dikatakan apa adanya; tinggi tiang dan muka air menunggu ahli Pralon · **Blocks:** pengesahan ENG-711
**Konteks:** pertanyaan paling sering dari pengguna awam: "toren harus di ketinggian berapa supaya aliran
kencang ke tiap titik tanpa pompa pendorong — di dak atau pakai tiang toren, pipa dari toren berapa inci, di
dalam rumah berapa". ENG-711 menghitung tekanan di titik air tertinggi untuk tiap dudukan yang mungkin.
**Default sementara:** (1) tinggi tiang toren yang ditawarkan `TANK_TOWER_HEIGHTS_M` = 3, 4, 5, 6, 8 m dari
tanah ke dudukan — daftar ukuran pasar, bukan standar; (2) muka air = dudukan + `TANK_STAND_1M` (1 m) untuk dak
maupun tiang; (3) ambang minimum tetap `RESIDUAL_GRAVITY_0_3BAR`, ambang "deras di shower"
`RESIDUAL_GRAVITY_COMFORT_0_7BAR` = 0,7 bar (Noerbambang & Morimura: tekanan minimum shower 0,7 kg/cm²);
(4) kehilangan di pipa tegak tambahan diabaikan, seperti ENG-703. Pilihan tampil di kartu "Tinggi toren" layar
Ringkasan dan laporan PDF, dan menjadi fakta jawaban chat.
**Yang perlu diputuskan ahli Pralon:** daftar tinggi tiang yang lazim dipasang, tinggi muka air di atas
dudukan untuk toren yang biasa dipakai, dan ambang tekanan yang Pralon anggap "deras".

### OQ-66 — Kedalaman sumur dari pilihan rentang (review putaran 3, P20-01)

**Status:** terbuka · **Blocks:** pengesahan ENG-702 v3 / ENG-709
**Konteks:** pemilik memilih pertanyaan rentang (< 5 / 5–9 / > 9 m / belum tahu). Engine butuh satu angka.
**Default sementara:** rentang dihitung dengan batas atasnya supaya tinggi angkat pompa tidak kurang
(< 5 → 5 m, 5–9 → 9 m), "> 9 m" dihitung 10 m; angka pasti boleh diketik; belum tahu → `WELL_WATER_DEPTH_6M`.
Batas sedot pompa permukaan `SURFACE_PUMP_SUCTION_7M`. Akibatnya pilihan "5–9 m" selalu memberi saran pompa
jet / submersible.
**Yang perlu diputuskan ahli Pralon:** nilai wakil tiap rentang dan batas sedot yang dipakai.

### OQ-65 — Kurva debit puncak (Hunter) yang dipakai Pralon (review laporan 0015, P19-03)

**Status:** terbuka — engine tetap memakai IPC 2021 Tabel E103.3(3) · **Blocks:** pengesahan ENG-701/ENG-102
**Temuan review:** 7,9 WSFU → 0,8 l/s dianggap terlalu tinggi ("tabel flush tank ±6,5 gpm ≈ 0,41 l/s").
**Hasil pemeriksaan (2026-10-13):** kurva di `HUNTER_FLUSH_TANK` sama dengan IPC 2021 Tabel E103.3(3)
kolom sistem kloset tangki (1 → 3,0; 3 → 6,5; 8 → 12,8; 10 → 14,6 gpm), interpolasi linear; 7,9 WSFU →
12,7 gpm = 0,80 l/s sesuai tabel itu. Angka 6,5 gpm adalah nilai untuk 3 WSFU. Cabang memakai fungsi
yang sama (4,7 WSFU → 9,0 gpm = 0,57 l/s), jadi total dan cabang konsisten.
**Yang perlu diputuskan ahli Pralon:** apakah tetap IPC E103.3(3), atau kurva lain (padanan SNI 8153 /
kurva Hunter termodifikasi untuk rumah tinggal) yang memberi debit lebih kecil.
**Default sementara:** IPC E103.3(3), tidak diubah tanpa sumber.

### OQ-64 — Tebal dinding resmi Pralon per kelas dan ukuran (review laporan 0015, P19-03)

**Status:** **ditutup 2026-10-14** — PROD/STD-04 Rev. 11 diterima dari pemilik dan dipakai (P21-09,
`data/standards/2026-10-14-prod-std-004/`). Riwayat: menunggu tabel dari tim Pralon (keputusan pemilik
2026-10-13: tunggu tabel, jangan pakai angka SNI sebagai pengganti) · **Blocks:** diameter dalam per kelas (AW, D), seleksi ukuran cabang
**Temuan review:** diameter dalam dihitung dengan SDR 26,5 untuk semua kelas
(`PVC_AW_WALL_SDR`). Dengan tebal dinding AW sebenarnya, ID ½" bisa ±19 mm (di bawah syarat 20,1 mm)
sehingga cabang tertentu bisa naik ke ¾".
**Default sementara:** tetap SDR 26,5 sebagai ASUMSI yang tercatat; seleksi diulang begitu tabel resmi
masuk, dan perubahan ukuran dicatat per kasus.
**Pembaruan 2026-10-14 (review putaran 4, poin 4):** pemilik akan mengirim tabel resmi. Handbook Pralon
yang diterima hari ini (`data/standards/2026-10-14-pralon-handbook/`: PROD/STD-001, 002, 003, 014)
memuat SNI kelas S, SNI Kelas A/B, JIS VP/VU, dan PE100 — **tidak memuat AW dan D**. VP tidak dipakai
sebagai pengganti (½" VP 2,7 mm vs ½" AW ±1,5 mm). Seleksi ukuran belum diubah.

### OQ-63 — Jumlah fitting rumah per jalur (P18-01)

**Status:** dipakai sebagai asumsi (keputusan pemilik 2026-10-13), menunggu pengesahan ahli Pralon ·
**Blocks:** status TERVERIFIKASI untuk baris fitting BOQ
**Keputusan pemilik:** fitting dihitung otomatis dari jumlah jalur dan titik, tanpa cadangan:
air bersih — 2 elbow pipa utama, 2 elbow pengisi toren, 1 elbow per cabang, 1 elbow + 1 faucet
elbow per titik air; pembuangan — 1 Y-branch per alat, 1 Y per lantai di atas lantai dasar di pipa
tegak, 2 elbow 45° di kaki tiap pipa tegak, 1 clean out per jalur. Semua di registry asumsi
(`FITTING_*`, bisa diganti per kasus), aturan ENG-708 dan ENG-605 `REQUIRES_DOMAIN_VALIDATION`.
**Yang perlu disahkan:** angka per jalur di atas; apakah sok/dop perlu dihitung untuk pipa TS End;
fitting reduksi di cabang buang (wastafel 1¼" ke jalur 2½"); cadangan untuk proyek.

### OQ-62 — Foto produk per jenis untuk kartu produk (DD-01 #3, P17-06)

**Status:** terbuka — menunggu foto dari tim Pralon (keputusan pemilik 2026-10-13) · **Blocks:** foto asli
di kartu PVC D, PVC VU, PVC C, dan seluruh fitting
**Temuan:** pralon.com punya 13 lini produk dengan satu foto utama per lini (diambil 2026-10-13 ke
`data/catalog/images-pralon-com/`, lihat `SOURCE.md` dan `mapping.csv`). Foto yang benar-benar khusus
untuk lininya hanya ada untuk PVC AW, PVC VP, dan Pipa Jacking (365 produk). PVC D dan VU hanya muncul
di halaman AW dan VP, sedangkan fitting hanya punya satu foto kumpulan untuk 1.920 baris. FITTING FRP dan FITTING HDPE tidak
punya foto sama sekali.
**Keputusan pemilik:** foto PVC D/VU dan foto per jenis fitting (tee, elbow, sok, Y, reducer, clean
out, …) **diminta ke tim Pralon**, tidak memakai foto lini lain.
**Default sementara:** kartu produk tanpa foto asli memakai gambar produk SNOUTY per jenis (pipa
putih/abu, tee, elbow, sok, dop, Y, clean out). Foto lapangan (detail) tidak dipakai di kartu.

### OQ-61 — Kelompok hitung bangunan ibadah / umum (temuan laporan 0009, poin F)

**Status:** sebagian diputuskan pemilik (2026-10-12, P16-76): tempat ibadah punya kelompok hitung sendiri
(Kelompok L). Masih terbuka: pengesahan nilai oleh ahli Pralon, volume toren masjid · **Blocks:** —
**Keputusan 2026-10-12:** keran wudhu 0,1 l/s per keran, semua serentak; kamar mandi masjid = kloset + keran;
satu talang per tempat wudhu, aliran kontinu (2 DFU/gpm, IPC 709.3); urinoir sebagai pilihan (WSFU public 3, DFU 4);
sumber air mengikuti percakapan (toren/PDAM/pompa) seperti rumah. Jarak antar keran 0,8 m adalah perkiraan awal
(WUDHU_TAP_SPACING_0_8M), bisa diubah pengguna setelah hitungan selesai (P16-77). Volume toren masjid: pemilik
memutuskan belum dihitung; toren mengikuti jawaban sumber air di percakapan. Sekolah dan klinik: hitungan toilet umum
yang sama, tanpa wudhu (P16-78).
**Temuan:** `building.type = light_commercial` (masjid, musala, gereja, sekolah, klinik, ruko, kantor
— dikenali lewat daftar kata di `extraction-to-updates.ts`, utang teknis menurut aturan "pertanyaan
tidak di-hardcode") **tidak mengubah hitungan apa pun**: `computeSolution` menerima `buildingType`
tetapi memakai jalur rumah yang sama — WSFU pemakaian pribadi (IPC E103.3(2) private), kurva Hunter
(pemakaian acak), kamar mandi = kloset + shower (ENG-012), ENG-707 untuk cabang. Kelompok I
(`multistorey_building_water`) hanya terjangkau lewat kasus teknis, bukan lewat tipe bangunan.
**Titik sambung paling bersih (usulan):** cabang baru di `AnalysisService.run` sebelum
`computeSolution` — `publicAssemblyInputFrom(state)` seperti `buildingWaterInputFrom` — ke
orkestrator engine baru `computePublicAssembly` (Kelompok L) yang memakai ulang ENG-102/201–206
(sizing bertekanan), ENG-702/705 (jalur), ENG-707 (isi cabang, dengan bobot public), ENG-601–604
(pembuangan, DFU public), dan ENG-506 (siklus pompa/toren dari Kelompok I). Isinya: (1) WSFU public
(IPC E103.3(2) kolom public: kloset tangki 5, lavatory 2, dst.); (2) keran wudhu sebagai beban
**serentak** (n keran × debit per keran, bukan Hunter) dijumlah dengan beban Hunter sisanya;
(3) kamar mandi tanpa shower sebagai pilihan; (4) toren + pompa dari kebutuhan puncak menjelang salat.
**Nilai yang perlu disahkan ahli Pralon sebelum dipakai:** WSFU public per alat; DFU public; debit
per keran wudhu (±0,1 l/s?) dan jumlah keran yang dipakai serentak (semua? faktor serentak?); lama
puncak wudhu (menit) untuk volume toren; isi kamar mandi masjid (kloset saja / + shower); tekanan
sisa minimum di keran wudhu; apakah toilet umum memakai flush valve (beban jauh lebih besar).
**Default sementara:** tetap jalur rumah, dengan catatan ini; tidak ada nilai baru yang dipakai.

### OQ-60 — Rumus baku panjang jalur rumah tanpa denah

**Status:** default diterapkan atas keputusan pemilik (2026-10-12, P16-60) · **Blocks:** —
**Pertanyaan:** Bila ukuran rumah diketahui tetapi denahnya tidak, berapa panjang cabang, sambungan
ke alat, jalur pembuangan, dan ventilasi yang wajar untuk menghitung jumlah batang?
**Default yang diterapkan:** cabang = jumlah cabang × sisi terpanjang rumah; sambungan = 1,5 m per
titik air (`HOUSE_FIXTURE_DROP_1_5M`); tee = 1 per cabang, seukuran pipa utama; air kotor = sisi
terpanjang + tinggi lantai × (lantai − 1); air bekas = sisi terpanjang; ventilasi = lantai × tinggi
lantai + 1 m di atas atap (`HOUSE_VENT_ABOVE_ROOF_1M`). Semua ASUMSI (ENG-603, ENG-704,
`REQUIRES_DOMAIN_VALIDATION`). **Masih terbuka:** validasi tim teknis Pralon; jumlah fitting Y
pembuangan dan elbow belum dihitung.
**Tambahan 2026-10-12 (P16-61):** ukuran tanah dan bangunan dipisah; bangunan dasar hitungan, tanah
hanya menambah halaman (ENG-705) ke jalur PDAM/pompa dan jalur buangan; luas bangunan dibaca total
semua lantai (tapak = luas ÷ lantai). Pipa pengisi toren atap = halaman + sisi terpanjang bangunan +
muka air toren, ukuran ¾" (TANK_FILL_PIPE_3_4IN, P16-63) — ukuran dan rute perlu validasi.

### OQ-59 — SKU katalog bernama sama dan salinan ERP

**Status:** default diterapkan (2026-10-09, P16-50) · **Blocks:** —
**Pertanyaan:** Katalog aktif memuat 14 pasang SKU FITTING PVC bernama persis sama dengan kode ERP
berbeda (mis. `product.0_S_06_280_110063_00` dan `product.0_S_06_297_110063_00`, "Spigot All Flange

- D 110 x 63 mm") dan satu salinan HDPE bertanda "(copy)". Apakah pasangan itu varian berbeda
  (mis. standar flens) yang namanya belum dibedakan, atau catatan ganda?
  **Default yang diterapkan:** dihitung satu produk per nama kanonik, jumlah SKU tetap disebut bila
  berbeda. **Masih terbuka:** konfirmasi tim katalog; bila varian berbeda, namanya perlu pembeda di ERP.

### OQ-58 — Tebal dinding PVC, siklus pompa, dan kebutuhan per jenis gedung (audit akurasi)

**Status:** default diterapkan (2026-10-09, P16-49) · **Blocks:** —
**Pertanyaan:** Audit akurasi (docs/ENGINEERING_AUDIT.md) memperbaiki diameter dalam, zona, daya
pompa, tangki, dan BOM, tetapi beberapa angka belum punya sumber resmi.
**Default yang diterapkan:** (1) diameter dalam PVC = OD resmi − 2·OD/26,5 (`PVC_AW_WALL_SDR`,
dari tebal AW 4" yang lebih tebal di Knowledge Master §7.2) — dinding pipa kecil kemungkinan lebih
tebal dari perkiraan ini; (2) suku siklus pompa tangki atap 10 menit (`PUMP_CYCLE_10MIN`, rumus
Noerbambang & Morimura, keyakinan rendah); (3) satu kebutuhan 150 l/orang/hari dan 10 m²/orang untuk
semua jenis gedung; (4) kelas tekanan pipa tidak dicek otomatis — tekanan kerja transfer dan kaki
riser ditampilkan sebagai batasan yang harus dicek. **Masih terbuka:** tabel tebal dinding resmi per
kelas dan ukuran (Product Specification, P16-02b); kebutuhan air dan kepadatan per jenis gedung;
kelas tekanan resmi AW/D dan HDPE per PN; metode kebutuhan serentak alat plambing (unit beban) untuk
pipa per lantai; ekstraktor membaca "tinggi gedungnya 10 meter" sebagai panjang jalur, bukan tinggi
gedung (kartu pilihan tinggi tetap benar).

### OQ-57 — Nilai awal perhitungan gedung bertingkat

**Status:** default diterapkan (2026-10-09, P16-36) · **Blocks:** —
**Pertanyaan:** Pemilik meminta gedung di atas 4 lantai tetap dihitung ("tetep itung … ai ini salah
satunya di plot buat ngitung itungan teknis"), menggantikan Policy 5 lama yang menyerahkan semua
gedung > 4 lantai ke tim teknis. Perhitungannya butuh nilai yang belum divalidasi tim teknis Pralon.
**Default yang diterapkan:** Kelompok I (ENG-501…504, docs/ENGINEERING_RULES.md) dengan asumsi dari
buku acuan plambing Indonesia, semuanya `confirmationRequired` dan tampil di "Asumsi sementara":
`OCCUPANT_AREA_10M2` (10 m² lantai per orang, keyakinan rendah), `USAGE_HOURS_10`,
`PEAK_MINUTE_FACTOR_3`, `ZONE_MAX_STATIC_4BAR`, `TRANSFER_ROUTE_VERTICAL`, `FLOOR_HEADER_20M`, `GROUND_TANK_1_DAY`, `PEAK_DURATION_30MIN`, ditambah
`DEMAND_LPCD_150` dan `PEAK_HOUR_FACTOR_2` yang sudah ada. Satu kebutuhan per orang untuk
semua jenis gedung. Industri tetap ke tim teknis. **Masih terbuka:** kebutuhan air per jenis gedung
(kantor, apartemen, hotel, rumah sakit), kepadatan hunian per jenis, batas tekanan zona per jenis,
cadangan tangki bawah bila pasokan PDAM menerus, dan validasi aturan Kelompok I oleh ahli.

### OQ-56 — Apa yang dilakukan sistem dengan denah yang dilampirkan

**Status:** default diterapkan (2026-10-08, P13-06) · **Blocks:** —
**Pertanyaan:** "Lampirkan denah" ada di desain dan onboarding, tetapi tidak ada keputusan tentang
gunanya: apakah isinya dibaca otomatis, disimpan, atau diteruskan.
**Default yang diterapkan:** denah DISIMPAN di percakapan (PDF/PNG/JPG/WEBP, diperiksa magic bytes;
PDF beraksi aktif ditolak; ≤ `UPLOAD_MAX_MB` 10 MB; kuota harian per tier; retensi 180 hari) dan
ikut tercatat di handoff ke tim teknis (`lampiran:<id>`). Isinya TIDAK dibaca model — tidak ada
pembacaan gambar yang bisa dipertanggungjawabkan — jadi balasan meminta lantai, kamar mandi, dan
sumber air tetap ditulis. Unduhan hanya oleh pemilik, selalu `attachment`. Tanpa pemindai
antivirus (SECURITY.md §7: "tipe dibatasi ketat"). **Masih terbuka:** pemindai antivirus, akses tim
teknis ke berkas lewat back-office (menunggu layar internal, OQ-21), dan apakah denah suatu saat
dibaca otomatis.

### OQ-53 — Halaman profil/pengaturan akun belum ada

**Status:** default diterapkan ("gas", 2026-10-07), needs design · **Blocks:** —
**Pertanyaan:** Pemilik (2026-10-07) menanyakan letak "set up profile". Sebelumnya tidak ada layar
profil: akun hanya punya login, register, dan `GET /auth/me`; avatar di kaki sidebar tidak bisa
diklik. Prototipe juga tidak memuatnya (OQ-21).
**Default yang diterapkan:** halaman `/akun` minimal dengan token yang sama — nama (bisa diganti),
email (baca saja), jenis akun, ganti sandi (sandi saat ini wajib; 400 bila salah, bukan 401),
pengalih tema & bahasa, keluar — dibuka dari avatar/nama di kaki sidebar; ditandai "menunggu
desain". API: `GET /auth/me` kini memuat `name`/`email`, `PATCH /auth/me { name }`,
`POST /auth/password { currentPassword, newPassword }` (dibatasi per IP). Masih terbuka: field
tambahan (perusahaan, telepon, wilayah?) dan ganti email.

### OQ-52 — Bidang ketik composer dan elemen header/sidebar yang dibuang

**Status:** keputusan pemilik diterapkan, needs design · **Blocks:** —
**Pertanyaan:** Pemilik (2026-10-07) menilai input satu baris prototipe sempit dan tidak modern,
dan meminta membuang teks yang tidak berguna: badge "LANGKAH n DARI 4" di header serta tautan
mati "Solusi Tersimpan" / "Pengetahuan Produk" di sidebar dan rail.
**Default yang diterapkan:** textarea yang tumbuh (1–~6 baris, Enter kirim, Shift+Enter baris
baru), kartu radius 14 px, tinggi minimum 56 px (pil ponsel 52 px), cincin fokus merek pada
`:focus-within`, tombol kirim 38–40 px. Badge dan tautan mati dihapus; "SOLUSI SIAP" tetap.
Kembalikan tautan bila layarnya didesain.

### OQ-51 — Riwayat di layar sempit: drawer sidebar, bukan dropdown

**Status:** keputusan pemilik diterapkan, needs design · **Blocks:** —
**Pertanyaan:** Prototipe menaruh "Riwayat" sebagai menu dropdown 260 px di header saat < 1080 px.
Pemilik (2026-10-07) meminta bentuk seperti ChatGPT/Claude di ponsel: sidebar yang menggeser masuk
dari kiri dengan isi yang sama dengan sidebar desktop.
**Default yang diterapkan:** sidebar yang sama dirender sebagai drawer (lebar `min(300px, 86vw)`,
backdrop, tombol tutup ×, Escape menutup, memilih riwayat/percakapan baru menutup); tombol pembuka di
header: "Riwayat" (< 1080) atau ☰ (< 720). Menunggu desain; jangan dianggap final.

### OQ-50 — Layar "Opsi ukuran" dan "Kesiapan hasil" belum didesain

**Status:** open, needs design · **Blocks:** — (dibangun minimal, P14-06)
**Pertanyaan:** Brief Fase 14 §28 meminta jawaban teknis berbagian tetap (opsi dengan tradeoff,
kesiapan per keluaran, data diketahui, data yang masih dibutuhkan). Prototipe desain tidak memuat
bagian-bagian itu. Di mana tempatnya di workspace solusi, dan bagaimana bentuk tabel kandidat ukuran
(status, penanda rekomendasi/alternatif, catatan)?
**Default yang diterapkan:** dua kartu tambahan di tab Ringkasan (opsi, kesiapan) dan empat daftar di
tab Material, memakai kelas/token kartu yang sudah ada; baris rekomendasi diberi penanda merah merek
(seleksi), status memakai tag hijau/amber/abu dengan teks. Menunggu desain; jangan dianggap final.

### OQ-49 — Token worker untuk rute internal laporan di produksi

**Status:** default disetujui pemilik dan diterapkan (2026-10-06) · **Blocks:** —
**Pertanyaan:** Worker memanggil `GET/POST /api/v1/internal/reports/:id/print|ready` dengan
`Bearer $WORKER_INTERNAL_TOKEN`, tetapi API hanya mengisi aktor dari **JWT access token** yang
ditandatangani `JWT_ACCESS_SECRET` dan berumur `JWT_ACCESS_TTL` (`access-token.middleware.ts`).
Tidak ada jalur token layanan statis. Nilai acak di `.env.production` (2026-10-06) membuat worker
start, tetapi setiap job PDF akan berakhir 401.
**Default yang diterapkan:** jalur **token layanan** terpisah — `WorkerTokenMiddleware`
(`apps/api/src/modules/report/presentation/`) membandingkan `WORKER_INTERNAL_TOKEN` waktu-tetap, hanya
dipasang pada `InternalReportController`, mengisi aktor `{ id: 'worker', roles: ['admin'] }` sehingga
audit mencatat `worker`. Env API opsional (≥ 32 karakter); tanpa itu rutenya tetap tertutup.
Alternatif yang ditolak: JWT berumur panjang yang dicetak manual (kedaluwarsa diam-diam; tidak ada
pencabutan).

### OQ-46 — Katalog contoh pernah mendasari klaim tentang Pralon; kini ditandai dan dipagari

**Status:** open · _non-blocking_ · **Fase:** 1/4 · diterapkan sebagai default (migration 0013)

Laporan pemilik (2026-10-06): jawaban "apa bedanya PVC sama HDPE?" memuat **"HDPE tidak ada di
katalog Pralon yang aktif"** dan **"CONTOH Pipa PVC AW … Data contoh untuk pengembangan. Bukan produk
Pralon."** Dua kesalahan yang berbeda akarnya:

1. Katalog aktif adalah katalog contoh (`seed:sample`), karena katalog Pralon sungguhan belum pernah
   diimpor (OQ-07). Pipeline tidak bisa membedakannya dari katalog Pralon — satu-satunya tanda ada di
   teks (`source_document`, awalan "CONTOH") — lalu menyimpulkan "Pralon tidak punya HDPE" dari
   ketiadaan di data karangan. Pralon punya keluarga produk PE/HDPE.
2. Pertanyaan konsep diperlakukan sebagai lookup katalog: kegagalan retrieval mengendalikan isi
   jawaban, dan baris contoh masuk konteks model lalu ke pengguna.

**Default yang diterapkan:**

- `catalog_versions.kind` (`pralon` | `sample`, bawaan `pralon`; 0013 juga menandai versi contoh yang
  sudah ada dari `source_document`-nya, sekali saat migrasi). `seed:sample` menulis `sample` lewat
  `CatalogIngestCommand.kind`; impor back-office tidak menyentuhnya.
- Satu modul visibilitas (`product-catalog/domain/catalog-visibility.ts`): `isAuthoritative`,
  `sampleCatalogAllowed` (hanya `development` — bukan `test`), `isAnswerable` (bukan `discontinued`).
- `CatalogQueryService.activeVersion()` **gagal tertutup** atas versi `sample` di luar development
  (`SampleCatalogRefusedError` → `CATALOG_UNAVAILABLE`), termasuk versi dari cache. `AnalysisService`
  dipindah ke service ini (sebelumnya membaca repository langsung dan melewati pagar).
- Pipeline pertanyaan produk: KONSEP = pengetahuan umum → katalog pendukung (hanya `pralon`) → model
  perangkai; SPESIFIKASI = katalog aktif → `product-knowledge`. Klaim negatif tentang Pralon hanya atas
  katalog `pralon`; atas katalog contoh kalimatnya "belum ada di data katalog yang terpasang" (jalur
  spesifikasi, development saja) atau tidak ada klaim sama sekali (jalur konsep). Katalog yang gagal
  dibaca tidak mengubah penjelasan teknik.
- Badge sambutan: `kind = sample` → "KATALOG CONTOH · dev-0.1", bukan "KATALOG PRALON".

**Yang saya TIDAK lakukan:** menambah `is_mock`/`is_public`/`verification_status` per produk. Satu
kolom di versi sudah cukup karena sumber data adalah sifat versi (satu impor = satu dokumen), dan
provenance per nilai sudah ada (`product_specs.provenance`). Intent baru (`general_education`, …)
juga tidak dibuat — lihat docs/AI_BEHAVIOR.md §4.

**Yang dibutuhkan dari pemilik:** (a) konfirmasi bahwa `development` adalah satu-satunya lingkungan
tempat katalog contoh boleh aktif (staging dengan katalog contoh berarti staging tanpa katalog); (b)
OQ-07 — sampai katalog Pralon diimpor, jawaban produk di lingkungan mana pun tidak bisa menyebut
produk Pralon, hanya tim teknis.

### OQ-44 — Audit biaya tidak bisa membedakan prosa yang diterima dari yang ditolak REC-1

**Status:** **answered** (2026-10-05, default diterima) · _non-blocking_ · **Fase:** 7 · diterapkan sebagai migration 0012

Verifikasi hidup penyambungan `ProseWriter` ke LLM memperlihatkan ini. Tiga skenario dijalankan
terhadap stub OpenRouter lokal, dan `llm_calls` mencatat kelimanya dengan cara yang sama:

| Skenario                           | Panggilan | Tercatat sebagai                             |
| ---------------------------------- | --------- | -------------------------------------------- |
| Prosa patuh                        | 1         | `explanation_prose` · `success`              |
| Angka asing, percobaan ulang lolos | 2         | `explanation_prose` · `success` **dua kali** |
| Angka asing dua kali → templat     | 2         | `explanation_prose` · `success` **dua kali** |

Dari sisi `ai`, kelima panggilan memang berhasil: model menjawab, HTTP 200, token terpakai.
Penolakan terjadi **setelahnya**, di perakitan rekomendasi, dan `ai` tidak boleh mengetahuinya —
begitu ia tahu angka mana yang sah, ia berhenti menjadi layanan dan mulai menilai kebenaran teknik
(SPEC §25). Jadi catatan itu tidak salah; ia hanya tidak cukup.

Akibat praktisnya: tidak ada cara mengetahui dari basis data **seberapa sering model mengarang
angka**. Itu justru metrik yang paling ingin diketahui sebelum memilih model, dan metrik yang sama
yang dipakai evaluasi (`docs/EVALUATION.md`, laju halusinasi harus 0%). Hari ini angka itu hanya
terlihat bila seseorang membaca log aplikasi.

**Yang saya TIDAK lakukan:** menambahkan `outcome` baru seperti `rec1_rejected` ke `llm_calls` dari
perakitan rekomendasi. Itu akan membuat konteks `recommendation` menulis ke tabel milik `ai`, dan
memberi `ai` satu field yang hanya bisa diisi pihak yang tahu aturan REC-1 — tepat batas yang
dijaga.

**Usulan default:** perakitan memancarkan metrik sendiri (`proseSource` sudah dikembalikan
`assembleRecommendation`: `llm` / `llm_retry` / `template`), disimpan di baris `recommendations`
sebagai kolom kecil. Dengan begitu laju "prosa ditolak" bisa dihitung dengan satu `GROUP BY` tanpa
memindahkan pengetahuan apa pun ke `ai`, dan angkanya terikat pada rekomendasi yang terdampak.

**Pertanyaannya:** pemilik setuju menambah kolom `prose_source` di `recommendations` (migration
kecil, satu kolom VARCHAR + CHECK), atau cukup mengandalkan log aplikasi sampai evaluasi berjalan?

**Diterapkan 2026-10-05 mengikuti usulan default** (`0012_recommendation_prose_source.sql`):
`recommendations.prose_source` ∈ `llm` / `llm_retry` / `template`, ditulis oleh perakitan lewat
`RecommendationRepository.save`. Baris sebelum 0012 bernilai `NULL` — tidak diberi nilai tebakan,
supaya metriknya jujur sejak tanggal tertentu alih-alih separuh karangan. Laju prosa yang ditolak:
`SELECT prose_source, COUNT(*) FROM recommendations WHERE prose_source IS NOT NULL GROUP BY 1`.
`ai` dan `llm_calls` tidak disentuh. Bila pemilik memilih mengandalkan log saja, 0012 punya rollback.

### OQ-43 — Token `--snouty-caption` gagal kontras WCAG AA pada ukuran pakainya

**Status:** **answered** (2026-10-05, default diterima) · **Blocks:** 13 (audit a11y) · **Fase:** 13 (P13-02)
`--snouty-caption` (`#8A9295`) berbanding **3,17:1** terhadap `surface` putih. WCAG 2.1 AA mewajibkan
4,5:1 untuk teks di bawah 18px (atau 14px bold); 3:1 hanya cukup untuk teks besar. Token ini dipakai
pada **10–12px** di beberapa tempat — meta riwayat, label blok judul, catatan kaki tahap — jadi di
situ ia tidak memenuhi AA.

Nilai-nilai lain lulus: amber `#8A5300` 5,76–6,33:1, hijau terverifikasi 4,74:1, merek 6,76:1, muted
6,07:1.

**Yang saya TIDAK lakukan:** mengubah nilai tokennya. Token adalah sumber kebenaran visual, dan
menggelapkannya sendiri berarti merancang ulang (`docs/DESIGN_IMPLEMENTATION.md` §1).

**Usulan default:** gelapkan `--snouty-caption` menjadi sekitar `#6E7679` (≈4,6:1) — perubahan yang
nyaris tak terlihat pada ukuran itu, dan tetap lebih terang dari `--snouty-muted` sehingga hierarkinya
utuh. Alternatifnya: pakai `--snouty-muted` di setiap tempat yang di bawah 14px dan sisakan `caption`
hanya untuk teks besar, tetapi itu menghapus satu tingkat hierarki yang memang dipakai desain.

**Pertanyaannya:** pemilik dan desainer memilih menggelapkan tokennya, atau membatasi pemakaiannya?

### OQ-42 — Anatomi aturan meminta zod, isolasi engine melarang dependensi

**Status:** **answered** (2026-10-05, default diterima) · _non-blocking_ · **Fase:** 6 (P6-01, sudah diterapkan mengikuti usulan default)
`docs/ENGINEERING_RULES.md` §2 mendefinisikan `RuleVersion` dengan `inputSchema: ZodSchema<I>` dan
`outputSchema`. Tetapi `packages/engineering` sengaja **tanpa dependensi runtime sama sekali**, dijaga
`scripts/check-engineering-isolation.mjs` yang menggagalkan CI bila ada satu pun dependensi. Menambahkan
zod ke paket itu akan melanggar pagar yang justru membuat "engine tidak pernah memanggil LLM" benar
secara struktural.

**Usulan default yang saya pakai:** engine tetap bebas dependensi; `RuleVersion` memakai
`parseInput: (raw: unknown) => I` — fungsi guard TypeScript murni yang melempar bila masukan tak sah.
Validasi zod tetap ada, tetapi di **tepi** (`apps/api`, tempat zod sudah hidup): masukan engine datang
dari Context Engine yang sudah divalidasi skema ekstraksi, jadi zod di dalam engine akan memeriksa
ulang apa yang sudah diperiksa — dengan harga melepas properti nol-dependensi.

**Pertanyaannya:** apakah pemilik lebih memilih zod di dalam engine (dan pagar isolasi dilunakkan
menjadi "tanpa dependensi kecuali zod"), atau guard murni seperti yang saya terapkan?

### OQ-41 — `REPORT_PDF` tidak tampil di manfaat onboarding

**Status:** open · _non-blocking_ · **Fase:** 3 (P3-09/P3-12, sudah diterapkan mengikuti desain)
Layar 14 langkah 5 menampilkan **enam** manfaat, dan `REPORT_PDF` — yang ada di tabel entitlement —
tidak termasuk. Desain juga menyertakan satu kapabilitas tamu (`RECOMMENDATION`, bertag TAMU JUGA),
jadi daftarnya bukan sekadar "semua yang tamu tidak punya".

**Yang saya lakukan:** daftar TAMPILAN mengikuti kurasi desain apa adanya; **tag**-nya tetap
diturunkan dari tabel entitlement (SPEC §33e), dan turunannya cocok persis dengan tag yang digambar
desainer. `REPORT_PDF` tetap ada di tabel dan tetap digerbang — ia hanya tidak diiklankan di
onboarding.

**Pertanyaannya:** apakah ketiadaan `REPORT_PDF` di layar itu disengaja (mis. karena laporan dianggap
bagian dari "analisis studi kasus") atau kelalaian desain yang ingin diperbaiki?

**Pembaruan 2026-10-09 (arahan pemilik "user saat ini belum bisa melihat hasil report-nya"):** REPORT_PDF
kini untuk tier registered dan advanced — sebelumnya hanya advanced, padahal seluruh akun produksi bertier
registered dan tidak ada jalur ke advanced, sehingga tabel reports produksi kosong. Tamu tetap diajak
masuk/daftar.

### OQ-14 — (33h #1) Pricing shown in report vs. no price on product screens

**Status:** open · **Blocks:** 8, 10
See OQ-03. **Proposed default:** the two are _not_ actually in conflict — product knowledge screens
never show price (technical knowledge, not commerce), while the report may show an estimate _if_
pricing is switched on. With `PRICING_ENABLED=false` both render price-free.

### OQ-15 — (33h #2) Guest entitlement contradicts the prototype

**Status:** **answered** (2026-10-05, default diterima) · **Blocks:** 5, 10
Onboarding step 5 tags BOM, schematic, and case analysis as `LANJUTAN` (account-only), but the
prototype hands a guest the complete solution workspace including BOM and schematic. There is no
register-gate screen, no login/register screen, and the prototype sidebar always shows a signed-in
user ("Budi Santoso · Pelanggan").
**Proposed default:** Follow the **onboarding promise**, because it is the one the user is shown and
because Section 4.4 mandates the guest→register→resume flow. Guests get Q&A, recommendation, and
clarification; BOM, schematic, save, and report require an account. A register-gate panel (needs
design — see OQ-27) preserves the guest requirement state and resumes the _same_ case after signup, so
nothing is retyped.

### OQ-16 — (33h #3) Two different dark palettes

**Status:** **answered** (2026-10-05, default diterima) · **Blocks:** 0e (P0e-06 tokens)
The 14-screen board and the newer prototype use materially different dark surfaces. I extracted both
mappings exactly from source:

| Role                        | Board dark (`SNOUTY Dark.dc.html`) | Prototype dark (`SNOUTY Prototype.dc.html`) |
| --------------------------- | ---------------------------------- | ------------------------------------------- |
| app background (`#F7F8F7`)  | `#17191B`                          | `#0F1213`                                   |
| surface (`#FFFFFF`)         | `#1D2023`                          | `#171B1D`                                   |
| subtle (`#FBFCFB`)          | `#202326`                          | `#1B2022`                                   |
| border (`#DDE2E1`)          | `#33383C`                          | `#343B3E`                                   |
| card border (`#E6EAE9`)     | `#2B3034`                          | `#2A3033`                                   |
| verified text (`#1E7A4C`)   | `#5CC98D`                          | `#62C48F`                                   |
| assumption text (`#8A5300`) | `#EEB96E`                          | `#E4B56C`                                   |
| brand text (`#B02414`)      | `#FF8874`                          | `#F4806E`                                   |

**Proposed default:** Use the **prototype** palette (source-of-truth rank 2 beats rank 4 per §33a) —
i.e. the darker `#0F1213` / `#171B1D` set. The complete light→dark token map from both files has been
extracted and will be recorded in `DESIGN_IMPLEMENTATION.md` in Phase 0b.

### OQ-17 — (33h #4) Wastewater is offered in the UI but out of scope

**Status:** diputuskan pemilik (2026-10-12, P16-51) — pembuangan rumah DIHITUNG (Kelompok J: unit
beban buangan IPC 709.1, kapasitas IPC 710.1(1) pada 2 %, kloset minimal 4", ventilasi ≥ ½ diameter),
tidak lagi diteruskan ke tim teknis. Nilai IPC menunggu padanan SNI 8153 dari tim teknis Pralon.
**Status lama:** open · **Blocks:** 5 (scope routing)
The clarification chips offer "Air bersih + pembuangan" and "Air kotor / pembuangan", history shows
"Saluran pembuangan ruko", screen 07 shows a `Pralon PVC D` card with size `3"–4" ?`, yet wastewater
engineering is future scope.
**Proposed default:** Accept and **record** the wastewater requirement (so the user is heard and the
data reaches market intelligence), then state plainly that full wastewater recommendation is not yet
available and offer the technical team. Clean-water portions of a mixed request are still answered.
The chips stay in the UI exactly as designed.

### OQ-18 — (33h #5) Mascot artwork provenance and Pralon brand assets

**Status:** **answered** (2026-10-05, default diterima) · **Blocks:** 3 (mascot ships with onboarding/welcome) · _legal/brand_
`assets/snouty-mascot.png` is byte-identical to `uploads/ChatGPT Image 17 Sep 2026, 10.50.08.png`, i.e.
the mascot in the mocks is AI-generated reference art, not approved Pralon artwork. There is also no
official Pralon logo in the bundle — the brand mark is a placeholder, and `#DF301C` was supplied
without a brand-guide reference.
**Question:** Who approves final mascot art, and can you supply the official Pralon logo and the exact
brand red?
**Proposed default:** Build the mascot as a swappable component driven by `moodFor(state)` and keep the
current PNGs as clearly-labelled placeholders; do not ship to production until brand approves.

### OQ-19 — (33h #6) localStorage vs. server-side persistence

**Status:** open · **Blocks:** 3
**Proposed default:** Server is authoritative. Consent (location, guest-chat analytics) and theme are
stored server-side for registered users and on the guest session record for guests;
`localStorage['snouty_onboarding_state']` and `localStorage['snouty-theme']` remain only as a
first-paint convenience and are reconciled with the server on load.

### OQ-20 — (33h #7) Example prompt chips

**Status:** open · _non-blocking_ · **Affects:** 3 (screen 01)
The board deliberately removed the "COBA SALAH SATU" chip row; the newer prototype still defines five
`EXAMPLES` but **does not render them** anywhere in its template.
**Proposed default:** Drop the chips — both current sources agree in practice. The example strings are
preserved in the eval golden dataset instead, where they are genuinely useful.

### OQ-21 — (33h #8) Missing designs

**Status:** open · **Blocks:** the phase each screen belongs to
No design exists for: login, register, register-gate + resume, all back-office screens (§15b), answer
feedback (thumbs up/down), privacy/terms pages, and the onboarding re-open entry point.
**Proposed default:** Implement each minimally using existing tokens and log it as "needs design".
Partial relief: the standalone onboarding file _does_ design the post-close state, including the copy
"Onboarding tidak akan muncul lagi otomatis pada kunjungan berikutnya. Nanti dapat dibuka manual dari
menu bantuan." and a "Tampilkan onboarding lagi" control — so the re-open affordance belongs in a help
menu.
**Needs design (Fase 26, 2026-10-21):** dashboard admin prospek 5A (`/internal/prospects`: corong, papan,
penugasan, tim sales), dashboard sales (P26-06), opt-in "dihubungi tim Pralon" di form daftar dan menu Akun,
tombol "Minta dihubungi tim Pralon". Dibangun minimal dengan token yang ada; tanpa penanda di layar
(pemilik: tanpa metatext) — statusnya dicatat di sini.

---

## C. New conflicts found while reading the design (not in §33h)

### OQ-22 — Two different main-pipe sizing rules in the two prototypes

**Status:** open · **Blocks:** 6 · **Affects:** ENG-001, ENG-002
SPEC §33b quotes the **older** prototype: `fixtures = bath*2 + basin + kitchen`, `mainSize = fixtures

> = 6 ? '1"' : '3/4"'`. The **newer** prototype (source-of-truth rank 2) actually computes two different
> quantities:

```js
fixtures = bath + basin + kitchen; // "Titik air" — outlet count
loadUnits = bath * 2 + basin + kitchen; // fixture load units
mainSize = loadUnits >= 8 ? '1"' : '3/4"';
```

So the threshold is **8 load units**, not 6, and "titik air" is a plain outlet count. The board's
worked example (3 bath, 4 basin, 1 kitchen → "8 titik air", main 1") matches the **newer** formula.
**Proposed default:** Record the newer prototype's version as ENG-001/ENG-002 and correct the tracker.
Both remain `REQUIRES_DOMAIN_VALIDATION` — this discrepancy is exactly why no sizing value may render
as TERVERIFIKASI before OQ-06 is resolved.

### OQ-23 — Two different clarification question sets

**Status:** open · **Blocks:** 5 · **Affects:** ENG-007
The prototype asks one question per turn in the order `source → install → floors → bath`. Board screen
03 instead shows a grouped card of three different questions: _"Instalasi ini untuk apa?"_, _"Berapa
titik air yang akan dilayani?"_ (1–3 / 4–8 / >8), _"Apakah menggunakan pompa pendorong?"_. The board
therefore implies two requirement fields the prototype has no slot for: **jumlah titik air** and
**pompa pendorong**, and its right panel lists both.
**Proposed default:** Support both shapes from one engine: the requirement schema carries all fields
(`water_source`, `installation_type`, `floors`, `bathrooms`, `basins`, `kitchens`, `outlet_count`,
`booster_pump`, `building_dimensions`), and the clarification engine renders one question per turn
(prototype style) or a grouped card of up to four (board style) depending on how many fields are
missing — grouped when ≥3 are missing, single when 1–2 are. Priority order stays ENG-007, pending
domain validation.

### OQ-24 — Board screen 14 onboarding ≠ the 5-step wizard

**Status:** open · **Blocks:** 3
Board screen 14 is a compact three-bullet first-run pop-up ("Ceritakan dulu, jangan pikirkan istilah
teknis" / "Saya akan bertanya bila ada yang kurang" / "Rekomendasi hanya dari produk Pralon", with
"Jangan tampilkan lagi", "Lihat contoh pertanyaan", "Mulai konsultasi"). The dedicated onboarding file
and the newer prototype both implement the **5-step wizard** described in §33e.
**Proposed default:** Ship the 5-step wizard (rank 2 and the dedicated onboarding file agree); treat
board 14 as an earlier iteration. Its three bullets are good copy and are reused as the step-1
capability cards.

### OQ-25 — Right-panel width and other metric drift

**Status:** open · _non-blocking_ · **Blocks:** 0e polish
Handoff README and the board say the right panel is **330px**; the newer prototype uses **300px**
(`min(300px,88%)` as an overlay) and a **44px** collapsed rail (README says 48px), plus a **60px**
collapsed left nav rail that the README does not mention at all. The onboarding modal is **860px** wide
with a 300px hero column in the prototype, versus "max-width 580px" in the README.
**Proposed default:** Prototype values win (§33a rank 2): panel 300px, rail 44px, nav rail 60px,
onboarding 860×580 desktop / 88vh bottom sheet below 1080px. Sidebar 236px and header 52px agree
across sources and are unchanged.

### OQ-26 — Solution header actions differ

**Status:** open · _non-blocking_ · **Blocks:** 9/10 polish
Board screen 06 header: "Unduh PDF" + "Simpan solusi". Prototype header: "Simpan solusi" + "Buat
laporan" (which opens a report preview overlay whose footer then offers "Kirim ke email" + "Unduh PDF").
**Proposed default:** Prototype flow — "Buat laporan" opens the preview, download happens from there.
This is also the safer flow because PDF generation is an async job that can fail (§33g).

### OQ-27 — Register-gate and resume screen

**Status:** default diterapkan (P8-09, 2026-10-08) — tampilan menunggu desain (OQ-21) · **Blocks:** 10 (and OQ-15 depends on it)
Section 4.4 requires guest→register→resume with no retyping, but no screen exists for it.
**Proposed default:** An inline panel in the conversation (not a modal) using existing tokens: explains
what an account unlocks, offers "Daftar Akun" / "Masuk", and on success links the guest session's
requirement state to the new account and continues the same conversation.

### OQ-28 — Status tags beyond the four named in the spec

**Status:** open · _non-blocking_ · **Blocks:** 10
Board screen 12 shows additional tags not listed in §33d: **`DISIMPAN`**, and saved-solution badges of
the form **`5 MATERIAL · ESTIMASI`** / **`3 MATERIAL · LENGKAP`**. Board screen 02/04/05 also show
header states `SEDANG BERLANGSUNG`, `MEMERIKSA DATA`, `MENGANALISIS…`, `DIBUKA KEMBALI`.
**Proposed default:** Model conversation status as an enum covering all of them
(`in_progress`, `checking_data`, `analyzing`, `incomplete_data`, `solution_ready`, `needs_validation`,
`saved`, `reopened`) and derive the `N PRODUK` / `N MATERIAL · ESTIMASI|LENGKAP` badges from stored
counts plus the aggregate provenance of the BOM.

### OQ-29 — Extra affordances in the board with no specified backend

**Status:** open · _non-blocking_ · **Blocks:** the owning phase
The board includes actions the spec does not mention: **"Unduh PNG"** for the schematic (screen 09),
**"Unduh sebagai daftar belanja"** for the BOM (06), **"Buka dokumen teknis"** and **"Gunakan di
solusi"** (10), **"Lihat semua katalog"** (06), **"Bagikan"** (02), and **search + status filter** on
history (12).
**Proposed default:** Implement search/filter (12) and "Lihat semua katalog" (they are cheap and
expected); defer PNG export, shopping-list export, and "Bagikan" to post-MVP; wire "Buka dokumen
teknis" to the catalog `source_document` link when one exists and hide it when it does not.

### OQ-30 — Mascot moods in the mascot sheet beyond the 14 in §33f

**Status:** open · _non-blocking_ · **Blocks:** 3
`SNOUTY Mascot.dc.html` also specifies **Menyapa** (wave, 2.6s), **Mengintip** (peek, 5s — for empty
history / empty saved solutions / no search results), **Bertanya** (static, mirrored — clarification,
amber tone), and **Berhasil** (hop + stamp, plays once) as product states, plus icon sizes 128/56/32/24
with a note that below 32px the mascot needs a thicker-line variant. It also shows an alternate welcome
screen with a personalised greeting ("Selamat pagi, Budi. Mau bangun apa hari ini?") and three trust
badges ("HANYA PRODUK PRALON", "ASUMSI SELALU DITANDAI", "PANDUAN PERENCANAAN, BUKAN SERTIFIKASI") that
board screen 01 does not have.
**Proposed default:** Extend `moodFor(state)` to cover all of them; implement the standard board 01
welcome for MVP and treat the personalised greeting + trust badges as a Phase 3 enhancement once auth
exists. Only the moods actually reachable from real system state are implemented.

### OQ-31 — How the animated mascot is implemented

**Status:** open · _non-blocking_ · **Blocks:** 3
The prototype animates the mascot by layering CSS-animated eyes, thought bubbles, sweat drops, and
sparks over two flat PNGs (`snouty-base.png`, `snouty-pencil.png`) at fixed coordinates in a 1254px
design space — roughly 25 keyframe animations. It is faithful but heavy, and it hard-codes eye
positions against a specific PNG.
**Proposed default:** Port it as a single self-contained `<Snouty mood="…">` React component driven by
the same coordinate math, with `prefers-reduced-motion` collapsing every mood to a static frame (the
prototype does not do this — §33c requires it). Revisit once final art exists (OQ-18); an SVG mascot
would be cleaner but is a redesign and therefore not mine to make.

### OQ-32 — "Belum tahu" default values need validation

**Status:** open · **Blocks:** 5, 6
The prototype silently substitutes `source → 'Toren atap'` and `install → 'Air bersih'` when the user
answers "Belum tahu". These are engineering-relevant defaults presented to the user as assumptions.
**Proposed default:** Keep the same defaults, register each as a versioned assumption rule with status
`REQUIRES_DOMAIN_VALIDATION`, always mark the resulting field `ASSUMED`, and always surface it in the
"Asumsi yang digunakan" card with its reason.

### OQ-33 — Schematic floor distribution heuristic

**Status:** open · **Blocks:** 9 · **Affects:** a new ENG rule
The prototype distributes fixtures across floors with `ceil(bath/nFloors)` on the top floor and
`floor(bath/nFloors)` below, puts the kitchen on floor 1, and caps the drawing at 3 floors.
**Proposed default:** Register as ENG-008 (`REQUIRES_DOMAIN_VALIDATION`), mark every derived node
`ASSUMED`, and ask the user for the per-floor breakdown when it materially changes sizing. Remove the
3-floor drawing cap — that is a prototype rendering limit, not a rule.

---

## D. Items needing Pralon domain-expert validation

These are tracked in the Domain Validation Tracker in `docs/PROGRESS.md`. Listed here so the expert
(OQ-06) receives one consolidated list.

| Rule    | Description                                                                                                                 | Origin                |
| ------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| ENG-001 | Fixture load units: `bath*2 + basin + kitchen`; outlet count `bath + basin + kitchen`                                       | newer prototype       |
| ENG-002 | Main/riser size threshold: `loadUnits >= 8 → 1"`, else `3/4"` (older prototype said ≥6)                                     | newer prototype       |
| ENG-003 | Maximum 4 outlets per branch                                                                                                | both prototypes       |
| ENG-004 | Default floor height 3.5 m                                                                                                  | both prototypes       |
| ENG-005 | Fixture connection size 1/2"                                                                                                | both prototypes       |
| ENG-006 | Field variance 10–15% on estimated quantities                                                                               | both prototypes       |
| ENG-007 | Clarification priority order `source → install → floors → bath`                                                             | prototype (see OQ-23) |
| ENG-008 | Fixture-to-floor distribution heuristic                                                                                     | prototype (see OQ-33) |
| ENG-009 | BOM quantity formulas (`2+nFloors` batang main, `3+bath` batang branch, `bath+2` tees, `bath*3` elbows, `nFloors` reducers) | prototype             |
| ENG-010 | Target flow velocity 1–2 m/s (quoted in "DETAIL TEKNIS")                                                                    | prototype             |
| ENG-011 | Gravity from a rooftop tank is sufficient without a booster pump for this class of building                                 | prototype copy        |
| ENG-012 | Assumption "each bathroom contains 1 shower + 1 closet"                                                                     | prototype             |
| ENG-013 | Pressure class guidance: AW for pressurised clean water, D for drainage                                                     | board screen 08       |

---

## Answer log

| ID    | Decision                                                                                                                                                                                                                                          | Decided by | Date       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------- |
| OQ-02 | Database `snouty` on `192.168.1.136`, user `ict`. Read-only inspection completed; `snouty` is empty. Raised OQ-34 and OQ-35 as follow-ups.                                                                                                        | owner      | 2026-09-30 |
| OQ-01 | Partially answered — `snouty` DB confirmed empty; existence of an old codebase elsewhere still open.                                                                                                                                              | owner      | 2026-09-30 |
| OQ-03 | Default diterima: harga di luar lingkup MVP, `PRICING_ENABLED=false`; kolom harga tidak dirender.                                                                                                                                                 | owner      | 2026-10-05 |
| OQ-08 | Default diterima: handoff dikirim lewat email ke `TECH_HANDOFF_TARGET` (via n8n) + baris antrean internal; SLA "1×24 jam kerja" dari config. Alamat tujuannya sendiri belum diberikan.                                                            | owner      | 2026-10-05 |
| OQ-09 | Default diterima: GitHub + GitHub Actions. Remote `solusidigitalkita1001-sudo/snouty-draft` sudah ada. Kunci LLM dan tiga ID model tetap belum ada.                                                                                               | owner      | 2026-10-05 |
| OQ-12 | Default diterima: halaman placeholder `/privasi` dan `/ketentuan`, `POLICY_VERSION=v0-draft` di setiap baris consent; diganti sebelum peluncuran.                                                                                                 | owner      | 2026-10-05 |
| OQ-16 | Default diterima: palet gelap prototipe (`#0F1213` canvas, `#171B1D` surface).                                                                                                                                                                    | owner      | 2026-10-05 |
| OQ-18 | Default diterima: mascot di belakang `MascotSlot` yang bisa diganti; PNG sekarang placeholder; tidak ke produksi sebelum brand menyetujui.                                                                                                        | owner      | 2026-10-05 |
| OQ-42 | Default diterima: `packages/engineering` tetap nol dependensi; guard TS murni (`parseInput`) di dalam engine, zod di tepi `apps/api`.                                                                                                             | owner      | 2026-10-05 |
| OQ-43 | Default diterima: `--snouty-caption` digelapkan. Diterapkan `#6B7376` (bukan `#6E7679`, yang masih 4,35:1 di `canvas`); mode gelap tetap.                                                                                                         | owner      | 2026-10-05 |
| OQ-15 | Default diterima: ikuti janji onboarding. Tamu mendapat tanya-jawab, rekomendasi, klarifikasi; BOM, skema, simpan, laporan butuh akun. `ENTITLEMENTS` sudah begitu — tidak ada perubahan kode. Panel register-gate tetap menunggu desain (OQ-27). | owner      | 2026-10-05 |
| OQ-44 | Default diterima: `recommendations.prose_source` (migration 0012) tetap; laju prosa yang ditolak REC-1 dihitung dari kolom itu, `ai` dan `llm_calls` tidak disentuh.                                                                              | owner      | 2026-10-05 |
