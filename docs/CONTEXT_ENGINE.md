# SNOUTY — Context Engine

Fase 0b · P0b-05 · Terakhir diperbarui 2026-09-30

Bagaimana SNOUTY mengingat apa yang dikatakan pengguna. Sumbernya SPEC §6.

---

## 1. Mengapa riwayat chat mentah tidak cukup

Cara termudah adalah menyimpan seluruh percakapan lalu mengirimkannya kembali ke LLM setiap giliran.
Cara itu gagal pada empat hal yang justru menjadi inti produk ini:

1. **Tidak ada provenance.** Riwayat chat tidak membedakan angka yang disebut pengguna dari angka yang
   diasumsikan sistem. Padahal seluruh desain dibangun di atas perbedaan itu — hijau "TERVERIFIKASI"
   vs amber "ASUMSI".
2. **Tidak bisa diedit.** Layar 04 membiarkan pengguna mengubah "Kamar mandi: 3" menjadi 4 langsung di
   panel. Tidak ada cara waras melakukannya terhadap transkrip.
3. **Mahal dan tidak stabil.** Mengirim ulang konteks berarti membayar token berulang, dan ekstraksi
   ulang bisa menghasilkan jawaban berbeda untuk masukan yang sama.
4. **Tidak bisa dihitung.** Engineering Engine butuh objek bertipe, bukan paragraf.

Karena itu SNOUTY memelihara **Requirement State** terstruktur. Riwayat chat tetap disimpan untuk
ditampilkan dan diaudit, tetapi bukan itu yang dibaca sistem saat berpikir.

---

## 2. Bentuk state

Setiap field adalah `TrackedValue`, tidak pernah skalar telanjang.

```ts
type Provenance = 'VERIFIED' | 'ASSUMED' | 'ESTIMATED' | 'UNAVAILABLE';
type FieldSource = 'user_stated' | 'user_edited' | 'default_applied' | 'inferred';

interface TrackedValue<T> {
  value: T | null;
  provenance: Provenance;
  source: FieldSource;
  reason?: string; // WAJIB bila ASSUMED — kalimat inilah yang muncul di kartu asumsi
  ruleId?: string;
  updatedAt: string;
}

interface RequirementState {
  version: number;
  intent: Intent;

  building: {
    type: TrackedValue<BuildingType>; // rumah tinggal | rumah kos | komersial ringan | industri
    floors: TrackedValue<number>;
    floorHeightM: TrackedValue<number>; // default 3,5 → ASSUMED, ENG-004
    dimensions: TrackedValue<Dimensions>; // panjang jalur; kosong → BOM jadi ESTIMATED
  };

  fixtures: {
    bathrooms: TrackedValue<number>;
    basins: TrackedValue<number>;
    kitchens: TrackedValue<number>;
    outletCount: TrackedValue<number>; // board 03 menanyakan ini langsung
  };

  water: {
    source: TrackedValue<WaterSource>; // toren atap | toren | pompa | PDAM
    installationType: TrackedValue<InstallationType>; // air bersih | pembuangan | keduanya
    boosterPump: TrackedValue<boolean>; // board 03 menanyakan ini langsung
  };

  missingInformation: FieldPath[]; // turunan, tidak disimpan
  completeness: { filled: number; required: 4 }; // menggerakkan meter 4 segmen
}
```

Prototipe hanya punya tujuh field string datar. Dua field tambahan — `outletCount` dan `boosterPump` —
berasal dari board layar 03, yang menanyakan keduanya secara eksplisit tetapi tidak punya tempat di
prototipe (OQ-23). `floorHeightM` dan `dimensions` dinaikkan menjadi field kelas satu karena keduanya
menentukan apakah BOM berstatus `ESTIMATED` atau `VERIFIED`, jadi menyembunyikannya sebagai konstanta
akan menyembunyikan asal-usul angka dari pengguna.

---

## 3. Alur pemrosesan

```
pesan ──► IntentRouter ──► perlu ekstraksi?
                              │ tidak (edit / mutasi) ──────────────┐
                              │ ya                                  │
                              ▼                                     │
                   ai.extractStructured (zod)                       │
                              │ tidak valid → ulangi 1× dengan error│
                              │ masih gagal → pertanyaan klarifikasi│
                              ▼                                     │
                      ContextMerger.merge  ◄──────────────────────── ┘
                              ▼
                  RequirementSnapshot baru (append-only)
                              ▼
                   CompletenessEvaluator
                       │                    │
                  ada yang kurang       lengkap
                       ▼                    ▼
              ClarificationEngine      Recommendation pipeline
```

Cabang kiri atas adalah yang paling sering terpakai dan paling murah: **edit kebutuhan dan mutasi
follow-up tidak memanggil LLM sama sekali**. Nilainya sudah terstruktur; yang perlu dilakukan hanya
merge lalu hitung ulang.

---

## 4. Aturan merge

Presedensi sumber, dari paling kuat:

```
user_edited  >  user_stated  >  inferred  >  default_applied
```

| Situasi                                                          | Hasil                                                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Pengguna menyebut nilai baru untuk field yang sebelumnya default | nilai pengguna menang, provenance berubah ke `VERIFIED`, `reason` dihapus, asumsi terkait dicabut dari kartu |
| Pengguna menyebut nilai baru untuk field yang sudah dia sebut    | nilai terbaru menang                                                                                         |
| Sistem punya default untuk field yang sudah diisi pengguna       | **default tidak pernah menimpa**                                                                             |
| Ekstraksi menghasilkan `null` untuk field yang sudah terisi      | diabaikan — `null` berarti "tidak disebut di pesan ini", bukan "dihapus"                                     |
| Pengguna menyatakan ketiadaan ("tidak ada dapur")                | `value: 0`, `source: user_stated` — berbeda dari belum diisi                                                 |

Baris keempat dan kelima adalah sumber bug paling halus di sistem semacam ini. "Tidak disebutkan"
dan "dinyatakan tidak ada" terlihat sama di JSON bila keduanya jadi `null`. Skema ekstraksi karena itu
mengembalikan `undefined` untuk yang tidak disebut dan nilai eksplisit untuk yang dinyatakan.

Contoh dari SPEC §6:

```
"Rumah saya 2 lantai, ada 3 kamar mandi."
→ building.floors = { value: 2, provenance: VERIFIED, source: user_stated }
  fixtures.bathrooms = { value: 3, provenance: VERIFIED, source: user_stated }
  water.source = { value: null, provenance: UNAVAILABLE, source: inferred }
  missingInformation = ['water.source', 'water.installationType']

"Torennya di atas."
→ water.source = { value: 'rooftop_tank', provenance: VERIFIED, source: user_stated }
  floors dan bathrooms TIDAK tersentuh
```

---

## 5. Kelengkapan dan klarifikasi

### Meter 4 segmen

"KELENGKAPAN DATA" menghitung empat field inti — `water.source`, `water.installationType`,
`building.floors`, `fixtures.bathrooms` — konsisten dengan prototipe. Field lain memperkaya hasil
tetapi tidak menahan rekomendasi.

Teks di bawah meter mengikuti salinan desain persis:

- belum lengkap: "_n_ kelompok data lagi sebelum SNOUTY dapat menyusun rekomendasi."
- lengkap: "Data inti sudah lengkap. Nilai yang tidak diberikan tetap ditandai sebagai asumsi."

### Dua bentuk klarifikasi

Desain memuat dua bentuk berbeda (OQ-23), dan keduanya dilayani oleh satu engine:

| Bentuk                                                                          | Kapan            | Sumber desain  |
| ------------------------------------------------------------------------------- | ---------------- | -------------- |
| Satu pertanyaan per giliran + chip jawaban cepat                                | 1–2 field kurang | prototipe      |
| Kartu berisi hingga 4 pertanyaan bernomor + "lewati dan gunakan asumsi standar" | ≥ 3 field kurang | board layar 03 |

Aturannya: **jangan pernah menumpahkan kuesioner panjang** (SPEC §33d), maksimum empat pertanyaan,
selalu progresif.

Urutan prioritas (ENG-007, masih menunggu validasi domain):

```
water.source → water.installationType → building.floors → fixtures.bathrooms
```

### "Belum tahu"

Menjawab "Belum tahu" bukan jalan buntu. Sistem menerapkan default, menandainya `ASSUMED`, dan
**selalu** memunculkannya di kartu asumsi dengan alasan yang terbaca manusia (ENG-014):

| Field                    | Default    | Kalimat asumsi                                                     |
| ------------------------ | ---------- | ------------------------------------------------------------------ |
| `water.source`           | Toren atap | "Sumber distribusi adalah toren atap, tanpa pompa pendorong."      |
| `water.installationType` | Air bersih | "Instalasi diasumsikan untuk air bersih saja."                     |
| `building.floorHeightM`  | 3,5        | "Tinggi antar lantai diasumsikan 3,5 meter."                       |
| `building.dimensions`    | —          | "Panjang pipa diestimasi karena dimensi bangunan belum diberikan." |

Nada balasannya mengikuti prototipe: "Tidak masalah — saya pakai asumsi umum dan menandainya."
Menerapkan default tanpa mengatakannya akan melanggar SPEC §5 Policy 4, dan lebih buruk lagi, membuat
pengguna percaya pada angka yang sebetulnya tebakan.

---

## 6. Edit dan mutasi — jalur tanpa LLM

Tiga cara pengguna mengubah kebutuhan setelah solusi tersusun:

| Pemicu                           | Contoh                                | Yang berjalan                       |
| -------------------------------- | ------------------------------------- | ----------------------------------- |
| Edit inline panel kanan ("Ubah") | ubah Kamar mandi 3 → 4                | merge → hitung ulang                |
| "Perbaiki asumsi ini →"          | membuka field yang jadi sumber asumsi | merge → hitung ulang                |
| Follow-up yang memutasi          | "Kalau kamar mandi saya tambah satu?" | parse ringan → merge → hitung ulang |

Baris ketiga perlu kehati-hatian. "Tambah satu kamar mandi" **memutasi** state; "Kenapa ukuran ini?"
**tidak**. Klasifikasi ini dilakukan intent router, dan bila ragu sistem bertanya balik alih-alih
menebak — mengubah kebutuhan pengguna tanpa diminta adalah kesalahan yang jauh lebih mahal daripada
satu pertanyaan tambahan.

Setelah merge, yang dihitung ulang adalah: jumlah titik air, unit beban, ukuran jalur utama, topologi
skema, baris BOM, dan daftar asumsi. Semuanya deterministik, tanpa panggilan jaringan. Target < 300 ms
p95.

Prosa penjelasnya tetap boleh dibuat LLM — tetapi hanya menjelaskan angka yang sudah dihitung, dan
tunduk pada invarian REC-1 (tidak boleh memuat angka di luar hasil hitungan).

---

## 7. Penyimpanan

| Lapisan                             | Isi                             | TTL      | Peran            |
| ----------------------------------- | ------------------------------- | -------- | ---------------- |
| Redis `snouty:ctx:{conversationId}` | snapshot aktif                  | 24 jam   | cache baca cepat |
| MySQL `requirement_snapshots`       | **semua** snapshot, append-only | permanen | sumber kebenaran |

Pola tulisnya **write-through**: setiap snapshot ditulis ke MySQL lebih dulu, baru Redis diperbarui.
Redis boleh di-flush kapan saja tanpa kehilangan data; cache miss dilayani dengan membaca snapshot
terbaru dari MySQL. Redis tidak pernah menjadi sumber kebenaran (SPEC §18).

Sifat append-only memberi tiga hal sekaligus tanpa kerja tambahan: jalur undo untuk alur "Perbaiki
asumsi ini", riwayat audit tentang siapa mengubah apa, dan korpus transisi state yang nyata untuk
evaluasi.

Saat tamu mendaftar, snapshot **tidak disalin** — cukup `owner_id` percakapannya yang berpindah.
Menyalin akan menduplikasi `version` dan merusak sifat append-only.

---

## 8. RAG bukan memori percakapan

Perlu dinyatakan tegas karena kekeliruan ini umum: Qdrant (bila nanti diadopsi) menyimpan pengetahuan
produk semantik, **bukan** apa yang dikatakan pengguna. Konteks percakapan tidak pernah di-embed dan
tidak pernah diambil lewat pencarian kemiripan. Ia terstruktur, tepat, dan dibaca langsung.

---

## 9. Daftar tes

| #   | Tes                                                                             |
| --- | ------------------------------------------------------------------------------- |
| 1   | Merge tidak pernah membiarkan `default_applied` menimpa `user_stated`           |
| 2   | Field `ASSUMED` selalu punya `reason` dan muncul di kartu asumsi                |
| 3   | "Tidak ada dapur" menghasilkan `value: 0` `user_stated`, bukan `null`           |
| 4   | Ekstraksi yang menghasilkan `undefined` tidak menghapus field yang sudah terisi |
| 5   | Snapshot bersifat append-only; `version` naik monoton                           |
| 6   | Kelengkapan menghitung tepat empat field inti                                   |
| 7   | Klarifikasi mengikuti urutan prioritas dan tidak pernah > 4 pertanyaan          |
| 8   | "Belum tahu" menerapkan default, menandai `ASSUMED`, dan menambah kartu asumsi  |
| 9   | Edit inline tidak memicu satu pun panggilan LLM                                 |
| 10  | Follow-up yang memutasi memperbarui state; follow-up yang bertanya tidak        |
| 11  | Registrasi tamu memindahkan seluruh snapshot tanpa duplikasi `version`          |
| 12  | Flush Redis tidak menghilangkan data — state dipulihkan dari MySQL              |

Tes 9 adalah tes performa sekaligus tes kebenaran: bila edit memicu ekstraksi, biaya token melonjak
dan hasilnya bisa berubah untuk masukan yang sama.
