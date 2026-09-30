---
name: schematic-generator
description: Gunakan saat membangun atau mengubah topologi skema, renderer SVG skema, penempatan node dan segmen, label elevasi dan blok judul gambar, legenda, atau tombol skenario "bagaimana kalau" (toren ke lantai 3, tambah kamar mandi, pakai pompa). Juga saat skema perlu tampil di laporan PDF.
---

# Schematic Engine

Rujukan lengkap: `docs/SCHEMATIC_ENGINE.md`.

## Prinsip

**Tidak ada gambar hasil generasi AI yang diperlakukan sebagai kebenaran teknik.**

Skema adalah **topologi terstruktur** yang dibentuk deterministik dari requirement state + keluaran
Engineering Engine. Renderer membaca topologi; ia tidak menambahkan informasi.

Efeknya: gambar, tabel sistem, dan BOM selalu konsisten karena sumbernya sama. Kalau gambar dibuat
terpisah, ketiganya akan bertentangan cepat atau lambat.

## Model

`Schematic { floors, nodes, segments, groundLevel: '±0.00', titleBlock }`

- `Node.type`: `water_source | riser | branch | fixture | fitting`
- `Segment.role`: `main | riser | branch | fixture_connection`
- `Floor.elevation` adalah **`TrackedValue`** — memakai tinggi lantai default (ENG-004) membuat
  seluruh elevasi `ASSUMED`
- `titleBlock`: `SK-01 AIR BERSIH` · `NTS` · tinggi lantai (mis. **"3,50 M · ASUMSI"**) · `KATALOG v2.4`

Blok judul bukan hiasan — provenance ikut tampil **di dalam gambar**. Pertahankan.

Kode node mengikuti desain: `KM-<lantai><huruf>`, `WF-<lantai>`, `DP-<lantai>`.

## Pembentukan

1. Lantai dari `building.floors`
2. Sumber air: toren atap → level `roof`; pompa/PDAM → level 1
3. Segmen main: sumber → pangkal riser, ukuran `mainSize` (ENG-002)
4. Riser vertikal menembus semua lantai
5. Per lantai: node branch 3/4", fitting reducer, distribusi titik air (ENG-008), sambungan fixture
   1/2" (ENG-005)
6. Elevasi `(level-1) × floorHeight`
7. Provenance lewat gerbang

**Jangan bawa batas 3 lantai dari prototipe** — itu keterbatasan rendering, bukan aturan (OQ-33).

## Renderer

**SVG**, bukan library diagram. Ini gambar teknik dengan tata letak tetap, bukan graf yang digeser
pengguna.

Spesifikasi: kanvas `#FCFDFC` + kisi 24 px `#EEF1F0` · kolom label lantai 84 px · kolom riser 76 px ·
garis lantai 3 px `#B9C1C0` · main/riser 4 px `#DF301C` · cabang 3 px `#EE7A67` · fixture 2 px
`#AEB6B7` · titik tee/reducer lingkaran 14 px border 3 px · node fixture kotak 96 px · lebar minimum
500 px dengan `overflow-x: auto`.

Panel kanan: **DAFTAR JALUR** + blok judul 2×2 (GAMBAR / SKALA / TINGGI LANTAI / SUMBER).

## Catatan wajib — tidak ada mode yang menghilangkannya

> **SKEMATIK · BUKAN GAMBAR KERJA**

> **CATATAN SKEMA** — Skema menunjukkan hubungan antar jalur, bukan posisi fisik pipa di bangunan.
> Panjang jalur dan posisi shaft ditentukan saat pelaksanaan.

Ini bukan disclaimer tempelan: sistem memang tidak punya denah, jadi memang tidak tahu posisi fisik.

## Skenario = mutasi, bukan gambar terpisah

Tombol "Toren ke lantai 3" / "Tambah 1 kamar mandi" / "Pakai pompa pendorong":

```
patch requirement → ContextMerger → hitung ulang: tabel sistem + BOM + topologi
```

**Nol panggilan LLM.** Bila menambah kamar mandi mengubah ukuran jalur utama, ketiganya berubah
bersamaan — karena semuanya turunan state yang sama.

## Aksesibilitas

`role="img"` + `aria-label` yang merangkum sistem · DAFTAR JALUR sudah merupakan padanan teks ·
**ketebalan garis (4/3/2 px) membawa makna, bukan hanya warna** — merah `#DF301C` dan salmon
`#EE7A67` nyaris tidak terbedakan bagi buta warna merah-hijau · kontras diverifikasi di kedua tema.

## Checklist

- [ ] Topologi deterministik (state sama → topologi identik)?
- [ ] Setiap segmen menunjuk node yang ada?
- [ ] Jumlah node fixture = `outletCount`?
- [ ] Tinggi lantai default → seluruh elevasi `ASSUMED`?
- [ ] Bangunan > 3 lantai dirender penuh?
- [ ] Catatan "bukan gambar kerja" ada?
- [ ] Tanpa panggilan LLM maupun jaringan?
