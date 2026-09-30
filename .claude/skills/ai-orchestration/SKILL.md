---
name: ai-orchestration
description: Gunakan saat menulis atau mengubah prompt, skema ekstraksi, intent router, routing model, streaming SSE, penanganan kegagalan LLM, atau pelacakan biaya token. Juga saat tergoda memanggil LLM untuk sesuatu — periksa dulu apakah panggilan itu memang perlu, dan apakah tugasnya boleh dikerjakan LLM sama sekali.
---

# Orkestrasi AI

Rujukan lengkap: `docs/AI_BEHAVIOR.md`.

## LARANGAN UTAMA

**LLM tidak pernah melakukan perhitungan teknik.** Tidak sizing, tidak kuantitas BOM, tidak elevasi,
tidak tekanan. Semua itu milik `packages/engineering` yang deterministik.

Ini ditegakkan secara struktural: modul `engineering` tidak punya `ai` pada grafik dependensinya.
Bila Anda merasa perlu melanggarnya, yang salah adalah rancangannya, bukan aturannya.

## Pembagian tugas

LLM boleh: memahami bahasa, deteksi intent, ekstraksi terstruktur, mendeteksi info kurang, menyusun
kalimat klarifikasi, merangkum, menjelaskan, membuat judul.

LLM tidak boleh: perhitungan teknik, kebenaran produk, kelayakan produk, penegakan kebijakan, aturan
sizing, harga, penetapan flag provenance.

## Sebelum menambah panggilan LLM

- [ ] Apakah ini bisa dijawab dengan query MySQL? (`PRODUCT_LOOKUP` → `SELECT`)
- [ ] Apakah nilainya sudah terstruktur? (edit kebutuhan, mutasi follow-up → **nol panggilan**)
- [ ] Apakah tingkat modelnya tepat? (lihat tabel routing)
- [ ] Apakah panggilan ini tercatat di `llm_calls` dengan alasan routing-nya?

Penghematan terbesar bukan memilih model murah, melainkan **tidak memanggil model sama sekali**.

## Routing

| Tugas                                                  | Tingkat                 |
| ------------------------------------------------------ | ----------------------- |
| FAQ produk, judul percakapan                           | `LLM_MODEL_FAST`        |
| Jawaban produk, ekstraksi, kalimat klarifikasi         | `LLM_MODEL_BALANCED`    |
| Masukan ambigu; percobaan ulang setelah validasi gagal | `LLM_MODEL_STRONG`      |
| Perhitungan teknik                                     | **tidak ada panggilan** |

ID model tidak pernah ditulis di kode. Routing adalah fungsi murni — bisa diuji, dan perubahannya
muncul di hasil evaluasi.

## Ekstraksi terstruktur

Selalu zod. Tiga hal yang mudah salah:

- **`optional()`, bukan `nullable()`.** Tidak disebut = `undefined`; dinyatakan tidak ada = `0`.
  Kalau keduanya jadi `null`, sistem akan menanyakan ulang hal yang sudah dijawab.
- **Batas numerik masuk akal.** `floors: max(50)` menolak keluaran kacau sebelum jadi skema 900
  lantai.
- **Enum tertutup.** Nilai di luar daftar ditolak, bukan disimpan sebagai string bebas.

Saat gagal validasi: ulangi **sekali** dengan pesan error dilampirkan (naik ke model kuat) → masih
gagal → **jatuh ke pertanyaan klarifikasi**. Tidak pernah ada percobaan ketiga. Tidak pernah ada
keluaran tak tervalidasi diteruskan ke Engineering Engine.

## Intent — dua pembedaan yang menentukan

- `PRODUCT_LOOKUP` → query MySQL, **bukan** pencarian semantik.
- `REQUIREMENT_MUTATION` vs `EXPLANATION_REQUEST` — "tambah satu kamar mandi" mengubah state,
  "kenapa ukuran ini" tidak. Salah di sini berarti mengubah kebutuhan pengguna tanpa diminta.
  **Bila ragu, bertanya.**

## Prosa tidak boleh melahirkan angka

Setelah engine selesai, LLM menulis prosa penjelas. Angka di dalam prosa **diekstrak dan dicocokkan**
dengan nilai terhitung (invarian REC-1); tidak cocok → minta ulang sekali → gagal lagi → templat
deterministik.

Tanpa pemeriksaan ini, "LLM tidak menghitung" hanya benar di atas kertas.

## Prompt

Konteks yang dikirim adalah **state terstruktur**, bukan transkrip mentah. Konten hasil retrieval
dan email dibungkus pembatas dan ditandai sebagai **data, bukan instruksi**. System prompt tidak
pernah diekspos. **Tidak ada aturan bisnis yang hanya hidup di prompt.**

Nada: Bahasa Indonesia, kalimat pendek, mengakui ketidaktahuan **sambil menawarkan jalan keluar**.

## SSE

Lima tahap adalah **batas pipeline nyata**, bukan timer: `UNDERSTANDING`,
`ANALYZING_INSTALLATION`, `MATCHING_PRODUCTS`, `COMPOSING`, `PREPARING_SCHEMATIC`.
Kontrak event: `docs/API_CONTRACTS.md` §3.

## Biaya

Setiap panggilan menulis `llm_calls`: model, token, latensi, biaya, correlation ID, alasan routing.
**Isi prompt tidak disimpan** — pelacakan biaya tidak memerlukannya.

## Evaluasi

Perubahan pada prompt, skema, atau routing **wajib** menjalankan evaluasi (`docs/EVALUATION.md`).
Laju halusinasi harus 0%; kesesuaian kebijakan harus 100%.
