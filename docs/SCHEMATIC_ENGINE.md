# SNOUTY — Schematic Engine

Fase 0c · P0c-05 · Terakhir diperbarui 2026-09-30

Bagaimana skema instalasi dibentuk dan digambar. Sumbernya SPEC §13, layar 09.

---

## 1. Prinsip

**Tidak ada gambar hasil generasi AI yang diperlakukan sebagai kebenaran teknik.**

Skema adalah **topologi terstruktur** yang dihasilkan secara deterministik dari requirement state dan
keluaran Engineering Engine. Renderer membaca topologi itu; ia tidak menambahkan informasi.

Pemisahan ini memberi tiga hal: gambar selalu konsisten dengan tabel sistem dan BOM (karena
sumbernya sama), skenario "bagaimana kalau" hanyalah perhitungan ulang, dan topologi bisa diuji tanpa
merender apa pun.

---

## 2. Model topologi

```ts
interface Schematic {
  floors: Floor[];
  nodes: Node[];
  segments: Segment[];
  groundLevel: '±0.00';
  titleBlock: TitleBlock;
}

interface Floor {
  level: number; // 1 = lantai dasar
  label: string; // "LANTAI 2"
  shortLabel: string; // "LT 2"
  elevation: TrackedValue<number>; // (level-1) × floorHeight — ASSUMED bila tinggi default
  elevationLabel: string; // "+3.50" / "±0.00"
}

interface Node {
  id: string;
  type: 'water_source' | 'riser' | 'branch' | 'fixture' | 'fitting';
  floorLevel: number | 'roof';
  code?: string; // "KM-2A", "WF-1", "DP-1"
  label?: string; // "Kamar mandi", "Wastafel ×2"
  size?: PipeSize;
  provenance: Provenance;
}

interface Segment {
  from: string;
  to: string;
  role: 'main' | 'riser' | 'branch' | 'fixture_connection';
  size: PipeSize;
  productId?: string;
  lengthM?: TrackedValue<number>;
  provenance: Provenance;
}

interface TitleBlock {
  drawing: 'SK-01 AIR BERSIH';
  scale: 'NTS';
  floorHeight: string; // "3,50 M · ASUMSI" — provenance ikut tampil di gambar
  source: string; // "KATALOG v2.4"
}
```

`titleBlock` bukan hiasan. Prototipe baru menggambar blok judul gambar teknik, dan isian tinggi
lantainya berbunyi "3,50 M · ASUMSI" — artinya provenance muncul **di dalam gambar**, bukan hanya di
tabel. Perilaku itu dipertahankan.

Elevasi juga `TrackedValue`: bila tinggi lantai memakai default ENG-004, seluruh elevasi yang
diturunkan darinya bersifat `ASSUMED`.

---

## 3. Pembentukan topologi

Deterministik, dari requirement state + keluaran engine.

```
1. Tentukan jumlah lantai dari building.floors
2. Tempatkan sumber air
      toren atap → node di level 'roof'
      pompa/PDAM → node di level 1
3. Buat segmen main: sumber → pangkal riser, ukuran = mainSize (ENG-002)
4. Buat riser vertikal melalui semua lantai, ukuran = mainSize
5. Untuk setiap lantai:
      buat node branch, ukuran 3/4"
      buat node fitting reducer (mainSize → 3/4") di titik percabangan
      distribusikan titik air dengan ENG-008
      buat segmen fixture_connection 1/2" (ENG-005) ke setiap titik
6. Hitung elevasi: (level-1) × floorHeight
7. Tandai provenance setiap node dan segmen lewat gerbang provenance
```

Batas 3 lantai pada prototipe **tidak** dibawa — itu keterbatasan rendering, bukan aturan teknik
(OQ-33). Bangunan 5 lantai menghasilkan 5 lantai; renderer yang menyesuaikan diri.

Penamaan kode node mengikuti desain: `KM-<lantai><huruf>` untuk kamar mandi, `WF-<lantai>` untuk
wastafel, `DP-<lantai>` untuk dapur.

---

## 4. Renderer

**SVG**, bukan library diagram. Alasannya: gambar di prototipe adalah gambar teknik dengan aturan
tata letak yang tetap — kolom label, kolom riser, area cabang, garis lantai, blok judul. React Flow
dirancang untuk graf yang bisa digeser pengguna, dan itu bukan yang dibutuhkan di sini.

Tata letak mengikuti prototipe:

| Elemen              | Spesifikasi                                                |
| ------------------- | ---------------------------------------------------------- |
| Kanvas              | latar `#FCFDFC`, kisi 24×24 px garis `#EEF1F0`             |
| Kolom label lantai  | 84 px — "LT 2" mono 13px + elevasi 9,5px                   |
| Kolom riser         | 76 px, batang merah 4 px                                   |
| Garis lantai        | border bawah 3 px `#B9C1C0`                                |
| Jalur utama & riser | 4 px `#DF301C`                                             |
| Cabang              | 3 px `#EE7A67`                                             |
| Sambungan fixture   | 2 px `#AEB6B7`                                             |
| Titik tee/reducer   | lingkaran 14 px, border 3 px `#DF301C`, isi putih          |
| Node fixture        | kotak 96 px, border 1 px, kode + ukuran mono, label 11,5px |
| Muka tanah          | garis arsir 135° + "±0.00 MUKA TANAH"                      |
| Lebar minimum       | 500 px, dengan `overflow-x: auto`                          |

Panel kanan memuat **DAFTAR JALUR** (nama, ukuran, catatan per segmen) dan blok judul 2×2:
GAMBAR / SKALA / TINGGI LANTAI / SUMBER.

Legenda di bawah kanvas: Jalur utama & riser · Cabang per lantai · Sambungan fixture · Tee + reducer.

---

## 5. Catatan wajib

Setiap tampilan skema membawa dua penegasan, dan tidak ada mode yang menghilangkannya (invarian S-1):

> **SKEMATIK · BUKAN GAMBAR KERJA**

> **CATATAN SKEMA** — Skema menunjukkan hubungan antar jalur, bukan posisi fisik pipa di bangunan.
> Panjang jalur dan posisi shaft ditentukan saat pelaksanaan.

Ini bukan disclaimer hukum yang ditempel belakangan; ini pernyataan yang tepat tentang apa yang
sistem memang tahu. Sistem tidak punya denah, jadi tidak tahu posisi fisik apa pun.

---

## 6. Skenario "bagaimana kalau"

Layar 09 menawarkan tiga tombol skenario: _Toren dipindah ke lantai 3_, _Tambah 1 kamar mandi_,
_Pakai pompa pendorong_.

Ketiganya adalah **mutasi requirement**, bukan gambar terpisah:

```
tombol skenario ──► patch requirement ──► ContextMerger ──► hitung ulang
                                                              ├─ tabel sistem
                                                              ├─ BOM
                                                              └─ topologi skema
```

Tidak ada panggilan LLM, tidak ada gambar yang disimpan sebelumnya. Konsekuensinya penting: kalau
menambah kamar mandi mengubah ukuran jalur utama, **gambar, tabel, dan BOM berubah bersamaan** —
karena semuanya turunan dari state yang sama. Kalau gambar dibuat terpisah, ketiganya akan
bertentangan cepat atau lambat.

Perubahan skenario juga bisa memicu mood mascot `surprised` bila hasilnya berubah besar.

---

## 7. Ekspor

Board layar 09 menampilkan tombol **"Unduh PNG"** yang tidak disebut di SPEC (OQ-29). Usulan:
ditunda setelah MVP. Bila nanti dibuat, rendernya di sisi server dari SVG yang sama (worker sudah
punya Chromium untuk PDF), sehingga hasil unduhan identik dengan yang dilihat di layar.

Skema **memang** tampil di laporan PDF, dirender dari SVG yang sama.

---

## 8. Aksesibilitas

|                                                                                                           |     |
| --------------------------------------------------------------------------------------------------------- | --- |
| SVG punya `role="img"` dan `aria-label` yang merangkum sistem                                             |
| Padanan tekstual tersedia: DAFTAR JALUR sudah merupakan versi teks dari gambar                            |
| Warna bukan satu-satunya pembeda — setiap jalur juga berbeda ketebalan (4/3/2 px) dan berlabel di legenda |
| Kontras garis diverifikasi di kedua tema                                                                  |
| Di mode gelap: kisi `#1D2224`, garis lantai `#566064`, node `#4A5356`, merah merek tetap `#DF301C`        |

Poin ketebalan garis penting: bagi pengguna dengan buta warna merah-hijau, merah `#DF301C` dan salmon
`#EE7A67` nyaris tidak terbedakan. Perbedaan 4 px vs 3 px, ditambah label di DAFTAR JALUR, yang
membawa maknanya.

---

## 9. Pengujian

| #   | Tes                                                                                          |
| --- | -------------------------------------------------------------------------------------------- |
| 1   | Topologi deterministik: state sama → topologi identik                                        |
| 2   | Setiap segmen menunjuk node yang ada                                                         |
| 3   | Jumlah node fixture = `outletCount`                                                          |
| 4   | Elevasi = (level−1) × floorHeight, dan `ASSUMED` bila tinggi lantai default                  |
| 5   | Tinggi lantai default membuat seluruh elevasi `ASSUMED`                                      |
| 6   | Bangunan > 3 lantai menghasilkan > 3 lantai (tanpa batas prototipe)                          |
| 7   | Mutasi skenario mengubah topologi, tabel, dan BOM secara konsisten                           |
| 8   | Catatan "bukan gambar kerja" selalu ada                                                      |
| 9   | Contoh kerja board menghasilkan: toren atap, riser 1", 2 lantai, cabang 3/4", 8 node fixture |
| 10  | Pembentukan topologi tidak memanggil LLM maupun jaringan                                     |
