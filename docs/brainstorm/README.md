# Paket Brainstorming SNOUTY

Bahan untuk diskusi arah SNOUTY dengan Claude (claude.ai) tanpa membuka seluruh repositori.
Diperbarui 16 Oktober 2026.

## Isi folder ini — unggah semuanya

| Berkas                | Isi                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `KONTEKS_RINGKAS.md`  | Baca pertama. Apa itu SNOUTY, prinsip, yang sudah ada, angka, keputusan pemilik, glosarium.  |
| `ARSITEKTUR_SKEMA.md` | Pembagian kerja model vs kode, topologi, alur satu giliran, Susun rekomendasi, modul, state. |
| `MESIN_HITUNG.md`     | Cara SNOUTY menghitung tiap kasus, contoh angka, dan kelemahan yang diketahui.               |
| `TOPIK_BRAINSTORM.md` | Sepuluh topik keputusan dengan pilihan dan apa yang perlu diputuskan.                        |

## Lampiran tambahan bila topiknya menyentuh

1. `docs/OPEN_QUESTIONS.md` — semua pertanyaan terbuka dengan usulan default.
2. `docs/ENGINEERING_AUDIT.md` — audit akurasi teknik dan katalog (9–12 Oktober).
3. `docs/ENGINEERING_RULES.md` — rumus lengkap per aturan.
4. `data/company/Snouty_Product_Knowledge_Master.md` — materi produk HRGA (draft).
5. `docs/AI_BEHAVIOR.md` — batas model vs kode.
6. `docs/SPEC.md` — spesifikasi produk lengkap (panjang).

## Cara memakai

1. Buat Project di claude.ai, unggah empat berkas di folder ini.
2. Tulis pembuka, misalnya:

```
Saya pemilik produk SNOUTY dari Pralon. Baca KONTEKS_RINGKAS.md dulu, lalu dokumen lain sesuai
kebutuhan. Saya ingin membahas topik nomor 1 di TOPIK_BRAINSTORM.md: bagaimana Pralon memvalidasi
perhitungan SNOUTY. Beri saya pilihan yang realistis, untung-ruginya, dan langkah pertama minggu ini.
```

3. Bawa keputusannya kembali ke sini; nanti dicatat di `docs/OPEN_QUESTIONS.md` dan dikerjakan.
