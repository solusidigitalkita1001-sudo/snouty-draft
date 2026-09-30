# SNOUTY — Pengetahuan Produk

Fase 0c · P0c-03 · Terakhir diperbarui 2026-09-30

Dari mana fakta produk berasal, bagaimana ia masuk, dan bagaimana ia dijawab. Sumbernya SPEC §9, §10.

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

| Tabel                   | Isi                                                         |
| ----------------------- | ----------------------------------------------------------- |
| `product_sizes`         | `PipeSize` kanonik + ketersediaan                           |
| `product_specs`         | pasangan kunci-nilai tambahan dengan provenance sendiri     |
| `product_compatibility` | pipa ↔ fitting sepadan — sumber blok "FITTING YANG SEPADAN" |
| `product_documents`     | tautan datasheet / dokumen teknis                           |
| `product_images`        | foto produk 1:1                                             |

`product_compatibility` penting: daftar fitting di drawer produk berasal dari tabel ini, **bukan**
dari tebakan model. Salah satu janji produk adalah "satu ekosistem fitting mengurangi risiko
sambungan bocor" — janji itu hanya bermakna bila kompatibilitasnya data, bukan karangan.

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
menunggu satu putaran impor, adalah cara tercepat membuat admin menyerah.

Sumber katalog sebenarnya belum ditentukan (OQ-07); default yang diusulkan adalah Excel/CSV.

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

---

## 7. Cache

| Kunci                         | TTL   | Invalidasi                      |
| ----------------------------- | ----- | ------------------------------- |
| `snouty:cache:product:{id}`   | 1 jam | saat versi katalog dipromosikan |
| `snouty:cache:catalog:active` | 1 jam | sama                            |

Katalog berubah jarang dan dibaca sangat sering — rasio yang ideal untuk cache. Invalidasi dipicu
peristiwa promosi versi, bukan hanya menunggu TTL, agar katalog baru langsung terlihat.

---

## 8. Yang tidak boleh terjadi

|                                               | Ditegakkan oleh                                       |
| --------------------------------------------- | ----------------------------------------------------- |
| Produk kompetitor menjadi record atau kartu   | filter katalog di perakitan respons (release blocker) |
| Spesifikasi kosong diisi tebakan              | invarian C-1, tes komponen                            |
| Nama produk atau SKU dikarang LLM             | matcher hanya memilih dari katalog                    |
| Jawaban berbasis dokumen tanpa sitasi         | pemeriksaan di perakitan respons                      |
| Produk tanpa `sourceDocument`/`sourcePage`    | validasi impor                                        |
| Pencarian vektor untuk pertanyaan terstruktur | intent router                                         |
