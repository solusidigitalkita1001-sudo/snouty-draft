# SNOUTY — Roadmap

Fase 0c · P0c-15 · Terakhir diperbarui 2026-09-30

Sumbernya SPEC §49. Rincian item per fase disusun di awal fase itu, sebelum kode ditulis, dan
dicatat di `PROGRESS.md`.

---

## 1. Fase

| Fase | Lingkup | Layar utama | Status |
|---|---|---|---|
| **0** | Dokumentasi, arsitektur, skills, konfigurasi DB, design token, skeleton | — | 0a ✓ · 0b ✓ · 0c berjalan |
| **1** | Katalog produk + admin/impor | 10 (data) | menunggu OQ-07 |
| **2** | Asisten pengetahuan produk (FAQ, lookup, RAG bila perlu) | 01, 02, 10 | |
| **3** | Auth + sesi tamu + percakapan + onboarding + consent + peran | 01, 14, login/register | |
| **4** | Context Engine + intent router + requirement parser + SSE | 02, indikator tahap | |
| **5** | Policy Engine + clarification engine + scope routing | 03, 04, 08, 11 | |
| **6** | Engineering Rule Engine + admin validasi aturan | 04, 05 | gated OQ-06 |
| **7** | Product matching | 06 (produk), 07 | |
| **8** | Material estimator / BOM (+ harga bila dalam lingkup) | 06 (BOM, asumsi) | |
| **9** | Schematic generator | 06 (pratinjau), 09 | |
| **10** | Riwayat, solusi tersimpan, entitlement lanjutan, register-gate & resume, laporan PDF, antrean handoff | 11, 12, laporan | |
| **11** | Email intelligence + back-office tinjauan email | back-office | |
| **12** | Market intelligence + dashboard | back-office | |
| **13** | Audit keamanan, performa, aksesibilitas, evaluasi, pengerasan produksi | semua | |

**Mobile dan dark mode dibangun di dalam setiap fase**, bukan ditunda ke Fase 13. Fase 13 adalah
audit, bukan fase konstruksi — menyimpan pekerjaan responsif sampai akhir berarti mengerjakannya dua
kali.

---

## 2. Ketergantungan

```
1 Katalog ────┬──► 2 Pengetahuan produk
              └──► 7 Matching ──► 8 BOM ──► 9 Skema ──► 10 Laporan
3 Auth ───────┬──► 4 Context ──► 5 Policy ──► 6 Engineering ──► 7
              └──► 10 Riwayat & entitlement
                                                  11 Email ──► 12 Market
```

Katalog harus lebih dulu: matching, BOM, skema, dan laporan semuanya membaca darinya. Membangun
mesin rekomendasi di atas data contoh hanya memindahkan pekerjaan integrasi ke belakang, di tempat
ia lebih mahal.

Email intelligence (11) berdiri cukup mandiri dan bisa dimajukan bila prioritas bisnis berubah —
ia hanya memerlukan katalog dan abstraksi LLM.

---

## 3. Gerbang

Hal-hal yang menghentikan fase, bukan sekadar memperlambatnya.

| Gerbang | Menghalangi | OQ |
|---|---|---|
| Sumber katalog produk | Fase 1 seluruhnya | OQ-07 |
| Ahli domain Pralon | **nilai apa pun menjadi TERVERIFIKASI** | OQ-06 |
| Keputusan entitlement tamu | Fase 5 & 10 | OQ-15 |
| Harga dalam lingkup atau tidak | Fase 8 & 10 | OQ-03 |
| Tujuan handoff teknis | Fase 10 | OQ-08 |
| Remote Git | CI di Fase 0e | OQ-09 |
| Akun database least-privilege | rilis produksi | OQ-34 |
| Kepemilikan backup | migration pertama | `DATABASE.md` §8 |

Dua gerbang terakhir bukan penghalang pengembangan, melainkan penghalang **rilis**. Keduanya perlu
diselesaikan sebelum ada data pelanggan nyata di sistem.

Gerbang OQ-06 punya sifat yang berbeda dari yang lain: ia tidak menghentikan kode, tetapi
menghentikan produk dari terlihat seperti yang dijanjikan desain. Engine bisa dibangun, diuji, dan
di-demo — hanya saja setiap angka akan tampil amber.

---

## 4. Yang bisa dilihat di setiap fase

Berguna untuk merencanakan demo, dan untuk menetapkan harapan.

| Setelah fase | Yang bisa ditunjukkan |
|---|---|
| 1 | katalog produk nyata dengan sumber dan versi |
| 2 | tanya jawab produk yang jujur, termasuk mengakui yang tidak diketahui |
| 3 | onboarding, masuk sebagai tamu, percakapan tersimpan |
| 4 | SNOUTY memahami cerita dan mengisi panel kebutuhan secara langsung |
| 5 | klarifikasi, penolakan yang membantu, rute validasi teknis |
| 6 | tracker analisis lima tahap dengan perhitungan sungguhan |
| 7 | rekomendasi produk Pralon beserta alasannya |
| 8 | BOM dengan dasar perhitungan dan kartu asumsi |
| 9 | skema instalasi + skenario "bagaimana kalau" |
| 10 | **alur lengkap ujung ke ujung, termasuk laporan PDF** |
| 11 | kotak masuk penjualan dengan analisis dan draf |
| 12 | dashboard permintaan pasar |
| 13 | siap produksi |

Demo yang paling meyakinkan adalah setelah Fase 10 — di situ produk pertama kali utuh: cerita masuk,
laporan keluar.

Satu catatan untuk demo Fase 6 dan 7: sampai OQ-06 selesai, layar akan menampilkan ASUMSI di tempat
mockup menampilkan TERVERIFIKASI. Sampaikan itu sebagai fitur (sistem jujur soal apa yang belum
divalidasi), bukan sebagai pekerjaan yang belum selesai — karena memang begitu adanya.

---

## 5. Prioritas bila waktu terbatas

Bila lingkup harus dipotong, urutan ini mempertahankan produk yang tetap koheren:

| Prioritas | Alasan |
|---|---|
| **Wajib** — Fase 1–7 | tanpa ini tidak ada produk: katalog, percakapan, kebutuhan, aturan, rekomendasi |
| **Sangat berharga** — Fase 8–10 | BOM, skema, dan laporan adalah yang membuatnya terasa lengkap |
| **Bisa ditunda** — Fase 11–12 | intelijen email dan pasar bernilai bagi Pralon, bukan bagi pengguna akhir |
| **Tidak bisa ditunda** — bagian Fase 13 | keamanan dan privasi bukan pekerjaan opsional |

Baris terakhir perlu ditegaskan: audit di Fase 13 boleh dijadwal ulang, tetapi kontrol keamanan dan
privasi dibangun di dalam setiap fase sejak awal. Menambahkannya belakangan berarti menyentuh setiap
jalur kode, dan biasanya berarti tidak jadi ditambahkan.

---

## 6. Sesudah MVP

Belum dijadwalkan; dicatat agar tidak hilang.

| | Dari |
|---|---|
| Sizing pembuangan | OQ-17, permintaan nyata terlihat di market intelligence |
| Ekspor PNG skema | OQ-29 |
| Ekspor daftar belanja | OQ-29 |
| Berbagi solusi | OQ-29 |
| RAG / Qdrant | bila kriteria di `PRODUCT_KNOWLEDGE.md` §5 terpenuhi |
| Bahasa Inggris | OQ-11 |
| OpenTelemetry & Grafana | Fase 13+ |
| Read replica MySQL | bila baca > 70% kapasitas |
| Perhitungan pompa & kerugian gesek | butuh masukan ahli domain |

Urutan pengerjaannya sebaiknya ditentukan oleh data dari Fase 12, bukan oleh dugaan hari ini —
itulah salah satu alasan market intelligence layak dibangun.
