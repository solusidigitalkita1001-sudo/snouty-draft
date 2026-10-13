# SNOUTY — Keputusan Desain Pemilik

Sumber kebenaran visual tertinggi (`docs/DESIGN_IMPLEMENTATION.md` §1). Keputusan di sini
menggantikan prototipe dan handoff Claude Design untuk bagian yang disebut.

---

## DD-01 · Layar solusi dan laporan v2 (2026-10-13)

**Acuan:** `design-input/mockups/2026-10-13-solusi-laporan-v2.html` (mockup yang disetujui pemilik).
Kotak biru bergaris putus dan tab "Peta gambar" di mockup hanya catatan review, tidak dibangun.

**Berlaku untuk:** layar solusi (tab Ringkasan, Produk Pralon, Denah, Estimasi Material) **dan**
laporan PDF. Keduanya memakai struktur data yang sama.

Permintaan pemilik (10 butir) dan keputusannya:

| #   | Permintaan                                         | Keputusan                                                                                                                                                         |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Ringkasan bergambar sesuai kebutuhan               | Kartu kebutuhan bergambar (bangunan, kamar mandi, kloset, wastafel, dapur, toren, pompa, …) dibaca dari data kebutuhan, bukan dari teks; ditambah alur air bergambar |
| 2   | Tanpa metatext                                     | Audit seluruh teks layar dan PDF                                                                                                                                  |
| 3   | Tab Produk bergambar                               | Foto produk dari pralon.com, disimpan di server SNOUTY (tidak di-hotlink); sebelum ada foto, gambar produk per jenis                                                |
| 4   | Produk tidak cocok dengan estimasi material        | Satu sumber: tab Produk diturunkan dari BOQ; tiap kartu menyebut jumlah dan nomor baris BOQ                                                                        |
| 5   | Terlalu banyak teks                                | Satu kalimat per bagian; detail di tabel dasar perhitungan                                                                                                         |
| 6   | Produk dari pralon.com sesuai rekomendasi          | Lihat #3; tautan "Lihat di pralon.com" hanya bila halamannya ada                                                                                                    |
| 7   | Denah lebih detail                                 | Potongan instalasi (ukuran per segmen, ventilasi, septic, blok judul) + denah jalur per lantai berskala ukuran bangunan; letak ruang tidak dikarang                  |
| 8   | Estimasi material berupa BOQ                       | BOQ per sistem (air bersih / air kotor / air bekas), lalu pipa / fitting; kolom No · Uraian + produk · Ukuran · Kelas · Volume · Satuan · Keterangan; **tanpa harga** |
| 9   | Dasar perhitungan dipisah dari BOQ                 | Tabel tersendiri di bawah BOQ, merujuk nomor baris BOQ; ditambah tabel alasan ukuran pipa                                                                          |
| 10  | Asumsi dalam tabel terklasifikasi                  | Tabel per kategori (Bangunan · Isi ruangan · Sumber air · Panjang jalur · Teknik), kolom Asumsi · Nilai · Asal · Ubah                                              |

Keputusan tambahan pada hari yang sama:

- **Ilustrasi digambar khusus** (SVG, token warna SNOUTY, terang dan gelap) dan mencakup **semua**
  jenis kasus serta **semua pilihan di kartu pertanyaan** (sumber air, cara pasang, kontur, jenis
  tanah, beban jalan, metode irigasi, tanaman, bahan pipa, …). Peta lengkapnya ada di tab "Peta
  gambar" mockup.
- **"Coba ubah"** (toren dinaikkan, tambah kamar mandi, langsung PDAM, toren bawah + pompa) berupa
  tombol bergambar di tab Denah; angkanya dihitung ulang oleh engine, tidak pernah dikarang.
- Fitting yang belum dihitung engine (elbow, sok, dop, Y-branch, clean out) tetap tercantum di BOQ
  dengan keterangan "dihitung saat pemasangan" — tidak disembunyikan, tidak diberi angka karangan.
