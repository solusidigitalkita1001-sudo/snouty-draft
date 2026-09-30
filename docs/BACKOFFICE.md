# SNOUTY — Back-Office

Fase 0c · P0c-09 · Terakhir diperbarui 2026-09-30

Enam area internal. Sumbernya SPEC §15b.

---

## 1. Kondisi desain

Bundel Claude Design **tidak memuat satu pun layar internal**. Semua yang di bawah dibangun sebagai
halaman fungsional sederhana memakai token yang sama (`packages/ui`), dan masing-masing dicatat di
`OPEN_QUESTIONS.md` sebagai "needs design" (OQ-21).

Konsekuensi praktis: halaman internal akan terlihat jelas lebih polos daripada aplikasi pelanggan.
Itu disengaja — membuatnya *tampak* selesai padahal belum didesain akan menyulitkan saat desainer
akhirnya mengerjakannya.

---

## 2. Peran

| Peran | Wewenang |
|---|---|
| `catalog_admin` | impor & validasi katalog, versi, dokumen sumber, gambar |
| `domain_expert` | meninjau aturan teknik, menandai tervalidasi, melihat test case |
| `technical_team` | antrean handoff, status, SLA |
| `sales_reviewer` | tinjau analisis & draf email, dashboard pasar |
| `admin` | akun internal, peran, lihat audit log |

Peran bersifat aditif; satu orang bisa memegang beberapa. Tidak ada peran yang otomatis mewarisi
peran lain — `admin` pun perlu diberi `domain_expert` secara eksplisit untuk memvalidasi aturan,
karena memvalidasi aturan teknik adalah pernyataan keahlian, bukan hak administratif.

---

## 3. Aturan yang berlaku untuk semua area

| | |
|---|---|
| Semua rute `/internal/*` memerlukan autentikasi **dan** otorisasi peran |
| **Setiap operasi tulis menulis `audit_logs`** — siapa, apa, kapan, nilai lama → baru |
| Tidak ada aksi destruktif tanpa konfirmasi eksplisit |
| Daftar data pelanggan menampilkan minimum yang diperlukan |
| Membuka laporan pelanggan tercatat di audit |
| Rate limit terpisah dari tier pelanggan |

---

## 4. Area

### 4.1 Katalog & impor — `catalog_admin` · Fase 1

| Kemampuan | |
|---|---|
| Unggah katalog (Excel/CSV, OQ-07) | |
| Laporan validasi **per baris** — semua galat sekaligus, bukan satu per satu | |
| Pratinjau versi draft sebelum dipromosikan | |
| Promosikan draft → active (satu versi aktif) | |
| Kelola dokumen sumber & nomor halaman | |
| Unggah gambar produk | |
| Kelola kompatibilitas fitting | |

Promosi versi adalah aksi berdampak luas: ia mengubah apa yang dilihat semua pengguna. Karena itu
memerlukan konfirmasi, mencatat audit, dan menginvalidasi cache katalog.

### 4.2 Validasi aturan — `domain_expert` · Fase 6

Area paling penting di back-office, karena ia yang membuka kunci "TERVERIFIKASI".

| Kemampuan | |
|---|---|
| Daftar aturan dengan status dan prioritas validasi |
| Lihat formula, masukan/keluaran, dan asalnya |
| Lihat test case beserta hasilnya |
| Lihat **di mana aturan ini memengaruhi tampilan pengguna** |
| Tandai `VALIDATED` atau `REJECTED` disertai catatan |
| Lihat riwayat versi |

Baris keempat perlu dibangun dengan sungguh-sungguh: seorang ahli pipa tidak seharusnya membaca kode
untuk tahu bahwa ENG-002 menentukan angka besar di layar ringkasan. Tampilkan dampaknya dalam bentuk
yang dia kenali.

Mempromosikan aturan ke `VALIDATED` mengubah nilai dari amber menjadi hijau di seluruh produk, jadi
tindakan itu tercatat lengkap dengan identitas dan waktunya.

### 4.3 Antrean handoff teknis — `technical_team` · Fase 10

| Kemampuan | |
|---|---|
| Antrean kasus dari "Kirim ke tim teknis Pralon" |
| Melihat snapshot kebutuhan lengkap — pelanggan tidak perlu menjelaskan ulang |
| Unduh ringkasan kebutuhan |
| Ubah status: `QUEUED` → `ACKNOWLEDGED` → `CLOSED` |
| Pelacakan SLA terhadap "1×24 jam kerja" |
| Catatan internal |

Pelacakan SLA bukan hiasan: SLA itu **dijanjikan kepada pelanggan di layar 11**. Kalau tidak diukur,
janji itu kosong.

### 4.4 Tinjauan email — `sales_reviewer` · Fase 11

| Kemampuan | |
|---|---|
| Kotak masuk dengan filter skor, intent, tanggal |
| Email asli berdampingan dengan analisis terstruktur |
| Sunting draf |
| Setujui & kirim |
| Tandai analisis salah → umpan balik untuk evaluasi |
| Tautkan ke konsultasi SNOUTY bila pengirimnya sama |

**Tidak ada jalur yang mengirim email tanpa persetujuan manusia** (`EMAIL_INTELLIGENCE.md` §1).

### 4.5 Dashboard penjualan & pasar — `sales_reviewer`, `admin` · Fase 12

Panel di `MARKET_INTELLIGENCE.md` §7: permintaan regional, minat produk, corong konsultasi, sinyal
cakupan, lead, dan biaya LLM. Semua menampilkan ukuran sampel; agregat dengan kelompok < 5 tidak
ditampilkan.

### 4.6 Pengguna & peran — `admin` · Fase 3

| Kemampuan | |
|---|---|
| Buat/nonaktifkan akun internal |
| Berikan/cabut peran |
| Lihat audit log dengan filter aktor, aksi, rentang waktu |
| Lihat permintaan ekspor/hapus data pengguna |

Akun internal **dinonaktifkan**, tidak dihapus — audit log harus tetap bisa merujuk pelakunya.

---

## 5. Navigasi dan tampilan

Rute di bawah `/internal` pada `apps/web` yang sama. Tidak dipecah menjadi aplikasi terpisah:
volumenya kecil dan memecahnya hanya menambah pipeline build.

Pola tampilan sampai ada desain: satu kolom, tabel rapat, aksi di kanan, token dan tipografi yang
sama dengan aplikasi pelanggan. Merah merek tetap hanya untuk aksi; hijau/amber tetap hanya untuk
status verifikasi/asumsi — aturan semantik warna berlaku sama di sini.

Yang **tidak** dipakai di back-office: mascot. Snouty adalah persona yang menghadap pelanggan; di
antarmuka operasional ia hanya menambah kebisingan.

---

## 6. Audit log

```
audit_logs(id, actor_id, actor_role, action, entity_type, entity_id,
           before_json, after_json, correlation_id, ip, created_at)
```

Yang wajib tercatat: promosi versi katalog, validasi/penolakan aturan, perubahan status handoff,
pengiriman email, perubahan peran, unduhan laporan pelanggan, dan ekspor/penghapusan data.

`before_json` / `after_json` menyimpan **field yang berubah saja**, bukan seluruh entitas — cukup
untuk audit tanpa menduplikasi basis data ke dalam log, dan tanpa menyalin data pribadi lebih banyak
dari yang diperlukan.

Retensi 24 bulan (`PRIVACY.md`).

---

## 7. Pengujian

| # | Tes |
|---|---|
| 1 | Setiap rute `/internal/*` menolak permintaan tanpa peran yang sesuai |
| 2 | Setiap operasi tulis menghasilkan baris audit |
| 3 | Promosi versi katalog menginvalidasi cache |
| 4 | Aturan yang dipromosikan ke `VALIDATED` mengubah provenance keluarannya |
| 5 | Impor melaporkan semua galat baris sekaligus |
| 6 | Unduhan laporan pelanggan oleh peran internal tercatat |
| 7 | Menonaktifkan akun internal tidak merusak referensi audit log |
| 8 | Peran tidak diwariskan secara implisit |
