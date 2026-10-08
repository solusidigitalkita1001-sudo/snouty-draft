# Deploy SNOUTY ke server (ai.pralon.co.id)

2026-10-06 · Target: server `192.168.1.10` (Ubuntu + Docker + Nginx), domain `ai.pralon.co.id`
sudah mengarah ke server. Paket deploy ada di repo: `Dockerfile` (target api/web/worker),
`deploy/docker-compose.prod.yml`, `deploy/env.production.example`, `deploy/nginx/ai.pralon.co.id.conf`,
`deploy/deploy.sh`. Prinsipnya mengikuti `docs/INFRASTRUCTURE.md` §11: **migration adalah langkah
terpisah**, tidak pernah otomatis saat release.

Proyek lama di `/var/www/html/project/beta/snouty` **tidak dihapus** — hanya dipindahkan/dimatikan,
supaya bisa kembali bila deploy baru bermasalah.

## 0. Yang harus disiapkan pemilik (sekali)

| Hal          | Keputusan / nilai                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model bahasa | Kunci OpenRouter **baru** (yang lama bocor, revoke) **atau** Ollama di server (CPU: 30–70 s per giliran rumah). Tanpa keduanya, jalur rumah tinggal menjawab "model tidak tersedia"; irigasi/kolam/transfer/drainase tetap jalan (tanpa model). **Akun OpenRouter harus punya kredit**: dibaca 2026-10-06 akun proyek lama bersaldo 0, kunci berbatas harian 0, dan slug `:free` yang dipakai sudah dihapus OpenRouter (model gratis tersisa hanya Nemotron, 50 permintaan/hari, 12–47 s per jawaban, keluaran bercampur "thinking" — tidak layak). **Keputusan pemilik 2026-10-06 malam: Ollama di server** (service `ollama`, profil compose `ollama`, model `qwen2.5:7b-instruct` seperti di lokal; `LLM_REPLY_TIMEOUT_MS=30000`, `LLM_CALL_TIMEOUT_MS=180000`). Cadangan env OpenRouter: `~/.env.production.bak-openrouter`. |
| Database     | Baku: MySQL milik SNOUTY di kontainer (volume di server). Pindah ke server bersama `192.168.1.136` hanya dengan persetujuan + backup (`docs/DATABASE.md` §4).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Katalog      | Katalog contoh **ditolak** di produksi. Impor `data/catalog/2026-10-06-erp/*.csv` lalu promosikan (langkah 6).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| TLS          | `certbot --nginx` (Let's Encrypt) — port 80/443 harus terbuka dari internet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Akses        | Password SSH yang pernah dikirim di chat: **ganti** setelah deploy. Untuk operasi lanjutan, pasang kunci publik operator di `~/.ssh/authorized_keys`, jangan bagikan password.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## 1. Kenyataan server (dibaca 2026-10-06 malam)

- Ubuntu 22.04, 4 CPU, 15 GB RAM; Docker 29 + Compose v5; user `snouty` ada di grup `docker`
  tetapi **sudo butuh password** → seluruh deploy lewat Docker, tanpa menyentuh paket host.
- Nginx host nonaktif. Port 80/443 dipegang kontainer `snouty_nginx` proyek lama, yang **juga
  melayani `bagspace.pralon.co.id`** (aplikasi lain di server yang sama). Sertifikat Let's Encrypt
  ada di `/etc/letsencrypt` host; `certbot.timer` host memperbaruinya lewat webroot `/var/www/certbot`
  — dan **gagal untuk bagspace** (blok :80 lamanya me-redirect tantangan ACME; sertifikatnya
  kedaluwarsa 2026-09-20). Sertifikat ai.pralon.co.id berlaku sampai 2026-10-12.
- Proyek lama di `/var/www/html/project/beta/snouty` milik root: dibiarkan utuh; kontainernya hanya
  dihentikan saat cut-over. Repo baru di-clone ke `~/snouty`.
- Kunci OpenRouter dipakai dari `backend/.env` proyek lama (prefix berbeda dari kunci yang bocor).

## 2. Proyek lama

Tidak dihapus. `deploy/deploy.sh cutover` menghentikan `snouty_nginx` dan menyalakan nginx compose
(profil `edge`) yang memuat blok ai.pralon.co.id **dan** bagspace (ditambah lokasi ACME supaya
pembaruan sertifikat bagspace bisa berjalan lagi). Setelah ai.pralon.co.id terbukti jalan, kontainer
`snouty_backend`/`snouty_frontend`/`snouty_db`/`snouty_redis` dihentikan dengan `docker stop`; image
dan volume tetap ada. Rollback: `deploy/deploy.sh rollback-edge` lalu `docker start` kontainer lama.

## 3. Ambil kode

```bash
cd ~
git clone https://github.com/solusidigitalkita1001-sudo/snouty-draft.git snouty
cd snouty
git checkout phase-1/P1-01-catalog-foundation      # branch yang berisi seluruh pekerjaan Fase 14
```

## 4. Environment

```bash
cp deploy/env.production.example .env.production
# isi: DB_ROOT_PASSWORD, DB_PASSWORD (openssl rand -base64 24), JWT_*_SECRET (openssl rand -base64 48),
# OPENROUTER_* (atau Ollama), APP_URL. Jangan pernah commit .env.production.
chmod 600 .env.production
```

Ollama (pilihan yang dipakai, gratis — keputusan pemilik 2026-10-07): di `.env.production` set
`COMPOSE_PROFILES=ollama`, `OPENROUTER_BASE_URL=http://ollama:11434/v1`, `OPENROUTER_API_KEY=ollama`, dan
**satu model untuk ketiga tingkat** (`FAST`/`BALANCED`/`STRONG` di `model-routing.ts`): `qwen2.5:7b-instruct`.
Tarik sekali: `docker compose --env-file .env.production -f deploy/docker-compose.prod.yml exec ollama ollama pull qwen2.5:7b-instruct`
(4,7 GB ke volume `ollama-data`). RAM saat model dimuat ±5 GB; `OLLAMA_KEEP_ALIVE=24h` menahannya di RAM.

Model EMBEDDING untuk pemahaman pertanyaan (P16-11, `docs/AI_BEHAVIOR.md` §4a): `bge-m3` (±1,2 GB, 567M
parameter; puluhan milidetik per kalimat di CPU, dan Ollama menjalankannya di runner terpisah dari 7B).
Tarik sekali: `docker compose --env-file .env.production -f deploy/docker-compose.prod.yml exec ollama ollama pull bge-m3`,
lalu `LLM_MODEL_EMBEDDING=bge-m3` di `.env.production`. Tanpa ini API tetap jalan, tetapi setiap pesan
yang tidak terbaca parser nilai jatuh ke model generatif (40–170 s per klasifikasi). Contoh kalimat
dan kosakata ada di `data/understanding/` (ikut ke image); vektor contoh di-cache di `/tmp` kontainer,
jadi boot pertama setelah image baru menyandikan ±1.300 contoh (±40 detik), boot berikutnya gratis.

Mengapa hanya satu model, bukan model kecil untuk tugas ringan: diuji 2026-10-07 di server (4 CPU, tanpa
GPU) — `qwen2.5:3b-instruct` hanya ±2× lebih cepat (prompt 43 vs 23 tok/s, jawaban 1,7 vs 0,9 tok/s), dan
karena Ollama melayani satu permintaan sekali waktu di CPU, tugas ringan (judul) yang berjalan bersamaan
dengan ekstraksi 7B tetap menunggu ekstraksi selesai (judul 3B terukur 99 s saat ekstraksi 95 s berjalan).
Tidak ada untungnya, RAM bertambah 2,5 GB; model 3B dihapus. Model lain yang tidak dipakai dihapus
(`ollama rm`). Percepatan nyata hanya dari GPU atau model berbayar (`docs/PHASE15_CHECKPOINT.md` §3).

Diet panggilan model (P16-10, 2026-10-07): tiga saklar env **baku nonaktif** dan sebaiknya tetap
nonaktif selama model berjalan di CPU — `LLM_CHAT_REPLY` (sapaan, pembuka, judul percakapan ditulis
model), `LLM_STRUCTURED_RETRY` (percobaan kedua bila JSON tidak valid), `LLM_SOLUTION_PROSE`
(headline/body solusi bangunan). Nyalakan (`=true`) hanya bila model cepat (GPU atau berbayar).
Ekstraksi kebutuhan juga dilewati otomatis bila kode sudah membaca ≥ 2 data inti dari teks.

## 5. Build, migration, nyalakan

```bash
chmod +x deploy/deploy.sh
deploy/deploy.sh build      # ±5–10 menit pertama kali (pnpm install + next build + Chromium)
deploy/deploy.sh migrate    # langkah sadar: menerapkan drizzle/0000…0017 ke MySQL SNOUTY
deploy/deploy.sh up
deploy/deploy.sh smoke      # ✓ API health, ✓ web 200, katalog aktif (masih kosong → langkah 6)
```

## 6. Impor dan promosikan katalog Pralon (sekali per versi katalog)

```bash
# impor: MySQL kontainer terbuka di 127.0.0.1:3316 → `docker run --network host` (compose v5 tidak
# punya flag itu). Skrip impor tidak butuh Redis.
set -a; . ./.env.production; set +a
docker run --rm --network host \
  -e DB_HOST=127.0.0.1 -e DB_PORT=3316 -e DB_DATABASE=snouty -e DB_USERNAME=root -e DB_PASSWORD="$DB_ROOT_PASSWORD" \
  -v "$PWD/data/catalog:/catalog" snouty-api:latest \
  node scripts/import-catalog-file.mjs /catalog/2026-10-06-erp/snouty_catalog_import_inch.csv \
       /catalog/2026-10-06-erp/snouty_catalog_import_mm_PENDING.csv \
       --label erp-2026-10-06 --source-document "Export ERP master_product_updated.xlsx (diunduh 2026-10-06)" \
       --exclude-rows-with-issues --excluded-out /catalog/excluded-prod.json

# promosi: butuh Redis (cache katalog dibuang) → di jaringan compose; skrip hanya menolak 192.168.1.136.

docker compose --env-file .env.production -f deploy/docker-compose.prod.yml run --rm --no-deps \
  -e DB_HOST=mysql -e DB_PORT=3306 -e DB_USERNAME=root -e DB_PASSWORD="$DB_ROOT_PASSWORD" \
  -e REDIS_URL=redis://redis:6379 api node scripts/promote-catalog-version.mjs erp-2026-10-06

deploy/deploy.sh smoke      # katalog aktif: label erp-2026-10-06, kind pralon
```

Promosi berikutnya lewat back-office (`/internal/catalog/versions/:id/promote`, peran `catalog_admin`).

## 7. Cut-over 80/443 (nginx di compose, TLS dari `/etc/letsencrypt` host)

```bash
deploy/deploy.sh cutover     # stop snouty_nginx lama → nginx compose (profil edge) → nginx -t → cek kedua domain
curl -I https://ai.pralon.co.id/health
curl -I https://bagspace.pralon.co.id/
docker stop snouty_backend snouty_frontend snouty_db snouty_redis   # proyek lama, setelah yakin
```

Sertifikat: `sudo certbot renew` (butuh sudo — pemilik) setelah cut-over memperbarui bagspace yang
kedaluwarsa, karena nginx baru melayani `/.well-known/acme-challenge/` untuk kedua domain; setelah
pembaruan: `docker compose --env-file .env.production -f deploy/docker-compose.prod.yml --profile edge restart nginx`.
Varian nginx host (`deploy/nginx/ai.pralon.co.id.conf`) tetap tersedia bila suatu saat nginx host dipakai.

## 8. Release berikutnya

```bash
cd /var/www/html/project/beta/snouty
deploy/deploy.sh release     # git pull → build → up → smoke  (migration TIDAK ikut)
# bila ada migration baru di rilis itu (lihat changelog/PROGRESS), urutannya:
#   git pull && deploy/deploy.sh build && deploy/deploy.sh migrate && deploy/deploy.sh up && deploy/deploy.sh smoke
# `migrate` menjalankan db-apply DARI IMAGE api — image lama tidak memuat berkas migration baru
# (kejadian 2026-10-07: 0018 "selesai" tanpa diterapkan karena migrate dijalankan sebelum build).
```

Rollback: `git checkout <commit-sebelumnya> && deploy/deploy.sh build && deploy/deploy.sh up`.
Log: `deploy/deploy.sh logs api` (atau `web`, `worker`).

## 9. Yang belum dioptimalkan (sengaja)

- Image belum dipangkas (build stage dipakai sebagai runtime): ukuran besar tetapi benar. Pemangkasan
  (`pnpm deploy`, Next standalone, Alpine untuk api) menyusul setelah deploy pertama stabil.
- RabbitMQ memakai kredensial `guest` di jaringan internal compose saja (tidak terbuka ke luar).
- Belum ada backup otomatis volume `mysql-data`; tambahkan cron `mysqldump` sebelum data nyata masuk.
