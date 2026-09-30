# SNOUTY — Progress

Last updated: 2026-09-30 · Current phase: **0a (awaiting checkpoint review)** · Next item: **P0a-04** (blocked on OQ-02), then Phase 0b

## Summary
| Phase | Status | Done / Total |
|---|---|---|
| 0a Analysis | awaiting review | 6/7 (P0a-04 blocked) |
| 0b Core docs | not started | 0/9 |
| 0c Remaining docs | not started | 0/18 |
| 0d Claude Code config | not started | 0/14 |
| 0e Skeleton | not started | 0/8 |
| 1 Product Catalog | not started | — |
| 2 Product Knowledge Assistant | not started | — |
| 3 Auth / Guest / Conversation / Onboarding | not started | — |
| 4 Context Engine + Intent Router + SSE | not started | — |
| 5 Policy + Clarification + Scope routing | not started | — |
| 6 Engineering Rule Engine | not started | — |
| 7 Product Matching | not started | — |
| 8 Material Estimator / BOM | not started | — |
| 9 Schematic Generator | not started | — |
| 10 History / Saved / Report / Handoff | not started | — |
| 11 Email Intelligence | not started | — |
| 12 Market Intelligence | not started | — |
| 13 Hardening & audit | not started | — |

## Blockers
- `[!]` **P0a-04** — read-only MySQL inspection not performed. The server at `192.168.1.136:3306` is
  reachable, but no database name or credentials were supplied and SPEC §17 forbids guessing them.
  Waiting on **OQ-02**.
- `[!]` **P1 (all)** — cannot start without OQ-02 (DB access) and OQ-07 (catalog source).
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
- [!] P0a-04 Inspect `snouty` DB schema (read-only) — **blocked on OQ-02**. TCP reachability confirmed;
      nothing was read from or written to the server.
- [x] P0a-05 Create PROGRESS.md
- [x] P0a-06 Write PHASE0_PROPOSAL.md
- [x] P0a-07 Write OPEN_QUESTIONS.md — 33 questions raised (OQ-01…OQ-33), including 11 design conflicts
      found beyond the 8 listed in SPEC §33h.
- [ ] ✋ CHECKPOINT — reviewed by owner

## Phase 0b — Core docs
- [ ] P0b-01 ARCHITECTURE.md
- [ ] P0b-02 DOMAIN_MODEL.md
- [ ] P0b-03 POLICY.md
- [ ] P0b-04 DATABASE.md *(will carry a gap until OQ-02 is answered)*
- [ ] P0b-05 CONTEXT_ENGINE.md
- [ ] P0b-06 ENGINEERING_RULES.md
- [ ] P0b-07 API_CONTRACTS.md
- [ ] P0b-08 PRIVACY.md
- [ ] P0b-09 DESIGN_IMPLEMENTATION.md *(includes the full extracted light→dark token maps)*
- [ ] ✋ CHECKPOINT — reviewed by owner

## Phase 0c — Remaining docs
- [ ] P0c-01 PRODUCT.md
- [ ] P0c-02 AI_BEHAVIOR.md
- [ ] P0c-03 PRODUCT_KNOWLEDGE.md
- [ ] P0c-04 PRODUCT_MATCHING.md
- [ ] P0c-05 SCHEMATIC_ENGINE.md
- [ ] P0c-06 REPORT.md
- [ ] P0c-07 EMAIL_INTELLIGENCE.md
- [ ] P0c-08 MARKET_INTELLIGENCE.md
- [ ] P0c-09 BACKOFFICE.md
- [ ] P0c-10 INFRASTRUCTURE.md
- [ ] P0c-11 SECURITY.md
- [ ] P0c-12 PERFORMANCE.md
- [ ] P0c-13 EVALUATION.md
- [ ] P0c-14 CODING_STANDARDS.md
- [ ] P0c-15 ROADMAP.md
- [ ] ✋ CHECKPOINT — reviewed by owner

## Phase 0d — Claude Code configuration
- [ ] P0d-01 `.claude/CLAUDE.md`
- [ ] P0d-02 skill `snouty-architecture`
- [ ] P0d-03 skill `product-knowledge`
- [ ] P0d-04 skill `ai-orchestration`
- [ ] P0d-05 skill `snouty-policy`
- [ ] P0d-06 skill `engineering-rule-engine`
- [ ] P0d-07 skill `schematic-generator`
- [ ] P0d-08 skill `async-infrastructure`
- [ ] P0d-09 skill `email-intelligence`
- [ ] P0d-10 skill `market-intelligence`
- [ ] P0d-11 skill `security-guardrails`
- [ ] P0d-12 skill `performance-optimization`
- [ ] P0d-13 skill `testing-and-review`
- [ ] P0d-14 skill `design-implementation`
- [ ] ✋ CHECKPOINT — reviewed by owner

## Phase 0e — Skeleton
- [ ] P0e-01 Monorepo scaffold (pnpm workspaces)
- [ ] P0e-02 `.env.example`
- [ ] P0e-03 Docker Compose (Redis, RabbitMQ; CI-only MySQL)
- [ ] P0e-04 Lint / format / typecheck / test tooling
- [ ] P0e-05 CI pipeline *(provider pending OQ-09)*
- [ ] P0e-06 `packages/ui` design tokens (light + dark) + preview page
- [ ] P0e-07 Self-hosted IBM Plex Sans/Mono
- [ ] P0e-08 API health check (DB connectivity, read-only) *(pending OQ-02)*
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
| 13 | Mobile (13a/13b/13c) | all | [ ] |
| 14 | Onboarding | 3 | [ ] |
| — | Report PDF | 10 | [ ] |
| — | Mascot moods | 3+ | [ ] |
| — | Dark mode | all | [ ] |
| — | Stage indicator (Kebutuhan → Analisis → Solusi → Laporan) | 4 | [ ] |
| — | Toast + error states | each phase | [ ] |
| — | Login / register | 3 | [ ] *needs design — OQ-21* |
| — | Register-gate + resume | 10 | [ ] *needs design — OQ-27* |
| — | Back-office (6 areas) | 1, 3, 6, 10, 11, 12 | [ ] *needs design — OQ-21* |
| — | Answer feedback | 13 | [ ] *needs design — OQ-21* |
| — | Privacy / terms pages | 3 | [ ] *needs design — OQ-12, OQ-21* |
| — | Onboarding re-open entry point | 3 | [ ] *partly designed — OQ-21* |

## Domain Validation Tracker
All rules are `REQUIRES_DOMAIN_VALIDATION` until a Pralon domain expert is named (OQ-06). While that
holds, **no sizing value may render as TERVERIFIKASI** (Policy 4).

| Rule ID | Description | Origin | Status | Validated by | Date |
|---|---|---|---|---|---|
| ENG-001 | Fixture load units `bath*2 + basin + kitchen`; outlet count ("titik air") `bath + basin + kitchen` | newer prototype | REQUIRES_DOMAIN_VALIDATION | — | — |
| ENG-002 | Main/riser size threshold `loadUnits >= 8 → 1"`, else `3/4"` — ⚠ the older prototype and SPEC §33b say `fixtures >= 6`; see OQ-22 | newer prototype | REQUIRES_DOMAIN_VALIDATION | — | — |
| ENG-003 | Maximum 4 outlets per branch | both prototypes | REQUIRES_DOMAIN_VALIDATION | — | — |
| ENG-004 | Default floor height 3.5 m | both prototypes | REQUIRES_DOMAIN_VALIDATION | — | — |
| ENG-005 | Fixture connection size 1/2" | both prototypes | REQUIRES_DOMAIN_VALIDATION | — | — |
| ENG-006 | Field variance 10–15% on estimated quantities | both prototypes | REQUIRES_DOMAIN_VALIDATION | — | — |
| ENG-007 | Clarification priority order `source → install → floors → bath`; see OQ-23 | prototype | REQUIRES_DOMAIN_VALIDATION | — | — |
| ENG-008 | Fixture-to-floor distribution heuristic (`ceil` on top floor, `floor` below, kitchen on floor 1); see OQ-33 | prototype | REQUIRES_DOMAIN_VALIDATION | — | — |
| ENG-009 | BOM quantity formulas (`2+nFloors` batang main, `3+bath` batang branch, `bath+2` tees, `bath*3` elbows, `nFloors` reducers) | prototype | REQUIRES_DOMAIN_VALIDATION | — | — |
| ENG-010 | Target flow velocity 1–2 m/s | prototype ("DETAIL TEKNIS") | REQUIRES_DOMAIN_VALIDATION | — | — |
| ENG-011 | Rooftop-tank gravity is sufficient without a booster pump for this building class | prototype copy | REQUIRES_DOMAIN_VALIDATION | — | — |
| ENG-012 | Assumption "each bathroom contains 1 shower + 1 closet" | prototype | REQUIRES_DOMAIN_VALIDATION | — | — |
| ENG-013 | Pressure class guidance: AW for pressurised clean water, D for drainage | board screen 08 | REQUIRES_DOMAIN_VALIDATION | — | — |
| ENG-014 | "Belum tahu" defaults (`source → Toren atap`, `install → Air bersih`); see OQ-32 | prototype | REQUIRES_DOMAIN_VALIDATION | — | — |

## Session Log
| Date | Items worked on | Result | Branch / commits | Notes |
|---|---|---|---|---|
| 2026-09-30 | P0a-01 … P0a-07 | 6 done, P0a-04 blocked | `phase-0/P0a-analysis` | Design bundle moved to `design-input/handoff/`. 33 open questions raised; 11 design conflicts found beyond SPEC §33h. Awaiting checkpoint review. |
