# SNOUTY — Phase 0 Proposal

Last updated: 2026-09-30 · Author: Claude Code · Status: **awaiting review (Phase 0a checkpoint)**

This document proposes the technical shape of SNOUTY before any code is written. It is a proposal, not
a decision: everything here is open to your correction, and every point I could not decide myself is
recorded in `docs/OPEN_QUESTIONS.md` rather than assumed silently.

**What I inspected to write this** (Phase 0a, items P0a-01 → P0a-04):

- This repository: no commits, no source, no `docs/`. Only the Claude Design bundle, now relocated to
  `design-input/handoff/` per SPEC §33a.
- No old codebase exists (`/Users/f/Documents/pralon/snouty/` is an empty directory) — see OQ-01.
- The full design bundle, in SPEC §33a priority order: the newer `SNOUTY Prototype.dc.html` (1,779
  lines, read in full including its 730-line logic block), the handoff `README.md`,
  `SNOUTY Mascot.dc.html`, `SNOUTY Laporan Rekomendasi.dc.html`, the 14-screen board in both themes,
  and the standalone onboarding wizard. I extracted the complete light→dark token mappings from both
  dark files programmatically rather than by eye.
- MySQL at `192.168.1.136:3306`: **reachable** (TCP connect succeeded) but **not inspected** — no
  database name or credentials were supplied, and SPEC §17 forbids guessing them. P0a-04 is therefore
  blocked on **OQ-02**; nothing was written to or read from the server.

---

## 1. Monorepo structure

pnpm workspaces, matching SPEC §32 with three additions marked `+`.

```text
snouty/
├── apps/
│   ├── web/                    Next.js 15 App Router (customer app + /internal back-office)
│   ├── api/                    NestJS 11 (HTTP + SSE)
│   └── worker/               + NestJS standalone app: RabbitMQ consumers only
├── packages/
│   ├── shared-types/           Provenance, RequirementState, SSE events, error codes, DTO schemas
│   ├── config/                 eslint, tsconfig, prettier, tailwind preset
│   ├── ui/                     design tokens + shared React components (mascot, provenance tags)
│   └── engineering/          + the deterministic rule engine — pure TS, zero I/O, zero framework
├── evals/                      golden dataset + eval runner
├── docs/
├── design-input/
│   ├── handoff/                the Claude Design bundle, unedited
│   └── DESIGN_DECISIONS.md     (to be created by you)
├── .claude/
│   ├── CLAUDE.md
│   └── skills/
├── docker/
├── docker-compose.yml
└── pnpm-workspace.yaml
```

**Why `apps/worker` is separate from `apps/api`.** SPEC §21 requires API instances to stay stateless
and horizontally scalable behind Nginx. Queue consumers have a different scaling profile (long jobs,
Chromium for PDF, no inbound traffic) and must not be duplicated once per API replica. They share all
domain modules by importing them; only the transport differs.

**Why `packages/engineering` is a package, not an API module.** SPEC §8 requires the engine to be
deterministic, unit-testable, versioned, and auditable. Making it a framework-free package with no
database access makes that structurally true rather than merely intended: it *cannot* call the LLM or
the catalog, because neither is on its dependency graph. `apps/api` composes it with data; the eval
runner and the future rule-validation back-office import the same package.

---

## 2. Backend module boundaries

```text
apps/api/src/
├── modules/
│   ├── auth/                 JWT access+refresh, guest sessions, guest→account linking
│   ├── users/                accounts, internal roles
│   ├── onboarding-consent/   consent records (location, guest-chat analytics) + policy version
│   ├── conversation/         conversations, messages, status, titles
│   ├── context/              Requirement State Manager (SPEC §6)
│   ├── policy/               Policy Engine — entitlements, Pralon-only, scope routing, provenance gate
│   ├── ai/                   LLMService abstraction, prompts, structured extraction, model routing
│   ├── product-catalog/      products, sizes, specs, catalog versions, import
│   ├── product-knowledge/    structured lookup + retrieval orchestration
│   ├── pricing/              (only if OQ-03 = yes) versioned price lists
│   ├── recommendation/       orchestrates the pipeline, persists results
│   ├── engineering/          thin adapter over packages/engineering (rule registry, traces)
│   ├── material-estimator/   BOM rows + calculation basis
│   ├── schematic/            topology builder
│   ├── report/               report assembly + PDF job dispatch
│   ├── technical-handoff/    "Kirim ke tim teknis Pralon" + internal queue
│   ├── uploads/              floor-plan attachments
│   ├── feedback/             thumbs up/down per answer
│   ├── email-intelligence/   (Phase 11)
│   ├── market-intelligence/  (Phase 12)
│   └── admin/                back-office aggregation
├── shared/                   database, redis, rabbitmq, logging, errors, security, correlation-id
└── infrastructure/           mysql, qdrant, llm providers, queue, integrations, pdf
```

**Dependency direction, enforced by lint rule, not by convention:**

```
presentation → application → domain
modules → shared → infrastructure          (never the reverse)
recommendation → { context, engineering, product-catalog, material-estimator, schematic }
policy → (nothing)                          policy must be a leaf so it can never be bypassed
engineering → packages/engineering only     never ai/, never product-catalog
ai → (nothing domain)                       ai is a service, not a decision-maker
```

`policy` being a leaf is deliberate. Every capability check is a pure function over
`(actor, capability, requirementState)` with no I/O, which is what makes the §31 test "guest cannot
access advanced capabilities via API even if the UI is bypassed" cheap to write and impossible to
forget.

---

## 3. MySQL schema boundaries

One database per environment, one logical schema, table prefixes by bounded context. No cross-context
foreign keys except through explicitly named owner columns.

| Context | Tables |
|---|---|
| identity | `users`, `user_roles`, `refresh_tokens`, `guest_sessions`, `consents` |
| conversation | `conversations`, `messages`, `requirement_snapshots`, `conversation_events` |
| catalog | `catalog_versions`, `products`, `product_sizes`, `product_specs`, `product_compatibility`, `product_documents`, `product_images` |
| pricing *(conditional)* | `price_lists`, `price_list_items` |
| engineering | `engineering_rules`, `engineering_rule_versions`, `rule_validations`, `calculation_traces` |
| recommendation | `recommendations`, `recommendation_systems`, `recommendation_products`, `bom_items`, `assumptions`, `schematics` |
| report | `reports`, `report_jobs` |
| handoff | `technical_handoffs`, `handoff_events` |
| ops | `audit_logs`, `llm_calls`, `job_runs`, `feedback` |
| email *(Phase 11)* | `emails`, `email_analyses`, `email_drafts`, `leads` |
| market *(Phase 12)* | `market_events`, `market_aggregates` |

Three schema decisions worth flagging now:

**Provenance is stored per value, not per row.** Anywhere a user-visible value exists —
`requirement_snapshots`, `recommendation_systems`, `bom_items` — it carries a sibling
`*_provenance` enum column and a `*_source` column. Columns, not a JSON blob, so the §31 policy test
"a `REQUIRES_DOMAIN_VALIDATION` rule never produces `VERIFIED`" can be asserted in SQL as well as in
code.

**`calculation_traces` is the backing store for the UI.** The "DASAR PERHITUNGAN" column in the BOM and
the "Tampilkan detail teknis" disclosure on screen 06 are rendered *from* trace rows
(`rule_id`, `rule_version`, inputs, output, provenance), never from prose an LLM wrote. That is what
makes SPEC §8's auditability visible to the user instead of merely logged.

**`requirement_snapshots` is append-only.** Each user edit or clarification answer writes a new
snapshot rather than mutating one. This gives the "Perbaiki asumsi ini → recalculate" flow a free undo
path, and gives evals a real corpus of state transitions.

---

## 4. ORM and migration tooling — recommendation

**Recommendation: Drizzle ORM + drizzle-kit.** Runner-up: Prisma.

SPEC §17 asks me to weight this decision toward *migration safety on a shared database*. That single
constraint decides it:

| Concern on a shared, non-disposable MySQL | Drizzle | Prisma | TypeORM |
|---|---|---|---|
| Migrations are plain reviewable `.sql` you read before applying | **yes, always** | generated, but `migrate dev` authors and applies in one step | TS files; SQL not obvious |
| Requires a **shadow database** (creating/dropping a DB on the server) | **no** | yes for `migrate dev` — must be redirected to a throwaway container | no |
| Has a command that can reset/drop the schema | **no** | yes (`migrate reset`) | `synchronize: true` silently alters schema |
| Read-only introspection of an existing schema | `drizzle-kit pull` | `db pull` | `schema:log` |
| Runtime overhead / query transparency | thin, SQL-shaped | heavier engine | moderate |

Prisma's shadow-database requirement is the disqualifier. On infrastructure explicitly described as
"shared — not disposable", a default workflow that wants to create and drop a database is the wrong
default, even though it can be redirected. TypeORM's `synchronize` flag is a worse version of the same
hazard. Drizzle has no command that can destroy a schema, which means the §17 rule "never DROP
DATABASE, reset schema, uncontrolled TRUNCATE, or force-reset" is enforced by the tool's absence of
capability rather than by my discipline.

Proposed workflow, with the approval gate SPEC §17 requires built in:

1. Edit the TypeScript schema in `packages/shared-types` / `apps/api`.
2. `pnpm db:generate` → writes a numbered `.sql` file to `drizzle/`. **Nothing touches the server.**
3. The `.sql` is committed and reviewed in the PR. Every migration ships with a hand-written
   `down.sql`.
4. Integration tests apply it against a **disposable MySQL container** (never `192.168.1.136`).
5. Applying to a real environment is a separate, explicit command that refuses to run without
   `MIGRATION_APPROVED=1`, prints the SQL and the target host, and requires a confirmed recent backup.
   I will never run it without asking you first.

Trade-off I want to be explicit about: Drizzle has a smaller ecosystem than Prisma and no equivalent of
Prisma Studio. If you would rather have Prisma's tooling and accept pointing `shadowDatabaseUrl` at a
local container, say so and I will switch — the schema design above is ORM-independent.

---

## 5. Database environments and connection strategy

| Environment | Database | Host |
|---|---|---|
| local dev | `snouty_dev` | `192.168.1.136` (shared) |
| staging | `snouty_staging` | `192.168.1.136` (shared) |
| production | `snouty` | `192.168.1.136` (shared) |
| CI / integration tests | `snouty_test` | **disposable container only**, never the shared host |

Least-privilege users, to be created by you (I will not create them):

| User | Grants |
|---|---|
| `snouty_app` | `SELECT, INSERT, UPDATE, DELETE` on its database — **no DDL, no DROP** |
| `snouty_migrator` | `CREATE, ALTER, INDEX, REFERENCES` + the above; used only by an approved migration run |
| `snouty_ro` | `SELECT` only — for the P0a-04 inspection and for read replicas later |

Connection: a single pooled connection per process (`DB_POOL_MAX`, default 10 for API, 5 for worker),
created in one `DatabaseModule` and injected. No module opens its own connection. On connection
failure the API returns a stable `SERVICE_UNAVAILABLE` error code and `/health` reports
`{ db: "down" }` rather than throwing raw driver errors at the client. All access goes through
repositories; no raw SQL outside `infrastructure/mysql`.

**To unblock P0a-04 I need `snouty_ro` credentials and the database name (OQ-02).** I will run only
`SHOW TABLES` / `SHOW CREATE TABLE` / `information_schema` queries and report what exists.

---

## 6. Context Engine design

The prototype keeps a flat `req { type, floors, bath, basin, kitchen, source, install }` of bare
strings. That is insufficient: SPEC §6 requires every field to carry provenance and source, and board
screen 03 needs two fields the prototype has no slot for (see OQ-23).

Proposed field shape — every requirement field is a `TrackedValue`, never a bare scalar:

```ts
type Provenance = 'VERIFIED' | 'ASSUMED' | 'ESTIMATED' | 'UNAVAILABLE';
type FieldSource = 'user_stated' | 'user_edited' | 'default_applied' | 'inferred';

interface TrackedValue<T> {
  value: T | null;
  provenance: Provenance;
  source: FieldSource;
  reason?: string;        // required when provenance is ASSUMED — this is the assumptions-card copy
  ruleId?: string;        // set when a default came from a rule, for traceability
  updatedAt: string;
}

interface RequirementState {
  version: number;                       // increments per snapshot; append-only
  intent: Intent;
  building: {
    type: TrackedValue<BuildingType>;
    floors: TrackedValue<number>;
    floorHeightM: TrackedValue<number>;  // 3.5 default → ASSUMED, rule ENG-004
    dimensions: TrackedValue<Dimensions>;
  };
  fixtures: {
    bathrooms: TrackedValue<number>;
    basins: TrackedValue<number>;
    kitchens: TrackedValue<number>;
    outletCount: TrackedValue<number>;   // board screen 03 asks this directly
  };
  water: {
    source: TrackedValue<WaterSource>;
    installationType: TrackedValue<InstallationType>;
    boosterPump: TrackedValue<boolean>;  // board screen 03 asks this directly
  };
  missingInformation: FieldPath[];       // derived, never stored
  completeness: { filled: number; required: 4 };  // drives the 4-segment meter
}
```

Flow:

```
message ──► IntentRouter ──► (extraction needed?) ──► LLM extractStructured ──► zod validate
                                                            │ invalid → retry once with the error
                                                            │ still invalid → clarification question
                                                            ▼
                                              ContextMerger.merge(current, extracted)
                                                            ▼
                                              new RequirementSnapshot (append-only)
                                                            ▼
                                              CompletenessEvaluator → missing fields
```

Merge rules, in precedence order: `user_edited` > `user_stated` > `inferred` > `default_applied`. A
default never overwrites anything a user said; a new user statement always overwrites a default and
resets that field's provenance. Explicit nulls ("saya tidak punya dapur") are distinguishable from
absent.

**Requirement edits and follow-up mutations call no LLM at all.** Screen 04's inline edit and the
"tambah kamar mandi" follow-up both go straight to `ContextMerger` → recalculation. This is the
selective-execution rule from SPEC §23 and it is the single biggest cost saving in the system.

Storage split: Redis holds the active snapshot for fast turn-by-turn reads
(`snouty:ctx:{conversationId}`, TTL 24 h); MySQL is written through on every snapshot, so Redis can be
flushed at any time without data loss. Redis is a cache, never the source of truth.

---

## 7. Policy Engine and entitlements

Pure, synchronous, no I/O — a leaf module. One entry point:

```ts
interface PolicyDecision {
  allowed: boolean;
  code?: PolicyCode;        // stable, client-renderable
  reason?: string;
  route?: 'SUPPORTED' | 'TECHNICAL_VALIDATION_REQUIRED' | 'NOT_YET_SUPPORTED';
}

policy.evaluate(actor: Actor, capability: Capability, ctx?: RequirementState): PolicyDecision
```

Five policies from SPEC §5, each a separate object with its own test file:

1. **PralonOnlyPolicy** — competitor mentions are allowed as context; competitor *products* can never
   enter a recommendation. Enforced at the response-assembly boundary, not only in the prompt: the
   product list is filtered against the catalog, so a hallucinated competitor SKU cannot survive even
   if a prompt is jailbroken.
2. **NoHallucinationPolicy** — any value without a catalog record or a validated rule is
   `UNAVAILABLE`, rendered as "Lihat dokumen teknis". Never a guess.
3. **RecommendationBoundaryPolicy** — routes industrial / out-of-range scenarios to
   `TECHNICAL_VALIDATION_REQUIRED` (screen 11).
4. **ProvenancePolicy** — the hard gate: a rule whose status is `REQUIRES_DOMAIN_VALIDATION` cannot
   emit `VERIFIED`. Implemented as a single function every engine output passes through, so there is
   exactly one place to test and no way around it.
5. **ScopeRoutingPolicy** — clean water supported; wastewater recorded but `NOT_YET_SUPPORTED`
   (OQ-17); industrial validated.

Entitlements come from one table that is the **single source for both the API guard and the onboarding
step-5 benefit list** (SPEC §33e explicitly requires the UI to be generated from it so the two cannot
drift):

```ts
const ENTITLEMENTS: Record<Capability, Tier[]> = {
  PRODUCT_QA:            ['guest', 'registered', 'advanced'],
  RECOMMENDATION:        ['guest', 'registered', 'advanced'],
  CLARIFICATION:         ['guest', 'registered', 'advanced'],
  TECHNICAL_HANDOFF:     ['guest', 'registered', 'advanced'],
  CONVERSATION_HISTORY:  ['registered', 'advanced'],
  SAVE_SOLUTION:         ['registered', 'advanced'],
  CASE_ANALYSIS:         ['advanced'],
  MATERIAL_BOM:          ['advanced'],
  SCHEMATIC:             ['advanced'],
  REPORT_PDF:            ['advanced'],
};
```

This follows the onboarding promise rather than the prototype's guest-sees-everything behaviour — see
OQ-15, which is the most consequential open question in this document, because it decides whether the
flagship screen 06 is reachable without an account.

---

## 8. Provenance model

`Provenance` lives in `packages/shared-types` and is the only vocabulary the UI understands.

| Value | May be produced by | Renders as |
|---|---|---|
| `VERIFIED` | a catalog record, or a rule whose validation status is `VALIDATED` | green "TERVERIFIKASI" `#1E7A4C` on `#E8F5EC` |
| `ASSUMED` | a default rule, a "Belum tahu" answer | amber "ASUMSI" + a mandatory entry in the assumptions card |
| `ESTIMATED` | a quantity derived without real dimensions | amber "DIESTIMASI" / "ESTIMASI · DIMENSI BELUM LENGKAP" |
| `UNAVAILABLE` | a null catalog field | grey dashed, "Lihat dokumen teknis", **no value rendered** |

Two rules make this structural rather than aspirational:

- The shared `<ProvenanceTag>` component is the *only* way to render a status tag, and it takes a
  `Provenance` — there is no prop that lets a caller pass the string "TERVERIFIKASI" directly.
- Per SPEC §33i, the tag always carries text, never colour alone.

Given OQ-06 is unresolved, **every sizing value in the system will render as `ASSUMED` today.** That is
correct and honest, but it means screen 06 will look amber-heavy until a domain expert validates the
rules. I would rather show you that now than have it surprise you at the Phase 6 demo.

---

## 9. LLM abstraction and model routing

```ts
interface LLMService {
  chat(req: ChatRequest): Promise<ChatResponse>;
  stream(req: ChatRequest): AsyncIterable<ChatChunk>;
  extractStructured<T>(req: ExtractRequest<T>): Promise<T>;   // schema-validated, retries once
}
```

`OpenRouterProvider` implements it first; nothing in `modules/` imports OpenRouter types. Every call
writes an `llm_calls` row: model, tokens in/out, latency, estimated cost, correlation id, conversation
id, and the routing reason. That is what funds the cost dashboard in SPEC §31b and lets us answer "why
did this conversation cost 4× the median".

| Task | Tier | Env var |
|---|---|---|
| Product FAQ, conversation title | fast | `LLM_MODEL_FAST` |
| Product knowledge answers, requirement extraction, clarification wording | balanced | `LLM_MODEL_BALANCED` |
| Ambiguous or complex input, retry after a validation failure | strong | `LLM_MODEL_STRONG` |
| **Any engineering calculation** | **none — no LLM call is made** | — |

Routing is a pure function of intent + a complexity signal, so it is unit-testable and shows up in
evals when it changes. Model IDs are never hardcoded.

---

## 10. SSE event contract

One endpoint, `POST /api/conversations/:id/messages` returning `text/event-stream`. Nginx must set
`proxy_buffering off` on this route (SPEC §21). Chat never goes through RabbitMQ (SPEC §19).

```ts
type SseEvent =
  | { type: 'message.start';    messageId: string }
  | { type: 'stage';            stage: AnalysisStage; status: 'active'|'done'|'failed'; detail?: string }
  | { type: 'token';            text: string }
  | { type: 'requirement.updated'; state: RequirementState }
  | { type: 'card';             card: AssistantCard }   // summary | criteria | unsupported | product | clarification
  | { type: 'solution.ready';   recommendationId: string }
  | { type: 'error';            code: ErrorCode; retryable: boolean; retryAfterSec?: number }
  | { type: 'message.end';      messageId: string; usage: TokenUsage };
```

The five analysis stages are the literal `STEP_LABELS` from the prototype and are emitted as real
pipeline boundaries, not timers:

| `AnalysisStage` | Label (rendered verbatim) | Emitted when |
|---|---|---|
| `UNDERSTANDING` | Memahami kebutuhan | extraction + merge complete |
| `ANALYZING_INSTALLATION` | Menganalisis instalasi | engineering rules evaluated |
| `MATCHING_PRODUCTS` | Mencocokkan produk Pralon | catalog matching complete |
| `COMPOSING` | Menyusun rekomendasi | recommendation assembled + persisted |
| `PREPARING_SCHEMATIC` | Menyiapkan skema | topology built |

`stage: failed` is what drives the design's failure card ("Gagal menyusun rekomendasi" + "Coba lagi" /
"Kembali ke percakapan"); because the requirement snapshot is already persisted, the design's promise
"Kebutuhan Anda tetap tersimpan, jadi tidak perlu mengetik ulang" is literally true rather than
copy. Board screen 05 additionally shows per-step detail ("6 DATA · SELESAI", "RISER + 2 LANTAI ·
SELESAI") — that is the `detail` field.

Errors use stable codes (`RATE_LIMITED`, `VALIDATION_FAILED`, `CATALOG_UNAVAILABLE`,
`LLM_UNAVAILABLE`, `NOT_ENTITLED`, `SERVICE_UNAVAILABLE`) mapped to mascot moods and Indonesian copy in
one table, so no component invents an error message.

---

## 11. RabbitMQ worker boundaries

Everything async and nothing else. Topic exchange `snouty.events`, one durable queue per consumer,
each with a DLQ and a retry queue (exponential backoff, max 5 attempts).

| Queue | Trigger | Idempotency key |
|---|---|---|
| `report.generate` | user requests a PDF | `reportId` |
| `handoff.deliver` | "Kirim ke tim teknis Pralon" | `handoffId` |
| `catalog.ingest` | catalog import uploaded | `catalogVersionId + rowHash` |
| `document.embed` | a technical document is added (only once Qdrant is adopted) | `documentId + chunkIndex` |
| `email.process` | n8n webhook (Phase 11) | `messageId` |
| `market.aggregate` | scheduled + on conversation close (Phase 12) | `eventId` |
| `notification.send` | any of the above | `notificationId` |

Every consumer is idempotent (insert-or-ignore on the key), every job writes a `job_runs` row so the UI
can poll status, and no consumer is on the chat request path. Explicitly **not** queued: chat
messages, requirement extraction, engineering calculation, product matching — all synchronous, all
streamed.

---

## 12. Redis usage

Cache and coordination only. Never the source of truth (SPEC §18).

| Key | Purpose | TTL |
|---|---|---|
| `snouty:ctx:{conversationId}` | active requirement snapshot | 24 h |
| `snouty:guest:{sessionId}` | guest session + consent flags | `GUEST_SESSION_TTL` |
| `snouty:rl:{tier}:{actorId}:{window}` | rate-limit counters | window |
| `snouty:job:{jobId}` | job status for UI polling | 1 h after completion |
| `snouty:idem:{key}` | idempotency guard | 24 h |
| `snouty:lock:{resource}` | distributed lock (catalog import, report generation) | 60 s, auto-renew |
| `snouty:cache:product:{id}` | catalog read cache, invalidated on catalog version bump | 1 h |

Rate limits per SPEC §22 — guest low, registered medium, advanced high, internal separate; limited
dimensions are messages/hour, tokens/day, concurrent streams, and advanced-case / schematic / report /
upload counts per day. A breach returns the `RATE_LIMITED` code with `retryAfterSec`, which the UI
renders with the "Maaf" mascot mood.

---

## 13. Qdrant adoption criteria

**Not adopted in Phase 0–1, and probably not in Phase 2.** SPEC §10 says "only when semantic retrieval
is actually needed", so here is the concrete test I propose for "needed":

Adopt Qdrant when **all** of these hold:
1. There are ≥ 50 unstructured technical documents (datasheets, manuals, SOPs) that are not
   representable as catalog columns.
2. A measured ≥ 10% of real product questions cannot be answered by a deterministic MySQL query.
3. Those questions are demonstrably semantic (paraphrase, synonym, conceptual), not just missing
   catalog columns — because if a column is missing, the fix is to add the column, not to embed a PDF.

Until then, "Ada ukuran 3/4 inch?" is a `SELECT`, and that is both faster and more truthful. The
retrieval interface is defined from day one (`KnowledgeRetriever`) with a MySQL-backed implementation,
so adopting Qdrant later is adding an implementation, not a refactor. Retrieved text is always treated
as untrusted input and never concatenated into a prompt without delimiters and an explicit instruction
that it is data, not instructions.

---

## 14. PDF generation

**Recommendation: Playwright + headless Chromium in the `report.generate` worker, rendering the same
report template the web app renders.**

The design's report (`SNOUTY Laporan Rekomendasi.dc.html`) is a precise two-page A4 HTML/CSS document.
Any library-based approach (pdfkit, jsPDF, react-pdf) would mean rebuilding that layout in a second
rendering model and letting the two drift. Chromium prints the CSS we already wrote, including
`@page` margins, the title block, and the signature block.

- The worker fetches `/internal/report/:id/print` from the API with a short-lived signed token; the
  page is server-rendered from **stored recommendation data only** — the LLM is never re-consulted at
  report time (SPEC §33g).
- Report numbers use the designed format `SNTY-YYYY-MM-NNNN`, allocated from a per-month counter row
  with a unique constraint so concurrent requests cannot collide.
- Price columns render only when `PRICING_ENABLED=true` (OQ-03). Tax rate from `TAX_RATE_PERCENT`; the
  design's report component already parameterises it.
- Failure emits the designed state: "Laporan gagal diunduh" → "Unduh ulang" / "Kirim ke email".
- Chromium lives in the worker image only, so the API image stays small.

---

## 15. Design token implementation plan

`packages/ui` owns tokens once: CSS custom properties on `:root` and `[data-theme="dark"]`, plus a
Tailwind preset that maps them to utility names. No component hardcodes a hex value; lint forbids raw
hex in `apps/`.

I extracted the complete light→dark mapping programmatically from both dark files rather than
transcribing it. Sample of the 60-entry prototype map (full table goes into `DESIGN_IMPLEMENTATION.md`
in Phase 0b):

| Light | Dark (prototype) | Role |
|---|---|---|
| `#F7F8F7` | `#0F1213` | app canvas |
| `#FFFFFF` | `#171B1D` | surface |
| `#FBFCFB` | `#1B2022` | subtle surface |
| `#DDE2E1` | `#343B3E` | input/button border |
| `#E6EAE9` | `#2A3033` | card border |
| `#EFF2F1` | `#23292B` | hairline |
| `#14181A` | `#ECEFEE` (text) / `#2B3236` (user bubble bg) | ink |
| `#1E7A4C` / `#E8F5EC` | `#62C48F` / `#15291E` | verified |
| `#8A5300` / `#FDF3E3` | `#E4B56C` / `#2B2210` | assumption |
| `#B02414` | `#F4806E` | brand text |
| `#DF301C` | `#DF301C` (**fill only**, unchanged) | brand action |

Semantic guard rails encoded as token *names*, not just values, so misuse is visible in review:
`--action-*` (brand red), `--verified-*` (green), `--assumed-*` (amber). There is no `--button-green`
token to reach for.

Also in scope for `packages/ui` at Phase 0e: the type scale (IBM Plex Sans 400/500/600/700, IBM Plex
Mono 400/500, self-hosted via `next/font`), the spacing rhythm, radii, shadows, the focus ring
(`0 0 0 3px rgba(223,48,28,.14)` + `#DF301C` border), the fixed metrics (sidebar 236px, header 52px —
right panel per OQ-25), a `prefers-reduced-motion` reset the prototype lacks, and a `/tokens` preview
page so you can eyeball both themes.

---

## 16. Mascot mood mapping

One pure function, unit-tested, with the mood derived from system state only — the LLM never picks a
mood (SPEC §33f).

```ts
function moodFor(s: SystemState): Mood
```

| Condition (evaluated in order) | Mood |
|---|---|
| a system error is showing | `fail` — once, then hold the final frame |
| rate limited, connection lost, or data absent from the catalog | `sorry` |
| the message was not understood → clarification | `confused` |
| technical validation / out of scope | `focus` |
| an edit caused a large change, or an unexpected scenario | `surprised` |
| analysis stage ∈ {UNDERSTANDING, ANALYZING_INSTALLATION} | `think` |
| analysis stage ∈ {MATCHING_PRODUCTS, COMPOSING, PREPARING_SCHEMATIC}, or recalculating after an edit | `write` |
| solution ready, report downloaded | `happy` |
| feedback given, solution saved, registration succeeded | `thanks` |
| showing a tip or the neutral-criteria card | `wink` |
| light loading / maintenance tip | `drip` |
| welcome idle ≥ 15 s with an empty composer, or offline | `sleep` |
| greeting a returning named user | `greet` |
| an empty list (history, saved solutions, no results) | `peek` |
| otherwise | `idle` |

The two rules the mascot sheet states explicitly are encoded as tests: `fail` is **never** returned for
out-of-scope (that is `focus`) or for missing data (that is `confused`). `greet` and `peek` come from
the mascot sheet and are not in SPEC §33f's table — see OQ-30. With `prefers-reduced-motion`, every
mood resolves to its static frame.

---

## 17. Testing, evaluation, and CI strategy

**Test pyramid, weighted where SPEC §31 says the risk is:**

| Layer | Scope | Target |
|---|---|---|
| unit | `packages/engineering` (every rule, every version), policy objects, `ContextMerger`, `moodFor`, provenance gate | ≥ 95% on engineering + policy |
| contract | zod schemas for every LLM structured output; SSE event shapes | every schema |
| integration | repositories + pipeline orchestration against a **disposable MySQL container** | main paths |
| component | provenance rendering in both themes, mascot moods, reduced motion | every provenance state |
| e2e | the consultation flow: welcome → clarification → analysis → solution → report | 1 happy path + 3 failure paths |

Three policy tests SPEC §31 names explicitly get their own file and are treated as release blockers: a
competitor question never yields a competitor card; a `REQUIRES_DOMAIN_VALIDATION` rule never produces
`VERIFIED`; a guest cannot reach an advanced capability through the API even with the UI bypassed.

**Evals** (`evals/`): a golden dataset of Indonesian messages with expected intent, extracted
requirement, missing fields, and policy outcome. The seed set comes from the design itself — the
2-storey house, the competitor question, the 70 °C factory line, "Belum tahu" answers, requirement
edits, the wastewater mention, and the five `EXAMPLES` strings the prototype defines but never renders
(OQ-20). Scored per field, not just overall, and run in CI whenever prompts, schemas, or routing
change.

**CI** (GitHub Actions pending OQ-09) on every PR: install → lint → typecheck → unit → integration
(containerised MySQL) → policy + engineering suites → build `web` and `api`. Evals run conditionally on
AI-file changes. **CI never connects to `192.168.1.136`** — enforced by asserting the DB host in the
test bootstrap, not just by configuration.

---

## 18. Security and privacy strategy

**Security (SPEC §30).** Every DTO and every LLM output validated with zod at the boundary; JWT access
+ refresh with refresh tokens in `httpOnly`, `Secure`, `SameSite=Lax` cookies and rotation on use;
role-based guards on all `/internal/*` routes with every write audit-logged; Redis-backed distributed
rate limiting; uploads (the "Lampirkan denah" flow) restricted by MIME type and size, stored outside
the web root with generated names, never served from the app origin. Retrieved documents and inbound
emails are treated as untrusted data — delimited, labelled as data, never as instructions — and system
prompts are never echoed to the client. Secrets come from env only; `.env` is gitignored and
`.env.example` carries empty values.

**Privacy (SPEC §30b / UU No. 27/2022).** Consent is a server-side row with a timestamp and a policy
version, not a `localStorage` flag (OQ-19). Location is city-level, optional, and used only for
regional demand analysis — the onboarding copy promises this explicitly, so the code path from location
to recommendation simply does not exist. Retention per data type (OQ-13), with market-intelligence data
anonymised and aggregated before it leaves the conversation context. Reports contain personal data and
are owner-plus-authorised-role only. Before Phase 11 I will propose a redaction step for customer email
content sent to OpenRouter, since that is the highest-exposure path in the system. Export and deletion
endpoints for registered users ship with Phase 3.

---

## 19. Performance strategy

Selective execution is the whole strategy (SPEC §23). The pipeline is not a pipeline — it is five
independent paths chosen by the intent router:

| Request | Path | LLM calls |
|---|---|---|
| product FAQ | policy → MySQL/retrieval → explain → SSE | 1 (fast) |
| product lookup | policy → MySQL → explain | 1 (fast) |
| recommendation | extract → context → engineering → match → explain | 2 (balanced) |
| advanced case | extract → clarify → engineering → match → BOM → schematic → explain | 2–3 |
| **requirement edit / mutation** | **context → engineering → match → BOM → schematic** | **0** |

Supporting measures: stream the first token before the pipeline finishes; cache catalog reads in Redis
keyed by catalog version; batch product lookups to kill N+1 in the matcher; index on the real query
shapes (`products(family, category, status)`, `product_sizes(product_id, size)`,
`conversations(owner_id, updated_at)`); keep engineering pure so it is microseconds, not milliseconds;
and push every heavy job to RabbitMQ. Budgets to hold ourselves to: first token < 1.5 s p95, full
recommendation < 8 s p95, requirement-edit recalculation < 300 ms p95 (it makes no network call).

---

## 20. Proposed implementation order

Unchanged from SPEC §49 with three sequencing notes:

1. **Phase 1 (Catalog) genuinely must be first.** Every later phase needs real product rows; matching,
   BOM, schematic, and report all read from it. Phase 1 cannot start without OQ-02 (DB access) and
   OQ-07 (catalog source).
2. **Phase 6 (Engineering rules) is gated on OQ-06,** the domain expert. The engine can be built and
   tested without them — but until someone validates the rules, nothing renders as TERVERIFIKASI and
   the product looks less confident than the design implies. If the expert is slow to appear, I would
   rather know now and set expectations than discover it at the Phase 7 demo.
3. **Dark mode, mobile, and accessibility are built inside each phase,** never deferred to Phase 13.
   Phase 13 is an audit, not a construction phase.

Immediately after your approval of this checkpoint, Phase 0b writes the nine core docs; the only one
that will contain a real gap is `DATABASE.md`, pending OQ-02.

---

## 21. Summary of what I need from you

| Need | Why | Question |
|---|---|---|
| Read-only MySQL credentials + database name | to finish P0a-04 at all | **OQ-02** |
| Guest vs. registered entitlement decision | decides whether screen 06 needs an account | **OQ-15** |
| Pricing in or out of scope | decides BOM and report shape | **OQ-03** |
| Name of the Pralon domain expert | without it nothing is ever TERVERIFIKASI | **OQ-06** |
| Catalog source | Phase 1 cannot start without it | **OQ-07** |
| Git remote | decides the CI pipeline file | **OQ-09** |
| Approval of the Drizzle recommendation | shapes every migration from here on | §4 above |

Everything else has a proposed default in `docs/OPEN_QUESTIONS.md` and will not block progress.
