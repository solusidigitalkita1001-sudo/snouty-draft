# SNOUTY — Model Domain

Fase 0b · P0b-02 · Terakhir diperbarui 2026-09-30

Model konseptual sistem: entity, value object, aggregate, dan invarian yang harus selalu benar.
Pemetaan ke tabel ada di `DATABASE.md`; tipe TypeScript-nya tinggal di `packages/shared-types`.

---

## 1. Peta aggregate

Tujuh aggregate. Referensi antar-aggregate selalu lewat ID, tidak pernah lewat objek.

```
Identity          User · GuestSession · Consent
Conversation      Conversation ──1..n── Message
                               ──1..n── RequirementSnapshot
Catalog           CatalogVersion ──1..n── Product ──1..n── ProductSize
                                                  ──1..n── ProductSpec
RuleRegistry      EngineeringRule ──1..n── RuleVersion ──0..n── RuleValidation
Recommendation    Recommendation ──1..n── SystemLine
                                 ──1..n── SelectedProduct
                                 ──1..n── BomItem
                                 ──1..n── Assumption
                                 ──0..1── Schematic
                                 ──1..n── CalculationTrace
Report            Report ──0..1── ReportJob
Handoff           TechnicalHandoff ──1..n── HandoffEvent
```

Aturan yang dipegang: **Recommendation adalah snapshot, bukan tampilan hidup.** Setelah tersimpan, ia
tidak ikut berubah saat katalog diperbarui. Laporan yang dibuat hari ini harus tetap bisa dibaca sama
persis tahun depan, dan pengguna berhak tahu katalog versi berapa yang dipakai. Karena itu setiap
Recommendation menyimpan `catalogVersionId` dan menyalin nilai yang ditampilkan, bukan menyimpan
referensi yang bisa bergeser.

---

## 2. Value object lintas domain

### `Provenance`

Kosakata tunggal yang dipahami UI (SPEC §5 Policy 4).

```ts
type Provenance = 'VERIFIED' | 'ASSUMED' | 'ESTIMATED' | 'UNAVAILABLE';
```

| Nilai         | Boleh dihasilkan oleh                              | Tampil sebagai                                                           |
| ------------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| `VERIFIED`    | record katalog, atau aturan ber-status `VALIDATED` | hijau "TERVERIFIKASI"                                                    |
| `ASSUMED`     | aturan default, jawaban "Belum tahu"               | amber "ASUMSI" + **wajib** muncul di kartu asumsi                        |
| `ESTIMATED`   | kuantitas tanpa dimensi nyata                      | amber "DIESTIMASI" / "ESTIMASI · DIMENSI BELUM LENGKAP"                  |
| `UNAVAILABLE` | kolom katalog yang null                            | abu-abu putus-putus, "Lihat dokumen teknis", **nilai tidak ditampilkan** |

**Invarian P-1.** Aturan ber-status `REQUIRES_DOMAIN_VALIDATION` tidak pernah menghasilkan `VERIFIED`.
Ditegakkan oleh satu fungsi gerbang yang dilalui semua output engine, dan diuji sebagai release
blocker.

**Invarian P-2.** `UNAVAILABLE` berarti nilainya tidak dirender sama sekali. Tidak ada "—", tidak ada
tebakan, tidak ada nilai default diam-diam.

### `TrackedValue<T>`

Setiap field kebutuhan adalah ini, tidak pernah skalar telanjang.

```ts
type FieldSource = 'user_stated' | 'user_edited' | 'default_applied' | 'inferred';

interface TrackedValue<T> {
  value: T | null;
  provenance: Provenance;
  source: FieldSource;
  reason?: string; // WAJIB bila provenance === 'ASSUMED' — ini teks kartu asumsi
  ruleId?: string; // diisi bila default berasal dari sebuah aturan
  updatedAt: string;
}
```

**Invarian TV-1.** `provenance === 'ASSUMED'` ⇒ `reason` terisi. Kartu "Asumsi yang digunakan" di layar
06 dirender dari kumpulan `reason` ini, jadi asumsi tanpa alasan berarti asumsi yang tidak terlihat
pengguna — itu pelanggaran SPEC §5 Policy 4.

### `PipeSize`

Ukuran pipa adalah value object, bukan string bebas. Di desain ia muncul sebagai `1/2"`, `3/4"`, `1"`,
`1¼"`, `1½"`, `2"`, `3"`, `4"` — pecahan, bukan desimal, dengan karakter `¼`/`½` bukan `1/4`/`1/2`
pada ukuran di atas 1 inci. Perbandingan dilakukan atas nilai numerik internal, tampilan memakai label
kanonik. Ini mencegah `1.25"` dan `1¼"` dianggap dua ukuran berbeda.

Kasus khusus dari layar 07: rentang yang belum pasti, misal `3"–4" ?`. Dimodelkan sebagai
`PipeSizeRange` dengan `provenance: 'UNAVAILABLE'` — bukan sebagai ukuran yang dipilih.

---

## 3. Identity

### `User`

| Field                                 | Catatan                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `id`, `email`, `passwordHash`, `name` |                                                                                       |
| `tier`                                | `registered` \| `advanced` — lihat OQ-05; untuk MVP keduanya setara                   |
| `roles`                               | `sales_reviewer` \| `technical_team` \| `catalog_admin` \| `domain_expert` \| `admin` |
| `themePreference`                     | `light` \| `dark` \| `system` — server yang berwenang (OQ-19)                         |
| `createdAt`, `lastSeenAt`             |                                                                                       |

Pelanggan dan pengguna internal adalah entity yang sama dengan peran berbeda. Memisahkannya akan
menduplikasi autentikasi tanpa alasan.

### `GuestSession`

| Field          | Catatan                                    |
| -------------- | ------------------------------------------ |
| `id`           | cookie `httpOnly`, TTL `GUEST_SESSION_TTL` |
| `consents`     | referensi ke `Consent`                     |
| `linkedUserId` | diisi saat tamu mendaftar                  |
| `expiresAt`    |                                            |

**Invarian G-1.** Saat tamu mendaftar, semua `Conversation` dan `RequirementSnapshot` milik session
berpindah kepemilikan ke `User` tanpa kehilangan satu pun snapshot. Ini yang membuat janji SPEC §4.4
("never force the user to retype") benar secara harfiah, bukan sekadar niat.

### `Consent`

| Field                    | Catatan                           |
| ------------------------ | --------------------------------- |
| `subjectId`              | `userId` atau `guestSessionId`    |
| `kind`                   | `LOCATION` \| `ANALYTICS_STORAGE` |
| `granted`                | boolean                           |
| `policyVersion`          | wajib — SPEC §30b                 |
| `grantedAt`, `revokedAt` |                                   |

Consent adalah catatan sisi server, bukan flag `localStorage`. Flag di browser hanya kenyamanan render
pertama (OQ-19). Detail di `PRIVACY.md`.

---

## 4. Conversation

### `Conversation`

| Field                                     | Catatan                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| `id`, `ownerId` (user atau guest session) |                                                                                |
| `title`                                   | dibuat LLM dari pesan pertama, boleh diedit                                    |
| `status`                                  | lihat enum di bawah                                                            |
| `stage`                                   | `KEBUTUHAN` \| `ANALISIS` \| `SOLUSI` \| `LAPORAN` — indikator tahap di header |
| `currentSnapshotId`                       | menunjuk `RequirementSnapshot` terbaru                                         |
| `recommendationId`                        | terisi setelah solusi tersusun                                                 |
| `catalogVersionId`                        | versi katalog saat konsultasi berjalan                                         |
| `createdAt`, `updatedAt`                  |                                                                                |

**Enum `ConversationStatus`** — diturunkan dari tag yang benar-benar muncul di desain, termasuk yang
tidak tercantum di SPEC §33d (lihat OQ-28):

| Nilai              | Tag di UI          | Sumber       |
| ------------------ | ------------------ | ------------ |
| `IN_PROGRESS`      | SEDANG BERLANGSUNG | board 02     |
| `CHECKING_DATA`    | MEMERIKSA DATA     | board 04     |
| `ANALYZING`        | MENGANALISIS…      | board 05     |
| `INCOMPLETE_DATA`  | DATA BELUM LENGKAP | board 03, 12 |
| `SOLUTION_READY`   | SOLUSI SIAP        | board 06, 12 |
| `NEEDS_VALIDATION` | PERLU VALIDASI     | board 11, 12 |
| `SAVED`            | DISIMPAN           | board 12     |
| `REOPENED`         | DIBUKA KEMBALI     | prototipe    |

Badge `4 PRODUK` dan `5 MATERIAL · ESTIMASI` **bukan** status; keduanya diturunkan dari jumlah baris
`SelectedProduct` / `BomItem` plus provenance agregat BOM, sehingga tidak bisa jadi basi.

### `Message`

| Field                                                  | Catatan                                           |
| ------------------------------------------------------ | ------------------------------------------------- |
| `id`, `conversationId`, `role` (`user` \| `assistant`) |                                                   |
| `text`                                                 |                                                   |
| `cards`                                                | `AssistantCard[]` — terstruktur, bukan markdown   |
| `mood`                                                 | mood mascot yang menyertai, diturunkan dari state |
| `llmCallId`                                            | menunjuk ke `llm_calls` untuk audit biaya         |

`AssistantCard` adalah union tertutup yang mencerminkan kartu di desain: `summary` ("Yang sudah saya
pahami"), `clarification` (maks 4 pertanyaan bernomor), `criteria` ("KRITERIA YANG SEBAIKNYA
DIPERIKSA"), `unsupported` (layar 11), `product`, `cta`. **Balasan asisten tidak pernah berisi HTML
atau markdown bebas** — UI merender kartu, bukan menafsirkan teks. Ini sekaligus pertahanan terhadap
prompt injection yang mencoba menyuntikkan markup.

### `RequirementSnapshot`

Append-only. Detail lengkap di `CONTEXT_ENGINE.md`.

| Field                             | Catatan                                                                    |
| --------------------------------- | -------------------------------------------------------------------------- |
| `id`, `conversationId`, `version` | naik satu tiap perubahan                                                   |
| `state`                           | `RequirementState` — semua field bertipe `TrackedValue`                    |
| `trigger`                         | `extraction` \| `clarification_answer` \| `user_edit` \| `default_applied` |
| `createdAt`                       |                                                                            |

**Invarian RS-1.** Snapshot tidak pernah diubah atau dihapus. Perubahan berarti snapshot baru. Ini
memberi jalur undo gratis untuk alur "Perbaiki asumsi ini → hitung ulang", dan memberi evaluasi korpus
transisi state yang nyata.

---

## 5. Catalog

### `CatalogVersion`

| Field                                   | Catatan                                                    |
| --------------------------------------- | ---------------------------------------------------------- |
| `id`, `label`                           | mis. `v2.4` — muncul di UI sebagai "KATALOG PRALON · v2.4" |
| `sourceDocument`                        | mis. "Katalog produk Pralon 2026"                          |
| `effectiveFrom`, `importedBy`, `status` | `draft` \| `active` \| `archived`                          |

Tepat satu versi berstatus `active`. Impor baru masuk sebagai `draft`, divalidasi, lalu dipromosikan.

### `Product`

| Field                                     | Provenance bila null                                              |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `id`, `sku`, `name`, `family`, `category` | — (wajib)                                                         |
| `material`                                | `UNAVAILABLE`                                                     |
| `standard`                                | `UNAVAILABLE`                                                     |
| `pressureClass` (tekanan kerja)           | `UNAVAILABLE` → "Lihat dokumen teknis"                            |
| `rodLength` (panjang batang)              | `UNAVAILABLE`                                                     |
| `jointType` (sambungan)                   | `UNAVAILABLE`                                                     |
| `application`                             | `UNAVAILABLE`                                                     |
| `status`                                  | `active` \| `discontinued`                                        |
| `sourceDocument`, `sourcePage`            | wajib — dirender sebagai "Katalog produk Pralon 2026 · hal. 14"   |
| `imageUrl`                                | placeholder bergaris bila kosong, tidak pernah gambar produk lain |

**Invarian C-1.** Field spesifikasi yang kosong dirender `UNAVAILABLE`, **tidak pernah diisi tebakan**.
Contoh nyata di desain: `Tekanan kerja` pada Pralon PVC AW bernilai "Lihat dokumen teknis" — itu
perilaku yang benar, bukan data yang kurang lengkap.

**Invarian C-2.** Hanya produk Pralon yang masuk ke katalog. Produk kompetitor boleh disebut sebagai
konteks percakapan tetapi tidak pernah menjadi record, sehingga tidak mungkin muncul sebagai kartu
(SPEC §5 Policy 1). Filter terakhir ada di batas perakitan respons, bukan hanya di prompt.

### `ProductSize`, `ProductSpec`, `ProductCompatibility`

`ProductSize` menyimpan `PipeSize` kanonik + ketersediaan. `ProductCompatibility` menghubungkan pipa ke
fitting yang sepadan — inilah sumber blok "FITTING YANG SEPADAN" di drawer produk, dan bukan hasil
tebakan LLM.

---

## 6. Rule registry

### `EngineeringRule` + `RuleVersion`

| Field                         | Catatan                                                   |
| ----------------------------- | --------------------------------------------------------- |
| `ruleId`                      | mis. `ENG-002`                                            |
| `category`                    | fixture demand, sizing, elevation, material, …            |
| `version`                     | naik saat formula berubah                                 |
| `inputSchema`, `outputSchema` |                                                           |
| `formula`                     | implementasi di `packages/engineering`                    |
| `sourceReference`             | rujukan standar/dokumen, bila ada                         |
| `validationStatus`            | `REQUIRES_DOMAIN_VALIDATION` \| `VALIDATED` \| `REJECTED` |
| `validatedBy`, `validatedAt`  |                                                           |
| `testCases`                   | wajib ada minimal satu                                    |

**Invarian R-1.** Aturan tanpa test case tidak bisa didaftarkan.
**Invarian R-2.** Perubahan formula = versi baru, bukan edit. Recommendation lama tetap merujuk versi
yang dipakai saat itu, sehingga laporan lama tetap bisa dijelaskan.

Isi registry awal (14 aturan) ada di `ENGINEERING_RULES.md`. Semuanya berstatus
`REQUIRES_DOMAIN_VALIDATION` sampai ahli domain Pralon ditunjuk (OQ-06).

### `CalculationTrace`

| Field                                       | Catatan                                     |
| ------------------------------------------- | ------------------------------------------- |
| `recommendationId`, `ruleId`, `ruleVersion` |                                             |
| `inputs`, `output`, `provenance`            |                                             |
| `explanation`                               | teks pendek untuk kolom "DASAR PERHITUNGAN" |

**Invarian T-1.** Setiap nilai teknik yang tampil punya minimal satu trace. Kolom "DASAR PERHITUNGAN"
di tabel BOM dan disclosure "Tampilkan detail teknis" dirender **dari trace**, bukan dari prosa yang
ditulis LLM. Inilah yang membuat auditabilitas SPEC §8 terlihat oleh pengguna, bukan sekadar tercatat
di log.

---

## 7. Recommendation

### `Recommendation`

| Field                                | Catatan                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| `id`, `conversationId`, `snapshotId` | snapshot kebutuhan yang dipakai                                                         |
| `catalogVersionId`                   | dibekukan saat pembuatan                                                                |
| `headline`, `body`                   | prosa dari LLM, **hanya menjelaskan** angka yang sudah dihitung                         |
| `stats`                              | titik air, jalur utama, cabang, sambungan fixture, jumlah produk (5 statistik layar 06) |
| `createdAt`                          |                                                                                         |

**Invarian REC-1.** `headline` dan `body` tidak boleh memuat angka yang tidak ada di `SystemLine`,
`BomItem`, atau `stats`. Diverifikasi dengan pemeriksaan pasca-generasi: angka di prosa diekstrak dan
dicocokkan dengan nilai terhitung; bila ada yang tidak cocok, prosa dibuang dan diminta ulang. Tanpa
ini, "LLM tidak menghitung" hanya berlaku di atas kertas — model tetap bisa menyebut "sekitar 12
batang" di dalam kalimat.

### `SystemLine`

Satu baris tabel "Rekomendasi Sistem".

| Field        | Contoh                                                         |
| ------------ | -------------------------------------------------------------- |
| `name`       | Pipa distribusi utama                                          |
| `path`       | Sumber → riser                                                 |
| `size`       | `1"`                                                           |
| `reason`     | Menampung beban 8 unit fixture…                                |
| `provenance` | `VERIFIED` \| `ASSUMED`                                        |
| `traceIds`   |                                                                |
| `tone`       | warna bar: main `#DF301C`, cabang `#EE7A67`, fixture `#F4B0A3` |

### `SelectedProduct`

| Field                       | Catatan                                                                     |
| --------------------------- | --------------------------------------------------------------------------- |
| `productId`, `size`, `role` | main / riser / branch / fixture / fitting                                   |
| `matchState`                | `VERIFIED_SELECTED` \| `SIZE_NEEDS_VALIDATION` \| `INFORMATION_UNAVAILABLE` |
| `reason`                    |                                                                             |

Tiga `matchState` itu persis tiga keadaan kartu produk di layar 07.

### `BomItem`

| Field                              | Catatan                                               |
| ---------------------------------- | ----------------------------------------------------- |
| `item`, `size`, `quantity`, `unit` | batang / pcs / kaleng                                 |
| `basis`                            | teks kolom "DASAR PERHITUNGAN"                        |
| `provenance`                       | umumnya `ESTIMATED` selama dimensi bangunan belum ada |
| `traceIds`                         |                                                       |
| `unitPrice`, `subtotal`            | hanya bila `PRICING_ENABLED` (OQ-03)                  |

### `Assumption`

| Field       | Catatan                                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| `text`      | kalimat yang dibaca pengguna                                                                               |
| `fieldPath` | field kebutuhan yang terdampak — inilah yang membuat "Perbaiki asumsi ini →" bisa membuka field yang tepat |
| `ruleId`    |                                                                                                            |

### `Schematic`

Topologi terstruktur, bukan gambar (SPEC §13).

```ts
interface Schematic {
  floors: Floor[]; // level, label, elevasi, tinggi lantai (+ provenance-nya)
  nodes: Node[]; // water_source | riser | branch | fixture | fitting
  segments: Segment[]; // from, to, role, size, productId, panjang (+ provenance)
  groundLevel: '±0.00';
  titleBlock: { drawing: 'SK-01 AIR BERSIH'; scale: 'NTS'; floorHeight: string; source: string };
}
```

`titleBlock` bukan hiasan — itu blok judul gambar teknik di prototipe, dan `floorHeight` di sana
tertulis "3,50 M · ASUMSI", artinya provenance ikut tampil di gambar.

**Invarian S-1.** Skema selalu membawa catatan bahwa ia bukan gambar kerja
("SKEMATIK · BUKAN GAMBAR KERJA"). Tidak ada mode yang menghilangkannya.

---

## 8. Report dan Handoff

### `Report`

| Field                                                                     | Catatan                                                                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `number`                                                                  | format `SNTY-YYYY-MM-NNNN`, dialokasikan dari penghitung per bulan dengan unique constraint |
| `recommendationId`                                                        |                                                                                             |
| `customerName`, `projectLocation`, `consultationDate`, `installationType` | header halaman 1                                                                            |
| `catalogVersionLabel`                                                     | dibekukan                                                                                   |
| `pricingIncluded`                                                         | boolean                                                                                     |
| `status`                                                                  | `PENDING` \| `READY` \| `FAILED`                                                            |
| `fileRef`                                                                 |                                                                                             |

**Invarian RP-1.** Laporan dirakit **hanya dari data Recommendation yang tersimpan**. LLM tidak pernah
dipanggil ulang saat pembuatan laporan (SPEC §33g). Laporan yang sama harus menghasilkan isi yang sama
bila dibuat dua kali.

**Invarian RP-2.** Laporan memuat data pribadi, jadi hanya pemilik dan peran internal berwenang yang
bisa mengunduh.

### `TechnicalHandoff`

| Field                          | Catatan                                           |
| ------------------------------ | ------------------------------------------------- |
| `conversationId`, `snapshotId` |                                                   |
| `capturedNotes`                | isi blok "YANG SUDAH SAYA CATAT"                  |
| `reason`                       | mengapa perlu validasi (daftar bernomor layar 11) |
| `status`                       | `QUEUED` \| `SENT` \| `ACKNOWLEDGED` \| `CLOSED`  |
| `slaHours`                     | dari config, dirender "1×24 jam kerja"            |

Handoff membawa snapshot kebutuhan supaya janji desain — "tidak perlu menjelaskan ulang" — benar-benar
ditepati.

---

## 9. Ringkasan invarian

Daftar ini adalah spesifikasi tes, bukan sekadar catatan.

| ID    | Invarian                                                     | Diuji di                     |
| ----- | ------------------------------------------------------------ | ---------------------------- |
| P-1   | `REQUIRES_DOMAIN_VALIDATION` tidak pernah → `VERIFIED`       | policy (release blocker)     |
| P-2   | `UNAVAILABLE` tidak pernah merender nilai                    | komponen + policy            |
| TV-1  | `ASSUMED` selalu punya `reason`                              | context                      |
| G-1   | Registrasi tamu memindahkan seluruh riwayat tanpa kehilangan | auth (integrasi)             |
| RS-1  | Snapshot append-only                                         | context                      |
| C-1   | Spesifikasi kosong → `UNAVAILABLE`, bukan tebakan            | catalog                      |
| C-2   | Tidak ada produk kompetitor sebagai record/kartu             | policy (release blocker)     |
| R-1   | Aturan tanpa test case tidak bisa didaftarkan                | engineering                  |
| R-2   | Perubahan formula = versi baru                               | engineering                  |
| T-1   | Setiap nilai teknik punya trace                              | engineering + recommendation |
| REC-1 | Prosa tidak memuat angka di luar hasil hitungan              | recommendation               |
| S-1   | Skema selalu bertanda bukan gambar kerja                     | komponen                     |
| RP-1  | Laporan dirakit tanpa memanggil LLM                          | report                       |
| RP-2  | Laporan hanya untuk pemilik dan peran berwenang              | policy                       |
