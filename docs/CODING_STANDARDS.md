# SNOUTY — Standar Koding

Fase 0c · P0c-14 · Terakhir diperbarui 2026-09-30

Sumbernya SPEC §26 dan §26b.

---

## 1. Prinsip

Kode dibaca jauh lebih sering daripada ditulis. Semua aturan di bawah bermuara pada satu hal:
**orang berikutnya harus bisa memahami maksudnya tanpa bertanya.**

|                                   |                                                       |
| --------------------------------- | ----------------------------------------------------- |
| Nama yang bermakna                | `loadUnits`, bukan `lu`; `mainPipeSize`, bukan `sz`   |
| Fungsi kecil, satu tanggung jawab |                                                       |
| Tanpa nilai ajaib                 | `MAX_OUTLETS_PER_BRANCH`, bukan `4` yang tersebar     |
| Bersarang dangkal                 | keluar lebih awal alih-alih `else` berlapis           |
| Tanpa service raksasa             | bila satu kelas butuh > 7 dependensi, batasnya salah  |
| Tanpa abstraksi prematur          | abstraksi dibuat pada pemakaian ketiga, bukan pertama |
| Tanpa kode pintar                 | yang jelas mengalahkan yang singkat                   |

---

## 2. Struktur

| Aturan                                                                                   |     |
| ---------------------------------------------------------------------------------------- | --- |
| Logika domain terpisah dari infrastruktur                                                |
| **Tidak ada logika bisnis di controller** — controller memvalidasi, memanggil, memetakan |
| **Tidak ada logika bisnis di komponen React** — komponen merender                        |
| Arah dependensi ditegakkan lint (`ARCHITECTURE.md` §7)                                   |
| Empat lapis hanya untuk modul yang punya aturan domain sendiri                           |

Batasan terakhir perlu ditegaskan dari dua arah: menerapkan Clean Architecture penuh ke modul
`feedback` adalah upacara, tetapi menaruh aturan sizing di dalam controller adalah kerusakan. Yang
menentukan bukan ukuran modul, melainkan apakah ia punya aturan yang layak diuji sendiri.

---

## 3. OOP secukupnya

Dipakai bila membantu: interface untuk port, entity dan value object untuk konsep domain,
application service untuk use case, repository untuk persistensi, strategy untuk variasi algoritme,
policy object untuk aturan, factory bila konstruksinya memang rumit, DI di seluruh sistem.

Tidak dipakai untuk: interface yang hanya punya satu implementasi selamanya, getter/setter di atas
struktur data sederhana, hierarki warisan dalam, pola yang tidak menyelesaikan masalah nyata.

Contoh yang layak: `Provenance` sebagai value object dengan aturannya sendiri.
Contoh yang tidak: `AbstractBaseProductServiceFactory`.

---

## 4. Komentar

Komentar menjelaskan **mengapa**, bukan apa.

```ts
// Produk kompetitor boleh dibahas sebagai konteks,
// tetapi rekomendasi akhir harus tetap Pralon.
const pralonOnly = candidates.filter(isPralonCatalogProduct);
```

```ts
// SALAH — mengulang kode
// filter kandidat
const pralonOnly = candidates.filter(isPralonCatalogProduct);
```

Yang layak dikomentari: aturan bisnis dan asalnya, kasus tepi dan mengapa ia ada, batasan yang
disengaja, keputusan arsitektur, dan **tautan ke nomor OQ** saat kode berjalan di atas asumsi yang
belum dikonfirmasi.

Poin terakhir berguna secara praktis: saat OQ-15 akhirnya dijawab, `rtk proxy grep -r "OQ-15" src/`
menunjukkan persis apa yang perlu disesuaikan.

---

## 5. TypeScript

|                                                                            |     |
| -------------------------------------------------------------------------- | --- |
| `strict: true`, tanpa pengecualian                                         |
| `any` dilarang; pakai `unknown` lalu persempit                             |
| Tipe bersama tinggal di `packages/shared-types`                            |
| Union diskriminatif untuk state, bukan flag boolean berpasangan            |
| Union tertutup untuk enum; hindari `string` bebas pada nilai yang terbatas |
| `readonly` untuk struktur yang tidak berubah                               |
| zod di batas; tipe disimpulkan dari skema, bukan ditulis dua kali          |

Menyimpulkan tipe dari skema zod (`z.infer`) menghilangkan kelas bug yang menyebalkan: skema dan
tipe yang perlahan berbeda.

---

## 6. Penanganan galat

|                                                                           |     |
| ------------------------------------------------------------------------- | --- |
| Exception domain khusus (`ProductNotFoundError`, `RuleNotValidatedError`) |
| Dipetakan ke kode error stabil di lapisan presentasi                      |
| **Tidak pernah menelan exception** — `catch {}` kosong dilarang lint      |
| Tidak pernah mencatat secret atau data pribadi                            |
| Tidak pernah mengirim stack trace ke klien                                |
| Log terstruktur Pino dengan correlation ID                                |

Bila sebuah galat memang boleh diabaikan, komentari alasannya:

```ts
try {
  await cache.del(key);
} catch (e) {
  // Kegagalan invalidasi cache tidak boleh menggagalkan permintaan;
  // TTL akan membereskannya dalam satu jam.
  log.warn({ err: e, key }, 'cache invalidation failed');
}
```

---

## 7. Pengujian

| Lapisan   | Kapan                                                            |
| --------- | ---------------------------------------------------------------- |
| Unit      | setiap aturan teknik, setiap policy object, setiap fungsi murni  |
| Kontrak   | setiap skema zod                                                 |
| Integrasi | repository dan orkestrasi, terhadap kontainer MySQL sekali pakai |
| Komponen  | rendering provenance di kedua tema, mood mascot, reduced motion  |
| E2E       | alur konsultasi utama                                            |

| Aturan                                                                        |     |
| ----------------------------------------------------------------------------- | --- |
| Nama tes menyatakan perilaku: `menolak VERIFIED saat aturan belum divalidasi` |
| Satu perilaku per tes                                                         |
| Tanpa tanggal, acak, atau urutan yang tidak deterministik                     |
| Perubahan perilaku disertai perubahan tes, dalam commit yang sama             |
| Cakupan: `packages/engineering` dan `policy` ≥ 95%; sisanya seperlunya        |

Angka cakupan sengaja tidak seragam. Mengejar 95% di kode glue infrastruktur menghasilkan tes yang
menguji mock; di mesin aturan yang murni, 95% adalah standar yang wajar.

---

## 8. Alur Git

|                                                                                 |     |
| ------------------------------------------------------------------------------- | --- |
| Branch per fase atau item: `phase-<n>/<item-id>-<nama-singkat>`                 |
| Commit per item selesai, diawali ID item: `P1-03: add catalog import validator` |
| **Tidak pernah commit secret, `.env`, atau data pelanggan nyata**               |
| **Tidak pernah push langsung ke `main`; tidak pernah force-push**               |
| Pemilik yang melakukan merge setelah review                                     |
| Commit kecil dan fokus; refactor tidak dicampur dengan fitur                    |

Pesan commit: baris pertama imperatif dan ringkas, badan menjelaskan **mengapa** bila tidak jelas,
dan menyebut nomor OQ bila relevan.

```
P6-04: add provenance gate to engineering output

Aturan yang belum divalidasi ahli tidak boleh menghasilkan VERIFIED
(invarian P-1). Satu gerbang untuk semua keluaran engine agar hanya ada
satu tempat yang perlu diuji. Terkait OQ-06.
```

Bahasa pesan commit: Inggris, mengikuti konvensi repositori.

---

## 9. Salinan teks (copy)

Semua teks antarmuka dalam Bahasa Indonesia dan diambil **apa adanya** dari desain. Tinggal di satu
modul pesan yang siap i18n, bukan tersebar sebagai literal di komponen.

Kalimat yang membawa makna kebijakan tidak boleh diparafrase — daftarnya di
`DESIGN_IMPLEMENTATION.md` §10. Mengubah "PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS" berarti
mengubah janji produk, bukan memperbaiki redaksi.

---

## 10. Gaya

Prettier dan ESLint memutuskan format; tidak ada perdebatan gaya di code review.

Aturan lint khusus proyek ini:

| Aturan                                                | Alasan                          |
| ----------------------------------------------------- | ------------------------------- |
| Boundary antar modul                                  | menegakkan `ARCHITECTURE.md` §7 |
| Larangan hex mentah di `apps/`                        | memaksa pemakaian token         |
| Larangan `any`                                        |                                 |
| Larangan `catch {}` kosong                            |                                 |
| Larangan `console.log`                                | pakai logger                    |
| Larangan impor `packages/engineering` dari modul `ai` | menegakkan SPEC §25             |

Tiga yang terakhir bisa ditemukan di banyak proyek; dua yang pertama khusus di sini, dan keduanya
menegakkan keputusan yang kalau dilanggar tidak akan terlihat sampai terlambat.

---

## 11. Daftar periksa review

|                                                                            |     |
| -------------------------------------------------------------------------- | --- |
| Apakah aturan bisnis ada di kode, bukan hanya di prompt?                   |
| Apakah setiap nilai yang ditampilkan membawa provenance?                   |
| Bisakah aturan yang belum divalidasi menghasilkan `VERIFIED` di jalur ini? |
| Apakah batas modul terjaga?                                                |
| Apakah controller/komponen bebas dari logika bisnis?                       |
| Apakah perubahan perilaku disertai tes?                                    |
| Ada data katalog, nilai teknik, atau harga yang dikarang?                  |
| Ada secret, data pribadi, atau stack trace yang bocor ke log/klien?        |
| Apakah jalur ini menambah panggilan LLM yang bisa dihindari?               |
| Apakah asumsi baru dicatat sebagai OQ, bukan diputuskan diam-diam?         |

Pertanyaan terakhir adalah yang paling mudah terlewat dan paling penting di fase ini: menyelesaikan
ambiguitas sendiri akan menyembunyikan keputusan yang seharusnya diambil pemilik produk.
