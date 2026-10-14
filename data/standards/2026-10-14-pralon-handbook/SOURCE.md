# Pralon Spec Deck — handbook elektronik pipa

**Diterima:** 2026-10-14 dari pemilik ("file yang gw ambil dari data product pralon"), berkas asli
`pralon-handbook.html`. Handbook menyatakan datanya ditranskrip dari dokumen standar internal Pralon:

| Dokumen      | Rev. | Tanggal           | Isi                                                                  |
| ------------ | ---- | ----------------- | -------------------------------------------------------------------- |
| PROD/STD-001 | 07   | 17 September 2025 | uPVC tekanan, kelas S-6,3 … S-20 (SNI 06-0084-2002, ISO 4065), OD mm |
| PROD/STD-002 | 07   | 17 September 2025 | uPVC non-tekanan Kelas A & B (SNI 06-0162-1987), OD mm               |
| PROD/STD-003 | 05   | 12 September 2025 | uPVC JIS VP (K-6742-2016) & VU (K-6741-2016), ukuran inci            |
| PROD/STD/014 | 04   | 26 Februari 2026  | PE100, SDR 41 … 7,4 (SNI 9362:2025)                                  |

`standards.json` = konstanta data handbook apa adanya (`STD001`, `STD002`, `STD003`, `STD014`,
`SDR_CLASSES`). Format baris tertulis di komentar handbook:

- STD-001/002: `[od, tebal dinding, kg/m, berat 6 m TS, berat bell, berat 6 m bell, panjang TS, panjang bell]`
  (STD-002 memuat Kelas A lalu Kelas B dalam satu baris).
- STD-003: `[nominal inci, OD VP, tebal VP, kg/m VP, berat 4 m VP, OD VU, tebal VU, kg/m VU, berat 4 m VU]`.
- STD-014: `{ od, tol, vals: { SDR..: [tebal, kg/m] } }`.

Tebal dinding ditulis "nominal + toleransi" (mis. `2,7 + 0,6`).

**Yang TIDAK ada di sini:** tabel kelas PRALON **AW** dan **D** (inci) dan pemetaan seri fitting
(Ts, W, DV) ke kelas pipa. VP bukan pengganti AW: ½" VP tebal 2,7 mm, sedangkan ½" AW menurut
pemilik ±1,5 mm (ID ±19 mm). OQ-64 dan OQ-48 tetap terbuka.

Handbook menyebut sendiri: "dokumen resmi tetap acuan kontraktual" — angka di sini referensi.
