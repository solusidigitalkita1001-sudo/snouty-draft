---
name: market-intelligence
description: Gunakan saat memancarkan atau memproses event pasar, membangun agregasi permintaan regional atau tren minat produk, mengerjakan dashboard pasar, atau menangani data lokasi pengguna. Juga saat tergoda memakai sinyal pasar untuk memengaruhi rekomendasi — jangan.
---

# Market Intelligence — Fase 12

Rujukan lengkap: `docs/MARKET_INTELLIGENCE.md`.

## Dua aturan pembentuk

**Tidak pernah menghambat chat.** Seluruh jalur asinkron. Bila agregasi mati, konsultasi tetap
normal dan tidak ada pengguna yang menyadarinya.

**Tidak pernah mengidentifikasi individu.** Event kehilangan identitasnya **di sumber**, bukan
dianonimkan belakangan. Anonimisasi di hilir berarti data mentah pernah ada di tempat yang tidak
seharusnya.

## Skema event — yang boleh dan yang dilarang

Boleh: `source`, `occurredAt` (**presisi hari**), `region` (kota/kabupaten), `buildingType`,
`projectScale`, `installationType`, `outletCount`, `floors`, `productInterest` (kunci keluarga+ukuran),
`quotationIntent`, `reachedSolution`, `routedToTechnical`.

**Dilarang, dan jangan ditambahkan:** `userId`, `guestSessionId`, `conversationId`, `emailId`, nama,
email, telepon, dan **teks bebas apa pun**.

Teks bebas dilarang karena satu kalimat mentah bisa memuat nama atau alamat, dan begitu masuk tabel
agregat ia sulit ditarik kembali. `occurredAt` dibulatkan ke hari karena presisi detik + wilayah
kecil membuat identifikasi ulang jauh lebih mudah.

Event dibentuk **di dalam** modul conversation/email; identitas ditinggalkan di sana. Modul market
tidak pernah menerima objek yang memuatnya.

## Agregasi

Job `market.aggregate`, idempoten per `eventId`, DLQ, terjadwal harian.
Agregat disimpan sudah terhitung — dashboard yang lambat akan berhenti dipakai.

**Ambang k-anonimitas: kelompok dengan < 5 kejadian tidak dipublikasikan.** Di kota kecil dengan
satu konsultasi bulan itu, "Rumah 3 lantai di <kota>" praktis menunjuk satu orang.

## Lokasi — janji yang mengikat kode

Onboarding menjanjikan: _"Data wilayah dipakai untuk analisis kebutuhan pasar, **bukan untuk
menentukan rekomendasi**."_

Penegakannya struktural:

- Koordinat browser **segera** diringkas jadi nama kota; koordinat mentah dibuang, tidak disimpan.
- Lokasi **tidak ada** di dalam `RequirementState`.
- `recommendation` dan `engineering` dilarang mengimpor `market-intelligence` oleh lint boundary.

Jadi tidak ada jalur data dari lokasi ke rekomendasi. Ini satu-satunya cara janji semacam itu
bertahan setelah berbulan-bulan perubahan kode.

## Yang tidak boleh dilakukan

- Profil per pengguna atau penargetan ulang individu.
- Menyimpan teks percakapan mentah di tabel market.
- Analitik real-time (tidak ada nilainya; harian cukup).
- **Memakai sinyal pasar untuk mengubah rekomendasi.**

Baris terakhir menutup godaan yang paling masuk akal secara komersial: "di Bekasi banyak pakai
ukuran X, sarankan X". Tetap dilarang — rekomendasi mengikuti teknik, bukan popularitas.

## Yang justru berharga dicatat

Kebutuhan **pembuangan** yang hari ini ditolak tetap memancarkan event. Volumenya adalah bukti
paling jujur apakah fitur itu layak dibangun. Begitu pula proporsi `routedToTechnical`: kalau tinggi,
cakupan produk terlalu sempit.

Hal ini mudah hilang saat refactor — jadikan tes.

## Dashboard

Peran `sales_reviewer` dan `admin`. Panel: permintaan regional, minat produk, corong konsultasi,
sinyal cakupan, lead, biaya LLM.

**Setiap panel menampilkan ukuran sampel.** Grafik tanpa ukuran sampel adalah cara paling mudah
menarik kesimpulan salah dari 3 kejadian.

## Checklist

- [ ] Event bebas pengenal dan teks bebas?
- [ ] Ukuran kelompok ≥ 5 sebelum dipublikasikan?
- [ ] Kegagalan pipeline tidak memengaruhi chat?
- [ ] Koordinat mentah tidak pernah tersimpan?
- [ ] Tes boundary: `recommendation` tidak bisa mengimpor `market-intelligence`?
- [ ] `occurredAt` presisi hari?
