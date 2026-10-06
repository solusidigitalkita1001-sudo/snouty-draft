# SNOUTY — Evaluasi AI

Fase 0c · P0c-13 · Terakhir diperbarui 2026-09-30

Bagaimana kita tahu bagian AI benar-benar bekerja, dan tahu saat ia memburuk. Sumbernya SPEC §31b.

---

## 1. Mengapa evaluasi, bukan hanya tes

Tes unit menjawab "apakah kode ini benar". Evaluasi menjawab "apakah model masih memahami pengguna
kita". Keduanya berbeda karena keluaran model bisa berubah tanpa satu baris kode pun berubah —
penyedia memperbarui model, temperatur bergeser, prompt disunting sedikit.

Tanpa evaluasi, kemunduran ekstraksi hanya ketahuan lewat keluhan pengguna. Dengan evaluasi, ia
ketahuan di pull request.

---

## 2. Golden dataset

Di `evals/`, berkas JSON yang dikelola manual dan direview seperti kode.

```ts
interface EvalCase {
  id: string;
  input: string; // pesan berbahasa Indonesia
  priorState?: RequirementState; // untuk kasus multi-giliran
  expected: {
    intent: Intent;
    requirement?: Partial<ExtractedRequirement>;
    missingFields?: FieldPath[];
    policyOutcome?: PolicyCode | 'ALLOWED';
    route?: 'SUPPORTED' | 'TECHNICAL_VALIDATION_REQUIRED' | 'NOT_YET_SUPPORTED';
    /**
     * Kasus teknis umum (Fase 14): kasus yang harus terdeteksi (`null` = bukan jalur teknis) dan
     * parameter universal yang harus terbaca dari kalimat — dinilai deterministik, tanpa model,
     * jadi ambangnya 100 % (`technicalMatch`). `notFilled` = parameter yang TIDAK boleh terisi.
     */
    technical?: {
      caseId: CaseId | null;
      parameters?: Record<ParameterKey, number | string | boolean>;
      notFilled?: ParameterKey[];
    };
  };
  tags: string[];
}
```

### Kumpulan awal — dari desain itu sendiri

Alur contoh di prototipe dan board bukan sekadar ilustrasi; itu adalah perilaku yang sudah ditinjau
manusia, jadi ia menjadi kasus uji pertama.

| Kasus                   | Masukan                                                                                                                        | Yang diuji                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Rumah 2 lantai lengkap  | "Rumah 2 lantai dengan 3 kamar mandi, 4 wastafel, 1 dapur, air bersih, toren di atap"                                          | ekstraksi penuh, tidak ada field kurang                        |
| Rumah 2 lantai sebagian | "Saya sedang bangun rumah 2 lantai dengan 3 kamar mandi, 4 wastafel, 1 dapur, dan toren di atap. Apa saja yang saya butuhkan?" | `installationType` kurang                                      |
| Toren lantai 2          | "Saya punya toren di lantai 2, pipa apa yang cocok?"                                                                           | sumber terdeteksi, **`floors` tidak boleh terisi 2**           |
| Pertanyaan merek        | "Lebih bagus Pralon atau brand X?"                                                                                             | `COMPETITOR_QUESTION`, kriteria netral, tanpa kartu kompetitor |
| Jalur pabrik            | "Jalur air proses pabrik, suhu 70°C, panjang 200 meter"                                                                        | `TECHNICAL_VALIDATION_REQUIRED`                                |
| Rumah 1 lantai          | "Instalasi air bersih untuk rumah baru 1 lantai"                                                                               | ekstraksi minimal                                              |
| Jawab "Belum tahu"      | chip "Belum tahu" pada sumber air                                                                                              | default diterapkan + ditandai `ASSUMED`                        |
| Mutasi kebutuhan        | "Kalau kamar mandi saya tambah satu?"                                                                                          | `REQUIREMENT_MUTATION`, **nol panggilan ekstraksi**            |
| Pertanyaan penjelasan   | "Kenapa pakai ukuran 1" di jalur utama?"                                                                                       | `EXPLANATION_REQUEST`, state tidak berubah                     |
| Pembuangan              | "Saluran pembuangan ruko 2 lantai"                                                                                             | dicatat, `NOT_YET_SUPPORTED`                                   |
| Campuran                | "Air bersih + pembuangan"                                                                                                      | bagian air bersih dijawab, pembuangan dicatat                  |
| Tidak ada dapur         | "Rumah 2 lantai, 2 kamar mandi, tidak ada dapur"                                                                               | `kitchens: 0`, bukan `null`                                    |
| Lookup ukuran           | "Ada ukuran 3/4 inch?"                                                                                                         | `PRODUCT_LOOKUP` → jalur MySQL, bukan vektor                   |
| Masukan kacau           | "pipa"                                                                                                                         | `UNCLEAR` → klarifikasi, mood `confused`                       |

Tiga kasus bernilai khusus karena menguji pembedaan yang mudah salah:

**"Toren di lantai 2"** — prototipe sendiri punya penjaga khusus (`!/toren di lantai/`) agar angka 2
tidak terbaca sebagai jumlah lantai bangunan. Kasus ini mengunci perilaku itu.

**Mutasi vs penjelasan** — salah klasifikasi di sini berarti mengubah kebutuhan pengguna tanpa
diminta, kesalahan yang jauh lebih mahal daripada bertanya.

**"Tidak ada dapur"** — membedakan "dinyatakan nol" dari "tidak disebut". Bila keduanya jadi `null`,
sistem akan menanyakan ulang hal yang sudah dijawab.

Target ukuran: 50 kasus pada Fase 4, 150 pada Fase 6, terus bertambah dari kegagalan nyata.

---

## 3. Metrik

Diukur **per field**, bukan hanya keseluruhan.

| Metrik                   | Cara hitung                                    | Ambang   |
| ------------------------ | ---------------------------------------------- | -------- |
| Akurasi intent           | cocok persis                                   | ≥ 95%    |
| Akurasi per field        | per field, cocok persis                        | ≥ 90%    |
| **Laju halusinasi**      | field terisi padahal masukan tidak menyebutnya | **0%**   |
| Presisi field kurang     | field kurang yang teridentifikasi benar        | ≥ 90%    |
| Kesesuaian kebijakan     | hasil kebijakan cocok                          | **100%** |
| Kelolosan validasi skema | keluaran lolos zod pada percobaan pertama      | ≥ 95%    |
| Kesesuaian routing       | tingkat model cocok                            | ≥ 90%    |

Dua ambang bernilai mutlak, dan itu disengaja:

**Halusinasi harus 0%.** Model yang mengisi `floors: 2` dari kalimat yang tidak menyebut lantai lebih
berbahaya daripada model yang mengosongkannya — karena yang kosong akan ditanyakan, sedangkan yang
salah akan dihitung.

Untuk prosa penjelasan, padanannya adalah angka yang tidak pernah dihitung (REC-1). Laju itu terbaca
dari produksi, bukan hanya dari golden dataset: `recommendations.prose_source` mencatat `llm`
(lolos sekali), `llm_retry` (percobaan pertama ditolak), atau `template` (ditolak dua kali) — lihat
OQ-44.

**Kesesuaian kebijakan harus 100%.** Kebijakan ditegakkan di kode, jadi kegagalan di sini berarti
ada jalur yang melewati penegakan.

Pengukuran per field penting: akurasi 90% yang selalu meleset di `waterSource` adalah masalah yang
sama sekali berbeda dari 90% yang menyebar merata — yang pertama berarti satu pertanyaan klarifikasi
selalu muncul, yang kedua berarti kebisingan acak.

---

## 4. Menjalankan evaluasi

```bash
pnpm eval                      # seluruh dataset
pnpm eval --tag extraction     # sebagian
pnpm eval --compare <baseline> # bandingkan dengan hasil tersimpan
```

Keluaran: tabel per metrik, rincian per field, dan daftar kasus yang gagal beserta keluaran
sebenarnya. Hasil disimpan sehingga dua model atau dua versi prompt bisa dibandingkan langsung.

_Status 2026-10-06 (P13-04):_ runner-nya `apps/api/scripts/eval.mjs`, dataset `apps/api/evals/cases.json`
(18 kasus: 14 dari §2 + 4 dari laporan pemilik 5–6 Okt). Ia memakai adapter dan pipa yang **sama**
dengan produksi dari `dist/` — `OpenRouterAiService` → presedensi kebutuhan → grounding → merge →
kelengkapan → kebijakan — jadi yang diukur adalah model + prompt + pagar kode bersama. Butuh
`pnpm --filter @snouty/api build` lebih dulu dan variabel LLM di `.env` (dibaca otomatis). Respons
di-cache per hash di `apps/api/.eval-cache/` (`--no-cache` untuk memaksa), hasil ke
`apps/api/evals/results/<waktu>-<model>.json` (keduanya di luar git). Ambang §3 ditegakkan: keluar
dengan kode 1 bila ada yang gagal atau regresi > 2 poin terhadap `--compare`. Satu metrik
tambahan di luar §3: **parse pertanyaan produk** (aspek/ukuran), karena jalur FAQ/lookup kini ada.
Kasus `prior` membentuk state lewat `mergeRequirement` (deterministik), bukan lewat giliran model.

**Baseline pertama — qwen2.5:7b-instruct (Ollama, CPU laptop), 2026-10-06, 18 kasus, 41 panggilan,
501 s latensi model:** 10/18 kasus lolos. Intent 88,9% · per field 82,1% · halusinasi 14,3% ·
presisi field kurang 50% · kebijakan 100% · parse produk 100% · skema lolos percobaan pertama
55,6% · routing 100%. Yang terbaca dari rinciannya:

- Halusinasi satu-satunya ("rumah baru 1 lantai" → `source: municipal`) ditutup di kode hari itu
  juga: `water.source` dan `water.installationType` kini butuh penanda di pesan (grounding).
- Kelolosan skema 55,6% adalah sifat model 7B: ekstraksi gagal validasi dua kali pada
  "tidak ada dapur" (`kitchens: 0`) dan "kos 3 lantai … pompa dari sumur". Ini metrik pemilihan
  model, bukan kode — model yang lebih besar (14B di server cp-1, atau model berbayar) diukur
  dengan runner yang sama dan dibandingkan lewat `--compare`.
- "pipa" dilabeli `REQUIREMENT_STATEMENT` dan "PDAM" (jawaban klarifikasi) `REQUIREMENT_STATEMENT`
  — yang kedua tidak mengubah hasil (keduanya mengekstrak), yang pertama berarti pertanyaan balik
  tidak muncul. Keduanya kandidat perbaikan prompt intent; belum disentuh supaya baseline jujur.

Ambang §3 adalah ambang **rilis** — model yang tidak melewatinya tidak dipakai di produksi.

### Di CI

Berjalan bila ada perubahan pada berkas terkait AI: prompt, skema ekstraksi, routing model, intent
router, atau dataset itu sendiri. Tidak dijalankan pada setiap PR — panggilan model berbiaya, dan
perubahan CSS tidak mengubah akurasi ekstraksi.

Menggagalkan build bila: ambang mana pun turun, atau ada regresi terhadap baseline > 2 poin
persentase.

Job `evals` di `ci.yml` dinyalakan pemilik lewat variabel repositori `EVAL_ENABLED=true` + secret
`OPENROUTER_API_KEY` (+ variabel `OPENROUTER_BASE_URL`, `LLM_MODEL_FAST/BALANCED/STRONG`); tanpa
itu job dilewati. Ia memeriksa sendiri apakah berkas AI berubah (`ai/`, `context/`, `policy/`,
`evals/`, `scripts/eval.mjs`) dan mengunggah hasilnya sebagai artefak. Ollama lokal tidak bisa
dipakai dari CI — baseline lokal disimpan dan dibandingkan manual sampai ada model yang terjangkau
dari GitHub (OQ-09: ID model Pralon).

---

## 5. Biaya dan determinisme

Evaluasi memanggil model sungguhan, jadi ia berbiaya. Pengendaliannya:

|                                                                                                       |     |
| ----------------------------------------------------------------------------------------------------- | --- |
| `temperature: 0` pada semua pemanggilan evaluasi                                                      |     |
| Respons di-cache berdasarkan hash (prompt + model), sehingga menjalankan ulang tanpa perubahan gratis |     |
| Subset bertanda untuk iterasi cepat; dataset penuh sebelum merge                                      |     |
| Anggaran biaya per eksekusi dicatat dan dilaporkan                                                    |     |

Perlu diakui bahwa `temperature: 0` tidak menjamin determinisme penuh pada model modern. Karena itu
ambangnya berupa rentang, bukan nilai persis, dan regresi kecil di bawah 2 poin tidak dianggap
kegagalan.

---

## 6. Melacak biaya di produksi

Terpisah dari evaluasi tetapi memakai data yang sama (`llm_calls`).

| Dilaporkan di admin                                 |                                                |
| --------------------------------------------------- | ---------------------------------------------- |
| Token & biaya per percakapan                        |                                                |
| Biaya per model                                     |                                                |
| Biaya per intent — menjawab "fitur mana yang mahal" |                                                |
| Proporsi interaksi jalur nol-LLM                    | ukuran langsung keberhasilan eksekusi selektif |
| Percakapan termahal                                 | untuk diperiksa                                |

Ketika Anda menetapkan anggaran (OQ-10), penegakan sudah tersedia dari data ini.

---

## 7. Umpan balik pengguna

Jempol atas/bawah per jawaban asisten, dengan alasan opsional. Antarmukanya belum didesain (OQ-21).

Nilainya bukan pada rata-rata skornya, melainkan pada jawaban bertanda jempol bawah yang **ditinjau
lalu dimasukkan ke golden dataset**. Itu yang mengubah keluhan menjadi perbaikan yang terukur.

Hal yang sama berlaku untuk tombol "tandai analisis salah" di tinjauan email.

---

## 8. Yang tidak dievaluasi di sini

|                    | Diuji di mana                                                         |
| ------------------ | --------------------------------------------------------------------- |
| Perhitungan teknik | tes unit `packages/engineering` — deterministik, tidak perlu evaluasi |
| Product matching   | tes unit — deterministik                                              |
| Kebijakan          | tes unit + kasus evaluasi untuk hasil yang bergantung intent          |
| Pembentukan skema  | tes unit                                                              |
| Perakitan laporan  | tes unit                                                              |

Pembagian ini penting: hanya bagian yang **melibatkan model** yang memerlukan evaluasi. Semua yang
deterministik diuji dengan cara biasa, dan itu bagian terbesar dari sistem — hasil langsung dari
keputusan menjauhkan LLM dari perhitungan.
