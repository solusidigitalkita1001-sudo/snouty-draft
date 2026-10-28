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
  standard?: string; // sumber yang dibaca pengguna: "UPC Table 703.2", "Hazen-Williams (SI)"
  validationStatus: 'REQUIRES_DOMAIN_VALIDATION' | 'VALIDATED' | 'REJECTED';
  validatedBy?: string;
  validatedAt?: string;
  testCases: TestCase<I, O>[]; // minimal satu — aturan tanpa tes tidak bisa didaftarkan
  explain: (input: I, output: O, locale?: EngineeringLocale) => string; // teks kolom "DASAR PERHITUNGAN", dua bahasa (P15-04b)
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

**Hitungan menyebut sumbernya.** Aturan mengisi `standard` dengan sumber yang bisa diperiksa
pengguna, dan kutipan itu ikut ke layar detail teknis dan ke tabel langkah hitung di laporan
(permintaan pemilik 2026-10-27). Dua macam isinya: kode plambing yang memberi angka bakunya
("UPC Table 703.2"), dan nama metode atau dokumen yang memberi rumusnya ("Hazen-Williams
(SI)", "Rumus Manning", "Metode rasional", "Joukowsky (surja tekanan)", "Kriteria perencanaan
SPAM", "KP-01 Kriteria Perencanaan Irigasi", "Noerbambang & Morimura, Perancangan dan
Pemeliharaan Sistem Plambing", "Tabel dimensi PRALON PROD/STD-04 Rev. 11").

Aritmetika dasar tidak diberi label — volume balok, debit = volume ÷ waktu, pembagian debit
per riser: rumusnya sudah terbaca di langkahnya, dan memberinya kutipan hanya mengulang
isinya (keputusan pemilik 2026-10-27). Begitu juga aturan yang dasarnya keputusan pemilik
atau kebiasaan lapangan; `sourceReference` yang menjelaskannya.

Sebuah tes menjaganya: aturan yang `sourceReference`-nya menyebut IPC, UPC, SNI, ISO,
Hazen-Williams, Manning, Joukowsky, Noerbambang, KP-01, SPAM, SPALD-T, metode rasional,
kontinuitas, atau koefisien kerugian — tetapi `standard`-nya kosong — menggagalkan suite.
Jadi sumber yang sudah tercatat di kode tidak bisa berhenti di kode.

Kode mana yang mengikat: keduanya dibaca, dan UPC menang bila berbeda (keputusan pemilik
2026-10-27, OQ-88). Beban alat air bersih memakai UPC Tabel A 103.1, beban dan kapasitas
pembuangan UPC Tabel 702.1 dan 703.2. Yang belum terbaca di UPC — beban urinoir dan alat
beraliran kontinu — masih mengutip IPC, dan aturannya menyebut kode yang dipakainya.

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

#### ENG-006 · Selisih lapangan — dihapus 2026-10-12 (TC-H-01)

Tercetak di dasar perhitungan ("berbeda 10–15 %") tetapi tidak mengubah angka apa pun. ID-nya tidak
dipakai ulang.

#### ENG-012 · Isi kamar mandi

```
1 kamar mandi = 1 shower + 1 kloset
```

Asal: kartu asumsi prototipe. Aturan inilah yang menjadi dasar bobot 2 pada ENG-001; keduanya harus
divalidasi bersama, karena kalau isi kamar mandi berbeda, bobotnya ikut salah.

#### ENG-015 · Sok sambungan antar batang pipa (Fase 27, masukan Leo 2026-10-22)

```
sambungan per jalur menerus = ⌈panjang jalur ÷ panjang batang⌉ − 1
sok                         = Σ (jumlah jalur × sambungan per jalur)
```

Masukan Leo atas laporan SNTY-2026-10-0020: _"ngitungnya pipa sisa itu di asumsikan bisa langsung
nyambung ya?, kan butuh socket buat nyambungnya lagi"_. Jumlah batang memang dihitung dari panjang
jalur ÷ panjang batang, tetapi soknya dulu ditulis "dihitung saat pemasangan" — artinya BOQ
menyuruh menyambung tanpa pernah menyebut sambungannya.

Panjang batang datang dari produk katalog yang benar-benar terpilih, bukan konstanta 4 m. Untuk
kerugian tekanan di jalur kritis — yang dihitung sebelum produk dipilih — dipakai asumsi
`PIPE_STOCK_LENGTH_4M`.

Fitting di jalur (elbow, tee) punya bell-nya sendiri dan tidak dihitung lagi. Karena potongan pipa
tidak selalu jatuh pas di fitting, angka ini **perkiraan atas**, dan BOQ mengatakannya begitu.

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

Tabel diameter dalam nominal (15–150 mm) adalah pendekatan, bukan tabel produk. **v2 (2026-10-06):**
masukan `sizeTable` memilih tabel inci (PVC) atau mm (HDPE/MDPE: OD ISO 4427 20–400 mm, diameter
dalam = OD − 2·OD/17, asumsi `HDPE_SDR17_PN10`) — `computeIrrigation` menentukan bahan (ENG-104)
lebih dulu, lalu jalur utama HDPE berukuran mm dan distribusi PVC AW tetap inci (ENG-105 v2).
ENG-205 v2 memakai tabel yang sama lewat `computePressurized` (bahan → tabel). **v3 (2026-10-09,
audit C1):** diameter dalam tidak lagi angka nominal (6" = 150 mm). PVC: OD resmi (Knowledge Master
§7.1, ½" = 22 mm … 6" = 165 mm) − 2·OD/SDR dengan asumsi `PVC_AW_WALL_SDR` 26,5 (tebal AW 4"
yang lebih tebal dari dua sumber yang bertentangan, §7.2); HDPE tetap SDR 17. SDR masuk sebagai
masukan aturan (`wallSdr`) sehingga bisa diubah dari "Perbaiki asumsi" dan tercatat di trace.
Tabel gravitasi (Kelompok H) memakai OD 8"–12" yang sama; 16" dikeluarkan karena OD-nya tidak ada
di sumber. **2026-10-14 (P21-09, menutup OQ-64):** PVC memakai tabel resmi PROD/STD-04 Rev. 11
kelas AW — diameter dalam = OD rata-rata (OD + ½ toleransi) − 2 × tebal rata-rata (tebal + ½
toleransi); ½" = 18,9 mm, ¾" = 22,3 mm, 1" = 27,9 mm, 1¼" = 37,3 mm. `PVC_AW_WALL_SDR` dihapus
dan `wallSdr` hanya berlaku untuk HDPE, yang tebalnya per OD dan SDR dari PROD/STD/014 (P21-07).

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

### Kelompok F — Hidraulik bertekanan umum (Fase 14, 2026-10-06)

Asal: rumus teknik baku (kontinuitas, Hazen-Williams, head dinamis, daya hidraulik) untuk kasus
transfer pompa, sumur, cluster, gedung. Tidak ada kurva pompa atau tabel produk; diameter dalam
memakai tabel pendekatan ENG-102. Orkestratornya `computePressurized()`; nilai yang tidak diberikan
diambil dari registry asumsi dan dicatat di `appliedAssumptionIds`. Semua `REQUIRES_DOMAIN_VALIDATION`.

```
ENG-201  A = πD²/4 ; V = Q/A
ENG-202  hf = 10,67 · L · Q^1,852 / (C^1,852 · D^4,8704)     C plastik 150, galvanis 100 (registry)
ENG-203  kerugian minor = fraksi × hf                        fraksi 0,1 (MINOR_LOSS_FRACTION)
ENG-204  TDH = statis + hf + minor + tekanan sisa (1 bar ≈ 10,2 m)
ENG-205  kandidat dari tabel nominal; status ok / too_fast (> 2 m/s) / high_loss (> 10 m/100 m) /
         too_slow (< 0,6 m/s); rekomendasi = ukuran ok terkecil; alternatif = satu ukuran di atasnya
ENG-206  P_hidraulik = ρ·g·Q·H ; daya poros = P ÷ η_pompa (η 0,6) ; beda tekanan = H ÷ 10,197
         daya masuk motor TIDAK dihitung (efisiensi motor dan cadangan dari pabrikan) — v2, audit C3
ENG-207  kerugian minor = ΣK · v²/2g dari DAFTAR fitting di jalur kritis (Fase 27)
```

#### ENG-207 · Kerugian minor dari daftar fitting (Fase 27, masukan Leo 2026-10-22)

Masukan Leo: _"rumus rumus pressure loss di pipa sama fitting nya gw gk bisa langsung cek gitu..
kan harus diitung dulu"_. ENG-203 menaksir kerugian sambungan sebagai 10 % kerugian gesek — satu
angka tanpa isi, yang tidak bisa diperiksa. Di jalur rumah fittingnya sudah diketahui (ENG-708
menghitungnya), jadi kerugiannya dihitung dari daftar itu dan **tiap sukunya tercetak** — jenis,
jumlah, K, dan hasilnya:

```
h = ΣK · v²/(2g)         K per jenis dari registry asumsi MINOR_K_*

masuk pipa 0,5 · stop kran terbuka 0,2 · elbow 90° 0,9 · elbow 45° 0,4
tee arah cabang 1,8 · tee arah lurus 0,6 · reducer 0,3 · sok 0,1
```

Jalur kritis air bersih rumah = sumber → titik air tertinggi: 1 masuk pipa, 1 stop kran, elbow pipa
utama + cabang + turun ke alat + drat kran, 1 tee tempat cabang keluar, dan sok antar batang
sepanjang jalur. ENG-203 tetap dipakai untuk kasus yang daftar fittingnya belum ada.

Akibat ikutan: **ENG-703 naik ke v3**. Dudukan toren yang disarankan kini ikut menanggung kerugian
di pipa tegak yang ditambahkan (dulu diabaikan sebagai "beberapa sentimeter"); sejak kerugian
sambungan dihitung per fitting, selisih itu cukup besar untuk membuat saran lamanya masih kurang.

Rumus yang dicetak di laporan juga diperbaiki: substitusinya memakai **satuan yang benar-benar
masuk ke rumus** (m³/s dan m), bukan hanya l/s dan mm — tanpa itu angkanya tidak bisa dimasukkan
ulang ke rumusnya, yang persis keluhan Leo.

### Kelompok G — Kolam / tambak ikan (Fase 14, laporan pemilik "tambak lele 4 x 4 meter")

Asal: geometri dan kontinuitas; tanpa aerasi/filtrasi/kualitas air. Orkestrator `computePond()`
memakai ENG-102 untuk pipa masuk. Semua `REQUIRES_DOMAIN_VALIDATION`.

```
ENG-301  V = panjang × lebar × tinggi air × jumlah kolam        tinggi air 1 m bila tak disebut
ENG-302  Q_isi = V / t_isi                                       t_isi 3 jam bila tak disebut
ENG-102  D_masuk dari Q_isi pada 1,5 m/s → PVC AW
ENG-303  Q_kuras = V_kolam / t_kuras ; D_kuras = √(4Q/πv), v 1 m/s   t_kuras 1 jam → PVC D
ENG-304  BOM: pipa masuk = jalur (10 m bila tak disebut) + 2 m/kolam ; pipa kuras = (air + 0,3) +
         1 + ½ panjang kolam per kolam ; elbow, tee (kolam > 1), stop kran, sok drat, lem
```

Contoh: 4 × 4 m, air 1 m → 16 m³, 1,48 l/s, pipa masuk 1½" AW, pipa kuras 3" D.

### Kelompok H — Gravitasi, air hujan, gorong-gorong, jaringan cluster (Fase 14)

Asal: Manning, metode rasional, dan kebutuhan domestik baku. **Intensitas hujan tidak pernah
dikarang** — masukan wajib dari pengguna/data setempat. Gorong-gorong hanya dihitung hidrauliknya;
strukturnya ditandai "perlu validasi". Orkestrator `computeGravity()` (drainase | air hujan |
gorong-gorong) dan `computeNetwork()` (cluster → Kelompok F). Semua `REQUIRES_DOMAIN_VALIDATION`.

```
ENG-401  V = (1/n) · (D/4)^(2/3) · S^(1/2) ; Q_penuh = V · A        n plastik 0,010 (registry)
ENG-402  ukuran nominal terkecil (½"–16") dengan Q_rencana ≤ 80 % Q_penuh dan V_penuh ≥ 0,6 m/s;
         kemiringan 0,5 % bila tak disebut
ENG-403  Q = 2,78 · C · I (mm/jam) · A (ha) → l/s                  C perumahan 0,6 bila tak disebut
ENG-404  timbunan minimum = max(0,6 m [1,0 m beban berat], 1 × D) → memadai / wajib validasi struktural
ENG-405  Q_rata = sambungan × 4 orang × 150 l/hari ÷ 86 400 ; Q_puncak = Q_rata × 2,0
ENG-406  air limbah (P22-05): Q_rata = SR × 5 jiwa × 100 l/hari × 0,8 kembali ÷ 86 400 ; Q_puncak = × 2,5
ENG-407  air limbah: ukuran ≥ minimum pipa air limbah jaringan 6" (150 mm) — dinaikkan bila hidraulik lebih kecil
ENG-408  jiwa → sambungan rumah: ⌈jiwa ÷ 5⌉ (SPAM dan air limbah)
ENG-406 v2 (P22-08): + infiltrasi 10 % × Q_rata
ENG-409  SPAM (P22-08): Q_rata = domestik × (1 + non-domestik 15 %) ÷ (1 − NRW 20 %); Q_hari maks = × 1,15
         (transmisi, reservoir); Q_jam puncak = × 1,75 (distribusi)
ENG-410  reservoir distribusi = 20 % × volume hari maksimum
ENG-411  kelas tekanan: PN ≥ max(tinggi statis, head pompa) × 1,10 → PN 6,3/8/10/12,5/16/20 ↔ SDR 26/21/17/13,6/11/9
ENG-412  air limbah, aliran sebagian (Manning segmen lingkaran): d/D dan v pada Q_rencana; v ≥ 0,6 m/s, ≤ 3 m/s,
         d/D ≤ 0,8; S_min ≈ S × (0,6 ÷ v)²
ENG-413  profil air limbah: manhole = ⌈L ÷ 50 m⌉ + 1; penurunan = L × S; galian akhir = 1 m + penurunan; > 4 m →
         stasiun pompa angkat / jalur dipecah
ENG-414  SPAM (audit PDAM): pipa induk + N cabang seragam — Q_induk = Q_puncak, Q_cabang = Q_puncak ÷ N, SR/cabang =
         ⌈SR ÷ N⌉, panjang cabang = 50 % induk (asumsi); N tidak disebut → satu pipa bertanda "topologi diasumsikan"
ENG-415  head titik kritis = statis + Σ kehilangan (induk + satu cabang terjauh, diameter dalam aktual) + tekanan sisa
ENG-416  mode sistem: reservoir & head ≤ 0 → gravitasi; PDAM ≥ head → suplai langsung; PDAM < head → booster sebesar
         kekurangan; sumber tanpa tekanan → pompa penuh. Titik kerja pompa (ENG-206) hanya sebesar kekurangan.
ENG-701/ENG-801 batas tabel: beban alat > 100 WSFU di luar kurva debit puncak yang dipakai — kasusnya
         diserahkan ke tim teknis lewat kebijakan cakupan (OQ-87), bukan dihitung dengan angka karangan
ENG-417  air hujan atap: sisi atap = √luas tangkapan; turunan talang = 2 × ⌈sisi ÷ jarak antar turunan⌉
         (jarak 15 m = asumsi pemilik, menunggu ahli Pralon); jumlah yang disebut pengguna menggantikannya
ENG-418  limpasan dibagi rata ke turunan talangnya: Q_turunan = Q_total ÷ jumlah turunan — ukuran pipa,
         jumlah pipa, dan fitting dihitung per turunan
ENG-411 v2: PN ≥ (tekanan kerja maks + surja) × 1,10; surja Joukowsky Δh = a·v/g hanya pada mode berpompa
         (a PE 300 m/s, PVC 400 m/s — asumsi); katalog tanpa PN → produk "perlu dikonfirmasi", bukan dikarang
```

Jaringan air minum / SPAM (P22-05): `computeNetwork({ kind: 'water_supply' })` memakai asumsi SPAM
(SPAM_DEMAND_LPCD_100, SPAM_PERSONS_PER_CONNECTION_5, SPAM_PEAK_HOUR_FACTOR_1_75) dan menerima jiwa
sebagai pengganti SR (ENG-408); cluster tetap 150 l / 4 orang / faktor 2. Jaringan air limbah:
`computeGravity({ kind: 'sewer' })` — ENG-408 → ENG-406 → ENG-402 → ENG-407 → ENG-401. Contoh: 200 SR →
0,93 l/s rata-rata, 2,31 l/s puncak → hidraulik 3" pada 0,5 % → dipakai 6". OQ-70.

Contoh: 20 l/s pada 1 % → 8" (47 % kapasitas); 0,5 ha × 100 mm/jam → 83,4 l/s → 12";
120 unit → 1,67 l/s puncak → 1½" bertekanan.

### Kelompok I — Air bersih gedung bertingkat (2026-10-09, keputusan pemilik)

Asal: metode buku acuan plambing Indonesia (Noerbambang & Morimura). Gedung di atas 4 lantai tidak
lagi berhenti di kartu "perlu tim teknis": susunan baku tangki bawah → pompa transfer → tangki atap →
riser turun per zona dihitung. Orkestrator `computeBuildingWater()`: ENG-501…504 lalu Kelompok F
untuk pipa transfer (debit jam puncak, dipompa) dan riser (debit menit puncak, gravitasi). Riser
dibagi bila satu riser PVC terbesar tidak memenuhi kriteria kecepatan/kerugian; transfer naik ke
HDPE bila PVC tidak cukup. Semua `REQUIRES_DOMAIN_VALIDATION`; asumsi baru di OQ-57.

```
ENG-501  penghuni = luas lantai × lantai ÷ 10 m²/orang            (hanya bila penghuni tak disebut)
ENG-502  Qd = penghuni × 150 l ; Qh = Qd ÷ 10 jam ; Qh-maks = 2,0 × Qh ; Qm-maks = 3,0 × Qh ÷ 60
         v2: debit dalam l/s tidak dibulatkan di tengah rantai (audit C2: 300 m³/jam, bukan 299,99)
ENG-503  v2 (audit C4): tekanan statik lantai k = (tinggi gedung − (k−1)·tinggi lantai) ÷ 10,197
         dari muka air tangki atap setinggi atap. Dari atas: < tekanan sisa → booster; ≤ batas zona →
         gravitasi; sisanya zona berkatup penurun tekanan, tiap zona ⌊(batas − sisa) ÷ tinggi lantai⌋ + 1
         lantai mulai dari tekanan sisa di lantai teratasnya. Tabel zona menyebut lantai, elevasi, dan
         tekanan atas/bawah; tekanan sisa ≥ batas zona ditolak. Kaki riser: tekanan statik total.
ENG-504  debit per riser = Qm-maks ÷ jumlah riser
ENG-505  debit per lantai = Qm-maks ÷ lantai ; induk lantai = √luas lantai (20 m bila luas tak ada)
         → ukuran induk lantai lewat Kelompok F; titik per lantai ENG-001, cabang ENG-003, ½" ENG-005
         (hanya bila kamar mandi/wastafel per lantai disebut)
ENG-506  v2 (audit C5): tangki bawah = Qd × 1 hari (pasokan selama hari itu tidak dikurangkan) ;
         tangki atap VE = (Qm-maks − Qpompa) × 30 menit + Qpompa × 10 menit (siklus pompa,
         `PUMP_CYCLE_10MIN`) ; volume efektif
```

Contoh (laporan pemilik "gedung 100 x 30, 12 lantai"): 3 600 orang → 540 m³/hari → 30 l/s jam
puncak, 45 l/s menit puncak; tinggi 42 m → 2 zona, booster 2 lantai teratas; transfer PVC AW 6"
dengan pompa 108 m³/jam @ 47,8 m; 2 riser 6". Regresi dengan hitungan acuan independen:
`packages/engineering/src/regression/building-reference.spec.ts` (kasus 5 000 m² × 20 lantai × 90 m).

BOM gedung (audit C6) hanya jalur tegak: panjang bersih (tinggi gedung × riser, tinggi + jalur
datar untuk transfer) ÷ panjang batang produk katalog terpilih (`pipe-quantity.ts`), dibulatkan ke
batang utuh tanpa sisa potongan. Pipa tiap lantai tidak lagi dihitung jumlahnya dari √luas × lantai.

### Kelompok J — Pembuangan rumah (2026-10-12, laporan pemilik "kok ngga mau ngitung")

Instalasi "Pembuangan" atau "Keduanya" untuk rumah dan bangunan kecil dihitung, bukan diteruskan ke
tim teknis (OQ-17). Dua jalur: air kotor (kloset → septic tank) dan air bekas (floor drain/shower,
wastafel, bak cuci dapur → saluran atau resapan), pipa PVC D. Tanpa ukuran rumah tidak ada jumlah
batang; dengan ukuran rumah panjangnya diperkirakan (ENG-603, OQ-60). Semua `REQUIRES_DOMAIN_VALIDATION`; nilai dari Uniform Plumbing Code
(keputusan pemilik 2026-10-27, OQ-88: kedua kode dibaca, UPC menang bila berbeda) sampai padanan
SNI 8153 dikonfirmasi tim teknis. Yang belum terbaca di UPC — beban urinoir dan alat beraliran
kontinu — masih mengutip IPC, dan aturannya menyebut kode yang dipakainya.

```
ENG-601  beban air kotor = kloset × 3 DFU ; air bekas = shower/floor drain × 2 + wastafel × 1
         + bak cuci dapur × 2                         (UPC Tabel 702.1; asumsi DFU_* di registry)
ENG-602  ukuran = pipa terkecil dengan kapasitas ≥ beban pada kemiringan ¼ inci per kaki (2,08 %)
         menurut UPC Tabel 703.2 — 2" 8, 2½" 14, 3" 35, 4" 216, 5" 428, 6" 720 — tidak lebih
         kecil dari alat terbesar (kloset 4" — SOIL_LINE_MIN_4IN; floor drain 2", bak cuci 1½",
         wastafel 1¼"); ventilasi = ukuran terkecil ≥ ½ diameter jalur, minimal 1¼" (UPC 904.1)
ENG-604  bangunan ≥ 2 lantai: cabang mendatar lantai terberat dan pipa tegak (total semua lantai)
         menurut UPC Tabel 703.2 — mendatar 1½" 1, 2" 8, 2½" 14, 3" 35, 4" 216 DFU; tegak 2, 16,
         32, 48, 256 DFU. UPC tidak memisahkan beban per interval cabang seperti IPC, jadi satu
         batas berlaku untuk pipa tegak berapa pun lantainya. ENG-602 v2: ukuran jalur =
         maks(saluran bangunan, alat terbesar, ENG-604); ventilasi dari ukuran baru.
ENG-603  perkiraan panjang (hanya bila ukuran rumah diketahui, OQ-60): air kotor = sisi terpanjang
         + tinggi lantai × (lantai − 1); air bekas = sisi terpanjang; ventilasi = lantai × tinggi
         lantai + 1 m di atas atap (HOUSE_VENT_ABOVE_ROOF_1M)
ENG-605  fitting pembuangan (P18-01, keputusan pemilik 2026-10-13, OQ-63): per jalur di ukuran
         jalurnya — Y-branch = alat × FITTING_DRAIN_Y_PER_FIXTURE_1 + (lantai − 1) ×
         FITTING_STACK_Y_PER_UPPER_FLOOR_1; elbow 45° = FITTING_STACK_BASE_ELBOW45_2 per pipa tegak;
         clean out = FITTING_CLEANOUT_PER_LINE_1 per jalur. Tanpa cadangan; tidak butuh ukuran rumah.
```

Contoh (laporan pemilik): rumah 2 lantai, 3 kamar mandi, 1 dapur → air kotor 12 DFU → 4" (ventilasi
2"); air bekas 8 DFU → 2" (ventilasi 1¼").

### Kelompok K — Air bersih rumah (2026-10-12, "koreksi itungannya udh bener belom")

Menggantikan ambang prototipe ENG-002 (unit beban ≥ 8 → 1", selain itu 3/4") dan rumus material
ENG-009 ("2 + lantai batang", "3 × kamar mandi elbow") di `computeSolution`; keduanya tidak lagi
dijalankan. ENG-001 v2: kamar mandi = dua titik air (shower + kloset).

```
ENG-701  WSFU = kloset × 2,5 + shower × 2,0 + wastafel × 1,0 + bak cuci dapur × 1,5 (UPC Tabel
         A 103.1, kolom pribadi) → debit puncak dari kurva Hunter kloset tangki (IPC E103.3(3),
         karena kurva UPC hanya terbit sebagai grafik — OQ-88)
ENG-801  toilet umum: kloset × 2,5 + keran/wastafel × 1,0 + urinoir × 2,0 (UPC kolom umum);
         rumah ibadah memakai kolom pertemuan: kloset × 3,5, urinoir × 3,0
ENG-702  titik tertinggi = (lantai − 1) × tinggi lantai + 2 m (shower); toren atap = lantai × tinggi
         lantai + 1 m; jalur = beda tinggi + jalur datar (disebut / panjang + lebar rumah / 20 m)
Kel. F   ukuran pipa utama dari kecepatan ≤ 2 m/s dan kehilangan ≤ batas; toren atap: batas
         kehilangan = (beda tinggi − 0,3 bar) ÷ jalur, supaya titik tertinggi tetap ≥ 0,3 bar
ENG-703  tekanan dari toren di titik tertinggi; < 0,3 bar → pompa pendorong / toren lebih tinggi
         PDAM: tekanan yang dibutuhkan di meteran = TDH; toren bawah/pompa: titik kerja pompa
ENG-707  isi tiap cabang (laporan 0009): titik tiap lantai diisi ke cabang berurutan — kamar mandi
         (tidak dipisah), wastafel, bak cuci dapur — maks 4 titik; beban cabang = jumlah WSFU isinya
ENG-008 v2 (laporan 0015): sebaran alat per lantai dibagi rata dan jumlahnya selalu sama dengan masukan;
         sisa kamar mandi ke lantai teratas, sisa wastafel ke lantai 1, dapur di lantai 1. Engine
         memeriksa keseimbangan (per lantai, Σ titik dan WSFU cabang, Σ DFU per lantai) dan melempar
         EngineConsistencyError bila tidak seimbang.
ENG-704 v2 / ENG-708 v2 (review 0015): cabang terakhir di ujung pipa utama (terjauh dari sumber — lantai 1
         untuk toren atap, lantai teratas untuk sumber di bawah) disambung elbow, ditambah reducer bila
         cabangnya lebih kecil; tee = jumlah cabang − 1. Skema menggambar EL-n di lantai ujung.
ENG-604 v2 (review 0015): ukuran minimum alat terbesar berlaku juga untuk cabang dan pipa tegak.
ENG-601 / ENG-602 v3 / ENG-604 v3 (OQ-88, 2026-10-27): beban dan kapasitas pembuangan dari UPC.
         Angka 2½" tidak ada di cetakan CPC 2025 dan diambil dari kutipan UPC King County.
ENG-702 v3 (review putaran 3): sumber sumur menambah kedalaman muka air (water.wellDepthM, default
         WELL_WATER_DEPTH_6M) ke beda tinggi dan jalur.
ENG-703 v2 (review putaran 3): bila tekanan toren kurang, dudukan minimum = dudukan + (tinggi 0,3 bar +
         kehilangan − beda tinggi), dibulatkan ke atas per 0,5 m; heightShort bila beda tinggi < tinggi 0,3 bar.
         boosterPumpNeeded hanya dari aturan ini; pompa sumber (sumur, toren bawah) = sourcePumped.
ENG-605 v2 (review putaran 3): Y = jumlah alat (cabang lantai atas masuk pipa tegak lewat Y alatnya);
         elbow 45° kaki pipa tegak hanya bila > 1 lantai; + sambungan ventilasi dan topi ventilasi per jalur.
ENG-710  tekanan di meteran untuk mengisi toren atap = muka air toren + gesek pipa pengisi + 10% sambungan pada
         TANK_FILL_FLOW_0_25LS (review putaran 3, 5b).
ENG-709  pompa sumur: muka air > SURFACE_PUMP_SUCTION_7M → pompa jet / submersible (OQ-66).
ENG-711  pilihan dudukan toren (P22-04, masukan pengguna rumah subsidi): tekanan di titik tertinggi untuk
         dak atap (pelat atap + TANK_STAND_1M) dan tiang toren TANK_TOWER_HEIGHTS_M (3/4/5/6/8 m + TANK_STAND_1M)
         dengan kehilangan pipa utama yang sama; tiang yang muka airnya tidak di atas dak tidak ditawarkan.
         recommendedIndex = terendah ≥ RESIDUAL_GRAVITY_0_3BAR; comfortableIndex = terendah ≥
         RESIDUAL_GRAVITY_COMFORT_0_7BAR (shower deras, Noerbambang & Morimura 0,7 kg/cm²). OQ-67.
ENG-708  fitting air bersih (P18-01, keputusan pemilik 2026-10-13, OQ-63): elbow pipa utama
         FITTING_MAIN_ELBOWS_2; elbow pengisi toren FITTING_TANK_FILL_ELBOWS_2 (hanya toren atap
         dengan ukuran rumah); elbow per cabang FITTING_BRANCH_ELBOW_1 di ukuran cabangnya; elbow
         ½" FITTING_OUTLET_ELBOW_1 dan faucet elbow FITTING_OUTLET_FAUCET_ELBOW_1 per titik air.
         Tanpa cadangan; tidak butuh ukuran rumah. Menggantikan rumus elbow prototipe ENG-009.
ENG-102  tiap cabang dari debit bebannya sendiri (Hunter) pada 1,5 m/s — cabang beda isi bisa
         beda ukuran; material cabang per ukuran (jumlah cabang × sisi terpanjang)
ENG-705  halaman = sisi terpanjang tanah − sisi terpanjang bangunan (≥ 0) — meteran PDAM, septic
         tank, dan saluran di depan tanah, bangunan di belakang; hanya bila ukuran tanah dan
         bangunan diketahui. ENG-702 v2: jalur sumber di bawah (PDAM, pompa, toren bawah) + halaman;
         toren atap tidak. ENG-603 v2: air kotor dan air bekas + halaman. ENG-603 v3: air bekas juga
         + tinggi lantai × (lantai − 1). ENG-010 v2: batas 0,6–2 m/s dan rencana 1,5 m/s dari registry.
ENG-706  pipa pengisi toren atap (hanya toren atap + ukuran bangunan) = halaman + sisi terpanjang
         bangunan + muka air toren; ukuran ¾" asumsi (TANK_FILL_PIPE_3_4IN)
ENG-704  perkiraan panjang (hanya bila ukuran rumah diketahui, OQ-60): cabang = jumlah cabang × sisi
         terpanjang; sambungan = titik air × 1,5 m (HOUSE_FIXTURE_DROP_1_5M); tee = 1 per cabang
```

Material: pipa utama dari panjang jalur yang disebut atau dari ukuran rumah; cabang, sambungan, tee,
dan jalur pembuangan dari ENG-704/ENG-603 (P16-60, keputusan pemilik 2026-10-12). Jumlah batang =
panjang ÷ panjang batang produk katalog terpilih yang ukurannya memang ada; tanpa produk seukuran,
jumlahnya dalam meter. Fitting dipilih menurut fungsinya (tee / Y) dan ukuran utama di namanya.

**2026-10-12 (P16-56):** ENG-002, ENG-009, ENG-011 dihapus dari registry — tidak dijalankan sejak
Kelompok K; ID-nya tidak dipakai ulang. ENG-003 v2: cabang dihitung per lantai (⌈titik lantai ÷ 4⌉,
minimal satu cabang per lantai yang punya titik air). Hasil lama dikenali dari trace (`outdatedRules`)
dan laporan mencetak stempel versi aturan (`rulesetStamp`). Dapur yang belum disebut dianggap satu (`HOUSE_KITCHEN_1`).

### Kelompok M — Renovasi (Fase 23, pemilik 2026-10-19: "inget dari semua case yah")

Lapisan di atas hitungan kasus mana pun (`computeRenovation`, `packages/engineering/src/compute-renovation.ts`):
kasusnya tetap mengukur pipa untuk bagian yang dikerjakan; aturan ini menjawab yang hanya ada pada instalasi yang
sudah terpasang. Parameter: `work_type` (Bangun baru / Ganti semua pipa / Ganti sebagian / Perluasan),
`existing_pipe_size`, `existing_pipe_material`, `existing_outlets` / `existing_connections`,
`replacement_length`. "Renovasi" tanpa jenis membuat jenis pekerjaannya ditanya, bukan ditebak.

```
ENG-901  kapasitas pipa lama (perluasan): cukup bila diameter luar pipa lama + 1 mm ≥ diameter luar ukuran yang
         dibutuhkan beban total menurut aturan kasusnya (inci lewat tabel PRALON AW PROD/STD-04, mm = OD ISO 4427);
         selisih dalam %. Kurang → jalur utama lama disebut diganti, panjangnya tidak diketahui → tidak masuk BOM.
ENG-902  sambungan ke pipa lama: PVC → tee lem (reduksi bila cabang lebih kecil); galvanis/besi → potong, 2 sok
         drat seukuran + tee; HDPE → tee HDPE; PPR → fitting fusi bukan lini Pralon → tim teknis; bahan tidak
         disebut → tee, ditandai perlu dipastikan.
ENG-903  penggantian sebagian: panjang = min(yang diganti, jalur); rasio = panjang ÷ jalur (1 bila jalur tidak
         diketahui); sok penyambung RENOV_COUPLINGS_PER_SEGMENT_2; baris pipa BOM dikali rasio (dibulatkan ke atas).
ENG-904  beban total perluasan = beban lama + beban baru (titik air atau sambungan) — satu trace untuk cek ENG-901.
```

Asumsi: RENOV_COUPLINGS_PER_SEGMENT_2, RENOV_REPLACE_WHOLE_ROUTE, RENOV_EXISTING_OUTLET_1_WSFU (rumah: titik air
lama dihitung setara wastafel saat beban total dihitung ulang dengan ENG-701). Semua `REQUIRES_DOMAIN_VALIDATION`
(OQ-71).

## 4. Tabel pelacak validasi

Cerminan dari tabel di `PROGRESS.md`; yang di `PROGRESS.md` adalah salinan kerja.

| ID      | Deskripsi                                                | Asal           | Status                     | Prioritas validasi |
| ------- | -------------------------------------------------------- | -------------- | -------------------------- | ------------------ |
| ENG-001 | Unit beban + jumlah titik air                            | prototipe baru | REQUIRES_DOMAIN_VALIDATION | **tinggi**         |
| ENG-002 | Ambang ukuran jalur utama (≥ 8 unit → 1")                | prototipe baru | REQUIRES_DOMAIN_VALIDATION | **tertinggi**      |
| ENG-003 | Maks 4 titik air per cabang                              | keduanya       | REQUIRES_DOMAIN_VALIDATION | tinggi             |
| ENG-004 | Tinggi lantai default 3,5 m                              | keduanya       | REQUIRES_DOMAIN_VALIDATION | sedang             |
| ENG-005 | Sambungan fixture 1/2"                                   | keduanya       | REQUIRES_DOMAIN_VALIDATION | sedang             |
| ENG-006 | Selisih lapangan 10–15% (dihapus)                        | keduanya       | —                          | —                  |
| ENG-007 | Urutan klarifikasi                                       | prototipe      | REQUIRES_DOMAIN_VALIDATION | rendah             |
| ENG-008 | Distribusi titik air antar lantai                        | prototipe      | REQUIRES_DOMAIN_VALIDATION | sedang             |
| ENG-009 | Formula kuantitas BOM                                    | prototipe      | REQUIRES_DOMAIN_VALIDATION | tinggi             |
| ENG-010 | Kecepatan aliran 1–2 m/s                                 | prototipe      | REQUIRES_DOMAIN_VALIDATION | sedang             |
| ENG-011 | Gravitasi toren cukup tanpa pompa                        | prototipe      | REQUIRES_DOMAIN_VALIDATION | **tinggi**         |
| ENG-012 | 1 kamar mandi = shower + kloset                          | prototipe      | REQUIRES_DOMAIN_VALIDATION | tinggi             |
| ENG-013 | Kelas AW / D                                             | board 08       | REQUIRES_DOMAIN_VALIDATION | sedang             |
| ENG-014 | Default "Belum tahu"                                     | prototipe      | REQUIRES_DOMAIN_VALIDATION | sedang             |
| ENG-711 | Pilihan dudukan toren: dak / tiang                       | P22-04         | REQUIRES_DOMAIN_VALIDATION | tinggi             |
| ENG-406 | Debit air limbah dari sambungan rumah                    | P22-05         | REQUIRES_DOMAIN_VALIDATION | tinggi             |
| ENG-407 | Ukuran minimum pipa air limbah 6"                        | P22-05         | REQUIRES_DOMAIN_VALIDATION | sedang             |
| ENG-408 | Sambungan rumah dari jumlah jiwa                         | P22-05         | REQUIRES_DOMAIN_VALIDATION | sedang             |
| ENG-409 | Kebutuhan SPAM: non-domestik, NRW, hari maks, jam puncak | P22-08         | REQUIRES_DOMAIN_VALIDATION | tinggi             |
| ENG-410 | Volume reservoir 20 % hari maksimum                      | P22-08         | REQUIRES_DOMAIN_VALIDATION | sedang             |
| ENG-411 | Kelas tekanan PN dari tekanan kerja                      | P22-08         | REQUIRES_DOMAIN_VALIDATION | tinggi             |
| ENG-412 | Aliran sebagian air limbah, S minimum                    | P22-08         | REQUIRES_DOMAIN_VALIDATION | tinggi             |
| ENG-413 | Manhole, penurunan, kedalaman galian                     | P22-08         | REQUIRES_DOMAIN_VALIDATION | sedang             |
| ENG-414 | Debit per segmen: induk + N cabang seragam               | audit PDAM     | REQUIRES_DOMAIN_VALIDATION | tinggi             |
| ENG-415 | Head jalur kritis per segmen                             | audit PDAM     | REQUIRES_DOMAIN_VALIDATION | tinggi             |
| ENG-416 | Mode sistem: gravitasi/PDAM/booster/pompa                | audit PDAM     | REQUIRES_DOMAIN_VALIDATION | tinggi             |
| ENG-417 | Jumlah turunan talang dari sisi atap                     | OQ-86          | REQUIRES_DOMAIN_VALIDATION | tinggi             |
| ENG-418 | Limpasan atap dibagi per turunan talang                  | OQ-86          | REQUIRES_DOMAIN_VALIDATION | tinggi             |

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

**Seluruh aturan berstatus `REQUIRES_DOMAIN_VALIDATION`**, dan konsekuensinya diuji: seluruh
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
