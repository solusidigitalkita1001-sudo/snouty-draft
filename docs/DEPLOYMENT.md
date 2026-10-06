# Deploy SNOUTY ke server (ai.pralon.co.id)

2026-10-06 · Target: server `192.168.1.10` (Ubuntu + Docker + Nginx), domain `ai.pralon.co.id`
sudah mengarah ke server. Paket deploy ada di repo: `Dockerfile` (target api/web/worker),
`deploy/docker-compose.prod.yml`, `deploy/env.production.example`, `deploy/nginx/ai.pralon.co.id.conf`,
`deploy/deploy.sh`. Prinsipnya mengikuti `docs/INFRASTRUCTURE.md` §11: **migration adalah langkah
terpisah**, tidak pernah otomatis saat release.

Proyek lama di `/var/www/html/project/beta/snouty` **tidak dihapus** — hanya dipindahkan/dimatikan,
supaya bisa kembali bila deploy baru bermasalah.

## 0. Yang harus disiapkan pemilik (sekali)

| Hal          | Keputusan / nilai                                                                                                                                                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model bahasa | Kunci OpenRouter **baru** (yang lama bocor, revoke) **atau** Ollama di server (CPU: 30–70 s per giliran rumah). Tanpa keduanya, jalur rumah tinggal menjawab "model tidak tersedia"; irigasi/kolam/transfer/drainase tetap jalan (tanpa model). |
| Database     | Baku: MySQL milik SNOUTY di kontainer (volume di server). Pindah ke server bersama `192.168.1.136` hanya dengan persetujuan + backup (`docs/DATABASE.md` §4).                                                                                   |
| Katalog      | Katalog contoh **ditolak** di produksi. Impor `data/catalog/2026-10-06-erp/*.csv` lalu promosikan (langkah 6).                                                                                                                                  |
| TLS          | `certbot --nginx` (Let's Encrypt) — port 80/443 harus terbuka dari internet.                                                                                                                                                                    |
| Akses        | Password SSH yang pernah dikirim di chat: **ganti** setelah deploy. Untuk operasi lanjutan, pasang kunci publik operator di `~/.ssh/authorized_keys`, jangan bagikan password.                                                                  |

## 1. Siapkan server

```bash
# sebagai snouty@192.168.1.10
sudo apt-get update && sudo apt-get install -y ca-certificates curl git nginx
# Docker Engine + compose plugin (lewati bila sudah ada): https://docs.docker.com/engine/install/ubuntu/
docker --version && docker compose version && nginx -v
sudo usermod -aG docker "$USER"   # lalu logout/login
```

## 2. Matikan proyek lama (tanpa menghapus)

```bash
cd /var/www/html/project/beta
# cek apa yang menjalankannya: pm2? systemd? docker? nginx site mana?
pm2 list 2>/dev/null; docker ps; ls /etc/nginx/sites-enabled/
# matikan prosesnya, lalu arsipkan folder dan site nginx lamanya
sudo mv snouty snouty.old-$(date +%F)
sudo mv /etc/nginx/sites-enabled/<site-lama> /etc/nginx/sites-available/<site-lama>.disabled 2>/dev/null || true
```

## 3. Ambil kode

```bash
cd /var/www/html/project/beta
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
# dari host; MySQL kontainer terbuka di 127.0.0.1:3316, Redis hanya di jaringan compose →
# jalankan di dalam kontainer api dengan network host supaya cache ikut dibuang:
docker compose --env-file .env.production -f deploy/docker-compose.prod.yml run --rm --no-deps --network host \
  -e DB_HOST=127.0.0.1 -e DB_PORT=3316 -e DB_USERNAME=root -e DB_PASSWORD="$DB_ROOT_PASSWORD" \
  -v "$PWD/data/catalog:/catalog:ro" api \
  node scripts/import-catalog-file.mjs /catalog/2026-10-06-erp/snouty_catalog_import_inch.csv \
       /catalog/2026-10-06-erp/snouty_catalog_import_mm_PENDING.csv \
       --label erp-2026-10-06 --source-document "Export ERP master_product_updated.xlsx (diunduh 2026-10-06)" \
       --exclude-rows-with-issues --excluded-out /catalog/excluded-prod.json

docker compose --env-file .env.production -f deploy/docker-compose.prod.yml run --rm --no-deps \
  -e DB_HOST=mysql -e DB_PORT=3306 -e DB_USERNAME=root -e DB_PASSWORD="$DB_ROOT_PASSWORD" \
  -e REDIS_URL=redis://redis:6379 api node scripts/promote-catalog-version.mjs erp-2026-10-06

deploy/deploy.sh smoke      # katalog aktif: label erp-2026-10-06, kind pralon
```

Promosi berikutnya lewat back-office (`/internal/catalog/versions/:id/promote`, peran `catalog_admin`).

## 7. Nginx + TLS

```bash
sudo cp deploy/nginx/ai.pralon.co.id.conf /etc/nginx/sites-available/ai.pralon.co.id
sudo ln -sf /etc/nginx/sites-available/ai.pralon.co.id /etc/nginx/sites-enabled/ai.pralon.co.id
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ai.pralon.co.id      # menambahkan 443 + redirect
curl -I https://ai.pralon.co.id/health
```

## 8. Release berikutnya

```bash
cd /var/www/html/project/beta/snouty
deploy/deploy.sh release     # git pull → build → up → smoke  (migration TIDAK ikut)
# bila ada migration baru di rilis itu (lihat changelog/PROGRESS): deploy/deploy.sh migrate dulu
```

Rollback: `git checkout <commit-sebelumnya> && deploy/deploy.sh build && deploy/deploy.sh up`.
Log: `deploy/deploy.sh logs api` (atau `web`, `worker`).

## 9. Yang belum dioptimalkan (sengaja)

- Image belum dipangkas (build stage dipakai sebagai runtime): ukuran besar tetapi benar. Pemangkasan
  (`pnpm deploy`, Next standalone, Alpine untuk api) menyusul setelah deploy pertama stabil.
- RabbitMQ memakai kredensial `guest` di jaringan internal compose saja (tidak terbuka ke luar).
- Belum ada backup otomatis volume `mysql-data`; tambahkan cron `mysqldump` sebelum data nyata masuk.
