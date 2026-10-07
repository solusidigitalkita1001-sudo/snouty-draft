# Materi perusahaan & pengetahuan produk Pralon (sumber OQ-54)

Taruh di folder ini dokumen resmi yang dikumpulkan pemilik bersama HRGA: profil perusahaan,
sejarah, visi-misi, pabrik, sertifikasi, kanal resmi, dan materi pengetahuan produk perpipaan.
Format apa pun: PDF, DOCX, PPTX, XLSX, Markdown, atau teks.

Yang terjadi setelahnya (dikerjakan asisten, bukan otomatis saat runtime):

1. Setiap dokumen dibaca dan dipilah per bagian profil
   (`apps/api/src/modules/company-knowledge/domain/company-profile.ts` → `SECTIONS`), dua bahasa,
   dengan nama dokumen + halaman sebagai `source`. Bagian tanpa sumber tidak pernah dibuat.
2. Materi produk/teknik masuk ke `apps/api/src/modules/context/application/pipe-knowledge.ts`
   (bahan, konsep) dengan cara yang sama; angka teknik hanya bila dokumennya menyatakannya.
3. Dokumen aslinya tetap di sini sebagai jejak sumber. Jangan commit dokumen yang rahasia —
   bila ada, simpan ringkasan yang boleh dipublikasikan saja.

Nama file bebas; sertakan tahun/versi bila ada (mis. `company-profile-2025.pdf`).
