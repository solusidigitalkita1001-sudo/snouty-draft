# Coba sendiri — satu jalur, lima fase sekaligus

Lima fase menunggu penilaian Anda: 15, 16, 17, 23, dan 24. Mencobanya satu per satu berarti lima
kali mulai dari awal. Di bawah ini satu jalur yang melewati kelimanya, berurutan, sekitar dua
puluh menit, semuanya di https://ai.pralon.co.id dengan akun Anda sendiri.

Tiap langkah menyebut apa yang Anda ketik atau tekan, dan apa yang seharusnya terlihat. Yang perlu
Anda tulis kembali ke saya hanya satu baris per langkah: sesuai, atau tidak sesuai beserta apa
yang terlihat.

Masuk ke akun lebih dulu — proyek, sematan, tautan bagikan, dan laporan PDF memang hanya untuk
akun, bukan tamu.

---

## 1 · Proyek (Fase 24)

Di sisi kiri, bagian **PROYEK** → **+ proyek baru**. Namanya apa saja, misalnya "Coba 28 Okt".
Isi catatan proyek satu baris: "rumah dua lantai di Sidoarjo". Lalu **Konsultasi baru di proyek
ini**.

Yang seharusnya terlihat: proyek punya halamannya sendiri berisi nama, catatan, dan daftar
konsultasi yang masih kosong. Di layar sambutan konsultasi baru ada penanda "Proyek: Coba 28 Okt".

## 2 · Pertanyaan perusahaan dan subjek yang bertahan (Fase 16)

Ketik berurutan, tunggu tiap jawaban:

1. `pralon itu apa?`
2. `produk pipanya apa aja?`
3. `yang buat air minum?`

Yang seharusnya terlihat: jawaban pertama tentang perusahaan, bukan tentang pipa pada umumnya.
Jawaban kedua dan ketiga tetap tentang Pralon tanpa Anda menyebut namanya lagi, dan yang ketiga
menyempit ke pipa air bersih — bukan kembali bertanya "produk mana yang Anda maksud?".

## 3 · Rumah dua lantai (Fase 14)

Ketik: `mau bangun rumah 2 lantai, 3 kamar mandi, air dari pdam, butuh air bersih dan pembuangan`

Yang seharusnya terlihat: kartu "Yang sudah saya pahami" terisi jenis bangunan, jumlah lantai,
kamar mandi, sumber air, dan jenis instalasi. Di kartu itu **tidak boleh** ada baris jenis
pekerjaan atau bahan pipa lama — ini bangun baru, bukan renovasi. Lalu tombol untuk menyusun
solusi.

Opsional: **Lampirkan denah** dengan foto apa saja. Berkasnya ikut terlampir dan terbawa bila
kasusnya diserahkan ke tim teknis; isinya tidak dibaca, dan itu memang belum ada.

## 4 · Layar solusi (Fase 17)

Tekan tombol susun solusi, tunggu sampai selesai.

Yang seharusnya terlihat, dari atas ke bawah: ringkasan bergambar berisi kebutuhan dan alur air,
baris sistem dengan ukuran tiap jalur beserta alasan ukurannya, BOQ terbagi per sistem dengan
gambar produk, tabel dasar perhitungan (cara hitung · hitungan · hasil), dan tabel asumsi
berkelompok dengan tombol Ubah di tiap baris.

Yang tidak boleh ada di mana pun: label versi katalog, versi aturan, atau nomor impor.

## 5 · Denah dan "Coba ubah" (Fase 17)

Tab **Skema** → **Denah**. Lihat potongan instalasi dan denah jalur per lantai. Lalu tekan salah
satu tombol di "Coba ubah", misalnya **toren dinaikkan satu lantai**.

Yang seharusnya terlihat: tabel dua kolom, Sekarang ↔ skenario, dengan baris yang berubah
ditandai. Solusi aslinya tidak berubah — skenario tidak ikut tersimpan.

## 6 · Mengubah asumsi (Fase 17)

Kembali ke tabel asumsi. Ubah tinggi lantai dari 3,5 m menjadi 4 m, simpan.

Yang seharusnya terlihat: solusi dihitung ulang, angka yang bergantung tinggi lantai berubah, dan
baris asumsinya kini berasal dari nilai Anda, bukan dari nilai bawaan.

## 7 · Laporan PDF (Fase 17)

Unduh laporan.

Yang seharusnya terlihat: daftar isi, ringkasan bergambar, BOQ per sistem, dasar perhitungan dan
asumsi berkelompok, halaman denah, dan lampiran produk Pralon bergambar. Tanggal data produk
tertulis sebagai tanggal, bukan sebagai nomor versi.

Bila tombol laporan tidak aktif, tingkat akun Anda belum lanjutan — lewati langkah ini dan sebut
saja ke saya.

## 8 · Tautan bagikan (Fase 24)

Tombol **Bagikan** di layar solusi → buat tautan → salin. Buka tautannya di jendela penyamaran
(tanpa akun).

Yang seharusnya terlihat: layar solusi yang sama, baca-saja — tanpa "Coba ubah", tanpa ubah
asumsi, tanpa riwayat percakapan, tanpa nama Anda. Lalu kembali ke layar solusi, cabut tautannya,
dan muat ulang jendela penyamaran: halamannya harus mati, bukan masih menampilkan solusi.

## 9 · Sematan (Fase 24)

Di daftar konsultasi, menu **⋯** pada baris konsultasi ini → **Sematkan**.

Yang seharusnya terlihat: baris itu pindah ke bagian DISEMATKAN dan tetap di sana setelah Anda
membukanya. Sekalian periksa yang dulu rusak: nyalakan mode gelap, buka menu ⋯ pada baris paling
bawah — menunya harus utuh dan membuka ke atas, tidak terpotong.

## 10 · Renovasi rumah (Fase 23)

Konsultasi baru. Ketik: `mau renovasi rumah`

Yang seharusnya terlihat: pertanyaan "Renovasinya seperti apa?" lebih dulu, sebelum pertanyaan
apa pun tentang lantai atau kamar mandi.

Jawab: `nambah 2 kamar mandi, pipa lama 3/4 inch galvanis, sudah ada 4 titik air`

Yang seharusnya terlihat: solusi berjudul perluasan, baris sistem "Pipa utama lama" dengan
keterangan cukup atau tidak cukup untuk beban barunya, baris "Sambungan ke pipa lama", dan di BOQ
sok drat serta tee yang ber-SKU Pralon. Empat titik lama **tidak** dihitung sebagai titik air
baru.

## 11 · Renovasi jaringan (Fase 23)

Konsultasi baru. Ketik: `ganti sebagian pipa induk spam 300 meter, pipa lama 110 mm hdpe sudah
melayani 300 sr`

Yang seharusnya terlihat: solusi berjudul penggantian sebagian, baris "Segmen yang diganti"
sepanjang 300 m, dan BOQ berisi pipa sepanjang segmen itu saja beserta soknya — bukan seluruh
jalur, dan bukan sambungan tiap rumah.

## 12 · Bahasa Inggris (Fase 15)

Konsultasi baru. Ketik dalam bahasa Inggris: `i want to build a two storey house with 3 bathrooms,
city water`

Yang seharusnya terlihat: seluruh balasan dalam bahasa Inggris tanpa Anda menyentuh tombol bahasa,
dan bila diteruskan sampai solusi, layar solusinya ikut bahasa Inggris — judul baris sistem, nama
asumsi, satuan. Kembali mengetik bahasa Indonesia di konsultasi yang sama membuat balasan
berikutnya Indonesia lagi.

---

## Yang saya butuhkan dari Anda

Satu baris per langkah. "1 sesuai", "8 tidak sesuai — tautan masih bisa dibuka setelah dicabut".
Itu cukup; sisanya saya cari sendiri. Langkah yang tidak sesuai saya perbaiki lebih dulu sebelum
fase-fase ini ditutup.
