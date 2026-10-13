# Foto produk dari pralon.com

Diambil 2026-10-13 dari https://www.pralon.com/product atas persetujuan pemilik (Pralon) untuk
dipakai di kartu produk SNOUTY. Folder ini hanya staging: belum ada kode, database, atau kolom
`image_url` katalog yang diubah.

## Cara situs menyajikan data produk

Halaman `/product` adalah HTML Laravel + jQuery. Daftar produk tidak ada di HTML awal; skrip inline
memanggil endpoint JSON publik (GET, tanpa autentikasi, tanpa token CSRF yang diperiksa):

| Endpoint | Isi |
| --- | --- |
| `GET https://www.pralon.com/fetch-categories` | `{meta, data:[{id, name, ordering}]}` — 4 kategori: uPVC (1), PE (2), Fitting (3), Aksesoris (4) |
| `GET https://www.pralon.com/fetch-product?page=N` | Paginasi Laravel (`current_page`, `last_page`, `total`, `per_page`=8, `links`, `data`). Total 13 produk, 2 halaman |
| `GET https://www.pralon.com/fetch-product-by-category?category_id=N` | Sama, difilter per kategori |
| `GET https://www.pralon.com/product-detail/{id}/{slug}` | Halaman detail dirender server (tanpa JS); memuat 2 gambar `detail_image` |

Field per produk di `data[]`: `id, category_id, name, full_name, slug, short_desc, main_desc, image,
created_at, updated_at`. `image` adalah path relatif, mis.
`storage/uploads/master_image/pipa-upvc-jis-master-image.webp`, ditampilkan sebagai
`https://www.pralon.com/{image}`. Halaman detail menambah dua gambar
`https://www.pralon.com/storage/uploads/detail_image/<nama>-detail-image-{0,1}.webp` (pengecualian:
Pipa HDPE GAS memakai `produk-3.jpg` dan `produk-4.jpg`).

Tombol "Katalog Produk" dan "Daftar Harga" di halaman detail dibuka lewat formulir unduhan
(modal); tidak diambil.

## Granularitas gambar

Gambar **per lini produk** (13 lini), bukan per SKU, ukuran, atau jenis fitting:

- 13 `master_image`: foto produk cutout (beberapa batang pipa atau kumpulan fitting di atas latar
  lingkaran abu muda, latar putih). Cocok untuk kartu produk tingkat family.
- 26 `detail_image`: sebagian besar foto aplikasi/lapangan (pemasangan, gudang, pekerja). Hanya dua
  milik Fabricated Fitting yang berupa foto satu fitting terisolasi.

Lini di pralon.com: Pipa uPVC SNI, Pipa Gold JIS (VP/VU), Pralon Standard (AW/D), Pralon Jacking,
Pipa uPVC SNI Coklat, Pralon HDPE, Pipa HDPE GAS (MDPE), Pralon Subduct, Pralon HIC, Injection
Fitting, Handmade (Fabricated) Fitting, Solvent Cement, Lubricant.

## Resolusi dan format

| Jenis | Format | Dimensi |
| --- | --- | --- |
| master (10 file) | WebP | 1935 × 1797 |
| master (Pralon Standard, SNI Coklat, HDPE) | JPEG | 645 × 599 |
| detail | WebP (24), JPEG (2, pipa gas) | 1380 × 1380 |

Total 38 file, 2,7 MB (2.730.309 byte).

## Yang dilewati

- `detail_image/pipa-upvc-sni-air-bersih-detail-image-0.webp` (halaman Pipa uPVC SNI): fotonya
  pemasangan **pipa beton**, bukan produk Pralon. Tidak disimpan.
- Logo, ikon panah, spinner, dan gambar "produk terkait" (duplikat master_image) tidak diambil.

## robots.txt dan etika pengambilan

`/robots.txt` dan `/sitemap.xml` mengembalikan 404 (halaman "Not Found" Laravel), baik di
`www.pralon.com` maupun `pralon.com`; tidak ada larangan crawl. Pengambilan dilakukan berurutan
dengan jeda 0,5–1 detik: 3 panggilan JSON, 13 halaman detail, 39 gambar. Tidak ada proteksi
hotlink: gambar terunduh dengan HTTP 200 tanpa header `Referer`. Tidak butuh browser.

## Penamaan file

`raw/<id 2 digit>-<slug pralon.com>-master.<ext>` dan `raw/<id>-<slug>-detail-<n>.<ext>`.
`id` dan `slug` adalah milik pralon.com (stabil di URL `product-detail`), bukan SKU katalog.

## Pemetaan ke katalog

Lihat `mapping.csv`. Kolom `catalog_family`/`catalog_category` memakai nilai dari
`data/catalog/2026-10-06-erp/snouty_catalog_import_inch.csv`; baris bertanda `[katalog mm PENDING]`
memakai family dari `snouty_catalog_import_mm_PENDING.csv` karena lini SNI metrik, HDPE, MDPE, dan
HIC tidak ada di katalog inci. Gambar tanpa padanan diberi kolom katalog kosong dan
`confidence = none`.

Catatan yang perlu keputusan pemilik:

- Katalog ERP tidak membedakan fitting injection dan fabricated; kedua foto kumpulan fitting
  dipetakan ke `FITTING PVC` dengan confidence medium. Tidak ada foto per jenis fitting (tee, elbow,
  socket, dst.), kecuali dua foto fabricated metrik SNI (confidence low).
- Pralon Standard menyebut kelas AW dan D; fotonya AW. Kelas C tidak disebut di pralon.com.
- Pipa Gold JIS menyebut VP dan VU; fotonya VP.
- Foto aplikasi (`detail`) tidak disarankan untuk kartu produk; dipetakan dengan confidence low.
