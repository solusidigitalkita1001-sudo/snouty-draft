# SNOUTY

AI Pipe Solution Assistant untuk **Pralon**. Pengguna menceritakan bangunannya dengan bahasa
sehari-hari; SNOUTY menyusun kebutuhan terstruktur, menghitungnya secara deterministik, lalu
merekomendasikan produk Pralon beserta alasannya.

> **Status: Fase 0e — kerangka.** Belum ada fitur. Layar produk mulai dibangun di Fase 3.

## Mulai

```bash
pnpm install
cp .env.example .env          # isi kredensial; JANGAN commit .env
docker compose up -d          # Redis + RabbitMQ (MySQL TIDAK di sini — lihat di bawah)

pnpm --filter @snouty/web dev   # http://localhost:3000  → /tokens untuk pratinjau design token
pnpm --filter @snouty/api dev   # http://localhost:3001/health
```

Perintah kualitas:

```bash
pnpm check        # format + lint + typecheck + test
pnpm build        # web + api + worker
```

## Struktur

```
apps/web         Next.js — aplikasi pelanggan + /internal (back-office)
apps/api         NestJS — HTTP + SSE
apps/worker      konsumer RabbitMQ (PDF, email, agregasi)
packages/ui              design token — satu-satunya sumber warna
packages/shared-types    Provenance, kode error, kontrak SSE
packages/engineering     rule engine deterministik — tanpa I/O, tanpa LLM
packages/config          preset tsconfig
```

## Yang perlu diketahui sebelum menyentuh apa pun

- **MySQL di `192.168.1.136` adalah infrastruktur bersama** yang memuat tujuh database aplikasi lain.
  Tidak ada migration tanpa persetujuan pemilik dan backup terkonfirmasi. Baca `docs/DATABASE.md`.
- **LLM tidak pernah melakukan perhitungan teknik** (SPEC §25). `packages/engineering` sengaja tanpa
  dependensi runtime supaya aturan itu struktural, bukan sekadar niat.
- **Setiap nilai yang ditampilkan membawa provenance.** Aturan yang belum divalidasi ahli tidak
  pernah menghasilkan "TERVERIFIKASI".
- **Desain tidak dirancang ulang.** Keluaran Claude Design di `design-input/` adalah sumber kebenaran
  visual; konflik dicatat di `docs/OPEN_QUESTIONS.md`, bukan diputuskan sendiri.

## Dokumentasi

`docs/SPEC.md` adalah spesifikasi induk. `docs/PROGRESS.md` menunjukkan posisi pekerjaan saat ini.
`docs/OPEN_QUESTIONS.md` memuat semua hal yang masih menunggu keputusan.
