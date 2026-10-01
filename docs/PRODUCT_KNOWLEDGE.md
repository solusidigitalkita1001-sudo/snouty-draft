# SNOUTY — Pengetahuan Produk

Fase 0c · P0c-03 · Disesuaikan dengan implementasi Fase 1 pada P1-12 · Terakhir diperbarui 2026-10-01

Dari mana fakta produk berasal, bagaimana ia masuk, dan bagaimana ia dijawab. Sumbernya SPEC §9, §10.

Bagian yang menyebut nama berkas atau nama constraint sudah **terlaksana**; yang masih menunggu
jawaban ditandai nomor OQ-nya di tempatnya masing-masing.

---

## 1. Dua jenis pengetahuan

| Jenis               | Tempat                          | Contoh pertanyaan                                                      |
| ------------------- | ------------------------------- | ---------------------------------------------------------------------- |
| **Terstruktur**     | MySQL                           | "Ada ukuran 3/4 inch?" · "Standarnya apa?" · "Fitting apa yang cocok?" |
| **Tak terstruktur** | dokumen (Qdrant, bila diadopsi) | "Bagaimana cara menyambung pipa yang benar?"                           |

Pembedaan ini menentukan biaya dan ketepatan. Pertanyaan terstruktur dijawab dengan `SELECT` —
cepat, murah, dan pasti benar. Menjalankan pencarian vektor untuk "ada ukuran 3/4 inch?" lebih
lambat, lebih mahal, dan bisa salah.

Aturannya: **bila jawabannya ada di kolom, jangan mencarinya di dokumen.**

---

## 2. Model data katalog

### `CatalogVersion`

| Field                         |                                                      |
| ----------------------------- | ---------------------------------------------------- |
| `label`                       | mis. `v2.4` — tampil sebagai "KATALOG PRALON · v2.4" |
| `sourceDocument`              | mis. "Katalog produk Pralon 2026"                    |
| `effectiveFrom`, `importedBy` |                                                      |
| `status`                      | `draft` \| `active` \| `archived`                    |

Tepat satu versi `active`. Impor masuk sebagai `draft`, divalidasi, lalu dipromosikan. Rekomendasi
membekukan `catalogVersionId` saat dibuat, sehingga laporan lama tetap konsisten meski katalog
berubah.

### `Product`

| Field                               | Wajib | Bila kosong                            |
| ----------------------------------- | ----- | -------------------------------------- |
| `sku`, `name`, `family`, `category` | ya    | impor ditolak                          |
| `sourceDocument`, `sourcePage`      | ya    | impor ditolak                          |
| `material`                          | tidak | `UNAVAILABLE`                          |
| `standard`                          | tidak | `UNAVAILABLE`                          |
| `pressureClass` (tekanan kerja)     | tidak | `UNAVAILABLE` → "Lihat dokumen teknis" |
| `rodLength` (panjang batang)        | tidak | `UNAVAILABLE`                          |
| `jointType` (sambungan)             | tidak | `UNAVAILABLE`                          |
| `application`                       | tidak | `UNAVAILABLE`                          |
| `status`                            | ya    | `active` \| `discontinued`             |
| `imageUrl`                          | tidak | placeholder bergaris                   |

`sourceDocument` dan `sourcePage` wajib karena UI menampilkannya: "Katalog produk Pralon 2026 ·
hal. 14". Baris itu adalah janji bahwa data ini bisa dicek — jadi tidak boleh ada produk yang tidak
bisa ditelusuri ke halaman katalog.

Contoh nyata dari desain yang menunjukkan perilaku benar: **Pralon PVC AW** punya `Tekanan kerja` =
"Lihat dokumen teknis". Itu bukan data yang belum lengkap; itu cara yang benar menampilkan kolom
kosong.

### Tabel pendamping

| Tabel                   | Isi                                                          |
| ----------------------- | ------------------------------------------------------------ |
| `product_sizes`         | `PipeSize` kanonik + ketersediaan                            |
| `product_specs`         | pasangan kunci-nilai tambahan dengan provenance sendiri      |
| `product_compatibility` | pipa ↔ fitting sepadan — sumber blok "FITTING YANG SEPADAN"  |
| `product_documents`     | tautan datasheet / dokumen teknis                            |
| `product_images`        | foto produk 1:1                                              |
| `catalog_import_runs`   | satu kali upaya impor: status, hitungan baris, laporan galat |

`product_compatibility` penting: daftar fitting di drawer produk berasal dari tabel ini, **bukan**
dari tebakan model. Janji produk "satu ekosistem fitting mengurangi risiko sambungan bocor" hanya
bermakna bila kompatibilitasnya data, bukan karangan.

### Jaminan yang dipegang database, bukan kode

Enam aturan di dokumen ini ditegakkan oleh constraint, sehingga kode yang lupa memeriksanya tetap
tidak bisa melanggarnya. Ini bukan sabuk-dan-bretel: constraint-lah pemeriksanya, dan kode hanya
kenyamanan.

| Jaminan                                         | Ditegakkan oleh                                           |
| ----------------------------------------------- | --------------------------------------------------------- |
| Tepat satu versi `active`                       | kolom terbangkitkan + `uq_catalog_versions_single_active` |
| `sku` unik dalam satu versi                     | `uq_products_version_sku`                                 |
| Satu baris impor tidak bisa masuk dua kali      | `uq_products_version_row_hash`                            |
| Spesifikasi hanya `VERIFIED` atau `UNAVAILABLE` | `ck_product_specs_provenance` (invarian C-1)              |
| Nilai kosong tidak bisa mengaku `VERIFIED`      | `ck_product_specs_empty_is_unavailable`                   |
| `source_page` selalu bilangan positif           | `ck_products_source_page`                                 |

`products.row_hash` adalah sidik jari baris impor yang melahirkan produk itu. Ia ada demi idempotensi
job: memproses ulang pesan yang sama — hal yang pasti terjadi pada antrean dengan retry — tidak bisa
menduplikasi produk.

### Ukuran pipa

Ukuran adalah value object, bukan string bebas. Desain memakai `1/2"`, `3/4"`, `1"`, `1¼"`, `1½"`,
`2"`, `3"`, `4"` — pecahan, dengan `¼`/`½` di atas 1 inci. Perbandingan dilakukan atas nilai numerik
internal, tampilan memakai label kanonik. Tanpa ini, `1.25"` dan `1¼"` akan dianggap dua ukuran
berbeda dan matcher akan meleset.

---

## 3. Impor katalog

```
unggah berkas ──► parse ──► validasi baris ──► draft CatalogVersion
                                │ ada galat → laporan galat per baris, tidak ada yang masuk
                                ▼
                        tinjau oleh catalog_admin ──► promosikan ke active
```

Berjalan sebagai job RabbitMQ (`catalog.ingest`), idempoten dengan kunci
`catalogVersionId + rowHash`, sehingga menjalankan ulang impor yang setengah jadi aman.

### Kontrak bebas format

Yang dibekukan adalah bentuk **sesudah** parsing, bukan bentuk berkasnya
(`product-catalog/domain/catalog-import.contract.ts`). Satu adapter mengubah sumber apa pun —
Excel, CSV, ekspor ERP — menjadi `CatalogImportSource`; validasi, job, dan layar back-office
tidak pernah tahu formatnya.

| Bagian                    | Isi                                                                               |
| ------------------------- | --------------------------------------------------------------------------------- |
| `label`, `sourceDocument` | metadata versi yang akan dibuat                                                   |
| `columns`                 | kolom yang benar-benar ada — supaya kolom wajib yang hilang dilaporkan **sekali** |
| `rows`                    | sel mentah per baris, `string` atau daftar `string`                               |

Nilai jamak dalam satu sel dipisah `;` atau baris baru. Rujukan fitting ditulis `SKU:jenis`
(`DEV-FIT-TEE:tee`); dokumen teknis `Judul|URL|halaman` dengan halaman opsional; gambar cukup URL-nya,
dan urutan penulisannya menjadi urutan tampil. Adapter yang sudah punya daftar boleh mengirimnya apa
adanya, jadi konvensi pemisah hanya berlaku untuk sumber tabular. Konvensi ini usulan, bukan keputusan
final — **OQ-39**.

Halaman dokumen boleh kosong — tidak setiap dokumen dirujuk per halaman. Halaman yang **disebut**
tetapi tidak masuk akal ditolak: rujukan halaman adalah janji bahwa isinya bisa dicek di sana.

Adapter untuk format Pralon yang sebenarnya **belum ada**: ia menunggu **OQ-07**.

### Idempotensi berlapis tiga

Dari luar ke dalam, dan lapisan terdalam yang menentukan karena dua lapisan pertama adalah kode:

1. Run yang sudah `ingested` mengembalikan hasil tersimpannya tanpa menyentuh database.
2. Versi draft yang sudah tertaut pada run dipakai ulang — ini yang menyelamatkan proses yang mati
   di tengah jalan.
3. Penyisipan baris dikunci `uq_products_version_row_hash`.

`catalog_import_runs` ada karena idempotensi membutuhkan identitas yang terbit **sebelum**
pekerjaannya dimulai: kunci barisnya `catalogVersionId + rowHash`, tetapi versi katalognya sendiri
baru dibuat setelah validasi lolos.

Aturan validasi:

|                                                                               |     |
| ----------------------------------------------------------------------------- | --- |
| `sku` unik dalam satu versi                                                   |     |
| Field wajib terisi                                                            |     |
| Ukuran dapat diurai ke `PipeSize` kanonik                                     |     |
| Referensi kompatibilitas menunjuk SKU yang ada                                |     |
| `sourcePage` berupa bilangan positif                                          |     |
| **Baris gagal tidak memblokir baris lain** — semua galat dilaporkan sekaligus |     |

Poin terakhir berdasarkan pengalaman umum impor: memperbaiki 40 galat satu per satu, masing-masing
menunggu satu putaran impor, adalah cara tercepat membuat admin menyerah. Dua rinciannya yang
menentukan apakah laporannya benar-benar bisa dipakai:

- **Kolom wajib yang hilang dilaporkan sekali** untuk seluruh berkas (`rowNumber: 0`), bukan sekali
  per baris. Lima ratus salinan galat yang sama menenggelamkan masalah sesungguhnya.
- **SKU ganda dibandingkan tanpa membedakan huruf besar-kecil**, karena collation baku MySQL juga
  begitu. Membedakannya di sini akan memindahkan kegagalan ke `uq_products_version_sku` saat job
  berjalan — jauh dari admin yang bisa memperbaikinya.

**Seluruhnya atau tidak sama sekali.** Versi `draft` hanya dibuat bila jumlah galatnya nol: versi
setengah terisi tetap _terlihat_ lengkap di layar promosi, dan admin yang mempromosikannya akan
mengirim katalog berlubang ke pengguna. Ini usulan default, bukan keputusan final — **OQ-38**, karena
diagram di atas dan `CatalogImportResult` semula menyiratkan dua model berbeda.

Sumber katalog sebenarnya belum ditentukan (OQ-07); default yang diusulkan adalah Excel/CSV.

### Katalog contoh untuk pengembangan

`pnpm --filter @snouty/api seed:sample` menyemai katalog **karangan** — setiap SKU berawalan `DEV-`,
setiap nama berawalan "CONTOH", dan `source_document` menyatakannya dengan huruf besar. Ia disemai
lewat jalur impor yang sungguhan, jadi contohnya tidak bisa menyimpang dari apa yang dihasilkan
importer nyata. Dua pagar menolak secara baku: `SEED_SAMPLE_CATALOG=1` wajib diset, dan skripnya
menolak host `192.168.1.136`.

---

## 4. Lookup terstruktur

Pertanyaan yang dijawab langsung dari MySQL, tanpa LLM untuk faktanya (LLM hanya merangkai
kalimatnya):

| Pertanyaan                       | Query                                       |
| -------------------------------- | ------------------------------------------- |
| "Ada ukuran 3/4 inch?"           | `product_sizes` berdasarkan produk + ukuran |
| "Standarnya apa?"                | kolom `standard`                            |
| "Fitting apa yang cocok?"        | `product_compatibility`                     |
| "Tekanan kerjanya berapa?"       | `pressureClass` → sering `UNAVAILABLE`      |
| "Ukuran apa saja yang tersedia?" | semua `product_sizes`                       |

Bila kolomnya kosong, jawabannya adalah "informasi ini belum tersedia di data katalog, silakan lihat
dokumen teknis" — **bukan** perkiraan, dan bukan pula pencarian ke dokumen dengan harapan menemukan
angkanya. Menambal kolom kosong dengan hasil pencarian adalah cara halus untuk berhalusinasi.

### Kosakata aspek yang tertutup

Pertanyaan bebas dipetakan ke salah satu dari sembilan aspek di
`product-knowledge/domain/product-aspect.ts`; intent router di Fase 4 memetakan, bukan mengarang nama
aspek sendiri. Setiap aspek **wajib** punya jalur data, dan kelengkapan petanya diperiksa satu tes —
aspek yang lupa dipetakan tidak akan menimbulkan galat apa pun, ia hanya akan dijawab model dari
ingatannya.

Enam aspek spesifikasi bernama **persis** seperti `spec_key`-nya di database. Dua kosakata untuk satu
hal akan menuntut tabel pemetaan, dan tabel pemetaan adalah tempat penyimpangan bersembunyi.

Pertanyaan yang tidak memetakan ke mana pun adalah pertanyaan yang belum didukung. Jawaban yang benar
untuk itu adalah mengakuinya, bukan menebak aspek terdekat.

### Empat jalur jawaban

| Keadaan                             | Jawaban            | Tampilan                        |
| ----------------------------------- | ------------------ | ------------------------------- |
| Kolom terisi                        | `value` / `list`   | nilai + tag provenance          |
| Ukuran ditanyakan, katalog menjawab | `availability`     | ya / tidak                      |
| Kolom kosong, ada dokumen teknis    | `unavailable`      | "Lihat dokumen teknis"          |
| Kolom kosong, tidak ada dokumen     | `insufficientData` | "data belum cukup" + tim teknis |

Baris ketiga adalah tempat kesalahan paling mahal menunggu: dokumennya **ditawarkan**, tidak dibaca
untuk mengisi nilainya.

Dua pembedaan yang mudah tertukar, dan keduanya dijaga tes:

- **"Katalog menyatakan tidak tersedia"** bukan **"saya tidak tahu".** Produk yang punya daftar
  ukuran tetapi tanpa ukuran yang ditanyakan sudah menjawab; produk yang daftar ukurannya kosong sama
  sekali belum. Yang pertama `VERIFIED`, yang kedua `UNAVAILABLE`.
- **Pertanyaan ketersediaan ukuran tanpa ukurannya ditolak**, tidak dibulatkan ke ukuran terdekat.
  Menebak ukuran yang dimaksud berarti menjawab pertanyaan yang tidak diajukan.

Seluruh jalur ini **tidak memanggil LLM sama sekali**. LLM merangkai kalimatnya memakai `ProductAnswer`
sebagai satu-satunya bahan.

---

## 5. RAG — kriteria adopsi

**Belum diadopsi.** SPEC §10 mengatakan Qdrant dipakai "hanya bila retrieval semantik memang
dibutuhkan"; berikut ujinya.

Adopsi ketika **semua** terpenuhi:

1. Ada ≥ 50 dokumen teknis tak terstruktur yang tidak bisa direpresentasikan sebagai kolom.
2. Terukur ≥ 10% pertanyaan produk nyata tidak terjawab oleh query MySQL.
3. Pertanyaan itu memang semantik (parafrase, sinonim, konseptual) — **bukan** sekadar kolom yang
   belum ada.

Syarat ketiga yang paling sering diabaikan. Bila "tekanan kerja" tidak terjawab karena kolomnya
kosong, solusinya mengisi kolom, bukan meng-embed PDF-nya.

Antarmuka sudah didefinisikan sejak awal dengan implementasi MySQL:

```ts
interface KnowledgeRetriever {
  retrieve(query: string, filter: RetrievalFilter): Promise<RetrievedChunk[]>;
}
```

Sehingga mengadopsi Qdrant nanti berarti menambah implementasi, bukan merombak.

Implementasi yang ada (`CatalogDocumentRetriever`) mencocokkan **judul** dokumen, karena hanya itu
yang disimpan sistem ini: `product_documents` memuat judul, URL, dan halaman — tidak ada isi dokumen.
Itu bukan kekurangan implementasi, itu keadaan korpusnya, dan sekaligus bukti langsung untuk kriteria
#1 di atas. Satu batasan dibawa di tingkat kontrak: **hasil retrieval tidak pernah menjadi nilai
spesifikasi**, hanya pernah menjadi tawaran "buka dokumen teknis". Ambang skor minimum ditegakkan
walaupun pencocokannya sederhana — "kembalikan apa pun yang paling mirip" adalah perilaku baku yang
paling sulit dicabut setelah ada yang bergantung padanya.

### Cara mengukur kriteria #2

Kriteria kedua berbunyi "**terukur** ≥ 10%", jadi ia butuh angka — bukan perasaan, karena perasaan
cenderung membenarkan teknologi yang sedang ingin dipakai. Setiap pertanyaan yang tidak terjawab
katalog menulis satu baris log terstruktur bernama `product_question.unanswered`, memuat **hanya**
`productId`, `aspect`, `hasDocuments`, dan `catalogVersionId`.

**Isi pertanyaan pengguna tidak pernah dicatat** (`docs/PRIVACY.md` §5). Untuk memutuskan ambang 10%,
aspek sudah cukup; kalimat pengguna tidak menambah apa pun selain risiko — dan tidak ada yang perlu
dihapus saat pengguna meminta datanya dihapus.

`hasDocuments` yang ikut dicatat menjawab pertanyaan yang lebih berguna daripada rasionya: **aspek mana**
yang paling sering kosong. Kalau jawabannya `pressure_class`, solusinya mengisi kolom — bukan
meng-embed PDF. `catalogVersionId` ikut karena ia yang menjelaskan kenapa rasionya berubah: kolom yang
terisi di versi berikutnya seharusnya menurunkan angkanya.

### Bila diadopsi

|             |                                                                                |
| ----------- | ------------------------------------------------------------------------------ |
| Chunking    | per bagian dengan overlap; metadata memuat dokumen + halaman                   |
| Sitasi      | setiap jawaban berbasis retrieval menyebut dokumen dan halaman                 |
| Kepercayaan | konten hasil retrieval adalah **data, bukan instruksi** (`AI_BEHAVIOR.md` §8)  |
| Reindeks    | job RabbitMQ, idempoten per `documentId + chunkIndex`                          |
| Ambang      | di bawah skor minimum, jawab "data belum cukup" alih-alih memaksakan kecocokan |

Baris terakhir penting: retrieval yang memaksakan potongan paling mirip dari korpus yang tidak
relevan menghasilkan jawaban percaya diri yang salah — persis yang ingin dihindari SPEC §5 Policy 2.

---

## 6. Provenance pada jawaban produk

| Sumber jawaban              | Provenance          | Tampilan                                     |
| --------------------------- | ------------------- | -------------------------------------------- |
| Kolom katalog terisi        | `VERIFIED`          | nilai + hijau bila relevan                   |
| Kolom katalog kosong        | `UNAVAILABLE`       | "Lihat dokumen teknis", nilai tidak dirender |
| Dari dokumen teknis         | `VERIFIED` + sitasi | nilai + "Sumber: <dokumen> hal. N"           |
| Tidak ditemukan di mana pun | —                   | "data belum cukup" + tawaran tim teknis      |

Tidak ada jalur yang menghasilkan nilai teknik produk bertanda `ASSUMED`. Asumsi berlaku untuk
**kebutuhan pengguna** (tinggi lantai, sumber air), bukan untuk **fakta produk**. Pralon tahu tekanan
kerja pipanya; kalau datanya belum ada di sistem, itu kekurangan data, bukan sesuatu yang boleh
diperkirakan.

### Satu tempat, dan tipe yang menolak bentuk lain

Seluruh tabel di atas dijalankan oleh satu berkas: `product-catalog/domain/spec-value.ts`. Sebelumnya
aturannya tersebar di tiga tempat — validator impor, mapper pembacaan, dan constraint database —
masing-masing dengan salinannya sendiri. Tiga salinan satu aturan bukan tiga lapis pertahanan,
melainkan tiga kesempatan untuk menyimpang.

`SpecValue` adalah union terdiskriminasi, bukan satu interface dengan dua field bebas, sehingga dua
hal menjadi **galat kompilasi** alih-alih sesuatu yang harus diingat:

- `{ value: 'mungkin 10 bar', provenance: 'UNAVAILABLE' }` tidak bisa ditulis (invarian P-2).
- `provenance: 'ASSUMED'` pada fakta produk tidak bisa ditulis (invarian C-1).

Nilai dari dokumen teknis **wajib** membawa dokumen dan nomor halaman. Sitasi yang tidak lengkap
menurunkan nilainya menjadi `UNAVAILABLE`, bukan menampilkannya tanpa sumber — UI merender
"Sumber: <dokumen> hal. N", jadi sitasi setengah memang tidak bisa dirender. Arahnya selalu
konservatif: ragu → `UNAVAILABLE`. Kolom kosong akan ditanyakan ke tim teknis; kolom yang salah
terisi akan dipakai menghitung.

---

## 7. Cache

| Kunci                         | TTL   | Invalidasi                      |
| ----------------------------- | ----- | ------------------------------- |
| `snouty:cache:product:{id}`   | 1 jam | saat versi katalog dipromosikan |
| `snouty:cache:catalog:active` | 1 jam | sama                            |

Katalog berubah jarang dan dibaca sangat sering — rasio yang ideal untuk cache. Invalidasi dipicu
peristiwa promosi versi, bukan hanya menunggu TTL, agar katalog baru langsung terlihat.

Tiga rincian implementasinya:

- **`SCAN`, bukan `KEYS`.** Redis mengerjakan perintah satu per satu di satu utas, dan
  `KEYS snouty:cache:product:*` memindai seluruh keyspace dalam satu perintah yang tidak bisa
  diselak. Pada instans yang juga memegang sesi dan rate limit, itu berarti seluruh aplikasi menunggu.
- **Cache dibuang setelah transaksi commit, bukan sebelumnya.** Membuangnya lebih dulu membuka jendela
  di mana pembaca lain mengisi ulang cache dari versi lama yang masih aktif, dan isian itu bertahan
  satu jam penuh. Urutan ini tidak menutup jendelanya sepenuhnya — pembaca yang sudah memegang data
  lama tepat sebelum commit masih bisa menulisnya — dan yang membatasi dampaknya adalah TTL.
- **Daftar produk tidak di-cache per kombinasi filter.** Kuncinya akan menjadi hasil kali setiap
  filter, dan invalidasinya harus menebak kombinasi mana yang pernah ada.

Kegagalan Redis **tidak** menjatuhkan permintaan: cache yang tidak terjangkau diperlakukan sama
dengan cache yang kosong, karena MySQL tetap punya jawabannya (SPEC §18).

---

## 8. Yang tidak boleh terjadi

|                                               | Ditegakkan oleh                                              |
| --------------------------------------------- | ------------------------------------------------------------ |
| Produk kompetitor menjadi record atau kartu   | filter katalog di perakitan respons (release blocker)        |
| Spesifikasi kosong diisi tebakan              | tipe `SpecValue` + `ck_product_specs_provenance` (C-1)       |
| Nama produk atau SKU dikarang LLM             | matcher hanya memilih dari katalog                           |
| Jawaban berbasis dokumen tanpa sitasi         | `specFromTechnicalDocument` menurunkannya ke `UNAVAILABLE`   |
| Produk tanpa `sourceDocument`/`sourcePage`    | validasi impor + `ck_products_source_page`                   |
| Pencarian vektor untuk pertanyaan terstruktur | intent router                                                |
| Versi `draft` terbaca jalur publik            | pembacaan selalu terikat versi aktif (`CatalogQueryService`) |
| Katalog ditulis dari luar modul ini           | `CATALOG_WRITER` tidak diekspor `ProductCatalogModule`       |
