# SNOUTY — Gambaran Arsitektur (ringkas)

Per 2026-10-06. Rincian lengkap dan alasannya ada di `docs/ARCHITECTURE.md`; dokumen ini ikhtisar
satu halaman untuk diskusi dengan pihak non-teknis dan untuk brainstorming master data produk.

## 1. Satu kalimat

Pengguna bercerita dalam bahasa sehari-hari → sistem mengubahnya jadi **kebutuhan terstruktur** →
**mesin teknik deterministik** menghitung ukuran pipa → hasilnya dicocokkan ke **produk Pralon dari
katalog berversi** → tampil dengan **asal-usul setiap angka** (provenance). LLM hanya penerjemah
bahasa ↔ struktur; ia tidak menghitung dan bukan sumber fakta produk.

## 2. Bentuk sistem

```
                    ┌──────────────────────────── apps/web (Next.js) ────────────────────────────┐
                    │  chat · panel kebutuhan · layar solusi (Ringkasan · Produk · Skema · BOM)  │
                    │  laporan · back-office /internal (impor katalog, validasi aturan, handoff)  │
                    └───────────────────────────────────┬────────────────────────────────────────┘
                                                        │ HTTP + SSE
┌───────────────────────────────────────────────────────▼────────────────────────────────────────┐
│ apps/api (NestJS) — monolith modular                                                           │
│                                                                                                │
│  conversation ──► context (Requirement State, klarifikasi, kasus teknis) ──► recommendation    │
│        │                 │                        │                              │             │
│        │                 ▼                        ▼                              ▼             │
│        │              ai (LLM:                policy (leaf:            engineering ──► packages/│
│        │   intent, ekstraksi, prosa)        Pralon-only, scope,        (adapter)      engineering│
│        │                                    gerbang provenance)                     (TS murni)  │
│        │                                                                                       │
│  product-catalog ◄── product-knowledge ◄── (lookup terstruktur, FAQ)                           │
│  report · technical-handoff · email-intelligence · market-intelligence · admin                 │
└───────────────┬───────────────────────────────────────────────────┬────────────────────────────┘
                │ MySQL (katalog, percakapan, snapshot, rekomendasi) │ RabbitMQ (PDF, handoff, impor)
                ▼                                                   ▼
            MySQL 8 · Redis                                   apps/worker (Chromium → PDF)
```

Tiga aplikasi, satu basis kode, satu database. Tidak ada microservices (batas domain belum stabil;
memindahkan batas modul murah, batas jaringan mahal).

## 3. Komponen inti dan tanggung jawabnya

| Komponen                       | Tugas                                                                                                                                                                                       | Tidak boleh                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `context` (Context Engine)     | Mengubah pesan menjadi `RequirementState` (nilai + provenance), memilih pertanyaan klarifikasi, mendeteksi kasus teknis (rumah, irigasi, kolam, transfer pompa, drainase, gorong-gorong, …) | Menyimpan riwayat chat mentah sebagai "memori"         |
| `packages/engineering`         | 29 aturan deterministik ber-ID (ENG-001…ENG-304), registry parameter universal, registry asumsi ber-ID, kesiapan per keluaran, orkestrator per kasus                                        | Memanggil LLM, membaca katalog, I/O apa pun            |
| `policy`                       | Hanya-Pralon, cakupan, entitlement tier, gerbang provenance                                                                                                                                 | Punya dependensi (wajib leaf)                          |
| `ai`                           | Klasifikasi intent, ekstraksi terstruktur (zod), prosa penjelas dengan pagar angka                                                                                                          | Memutuskan aturan bisnis                               |
| `product-catalog`              | Versi katalog (`pralon` / `sample`), produk, ukuran, spesifikasi ber-provenance, kompatibilitas fitting, impor idempoten                                                                    | Mengisi kolom kosong dari dokumen (= halusinasi halus) |
| `recommendation`               | Orkestrasi analisis → matcher produk → BOM → skema → simpan dengan trace                                                                                                                    | Menampilkan angka tanpa trace                          |
| `report` / `technical-handoff` | PDF laporan (worker), antrean tim teknis Pralon                                                                                                                                             | Mengirim data pribadi tanpa redaksi                    |

## 4. Alur satu giliran chat (eksekusi selektif)

1. Jalur cepat tanpa model: sapaan, merek pesaing, konsep produk, irigasi, kasus teknis → diputuskan
   dari bentuk kalimat (0 detik).
2. Bila perlu, model mengklasifikasi intent; presedensi kebutuhan hidup di kode, bukan prompt.
3. Kebijakan cakupan diperiksa **sebelum** klasifikasi kasus (air panas, kimia → validasi teknis).
4. Kasus teknis → fakta tersurat jadi parameter universal (`route_length`, `static_head`, …),
   pertanyaan ≤ 4 dari registry, tanpa model. Rumah → ekstraksi model + merge + meter kelengkapan.
5. Balasan dalam prosa teknisi (tanpa label templat), kartu klarifikasi / CTA analisis.

## 5. Alur analisis

```
snapshot kebutuhan ─► orkestrator kasus (computeSolution / computeIrrigation / computePond)
   ─► trace per aturan (input, output, provenance, penjelasan)
   ─► matcher produk per peran (jalur utama, cabang, fitting) atas versi katalog aktif
   ─► BOM + asumsi ber-ID + prosa (pagar REC-1: tiap angka harus ada di hasil hitung)
   ─► Recommendation tersimpan (kind: building | irrigation | technical) ─► layar solusi
```

## 6. Arah dependensi (ditegakkan lint)

```
policy        → (leaf)
engineering   → packages/engineering     (tidak ke ai/ maupun product-catalog/)
ai            → (tidak ke domain)
context       → ai, policy, packages/engineering (fungsi murni saja)
recommendation→ context, engineering, product-catalog, material-estimator, schematic, policy
```

## 7. Data yang menjadi fondasi

| Data                                                  | Sumber kebenaran                               | Status hari ini                                       |
| ----------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| Produk Pralon (SKU, keluarga, ukuran, kelas, standar) | Katalog berversi `kind = pralon` hasil impor   | **Belum ada** — aktif masih `sample` (OQ-07)          |
| Aturan teknik                                         | `packages/engineering`, divalidasi ahli Pralon | 29 aturan, semua `REQUIRES_DOMAIN_VALIDATION` (OQ-06) |
| Asumsi teknik                                         | Registry asumsi ber-ID (20+)                   | Semua `confirmationRequired`                          |
| Pengetahuan produk (konsep PVC/HDPE/PPR)              | `pipe-knowledge.ts` (kode)                     | Umum, belum spesifik Pralon                           |
| Harga                                                 | Belum dalam cakupan                            | OQ-03                                                 |

Dua baris pertama adalah masukan yang ditunggu dari Pralon; lihat `docs/PRODUCT_MASTER_DATA.md`.
