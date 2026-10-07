# Laporan Checkpoint Fase 15 — Bilingual (ID + EN penuh) · plus Fase 16 awal

2026-10-07 · untuk ditinjau pemilik · produksi https://ai.pralon.co.id

## 1. Ringkasan

Fase 15 (P15-01 … P15-06) selesai dan jalan di produksi: bahasa adalah atribut percakapan
(`conversations.language`, dipilih dari pengalih di sidebar untuk percakapan berikutnya); seluruh
antarmuka web, jawaban deterministik asisten (pengetahuan pipa, jawaban produk, kebijakan, panduan
teknis & irigasi, pertanyaan klarifikasi, kartu asumsi), registry parameter & asumsi engine,
penjelasan trace aturan, lima tampilan solusi, komposer, dan laporan PDF tersedia dalam Bahasa
Indonesia dan Inggris. Prinsipnya tetap: **teks Indonesia byte-identik dengan sebelumnya, versi
Inggris hidup di kode, bukan diterjemahkan model**; nilai pilihan dan tag tetap protokol Indonesia
dengan label tampilan per bahasa.

Di hari yang sama, dari laporan pemilik saat menguji, lahir Fase 16 awal (P16-01 … P16-05): subjek
percakapan aktif + intent perusahaan + modul pengetahuan perusahaan ("pralon itu apa?" → "boleh" →
"semuanya" tidak lagi berakhir "Produk mana yang Anda maksud?"), pop-up akun, pertanyaan konsep
("apa bedanya fitting sama hdpe?"), dan permintaan ubah bentuk ("bikinin tabelnya dong").

## 2. Dua belas skenario uji — produksi, tamu, bahasa Inggris (+ dua regresi Indonesia)

Diukur setelah rilis `P15-06b` (skenario 1, 4, 9, 11 diukur ulang setelah perbaikan hari ini). Waktu = dari kirim pesan sampai `message.end`.

| #   | Skenario (EN kecuali disebut)                                                   | Hasil                                                                                                                                                                                    | Waktu      |
| --- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | "2-storey house, 3 bathrooms, 1 kitchen, rooftop tank, clean water only"        | 4 data inti terbaca; "Okay, I have noted: residential, 2 floors, 3 bathrooms, 1 kitchen, rooftop tank, clean water" + CTA **Compose recommendation** (sebelum P15-06: bisu, hanya kartu) | 167 s      |
| 2   | "what is the difference between PVC and HDPE?" → "can you put that in a table?" | perbandingan EN berbutir + kartu produk; lanjutan → tabel Aspect/PVC/HDPE tanpa model                                                                                                    | 0 s / 63 s |
| 3   | "is Pralon better than Rucika?"                                                 | kartu kriteria netral EN, nol model                                                                                                                                                      | 0 s        |
| 4   | "hi, I want to ask something"                                                   | pembuka EN ("Go ahead and ask…"); label COMPANY_QUESTION dari model untuk sapaan ini dipagari di kode (P15-06b)                                                                          | 55 s       |
| 5   | "transfer water from a well to a tank, 5 l/s, 800 m, 12 m higher" + analisis    | panduan EN, data tercatat EN ("water source Well"), solusi EN penuh: headline, prosa, baris sistem, BOM, asumsi, **dasar perhitungan**                                                   | 2 s / 1 s  |
| 6   | "irrigate a 2 hectare paddy field from a river 150 m away"                      | jalur irigasi, luas 2 ha + sumber sungai + jarak 50–200 m terbaca, arahan EN + kartu pertanyaan EN (sebelum P15-06: pembuka, salah)                                                      | 0 s        |
| 7   | "hot water line for a hotel at 70 degrees, 200 m"                               | kartu validasi teknis (di luar cakupan), nol model                                                                                                                                       | 1 s        |
| 8   | "what is pralon?" → "tell me everything"                                        | profil perusahaan EN (ikhtisar, ragam produk, situs) → versi lengkap + "what I cannot verify yet" + CTA tim                                                                              | 0 s / 1 s  |
| 9   | "do you have 3/4 inch PVC AW?"                                                  | cek ketersediaan dari katalog Pralon: "Pipa (TS End) Abu AW …" + kartu produk (sebelum: dijawab sebagai konsep PVC; lalu "tidak ada di katalog" karena pencarian belum membaca keluarga) | 26 s       |
| 10  | "why 1 inch for the main line?"                                                 | teks tetap EN yang menunjuk ke detail teknis, tanpa model                                                                                                                                | 30 s       |
| 11  | ID: "rumah 2 lantai 3 kamar mandi toren atap air bersih"                        | 4 data + "Oke, sudah saya catat: rumah tinggal, 2 lantai, 3 kamar mandi, toren atap, air bersih" + CTA                                                                                   | 157 s      |
| 12  | ID: "pralon itu apa?"                                                           | profil perusahaan ID                                                                                                                                                                     | 0 s        |

## 3. Latensi: temuan yang harus dibaca pemilik

Pengukuran langsung ke Ollama di server (4 CPU, qwen2.5 7B, model sudah di RAM):

| Ukuran                                                   | Hasil                                                     |
| -------------------------------------------------------- | --------------------------------------------------------- |
| Pemrosesan prompt (awalan baru)                          | **22 token/detik**                                        |
| Pemrosesan prompt (awalan sama, cache)                   | ~3.000 token/detik                                        |
| Pembangkitan jawaban                                     | **1,6–5 token/detik** (makin lambat saat konteks panjang) |
| Prompt ekstraksi kebutuhan (sistem + skema JSON + pesan) | ±1.200–1.500 token                                        |

Akibatnya giliran **kebutuhan bangunan pertama** (ekstraksi + grounding) memakan **157–167 detik** hari
ini — jauh lebih lambat daripada 10–29 s yang tercatat di checkpoint Fase 14. Penyebabnya bukan
kode: pembangkitan 1,6 token/detik adalah kecepatan CPU server untuk model 7B dengan konteks panjang.
Yang sudah dilakukan di kode: semua jalur tanpa model (perusahaan, produk, kebijakan, irigasi, kasus
teknis, lanjutan subjek, ubah bentuk) kini 0–2 detik; `OLLAMA_KEEP_ALIVE` dinaikkan ke 24 jam supaya
tidak ada muat ulang model setelah jeda.

**Tiga pilihan untuk pemilik** (kode tidak perlu berubah, hanya env/compose):

1. **Model lebih kecil untuk ekstraksi & intent** (qwen2.5 3B atau 1.5B): 3–5× lebih cepat di CPU
   yang sama; kualitas bahasa turun, tetapi pagar grounding di kode yang menjaga angka/jenis/letak.
   Perlu uji 12 skenario ulang.
2. **Model berbayar** (gpt-4.1-mini / claude-haiku lewat OpenRouter): giliran ekstraksi 3–6 s,
   ±Rp 20 per giliran. Pemilik menolak 2026-10-07 (biaya), bisa ditinjau ulang.
3. **GPU** di server: 7B berjalan 10–20× lebih cepat. Perlu perangkat keras.

## 4. Yang dibangun di Fase 15 dan Fase 16 awal (ringkas; detail di `docs/PROGRESS.md`)

- **P15-01** infrastruktur bahasa; **P15-02** teks web; **P15-03** pemahaman Inggris + templat;
  **P15-04** registry, klasifikasi/ekstraksi kasus, tampilan solusi & komposer; **P15-04b** penjelasan
  trace 34 aturan; **P15-05** laporan PDF (bahasa dibekukan di payload); **P15-06** perbaikan dari
  skenario checkpoint (giliran kebutuhan tidak bisu, irigasi EN, aspek produk EN).
- **P16-01** intent `COMPANY_QUESTION`, subjek percakapan (`subject_change`, migration 0020),
  modul `company-knowledge` (hanya bagian terverifikasi; sisanya "belum bisa saya verifikasi");
  **P16-03/03b** pop-up akun (nama, sandi, tema/bahasa, keluar; satu Simpan); **P16-04** pertanyaan
  konsep & fitting, pemilihan produk terbaik, SKU ekspor disembunyikan; **P16-05** ubah bentuk
  (tabel/poin/ringkas) + tabel Markdown di gelembung.
- Tampilan: composer textarea yang tumbuh, drawer riwayat di ponsel, badge langkah & tautan mati
  dihapus, **tanpa metatext** (aturan baru di `.claude/CLAUDE.md`).

## 5. Risiko yang tersisa

- **Latensi giliran ekstraksi** (§3) — keputusan pemilik.
- **Pengenalan lanjutan berbasis pola kata**, bukan model: variasi jauh dari pola ("tolong
  visualisasikan") bisa lolos ke klasifikasi biasa. Daftar kata bisa ditambah dari laporan pengguna.
- **Pengetahuan perusahaan masih tipis** (OQ-54): hanya ikhtisar, ragam produk, situs resmi.
- **SKU katalog = ID ekspor ERP** (OQ-55): disembunyikan sampai kolom kode resmi tersedia.
- **PDF Inggris** terverifikasi lewat tes HTML & worker, belum unduhan nyata (butuh akun `advanced`).

## 6. Keputusan pemilik yang tercatat hari ini

| Keputusan | Isi                                                                      |
| --------- | ------------------------------------------------------------------------ |
| Deploy    | Setiap commit langsung ke produksi (`.claude/CLAUDE.md` § Deploy)        |
| Metatext  | Tidak pernah, di chat maupun UI (§ Teks yang dilihat pengguna)           |
| Akun      | Pop-up di workspace, satu tombol Simpan, tanpa banner "menunggu desain"  |
| Sidebar   | Tautan "Solusi Tersimpan"/"Pengetahuan Produk" dan badge langkah dibuang |
| Composer  | Textarea tumbuh, cincin fokus merek                                      |

## 7. Yang masih di tangan pemilik

Data profil perusahaan resmi (OQ-54) · kode produk resmi dari ERP (OQ-55) · field halaman akun & ganti
email (OQ-53) · keputusan latensi (§3) · `sudo certbot renew` bagspace · ganti password SSH `snouty` ·
cabut kunci OpenRouter yang bocor · hapus akun uji `snouty-uji-en-*@example.com` · OQ-07/OQ-48 ·
desain OQ-50/OQ-51/OQ-52.
