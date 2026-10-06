# SNOUTY → Asisten Teknik Perpipaan Umum — Penilaian Implementasi

2026-10-06 · menjawab brief pemilik "General Piping Engineering Assistant" · dibaca sebelum satu
baris kode pun diubah (brief §42).

---

## 1. Arsitektur saat ini (apa adanya)

Monolith modular (`docs/ARCHITECTURE.md`): `apps/web` (Next 16), `apps/api` (NestJS), `apps/worker`
(PDF), `packages/engineering` (TS murni, tanpa I/O), `packages/shared-types`.

**Alur satu pesan chat hari ini** (`context/application/message.service.ts`):

```
POST /conversations/:id/messages
  → judul (potongan pesan; model memperhalus di latar)
  → IntentRouter: heuristik pasti (sapaan/kompetitor/konsep/irigasi) → model → withRequirementPrecedence
  → PRODUCT_LOOKUP ──► product-question-pipeline: KONSEP (pipe-knowledge) | SPESIFIKASI (katalog)
  → selain itu ─────► runUnderstanding:
        kompetitor → kartu kriteria
        irigasi    → applyIrrigationAnswers + irrigationGuidance + kartu/CTA
        guna lain di luar cakupan → kartu validasi teknis
        ekstraksi model → grounding → merge → completeness(4 field inti) → followUpCard
  → event SSE ditulis SEKALIGUS setelah semuanya selesai (bukan streaming sungguhan)
POST /conversations/:id/requirement/clarification  (jawaban chip, nol LLM)
POST /conversations/:id/analyze → AnalysisService: computeSolution | computeIrrigation → match → simpan
```

**Komponen yang sudah ada dan sehat** (dipakai ulang, bukan ditulis ulang):

| Komponen                                                                                                                                         | Letak                                               | Keadaan                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | ---------------------------------------------- |
| Mesin aturan teknik: `RuleVersion`, registry (R-1: aturan tanpa tes ditolak), trace per aturan, gerbang provenance                               | `packages/engineering`                              | 19 aturan, semua `REQUIRES_DOMAIN_VALIDATION`  |
| State kebutuhan terstruktur + merger berprioritas sumber (`user_stated` > `user_edited` > `inferred` > `default_applied`) + provenance per nilai | `context/domain`                                    | hanya 11 field bangunan + `useCase.irrigation` |
| Grounding ekstraksi (field butuh penanda di pesan) + fakta tersurat tanpa model                                                                  | `extraction-to-updates.ts`                          | khusus bangunan                                |
| Kebijakan murni (kompetitor, cakupan, guna)                                                                                                      | `policy/`                                           | leaf, teruji                                   |
| Katalog: versi `pralon`/`sample`, `CatalogQueryService` gagal-tertutup, `isAuthoritative`/`isAnswerable`                                         | `product-catalog/domain/catalog-visibility.ts`      | **brief §23 sudah terpenuhi**                  |
| Pencocokan produk per peran (family + ukuran kanonik)                                                                                            | `recommendation/domain/product-matcher.ts`          | pasif: menerima daftar peran                   |
| Pengetahuan bahan milik kode (tanpa angka) + FAQ deterministik + anti-ulang                                                                      | `pipe-knowledge.ts`, `product-question-pipeline.ts` | **brief §24–25 sudah terpenuhi**               |
| Markdown aman (daftar putih, tanpa HTML)                                                                                                         | `assistant-markdown.tsx`                            | **brief §29 sudah terpenuhi**                  |
| Evaluasi (`pnpm eval`, 22 kasus, metrik per field)                                                                                               | `apps/api/evals`                                    | baseline qwen 7B                               |
| Audit biaya/latensi per panggilan model                                                                                                          | tabel `llm_calls`                                   | hanya LLM, bukan tahap pipeline                |

## 2. Akar masalah (dipetakan ke brief §"CURRENT PROBLEMS")

| #    | Masalah                                                            | Akar di kode                                                                                                                                                                                                |
| ---- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1, 2 | Lookup katalog mendahului pemahaman; satu pola jawab               | Sudah dibalik untuk FAQ/irigasi hari ini; **jalur bangunan** masih "ekstrak → klarifikasi 4 field → hitung" tanpa model kasus                                                                               |
| 4, 5 | Rekomendasi dari parameter terlalu sedikit; "lengkap" terlalu dini | `completeness.ts`: satu meter 4 field inti untuk SEMUA keluaran. `isIrrigationComplete` sama: boolean tunggal                                                                                               |
| 6    | Diameter hanya dari kecepatan                                      | ENG-002 ambang unit fixture; ENG-102 `D = √(4Q/πv)` — **tanpa kerugian gesek, tanpa head**; tidak ada kandidat alternatif                                                                                   |
| 7, 9 | Asumsi agresif; fakta/asumsi/hitungan bercampur                    | Default tersebar: `requirement-defaults.ts` (bangunan), `irrigation-input.ts` (titik tengah rentang), konstanta di aturan (1,5 l/s/ha). Provenance per nilai ADA, tetapi tidak ada registry asumsi terpusat |
| 8    | BOM sebelum geometri                                               | ENG-009/ENG-105 memakai tata letak asumsi (lahan bujur sangkar) — ditandai ASSUMED, tetapi tetap dihitung tanpa prasyarat                                                                                   |
| 3    | Mengulang jawaban                                                  | Ditutup untuk FAQ (`withoutRepeating`); jalur bangunan belum punya "apa yang baru di giliran ini"                                                                                                           |
| 10   | Data contoh bocor                                                  | **Ditutup** (0013, `catalog-visibility`)                                                                                                                                                                    |
| 11   | Panggilan model berurutan                                          | Giliran kebutuhan = intent (±12 s) + ekstraksi (±18 s) + retry 55 % kasus; judul di latar; tidak ada streaming token; proxy Next bukan penyumbat (diukur)                                                   |
| 12   | Tidak terasa seperti teknisi                                       | Tidak ada **model kasus**, tidak ada **grafik ketergantungan parameter**, tidak ada **pemilih pertanyaan bernilai tertinggi** — pertanyaan dari daftar tetap (`clarification.ts`, `irrigation.ts`)          |

Dua masalah struktural yang menjelaskan hampir semuanya:

1. **State kebutuhan adalah skema tetap bangunan**, bukan registry parameter. Irigasi masuk sebagai
   "guna" tempelan (`useCase`), dan setiap kasus baru (gorong-gorong, hujan, cluster) akan menuntut
   skema baru + field type + migrasi — pola `if irrigation / if house` yang brief larang.
2. **Kelengkapan dan sizing bersifat tunggal.** Satu boolean "lengkap", satu ukuran "jawaban",
   tanpa kesiapan per keluaran dan tanpa pembanding alternatif.

## 3. Komponen yang dipakai ulang apa adanya

`RuleVersion`/registry/trace/provenance gate; merger berprioritas sumber dan `TrackedValue`
(dijadikan dasar metadata parameter brief §4 — `source`, `provenance`, `updatedAt`, `reason`,
`ruleId` sudah ada); kebijakan; visibilitas katalog; matcher; pipe-knowledge; Markdown; endpoint
klarifikasi tanpa LLM; evaluasi; `ReplyWriter` dengan pagar angka; heuristik intent.

## 4. Komponen yang perlu direfaktor

| Komponen                                                       | Perubahan                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RequirementState` (bangunan tetap)                            | Menjadi **EngineeringState**: `parameters: Record<ParameterKey, TrackedValue>` + `case` + `readiness` + `assumptions` + `calculated`. Field bangunan lama dipetakan ke kunci registry (`building.floors` → `building_floors`) supaya panel, laporan, dan snapshot lama tetap terbaca |
| `completeness.ts`                                              | Menjadi **ReadinessResolver**: kesiapan per keluaran (`material_selection`, `pipe_sizing`, `pump_sizing`, `network_layout`, `bom`, `product_matching`) dari grafik ketergantungan                                                                                                    |
| `clarification.ts` + `irrigation.ts` (daftar pertanyaan tetap) | Menjadi **MissingParameterResolver**: parameter kritis yang belum diketahui dari profil kasus, diurutkan nilai dampaknya; redaksi pertanyaan dari registry (bahasa pengguna, brief §8)                                                                                               |
| `extraction-to-updates.ts` + `irrigationFactsFrom`             | Menjadi **TechnicalContextExtractor**: satu ekstraktor (deterministik dulu, model untuk sisanya) yang menulis ke registry parameter dengan `source: user` + grounding                                                                                                                |
| ENG-002 / ENG-102 (ukuran dari ambang/kecepatan)               | **PipeSizingCalculator** multi-kriteria: kandidat ukuran × kecepatan × gesek (Hazen-Williams untuk air bersih plastik) × head; rekomendasi beralasan, bukan terkecil yang lolos                                                                                                      |
| ENG-009 / ENG-105 (BOM dari tata letak asumsi)                 | BOM hanya bila `network_layout` siap; selain itu kuantitas dilabeli "menunggu geometri"                                                                                                                                                                                              |
| `AnalysisService` (dua jalur hardcode)                         | **EngineeringSolutionGenerator** per profil kasus: profil memilih kalkulator, bukan `if`                                                                                                                                                                                             |
| `message.controller` SSE                                       | Streaming per event (tahap, token) alih-alih menulis semua di akhir                                                                                                                                                                                                                  |

## 5. Komponen yang belum ada

- **ParameterRegistry** (brief §3–4): definisi parameter universal + metadata + redaksi pertanyaan.
- **CaseProfileRegistry** (§2, §6): profil kasus → parameter aktif, kalkulator, keluaran; dukung
  primer + sekunder.
- **TechnicalCaseClassifier**: deterministik dari isyarat teks (sudah ada benihnya di
  `message-signals.ts`), model hanya bila ragu.
- **ParameterDependencyResolver** (§7) dan **ReadinessResolver** (§9).
- **EngineeringAssumptionRegistry** (§20): satu tabel asumsi beridentitas (`IRRIGATION_PRELIMINARY_FLOW`
  …), kondisi pakai, rujukan, `confirmation_required`; menggantikan konstanta di aturan dan
  default yang tersebar.
- **Kalkulator deterministik** (§10–16): `UnitConverter`, `PressurizedHydraulics` (A, V,
  Hazen-Williams, minor loss, TDH), `PipeSizing` (kandidat + tradeoff), `PumpSystem` (titik kerja
  Q/H, tanpa mengarang pompa), `GravityFlow` (Manning), `Stormwater` (Q = C·I·A, intensitas hujan
  wajib dari pengguna/asumsi berlabel), `Culvert` (hidraulik + penanda struktural "awal"),
  `NetworkDemand` (faktor serentak), `MaterialQuantity`.
- **ResponseComposer** (§28): bagian tetap (Ringkasan · Data yang diketahui · Asumsi · Perhitungan ·
  Opsi · Rekomendasi · Produk Pralon · Data yang masih dibutuhkan), diisi dari state — model hanya
  merangkai bagian naratif dengan pagar angka yang sudah ada.
- **Instrumentasi tahap** (§31): waktu per tahap pipeline, bukan hanya per panggilan model.

## 6. Risiko migrasi

| Risiko                                                                        | Penanganan                                                                                                                                               |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Snapshot lama (`requirement_snapshots`) berbentuk `RequirementState` bangunan | Adapter baca: state lama dipetakan ke registry saat dimuat; tulis selalu bentuk baru; tidak ada migrasi data massal                                      |
| Panel kanan, laporan PDF, skema, evaluasi membaca field bangunan              | Proyeksi `legacyRequirementView(state)` dipertahankan sampai masing-masing dipindah; tes kontrak menjaga keluaran JSON `GET /requirement`                |
| Aturan teknik baru = angka baru                                               | Semua `REQUIRES_DOMAIN_VALIDATION`, rujukan tertulis, asumsi beridentitas; evaluasi + tes aturan wajib (R-1)                                             |
| Kalkulator hidraulik butuh kekasaran/diameter dalam per produk                | Nilai umum per bahan di registry asumsi sampai katalog Pralon (OQ-07) membawa diameter dalam sebenarnya                                                  |
| Model 7B lemah untuk ekstraksi bebas                                          | Ekstraktor deterministik dulu (fakta tersurat), model mengisi sisanya dengan skema kecil per kasus; evaluasi mengukur                                    |
| Streaming per event mengubah kontrak klien                                    | Klien sudah membaca SSE per event (`getReader`); hanya server yang menunda — perubahan aman                                                              |
| Cakupan besar                                                                 | Fase kecil, tiap fase hijau & hidup; profil bangunan dan irigasi dipindah lebih dulu sebagai pembuktian, kasus lain menyusul sebagai profil + kalkulator |

## 7. Fase implementasi

| Fase                                         | Isi                                                                                                                                                                                                                                                                    | Keluaran yang terlihat                                                                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **1. State & registry**                      | `ParameterRegistry` (kunci universal, unit, redaksi pertanyaan, importance), `EngineeringState` di atas `TrackedValue`, `EngineeringAssumptionRegistry`, `ReadinessResolver` per keluaran, adapter state lama                                                          | "Data inti sudah lengkap" diganti kesiapan per keluaran; asumsi punya ID                                                    |
| **2. Kasus & ekstraksi**                     | `CaseProfileRegistry` (bangunan, bertingkat, cluster, irigasi, transfer pompa, gravitasi/drainase, hujan, gorong-gorong, sumur), `TechnicalCaseClassifier`, `TechnicalContextExtractor` (fakta tersurat: "sungai 150 m, 4 m lebih rendah"), `MissingParameterResolver` | Pertanyaan menyesuaikan kasus, tidak menanyakan yang sudah disebut; kasus baru bisa dibuka tanpa kalkulator (bertanya dulu) |
| **3. Hidraulik bertekanan**                  | `UnitConverter`, `PressurizedHydraulics` (HW), `PipeSizingCalculator` (kandidat + tradeoff), `PumpSystemCalculator` (TDH, titik kerja)                                                                                                                                 | TEST 5 ("PVC 1.5 inch cukup nggak…") dan TEST 10                                                                            |
| **4. Gravitasi/hujan/gorong-gorong/cluster** | `GravityFlow` (Manning), `Stormwater`, `Culvert` (awal), `NetworkDemand`                                                                                                                                                                                               | TEST 7–9 bertanya & menghitung yang bisa                                                                                    |
| **5. Produk**                                | Matcher menerima kebutuhan teknis (bahan, diameter, kelas tekanan, instalasi) dari solusi; tetap lewat `catalog-visibility`                                                                                                                                            | "Solusi dulu, produk kemudian"                                                                                              |
| **6. Komposer**                              | `ResponseComposer` bagian tetap + layar solusi menampilkan Opsi & Kesiapan                                                                                                                                                                                             | Jawaban teknis konsisten                                                                                                    |
| **7. Latensi & streaming**                   | Instrumentasi tahap, SSE per event, ekstraksi gabungan satu panggilan, cache registry/profil                                                                                                                                                                           | TTFB tahap < 2 s; giliran kebutuhan satu panggilan model                                                                    |

Fase 1–2 adalah pondasi; tanpa keduanya, menambah kalkulator hanya menambah `if`. Keduanya tidak
mengubah tampilan yang sudah disetujui — perubahan tampilan baru di fase 6.

## 8. Yang tidak akan dilakukan

- Tidak mengganti framework atau menambah Python/Qdrant.
- Tidak menghapus 19 aturan yang ada: ENG-001…ENG-014 dipertahankan di profil bangunan (dengan
  kalkulator gesek sebagai lapisan tambahan), ENG-101…105 dipindah ke registry asumsi + kalkulator.
- Tidak mengarang intensitas hujan, kurva pompa, atau diameter dalam produk: semuanya asumsi
  beridentitas yang menunggu data Pralon (OQ-07) dan validasi (OQ-06/OQ-47).
