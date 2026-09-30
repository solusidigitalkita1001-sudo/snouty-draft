# SNOUTY — Master Specification for Claude Code (v2)

> Save this file in the repository as `docs/SPEC.md`.
> It is the master specification. Read it in full before doing anything.

---

# 0. How To Work With This Document

This project is at the **planning / early implementation stage**.

Do NOT generate the whole application.

Work strictly in the phases and checkpoints defined in Section 50.
At every checkpoint marked **STOP**, stop and wait for my review.

At the start of **every session**:

1. Read `docs/SPEC.md` (this file).
2. Read `docs/PROGRESS.md`.
3. Read `design-input/DESIGN_DECISIONS.md` if it exists.
4. Tell me the current phase, the last completed item, any blockers, and the next item you plan to work on.

At the end of **every session** (or after finishing any checklist item), update `docs/PROGRESS.md` as described in Section 51, and commit following Section 26b.

If anything in this spec is ambiguous or conflicts with the design, do NOT resolve it yourself. Add it to `docs/OPEN_QUESTIONS.md` with a proposed default and which phase it blocks, then continue with non-blocked work.

---

# 1. Project Context

I am rebuilding an existing product called **SNOUTY** from scratch.

SNOUTY is an **AI Pipe Solution Assistant for Pralon**.

Previous version (fill in before starting):

```text
Old codebase available:          <yes/no — path or repo URL>
What was wrong with the old one: <short notes>
Data/users to migrate:           <none / describe>
Existing `snouty` DB contents:   <empty / has old tables — list if known>
```

Business information (fill in; if blank, treat as an open question):

```text
Product catalog source:        <Excel / ERP / PDF catalog / other>
Pralon domain expert(s):       <name/role who validates engineering rules>
Premium tier:                  <paid / free-with-account / undecided>
Pricing in scope:              <yes / no / undecided>
Price data source:             <distributor price list / ERP / none>
Technical team handoff target: <email address / CRM / ticket system>
Technical team SLA:            <e.g. 1×24 jam kerja — shown in UI>
UI & response language:        Bahasa Indonesia (primary) <+ English?>
Expected scale:                <users/day, concurrent users>
LLM budget:                    <per month or per conversation>
Hosting:                       <on-prem / cloud — which>
Git remote:                    <GitHub / GitLab / other — URL>
```

---

# 2. Product Vision

SNOUTY is not a generic chatbot. It combines:

- Product Knowledge Assistant
- Technical Sales Assistant
- Pipe Solution Assistant
- Product Recommendation Engine
- Market Intelligence Platform

Non-technical users describe their needs naturally, e.g.:

> "Saya mau bangun rumah 2 lantai, ada 3 kamar mandi, 4 wastafel, 1 dapur, dan toren di atas. Saya butuh pipa apa saja?"

SNOUTY should eventually: understand natural language, detect intent, extract structured requirements, preserve conversation context, detect missing information, ask clarification questions, answer Pralon product questions, recommend suitable Pralon products, perform deterministic engineering analysis, estimate material needs, generate a Bill of Materials, generate a piping schematic, generate a recommendation report, hand off cases to the Pralon technical team, explain recommendations in simple language, analyze incoming sales emails, and generate market intelligence.

Brand persona (from the design): **Snouty**, an engineer seal wearing a project helmet. Calm, careful, honest about limits, always Pralon, and *never guesses a pipe size*.

---

# 3. Core Principle

**The LLM is NOT the engineering source of truth.**

| Concern | Owner |
|---|---|
| Language understanding, extraction, clarification, explanation | LLM |
| Engineering logic | Deterministic application code |
| Structured product truth | MySQL |
| Prices (if in scope) | MySQL price table, versioned |
| Unstructured technical knowledge | RAG (only when needed) |
| Business rules & entitlements | Policy Engine (code + tests) |
| Schematic | Structured topology |

Never: `User → giant prompt → LLM → answer`

Prefer:

`User → Intent → Policy → Context → Structured Requirement → Deterministic Logic → Product Data → Retrieval (if needed) → AI Explanation → User`

---

# 4. User Types & Entitlements

## 4.1 First-Time Guest
Receives onboarding (Section 33e). Must support: introduction, natural-language usage explanation, Pralon-focus explanation, optional location permission, account/advanced benefits.

## 4.2 Returning Guest
Can use standard capabilities. Guest conversations may be stored internally (analytics, quality, market analysis) **subject to consent and retention rules in Section 30b**. Guests do not see persistent history. Do not show fake disabled history sections unless the design requires it.

## 4.3 Registered User
Conversation history, saved conversations, saved recommendations, saved solutions, advanced case analysis, report download. Can resume previous consultations.

## 4.4 Advanced / Premium
May include: detailed requirement analysis, clarification flow, engineering recommendation, pipe sizing, product matching, BOM, material estimation, schematic generation, saved advanced cases.

If a guest requests an advanced feature:
1. understand the request first
2. preserve the current context (guest session → linked to the new account)
3. offer registration
4. resume the **same** case after registration
5. never force the user to retype

## 4.5 Internal Users (back-office)
Roles: `sales_reviewer`, `technical_team`, `catalog_admin`, `domain_expert`, `admin`. See Section 15b.

## 4.6 Entitlement Matrix
Default proposal, derived from onboarding step 5 of the design. The final version lives in `design-input/DESIGN_DECISIONS.md` and is enforced by the Policy Engine, never only by the UI.

| Capability | Guest | Registered | Advanced |
|---|---|---|---|
| Product knowledge Q&A | ✓ | ✓ | ✓ |
| Pralon product recommendation | ✓ | ✓ | ✓ |
| Clarification flow | ✓ | ✓ | ✓ |
| Conversation history | — | ✓ | ✓ |
| Save solution | — | ✓ | ✓ |
| Case analysis (analisis studi kasus) | — | — | ✓ |
| Material estimation / BOM | — | — | ✓ |
| Schematic | — | — | ✓ |
| Report PDF | — | ? | ✓ |
| Send to technical team | ✓ | ✓ | ✓ |

`?` = open question. Note: the current prototype shows guests the full solution. This is a known conflict (Section 33h).

---

# 5. Product Policies (enforced in code + tests)

## Policy 1 — Pralon Recommendation Only
Allowed: acknowledge competitor questions, explain neutral selection criteria, mention competitor names as context.
Not allowed: recommending competitor products, competitor product cards, redirecting to competitors, comparing brands.
Final recommendations stay within the Pralon ecosystem.

## Policy 2 — No Hallucination
Never invent: product names, SKU, sizes, standards, pressure ratings, specs, compatibility, availability, engineering rules, engineering values, prices.
If information is missing: ask clarification, return insufficient information ("data belum cukup" + offer the technical team), or return a technical validation requirement.

## Policy 3 — Recommendation Boundary
SNOUTY is planning assistance, not engineering certification ("PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS").
- Unsupported / unusual / industrial / insufficient scenarios → `TECHNICAL_VALIDATION_REQUIRED`
- Engineering rules not yet validated → `REQUIRES_DOMAIN_VALIDATION`

## Policy 4 — Value Provenance
Every value shown to the user carries a provenance flag:

```ts
type Provenance = 'VERIFIED' | 'ASSUMED' | 'ESTIMATED' | 'UNAVAILABLE';
```

- `VERIFIED` only when backed by a catalog record or a **validated** engineering rule → renders green "TERVERIFIKASI".
- `ASSUMED` → amber "ASUMSI"; must appear in the assumptions list with a human-readable reason.
- `ESTIMATED` → amber "DIESTIMASI" / "ESTIMASI".
- `UNAVAILABLE` → grey dashed / amber "Lihat dokumen teknis"; no value is shown.

Define this type in `packages/shared-types`. A rule with status `REQUIRES_DOMAIN_VALIDATION` can never produce `VERIFIED` output.

## Policy 5 — Scope Routing
- Clean water residential/small commercial → supported flow.
- Wastewater ("Air bersih + pembuangan", "saluran pembuangan") → behavior defined in `DESIGN_DECISIONS.md` (default: acknowledge, record the requirement, state it is not yet supported for full recommendation, offer the technical team).
- Industrial / factory / large buildings → `TECHNICAL_VALIDATION_REQUIRED` (screen 11).

---

# 6. Conversation Context

Do not rely on raw chat history. Implement a **Context Engine / Requirement State Manager**.

User: "Rumah saya 2 lantai, ada 3 kamar mandi."

```json
{
  "intent": "residential_pipe_recommendation",
  "building": { "type": "residential", "floors": 2 },
  "fixtures": { "bathrooms": 3 },
  "water_source": null,
  "missing_information": ["water_source"]
}
```

User: "Torennya di atas." → merge into the existing state:

```json
{
  "building": { "type": "residential", "floors": 2 },
  "fixtures": { "bathrooms": 3 },
  "water_source": "rooftop_tank"
}
```

Requirements from the design:
- Each field carries value + provenance + source (`user_stated` | `user_edited` | `default_applied` | `inferred`).
- "Belum tahu" applies a default and marks it `ASSUMED`.
- Clarification asks the first missing field in priority order (default from prototype: `water_source → installation_type → floors → bathrooms`, to be validated). One question per turn, with quick-answer chips. Max 4 questions in a grouped clarification card.
- Completeness = filled count of the required fields (the design shows a 4-segment meter "KELENGKAPAN DATA").
- Users can edit fields directly ("Ubah" in the right panel, screen 04). Edits re-trigger deterministic recalculation, not a new LLM extraction.
- Follow-ups that mutate the requirement ("tambah kamar mandi") update state and recalculate BOM/schematic.

Storage separation:
- **MySQL**: durable conversation history, requirement state snapshots, recommendations, saved solutions
- **Redis**: active context, session state, temporary requirement state (define write-through / flush strategy to MySQL)
- **Qdrant**: semantic product/document knowledge only

RAG is not conversation memory.

---

# 7. AI Responsibilities

LLM is used for: NLU, intent detection, requirement extraction, structured output, context interpretation, missing-info detection, clarification wording, retrieval orchestration, summarization, friendly explanation, conversation titles.

LLM is NOT the source of truth for: engineering calculations, product truth, product eligibility, policy enforcement, sizing rules, prices, provenance flags.

All structured outputs are schema-validated. Invalid output → retry once with the validation error, then fall back to a clarification question. Never pass unvalidated LLM output to the Engineering Engine.

---

# 8. Engineering Engine

Deterministic, unit-testable, versioned, auditable, traceable.

Rule categories: fixture demand, pipe/riser/branch sizing, fixture connection size, flow, pressure, elevation, friction loss, fittings, clean water, wastewater (future), material estimation, pump scenarios, tank-on-upper-floor scenarios.

Each rule has: rule ID, version, input, output, source/reference, validation status, validated by, validated at, test cases.

Unknown values → `REQUIRES_DOMAIN_VALIDATION`. Never fabricate.

Every calculation result stores which rule IDs + versions produced it, so the "DASAR PERHITUNGAN" and "Tampilkan detail teknis" sections in the UI are generated from real traces.

---

# 9. Product Knowledge

Structured product data comes from MySQL. Fields (the design requires all of these):

product_id, SKU, product_name, product_family, category, material, diameter, available sizes, standard, pressure_class (tekanan kerja), rod length (panjang batang), joint type (sambungan), application, compatibility / compatible fittings, status, technical specification, image, **catalog_version, source_document, source_page** (the design shows "Katalog produk Pralon 2026 · hal. 14" and "KATALOG PRALON v2.4").

Each spec field may be null → rendered as `UNAVAILABLE` ("Lihat dokumen teknis"), never invented.

Structured questions ("Ada ukuran 3/4 inch?") → deterministic MySQL query, not vector search.

Product detail is technical knowledge, not an e-commerce page: no cart, no checkout.

---

# 10. RAG

For unstructured content: catalogs, datasheets, manuals, installation guides, FAQ, SOP, technical docs, internal knowledge.
Use Qdrant only when semantic retrieval is actually needed. Retrieved content is untrusted input. Answers based on retrieval cite the source document and page.

---

# 11. Product Matching

`Technical Requirement → Product Matcher → MySQL Catalog → Pralon Recommendation`

Selected product, variant, and size must exist; compatibility must be validated; the LLM never creates product names or SKUs.

Matcher output states (design screen 07):
- verified & selected
- size needs validation (e.g. `3"–4" ?`)
- information unavailable (no fabricated spec; offer the technical team)

---

# 12. Material Estimator / BOM

Deterministic where possible. Output: pipes, fittings, reducers, tees, elbows, valves, connectors — each row with material, size, estimated quantity, and calculation basis ("DASAR PERHITUNGAN").
Without real dimensions: mark as `ESTIMATED` ("ESTIMASI · DIMENSI BELUM LENGKAP"), list assumptions, never present quantities as exact. Field variance note (e.g. 10–15%) is itself a rule requiring domain validation.

Pricing: only if `Pricing in scope = yes`. Then prices come from a versioned price table in MySQL (source, region, effective date, currency, tax rate as config). Never hardcoded, never LLM-generated, always labeled "Perkiraan perencanaan, bukan penawaran resmi". If pricing is out of scope, the report and BOM render without price columns.

---

# 13. Schematic Engine

No freeform AI image generation as engineering truth.
Structured topology: node, edge, floor, water source, riser, branch, pipe segment, fixture, fitting, pipe size, product mapping, elevation reference.

```json
{
  "nodes": [
    { "id": "tank", "type": "water_source", "floor": "roof" },
    { "id": "riser", "type": "riser" }
  ],
  "connections": [
    { "from": "tank", "to": "riser", "size": "1\"", "role": "main" }
  ]
}
```

The newer prototype renders an engineering-style drawing (title block "SK-01 AIR BERSIH", "SKALA: NTS", ground level "MUKA TANAH ±0.00", floor height labels, pipe route list "DAFTAR JALUR"). The topology must carry enough data for that: floor levels, floor height (with provenance), segment roles (main / riser / branch / fixture), sizes, and fitting points.

Renderer (SVG recommended to match the design; React Flow optional) is separate from engineering truth. The schematic always carries the note that it is not a construction drawing.

Scenario switches in the design (toren ke lantai 3 / tambah kamar mandi / pakai pompa) are requirement mutations → recalculation, not separate drawings.

---

# 14. Email Intelligence

Integration with `sales@pralon.com`. Goal: convert email into structured sales intelligence.

`Email Provider → n8n → RabbitMQ → Email Worker → Parser → AI Analysis → Requirement Extraction → Lead Classification → Opportunity Analysis → MySQL → Sales Dashboard / Notification`

Extracted fields: intent, lead type, project type/location/scale, units, building info, requested info, product interest, quotation intent, missing technical info.

Initial rule: AI analyzes → AI drafts → **human reviews → human sends**. No automatic replies.

---

# 15. Market Intelligence

Sources — web chat (optional city-level location, question, product interest, building type, recommendation, advanced-case interest) and email (company, project location/type/scale, requested products, quotation intent).

Uses: regional demand, product-interest trends, project opportunity patterns.

Asynchronous; never slows the chat path. Aggregated data is anonymized (Section 30b). Location is used for regional analysis only, **not** for recommendations (this is promised to users in onboarding step 4).

---

# 15b. Back-Office (Internal)

The Claude Design bundle does **not** include internal screens. Until designs exist, build back-office screens as plain, functional pages using the same design tokens (Section 33c), and log each one in `OPEN_QUESTIONS.md` as "needs design".

| Area | Role | Purpose | Phase |
|---|---|---|---|
| Catalog admin & import | catalog_admin | import/validate catalog, versions, source docs, images | 1 |
| Rule validation | domain_expert | review engineering rules, mark validated, see test cases | 6 |
| Technical handoff queue | technical_team | cases from "Kirim ke tim teknis Pralon", status, SLA | 10 |
| Email review | sales_reviewer | review AI analysis & drafts, edit, approve, send | 11 |
| Sales / market dashboard | sales_reviewer, admin | leads, product interest, regional demand | 12 |
| Users & roles | admin | internal accounts, roles, audit log view | 3 |

All back-office routes require authentication + role-based authorization, and every write is audit-logged.

---

# 16. Technical Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Backend | NestJS, TypeScript |
| Architecture | Modular monolith (no microservices from day one) |
| Database | MySQL 8 (centralized, Section 17) |
| ORM / migrations | **Propose one** (Prisma / TypeORM / Drizzle / MikroORM) with reasoning, weighted toward migration safety on a shared DB |
| Cache / session / rate limit | Redis |
| Queue | RabbitMQ |
| LLM gateway | OpenRouter initially, behind an internal abstraction |
| Vector | Qdrant, only when required |
| Auth | JWT + Refresh Token + Guest Session |
| Streaming | SSE |
| PDF generation | Propose (e.g. headless Chromium rendering an HTML report template) — runs as a RabbitMQ job |
| Integration | n8n |
| Reverse proxy | Nginx |
| Containers | Docker, Docker Compose |
| Logging | Pino |
| Observability (later) | OpenTelemetry, Prometheus, Grafana |
| Package manager | pnpm workspaces |
| CI | Propose (GitHub Actions / GitLab CI based on Git remote) |
| Fonts | IBM Plex Sans + IBM Plex Mono, self-hosted via `next/font` |

No Python/FastAPI in the MVP unless there is a concrete technical need (custom ML, fine-tuning, heavy numerics, Python-only libraries).

---

# 17. Centralized MySQL

Host `192.168.1.136`, port `3306`. Shared infrastructure — **not** disposable.

Do not assume database name, username, or password.

Mandatory:
- never hardcode credentials; use env vars; provide `.env.example`; never commit secrets
- connection pooling; clean failure handling (API returns a safe error; health check reports DB down)
- all DB access behind the NestJS persistence layer
- separate databases per environment (propose names, e.g. `snouty_dev`, `snouty_staging`, `snouty`)
- recommend least-privilege DB users (the app user must not have DROP privileges)
- inspect existing schema **read-only** first
- **never run any migration (destructive or not) against the shared server without my explicit approval**
- before any approved migration: confirm a recent backup exists (ask me), state the impact, provide the rollback
- never DROP DATABASE, reset schema, uncontrolled TRUNCATE, or force-reset
- prefer reversible migrations
- document backup/restore ownership in `docs/DATABASE.md`

---

# 17b. Environment Variables

`.env.example` must list (values empty):

```env
# App
NODE_ENV=
APP_URL=
API_URL=

# MySQL (centralized)
DB_HOST=192.168.1.136
DB_PORT=3306
DB_DATABASE=
DB_USERNAME=
DB_PASSWORD=
DB_POOL_MAX=

# Redis
REDIS_URL=

# RabbitMQ
RABBITMQ_URL=

# Auth
JWT_ACCESS_SECRET=
JWT_ACCESS_TTL=
JWT_REFRESH_SECRET=
JWT_REFRESH_TTL=
GUEST_SESSION_TTL=

# LLM
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=
LLM_MODEL_FAST=
LLM_MODEL_BALANCED=
LLM_MODEL_STRONG=

# Qdrant (only when adopted)
QDRANT_URL=
QDRANT_API_KEY=

# Integrations
N8N_WEBHOOK_SECRET=
TECH_HANDOFF_TARGET=

# Files
UPLOAD_MAX_MB=
STORAGE_PATH=

# Pricing (only if in scope)
TAX_RATE_PERCENT=
```

---

# 18. Redis
Rate limiting, caching, guest sessions, active context, temporary requirement state, job status, idempotency, distributed locks. Never the permanent source of truth.

# 19. RabbitMQ
Mandatory for async: email processing, document ingestion, embeddings, re-indexing, analytics events, market aggregation, notifications, PDF report generation, technical handoff delivery, heavy jobs.
Requirements: retry strategy, dead-letter queue, idempotent consumers, job observability, job status queryable by the UI.
Do NOT route normal chat messages through RabbitMQ.

# 20. n8n
Integration/orchestration only: email, CRM, external APIs, notifications, schedules, lead routing, knowledge sync triggers, technical-team handoff delivery, report-by-email delivery.
Never inside n8n: pipe sizing, engineering calculations, product eligibility, recommendation policies, core business rules.

# 21. Load Balancing
Initial: `Internet → Nginx → API`. Future: `Load Balancer → API-1..n → Redis / MySQL / RabbitMQ`. API instances stay stateless. SSE must work behind Nginx (disable buffering on SSE routes).

# 22. Rate Limiting
Tiers: Guest (low), Registered (medium), Advanced (high), Internal/Admin (separate).
Limits: messages/hour, tokens, concurrent requests, advanced cases/day, schematics/day, reports/day, uploads. Redis-backed. The UI receives a structured `RATE_LIMITED` error with a retry hint (render with the mascot "Maaf" mood).

---

# 23. Performance — Selective Execution

Do not run the full pipeline for every message.

| Request | Path |
|---|---|
| Product FAQ | Policy → MySQL/RAG → LLM → SSE |
| Product lookup | Policy → MySQL → explanation |
| Recommendation | Parser → Context → Engineering → Matcher → explanation |
| Advanced case | Parser → Clarification → Engineering → Matching → BOM → Schematic → explanation |
| Requirement edit / follow-up mutation | Context → Engineering → Matching → BOM → Schematic (no extraction LLM call) |

Progressive states — must match the design's analysis tracker exactly (`STEP_LABELS`):
1. Memahami kebutuhan
2. Menganalisis instalasi
3. Mencocokkan produk Pralon
4. Menyusun rekomendasi
5. Menyiapkan skema

These are real pipeline stages emitted as SSE events, not fake timers. The prototype's 620 ms/step timing is illustrative.

Expected bottlenecks: LLM calls, retrieval, large context. Avoid unnecessary model calls.

---

# 24. LLM Abstraction

```ts
interface LLMService {
  chat(...): Promise<unknown>;
  stream(...): AsyncIterable<unknown>;
  extractStructured<T>(...): Promise<T>;
}
```

Implementations: OpenRouterProvider (initial), later OpenAI/Anthropic/Gemini. Business logic never depends on a provider directly. Every call records model, tokens in/out, latency, cost estimate, and correlation ID.

# 25. Model Routing
Product FAQ → fast/cheap · Product knowledge → balanced · Requirement extraction → balanced · Ambiguous/complex → stronger · Conversation title → fast · **Engineering calculation → NO LLM**.

---

# 26. Coding Standards

- Clean Code: readable, meaningful names, small functions, focused classes, SRP, no magic values, no giant services, shallow nesting, no premature abstractions, no clever code.
- Domain logic separate from infrastructure; design for testability.
- OOP where it helps (interfaces, entities, value objects, application services, repositories, strategies, policy objects, justified factories, DI). Not for enterprise theater.
- No business logic in controllers or React components.
- Comments explain WHY, business rules, edge cases, limitations, architectural decisions — not what the code obviously does.

```ts
// Competitor products may be discussed for context,
// but final recommendations must remain Pralon-only.
```

- Errors: consistent domain/application exceptions, safe API error mapping with stable error codes, Pino structured logs, correlation IDs. Never swallow exceptions, log secrets or personal data, or expose stack traces.
- UI copy is in Bahasa Indonesia and taken from the design verbatim; keep copy in a single messages module (i18n-ready) rather than scattered literals.

# 26b. Git Workflow

- Work on a feature branch per phase or item: `phase-<n>/<item-id>-<short-name>` (e.g. `phase-1/P1-03-catalog-import`).
- Commit per completed checklist item; commit message starts with the item ID: `P1-03: add catalog import validator`.
- Never commit secrets, `.env`, or real customer data.
- Never push to `main` directly and never force-push. I merge after review.
- Keep commits small and focused; do not mix refactors with features.

---

# 27–29. (Merged into Section 26.)

---

# 30. Security

Validate all DTOs and AI outputs; protect secrets; proper authN/authZ (including back-office roles); distributed rate limiting; sanitize and size-limit uploads (floor plans from "Lampirkan denah": allowed types, virus/size checks, stored outside web root); treat retrieved documents and emails as untrusted; defend against prompt injection; never expose system prompts or unauthorized data; audit logs; least privilege; CSRF/CORS configured; secure cookie settings for refresh tokens.

# 30b. Privacy — UU No. 27/2022 (Pelindungan Data Pribadi)

- Record consent server-side (location, analytics storage of guest chats) with timestamp and policy version. The onboarding `localStorage` flag is only a UI convenience.
- Location: city-level only, optional, used for regional demand analysis — not for recommendations (as promised in onboarding copy).
- Define retention periods per data type (guest chats, registered chats, emails, reports, uploads).
- Anonymize/aggregate data used for market intelligence.
- Reports contain personal data (customer name, project location) → access control; only the owner and authorized internal roles can download.
- Review what data is sent to the LLM provider (OpenRouter and underlying models), especially customer email content. Propose redaction where appropriate.
- Support user data export/deletion requests for registered users.
- Provide privacy policy / terms links in onboarding and registration (copy to be supplied — log as open question).

---

# 31. Testing

Unit, integration, policy, engineering rule, product matching, context merge, AI structured-output validation, RAG evaluation, security, regression, edge cases, frontend component tests for provenance rendering, and E2E tests for the main consultation flow.
Policy Engine and Engineering Engine require especially strong coverage.
Required policy tests include: competitor question never yields a competitor card; `REQUIRES_DOMAIN_VALIDATION` rules never produce `VERIFIED`; guest cannot access advanced capabilities via API even if the UI is bypassed.

# 31b. AI Evaluation & Cost Tracking

- Maintain a golden dataset in `evals/` of Indonesian user messages with expected intent, extracted requirement, missing fields, and policy outcome (start with the prototype's example flows: 2-lantai house, competitor question, industrial request, "belum tahu" answers, requirement edits, wastewater mention).
- Run evals in CI when prompts, schemas, or model routing change; report accuracy per field.
- Track tokens and cost per conversation and per model; expose totals in the admin area.
- Collect user feedback per assistant answer (thumbs up/down + optional reason) — UI needs design; log as open question.

# 31c. CI

Every PR runs: install, lint, typecheck, unit + integration tests, policy/engineering test suites, and build for `web` and `api`. Evals run when AI-related files change. CI never connects to the shared MySQL server; use a disposable containerized MySQL for integration tests.

---

# 32. Repository Structure

```text
snouty/
├── apps/
│   ├── web/                 Next.js (customer app + back-office routes)
│   └── api/                 NestJS
├── packages/
│   ├── shared-types/        DTOs, Provenance, requirement schema, SSE event types
│   ├── config/              eslint, tsconfig, tailwind preset
│   └── ui/                  design tokens + shared components (Section 33c)
├── evals/
├── docs/
├── design-input/
├── .claude/
│   ├── CLAUDE.md
│   └── skills/
├── docker/
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

Backend:

```text
apps/api/src/
├── modules/
│   ├── auth/  users/  onboarding-consent/
│   ├── conversation/  context/  policy/  ai/
│   ├── product-catalog/  product-knowledge/  pricing/ (if in scope)
│   ├── recommendation/  engineering/  material-estimator/  schematic/
│   ├── report/  technical-handoff/  uploads/  feedback/
│   ├── email-intelligence/  market-intelligence/  admin/
├── shared/          (database, redis, rabbitmq, logging, errors, security)
└── infrastructure/  (mysql, qdrant, llm, queue, integrations, pdf)
```

Complex modules may use `domain/ application/ infrastructure/ presentation/`. Do not apply Clean Architecture ceremony to tiny modules.

---

# 33. Claude Design Integration

UI/UX is designed in Claude Design. **Do not redesign it.** The approved output in `design-input/` is the visual and interaction source of truth. Claude Code implements it pixel-closely, preserves interaction behavior, and wires it to real backend logic.

If a needed screen does not exist in the design (login/register, back-office, feedback, privacy pages), implement a minimal version using the existing design tokens and log it in `docs/OPEN_QUESTIONS.md` as "needs design".

## 33a. Design Input Layout & Source-of-Truth Order

```text
design-input/
├── handoff/                 ← Claude Design zip contents, unedited
└── DESIGN_DECISIONS.md      ← my decisions; overrides everything in handoff/
```

Source-of-truth order:
1. `design-input/DESIGN_DECISIONS.md`
2. `handoff/.../project/SNOUTY Prototype.dc.html` — the **newer** prototype (mascot moods, dark-mode toggle, analysis failure/retry/cancel, toast, collapsible sidebar, stage indicator, engineering-style schematic, report overlay)
3. `handoff/.../project/design_handoff_snouty/README.md` — tokens and screen specs; partly outdated. Where it conflicts with #2, #2 wins.
4. `SNOUTY Mascot.dc.html` (mascot moods & usage rules), `SNOUTY Laporan Rekomendasi.dc.html` (2-page report), `SNOUTY.dc.html` / `SNOUTY Dark.dc.html` (14-screen board, light/dark), `SNOUTY Onboarding.dc.html`.

Ignore `design_handoff_snouty/designs/SNOUTY-prototype.dc.html` (older version).
Do not port `support.js`, `doc-page.js`, `image-slot.js`, or the `<sc-if>` / `<sc-for>` / `{{ }}` template syntax.
Do not ship the prototype-only DEMO bar or `simulateError` switches.
Read the HTML/CSS source for values; do not rely on screenshots.

## 33b. Prototype Logic Is Illustrative Only

Never copy into production:
- sizing formulas: `fixtures = bath*2 + basin + kitchen`, `mainSize = fixtures >= 6 ? '1"' : '3/4"'`, max 4 points per branch, 3.5 m floor height, 1/2" fixture connection, 10–15% field variance → register each as an engineering rule with status `REQUIRES_DOMAIN_VALIDATION` in the Domain Validation Tracker
- `UNIT_PRICE` table, fallback prices, `rupiah()` totals, PPN 11% calculation
- keyword/regex extraction (`/pabrik|industri/`, `/kos/`, etc.) and `titleFrom()`
- canned follow-up answers (tambah kamar mandi, lantai 3, pompa) — the real answers come from Engineering Engine output + LLM explanation
- fake timers (750 ms thinking, 620 ms per step)
- hardcoded history items and report number

"TERVERIFIKASI" may only render for `VERIFIED` provenance (Policy 4).

## 33c. Design Tokens → `packages/ui`

Implement tokens once as CSS variables + Tailwind preset, exactly from the handoff README:
- Light and dark palettes (dark palette: see 33h conflict #3)
- Semantic rule: brand red `#DF301C` = action / selection / pipe path; green = verified catalog fact; amber = assumption / estimate / missing data. Never green/amber buttons, never red for verified. In dark mode brand red is fill-only; brand text uses `#FF8874`.
- Typography: IBM Plex Sans (400/500/600/700), IBM Plex Mono (400/500) for technical labels, sizes, status tags, captions; the full size scale from the README.
- Spacing rhythm, radii, shadows, focus ring (`0 0 0 3px rgba(223,48,28,.14)` + red border).
- Fixed metrics: sidebar 236px, right panel 330px, header 52px, drawer max 600–640px, modals 580–620px.
- Animations: enter 250ms, bottom sheet 280ms, thinking dots pulse; respect `prefers-reduced-motion` (the prototype does not — add it).
- Theme toggle (light/dark) persisted per user (server for registered, local for guest).

## 33d. Screen → Feature → Phase Map

| # | Screen (board) | Backend dependency | Phase |
|---|---|---|---|
| 01 | Welcome / empty state + composer + disclaimer | conversation, guest session | 3 |
| 02 | Active consultation: "Yang sudah saya pahami" card, chips, right panel "KEBUTUHAN ANDA", "KELENGKAPAN DATA" | context engine, extraction, SSE | 4 |
| 03 | Clarification / missing info (max 4 numbered questions, "lewati dan gunakan asumsi standar") | clarification engine, policy | 5 |
| 04 | Requirement review & inline edit (estimated values as dashed amber chips) | context engine, recalculation | 5–6 |
| 05 | Analysis tracker (5 steps) + failure/retry/cancel | pipeline SSE stages | 6–7 |
| 06 | Complete recommendation workspace (tabs Ringkasan / Produk Pralon / Skema / Estimasi Material; 5-stat summary; system table; product cards; BOM; assumptions + "Perbaiki asumsi ini") | engineering, matching, BOM, schematic | 7–9 |
| 07 | Product card states (verified+selected / size needs validation / unavailable) | matcher + provenance | 7 |
| 08 | Competitor brand question (neutral criteria card + Pralon-only cards) | policy engine | 5 |
| 09 | Schematic view + legend + "CATATAN SKEMA" + scenario switches | schematic engine | 9 |
| 10 | Product detail drawer (sizes, spec grid, compatible fittings, source line) | product catalog | 1–2 |
| 11 | Technical validation (why list, "YANG SUDAH SAYA CATAT", "Kirim ke tim teknis Pralon", "Unduh ringkasan kebutuhan", SLA) | policy, technical handoff, report | 5, 10 |
| 12 | History & saved solutions (grouped by date, status tags) | auth, conversation history | 10 |
| 13 | Mobile 390×844 (requirement sheet "Kebutuhan (n)", stacked solution cards, two-line BOM) | — (responsive) | each phase |
| 14 | First-run onboarding (5-step wizard) | onboarding-consent | 3 |
| — | Report overlay / PDF (Laporan Rekomendasi, 2 pages) | report module, PDF job | 10 |
| — | Stage indicator Kebutuhan → Analisis → Solusi → Laporan | conversation state | 4 |
| — | Toast ("Tersimpan ✓"), error states (analysis failed, report failed, message not sent) | error codes | each phase |

Status tags used in history/header must map to real conversation statuses: `DATA BELUM LENGKAP`, `SOLUSI SIAP`, `PERLU VALIDASI`, `N PRODUK`.

Responsive rules: below **1080px** the sidebar collapses (header gets "+ Baru" and "Riwayat" menu) and the right panel becomes an overlay sheet; below **720px** onboarding becomes a bottom sheet; tap targets ≥ 44px.

## 33e. Onboarding (screen 14 / `SNOUTY Onboarding.dc.html`)

5 steps: Kenalan dengan SNOUTY → Ceritakan kebutuhan Anda → Temukan produk Pralon → Lokasi (optional) → Pengalaman lebih lengkap.
- Location states: `ask | pending | granted | denied | blocked`. Explanation before the browser prompt. Declined = neutral, auto-advance ~450 ms. Blocked = amber card, app still usable.
- Step 5 benefits and tags (AKUN / LANJUTAN / TAMU JUGA) must be generated from the Entitlement Matrix (4.6), not hardcoded, so UI and policy never drift.
- Keyboard: → / Enter next, ← back, Esc skip.
- Completion states `done | guest | skip`; never auto-open again; consent recorded server-side (30b). A manual re-open entry point is needed (not designed — open question).

## 33f. Mascot (`SNOUTY Mascot.dc.html`)

The mascot replaces the placeholder brand mark in the newer prototype. Mood is derived from **system state**, never chosen by the LLM:

| Mood | Trigger |
|---|---|
| Siaga (idle) | default on welcome and sidebar |
| Menyapa | greeting (registered user name) |
| Istirahat (sleep) | welcome idle ≥ 15 s with empty composer; offline |
| Berpikir (think) | analyzing requirements / thinking state |
| Menulis (write) | composing recommendation; requirement mutation recalculating |
| Senang (happy) | solution ready, report downloaded |
| Terima kasih | feedback given, solution saved, registration success |
| Kedip (wink) | tips, "tahukah Anda", neutral criteria card |
| Fokus (focus) | technical validation / out-of-scope (screen 11) |
| Bingung (confused) | message not understood → paired with clarification |
| Kaget (surprised) | unexpected scenario or large change after edit |
| Maaf (sorry) | data not in catalog, rate limited, connection issue |
| Cek kebocoran (drip) | light loading, maintenance tips |
| Gagal (fail) | **system errors only**; plays once, then holds final frame |

Rules from the design: "Gagal" is never used for out-of-scope (use Fokus) or missing data (use Bingung). Map moods in one pure function `moodFor(state)` with unit tests. Respect reduced motion. Mascot artwork requires Pralon brand approval (33h #5).

## 33g. Report (`SNOUTY Laporan Rekomendasi.dc.html`)

Two-page A4 report:
1. Header with report number, customer, project location, consultation date, installation type; solution summary; recorded requirements; system recommendation table with status tags; assumptions.
2. Material (and optionally cost) estimate with "DASAR PERHITUNGAN", next steps, prepared-by / optionally-reviewed-by block, catalog version, footer "PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS".

Requirements: report number format proposed by Claude Code (design uses `SNTY-YYYY-MM-NNNN`), generated server-side from stored recommendation data (never re-asked to the LLM), rendered via PDF job, downloadable by the owner. Failure states from the mascot sheet: "Laporan gagal diunduh" → "Unduh ulang" / "Kirim ke email". Price columns only if pricing is in scope.

## 33h. Known Design Conflicts (resolve in `DESIGN_DECISIONS.md`)

1. **Pricing**: report and prototype show Rupiah prices, subtotal, PPN 11%, total; screen 10 says no price.
2. **Guest entitlement**: onboarding marks BOM/schematic/case analysis as account-only; prototype gives guests the full solution; no register-gate / resume screen and no login/register screens exist.
3. **Dark palette**: board dark (`#17191B` app bg, `#1D2023` surface) vs. prototype dark overrides (`#0F1213`, `#171B1D`).
4. **Wastewater**: clarification chip "Air bersih + pembuangan", history "Saluran pembuangan ruko", but wastewater is future scope.
5. **Mascot artwork origin**: `snouty-mascot.png` is identical to an uploaded ChatGPT-generated image → needs Pralon brand approval / final art. Official Pralon logo and exact brand red must be confirmed.
6. **Persistence**: onboarding/theme in `localStorage` vs. server-side consent and per-user preferences.
7. **Example prompt chips**: removed from the board, present in older prototype and reference screenshot — keep or drop?
8. **Missing designs**: login/register, register-gate, back-office, feedback, privacy/terms, onboarding re-open entry point.

Until resolved, use the defaults proposed in `OPEN_QUESTIONS.md` and keep the decision behind a config flag where cheap to do so.

## 33i. Accessibility

Target WCAG 2.1 AA: color contrast in both themes (verify amber-on-cream and muted text tiers), full keyboard navigation, visible focus ring, ARIA for tabs/drawer/modal/bottom sheet, focus trap in modals, live region for streaming answers and analysis progress, provenance never conveyed by color alone (tags carry text), `prefers-reduced-motion`.

---

# 34–46. Claude Code Skills

Create `.claude/skills/<name>/SKILL.md` for each skill below.

**Format rules:**
- Every `SKILL.md` starts with YAML frontmatter:
  ```yaml
  ---
  name: <skill-name>
  description: <one or two sentences stating WHEN this skill must be used, with concrete trigger situations>
  ---
  ```
- Keep skills concise (rules + checklists). Reference `docs/*.md` for detail instead of duplicating it.
- No contradictions between skills and docs; docs are the detailed source, skills are the enforcement summary.

| Skill | Governs |
|---|---|
| `snouty-architecture` | modular monolith, module boundaries, dependency direction, domain/infra separation, no business logic in controllers/components, no giant services, no provider lock-in, incremental development, git workflow |
| `product-knowledge` | MySQL as product truth, metadata, catalog ingestion & versioning, structured lookup, RAG, source references & provenance, Pralon-only, no fabricated product data |
| `ai-orchestration` | intent, extraction, structured state, clarification, LLM abstraction, model routing, streaming SSE stages, fallback, context, minimal LLM calls, cost tracking; **explicitly forbids LLM-based engineering calculation** |
| `snouty-policy` | Pralon-only, competitor handling, no hallucination, provenance, entitlement matrix, scope routing, technical validation |
| `engineering-rule-engine` | deterministic rules, versioning, traceability, validation status, domain validation tracker, tests, `REQUIRES_DOMAIN_VALIDATION` |
| `schematic-generator` | topology, node/edge, floor & elevation, riser, branch, fixture, segment, SVG renderer input matching the engineering-style drawing; no image generation as truth |
| `async-infrastructure` | RabbitMQ, Redis, workers, retry, DLQ, idempotency, job state, locks, PDF jobs; no async where sync is better |
| `email-intelligence` | sales@pralon.com, parsing, quoted-text cleanup, attachments, extraction, lead classification, human review, n8n/RabbitMQ |
| `market-intelligence` | event schema, product interest, regional demand, opportunities, aggregation, anonymization; never block chat |
| `security-guardrails` | auth, roles, DTO validation, prompt injection, AI output validation, secrets, uploads, audit, privacy/UU PDP, rate limiting, internal data |
| `performance-optimization` | selective execution, streaming, minimal LLM calls, caching, DB efficiency, no N+1, async boundaries, profiling |
| `testing-and-review` | all test categories (31), evals (31b), CI (31c), regression, security, edge cases, review checklist |
| `design-implementation` | design-input source-of-truth order (33a), illustrative-logic rule (33b), tokens (33c), screen map (33d), onboarding (33e), mascot moods (33f), report (33g), accessibility (33i), no redesign |

---

# 47. Root `.claude/CLAUDE.md`

Keep it short (rules only). Global rules:
- read `docs/SPEC.md` and `docs/PROGRESS.md` at session start; update `PROGRESS.md` after every completed item; follow the git workflow
- inspect existing code first; never rewrite working modules unnecessarily
- Clean Code, readability first, OOP only where useful, comments explain WHY
- preserve module boundaries
- never fabricate product data, engineering values, or prices
- never hide important business rules only inside prompts
- every displayed value carries provenance
- structured conversation state
- MySQL 8 centralized at `192.168.1.136`; no migrations without approval; never destructive resets
- update tests with behavior changes
- selective engine execution
- Claude Design output is the visual source of truth; prototype logic is illustrative only
- no premature microservices; no Python unless justified
- ambiguities go to `docs/OPEN_QUESTIONS.md`, not into silent assumptions

---

# 48. Documentation Deliverables

```text
docs/
├── SPEC.md                    (this file)
├── PROGRESS.md                (checklist — Section 51)
├── OPEN_QUESTIONS.md
├── PHASE0_PROPOSAL.md
├── PRODUCT.md
├── ARCHITECTURE.md
├── DOMAIN_MODEL.md
├── CONTEXT_ENGINE.md
├── POLICY.md                  (incl. entitlement matrix)
├── AI_BEHAVIOR.md
├── API_CONTRACTS.md           (REST + SSE event types, error codes)
├── PRODUCT_KNOWLEDGE.md
├── ENGINEERING_RULES.md       (incl. domain validation tracker)
├── PRODUCT_MATCHING.md
├── SCHEMATIC_ENGINE.md
├── REPORT.md
├── EMAIL_INTELLIGENCE.md
├── MARKET_INTELLIGENCE.md
├── BACKOFFICE.md
├── DESIGN_IMPLEMENTATION.md   (tokens, screen map, mascot mapping, a11y)
├── INFRASTRUCTURE.md
├── DATABASE.md                (incl. environments, backups, migration procedure)
├── SECURITY.md
├── PRIVACY.md
├── PERFORMANCE.md
├── EVALUATION.md
├── CODING_STANDARDS.md        (incl. git workflow)
└── ROADMAP.md
```

---

# 49. Roadmap

| Phase | Scope | Main screens |
|---|---|---|
| 0 | Documentation, architecture, skills, DB config, design tokens, skeleton (Section 50) | — |
| 1 | Product Catalog + catalog admin/import | 10 (data) |
| 2 | Product Knowledge Assistant (FAQ, lookup, RAG if needed) | 01, 02 (Q&A), 10 |
| 3 | Auth + Guest Session + Conversation + Onboarding + consent + users/roles | 01, 14, login/register |
| 4 | Context Engine + Intent Router + Requirement Parser + SSE | 02, stage indicator |
| 5 | Policy Engine + Clarification Engine + scope routing | 03, 04, 08, 11 |
| 6 | Engineering Rule Engine + rule validation admin | 04, 05 |
| 7 | Product Matching | 06 (products), 07 |
| 8 | Material Estimator / BOM (+ pricing if in scope) | 06 (BOM, assumptions) |
| 9 | Schematic Generator | 06 (preview), 09 |
| 10 | Registered history, saved solutions, advanced entitlement, register-gate & resume, report PDF, technical handoff queue | 11, 12, report |
| 11 | Email Intelligence + email review back-office | back-office |
| 12 | Market Intelligence + dashboard | back-office |
| 13 | Security, performance, a11y audit, evaluation, production hardening | all |

Mobile (13) and dark mode are implemented alongside each phase, not at the end.

---

# 50. Phase 0 — Execution With Checkpoints

## Phase 0a — Analysis only (no docs, no skills, no code)

1. Inspect the repository (and the old codebase if listed in Section 1).
2. Read this spec in full.
3. Read `design-input/` following Section 33a, starting with the newer prototype. If it is empty, note it and do not design any UI.
4. Inspect the existing `snouty` database schema **read-only**. Do not run any migration.
5. Create `docs/PROGRESS.md` from the template in Section 51.
6. Write `docs/PHASE0_PROPOSAL.md` covering:
   final monorepo structure · backend module boundaries · MySQL schema boundaries · ORM/migration tool recommendation · DB environments & connection strategy · Context Engine design · Policy Engine & entitlement design · Provenance model · LLM abstraction · model routing · SSE event contract (incl. the 5 analysis stages) · RabbitMQ worker boundaries · Redis usage · Qdrant adoption criteria · PDF generation approach · design token implementation plan · mascot mood mapping · testing, eval & CI strategy · security & privacy strategy · performance strategy · phased implementation order.
7. Write `docs/OPEN_QUESTIONS.md`: ambiguities, assumptions, all design conflicts from 33h, missing designs, and items needing Pralon domain-expert validation — each with an ID (`OQ-01`…), a proposed default, and which phase it blocks.

**STOP. Wait for my review.**

## Phase 0b — Core docs
`ARCHITECTURE.md`, `DOMAIN_MODEL.md`, `POLICY.md`, `DATABASE.md`, `CONTEXT_ENGINE.md`, `ENGINEERING_RULES.md`, `API_CONTRACTS.md`, `PRIVACY.md`, `DESIGN_IMPLEMENTATION.md`.

**STOP. Wait for my review.**

## Phase 0c — Remaining docs
All other files in Section 48.

**STOP. Wait for my review.**

## Phase 0d — Claude Code configuration
`.claude/CLAUDE.md` and all `.claude/skills/*/SKILL.md` (format rules in Section 34–46).

**STOP. Wait for my review.**

## Phase 0e — Skeleton only
Monorepo scaffold, `.env.example` (Section 17b), Docker Compose for local Redis/RabbitMQ (MySQL stays centralized; a disposable MySQL container only for CI/integration tests), lint/format/typecheck/test tooling, CI pipeline, `packages/ui` design tokens (light + dark) with a token preview page, self-hosted IBM Plex fonts, API health-check endpoint (DB connectivity check, read-only). No features.

**STOP. Do not begin Phase 1 until I approve.**

---

# 51. Progress Tracking — `docs/PROGRESS.md`

Create and maintain `docs/PROGRESS.md` as the single place where I can see how far the project is.

## Rules
- Status markers:
  - `[ ]` not started
  - `[~]` in progress
  - `[x]` done
  - `[!]` blocked (must reference an `OQ-xx` item)
- An item is `[x]` only when it is complete **and** its tests pass (code items) or I have approved it (STOP checkpoints).
- Never delete items. If scope changes, strike through with `~~text~~` and add a note.
- Add new sub-items as they are discovered, under the correct phase.
- Every feature item has a matching test sub-item and, where relevant, a screen reference (e.g. `[screen 07]`).
- Keep the Summary table, Blockers, Domain Validation Tracker, Design Coverage table, and Session Log up to date.
- Each item has a stable ID (e.g. `P1-03`) that is also used in branch names and commit messages.
- Break Phases 1–13 into concrete items at the start of each phase, before writing code for it.

## Template

```markdown
# SNOUTY — Progress

Last updated: YYYY-MM-DD · Current phase: 0a · Next item: P0a-01

## Summary
| Phase | Status | Done / Total |
|---|---|---|
| 0a Analysis | in progress | 0/7 |
| 0b Core docs | not started | 0/9 |
| 0c Remaining docs | not started | 0/— |
| 0d Claude Code config | not started | 0/14 |
| 0e Skeleton | not started | 0/8 |
| 1 Product Catalog | not started | — |
| ... | | |

## Blockers
- (none) / [!] P6-02 — waiting on OQ-05 (domain expert: fixture unit table)

## Phase 0a — Analysis
- [ ] P0a-01 Inspect repository & old codebase
- [ ] P0a-02 Read spec
- [ ] P0a-03 Read design-input (newer prototype first)
- [ ] P0a-04 Inspect `snouty` DB schema (read-only)
- [ ] P0a-05 Create PROGRESS.md
- [ ] P0a-06 Write PHASE0_PROPOSAL.md
- [ ] P0a-07 Write OPEN_QUESTIONS.md
- [ ] ✋ CHECKPOINT — reviewed by owner

## Phase 0b — Core docs
- [ ] P0b-01 ARCHITECTURE.md
- [ ] P0b-02 DOMAIN_MODEL.md
- [ ] P0b-03 POLICY.md
- [ ] P0b-04 DATABASE.md
- [ ] P0b-05 CONTEXT_ENGINE.md
- [ ] P0b-06 ENGINEERING_RULES.md
- [ ] P0b-07 API_CONTRACTS.md
- [ ] P0b-08 PRIVACY.md
- [ ] P0b-09 DESIGN_IMPLEMENTATION.md
- [ ] ✋ CHECKPOINT — reviewed by owner

## Phase 0c — Remaining docs
- [ ] P0c-01 … (one item per remaining file in Section 48)
- [ ] ✋ CHECKPOINT — reviewed by owner

## Phase 0d — Claude Code configuration
- [ ] P0d-01 .claude/CLAUDE.md
- [ ] P0d-02 … P0d-14 (one item per skill, 13 skills)
- [ ] ✋ CHECKPOINT — reviewed by owner

## Phase 0e — Skeleton
- [ ] P0e-01 Monorepo scaffold (pnpm workspaces)
- [ ] P0e-02 .env.example
- [ ] P0e-03 Docker Compose (Redis, RabbitMQ; CI-only MySQL)
- [ ] P0e-04 Lint / format / typecheck / test tooling
- [ ] P0e-05 CI pipeline
- [ ] P0e-06 packages/ui design tokens (light + dark) + preview page
- [ ] P0e-07 Self-hosted IBM Plex Sans/Mono
- [ ] P0e-08 API health check (DB connectivity, read-only)
- [ ] ✋ CHECKPOINT — reviewed by owner

## Phase 1 — Product Catalog
(broken down when Phase 0 is approved)

## Phases 2–13
(headings only; broken down at the start of each phase)

## Design Coverage
| Screen | Description | Phase | Status |
|---|---|---|---|
| 01 | Welcome | 3 | [ ] |
| 02 | Active consultation | 4 | [ ] |
| 03 | Clarification | 5 | [ ] |
| 04 | Requirement review | 5–6 | [ ] |
| 05 | Analysis tracker | 6–7 | [ ] |
| 06 | Recommendation workspace | 7–9 | [ ] |
| 07 | Product card states | 7 | [ ] |
| 08 | Competitor question | 5 | [ ] |
| 09 | Schematic | 9 | [ ] |
| 10 | Product detail drawer | 1–2 | [ ] |
| 11 | Technical validation | 5, 10 | [ ] |
| 12 | History & saved | 10 | [ ] |
| 13 | Mobile | all | [ ] |
| 14 | Onboarding | 3 | [ ] |
| — | Report PDF | 10 | [ ] |
| — | Mascot moods | 3+ | [ ] |
| — | Dark mode | all | [ ] |

## Domain Validation Tracker
| Rule ID | Description | Origin | Status | Validated by | Date |
|---|---|---|---|---|---|
| ENG-001 | Fixture count formula | prototype | REQUIRES_DOMAIN_VALIDATION | — | — |
| ENG-002 | Main pipe size threshold (≥6 fixtures → 1") | prototype | REQUIRES_DOMAIN_VALIDATION | — | — |
| ENG-003 | Max fixtures per branch (4) | prototype | REQUIRES_DOMAIN_VALIDATION | — | — |
| ENG-004 | Default floor height (3.5 m) | prototype | REQUIRES_DOMAIN_VALIDATION | — | — |
| ENG-005 | Fixture connection size (1/2") | prototype | REQUIRES_DOMAIN_VALIDATION | — | — |
| ENG-006 | Field variance (10–15%) | prototype | REQUIRES_DOMAIN_VALIDATION | — | — |
| ENG-007 | Clarification priority order | prototype | REQUIRES_DOMAIN_VALIDATION | — | — |

## Session Log
| Date | Items worked on | Result | Branch / commits | Notes |
|---|---|---|---|---|
```
