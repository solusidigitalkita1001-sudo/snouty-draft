# Laporan Checkpoint Fase 14 — Asisten Teknik Perpipaan Umum

2026-10-07 · untuk ditinjau pemilik · produksi https://ai.pralon.co.id (commit `bac9561`)

## 1. Ringkasan

Fase 14 (P14-01 … P14-07) selesai dan jalan di produksi: registry parameter & asumsi ber-ID,
profil 9 kasus, kalkulator bertekanan/gravitasi/kolam/cluster, matcher v2 pada katalog Pralon asli
(7.681 SKU), komposer jawaban berbagian tetap, dan streaming event per tahap. Model bahasa produksi
adalah **qwen2.5 7B di CPU server (Ollama)** — keputusan pemilik 2026-10-07 (biaya nol).

**Kejujuran yang perlu dibaca lebih dulu:** dengan model itu, kecepatan dan kualitas bahasa **tidak
akan setara ChatGPT/Claude**. Yang bisa dan sudah dikerjakan di kode: (a) sebanyak mungkin keputusan
tanpa model (jalur cepat intent, fakta tersurat dari teks, templat deterministik), (b) pagar supaya
kesalahan model tidak sampai ke pengguna (grounding angka/jenis/letak, `null` = tidak disebut,
penjelasan tanpa model), (c) latensi yang _terasa_ lebih pendek (event mengalir sejak detik 0, jawaban
diungkap bertahap). Sisa jarak ke kompetitor hanya bisa ditutup dengan model berbayar (±Rp 20 per
giliran untuk gpt-4.1-mini); env produksi tinggal ditukar bila keputusan berubah
(`docs/DEPLOYMENT.md` §0).

## 2. Dua belas skenario uji (tag `design`, `apps/api/evals/cases.json`) — produksi, tamu

Diukur dua kali: sebelum perbaikan hari ini (kolom "awal") dan setelah rilis `bac9561`.

| #   | Skenario                                                          | Hasil awal (7B)                                                   | Setelah perbaikan                                            | Waktu |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ | ----- |
| 1   | Rumah 2 lantai, 3 KM, 4 wastafel, 1 dapur, air bersih, toren atap | 4 data + CTA, **sumber `ground_tank`** (salah)                    | sumber `rooftop_tank` (letak toren dari teks), CTA analisis  | 21 s  |
| 2   | … "Apa saja yang saya butuhkan?"                                  | 3 data + klarifikasi                                              | sama                                                         | 29 s  |
| 3   | "Toren di lantai 2, pipa apa yang cocok?"                         | balasan model **mengarang "pipa dekantasi Pralon"**               | jalur cepat → kebutuhan; klarifikasi (lihat §4 risiko prosa) | 18 s  |
| 4   | "Lebih bagus Pralon atau Rucika?"                                 | kartu kriteria netral, 1 s                                        | sama                                                         | 1 s   |
| 5   | Jalur air proses pabrik, suhu 70°C, 200 m                         | **balasan bebas model**, tanpa kartu                              | kartu validasi teknis (air proses / suhu ≥ 45°), 0 s         | 0 s   |
| 6   | Instalasi air bersih rumah baru 1 lantai                          | 2 data + klarifikasi                                              | sama                                                         | 17 s  |
| 7   | "Kalau kamar mandi saya tambah satu?" (percakapan baru)           | klarifikasi (tidak ada state untuk dimutasi)                      | sama — benar untuk percakapan kosong                         | 7 s   |
| 8   | "Kenapa pakai ukuran 1 inci di jalur utama?"                      | model **mengarang alasan** ("dioptimalkan untuk kebutuhan besar") | teks tetap yang menunjuk ke solusi, tanpa model              | 5 s   |
| 9   | Saluran pembuangan ruko 2 lantai                                  | kartu "belum didukung", 8 s                                       | sama                                                         | 8 s   |
| 10  | Rumah 2 lantai, 2 KM, tidak ada dapur                             | **dapur hilang** (model diam) → sempat dijawab sebagai pembuka    | `kitchens: 0` dari peniadaan tersurat, klarifikasi           | 10 s  |
| 11  | "Ada ukuran 3/4 inch untuk PVC AW?"                               | jawaban katalog + CTA, 5 s                                        | sama                                                         | 5 s   |
| 12  | "pipa"                                                            | bertanya balik                                                    | sama                                                         | 11 s  |

Perbaikan yang lahir dari tabel ini (commit `5255a8a`, `bac9561`): jalur cepat tanpa model untuk
pesan pertama berisyarat kebutuhan; letak toren dan peniadaan tersurat mengalahkan model; penjelasan
tanpa model; pembuka dinilai setelah fakta dari teks; air proses/suhu tinggi ke validasi teknis.

## 3. Latensi (produksi, 4 CPU, qwen2.5 7B)

| Giliran                             | Sebelum Fase 7 | Sesudah                                 |
| ----------------------------------- | -------------- | --------------------------------------- |
| `message.start` terlihat klien      | +22 s          | **+0 s**                                |
| Pesan kebutuhan pertama (ekstraksi) | 22–36 s        | 10–29 s (routing 0 s lewat jalur cepat) |
| Pesan di luar topik / sapaan        | 4–7 s          | 1–7 s                                   |
| Penjelasan ("kenapa")               | 14 s           | 5 s                                     |
| Analisis transfer pompa             | 42 s           | tahap tampil sejak 0 s; prosa 42 s      |

Profil per tahap tercatat di log API (`giliran pesan` → `ms.{load,route,answer,persist,total}`).
Ekstraksi gabungan satu panggilan **dievaluasi dan ditolak** untuk model ini (P14-07).

## 4. Risiko yang tersisa dengan model 7B

- **Prosa bebas masih bisa mengarang** (skenario 3: nama produk yang tidak ada). Pagar angka ada;
  pagar nama produk belum. Usulan: ReplyWriter menolak teks yang menyebut "pipa/produk <nama>" di luar
  keluarga katalog. Belum dibangun — menunggu keputusan apakah prosa bebas tetap dipakai.
- Klasifikasi intent tidak deterministik untuk pesan tanpa isyarat; dampaknya dibatasi aturan di kode.
- Variasi waktu 2× antar giliran yang sama (beban CPU, cache prompt).

## 5. Keputusan pemilik yang tercatat hari ini

| Keputusan                 | Isi                                                               |
| ------------------------- | ----------------------------------------------------------------- |
| Model                     | Tetap Ollama qwen2.5 7B (gratis)                                  |
| Aturan tamu               | Tetap: konsultasi penuh tanpa riwayat tersimpan                   |
| Badge katalog di sambutan | Dihapus                                                           |
| Bilingual                 | **ID + EN penuh** (UI dan jawaban asisten) → Fase 15              |
| Animasi jawaban           | Diungkap bertahap per kata, kartu menyusul; reduced-motion utuh   |
| Riwayat di ponsel         | Menu "Riwayat" kini memuat percakapan aktif (sebelumnya "kosong") |

## 6. Yang masih di tangan pemilik

`sudo certbot renew` untuk bagspace · ganti password SSH `snouty` · revoke kunci OpenRouter yang bocor ·
jawaban OQ-07/OQ-48 (arti seri "W", data OD/wall HDPE) · desain layar Opsi & Kesiapan (OQ-50).
