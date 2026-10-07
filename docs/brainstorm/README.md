# Paket Brainstorming SNOUTY

Folder ini berisi bahan yang cukup untuk mengajak Claude (atau siapa pun) berdiskusi tentang arah
SNOUTY tanpa membuka seluruh repositori.

## Isi folder ini

| Berkas                | Untuk apa                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `KONTEKS_RINGKAS.md`  | Baca pertama. Apa itu SNOUTY, prinsip, bentuk sistem, status, angka, keputusan, pertanyaan terbuka, glosarium.            |
| `ARSITEKTUR_SKEMA.md` | Skema arsitektur: topologi, urutan keputusan per giliran, modul, state, sumber pengetahuan, mesin teknik, profil latensi. |

## Dokumen repo yang layak dilampirkan, urut prioritas

1. `docs/OPEN_QUESTIONS.md` — semua keputusan yang masih menunggu pemilik, dengan usulan default.
2. `docs/AI_BEHAVIOR.md` — batas model vs kode, intent, pagar, provenance.
3. `docs/CONTEXT_ENGINE.md` — state percakapan, snapshot, klarifikasi, subjek aktif.
4. `docs/ARCHITECTURE.md` — monolith modular, lapisan, arah dependensi, sinkron vs asinkron.
5. `docs/ENGINEERING_RULES.md` — aturan ENG ber-ID, registry parameter dan asumsi.
6. `docs/PHASE15_CHECKPOINT.md` — skenario uji terakhir, tabel latensi, tiga opsi model.
7. `docs/SPEC.md` — spesifikasi produk lengkap (panjang; lampirkan bila diskusi menyentuh cakupan).
8. `docs/ROADMAP.md` — fase dan urutan yang direncanakan.
9. `docs/DEPLOYMENT.md` — server, lineup model, prosedur rilis.
10. `data/company/Snouty_Product_Knowledge_Master.md` — materi HRGA (DRAFT_FOR_VALIDATION).

`docs/PROGRESS.md` sengaja tidak masuk daftar: ukurannya besar dan isinya riwayat per item.
Bila perlu, lampirkan 100 baris terakhirnya saja.

## Cara memakai

1. Buat Project di claude.ai, unggah dua berkas di folder ini plus dokumen nomor 1–6 di atas.
2. Mulai dengan pertanyaan di `ARSITEKTUR_SKEMA.md` §9, satu per satu.
3. Keputusan yang lahir dari diskusi dicatat ke `docs/OPEN_QUESTIONS.md` (status jawaban) atau
   `design-input/DESIGN_DECISIONS.md`, lalu dikerjakan sebagai item fase.

Contoh pembuka:

```
Saya pemilik produk SNOUTY. Baca KONTEKS_RINGKAS.md dan ARSITEKTUR_SKEMA.md dulu.
Saya ingin membahas pertanyaan nomor 1 dan 2 di bagian 9: pilihan model dan retrieval dokumen.
Beri saya opsi dengan trade-off biaya, latensi, dan risiko terhadap prinsip "tidak mengarang".
```
