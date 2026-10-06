# SNOUTY — Engineering Rule Engine

Fase 0b · P0b-06 · Terakhir diperbarui 2026-09-30

Semua perhitungan teknik SNOUTY. Deterministik, berversi, dapat diuji, dan dapat ditelusuri.
Sumbernya SPEC §8. **Tidak ada satu pun aturan di sini yang boleh dihitung oleh LLM** (SPEC §25).

---

## 1. Kondisi hari ini — harap dibaca lebih dulu

Seluruh 14 aturan di dokumen ini berstatus **`REQUIRES_DOMAIN_VALIDATION`**. Semuanya diambil dari
prototipe desain, yang menurut handoff-nya sendiri bersifat ilustratif ("the prototypes' logic … is
illustrative"). Belum ada satu pun yang berasal dari standar teknik atau dari ahli Pralon.

Konsekuensi langsungnya, karena invarian P-1:

> Sampai seorang ahli domain Pralon memvalidasi aturan-aturan ini, **tidak ada satu pun ukuran pipa
> yang boleh tampil sebagai hijau "TERVERIFIKASI"**. Semuanya amber "ASUMSI".

Layar 06 dalam mockup menampilkan tiga baris TERVERIFIKASI. Produk yang sebenarnya, hari ini, akan
menampilkan ketiganya sebagai ASUMSI. Itu bukan bug — itu kejujuran yang diminta SPEC §5 Policy 4 —
tetapi selisihnya nyata dan sebaiknya diketahui sekarang, bukan saat demo Fase 7. Ini sebabnya OQ-06
(menunjuk ahli domain) berdampak jauh lebih besar daripada kesannya.

---

## 2. Anatomi sebuah aturan

```ts
interface RuleVersion<I, O> {
  ruleId: string; // 'ENG-002'
  version: number; // naik saat formula berubah, tidak pernah diedit di tempat
  category: RuleCategory;
  inputSchema: ZodSchema<I>;
  outputSchema: ZodSchema<O>;
  compute: (input: I) => O; // murni: tanpa I/O, tanpa jam, tanpa acak
  sourceReference?: string; // standar / dokumen / hasil wawancara ahli
  validationStatus: 'REQUIRES_DOMAIN_VALIDATION' | 'VALIDATED' | 'REJECTED';
  validatedBy?: string;
  validatedAt?: string;
  testCases: TestCase<I, O>[]; // minimal satu — aturan tanpa tes tidak bisa didaftarkan
  explain: (input: I, output: O) => string; // teks kolom "DASAR PERHITUNGAN"
}
```

Empat sifat yang membuat ini bekerja:

**`compute` murni.** Tanpa I/O, tanpa `Date.now()`, tanpa acak. Masukan sama selalu menghasilkan
keluaran sama, sehingga laporan bisa dibuat ulang identik bertahun kemudian.

**Versi, bukan edit.** Mengubah formula berarti versi baru. Recommendation lama tetap menunjuk versi
yang dipakai saat itu, jadi laporan lama tetap bisa dijelaskan meski aturannya sudah berubah.

**`explain` menempel pada aturan.** Kolom "DASAR PERHITUNGAN" dan disclosure "Tampilkan detail teknis"
dirender dari fungsi ini, bukan dari prosa LLM. Penjelasan dan perhitungan tidak akan pernah
berbeda karena keduanya keluar dari sumber yang sama.

**Test case wajib.** Registry menolak aturan tanpa tes (invarian R-1).

### Trace

Setiap eksekusi menulis satu `CalculationTrace`:

```ts
{
  (recommendationId, ruleId, ruleVersion, inputs, output, provenance, explanation);
}
```

Inilah yang membuat auditabilitas SPEC §8 terlihat oleh pengguna dan bukan sekadar tersimpan di log.

### Gerbang provenance

Satu-satunya jalan keluar dari engine:

```ts
function gateProvenance(out: EngineOutput, rule: RuleVersion): Provenance {
  if (rule.validationStatus !== 'VALIDATED') return 'ASSUMED';
  return out.hasRealDimensions ? 'VERIFIED' : 'ESTIMATED';
}
```

---

## 3. Registry aturan

Status semua: `REQUIRES_DOMAIN_VALIDATION`. Kolom "Asal" menunjukkan dari mana angkanya diambil.

**Registry asumsi terpusat (Fase 14).** Angka default yang dipakai aturan — debit satuan irigasi,
kecepatan rencana, tinggi antar lantai, ambang HDPE, jarak lateral, koefisien Hazen-Williams —
tidak lagi hidup sebagai konstanta di dalam berkas aturan, melainkan di
`packages/engineering/src/parameters/assumptions.ts` dengan **ID**, rujukan, keyakinan, dan kalimat
untuk pengguna. Aturan membacanya lewat `assumption(id).value`. Mengubah satu angka = mengubah satu
entri, dan kartu asumsi di layar solusi menampilkan ID yang sama. Rincian: `docs/CONTEXT_ENGINE.md` §11.

### Kelompok A — Beban dan sizing

#### ENG-001 · Unit beban fixture dan jumlah titik air

```
outletCount = bathrooms + basins + kitchens          // "Titik air" di UI
loadUnits   = bathrooms × 2 + basins + kitchens      // unit beban fixture
```

Asal: prototipe baru. Contoh di board (3 kamar mandi, 4 wastafel, 1 dapur) menghasilkan 8 titik air
dan 11 unit beban, dan angka "8 titik air" itulah yang muncul di seluruh desain.

Yang perlu divalidasi ahli: apakah bobot 2 untuk kamar mandi mewakili shower + kloset dengan benar,
dan apakah pendekatan unit beban sederhana ini memadai dibanding tabel fixture unit standar.

#### ENG-002 · Ambang ukuran jalur utama dan riser

```
mainSize = loadUnits >= 8 ? '1"' : '3/4"'
```

Asal: prototipe baru. **Perhatian:** prototipe lama dan SPEC §33b menyebut `fixtures >= 6`, dengan
`fixtures` yang definisinya juga berbeda. Contoh kerja di board cocok dengan versi baru (OQ-22).

Ini aturan paling berpengaruh di sistem — ia menentukan angka terbesar di layar ringkasan. Ambang
tunggal tanpa memperhitungkan panjang jalur, elevasi, atau kerugian gesek hampir pasti
penyederhanaan; validasi ahli di sini prioritas tertinggi.

#### ENG-003 · Maksimum titik air per cabang

```
maxOutletsPerBranch = 4
```

Asal: kedua prototipe. Muncul di UI sebagai "Melayani maksimal 4 titik air per cabang."

#### ENG-005 · Ukuran sambungan fixture

```
fixtureConnectionSize = '1/2"'
```

Asal: kedua prototipe. Di desain, baris ini sudah ditandai **ASUMSI** bahkan di mockup — satu-satunya
baris tabel sistem yang begitu.

#### ENG-010 · Kecepatan aliran target

```
targetVelocity = 1–2 m/s
```

Asal: teks "DETAIL TEKNIS" prototipe. Saat ini hanya dikutip sebagai penjelasan, belum dipakai untuk
menghitung apa pun. Bila nanti sizing benar-benar berbasis kecepatan, ENG-002 kemungkinan besar
digantikan olehnya.

#### ENG-013 · Panduan kelas tekanan

```
air bersih bertekanan → kelas AW
pembuangan            → kelas D
```

Asal: kartu kriteria board layar 08. Ini aturan pemilihan material, bukan sizing, dan dipakai
Product Matcher.

### Kelompok B — Geometri dan elevasi

#### ENG-004 · Tinggi antar lantai default

```
floorHeightM = 3.5   // bila pengguna tidak memberi nilai
```

Asal: kedua prototipe. Muncul di blok judul skema sebagai "TINGGI LANTAI · 3,50 M · ASUMSI" — jadi
provenance-nya memang tampil di gambar.

#### ENG-008 · Distribusi titik air antar lantai

```
untuk i = nFloors ke 1:
  bathHere  = (i === nFloors) ? ceil(bathrooms / nFloors) : floor(bathrooms / nFloors)
  basinHere = basins > 0 ? max(1, round(basins / nFloors)) : 0
  dapur ditempatkan di lantai 1
elevasi lantai i = (i - 1) × floorHeightM
```

Asal: prototipe baru. Ini murni heuristik gambar — sistem tidak tahu denah sebenarnya. Semua node
yang dihasilkan bertanda `ASSUMED`.

Batas 3 lantai pada prototipe **tidak** dibawa: itu keterbatasan rendering, bukan aturan teknik
(OQ-33).

#### ENG-011 · Kecukupan gravitasi toren atap

```
untuk hunian / komersial ringan dengan sumber toren atap:
  boosterPump = tidak diperlukan
```

Asal: kalimat prototipe "tekanan gravitasi umumnya cukup tanpa pompa pendorong". Ini klaim teknik
yang cukup berani untuk dibuat tanpa mengetahui tinggi toren maupun panjang jalur, dan termasuk yang
paling perlu ditinjau ahli.

### Kelompok C — Material

#### ENG-009 · Formula kuantitas BOM

```
Pipa PVC AW mainSize : 2 + nFloors            batang   (jalur utama + riser)
Pipa PVC AW 3/4"     : 3 + bathrooms          batang   (cabang)
Tee 3/4"             : bathrooms + 2          pcs
Elbow 90° 3/4"       : bathrooms × 3          pcs
Reducer mainSize→3/4": nFloors                pcs
```

Asal: prototipe baru. Tidak satu pun memakai panjang jalur sebenarnya, karena itu semua baris BOM
berstatus `ESTIMATED` selama `building.dimensions` kosong — persis seperti tag desain
"ESTIMASI · DIMENSI BELUM LENGKAP".

Laporan dua halaman menambahkan satu baris yang tidak ada di prototipe: **Lem PVC, 100 gr, 2 kaleng**.
Belum ada formulanya; ini dicatat sebagai lubang yang harus diisi bersama ahli.

#### ENG-006 · Selisih lapangan

```
variance = 10–15%
```

Asal: kedua prototipe, tampil sebagai catatan kaki tabel material.

#### ENG-012 · Isi kamar mandi

```
1 kamar mandi = 1 shower + 1 kloset
```

Asal: kartu asumsi prototipe. Aturan inilah yang menjadi dasar bobot 2 pada ENG-001; keduanya harus
divalidasi bersama, karena kalau isi kamar mandi berbeda, bobotnya ikut salah.

### Kelompok D — Alur percakapan

#### ENG-007 · Urutan prioritas klarifikasi

```
water.source → water.installationType → building.floors → fixtures.bathrooms
```

Asal: prototipe baru. Board layar 03 memakai urutan berbeda (OQ-23). Bukan aturan teknik dalam arti
sempit, tetapi diberi ID karena memengaruhi data apa yang tersedia saat perhitungan berjalan.

#### ENG-014 · Default "Belum tahu"

```
water.source           → 'Toren atap'
water.installationType → 'Air bersih'
```

Asal: prototipe baru. Keduanya default yang relevan secara teknik dan disajikan kepada pengguna
sebagai asumsi, jadi harus melewati proses validasi yang sama.

### Kelompok E — Irigasi (OQ-47, 2026-10-06)

Asal: **bukan prototipe** (prototipe hanya mendesain bangunan) — keputusan pemilik bahwa irigasi
dihitung seperti rumah. Rumusnya kriteria teknik umum yang terdokumentasi, bukan ingatan model;
rujukan tertulis di `sourceReference` tiap aturan. Semua `REQUIRES_DOMAIN_VALIDATION`.
Orkestratornya `computeIrrigation()`, terpisah dari `computeSolution()`: masukannya luas lahan,
metode, jarak sumber, dan posisi sumber — bukan field bangunan.

#### ENG-101 · Debit rencana

```
designFlowLs = areaHa × duty      duty: genangan 1,5 · sprinkler 0,8 · tetes 0,5  (l/s/ha)
```

KP-01 Kriteria Perencanaan Irigasi (padi ±1,2–1,5 l/s/ha); sprinkler/tetes praktik umum.

#### ENG-102 · Diameter jalur utama dari debit

```
D_min = √(4Q / πv)   dengan v = 1,5 m/s (pipa plastik 1–2 m/s)
mainSize = ukuran nominal terkecil dengan diameter dalam ≥ D_min
```

Tabel diameter dalam nominal (15–150 mm) adalah pendekatan, bukan tabel produk.

#### ENG-103 · Kebutuhan tekanan dan pompa

```
pumpRequired = metode ≠ genangan  ATAU  sumber tidak lebih tinggi dari lahan
pressureClass = pumpRequired ? AW : D
```

Sprinkler ±2–3 bar dan tetes ±1–1,5 bar di emitter; genangan gravitasi tanpa tekanan.

#### ENG-104 · Bahan per segmen

```
mainFamily = mainRunMeters ≥ 200 ? HDPE : PVC AW ;  distributionFamily = PVC AW
```

#### ENG-105 · Panjang dan BOM estimasi

```
sisi = √(areaHa × 10 000) ; distribusi ≈ 2 × sisi ; cabang = ⌈sisi / 25⌉
HDPE per meter ; PVC batang 4 m ; tee = cabang ; elbow 4 ; katup = cabang + 1
```

Tata letak lahan dianggap bujur sangkar dengan satu lateral tiap 25 m — asumsi tata letak, bukan
desain lahan; itulah sebabnya BOM-nya `ASSUMED`.

---

## 4. Tabel pelacak validasi

Cerminan dari tabel di `PROGRESS.md`; yang di `PROGRESS.md` adalah salinan kerja.

| ID      | Deskripsi                                 | Asal           | Status                     | Prioritas validasi |
| ------- | ----------------------------------------- | -------------- | -------------------------- | ------------------ |
| ENG-001 | Unit beban + jumlah titik air             | prototipe baru | REQUIRES_DOMAIN_VALIDATION | **tinggi**         |
| ENG-002 | Ambang ukuran jalur utama (≥ 8 unit → 1") | prototipe baru | REQUIRES_DOMAIN_VALIDATION | **tertinggi**      |
| ENG-003 | Maks 4 titik air per cabang               | keduanya       | REQUIRES_DOMAIN_VALIDATION | tinggi             |
| ENG-004 | Tinggi lantai default 3,5 m               | keduanya       | REQUIRES_DOMAIN_VALIDATION | sedang             |
| ENG-005 | Sambungan fixture 1/2"                    | keduanya       | REQUIRES_DOMAIN_VALIDATION | sedang             |
| ENG-006 | Selisih lapangan 10–15%                   | keduanya       | REQUIRES_DOMAIN_VALIDATION | rendah             |
| ENG-007 | Urutan klarifikasi                        | prototipe      | REQUIRES_DOMAIN_VALIDATION | rendah             |
| ENG-008 | Distribusi titik air antar lantai         | prototipe      | REQUIRES_DOMAIN_VALIDATION | sedang             |
| ENG-009 | Formula kuantitas BOM                     | prototipe      | REQUIRES_DOMAIN_VALIDATION | tinggi             |
| ENG-010 | Kecepatan aliran 1–2 m/s                  | prototipe      | REQUIRES_DOMAIN_VALIDATION | sedang             |
| ENG-011 | Gravitasi toren cukup tanpa pompa         | prototipe      | REQUIRES_DOMAIN_VALIDATION | **tinggi**         |
| ENG-012 | 1 kamar mandi = shower + kloset           | prototipe      | REQUIRES_DOMAIN_VALIDATION | tinggi             |
| ENG-013 | Kelas AW / D                              | board 08       | REQUIRES_DOMAIN_VALIDATION | sedang             |
| ENG-014 | Default "Belum tahu"                      | prototipe      | REQUIRES_DOMAIN_VALIDATION | sedang             |

Bila waktu ahli terbatas, empat yang bertanda tinggi/tertinggi memberi hasil terbesar: ENG-002
menentukan angka utama, ENG-001 dan ENG-012 memberinya masukan, ENG-011 menentukan apakah pompa perlu
disarankan sama sekali.

---

## 5. Alur validasi (back-office Fase 6)

Belum ada desainnya (OQ-21); dibangun minimal dengan token yang ada.

```
REQUIRES_DOMAIN_VALIDATION ──► ahli meninjau formula + test case ──► VALIDATED   (boleh VERIFIED)
                                                                  └─► REJECTED   (aturan diganti)
```

Layar ini menampilkan: formula, test case beserta hasilnya, asal aturan, dan di mana aturan itu
memengaruhi tampilan pengguna. Setiap keputusan menulis `rule_validations` dan `audit_logs` beserta
identitas serta waktunya. Mempromosikan aturan ke `VALIDATED` berarti nilai yang dihasilkannya
berubah dari amber menjadi hijau di seluruh produk — jadi tindakan itu harus terekam jelas milik
siapa.

---

## 6. Pengujian

| Lapisan              | Cakupan                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Test case per aturan | wajib, minimal satu, tersimpan bersama aturan                                                                                                                |
| Properti             | monotonisitas: menambah titik air tidak pernah **mengecilkan** ukuran pipa                                                                                   |
| Regresi              | contoh kerja board (3 kamar mandi, 4 wastafel, 1 dapur, 2 lantai, toren atap) harus tetap menghasilkan 8 titik air, jalur utama 1", cabang 3/4", 5 baris BOM |
| Gerbang provenance   | aturan belum tervalidasi tidak pernah menghasilkan `VERIFIED` (release blocker)                                                                              |
| Kemurnian            | `compute` dipanggil 1.000 kali dengan masukan sama menghasilkan keluaran identik                                                                             |

Target cakupan `packages/engineering`: **≥ 95%**. Paket ini tidak punya I/O, jadi tidak ada alasan
teknis untuk cakupan rendah.

Uji regresi terhadap contoh board bernilai khusus: ia mengunci perilaku ke satu-satunya contoh kerja
yang sudah ditinjau manusia dan digambar di desain.

---

## 7. Batas

Yang **tidak** dilakukan engine ini hari ini, dan sebaiknya tidak dipura-purakan bisa:

- Perhitungan kerugian gesek (Hazen-Williams / Darcy-Weisbach).
- Perhitungan tekanan di titik terjauh.
- Sizing pembuangan — kemiringan, ventilasi, unit beban drainase (di luar cakupan, OQ-17).
- Kurva pompa dan pemilihan pompa.
- Derating material terhadap suhu — inilah sebabnya kasus 70 °C ter-route ke validasi teknis.
- Perhitungan simultanitas / faktor kebersamaan pemakaian.

Setiap kali kebutuhan pengguna menyentuh daftar ini, jalurnya adalah
`TECHNICAL_VALIDATION_REQUIRED`, bukan perkiraan. Mengetahui batas dan mengatakannya adalah bagian
dari produk, bukan kekurangannya — persis seperti persona yang ditetapkan desain: "tidak pernah
menebak ukuran pipa".

---

## 8. Status implementasi (Fase 6)

Engine terbangun di `packages/engineering`, masih **tanpa satu pun dependensi runtime** — dijaga
`scripts/check-engineering-isolation.mjs`, yang menggagalkan CI bila ada. Properti itu yang membuat
SPEC §25 benar secara struktural.

| Bagian                            | Berkas                              |
| --------------------------------- | ----------------------------------- |
| Anatomi `RuleVersion` + registry  | `src/rule.ts`, `src/registry.ts`    |
| Kelompok A (beban, sizing, kelas) | `src/rules/group-a-load-sizing.ts`  |
| Kelompok B (geometri, elevasi)    | `src/rules/group-b-geometry.ts`     |
| Kelompok C (material)             | `src/rules/group-c-material.ts`     |
| Kelompok D (alur percakapan)      | `src/rules/group-d-conversation.ts` |
| Gerbang provenance                | `src/provenance.ts`                 |
| Orkestrator + trace               | `src/compute-solution.ts`           |

**Keempat belas aturan berstatus `REQUIRES_DOMAIN_VALIDATION`**, dan konsekuensinya diuji: seluruh
keluaran engine `ASSUMED`, tidak ada satu pun angka teknik yang tampil `VERIFIED`, dan dimensi bangunan
yang nyata pun tidak menaikkannya. Itu perilaku yang benar sampai OQ-06 menunjuk ahli domain Pralon.

Tiga penyimpangan dari sumber, semuanya disengaja dan tercatat:

- **ENG-002** memakai ambang prototipe baru (`loadUnits >= 8`), bukan `fixtures >= 6` dari prototipe lama
  dan SPEC §33b (OQ-22). Contoh kerja board cocok dengan versi baru.
- **Batas 3 lantai** prototipe tidak dibawa — keterbatasan rendering, bukan aturan teknik (OQ-33).
- **Baris "Lem PVC, 100 gr, 2 kaleng"** dari laporan dua halaman tidak ada di BOM, karena formulanya
  memang belum ada. Ada tes yang menjaga ketiadaannya; mengarang formula untuk melengkapi tabel adalah
  halusinasi yang berpakaian rapi.

Validasi masukan memakai guard TypeScript murni (`requireInt`, `requireNumber`) alih-alih skema zod
seperti §2 — alasannya di **OQ-42**: zod akan menjadi dependensi runtime pertama paket ini dan merobohkan
pagar isolasi. Validasi zod tetap ada di tepi (`apps/api`), tempat keluaran ekstraksi sudah divalidasi.

**Belum:** alur validasi back-office (§5) menunggu desain layar internal (**OQ-21**). Engine sudah siap
menerimanya — `validationStatus`, `validatedBy`, dan `validatedAt` ada di `RuleVersion` sejak sekarang,
dan `RULE_REGISTRY.awaitingValidation()` mengembalikan daftar kerjanya.
