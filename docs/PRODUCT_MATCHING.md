# SNOUTY — Product Matching

Fase 0c · P0c-04 · Terakhir diperbarui 2026-09-30

Dari kebutuhan teknik ke produk Pralon yang nyata. Sumbernya SPEC §11, layar 07.

---

## 1. Alur

```
Technical Requirement ──► Product Matcher ──► Katalog MySQL ──► Rekomendasi Pralon
```

Masukan matcher adalah keluaran Engineering Engine (peran jalur + ukuran + kelas material), bukan
teks pengguna. Matcher **tidak pernah** melihat pesan mentah dan tidak pernah memanggil LLM.

Ini yang membuat SPEC §11 — "LLM tidak pernah membuat nama produk atau SKU" — benar secara
struktural: matcher hanya bisa mengembalikan baris yang sudah ada di tabel.

---

## 2. Masukan

```ts
interface MatchRequest {
  role: 'main' | 'riser' | 'branch' | 'fixture_connection' | 'fitting';
  size: PipeSize | PipeSizeRange;
  pressureClass?: 'AW' | 'D';      // ENG-013
  application: 'air_bersih' | 'pembuangan';
  fittingKind?: 'tee' | 'elbow' | 'reducer' | 'socket';
  catalogVersionId: string;        // dibekukan per rekomendasi
}
```

---

## 3. Algoritme

Deterministik, berurutan, berhenti pada kecocokan pertama yang memenuhi.

```
1. Saring berdasarkan versi katalog aktif dan status = 'active'
2. Saring berdasarkan application (air bersih / pembuangan)
3. Saring berdasarkan pressureClass bila diminta (ENG-013: AW air bersih, D pembuangan)
4. Saring berdasarkan ketersediaan ukuran di product_sizes
5. Saring berdasarkan family yang sesuai peran
      main/riser/branch  → keluarga pipa
      fixture_connection → keluarga pipa ukuran kecil
      fitting            → keluarga fitting sesuai fittingKind
6. Urutkan: kecocokan ukuran persis  →  kelengkapan spesifikasi  →  SKU (stabil)
7. Ambil yang teratas
```

Langkah 6 layak dijelaskan. **Kelengkapan spesifikasi** dipakai sebagai pemecah imbang karena produk
yang datanya lengkap bisa ditampilkan sebagai `VERIFIED`, sedangkan produk setara yang kolomnya
kosong memaksa UI menampilkan "Lihat dokumen teknis". Bila dua produk sama-sama cocok, memilih yang
bisa dipertanggungjawabkan lebih baik untuk pengguna. Urutan terakhir berdasarkan SKU semata-mata
agar hasilnya stabil antar pemanggilan.

Yang **tidak** dipakai sebagai kriteria: harga, margin, stok, atau prioritas promosi. Bila salah
satunya nanti diperlukan, itu keputusan produk yang harus eksplisit — bukan diselundupkan ke dalam
pengurutan.

---

## 4. Tiga keadaan hasil

Persis tiga keadaan kartu produk di layar 07.

### `VERIFIED_SELECTED`

Produk ada, ukuran tersedia, spesifikasi lengkap.

Tampilan: border merah + cincin fokus, pill ukuran merah, tag hijau "✓ SPESIFIKASI TERVERIFIKASI".

### `SIZE_NEEDS_VALIDATION`

Keluarga produk cocok, tetapi ukurannya bergantung pada data yang belum diketahui.

Contoh dari desain: `Pralon PVC D`, ukuran `3"–4" ?`, alasan "Ukuran bergantung pada kemiringan dan
panjang jalur pembuangan yang belum diketahui." Tag: "PERLU DATA JALUR BUANGAN", aksi "Lengkapi
data".

Pill ukuran dirender putus-putus amber — dan yang penting, **rentangnya bukan pilihan**. Sistem tidak
memilih 3" lalu menandainya ragu; ia menyatakan belum bisa memilih.

### `INFORMATION_UNAVAILABLE`

Tidak ada produk yang memenuhi, atau varian yang diminta tidak ada di katalog.

Contoh dari desain: "Varian ukuran 2½" belum ada di katalog", dengan penjelasan "SNOUTY tidak
menampilkan spesifikasi yang tidak tersedia di data Pralon. Alternatif terdekat: PVC AW 2" atau 3"."
Kartu putus-putus abu-abu, tanpa gambar, aksi "Tanyakan ke tim teknis Pralon".

Perhatikan bahwa kartu ini tetap **berguna**: ia menyebut alternatif terdekat yang benar-benar ada di
katalog. Menyarankan alternatif nyata berbeda dari mengarang varian yang diminta.

---

## 5. Validasi kompatibilitas

Setelah produk utama terpilih, fitting diambil dari `product_compatibility`, bukan dicocokkan ulang
berdasarkan ukuran saja.

```
pipa terpilih ──► product_compatibility ──► fitting sepadan
                        │
                        └─ kosong → fitting tidak ditampilkan, bukan ditebak
```

Ini yang menjadikan janji "satu ekosistem fitting mengurangi risiko sambungan bocor" (kartu kriteria
layar 08) sebagai pernyataan berbasis data. Kalau kompatibilitasnya ditebak dari kesamaan ukuran,
janji itu kosong.

Reducer adalah kasus khusus: ia menghubungkan dua ukuran (`1" → 3/4"`), jadi pencariannya memakai
pasangan ukuran, dan keberadaannya diverifikasi di katalog — tidak dibentuk dari dua ukuran yang
kebetulan ada.

---

## 6. Provenance keluaran

| Keadaan | Provenance baris sistem |
|---|---|
| Produk `VERIFIED_SELECTED` **dan** aturan ukuran sudah `VALIDATED` | `VERIFIED` |
| Produk `VERIFIED_SELECTED` tetapi aturan ukuran belum divalidasi | `ASSUMED` |
| `SIZE_NEEDS_VALIDATION` | `UNAVAILABLE` untuk ukuran |
| `INFORMATION_UNAVAILABLE` | `UNAVAILABLE` |

Baris kedua adalah kondisi hari ini untuk hampir semua kasus: produknya nyata dan terverifikasi,
tetapi **ukuran yang direkomendasikan** berasal dari aturan yang belum divalidasi ahli (OQ-06).
Karena itu tabel "Rekomendasi Sistem" menampilkan ASUMSI meskipun kartu produknya menampilkan
"✓ SPESIFIKASI TERVERIFIKASI".

Perbedaan itu benar dan perlu dijaga: **spesifikasi produk terverifikasi** ≠ **pilihan ukuran
terverifikasi**. Yang pertama fakta katalog, yang kedua hasil aturan teknik.

---

## 7. Kebijakan yang berlaku di sini

| Kebijakan | Penegakan di matcher |
|---|---|
| Hanya Pralon | matcher hanya membaca `products`, yang hanya berisi produk Pralon (invarian C-2) |
| Tanpa halusinasi | tidak ada jalur menghasilkan SKU yang tidak ada barisnya |
| Provenance | keluaran melewati gerbang provenance yang sama |

Filter terakhir tetap ada di perakitan respons: bila sesuatu yang bukan dari matcher mencoba masuk
sebagai kartu produk, ia gugur karena `productId`-nya tidak ditemukan.

---

## 8. Kinerja

| | |
|---|---|
| Baca katalog di-cache Redis per versi | |
| Semua produk untuk satu rekomendasi diambil dalam **satu** query, bukan per peran | mencegah N+1 |
| Indeks: `products(family, category, status)`, `product_sizes(product_id, size)` | |
| Matcher murni sinkron; tanpa panggilan jaringan keluar | |

Target: < 50 ms untuk satu rekomendasi lengkap. Realistis, karena pekerjaannya satu query dan
penyaringan di memori.

---

## 9. Pengujian

| # | Tes |
|---|---|
| 1 | Produk terpilih selalu ada di katalog versi yang dibekukan |
| 2 | Ukuran terpilih selalu ada di `product_sizes` |
| 3 | Fitting hanya berasal dari `product_compatibility` |
| 4 | Pengurutan stabil: masukan sama → hasil sama |
| 5 | `SIZE_NEEDS_VALIDATION` tidak pernah memilih satu ukuran dari rentang |
| 6 | `INFORMATION_UNAVAILABLE` menyebut alternatif yang benar-benar ada |
| 7 | Aturan ukuran belum divalidasi → baris sistem `ASSUMED`, bukan `VERIFIED` |
| 8 | Contoh kerja board (2 lantai, 3 kamar mandi, 4 wastafel, 1 dapur) menghasilkan 4 produk |
| 9 | Tidak ada query per peran (tes penghitung query) |

Tes 8 mengunci perilaku ke satu-satunya contoh yang sudah digambar dan ditinjau manusia.
