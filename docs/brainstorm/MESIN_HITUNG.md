# Cara SNOUTY Menghitung

Status per 12 Oktober 2026. Semua perhitungan ada di `packages/engineering` (TypeScript murni, tanpa
model bahasa). Setiap aturan punya ID, versi, rumus, sumber, kasus uji, dan penjelasan dua bahasa
yang tampil di layar "detail teknis". **Semua 45 aturan masih `REQUIRES_DOMAIN_VALIDATION`**: belum
ada ahli Pralon yang menandatanganinya, jadi tidak ada hasil yang berlabel terverifikasi.

Nilai yang tidak disebut pengguna diambil dari **registry asumsi**: tampil di layar sebagai kalimat,
bisa diganti pengguna, lalu dihitung ulang.

## 1. Bahan bersama: hidraulik bertekanan

Dipakai rumah, gedung, transfer pompa, sumur, cluster.

- Kecepatan `V = Q ÷ (π·D²/4)`; kehilangan gesek Hazen-Williams `hf = 10,67·L·Q^1,852 ÷ (C^1,852·D^4,87)`,
  C plastik 150; kerugian sambungan = 10 % kehilangan gesek (jumlah fitting belum diketahui).
- Tinggi angkat total = beda tinggi + gesek + sambungan + tekanan sisa di ujung.
- Ukuran dipilih yang terkecil dengan kecepatan ≤ 2 m/s dan kehilangan ≤ 10 m per 100 m; satu ukuran
  di atasnya ditawarkan sebagai alternatif (pompa lebih ringan, pipa lebih mahal).
- Pompa: daya hidraulik `ρ·g·Q·H`, daya poros = ÷ efisiensi pompa 60 %. Daya motor tidak diklaim;
  pompa tetap dipilih dari kurva pabrikan.
- Diameter dalam = **OD resmi − 2 × tebal dinding**. OD uPVC dari Knowledge Master §7.1 (½" = 22 mm …
  6" = 165 mm); tebal dinding diperkirakan OD/26,5 karena tabel resmi bertentangan (OQ-58). HDPE: SDR 17.

## 2. Rumah — air bersih (Kelompok K, sejak 12 Okt)

1. Titik air: kamar mandi = shower + kloset (2 titik), + wastafel + dapur. Dapur yang belum disebut
   dianggap 1.
2. Debit puncak dari **unit beban suplai** (kloset 2,2 · shower 1,0 · wastafel 0,5 · bak cuci 1,0) lewat
   **kurva Hunter** (IPC Lampiran E) — tidak semua keran dibuka bersamaan.
3. Jalur: dari sumber ke titik air tertinggi (shower lantai teratas, 2 m di atas lantai). Jalur datar
   = panjang + lebar rumah; tanpa ukuran rumah 20 m (hanya untuk ukuran pipa, tidak untuk material).
4. Pipa utama dari bagian 1. Per sumber:
   - **toren atap** (muka air 1 m di atas atap): ukuran dipilih supaya titik tertinggi masih ≥ 0,3 bar;
     tidak mungkin → saran pompa pendorong atau toren lebih tinggi;
   - **PDAM**: tekanan minimal yang harus ada di meteran;
   - **toren bawah / sumur**: titik kerja pompa.
5. Cabang dari debit per cabang (maks 4 titik per cabang) pada 1,5 m/s; sambungan alat ½".
6. Material: pipa utama = panjang jalur ÷ panjang batang produk katalog terpilih (bulat ke atas, tanpa
   sisa potongan). Cabang dan fitting **tidak** diberi angka tanpa denah.

Contoh: rumah 8×15, 2 lantai, 3 kamar mandi, 1 dapur, PDAM → 10,6 unit → 0,95 l/s → pipa utama 1"
(1,38 m/s), cabang ¾", PDAM perlu ±1,7 bar di meteran.

## 3. Rumah — pembuangan (Kelompok J)

- Unit beban buangan (IPC 709.1): kloset 4, shower/floor drain 2, wastafel 1, bak cuci dapur 2.
- Dua jalur: **air kotor** (kloset → septic tank) dan **air bekas** (floor drain, wastafel, dapur →
  saluran/resapan). Ukuran = terkecil yang kapasitasnya cukup pada kemiringan 2 % (IPC 710.1), tidak
  lebih kecil dari alat terbesarnya; kloset minimal 4" (praktik Indonesia).
- Ventilasi = ≥ setengah diameter jalur, minimal 1¼". Pipa PVC D.
- Contoh 3 kamar mandi + dapur → air kotor 4" (vent 2"), air bekas 2" (vent 1¼").

## 4. Gedung bertingkat (Kelompok I)

- Penghuni = luas lantai × lantai ÷ 10 m²/orang (bila penghuni tidak disebut).
- Kebutuhan harian = penghuni × 150 l; rata-rata per jam ÷ 10 jam pemakaian; jam puncak × 2; menit
  puncak × 3 (Noerbambang & Morimura).
- Zona tekanan dari elevasi tiap lantai: tekanan dari tangki atap < 1 bar → booster; ≤ 4 bar →
  gravitasi; lebih → zona berkatup penurun tekanan. Ditampilkan per rentang lantai.
- Pompa transfer pada debit jam puncak; riser pada debit menit puncak, dibagi beberapa riser bila
  satu riser 6" tidak cukup; HDPE bila PVC tidak cukup.
- Tangki bawah = kebutuhan 1 hari (pasokan PDAM tidak dikurangkan); tangki atap = kekurangan saat
  30 menit tersibuk + 10 menit kerja pompa.
- Material: hanya jalur tegak (transfer dan riser); pipa per lantai tidak dihitung tanpa denah.
- Regresi: 5.000 m² × 20 lantai × 90 m → 10.000 orang, 1.500 m³/hari, pompa 300 m³/jam, 4 riser 6",
  tangki atap 125 m³ — dicek dengan hitungan acuan terpisah.

## 5. Kasus teknis lain

| Kasus                    | Inti hitungan                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| Transfer pompa / sumur   | Bagian 1 dengan debit, jarak, beda tinggi dari pengguna                                     |
| Kolam / tambak           | Volume = p × l × tinggi air (1 m); debit isi = volume ÷ 3 jam; kuras ÷ 1 jam                |
| Drainase / gorong-gorong | Manning `V = (1/n)·(D/4)^(2/3)·S^½`, isi maks 80 %, kecepatan ≥ 0,6 m/s; timbunan minimum   |
| Air hujan                | Rasional `Q = 2,78·C·I·A` (C perumahan 0,6)                                                 |
| Cluster perumahan        | Rumah × 4 orang × 150 l/hari, puncak × 2, lalu bagian 1                                     |
| Irigasi                  | Debit per hektar (genangan 1,5 · sprinkler 0,8 · tetes 0,5 l/s/ha); HDPE bila jalur ≥ 200 m |

## 6. Pagar masukan

Data yang bertentangan ditanya balik, tidak dihitung: tinggi per lantai di luar 2–10 m, kurang dari
1 m² per orang, tekanan sisa melebihi batas zona, lantai < 1.

## 7. Kelemahan yang diketahui (bahan diskusi)

- Semua nilai acuan dari IPC/buku teks, **belum padanan SNI 8153** dan belum divalidasi Pralon.
- Tebal dinding PVC perkiraan; kelas tekanan pipa belum dicek otomatis terhadap tekanan kerja (mis.
  kaki riser 8,8 bar ditampilkan sebagai catatan).
- Satu kebutuhan air untuk semua jenis gedung (kantor, hotel, rumah sakit berbeda jauh).
- Kecepatan minimum 0,6 m/s ("membersihkan diri") juga dipakai untuk air bersih bertekanan.
- Toren atap 1 m di atas atap hampir selalu menghasilkan saran pompa pendorong untuk rumah 2 lantai —
  benar secara hitungan, tetapi perlu dicek apakah sesuai kebiasaan lapangan.
- Material kolam dan irigasi masih memakai batang 4 m tetap dan tata letak bujur sangkar.
- Pipa per lantai, cabang, fitting, katup, penyangga belum dihitung jumlahnya — butuh denah.
