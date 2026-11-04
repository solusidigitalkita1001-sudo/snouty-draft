# Uji kapasitas SNOUTY

Berapa sesi serentak yang bisa dipegang server sebelum jawabannya melambat, dan bagian mana yang
menyerah lebih dulu. Dokumen ini prosedurnya; alatnya ada di `scripts/load-test/`.

Ini **uji kapasitas**, bukan uji penetrasi. Yang dicari batas kinerja, bukan celah keamanan —
keduanya kegiatan berbeda dengan izin, alat, dan laporan yang berbeda (§8).

## 1 · Izin dan sasaran

Keputusan pemilik 2026-11-04: pengujian dijalankan di **produksi, di luar jam kerja**, dengan
jalur kasus teknis ikut dinaikkan sampai ambangnya. Konsekuensinya diterima dan dicatat di sini:

- percakapan uji ditulis ke MySQL bersama di `192.168.1.136` — basis data yang sama dipakai tujuh
  aplikasi in-house lain, jadi jumlah pesan dibatasi (`--max-messages`, baku 4.000) dan datanya
  dibersihkan setelahnya (§6);
- disk server tinggal belasan GB; pengawas menghentikan pengujian bila turun di bawah 8 GB;
- pengguna yang kebetulan memakai SNOUTY saat pengujian akan merasakan jawabannya melambat.
  Karena itu jendelanya di luar jam kerja, dan pengujian berhenti sendiri di ambang pertama yang
  terlewati.

Jendela waktu ditentukan pemilik sebelum setiap sesi; tidak ada pengujian beban yang dijalankan
tanpa jendela yang disepakati lebih dulu.

## 2 · Yang sudah terukur (produksi, 2026-11-04)

Angka awal, satu sesi, tanpa beban — dasar pembanding untuk semua hasil berikutnya:

| Jalur                                 | Waktu      | Keterangan                                 |
| ------------------------------------- | ---------- | ------------------------------------------ |
| Giliran katalog/pengetahuan           | 150–400 m  | nol panggilan model                        |
| Kebutuhan dicatat                     | 273 ms     | ekstraksi + snapshot                       |
| `POST /analyze` (Susun rekomendasi)   | 148 ms     | mesin hitung, nol panggilan model          |
| Pertanyaan lanjutan atas kasus        | 55–110 ms  | dijawab dari hitungan yang sudah ada       |
| Kasus diubah ("tambah 1 kamar mandi") | 320 ms     | nol panggilan model (P16-40)               |
| Muat halaman + katalog aktif          | 60–95 ms   | nginx dan SPA                              |
| Satu embedding `bge-m3`               | 159–225 ms | CPU; dipanggil 1–2× per pesan              |
| Satu jawaban model `qwen3.5:9b`       | 18,3 s     | 141 token, 7,7 token/detik (catatan 09:01) |

Hampir semua giliran dijawab tanpa model: dalam 24 jam, penyandi embedding menerima 373
permintaan sementara model besar nol kali dari jalur chat. Satu jalur mengecualikan diri, dan
kalibrasi 90 detik pada 10 sesi menemukannya — **pertanyaan lanjutan atas kasus yang sudah
dihitung**. Di sana `LLM_CHAT_REPLY` memanggil `qwen3.5:9b`, dan di CPU panggilan itu tidak
pernah selesai tepat waktu:

| Giliran lanjutan atas kasus yang sudah dihitung | Waktu  | Yang diterima pengguna              |
| ----------------------------------------------- | ------ | ----------------------------------- |
| "kenapa pipa utamanya ukuran itu?"              | 47 ms  | teks deterministik                  |
| "tekanan di lantai paling atas berapa?"         | 10,4 s | teks deterministik yang **sama**    |
| "butuh berapa elbow sama tee?"                  | 135 ms | contoh fitting dari katalog         |
| "pembuangannya ukuran berapa?"                  | 67 ms  | aturan kemiringan dari mesin hitung |

Empat giliran "tekanan di lantai paling atas" yang dikirim **serentak** menunjukkan antreannya
tunggal dan menunggu bertumpuk: 5,3 s · 8,8 s · 12,6 s · 15,1 s. Yang keempat berhenti di
`LLM_REPLY_TIMEOUT_MS=15000` lalu memakai teks tetap — teks yang sama dengan yang dikirim giliran
47 ms di baris pertama tabel. Jadi di perangkat keras sekarang panggilan model pada jalur chat
tidak memperbaiki jawaban, hanya menambah 5–15 detik menunggu, dan makin banyak sesi makin
panjang antreannya. Pemilik memilih membiarkan jalur itu hidup (OQ-94), jadi angka di atas
adalah dasar pembanding untuk pengukuran ulang setelah mesin ber-GPU datang.

Dugaan berikutnya yang akan diuji: setelah jalur itu, yang menyerah lebih dulu bukan Laravel dan
bukan MySQL, tetapi **penyandi embedding** — satu permintaan 159–225 ms di CPU, satu antrean,
dipanggil setiap pesan. Di sekitar 5 pesan per detik ia sudah penuh.

## 3 · Persiapan

1. Jendela waktu disepakati pemilik, dan tidak ada rilis yang berjalan bersamaan.
2. Catat keadaan awal: `df -h /`, `free -m`, `docker ps`, versi katalog aktif.
3. Pastikan `deploy/deploy.sh smoke` hijau — pengujian di atas sistem yang sedang sakit tidak
   mengukur apa pun.
4. Jalankan uji coba (`--dry-run`) dan periksa angkanya wajar dibanding tabel §2.

## 4 · Kalimat ujinya

`scripts/load-test/questions.json` memuat kalimat nyata dari audit produksi, dikelompokkan menurut
jalur yang dilaluinya. Sebelum menambah kalimat, **ukur dulu jalurnya** — satu giliran lewat
`raw-turn`-style skrip atau `--dry-run`, lihat waktunya: ratusan milidetik berarti deterministik,
belasan detik berarti model. Kalimat yang ditaruh di kelompok yang salah membuat seluruh hasil
tahap itu tidak terbaca.

## 5 · Menjalankan

### a · Pencatat metrik host

Dari mesin penguji, di terminal terpisah, biarkan jalan sepanjang pengujian:

```bash
ssh -i ~/.ssh/snouty_deploy snouty@192.168.1.10 'bash -s' \
  < scripts/load-test/host-sampler.sh > host.csv
```

### b · Beban chat dan halaman

```bash
# uji coba dulu: satu sesi, satu giliran per jalur
node scripts/load-test/snouty-load.mjs --base https://ai.pralon.co.id --dry-run

# tahapan penuh
node scripts/load-test/snouty-load.mjs --base https://ai.pralon.co.id \
  --stages 1,10,50,100,200 --case-stages 0,2,5,10,20 \
  --stage-seconds 300 --think 50 --host-metrics host.csv --out hasil-$(date +%F)
```

Tiap tahap lima menit, jeda baca 50 detik ±30%, satu sesi tamu per pengguna virtual. Batas pesan
tamu 20/jam dihormati lewat `--max-per-vu 18`: yang diuji kapasitas server, bukan cara menembus
batas lajunya. Pengawas menilai ambang setiap 15 detik dan menghentikan seluruh pengujian pada
pelanggaran pertama.

### c · Antrean model

Layanan model tidak terbuka ke jaringan, jadi ini dijalankan **di server**:

```bash
ssh -i ~/.ssh/snouty_deploy snouty@192.168.1.10
docker run --rm --network snouty_default -v ~/snouty/scripts:/s node:22-alpine \
  node /s/load-test/model-queue.mjs --base http://ollama:11434 --model qwen3.5:9b
```

Permintaan serentak dinaikkan 1 → 2 → 4 → 8 dan berhenti saat p95 melewati 60 detik. Pemanasan
dilakukan lebih dulu supaya tahap pertama tidak mengukur waktu memuat model ke RAM. Setiap
permintaan dibatasi 160 token keluaran.

## 6 · Pembersihan data

Alatnya menghapus sendiri setiap percakapan uji (soft delete) dan menulis daftar idnya ke
`conversations.txt`. Barisnya tetap ada di database bersama. Pembersihan tuntas adalah
**tindakan pemilik**, bukan tindakan alat ini: hapus permanen dijalankan pemilik dengan backup
yang dikonfirmasi, memakai daftar id itu, mengikuti `docs/DATABASE.md` §4. Tidak ada
`TRUNCATE`, tidak ada reset skema.

## 7 · Ambang berhenti

| Ambang                | Nilai    | Artinya bila terlewati                                       |
| --------------------- | -------- | ------------------------------------------------------------ |
| p95 jalur cepat       | 2 detik  | kapasitas terlampaui — ini angka yang dicari                 |
| p95 jalur kasus       | 15 detik | mesin hitung atau database yang menahan                      |
| Galat (5xx / putus)   | 1%       | ada yang tumbang, bukan sekadar melambat                     |
| 429 dari rate limiter | 5%       | yang terukur batas laju, bukan kapasitas — perbaiki skenario |
| Load average          | 8        | mesin 4 inti sudah dua kali penuh                            |
| RAM bebas             | 1.500 MB | risiko OOM; dua layanan model memegang 13,2 GB dari 23 GB    |
| Disk bebas            | 8 GB     | risiko server tidak bisa menulis apa pun lagi                |

Hasilnya ditulis ke `RINGKASAN.md` (tabel per tahap per jalur), `requests.csv` (satu baris per
permintaan, untuk dihitung ulang), dan `stages.csv`.

Cara membacanya: tahap terakhir yang **semua jalurnya masih di bawah ambang** adalah kapasitas
server saat ini. Bandingkan dengan asumsi beban di
`spesifikasi-server-pralon-1000-pengguna.md` — 1000 pengguna terdaftar, puncak 10% aktif
bersamaan, satu pesan per 45–60 detik, yaitu sekitar 2 giliran per detik.

## 8 · Yang tidak diuji di sini

Uji beban ini tidak menyentuh keamanan. Tidak ada percobaan menembus autentikasi, tidak ada
pengujian injeksi, tidak ada pembacaan data pengguna lain. Bila yang diinginkan uji penetrasi
sungguhan, itu kegiatan tersendiri: ruang lingkup tertulis, izin tertulis dari pemilik sistem,
jendela waktu, dan laporan temuan — dan untuk sistem yang dipakai pelanggan, biasanya dijalankan
pihak ketiga yang independen. `docs/SECURITY.md` memuat pagar yang sudah ada; kelemahan yang
ditemukan di luar pengujian resmi dicatat di sana, bukan di dokumen ini.

Juga di luar lingkup: antrean PDF dan email di worker, dan Bagspace yang berbagi nginx di server
yang sama. Keduanya perlu skenario sendiri.
