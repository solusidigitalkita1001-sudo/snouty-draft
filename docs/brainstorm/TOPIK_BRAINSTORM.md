# Topik Brainstorming SNOUTY

Status per 12 Oktober 2026. Tiap topik: keadaan sekarang, pilihan yang ada, dan apa yang perlu
diputuskan. Bahas satu topik per sesi; hasilnya dicatat ke `docs/OPEN_QUESTIONS.md`.

## 1. Validasi teknik oleh Pralon (paling menentukan kepercayaan)

**Sekarang:** 45 aturan dan ±40 nilai asumsi memakai IPC dan buku acuan plambing Indonesia, semuanya
berlabel "perkiraan awal". Tidak ada yang bisa naik menjadi terverifikasi tanpa ahli Pralon.

**Pilihan:**

- A. Satu insinyur Pralon meninjau per kelompok (rumah, pembuangan, gedung, drainase), menandai
  nilai yang diganti dengan padanan SNI 8153.
- B. Pralon menyerahkan dokumen resmi (Product Specification, tabel tekanan kerja, tebal dinding,
  pedoman instalasi), lalu nilainya dimasukkan ke registry.
- C. Kombinasi: B untuk data produk, A untuk metode hitung.

**Perlu diputuskan:** siapa, format tinjauan (tabel berkas atau layar back-office), dan urutan
kelompok.

## 2. Model bahasa: kecepatan vs kualitas vs biaya

**Sekarang:** CPU lokal gratis. Mode hemat (DATA langsung) ±0,1 s; mode kualitas (model 9B
merangkai) 20–25 s; perencana untuk kalimat asing ±8 s.

**Pilihan:**

- A. Tetap lokal; hemat sebagai baku, kualitas opsional.
- B. GPU di server (perkiraan 10–20× lebih cepat), sekali beli/sewa.
- C. Model berbayar per giliran (3–6 s, biaya kecil per giliran) untuk merangkai dan memahami;
  angka tetap dari kode.

**Perlu diputuskan:** anggaran, dan apakah data percakapan boleh keluar ke penyedia luar.

## 3. Data produk yang belum ada

Tebal dinding per kelas dan ukuran, tekanan kerja resmi AW/D dan PN HDPE, TDS solvent cement, tabel
ketahanan kimia, umur pakai, kode produk pelanggan (SKU sekarang ID ekspor ERP), 14 pasang SKU
fitting bernama sama (varian atau catatan ganda?).

**Perlu diputuskan:** siapa di Pralon pemilik datanya, dan format kirimnya (Excel/PDF).

## 4. Denah

**Sekarang:** pengguna bisa melampirkan denah, tetapi sistem tidak membacanya; panjang jalur dari
ukuran rumah (panjang + lebar) atau asumsi.

**Pilihan:**

- A. Tetap bertanya ukuran rumah dan panjang jalur.
- B. Pengguna menandai titik air dan jalur di atas denah (alat gambar sederhana).
- C. Membaca denah otomatis dengan model visi (butuh model cepat/berbayar; akurasi perlu diuji).

## 5. Gedung non-hunian

Kantor, hotel, rumah sakit, sekolah, ruko memakai 150 l/orang/hari dan 10 m²/orang yang sama.

**Perlu diputuskan:** tabel kebutuhan per jenis gedung (sumber: SNI / pedoman Pralon) dan apakah
jenis gedung ditanyakan.

## 6. Material dan penawaran

**Sekarang:** hanya pipa utama/riser yang dihitung jumlahnya; harga tidak ditampilkan.

**Pertanyaan:** apakah laporan perlu daftar material lengkap (fitting, katup, lem) — dan kalau iya,
dari tata letak tipikal yang dinyatakan sebagai asumsi, atau menunggu denah? Kapan harga boleh
tampil, dan dari daftar harga mana?

## 7. Alur ke tim Pralon

**Sekarang:** handoff terstruktur ke tim teknis; nomor HP wajib saat daftar (belum ikut terkirim di
handoff); kirim laporan lewat email belum aktif.

**Pertanyaan:** siapa penerima handoff, SLA, apakah nomor HP + ringkasan langsung ke WhatsApp tim
sales/teknis, dan bagaimana prospek dicatat (CRM?).

## 8. Merawat pengetahuan setelah serah terima

`data/understanding/` (contoh kalimat per maksud) dan `data/knowledge/` (fakta bersumber) bisa
ditambah tanpa mengubah kode. **Pertanyaan:** siapa yang merawat, bagaimana kalimat yang gagal di
produksi dikumpulkan, dan perlu layar back-office atau cukup berkas?

## 9. Cakupan berikutnya

Email intelligence (membaca email pertanyaan pelanggan), market intelligence (topik yang sering
ditanya, produk yang sering dicari tetapi tidak ada), back-office penuh, aplikasi untuk sales di
lapangan. **Pertanyaan:** mana yang paling bernilai untuk Pralon kuartal ini?

## 10. Pengguna awam rumah subsidi dan proyek SPAM/sewerage (Fase 22, 16 Okt)

Masukan seorang pengguna rumahan: aplikasi harus mudah untuk orang awam segmen subsidi, gambar sistem
pipa yang lebih nyata, estimasi ganti pipa murah ke Pralon, dan jawaban "toren harus setinggi apa supaya
kencang tanpa pompa". Semua sudah dibangun dengan default; yang perlu diputuskan:

- **Tinggi toren (OQ-67)**: daftar tinggi tiang yang lazim Pralon lihat di lapangan, muka air di atas
  dudukan, dan ambang tekanan yang dianggap "deras" (sekarang 0,7 bar — hampir selalu butuh pompa untuk
  rumah 1 lantai; apakah mau dikatakan apa adanya seperti sekarang, atau ambangnya diturunkan).
- **Gambar "lebih nyata" (OQ-68)**: A. tetap skematik (sekarang, angka dari engine). B. gaya isometrik
  digambar khusus di Claude Design. C. foto contoh instalasi Pralon sebagai acuan di samping skema.
- **Estimasi rupiah ganti pipa (OQ-69)**: A. tanpa harga (sekarang; DD-01 #8). B. Pralon memberi daftar
  harga ke impor katalog → BOQ penggantian bawa subtotal, untuk akun terdaftar saja (OQ-14). C. harga
  indikatif per kelas, bukan per SKU.
- **Proyek SPAM/sewerage (OQ-70)**: kriteria per kategori kota, faktor puncak per ukuran jaringan,
  keluarga pipa air limbah Pralon, dan batas kapan proyek besar langsung ke tim teknis.
