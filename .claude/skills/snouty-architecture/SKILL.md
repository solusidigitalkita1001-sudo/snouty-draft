---
name: snouty-architecture
description: Gunakan saat membuat modul baru, memindahkan kode antar modul, menambah dependensi antar modul, membuat controller atau service baru, memutuskan di mana sepotong logika seharusnya tinggal, atau saat tergoda memecah sesuatu menjadi layanan terpisah. Juga saat menyiapkan branch dan commit untuk sebuah item.
---

# Arsitektur SNOUTY

Rujukan lengkap: `docs/ARCHITECTURE.md`.

## Bentuk

Monolith modular. Satu basis kode, satu database, batas modul tegas di dalamnya.
**Tidak ada microservices.** Batas domain belum stabil; memindahkan batas modul itu murah,
memindahkan batas jaringan itu mahal.

Tiga aplikasi: `apps/web` (Next.js, termasuk `/internal`), `apps/api` (NestJS, HTTP + SSE),
`apps/worker` (konsumer RabbitMQ + Chromium).
Paket khusus: `packages/engineering` — TS murni, **tanpa I/O, tanpa framework**.

## Arah dependensi — wajib

```
presentation → application → domain
modul → shared → infrastructure        (tidak pernah sebaliknya)
policy → (tidak ke mana-mana)          WAJIB leaf
engineering → packages/engineering     TIDAK BOLEH ke ai/ atau product-catalog/
ai → (tidak ke domain)                 ai layanan, bukan pengambil keputusan
```

Tiga aturan yang tidak bisa ditawar:

- **`policy` wajib leaf.** Tanpa I/O, setiap pemeriksaan adalah fungsi murni. Ini yang membuat tes
  "tamu menembus API" murah dan mustahil terlupa.
- **`engineering` tidak menyentuh `ai`.** Penegakan struktural SPEC §25.
- **`ai` tidak menyentuh domain.** Supaya aturan bisnis tidak mengendap di dalam prompt.

Pelanggaran arah dependensi menggagalkan CI (lint boundary), bukan sekadar ditegur saat review.

## Checklist sebelum menulis modul atau memindahkan kode

- [ ] Modul ini milik konteks mana? (lihat katalog di `docs/ARCHITECTURE.md` §6)
- [ ] Arah dependensinya sah?
- [ ] Butuh empat lapis, atau cukup service + repository? Empat lapis **hanya** untuk modul yang
      punya aturan domain sendiri.
- [ ] Ada logika bisnis yang tanpa sengaja masuk ke controller atau komponen React?
- [ ] Apakah service ini sudah > 7 dependensi? Kalau ya, batasnya salah.
- [ ] Apakah ini abstraksi pemakaian pertama? Tunggu sampai pemakaian ketiga.

## Sinkron vs asinkron

Uji satu pertanyaan: **apakah pengguna sedang menunggunya di layar?**

Sinkron: pesan chat, ekstraksi, perhitungan teknik, matching, BOM, skema.
Asinkron (RabbitMQ): PDF, handoff, impor katalog, embedding, email, agregasi, notifikasi.

**Chat tidak pernah lewat RabbitMQ.**

## Lintas-potong

Correlation ID sejak awal (menambahkannya belakangan menyentuh setiap jalur kode) · Pino terstruktur ·
exception domain → kode error stabil · zod di setiap batas · transaksi dimulai di lapisan
application · config divalidasi saat boot, proses menolak start bila kurang.

## Git

Branch `phase-<n>/<item-id>-<nama-singkat>` · commit diawali ID item · kecil dan fokus ·
refactor tidak dicampur fitur · tidak pernah push ke `main`, tidak pernah force-push.

## Yang sengaja belum dibangun

Microservices · Qdrant · Python · OpenTelemetry · read replica. Semuanya keputusan, bukan kelalaian —
jangan menambahkannya tanpa alasan baru yang konkret (`docs/ARCHITECTURE.md` §12).
