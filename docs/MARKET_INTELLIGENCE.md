# SNOUTY — Market Intelligence

Fase 0c · P0c-08 · Terakhir diperbarui 2026-09-30 · **Fase 12**

Mengubah percakapan dan email menjadi gambaran kebutuhan pasar — tanpa memperlambat chat dan tanpa
mengidentifikasi siapa pun. Sumbernya SPEC §15.

---

## 1. Dua aturan yang membentuk modul ini

**Tidak pernah menghambat chat.** Seluruh jalur market intelligence asinkron. Bila agregasi mati,
konsultasi tetap berjalan normal dan tidak ada pengguna yang menyadarinya.

**Tidak pernah mengidentifikasi individu.** Event yang keluar dari konteks percakapan sudah
kehilangan identitasnya di sumber, bukan di-anonimkan belakangan. Perbedaannya penting: anonimisasi
di hilir berarti data mentah pernah ada di tempat yang tidak seharusnya.

Keduanya berasal dari janji yang dibuat produk kepada pengguna di onboarding langkah 4 — bahwa data
wilayah dipakai untuk analisis pasar, **bukan** untuk menentukan rekomendasi.

---

## 2. Sumber

### Chat

| Data                         | Catatan                                                      |
| ---------------------------- | ------------------------------------------------------------ |
| Wilayah                      | tingkat kota/kabupaten, **opsional**, hanya bila ada consent |
| Tipe bangunan                | hunian / komersial ringan / industri                         |
| Jumlah titik air, lantai     | ukuran kebutuhan                                             |
| Produk yang direkomendasikan | keluarga + ukuran                                            |
| Jenis instalasi              | air bersih / pembuangan — termasuk yang **belum didukung**   |
| Minat kasus lanjutan         | apakah pengguna sampai ke solusi lengkap                     |
| Ter-route ke validasi teknis | sinyal cakupan                                               |

Dua baris terakhir bernilai khusus. Kebutuhan **pembuangan** yang hari ini ditolak tetap dicatat
(`POLICY.md` §7) — dan volumenya adalah bukti paling jujur apakah fitur itu layak dibangun. Begitu
pula proporsi yang ter-route ke validasi teknis: kalau tinggi, cakupan produk terlalu sempit.

### Email (Fase 11)

Perusahaan (dianonimkan menjadi sektor), lokasi proyek, tipe & skala proyek, produk yang diminat,
`quotationIntent`.

---

## 3. Skema event

Satu bentuk untuk kedua sumber.

```ts
interface MarketEvent {
  id: string;
  source: 'chat' | 'email';
  occurredAt: string; // presisi hari, bukan detik
  region: string | null; // "Bekasi" — kota/kabupaten
  buildingType: BuildingType | null;
  projectScale: 'kecil' | 'sedang' | 'besar' | null;
  installationType: 'air_bersih' | 'pembuangan' | 'keduanya' | null;
  outletCount: number | null;
  floors: number | null;
  productInterest: string[]; // kunci keluarga+ukuran, bukan SKU
  quotationIntent: boolean;
  reachedSolution: boolean;
  routedToTechnical: boolean;
}
```

Yang **tidak** ada, dan tidak boleh ditambahkan: `userId`, `guestSessionId`, `conversationId`,
`emailId`, nama, alamat email, nomor telepon, dan teks bebas apa pun.

Teks bebas sengaja dilarang. Satu kalimat mentah dari percakapan bisa memuat nama, alamat, atau
detail yang membuat orang dapat dikenali — dan begitu masuk ke tabel agregat, ia sulit ditarik
kembali.

`occurredAt` dibulatkan ke hari: presisi detik ditambah wilayah kecil adalah kombinasi yang membuat
identifikasi ulang jauh lebih mudah.

---

## 4. Aliran

```
percakapan selesai / analisis email selesai
        │
        ▼
  MarketEvent dibentuk DI DALAM konteks asal (identitas ditinggalkan di sini)
        │
        ▼
  RabbitMQ market.aggregate  ── idempoten per eventId, DLQ
        │
        ▼
  market_events (mentah, sudah anonim)
        │
        ▼  terjadwal (harian)
  market_aggregates ── hanya kelompok dengan ukuran ≥ 5
        │
        ▼
  Dashboard back-office
```

Pembentukan event terjadi **di dalam** modul conversation/email, lalu identitas ditinggalkan di sana.
Modul market tidak pernah menerima objek yang memuatnya, sehingga tidak ada kesempatan untuk bocor
lewat log atau bug serialisasi.

---

## 5. Agregasi

| Agregat               | Dimensi                                | Kegunaan                      |
| --------------------- | -------------------------------------- | ----------------------------- |
| Permintaan regional   | wilayah × bulan                        | di mana kebutuhan tumbuh      |
| Tren minat produk     | keluarga produk × ukuran × bulan       | apa yang dicari               |
| Pola tipe proyek      | tipe bangunan × skala × wilayah        | siapa yang membangun apa      |
| Sinyal cakupan        | rasio ter-route ke validasi teknis     | apakah cakupan terlalu sempit |
| Permintaan pembuangan | volume `installationType` pembuangan   | bukti kelayakan fitur         |
| Corong konsultasi     | mulai → klarifikasi → solusi → laporan | di mana pengguna berhenti     |

**Ambang k-anonimitas: kelompok dengan < 5 kejadian tidak dipublikasikan.** Di kota kecil dengan satu
konsultasi bulan itu, "Rumah 3 lantai di <kota>" praktis menunjuk satu orang. Ambang ini yang
mencegahnya.

Agregat disimpan sudah terhitung, bukan dihitung saat dashboard dibuka — dashboard yang lambat akan
berhenti dipakai.

---

## 6. Lokasi

Ditegaskan ulang karena inilah janji paling eksplisit yang dibuat produk kepada penggunanya:

> "Data wilayah dipakai untuk analisis kebutuhan pasar, bukan untuk menentukan rekomendasi."

Penegakannya struktural, bukan disiplin:

- Koordinat dari browser segera diringkas menjadi nama kota; koordinat mentah dibuang, tidak pernah
  disimpan.
- Lokasi **tidak ada** di dalam `RequirementState`.
- Modul `recommendation` dan `engineering` dilarang mengimpor `market-intelligence` oleh aturan
  dependensi di `ARCHITECTURE.md` §7.

Jadi tidak ada jalur data dari lokasi ke rekomendasi. Ini satu-satunya cara janji semacam itu
bertahan setelah berbulan-bulan perubahan kode.

---

## 7. Dashboard

Peran `sales_reviewer` dan `admin`. Belum ada desain (OQ-21); dibangun dengan token yang ada.

| Panel                    | Isi                                         |
| ------------------------ | ------------------------------------------- |
| Peta permintaan regional | volume per kota, rentang waktu bisa dipilih |
| Minat produk             | keluarga × ukuran, tren dari waktu ke waktu |
| Corong konsultasi        | di mana pengguna berhenti                   |
| Sinyal cakupan           | validasi teknis & permintaan pembuangan     |
| Lead (Fase 11)           | dari email intelligence                     |
| Biaya LLM                | token dan biaya per periode (SPEC §31b)     |

Panel biaya diletakkan di sini karena pemirsanya sama: orang yang perlu tahu apakah produk ini
memberi hasil sepadan dengan ongkosnya.

Setiap panel menampilkan jumlah sampel. Grafik tanpa ukuran sampel adalah cara paling mudah menarik
kesimpulan yang salah dari 3 kejadian.

---

## 8. Yang tidak dilakukan

|                                                  | Alasan                                         |
| ------------------------------------------------ | ---------------------------------------------- |
| Profil per pengguna                              | bukan tujuan, dan melanggar dasar anonimisasi  |
| Penargetan ulang individu                        | sama                                           |
| Menyimpan teks percakapan mentah di tabel market | risiko data pribadi                            |
| Analitik real-time                               | tidak ada nilainya di sini; harian sudah cukup |
| Berbagi data lintas pelanggan                    | tidak ada dasar hukum                          |
| Memakai sinyal pasar untuk mengubah rekomendasi  | melanggar janji di onboarding                  |

Baris terakhir menutup godaan yang paling masuk akal secara komersial: "kalau di Bekasi banyak yang
pakai ukuran X, sarankan X". Itu tetap dilarang — rekomendasi mengikuti teknik, bukan popularitas.

---

## 9. Pengujian

| #   | Tes                                                                              |
| --- | -------------------------------------------------------------------------------- |
| 1   | `MarketEvent` tidak pernah memuat pengenal atau teks bebas                       |
| 2   | Agregat dengan ukuran kelompok < 5 tidak dipublikasikan                          |
| 3   | Kegagalan pipeline market tidak memengaruhi respons chat                         |
| 4   | Koordinat mentah tidak pernah tersimpan                                          |
| 5   | Modul `recommendation` tidak bisa mengimpor `market-intelligence` (tes boundary) |
| 6   | Konsumer idempoten per `eventId`                                                 |
| 7   | Kebutuhan pembuangan tetap menghasilkan event meski rekomendasinya ditolak       |
| 8   | `occurredAt` berpresisi hari, bukan detik                                        |

Tes 7 menjaga hal yang mudah hilang saat refactor: cakupan yang ditolak tetap merupakan data pasar
yang berharga.

---

## 9. Status implementasi (Fase 12)

| Bagian            | Berkas                                               |
| ----------------- | ---------------------------------------------------- |
| Bentuk event (§3) | `modules/market-intelligence/domain/market-event.ts` |
| Enam agregat (§5) | `modules/market-intelligence/domain/aggregate.ts`    |
| Tabel             | migration 0010 (`market_events`)                     |

Tiga penegakan yang **struktural**, bukan kedisiplinan:

1. Bentuk `MarketEvent` tidak punya field untuk `userId`, `guestSessionId`, `conversationId`,
   `emailId`, nama, alamat, telepon, atau teks bebas. Yang tidak bisa ditulis tidak bisa bocor.
2. `occurred_on` bertipe `DATE`, jadi pembulatan ke hari ditegakkan **tipe kolomnya** — pemanggil tidak
   bisa menyimpan presisi detik walau ingin.
3. **Pagar lint baru**: `recommendation`, `engineering`, dan `context` dilarang mengimpor
   `market-intelligence`. Itu yang membuat janji §6 ("data wilayah untuk analisis pasar, bukan untuk
   menentukan rekomendasi") tidak punya jalur untuk dilanggar. Pagarnya sudah dibuktikan menolak.

Ambang k-anonimitas diterapkan di **lapisan agregasi**, bukan di dashboard: agregat yang sudah
tersimpan tanpa ambang berarti datanya bocor sebelum ada yang melihatnya. Kelompok yang ditahan
**dilaporkan** (`suppressedGroups`, `suppressedEvents`) supaya pembaca tahu ada data yang tidak tampil
dan tidak menyimpulkan permintaan nol. Sinyal cakupan sengaja dikecualikan — rasio atas seluruh himpunan
tidak bisa menunjuk satu orang, dan menahannya hanya menyembunyikan sinyal yang dibutuhkan untuk tahu
cakupan rekomendasi terlalu sempit.

**Belum:** pemancar event dari chat dan email (menunggu keduanya berjalan penuh), penyimpanan agregat
terhitung, dan dashboard (§7) yang menunggu **OQ-21**.
