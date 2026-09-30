# Handoff: SNOUTY — AI Pipe Solution Assistant (Pralon)

## Overview
SNOUTY is a conversational technical consultant for Pralon piping products. A customer describes a building
in plain Indonesian ("rumah 2 lantai, 3 kamar mandi, toren di atap"), SNOUTY extracts the requirements, asks
only for what is missing, then produces a structured solution: system recommendation, matching Pralon products,
a piping schematic, an estimated bill of materials, and the assumptions behind it.

This bundle covers:
- the full desktop + mobile product design (14 screens),
- a working end-to-end interactive prototype of the consultation flow,
- a working 5-step first-time onboarding wizard (incl. location-permission states),
- light and dark themes.

## About the Design Files
The files in `designs/` are **design references authored in HTML** — prototypes that demonstrate the intended
look, copy, and behavior. They are **not production code to copy**. The task is to **recreate these designs in
the target codebase's existing environment** (React/Next, Vue, Svelte, native, etc.) using its established
component library, routing, state management and styling conventions. If no codebase exists yet, pick the most
appropriate stack for the product and implement the designs there.

Technical notes about the reference files: each `*.dc.html` is a self-contained page that loads `support.js`
(the prototype runtime used by the design tool) and renders a template plus a small logic class. Do **not** port
`support.js` or the `<sc-if>` / `<sc-for>` / `{{ }}` template syntax — read them as "what the UI does" and
re-express the logic in your framework. All styling is inline literal CSS so every value is directly readable.

## Fidelity
**High fidelity.** Colors, typography, spacing, radii, copy, and interaction states are final and intended to be
matched closely. The prototypes' logic (extraction heuristics, canned answers, timings) is illustrative — real
implementation should be backed by the actual product catalog and an LLM/rules service.

Open the files in a browser to interact:
- `designs/SNOUTY-prototype.dc.html` — full consultation flow
- `designs/SNOUTY-onboarding.dc.html` — first-time onboarding wizard
- `designs/SNOUTY-board-light.dc.html` / `-dark` — the 14-screen spec board (static, zoomable)

---

## Design Tokens

### Color — light theme
| Token | Hex | Use |
|---|---|---|
| brand / primary | `#DF301C` | primary buttons, active tab underline, highlighted pipe path, selected item, logo mark |
| brand hover | `#B02414` | button hover; also the **text/link** shade of the brand on light surfaces |
| brand soft bg | `#FDECE9` | size pills, avatar square, step numerals, schematic highlighted nodes |
| brand soft border | `#F6C3BB` | soft-accent borders, completed progress dots |
| brand selected row | `#FDF1EF` | active sidebar item background (with 2px `#DF301C` left border) |
| pipe mid | `#EE7A67` | branch pipe legend/stroke |
| pipe light | `#F4B0A3` | fixture connection legend/stroke |
| ink | `#14181A` | primary text; also user chat-bubble background (with `#FFFFFF` text) |
| ink 2 | `#20262A` | assistant message body |
| ink 3 | `#2B3134` | chip labels, secondary button text |
| ink 4 | `#42484B` | table body / descriptions |
| muted | `#5A6468` | labels, helper copy |
| muted 2 | `#7A8285` | fine print |
| caption | `#8A9295` | mono caption labels (10px caps) |
| placeholder | `#9AA3A5` | input placeholders |
| disabled | `#A8B0B2` | pending step labels, timestamps |
| canvas | `#F7F8F7` | app background |
| surface | `#FFFFFF` | cards, panels, header |
| surface subtle | `#FBFCFB` | table footers, footer bars, hover rows |
| border | `#DDE2E1` | inputs, buttons, modal edge |
| border soft | `#E6EAE9` | card borders, rails |
| hairline | `#EFF2F1` / `#F3F5F4` | inner dividers |
| dot grid | `#E4E8E7` | schematic canvas dots (radial-gradient 1px / 22px) |
| verified | text `#1E7A4C`, bg `#E8F5EC` | "TERVERIFIKASI", "✓ SPESIFIKASI TERVERIFIKASI" |
| assumption / estimate | text `#8A5300`, strong `#B26B00`, body `#7A5518`, grid text `#6E4E17`, bg `#FDF8EF` / `#FDF3E3`, border `#F0DFC0` / `#E3C894` | assumptions card, "JUMLAH DIESTIMASI", missing-field labels |
| placeholder image | `repeating-linear-gradient(135deg,#F3F5F4 0 6px,#E9EDEC 6px 12px)` | product shots (to be replaced with real photography) |

**Semantic rule (important):** brand red = action/selection/pipe path. Green = verified catalog fact.
Amber = assumption / estimate / missing data. Never use green or amber for buttons, never use red for "verified".

### Color — dark theme (see `SNOUTY-board-dark.dc.html`)
Surfaces `#141618` (canvas behind frames), `#17191B` (app bg), `#1D2023` (surface), `#202326` (subtle),
borders `#33383C` / `#2B3034` / `#262A2E`, text `#ECEFF0` → `#DDE1E3` → `#B9C0C3` → `#9AA3A7`,
muted tiers `#9AA2A5` / `#949C9F` / `#8B9397`, user bubble `#30363A`.
Brand: `#DF301C` **fills only** (buttons, logo, pipe bars, always with `#FFFFFF` text);
all brand **text/labels/links** use `#FF8874` (`#FFA895` for the helmet `a:hover`).
Verified `#5CC98D` on `#172A1F`; assumption `#EEB96E` / `#E5A64E` on `#2B2418`, border `#4C3D22`.

### Typography
- Family: **IBM Plex Sans** (400/500/600/700) for everything; **IBM Plex Mono** (400/500) for technical labels,
  pipe sizes, status tags, step numerals, timestamps, and caption headers.
- Scale (px): 34/600/-0.025em (welcome headline) · 23–24/600/-0.02em (modal + product titles) ·
  19/600/-0.012em (solution headline) · 15–16/600 (section titles) · 14.5–15/400/1.6 (intro body) ·
  14/400/1.6 (chat body, table cells) · 13.5/500–600 (list titles, buttons) · 13/400/1.55 (descriptions) ·
  12.5/400 (helper, secondary buttons) · 11–11.5 (field labels) · **mono** 10/500 with `letter-spacing:.06–.07em`
  uppercase (captions, status), 9–9.5 mono (micro tags).
- `text-wrap: pretty` on paragraphs, `balance` on the welcome headline.

### Spacing / radii / shadows
- Spacing rhythm: 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 24 / 26 / 28 px; content gutters 20–24px (desktop), 16px (mobile).
- Fixed metrics: sidebar **236px**, right panel **330px** (desktop) / `min(330px,88%)` overlay (narrow),
  header **52px**, product drawer `max-width 600px`, modals `max-width 580–620px`, mobile frame 390×844.
- Radii: 4–5 (pills, tags), 6 (buttons, inputs), 8 (cards), 9–12 (modals), 20 (chips), 50% (dots/avatars).
- Shadows: cards `0 1px 2px rgba(20,24,26,.04–.05)`; modal `0 24px 60px rgba(20,24,26,.22)`;
  drawer `-12px 0 40px rgba(20,24,26,.14)`; menu `0 14px 34px rgba(20,24,26,.16)`; scrim `rgba(20,24,26,.32–.38)`.
- Focus/selection: `box-shadow: 0 0 0 3px rgba(223,48,28,.14)` with `border-color:#DF301C`.
- Animations: content enter `opacity/translateY(6–8px)` 250ms ease; bottom sheet 280ms; thinking dots
  `opacity .35→1` 1s ease-in-out, staggered 0 / .2s / .4s; dot indicator width transition 200ms.

---

## Screens / Views

Reference board: `SNOUTY-board-light.dc.html` (frames are labeled 01–14, `data-screen-label`).

**01 Welcome / empty state** — sidebar + main; centered column `max-width 700px`: 34px headline, 15px sub,
composer card (`#FFFFFF`, 1px `#DDE2E1`, radius 10, padding 16; placeholder 15px `#9AA3A5`; "Lampirkan denah"
ghost chip left, red "Kirim" right), and a bottom disclaimer row (13px circle outline + 12px `#7A8285` text:
planning guidance, industrial cases should be validated). Right panel collapses to a 48px rail with vertical
mono label "PANEL SOLUSI". *(The example-prompt chip block was intentionally removed from the board; the
prototype keeps a "COBA SALAH SATU" row — implement chips only if product wants them.)*

**02 Active consultation** — 3 columns. Chat: user bubble right (`#14181A`, white text, radius `10 10 2 10`,
max-width 520), assistant row = 26px `#FDECE9` square with mono "S" + 660px column. Inside the assistant turn:
"Yang sudah saya pahami" card — 3×2 grid of extracted fields (10.5px label `#8A9295` + 13px/500 value) with a
green "N DATA TERBACA" tag; then a follow-up question and 20px-radius quick-answer chips.
Right panel: "KEBUTUHAN ANDA" key/value list (missing rows in amber with a dashed top border),
"KELENGKAPAN DATA" 4-segment 4px meter, and a greyed "PRODUK YANG DIPERTIMBANGKAN" list.

**03 Clarification / missing info** — header tag "DATA BELUM LENGKAP" (amber). Assistant shows a card with
2–4 numbered questions (mono `01` accent + 13.5px/500 question + chips indented 24px), then
"Lanjut ke rekomendasi" + "lewati dan gunakan asumsi standar". Right panel leads with an amber
"Rekomendasi belum bisa disusun" card. Never dump a long questionnaire — max 4, progressive.

**04 Requirement review** — two editable column cards (BANGUNAN / SISTEM AIR) with value chips in 5px-radius
boxes; the focused field carries the red focus ring; estimated values render as dashed amber chips
("Diestimasi SNOUTY"). Amber "2 nilai akan diasumsikan" card + "Tambahkan dimensi bangunan" link.
Footer actions: "Susun rekomendasi" (primary) / "Kembali ke percakapan".

**05 Analysis** — centered 560px column, 5-step vertical tracker (16px dots, 1.5px connectors;
done = filled red, active = red ring + 240×3px progress bar, pending = `#D5DAD9` ring, label `#A8B0B2`).
Steps: Memahami kebutuhan · Menganalisis instalasi · Mencocokkan produk Pralon · Menyusun rekomendasi ·
Menyiapkan skema. In the prototype this is a modal (620ms per step, ~3.5s total). Footnote: only the Pralon
catalog is matched; unavailable values are marked as estimates.

**06 Complete recommendation** (tall workspace) — left column: *Ringkasan* card (mono caption + timestamp,
19px headline, 14px body, 5-stat row: Titik air / Jalur utama / Cabang / Sambungan fixture / Produk Pralon);
*Rekomendasi Sistem* table (4px color bar + name/path + mono size + reason + TERVERIFIKASI|ASUMSI tag, with a
"Tampilkan detail teknis" disclosure); *Produk Pralon* 2-up cards; *Estimasi Material* table (MATERIAL / UKURAN /
PERKIRAAN / DASAR PERHITUNGAN + amber "ESTIMASI · DIMENSI BELUM LENGKAP" tag + footer note about the 10–15%
field variance); amber *Asumsi yang digunakan* card (2-column list + "Perbaiki asumsi ini" → recalculates).
Right rail: schematic preview, follow-up suggestion chips + composer, and a "Batas rekomendasi" note.

**07 Product card states** — verified+selected (red border + focus ring), size-needs-validation (dashed amber
size pill `3"–4" ?`), and information-unavailable (dashed grey card, no fabricated spec, offers the technical team).

**08 Competitor brand question** — assistant stays neutral, explicitly does not compare other brands, shows a
3-item "KRITERIA YANG SEBAIKNYA DIPERIKSA" card, then **only Pralon** product cards, closing with a note that
SNOUTY only holds Pralon catalog data. No competitor product cards, ever.

**09 Schematic view** — dot-grid canvas, mono labels. Hierarchy: source box (2px `#14181A`) → 3px red main line
with size label → PIPA UTAMA → RISER VERTIKAL → per-floor branch boxes → fixture nodes (1px `#DDE2E1`).
Right rail: legend (main/branch/fixture + node), "CATATAN SKEMA" (schematic ≠ construction drawing),
and scenario switches (toren ke lantai 3 / tambah kamar mandi / pakai pompa).

**10 Product detail** — right drawer (600–640px) over a `rgba(20,24,26,.32)` scrim: mono "PENGETAHUAN PRODUK"
header, 140px product image, family/name/description, "DIPAKAI DI SOLUSI INI · size" tag, available-size pills
(current size highlighted), 2-up spec grid (Material, Standar, Panjang batang, Sambungan, Aplikasi, Tekanan kerja —
unknown values render amber "Lihat dokumen teknis", never invented), compatible fittings, and a source line
("Katalog produk Pralon 2026 · hal. 14"). Technical knowledge, not an e-commerce PDP — no price, no cart.

**11 Unsupported / technical validation** — not an error screen: title "Kebutuhan ini membutuhkan pengecekan
teknis lebih lanjut", a numbered "MENGAPA PERLU DIVALIDASI" list, a "YANG SUDAH SAYA CATAT" summary so the user
doesn't repeat themselves, actions "Kirim ke tim teknis Pralon" / "Unduh ringkasan kebutuhan" + SLA line, and
chips for what SNOUTY *can* help with.

**12 History & saved solutions** — grouped rows (HARI INI / SEPTEMBER) with title, one-line context, status tags
(4 PRODUK / SOLUSI SIAP / DATA BELUM LENGKAP / PERLU VALIDASI) and right-aligned mono time; below, a 3-up
"SOLUSI TERSIMPAN" grid with a dashed empty slot.

**13 Mobile (390×844)** — conversation first: 48px app bar with "Kebutuhan (n)" opening the requirement sheet,
chat + chips, sticky composer (rounded field + 40px red circular send). Solution becomes stacked cards
(Ringkasan → product cards → Skema → Estimasi material → Asumsi), and the BOM becomes a two-line-per-row list.
No permanent multi-column layout.

**14 First-run onboarding pop-up** — see the dedicated wizard below.

---

## Onboarding wizard (`SNOUTY-onboarding.dc.html`)
Centered modal `max-width 580px`, `max-height 94vh`; below 720px it becomes a bottom sheet
(`align-items:flex-end`, radius `14px 14px 0 0`, full width, no padding).

Head: brand mark + wordmark/caption, step dots (7px; active `22px` `#DF301C`, completed `#F6C3BB`,
upcoming `#E6EAE9`, clickable), and a `×` dismiss. Body scrolls; footer bar (`#FBFCFB`, 1px top hairline)
holds "Lewati" on the left and Kembali / secondary / primary on the right.

1. **Kenalan dengan SNOUTY** — 150px illustration slot (striped placeholder; replace with real art), 23px title, body copy.
2. **Ceritakan kebutuhan Anda dengan cara biasa** — copy + example user bubble + "SNOUTY akan bertanya balik…" line.
3. **Temukan produk Pralon yang sesuai** — 3 columns: 01 Kebutuhan → 02 Analisis → 03 Produk Pralon + footer note.
4. **Bantu kami memahami kebutuhan di wilayah Anda** — explanation **before** the browser prompt, 4 bullets
   (optional · works without it · used for regional demand analysis, not for recommendations · city-level detail).
   Primary "Aktifkan Lokasi" (label becomes "Meminta izin…" while pending) / secondary "Nanti Saja".
   States: **granted** green card "Lokasi berhasil diaktifkan"; **declined** neutral card, no error, flow continues
   (auto-advance ~450ms); **blocked** amber card "Izin lokasi diblokir oleh browser… Anda tetap dapat menggunakan SNOUTY".
5. **Ingin pengalaman yang lebih lengkap?** — 6 benefits in a 2-column grid with tags AKUN / LANJUTAN / TAMU JUGA
   (Riwayat percakapan, Simpan hasil konsultasi, Analisis studi kasus, Estimasi kebutuhan material, Rekomendasi
   produk Pralon, Visualisasi skema perpipaan) + note that case analysis & schematic generation belong to the
   registered experience. Primary "Daftar Akun" / secondary "Lanjut sebagai Tamu". Never blocking.

Keyboard: `→`/`Enter` next, `←` back, `Esc` = skip. Persistence: on complete / skip / close write
`localStorage['snouty_onboarding_state'] = 'done' | 'guest' | 'skip'` and never auto-open again; expose a
manual re-open entry point later (help/settings — not designed yet). The bottom-left **DEMO** bar in the
reference file (simulate granted/blocked, reset first-visit) is prototype-only — do not ship it.

---

## Interactions & Behavior
- **Composer**: Enter or "Kirim" submits; empty input is a no-op; input clears on submit.
- **Extraction**: on submit, parse counts for lantai / kamar mandi / wastafel / dapur, water source
  (toren·tandon → "Toren atap" when atap/rooftop is mentioned, pompa, PDAM), building type, and installation type.
  Real implementation should do this server-side with an LLM + validation, returning a typed requirement object.
- **Clarification loop**: ask for the first missing field in priority order `source → install → floors → bath`,
  one question per turn with quick-answer chips. "Belum tahu" applies a default and flags it as an assumption.
  When nothing is missing, the assistant offers "Susun rekomendasi".
- **Thinking state**: 3 pulsing red dots next to the assistant avatar, ~750ms before each reply.
- **Analysis**: 5 sequential steps (~620ms each), then transition to the solution workspace and set status "SOLUSI SIAP".
- **Solution workspace**: tabs Ringkasan / Produk Pralon / Skema / Estimasi Material; "Tampilkan detail teknis"
  disclosure; product card → detail drawer (scrim click or × closes); "Simpan solusi" → "Tersimpan ✓" + prepends to history.
- **Follow-ups**: suggestion chips (in-content and in the right panel) or free typing. "Tambah kamar mandi"
  **mutates the requirement and recalculates** the BOM/schematic; "kenapa ukuran ini", "toren di lantai 3",
  "ukuran tersedia" answer in place; brand questions stay neutral; industrial scenarios route to technical validation.
  Unknown questions must answer with an honest "data belum cukup" + offer the technical team — never invent specs.
- **Requirement editing**: right-panel "Ubah" turns rows into inline inputs; edits immediately re-derive
  fixture count, main pipe size, schematic floors, BOM quantities, and assumption copy.
- **Responsive**: below **1080px** the sidebar collapses (header gains "+ Baru" and a "Riwayat" menu) and the
  right panel becomes an overlay sheet; below **720px** the onboarding modal becomes a bottom sheet.
  Tap targets ≥44px on mobile.

## State Management
Consultation: `screen: 'welcome'|'chat'|'solution'` · `draft` · `messages[]` (`role`, `text`, plus render flags
`showSummary|showCriteria|showUnsupported|showProduct|cta|chips[]`) · `thinking` · `req { type, floors, bath,
basin, kitchen, source, install }` · `analyzing`, `stepIdx` · `tab`, `showTech` · `editing` · `productId` ·
`followUps[]` · `saved`, `history[]`, `activeTitle`, `activeStatus` · `panelOpen`, `menuOpen`, `narrow`.
Derived (never stored): `fixtures = bath*2 + basin + kitchen`, `mainSize = fixtures >= 6 ? '1"' : '3/4"'`,
completeness = filled count of `[source, install, floors, bath]`, schematic floor/node tree, BOM rows, assumptions.
Onboarding: `step 1..5`, `open`, `closed`, `closedWhy`, `loc: 'ask'|'pending'|'granted'|'denied'|'blocked'`, `narrow`.

Data the backend must supply: product catalog (family, name, category, sizes, material, standard, rod length,
joint type, application, document reference, image), sizing rules / fixture-unit table, BOM formulas, assumption
templates, and a confidence/verification flag per field so the UI can render verified vs. assumed vs. unavailable.
Every product must come from the Pralon catalog; competitor products are never rendered as cards.

## Assets
- **Product images**: placeholders only (`repeating-linear-gradient` stripes with a mono "product shot" caption).
  Replace with real Pralon photography — 1:1, ~82px in cards, 140–150px in the drawer.
- **Onboarding step 1 illustration**: 150px placeholder slot, needs real art (no decorative AI imagery).
- **Icons**: none used — all affordances are typography, 1.5px outlined squares/circles, and rules.
  If your codebase has an icon set, keep usage minimal and geometric.
- **Fonts**: IBM Plex Sans + IBM Plex Mono (Google Fonts / self-host).
- No Pralon logo files were available; the brand mark in these mocks is a placeholder red square with a ring.
  Swap in the official logo and confirm the exact brand red with the Pralon brand guide (`#DF301C` was provided).

## Files
```
designs/SNOUTY-board-light.dc.html   14-screen spec board (light) — primary visual reference
designs/SNOUTY-board-dark.dc.html    same board, dark theme
designs/SNOUTY-prototype.dc.html     interactive end-to-end consultation flow
designs/SNOUTY-onboarding.dc.html    interactive 5-step onboarding wizard
designs/support.js                   prototype runtime for the files above (do NOT port)
```
Open any file directly in a browser. Keep `support.js` next to them.
