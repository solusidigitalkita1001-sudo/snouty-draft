---
name: snouty-policy
description: Gunakan saat menangani pertanyaan tentang merek kompetitor, memutuskan fitur mana yang boleh diakses tamu atau pengguna terdaftar, menetapkan flag provenance pada nilai apa pun, merutekan kebutuhan industri atau pembuangan, menambah endpoint yang perlu guard, atau setiap kali sebuah nilai akan ditampilkan ke pengguna.
---

# Policy Engine

Rujukan lengkap: `docs/POLICY.md`.

## Kebijakan adalah kode, bukan prompt

Aturan yang hanya ditulis di prompt tidak bisa diuji, tidak bisa diaudit, dan bisa ditembus.
`policy` adalah modul **leaf tanpa dependensi dan tanpa I/O**; setiap keputusan fungsi murni:

```ts
policy.evaluate(actor, capability, ctx?) → PolicyDecision
```

## Tiga titik penegakan

| Lapisan | Peran |
|---|---|
| UI | kenyamanan — menyembunyikan yang tidak tersedia |
| API guard | otorisasi — menolak permintaan |
| **Perakitan respons** | kebenaran — **menyaring hasil terhadap katalog** |

Lapisan ketiga yang mengikat. Prompt bisa dijailbreak; produk tanpa baris di `products` tetap tidak
punya `productId` untuk dirender.

## Policy 1 — Hanya Pralon

Boleh: mengakui pertanyaan kompetitor, menyebut merek lain sebagai konteks, menjelaskan kriteria
netral. Tidak boleh: merekomendasikan, menampilkan kartu, membandingkan, mengarahkan ke kompetitor.

Pola jawaban (layar 08): nyatakan batas → kartu "KRITERIA YANG SEBAIKNYA DIPERIKSA" (3 butir) →
**hanya** produk Pralon → tutup dengan alasan jujur ("SNOUTY hanya memegang data katalog Pralon").

Langkah terakhir yang membuat penolakan terasa jujur, bukan defensif.

## Policy 2 — Tanpa halusinasi

Jangan pernah mengarang produk, SKU, ukuran, standar, kelas tekanan, spesifikasi, kompatibilitas,
ketersediaan, aturan teknik, nilai teknik, atau harga.

Tepat tiga keluaran sah saat data kurang: **pertanyaan klarifikasi**, **"data belum cukup" +
tawaran tim teknis**, atau **rute validasi teknis**.

## Policy 3 — Batas rekomendasi

"PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS."

Industri, di luar rentang material, atau data tidak cukup dan tidak aman diasumsikan →
`TECHNICAL_VALIDATION_REQUIRED` (layar 11).

Layar 11 **bukan layar error**: beri alasan bernomor, rangkum "YANG SUDAH SAYA CATAT" supaya
pengguna tidak mengulang cerita, tawarkan tim teknis + SLA. Mood mascot `focus`, **bukan** `fail`.

## Policy 4 — Provenance (paling penting)

Satu gerbang untuk semua keluaran engine:

```ts
if (rule.validationStatus !== 'VALIDATED') return 'ASSUMED';   // invarian P-1
return out.hasRealDimensions ? 'VERIFIED' : 'ESTIMATED';
```

- `VERIFIED` → hijau "TERVERIFIKASI"
- `ASSUMED` → amber "ASUMSI" + **wajib** muncul di kartu asumsi dengan alasan
- `ESTIMATED` → amber "DIESTIMASI"
- `UNAVAILABLE` → **tidak merender nilai sama sekali**

`<ProvenanceTag>` adalah satu-satunya cara merender tag, dan ia menerima `Provenance` — tidak ada
prop yang menerima string "TERVERIFIKASI". Warna tidak pernah satu-satunya pembawa makna.

**Hari ini seluruh aturan teknik belum divalidasi (OQ-06), jadi semua ukuran pipa tampil ASUMSI.**
Itu benar. Jangan "memperbaikinya".

## Policy 5 — Scope routing

Air bersih hunian/komersial ringan → didukung.
Pembuangan → **dicatat**, dinyatakan belum didukung, tawarkan tim teknis. Jangan tolak mentah — UI
memang menawarkannya, dan volumenya adalah data pasar yang berharga.
Industri → validasi teknis.

## Entitlement

Satu tabel `ENTITLEMENTS` menjadi sumber **guard API sekaligus daftar manfaat onboarding**. Jangan
pernah menulis daftar manfaat secara manual — UI dan kebijakan wajib tidak bisa berbeda.

Tamu meminta fitur lanjutan, urutannya **wajib**:
pahami dulu → simpan konteks → tawarkan daftar → lanjutkan kasus yang sama → jangan paksa mengetik
ulang. Menghadang sebelum menjawab adalah kesalahan yang paling merusak kepercayaan.

## Kode kebijakan bukan error

`COMPETITOR_COMPARISON_REFUSED`, `INSUFFICIENT_DATA`, `TECHNICAL_VALIDATION_REQUIRED`,
`SCOPE_NOT_YET_SUPPORTED` → **HTTP 200 + kartu**. Menolak membandingkan merek adalah jawaban yang
benar, bukan kegagalan sistem.

## Tes release blocker

1. Pertanyaan kompetitor tidak pernah menghasilkan kartu kompetitor.
2. Aturan `REQUIRES_DOMAIN_VALIDATION` tidak pernah menghasilkan `VERIFIED`.
3. Tamu tidak bisa mengakses kapabilitas lanjutan lewat API meski UI dilewati.
