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

**Status:** open · **Blocks:** 8 (BOM), 10 (report) · also drives 33h #1
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

**Status:** open · **Blocks:** 10 (technical handoff), 11 (email)
The design promises "Balasan biasanya 1×24 jam kerja" on screen 11.
**Question:** Where does "Kirim ke tim teknis Pralon" deliver — mailbox, CRM, ticket system? Is 1×24
working hours the contractual SLA we may display?
**Proposed default:** Email to a `TECH_HANDOFF_TARGET` address via n8n, plus a row in the internal
handoff queue. SLA copy stays "1×24 jam kerja" exactly as designed, driven by config not a literal.

### OQ-09 — Git remote and CI provider

**Status:** open · **Blocks:** 0e (P0e-05)
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

**Status:** open · **Blocks:** 3 (onboarding consent), 13
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

**Status:** open · **Blocks:** 1 (P1-06b), 10 (PDF), 11 (email), 12 (pasar)
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

### OQ-43 — Token `--snouty-caption` gagal kontras WCAG AA pada ukuran pakainya

**Status:** open · **Blocks:** 13 (audit a11y) · **Fase:** 13 (P13-02)
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

**Status:** open · _non-blocking_ · **Fase:** 6 (P6-01, sudah diterapkan mengikuti usulan default)
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

### OQ-14 — (33h #1) Pricing shown in report vs. no price on product screens

**Status:** open · **Blocks:** 8, 10
See OQ-03. **Proposed default:** the two are _not_ actually in conflict — product knowledge screens
never show price (technical knowledge, not commerce), while the report may show an estimate _if_
pricing is switched on. With `PRICING_ENABLED=false` both render price-free.

### OQ-15 — (33h #2) Guest entitlement contradicts the prototype

**Status:** open · **Blocks:** 5, 10
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

**Status:** open · **Blocks:** 0e (P0e-06 tokens)
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

**Status:** open · **Blocks:** 5 (scope routing)
The clarification chips offer "Air bersih + pembuangan" and "Air kotor / pembuangan", history shows
"Saluran pembuangan ruko", screen 07 shows a `Pralon PVC D` card with size `3"–4" ?`, yet wastewater
engineering is future scope.
**Proposed default:** Accept and **record** the wastewater requirement (so the user is heard and the
data reaches market intelligence), then state plainly that full wastewater recommendation is not yet
available and offer the technical team. Clean-water portions of a mixed request are still answered.
The chips stay in the UI exactly as designed.

### OQ-18 — (33h #5) Mascot artwork provenance and Pralon brand assets

**Status:** open · **Blocks:** 3 (mascot ships with onboarding/welcome) · _legal/brand_
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

**Status:** open · **Blocks:** 10 (and OQ-15 depends on it)
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

| ID    | Decision                                                                                                                                   | Decided by | Date       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ---------- |
| OQ-02 | Database `snouty` on `192.168.1.136`, user `ict`. Read-only inspection completed; `snouty` is empty. Raised OQ-34 and OQ-35 as follow-ups. | owner      | 2026-09-30 |
| OQ-01 | Partially answered — `snouty` DB confirmed empty; existence of an old codebase elsewhere still open.                                       | owner      | 2026-09-30 |
