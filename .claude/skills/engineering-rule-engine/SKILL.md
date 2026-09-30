---
name: engineering-rule-engine
description: Gunakan saat menulis atau mengubah aturan teknik apa pun — sizing pipa, unit beban fixture, elevasi, tinggi lantai, kuantitas material, default asumsi. Juga saat menambahkan aturan baru ke registry, mengubah formula yang sudah ada, membuat calculation trace, atau membangun layar validasi aturan untuk ahli domain.
---

# Engineering Rule Engine

Rujukan lengkap: `docs/ENGINEERING_RULES.md`.

## Status hari ini

**Ke-14 aturan berstatus `REQUIRES_DOMAIN_VALIDATION`.** Semuanya diambil dari prototipe desain, yang
handoff-nya sendiri menyebutnya ilustratif. Belum ada yang berasal dari standar teknik atau ahli
Pralon (OQ-06).

Konsekuensinya: **tidak ada satu pun ukuran pipa yang boleh tampil hijau TERVERIFIKASI.** Mockup
layar 06 menampilkan tiga baris TERVERIFIKASI; produk sebenarnya akan menampilkan ASUMSI. Itu benar
— jangan diperbaiki.

## Anatomi aturan

```ts
{
  (ruleId,
    version,
    category,
    inputSchema,
    outputSchema,
    compute, // MURNI: tanpa I/O, tanpa Date.now(), tanpa acak
    sourceReference,
    validationStatus,
    validatedBy,
    validatedAt,
    testCases, // WAJIB minimal satu — tanpa tes, tidak bisa didaftarkan
    explain);
} // teks kolom "DASAR PERHITUNGAN"
```

Empat sifat yang wajib dijaga:

- **`compute` murni** — masukan sama selalu keluaran sama, supaya laporan bisa dibuat ulang identik
  bertahun kemudian.
- **Versi, bukan edit.** Ubah formula = versi baru. Rekomendasi lama tetap menunjuk versi lamanya.
- **`explain` menempel pada aturan.** Penjelasan dan perhitungan keluar dari sumber yang sama,
  sehingga tidak bisa menyimpang.
- **Test case wajib.** Registry menolak aturan tanpa tes.

## Gerbang provenance

```ts
if (rule.validationStatus !== 'VALIDATED') return 'ASSUMED';
return out.hasRealDimensions ? 'VERIFIED' : 'ESTIMATED';
```

Satu-satunya jalan keluar dari engine. Satu tempat untuk diuji, tidak ada jalan memutar.

## Trace

Setiap eksekusi menulis `CalculationTrace` (`ruleId`, `ruleVersion`, inputs, output, provenance,
explanation). Kolom "DASAR PERHITUNGAN" dan disclosure "Tampilkan detail teknis" dirender **dari
trace**, bukan dari prosa LLM.

## Registry ringkas

| ID      | Isi                                                                                             |
| ------- | ----------------------------------------------------------------------------------------------- |
| ENG-001 | `outletCount = bath+basin+kitchen`; `loadUnits = bath×2+basin+kitchen`                          |
| ENG-002 | `mainSize = loadUnits >= 8 ? '1"' : '3/4"'` — ⚠ prototipe lama & SPEC §33b bilang `>= 6`, OQ-22 |
| ENG-003 | maks 4 titik air per cabang                                                                     |
| ENG-004 | tinggi lantai default 3,5 m                                                                     |
| ENG-005 | sambungan fixture 1/2"                                                                          |
| ENG-006 | selisih lapangan 10–15%                                                                         |
| ENG-007 | urutan klarifikasi `source → install → floors → bath`                                           |
| ENG-008 | distribusi titik air antar lantai (**tanpa batas 3 lantai** — itu batas rendering)              |
| ENG-009 | formula kuantitas BOM                                                                           |
| ENG-010 | kecepatan aliran 1–2 m/s                                                                        |
| ENG-011 | gravitasi toren cukup tanpa pompa                                                               |
| ENG-012 | 1 kamar mandi = 1 shower + 1 kloset                                                             |
| ENG-013 | kelas AW air bersih, D pembuangan                                                               |
| ENG-014 | default "Belum tahu"                                                                            |

Prioritas validasi tertinggi: **ENG-002**, lalu ENG-001, ENG-012, ENG-011.

## Checklist menambah atau mengubah aturan

- [ ] ID baru, atau versi baru dari ID yang ada? (ubah formula → **versi baru**)
- [ ] `compute` murni — tanpa I/O, tanpa jam, tanpa acak?
- [ ] Minimal satu test case?
- [ ] `explain` menghasilkan kalimat yang terbaca pengguna?
- [ ] Status `REQUIRES_DOMAIN_VALIDATION` kecuali ahli sudah menandatangani?
- [ ] `sourceReference` diisi bila ada rujukannya?
- [ ] Tercatat di tabel `docs/PROGRESS.md` dan `docs/ENGINEERING_RULES.md`?
- [ ] Menulis trace?

## Pengujian

Cakupan `packages/engineering` **≥ 95%** — paket ini tanpa I/O, tidak ada alasan teknis untuk
rendah. Tes properti: menambah titik air tidak pernah **mengecilkan** ukuran pipa. Tes regresi:
contoh kerja board (3 kamar mandi, 4 wastafel, 1 dapur, 2 lantai, toren atap) tetap menghasilkan
8 titik air, jalur utama 1", cabang 3/4", 5 baris BOM.

## Batas — jangan dipura-purakan bisa

Tidak dihitung: kerugian gesek, tekanan di titik terjauh, sizing pembuangan, kurva pompa, derating
suhu, faktor simultanitas. Kebutuhan yang menyentuh daftar ini →
`TECHNICAL_VALIDATION_REQUIRED`, bukan perkiraan.
