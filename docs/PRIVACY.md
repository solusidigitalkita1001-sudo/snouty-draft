# SNOUTY — Privasi

Fase 0b · P0b-08 · Terakhir diperbarui 2026-09-30

Kepatuhan terhadap **UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)**, diterjemahkan
menjadi keputusan teknis. Sumbernya SPEC §30b.

Catatan: dokumen ini adalah desain teknis, bukan nasihat hukum. Naskah kebijakan privasi dan
penunjukan pengendali data tetap perlu ditinjau pihak yang berwenang di Pralon (OQ-12).

---

## 1. Peran

| Peran menurut UU PDP | Pihak |
|---|---|
| Pengendali Data Pribadi | Pralon |
| Prosesor Data Pribadi | penyedia LLM (OpenRouter dan model di belakangnya), penyedia hosting |
| Subjek Data | pelanggan (tamu maupun terdaftar), pengirim email ke `sales@pralon.com` |

Konsekuensi yang paling sering terlewat: mengirim isi percakapan pelanggan ke penyedia LLM adalah
**mengalihkan data pribadi ke prosesor**. Itu perlu dasar hukum dan pembatasan, bukan sekadar
keputusan teknis. Lihat §5.

---

## 2. Inventaris data

| Data | Kategori | Dari | Dipakai untuk |
|---|---|---|---|
| Nama, email, password hash | identitas | registrasi | autentikasi |
| Isi percakapan | dapat memuat data pribadi | chat | menyusun rekomendasi |
| Kebutuhan bangunan (lantai, kamar mandi, sumber air) | data properti | chat | perhitungan teknik |
| Lokasi tingkat kota | lokasi | izin browser, opsional | **hanya** analisis kebutuhan wilayah |
| Denah yang diunggah | dapat memuat alamat | unggahan | membantu estimasi |
| Laporan (nama, lokasi proyek) | data pribadi | dibangkitkan | dokumen pelanggan |
| Email masuk ke sales | data pribadi pihak ketiga | mailbox | analisis lead |
| Log & correlation ID | metadata teknis | sistem | diagnosis |

Yang **tidak pernah** dikumpulkan: NIK, data keuangan, biometrik, lokasi presisi (koordinat), kontak
di perangkat.

---

## 3. Persetujuan (consent)

Persetujuan adalah **baris di database**, bukan flag `localStorage` (OQ-19).

```
consents(subject_id, kind, granted, policy_version, granted_at, revoked_at)
kind ∈ { LOCATION, ANALYTICS_STORAGE }
```

| Aspek | Ketentuan |
|---|---|
| Kapan diminta | onboarding langkah 4 (lokasi); penyimpanan chat tamu saat sesi dimulai |
| Sifat | opsional, tidak menghalangi — desain menegaskan "SNOUTY tetap bisa digunakan tanpa lokasi" |
| Penjelasan | diberikan **sebelum** prompt browser muncul, dengan 4 butir penjelas |
| Versi kebijakan | wajib tersimpan di setiap baris |
| Pencabutan | kapan saja lewat pengaturan; `revoked_at` diisi, baris tidak dihapus |
| Ditolak | netral, tanpa nada menyalahkan, alur berlanjut (~450 ms) |
| Diblokir browser | kartu amber, aplikasi tetap penuh |

Flag `localStorage['snouty_onboarding_state']` hanya kenyamanan render pertama supaya modal tidak
berkedip; server tetap yang berwenang, dan keduanya direkonsiliasi saat halaman dimuat.

---

## 4. Lokasi — janji yang mengikat kode

Onboarding langkah 4 menjanjikan empat hal kepada pengguna:

> · Berbagi lokasi bersifat opsional.
> · SNOUTY tetap bisa digunakan tanpa lokasi.
> · **Data wilayah dipakai untuk analisis kebutuhan pasar, bukan untuk menentukan rekomendasi.**
> · Tingkat detail cukup di level kota/kabupaten.

Butir ketiga bukan sekadar kalimat pemasaran; ia mengikat arsitektur. Maka:

- Koordinat dari browser **segera** diringkas menjadi kota/kabupaten dan koordinat mentahnya dibuang.
  Yang disimpan hanya nama wilayah.
- Modul `recommendation` dan `engineering` **tidak punya akses** ke data lokasi. Bukan karena
  disepakati begitu, tetapi karena lokasi tidak ada di dalam `RequirementState`, dan aturan dependensi
  di `ARCHITECTURE.md` §7 melarang keduanya menyentuh `market-intelligence`.
- Jadi janji "bukan untuk menentukan rekomendasi" ditegakkan oleh ketiadaan jalur data, bukan oleh
  disiplin. Ini satu-satunya cara janji semacam itu bertahan setelah enam bulan perubahan kode.

---

## 5. Data yang dikirim ke penyedia LLM

Jalur paparan terbesar di sistem, dan perlu perlakuan berbeda per sumber.

| Jalur | Yang dikirim | Pembatasan |
|---|---|---|
| Chat pelanggan | pesan pengguna + requirement state | wajar dan diperlukan; dasar hukum: pelaksanaan layanan yang diminta |
| Judul percakapan | pesan pertama | sama |
| Prosa rekomendasi | **hanya nilai terstruktur hasil hitungan** — bukan transkrip | paparan minimum |
| Analisis email (Fase 11) | isi email pihak ketiga | **paling sensitif** — lihat di bawah |

**Email memerlukan redaksi sebelum Fase 11.** Pengirim email ke `sales@pralon.com` tidak pernah
menyetujui isinya diproses model pihak ketiga, dan email bisnis rutin memuat nama, nomor telepon,
alamat, bahkan nilai proyek. Rencananya:

1. Redaksi bertahap sebelum dikirim ke model: nomor telepon, alamat lengkap, NPWP, nomor rekening, dan
   tanda tangan diganti token (`[TELEPON]`, `[ALAMAT]`).
2. Yang dikirim adalah isi yang sudah diredaksi; teks asli tetap di MySQL untuk ditinjau manusia.
3. Nilai asli dipulihkan hanya saat ditampilkan ke peninjau internal yang berwenang.

Ketentuan umum untuk semua jalur: minta penyedia mematikan retensi dan pelatihan bila tersedia,
catat model dan endpoint yang dipakai di `llm_calls`, dan **jangan pernah** mengirim password hash,
token, atau isi berkas unggahan.

---

## 6. Retensi

Usulan (OQ-13); semuanya konfigurasi, bukan literal.

| Data | Retensi | Setelah itu |
|---|---|---|
| Percakapan tamu | 90 hari | dianonimkan menjadi agregat market intelligence |
| Percakapan terdaftar | sampai pengguna menghapus | dihapus atas permintaan |
| Denah yang diunggah | 180 hari | dihapus |
| Laporan yang dibangkitkan | 12 bulan | dihapus; metadata disimpan |
| Email + analisisnya | 24 bulan | dianonimkan |
| Agregat market | tanpa batas | sudah anonim sejak awal |
| Log aplikasi | 30 hari | dirotasi |
| Audit log | 24 bulan | disimpan demi kepatuhan |
| `llm_calls` | 12 bulan | hanya metadata biaya, tanpa isi prompt |

Baris terakhir disengaja: pelacakan biaya tidak memerlukan isi prompt, jadi isi prompt tidak disimpan
di sana. Menyimpan apa yang tidak diperlukan adalah risiko tanpa imbalan.

---

## 7. Anonimisasi untuk market intelligence

Market intelligence bekerja pada agregat, bukan individu. Event yang keluar dari konteks percakapan
kehilangan identitasnya:

```ts
// yang keluar dari conversation ke market
{
  region: 'Bekasi',              // kota/kabupaten, bukan alamat
  buildingType: 'rumah_tinggal',
  outletCount: 8,
  productInterest: ['pvc_aw_1', 'pvc_aw_34'],
  quotationIntent: false,
  occurredAt: '2026-09-30'
}
// tidak ada: userId, guestSessionId, conversationId, nama, email, teks bebas
```

Dua pengaman tambahan: agregat hanya dipublikasikan bila ukuran kelompok ≥ 5 (mencegah identifikasi
ulang di kota kecil), dan pekerjaan agregasi berjalan asinkron sehingga tidak pernah memperlambat
chat (SPEC §15).

---

## 8. Hak subjek data

| Hak (UU PDP) | Implementasi | Fase |
|---|---|---|
| Akses | `GET /me/data-export` → JSON berisi akun, percakapan, snapshot, laporan | 3 |
| Perbaikan | edit profil; kebutuhan bisa diedit kapan saja di panel kanan | 3 |
| Penghapusan | `DELETE /me` → soft delete lalu penghapusan permanen dalam 30 hari | 3 |
| Penarikan persetujuan | pengaturan; `revoked_at` diisi | 3 |
| Keberatan atas pemrosesan | menonaktifkan penyimpanan analitik | 3 |
| Portabilitas | ekspor JSON di atas | 3 |

Tamu berada di posisi khusus: tanpa akun, permintaan penghapusan hanya bisa dipenuhi selama cookie
sesinya masih ada. Ini disebutkan jujur di kebijakan privasi, bukan disembunyikan.

Penghapusan tidak menghapus agregat yang sudah anonim — data itu bukan lagi data pribadi. Batas ini
juga dinyatakan di kebijakan.

---

## 9. Kontrol keamanan yang menopang privasi

| Kontrol | |
|---|---|
| Enkripsi transit | TLS di Nginx |
| Enkripsi at-rest | tanggung jawab host MySQL — perlu dikonfirmasi bersama backup (OQ) |
| Kontrol akses | laporan hanya pemilik + peran berwenang; setiap tulis internal diaudit |
| Log | tidak pernah memuat data pribadi maupun secret |
| Unggahan | disimpan di luar web root, nama dibangkitkan, MIME & ukuran dibatasi |
| Minimalisasi | lokasi hanya level kota; `llm_calls` tanpa isi prompt |

---

## 10. Pemberitahuan insiden

UU PDP mewajibkan pemberitahuan kepada subjek data dan otoritas dalam **3×24 jam** sejak kebocoran
diketahui. Prasyarat teknis yang harus sudah ada sebelum produksi:

1. Audit log cukup lengkap untuk menentukan data siapa yang terdampak.
2. Jalur eskalasi yang jelas dan pemilik yang ditunjuk.
3. Kemampuan mengirim pemberitahuan massal kepada pengguna terdaftar.

Ketiganya belum ada. Dicatat di sini agar tidak ditemukan saat sudah terlambat.

---

## 11. Yang masih terbuka

| | Pertanyaan |
|---|---|
| OQ-12 | naskah kebijakan privasi & ketentuan layanan, beserta label versinya |
| OQ-13 | konfirmasi periode retensi di atas |
| — | apakah MySQL di `192.168.1.136` terenkripsi at-rest, dan siapa yang memegang backup |
| — | perjanjian pemrosesan data dengan OpenRouter dan penyedia model di belakangnya |
| — | siapa Pejabat Pelindungan Data (DPO) untuk Pralon, bila ditunjuk |

Sampai OQ-12 terjawab, halaman `/privasi` dan `/ketentuan` berisi teks placeholder dan versi
kebijakan tercatat sebagai `v0-draft` di setiap baris consent — sehingga saat naskah asli terbit,
terlihat jelas siapa yang menyetujui versi mana.
