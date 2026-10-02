# SNOUTY — Produk

Fase 0c · P0c-01 · Terakhir diperbarui 2026-09-30

Apa yang dibangun, untuk siapa, dan bagaimana kita tahu ia berhasil. Sumbernya SPEC §2 dan §4.

---

## 1. Masalah

Orang yang membangun rumah tidak tahu ukuran pipa. Mereka tahu jumlah kamar mandi.

Jarak antara dua hal itu biasanya diisi oleh tukang, toko bangunan, atau tebakan. Ketiganya bekerja
sampai batas tertentu, tetapi tidak satu pun memberi pemilik bangunan alasan yang bisa dia pahami,
dan tidak satu pun memberi Pralon gambaran tentang apa yang sebenarnya dibutuhkan pasarnya.

SNOUTY mengisi jarak itu: menerima cerita dalam bahasa sehari-hari, mengubahnya menjadi kebutuhan
terstruktur, menghitungnya secara deterministik, lalu mengembalikannya sebagai rekomendasi produk
Pralon yang disertai alasan.

Kalimat pembuka yang menjadi patokan seluruh desain:

> "Saya mau bangun rumah 2 lantai, ada 3 kamar mandi, 4 wastafel, 1 dapur, dan toren di atas.
> Saya butuh pipa apa saja?"

---

## 2. Apa SNOUTY, dan apa bukan

| SNOUTY adalah              | SNOUTY bukan                                          |
| -------------------------- | ----------------------------------------------------- |
| asisten pengetahuan produk | chatbot umum                                          |
| asisten penjualan teknis   | toko online (tidak ada keranjang, tidak ada checkout) |
| asisten solusi perpipaan   | perangkat lunak desain teknik                         |
| mesin rekomendasi produk   | penerbit sertifikasi                                  |
| sumber intelijen pasar     | pembanding merek                                      |

Batas di kolom kanan bukan kekurangan yang akan ditutup nanti. Semuanya adalah keputusan yang
membentuk produk, dan sebagian besar justru yang membuatnya bisa dipercaya.

---

## 3. Persona

**Snouty** — anjing laut insinyur yang selalu memakai helm proyek. Tenang, teliti, jujur soal batas,
selalu Pralon, dan **tidak pernah menebak ukuran pipa**.

Empat sifat itu diambil apa adanya dari lembar mascot, dan masing-masing punya wujud teknis:

| Sifat            | Wujud di sistem                                             |
| ---------------- | ----------------------------------------------------------- |
| Ramah            | bahasa sehari-hari, tanpa jargon kecuali diminta            |
| Teliti           | setiap nilai membawa provenance; asumsi selalu dinyatakan   |
| Jujur soal batas | "data belum cukup" adalah jawaban yang sah, bukan kegagalan |
| Selalu Pralon    | rekomendasi tidak pernah keluar dari ekosistem Pralon       |

Nada bicara: seperti konsultan yang sabar, bukan seperti brosur. Tidak berlebihan memuji produk,
tidak meminta maaf berlebihan, tidak memakai tanda seru beruntun.

---

## 4. Pengguna

### Tamu pertama kali

Mendapat onboarding 5 langkah. Bisa langsung bercerita tanpa mendaftar.

### Tamu kembali

Bisa memakai kapabilitas standar. Percakapannya boleh disimpan untuk analitik dan kualitas
**sepanjang ada persetujuan** (`PRIVACY.md`). Tamu tidak melihat riwayat persisten — dan tidak
ditunjukkan bagian riwayat palsu yang dinonaktifkan.

### Pengguna terdaftar

Riwayat, penyimpanan solusi, unduh laporan, melanjutkan konsultasi lama.

### Lanjutan

Analisis studi kasus, estimasi material, skema. Untuk MVP, `registered` dan `advanced` setara
(OQ-05); Policy Engine tetap memodelkannya terpisah agar pemisahan nanti cukup ubah konfigurasi.

### Pengguna internal

`catalog_admin`, `domain_expert`, `technical_team`, `sales_reviewer`, `admin`. Rincian di
`BACKOFFICE.md`.

### Aturan yang paling mudah dilanggar

Ketika tamu meminta fitur lanjutan, urutannya **wajib**: pahami dulu → simpan konteks → tawarkan
daftar → lanjutkan kasus yang sama → jangan pernah paksa mengetik ulang.

Menghadang sebelum menjawab adalah kesalahan yang paling mudah terjadi dan paling merusak
kepercayaan. Pengguna sudah menceritakan rumahnya; memintanya mendaftar dulu sebelum mengakui apa
pun akan terasa seperti jebakan.

---

## 5. Alur inti

```
Cerita  ──►  Pemahaman  ──►  Klarifikasi  ──►  Analisis  ──►  Solusi  ──►  Laporan
            (kartu "Yang     (maks 4        (5 tahap      (4 tab)      (PDF 2 hal)
             sudah saya       pertanyaan)     nyata)
             pahami")
```

Indikator tahap di header mengikuti empat langkah: **Kebutuhan → Analisis → Solusi → Laporan**.

Empat tab workspace solusi: **Ringkasan · Produk Pralon · Skema · Estimasi Material**.

---

## 6. Kapabilitas per fase

| Kapabilitas                | Fase | Layar       |
| -------------------------- | ---- | ----------- |
| Tanya jawab produk         | 2    | 01, 02, 10  |
| Rekomendasi produk Pralon  | 7    | 06, 07      |
| Alur klarifikasi           | 5    | 03          |
| Tinjau & edit kebutuhan    | 5–6  | 04          |
| Analisis teknik            | 6    | 05          |
| Estimasi material / BOM    | 8    | 06          |
| Skema instalasi            | 9    | 09          |
| Laporan PDF                | 10   | —           |
| Riwayat & solusi tersimpan | 10   | 12          |
| Kirim ke tim teknis        | 10   | 11          |
| Intelijen email            | 11   | back-office |
| Intelijen pasar            | 12   | back-office |

---

## 7. Yang membuat produk ini berbeda

Tiga hal, dan ketiganya berasal dari keputusan menahan diri:

**Angka yang bisa ditelusuri.** Setiap ukuran pipa punya jejak aturan dengan versi. Kolom "DASAR
PERHITUNGAN" bukan prosa yang enak dibaca — ia dirender dari jejak perhitungan yang sebenarnya.

**Ketidaktahuan yang terlihat.** Amber "ASUMSI" muncul sesering hijau "TERVERIFIKASI", dan itu
disengaja. Produk yang menyembunyikan ketidakpastian akan terasa lebih meyakinkan sampai seseorang
membeli pipa yang salah.

**Penolakan yang membantu.** Layar 11 bukan layar error. Saat kebutuhan di luar cakupan, SNOUTY
memberi alasan bernomor, merangkum apa yang sudah dicatat supaya pengguna tidak mengulang cerita,
lalu menawarkan tim teknis dengan SLA. Menolak sambil tetap berguna adalah fitur.

---

## 8. Ukuran keberhasilan

Belum ada target angka dari Anda (OQ-10). Yang diusulkan untuk dipantau sejak Fase 4:

| Metrik                                          | Mengapa penting                                       |
| ----------------------------------------------- | ----------------------------------------------------- |
| Konsultasi selesai (welcome → solusi)           | ukuran kegunaan paling jujur                          |
| Rata-rata pertanyaan klarifikasi per konsultasi | naik = ekstraksi memburuk                             |
| Proporsi field `ASSUMED` vs `VERIFIED`          | turun seiring aturan divalidasi dan katalog diperkaya |
| Konsultasi ter-route ke validasi teknis         | terlalu tinggi = cakupan terlalu sempit               |
| Laporan diunduh                                 | ukuran nilai yang dirasakan                           |
| Konversi tamu → daftar                          | menguji alur register-gate                            |
| Biaya token per konsultasi                      | menguji apakah eksekusi selektif bekerja              |
| Umpan balik jempol atas/bawah                   | ukuran kualitas langsung                              |

Satu yang perlu diperhatikan sejak awal: **proporsi `ASSUMED` hari ini akan mendekati 100%** untuk
nilai teknik, karena belum ada aturan yang divalidasi. Metrik ini baru bermakna setelah OQ-06
terjawab.

---

## 9. Di luar cakupan MVP

|                        | Alasan                                                   |
| ---------------------- | -------------------------------------------------------- |
| Sizing pembuangan      | butuh kemiringan, ventilasi, unit beban drainase (OQ-17) |
| Perhitungan pompa      | butuh kurva pompa dan data tekanan                       |
| Instalasi industri     | selalu ke validasi teknis                                |
| Pemesanan / pembayaran | SNOUTY bukan toko                                        |
| Perbandingan merek     | kebijakan produk                                         |
| Gambar kerja           | skema bukan gambar konstruksi                            |
| Aplikasi mobile native | web responsif sudah mencakup 390×844                     |

---

## 10. Yang masih terbuka di sisi produk

| OQ    | Pertanyaan                                                        |
| ----- | ----------------------------------------------------------------- |
| OQ-15 | apakah tamu melihat solusi lengkap, atau BOM/schematic butuh akun |
| OQ-03 | harga masuk lingkup atau tidak                                    |
| OQ-05 | apakah tier lanjutan berbayar                                     |
| OQ-07 | sumber katalog produk                                             |
| OQ-08 | tujuan handoff teknis dan SLA resmi                               |
| OQ-17 | perilaku untuk kebutuhan pembuangan                               |

OQ-15 yang paling berpengaruh: ia menentukan apakah layar unggulan produk ini bisa dilihat tanpa
mendaftar.
