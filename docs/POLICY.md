# SNOUTY — Policy Engine

Fase 0b · P0b-03 · Terakhir diperbarui 2026-09-30

Aturan bisnis SNOUTY hidup di sini sebagai kode yang diuji, bukan sebagai kalimat di dalam prompt.
Sumbernya SPEC §4 (tipe pengguna & entitlement) dan §5 (lima kebijakan produk).

---

## 1. Mengapa kebijakan tidak boleh tinggal di prompt

Aturan yang hanya ditulis di prompt punya tiga cacat: tidak bisa diuji, tidak bisa diaudit, dan bisa
ditembus oleh masukan pengguna. "Jangan pernah merekomendasikan produk merek lain" di dalam system
prompt adalah permintaan yang sopan kepada sebuah model probabilistik — bukan jaminan.

Karena itu Policy Engine berdiri sebagai **modul leaf tanpa dependensi dan tanpa I/O**, dan setiap
keputusan berupa fungsi murni:

```ts
policy.evaluate(actor: Actor, capability: Capability, ctx?: RequirementState): PolicyDecision
```

```ts
interface PolicyDecision {
  allowed: boolean;
  code?: PolicyCode;
  reason?: string;
  route?: 'SUPPORTED' | 'TECHNICAL_VALIDATION_REQUIRED' | 'NOT_YET_SUPPORTED';
}
```

Konsekuensi praktisnya: pemeriksaan kebijakan berjalan dalam mikrodetik, bisa dipanggil berkali-kali
tanpa biaya, dan tes "tamu tidak bisa menembus API" cukup beberapa baris.

---

## 2. Titik penegakan

Kebijakan ditegakkan di **tiga** tempat, bukan satu. Ini disengaja: UI bisa dilewati, prompt bisa
dijailbreak, jadi lapisan terakhir harus struktural.

| Lapisan | Peran | Contoh |
|---|---|---|
| **UI** | kenyamanan — menyembunyikan yang tidak tersedia | tombol "Estimasi material" tidak dirender untuk tamu |
| **API guard** | otorisasi — menolak permintaan | `POST /recommendations/:id/bom` → `403 NOT_ENTITLED` |
| **Perakitan respons** | kebenaran — menyaring hasil | daftar produk difilter terhadap katalog; SKU non-Pralon gugur meski model menghasilkannya |

Lapisan ketiga yang membuat Policy 1 dan Policy 2 benar-benar mengikat. Model boleh saja mengarang
nama produk; jika SKU-nya tidak ada di `products`, ia tidak pernah menjadi kartu.

---

## 3. Policy 1 — Hanya rekomendasi Pralon

**Boleh:** mengakui pertanyaan tentang kompetitor, menyebut nama merek lain sebagai konteks,
menjelaskan kriteria pemilihan yang netral.
**Tidak boleh:** merekomendasikan produk kompetitor, menampilkan kartu produk kompetitor, mengarahkan
pengguna ke kompetitor, membandingkan merek.

Implementasi mengikuti layar 08 persis:

1. Jawaban tetap netral dan menyatakan batasnya — "Saya tidak membandingkan merek lain".
2. Tampilkan kartu "KRITERIA YANG SEBAIKNYA DIPERIKSA" (3 butir: kelas tekanan, kesesuaian SNI,
   ketersediaan fitting sepadan).
3. Tampilkan **hanya** produk Pralon yang memenuhi kriteria itu.
4. Tutup dengan pernyataan jujur: SNOUTY hanya memegang data katalog Pralon, jadi tidak bisa menilai
   spesifikasi merek lain secara akurat.

Perhatikan bahwa langkah 4 bukan basa-basi hukum — ia mengubah keterbatasan menjadi alasan yang masuk
akal, dan itulah yang membuat penolakan membandingkan terasa jujur, bukan defensif.

```
Tes wajib (release blocker):
  pertanyaan apa pun yang menyebut merek lain → respons tidak pernah memuat AssistantCard
  bertipe 'product' dengan productId di luar katalog Pralon.
```

---

## 4. Policy 2 — Tanpa halusinasi

Tidak pernah mengarang: nama produk, SKU, ukuran, standar, kelas tekanan, spesifikasi, kompatibilitas,
ketersediaan, aturan teknik, nilai teknik, harga.

Ketika informasi tidak cukup, tepat tiga keluaran yang sah:

| Keluaran | Kapan | Tampilan |
|---|---|---|
| Pertanyaan klarifikasi | field kebutuhan kurang dan bisa ditanyakan | kartu klarifikasi, maks 4 pertanyaan |
| "Data belum cukup" | katalog memang tidak memuatnya | teks jujur + tawaran tim teknis |
| Validasi teknis | di luar cakupan | layar 11 |

Penegakan:

- Field spesifikasi null → `UNAVAILABLE`, dirender "Lihat dokumen teknis". Tidak diisi, tidak
  diperkirakan.
- Output terstruktur LLM divalidasi zod; gagal → ulangi sekali dengan pesan error; gagal lagi → jatuh
  ke pertanyaan klarifikasi. Output tak tervalidasi tidak pernah masuk Engineering Engine.
- Angka dalam prosa dicocokkan dengan nilai terhitung (invarian REC-1 di `DOMAIN_MODEL.md`).

---

## 5. Policy 3 — Batas rekomendasi

SNOUTY adalah bantuan perencanaan, bukan sertifikasi teknik. Kalimat ini muncul di footer laporan dan
di panel kanan, dan mengikat perilaku:

> **PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS**

| Kondisi | Hasil |
|---|---|
| Skenario industri, pabrik, bangunan besar | `TECHNICAL_VALIDATION_REQUIRED` → layar 11 |
| Kondisi kerja di luar rentang material (mis. 70 °C untuk PVC) | `TECHNICAL_VALIDATION_REQUIRED` |
| Data tidak cukup dan tidak bisa diasumsikan dengan aman | `TECHNICAL_VALIDATION_REQUIRED` |
| Aturan teknik belum divalidasi ahli | tetap jalan, tetapi output `ASSUMED`, tidak pernah `VERIFIED` |

Layar 11 **bukan layar error**, dan bedanya penting. Ia memberi tiga hal: alasan bernomor mengapa
perlu divalidasi, ringkasan "YANG SUDAH SAYA CATAT" supaya pengguna tidak mengulang cerita, dan jalan
keluar ("Kirim ke tim teknis Pralon" / "Unduh ringkasan kebutuhan") plus SLA. Mood mascot-nya `focus`,
**bukan** `fail` — aturan ini eksplisit di lembar mascot.

---

## 6. Policy 4 — Provenance nilai

Kebijakan terpenting di sistem, karena ia yang menjaga kejujuran tampilan.

```ts
type Provenance = 'VERIFIED' | 'ASSUMED' | 'ESTIMATED' | 'UNAVAILABLE';
```

Satu gerbang yang dilalui **semua** output engine:

```ts
function gateProvenance(value: EngineOutput, rule: RuleVersion): Provenance {
  if (rule.validationStatus !== 'VALIDATED') return 'ASSUMED';   // invarian P-1
  return value.hasRealDimensions ? 'VERIFIED' : 'ESTIMATED';
}
```

Karena semua melewati satu fungsi, hanya ada satu tempat untuk diuji dan tidak ada jalan memutar.

Di sisi UI, `<ProvenanceTag>` adalah satu-satunya cara merender tag status, dan ia menerima
`Provenance` — **tidak ada prop yang menerima string "TERVERIFIKASI"**. Warna tidak pernah menjadi
satu-satunya pembawa makna; tag selalu berisi teks (SPEC §33i).

Keadaan hari ini yang perlu disadari: karena OQ-06 belum terjawab, seluruh aturan teknik berstatus
`REQUIRES_DOMAIN_VALIDATION`, sehingga **setiap nilai ukuran pipa akan tampil amber "ASUMSI"**. Itu
perilaku yang benar dan jujur, tetapi layar 06 akan terlihat jauh lebih ragu daripada mockup sampai
ahli domain menandatangani aturannya.

---

## 7. Policy 5 — Scope routing

| Cakupan | Perilaku |
|---|---|
| Air bersih, hunian & komersial ringan | didukung penuh |
| Pembuangan / air kotor | **dicatat**, dinyatakan belum didukung untuk rekomendasi penuh, ditawarkan tim teknis (OQ-17) |
| Industri / pabrik / bangunan besar | `TECHNICAL_VALIDATION_REQUIRED` |

Penanganan air kotor perlu penjelasan, karena UI justru menawarkannya: chip klarifikasi memuat "Air
bersih + pembuangan", riwayat memuat "Saluran pembuangan ruko", dan layar 07 menampilkan kartu
`Pralon PVC D`. Menghapusnya dari UI berarti mengubah desain, yang bukan wewenang saya.

Maka perilakunya: kebutuhan pembuangan **diterima dan disimpan** ke dalam requirement state (sehingga
pengguna merasa didengar dan datanya sampai ke market intelligence), lalu SNOUTY menyatakan terus
terang bahwa rekomendasi pembuangan lengkap belum tersedia, dan menawarkan tim teknis. Bagian air
bersih dari permintaan campuran tetap dijawab penuh.

---

## 8. Entitlement

Satu tabel yang menjadi sumber **API guard sekaligus daftar manfaat di onboarding langkah 5**. SPEC
§33e mensyaratkan UI dibangkitkan dari tabel ini supaya keduanya tidak pernah berbeda.

```ts
type Tier = 'guest' | 'registered' | 'advanced';

const ENTITLEMENTS: Record<Capability, Tier[]> = {
  PRODUCT_QA:           ['guest', 'registered', 'advanced'],
  RECOMMENDATION:       ['guest', 'registered', 'advanced'],
  CLARIFICATION:        ['guest', 'registered', 'advanced'],
  TECHNICAL_HANDOFF:    ['guest', 'registered', 'advanced'],
  CONVERSATION_HISTORY: ['registered', 'advanced'],
  SAVE_SOLUTION:        ['registered', 'advanced'],
  CASE_ANALYSIS:        ['advanced'],
  MATERIAL_BOM:         ['advanced'],
  SCHEMATIC:            ['advanced'],
  REPORT_PDF:           ['advanced'],
};
```

Pemetaan ke tag onboarding: `guest` ada di daftar → `TAMU JUGA`; hanya `registered`+ → `AKUN`; hanya
`advanced` → `LANJUTAN`. Enam manfaat di layar onboarding dihasilkan dari tabel ini, bukan ditulis
tangan.

**Keputusan yang mendasari tabel ini (OQ-15).** Onboarding menjanjikan BOM, skema, dan analisis studi
kasus sebagai fitur akun; prototipe justru memberi tamu solusi lengkap. Saya mengikuti **janji
onboarding**, karena itulah yang dibaca pengguna, dan karena SPEC §4.4 memang mewajibkan alur
tamu → daftar → lanjut. Ini keputusan produk yang berdampak besar dan masih menunggu konfirmasi Anda.

### Alur tamu meminta fitur lanjutan

Urutannya diatur SPEC §4.4 dan tidak boleh dibalik:

1. **Pahami dulu** permintaannya — jangan menghadang sebelum menjawab.
2. **Simpan konteksnya** — requirement state tetap hidup di guest session.
3. **Tawarkan pendaftaran** lewat panel register-gate (perlu desain, OQ-27).
4. **Lanjutkan kasus yang sama** setelah mendaftar — `GuestSession.linkedUserId` diisi, kepemilikan
   percakapan berpindah, tidak ada snapshot yang hilang (invarian G-1).
5. **Tidak pernah memaksa mengetik ulang.**

Menghadang di langkah 1 adalah kesalahan yang paling mudah terjadi dan paling merusak kepercayaan.

---

## 9. Kode kebijakan

Stabil, dapat dirender klien, dipetakan ke mood mascot dan salinan Bahasa Indonesia di satu tabel.

| Kode | Arti | Mood | HTTP |
|---|---|---|---|
| `NOT_ENTITLED` | tier tidak mencukupi | `confused` | 403 |
| `COMPETITOR_COMPARISON_REFUSED` | diminta membandingkan merek | `wink` | 200 (jawaban netral) |
| `INSUFFICIENT_DATA` | katalog tidak memuatnya | `sorry` | 200 |
| `TECHNICAL_VALIDATION_REQUIRED` | di luar cakupan | `focus` | 200 |
| `SCOPE_NOT_YET_SUPPORTED` | pembuangan | `focus` | 200 |
| `RATE_LIMITED` | melewati kuota | `sorry` | 429 |
| `VALIDATION_FAILED` | DTO/output tidak valid | `confused` | 400 |

Perhatikan bahwa sebagian besar berstatus 200: penolakan kebijakan adalah **jawaban**, bukan error.
Hanya `NOT_ENTITLED`, `RATE_LIMITED`, dan `VALIDATION_FAILED` yang benar-benar menolak permintaan.

---

## 10. Rate limiting

Bagian dari kebijakan karena batasnya berbeda per tier (SPEC §22). Penghitung di Redis.

| Tier | Pesan/jam | Kasus lanjutan/hari | Skema/hari | Laporan/hari | Unggahan/hari |
|---|---|---|---|---|---|
| guest | rendah | — | — | — | 2 |
| registered | sedang | 5 | 10 | 5 | 10 |
| advanced | tinggi | 20 | 40 | 20 | 30 |
| internal | terpisah | — | — | — | — |

Angka pastinya dikonfigurasi, bukan literal. Pelanggaran mengembalikan `RATE_LIMITED` beserta
`retryAfterSec`, dirender dengan mood `sorry`.

---

## 11. Daftar tes

Tiga pertama adalah **release blocker** (SPEC §31).

| # | Tes | Berkas |
|---|---|---|
| 1 | Pertanyaan kompetitor tidak pernah menghasilkan kartu produk kompetitor | `policy/competitor.spec.ts` |
| 2 | Aturan `REQUIRES_DOMAIN_VALIDATION` tidak pernah menghasilkan `VERIFIED` | `policy/provenance-gate.spec.ts` |
| 3 | Tamu tidak bisa mengakses kapabilitas lanjutan lewat API meski UI dilewati | `policy/entitlement.spec.ts` |
| 4 | Skenario industri selalu ter-route ke `TECHNICAL_VALIDATION_REQUIRED` | `policy/scope-routing.spec.ts` |
| 5 | Kebutuhan pembuangan tercatat, tidak ditolak, dan ditandai belum didukung | `policy/scope-routing.spec.ts` |
| 6 | Setiap `ASSUMED` punya `reason` yang muncul di kartu asumsi | `policy/assumption.spec.ts` |
| 7 | Daftar manfaat onboarding sama persis dengan `ENTITLEMENTS` | `policy/entitlement-ui-sync.spec.ts` |
| 8 | Field spesifikasi null tidak pernah merender nilai | `ui/provenance-tag.spec.tsx` |
| 9 | Laporan hanya dapat diunduh pemilik dan peran berwenang | `policy/report-access.spec.ts` |

Tes nomor 7 layak diperhatikan: ia mencegah kelas bug yang tidak terlihat sampai pengguna mengeluh —
UI menjanjikan sesuatu yang API tolak.
