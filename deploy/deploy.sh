#!/usr/bin/env bash
# SNOUTY — deploy produksi di server (docs/DEPLOYMENT.md).
#
#   deploy/deploy.sh build      bangun image api/web/worker dari working tree
#   deploy/deploy.sh migrate    jalankan migration ke MySQL SNOUTY (langkah terpisah, disengaja)
#   deploy/deploy.sh up         nyalakan/perbarui seluruh layanan
#   deploy/deploy.sh smoke      cek health API dan halaman web
#   deploy/deploy.sh db-backup  mysqldump ke ~/backups
#   deploy/deploy.sh db-backup-daily  cadangan + hapus yang lebih dari 14 hari + salin ke luar (cron)
#   deploy/deploy.sh db-backup-offsite salinan terenkripsi gpg ke BACKUP_REMOTE (bila diisi)
#   deploy/deploy.sh db-grants  user aplikasi hanya SELECT/INSERT/UPDATE/DELETE (ikut migrate)
#   deploy/deploy.sh release    = git pull → build → up → smoke   (migration TIDAK termasuk)
#   deploy/deploy.sh logs [svc] ikuti log
#   deploy/deploy.sh cutover    ambil alih 80/443 dari nginx proyek lama (bagspace tetap dilayani)
#   deploy/deploy.sh rollback-edge kembalikan nginx proyek lama
#
# Migration dipisah dari release (docs/INFRASTRUCTURE.md §11): ia menyentuh skema, dan
# `db-apply.mjs` hanya berjalan tanpa upacara ke host loopback — MySQL compose dipublikasikan di
# 127.0.0.1:${DB_PORT}, jadi migration dijalankan dari dalam kontainer api dengan network host.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.production"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$ROOT/deploy/docker-compose.prod.yml")

[ -f "$ENV_FILE" ] || { echo "✖ $ENV_FILE tidak ada — salin dari deploy/env.production.example"; exit 1; }
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

cmd="${1:-}"
case "$cmd" in
  build)
    "${COMPOSE[@]}" build api web worker
    ;;
  migrate)
    "${COMPOSE[@]}" up -d mysql
    echo "▸ menunggu MySQL…"
    until "${COMPOSE[@]}" exec -T mysql mysqladmin ping -h localhost -p"${DB_ROOT_PASSWORD}" >/dev/null 2>&1; do sleep 2; done
    # `docker run`, bukan `compose run`: compose v5 tidak punya --network host, dan db-apply hanya
    # mau berjalan ke loopback — MySQL compose dipublikasikan di 127.0.0.1:${DB_PORT}.
    docker run --rm --network host \
      -e DB_HOST=127.0.0.1 -e DB_PORT="${DB_PORT:-3316}" -e DB_DATABASE="${DB_DATABASE:-snouty}" \
      -e DB_USERNAME=root -e DB_PASSWORD="${DB_ROOT_PASSWORD}" \
      "snouty-api:${SNOUTY_TAG:-latest}" node scripts/db-apply.mjs
    "$0" db-grants
    ;;
  db-grants)
    # Least privilege (SPEC §17, audit keamanan 2026-10-14): user aplikasi hanya baca/tulis data —
    # tanpa DROP/ALTER/CREATE. Migration berjalan sebagai root (`migrate`). Idempoten; ikut setiap
    # `migrate` supaya volume MySQL baru (yang memberi MYSQL_USER semua hak) langsung dibatasi lagi.
    db="${DB_DATABASE:-snouty}"
    user="${DB_USERNAME:-snouty}"
    "${COMPOSE[@]}" exec -T mysql mysql -uroot -p"${DB_ROOT_PASSWORD}" 2>/dev/null <<SQL
REVOKE ALL PRIVILEGES ON \`${db}\`.* FROM '${user}'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${db}\`.* TO '${user}'@'%';
SHOW GRANTS FOR '${user}'@'%';
SQL
    ;;
  db-backup)
    # Cadangan sebelum perubahan skema/hak: berkas gzip di ~/backups (bukan di repo).
    mkdir -p "$HOME/backups"
    out="$HOME/backups/${DB_DATABASE:-snouty}-$(date +%Y%m%d-%H%M%S).sql.gz"
    "${COMPOSE[@]}" exec -T mysql mysqldump -uroot -p"${DB_ROOT_PASSWORD}" --single-transaction \
      --routines --triggers "${DB_DATABASE:-snouty}" 2>/dev/null | gzip > "$out"
    echo "✓ cadangan: $out ($(du -h "$out" | cut -f1))"
    ;;
  db-backup-daily)
    # Dijalankan cron harian (crontab user snouty, docs/DEPLOYMENT.md §8a): cadangan + simpan 14 hari.
    # Cadangan manual bernama lain (pre-/before-) tidak ikut dihapus.
    "$0" db-backup
    find "$HOME/backups" -maxdepth 1 -name "${DB_DATABASE:-snouty}-2*.sql.gz" -mtime +14 -delete
    "$0" db-backup-offsite
    ;;
  db-backup-offsite)
    # Salinan ke luar server (keputusan pemilik 2026-10-14): dienkripsi dengan KUNCI PUBLIK gpg
    # penerima sebelum keluar — server ini tidak pernah memegang kunci pembukanya. Aktif begitu
    # BACKUP_REMOTE (mis. user@nas:/backup/snouty) dan BACKUP_GPG_RECIPIENT ada di .env.production
    # dan kunci publiknya sudah diimpor (`gpg --import`). Tanpa keduanya: dilewati, tercatat di log.
    if [ -z "${BACKUP_REMOTE:-}" ] || [ -z "${BACKUP_GPG_RECIPIENT:-}" ]; then
      echo "▸ salinan luar server dilewati: BACKUP_REMOTE/BACKUP_GPG_RECIPIENT belum diisi"
      exit 0
    fi
    latest="$(ls -t "$HOME"/backups/"${DB_DATABASE:-snouty}"-2*.sql.gz | head -1)"
    gpg --batch --yes --trust-model always --recipient "$BACKUP_GPG_RECIPIENT" \
      --output "$latest.gpg" --encrypt "$latest"
    rsync -a --timeout=120 "$latest.gpg" "$BACKUP_REMOTE/" && rm -f "$latest.gpg"
    echo "✓ salinan terenkripsi terkirim: $(basename "$latest").gpg → $BACKUP_REMOTE"
    ;;
  up)
    # Tanpa --remove-orphans: proyek lama di server memakai nama compose `snouty` juga, dan flag itu
    # menghapus kontainernya (snouty_backend/db/frontend) — yang kita ingin simpan untuk rollback.
    "${COMPOSE[@]}" up -d
    # Nginx menyelesaikan nama `api`/`web` sekali saat start; kontainer yang dibuat ulang dapat IP
    # baru dan nginx menjawab 502 sampai di-restart. Hanya bila nginx edge memang sedang jalan.
    if docker ps --format '{{.Names}}' | grep -qx 'snouty-nginx-1'; then
      "${COMPOSE[@]}" --profile edge restart nginx
    fi
    ;;
  smoke)
    for i in $(seq 1 40); do
      if curl -sf "http://127.0.0.1:${API_BIND_PORT:-3001}/health" >/dev/null; then break; fi
      sleep 3
      [ "$i" = 40 ] && { echo "✖ API tidak merespons"; "${COMPOSE[@]}" logs --tail 50 api; exit 1; }
    done
    echo "✓ API: $(curl -s "http://127.0.0.1:${API_BIND_PORT:-3001}/health")"
    code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${WEB_BIND_PORT:-3000}/")
    [ "$code" = "200" ] && echo "✓ web: 200" || { echo "✖ web: $code"; exit 1; }
    echo "✓ katalog aktif: $(curl -s "http://127.0.0.1:${API_BIND_PORT:-3001}/api/v1/catalog/version" | head -c 200)"
    ;;
  release)
    git -C "$ROOT" pull --ff-only
    "$0" build
    "$0" up
    "$0" smoke
    ;;
  logs)
    "${COMPOSE[@]}" logs -f --tail 100 "${2:-}"
    ;;
  cutover)
    # Mengambil alih 80/443 dari nginx proyek lama (`snouty_nginx`), yang juga melayani bagspace —
    # konfigurasi kita memuat blok bagspace, jadi aplikasi itu tetap jalan. Kontainer lama hanya
    # dihentikan, tidak dihapus: `deploy/deploy.sh rollback-edge` mengembalikannya.
    docker stop snouty_nginx >/dev/null 2>&1 || true
    "${COMPOSE[@]}" --profile edge up -d nginx
    sleep 2
    "${COMPOSE[@]}" --profile edge exec -T nginx nginx -t
    curl -sk -o /dev/null -w "ai.pralon.co.id → %{http_code}\n" https://ai.pralon.co.id/health --resolve ai.pralon.co.id:443:127.0.0.1
    curl -sk -o /dev/null -w "bagspace.pralon.co.id → %{http_code}\n" https://bagspace.pralon.co.id/ --resolve bagspace.pralon.co.id:443:127.0.0.1
    ;;
  rollback-edge)
    "${COMPOSE[@]}" --profile edge stop nginx
    docker start snouty_nginx
    ;;
  *)
    sed -n '2,12p' "$0"
    exit 1
    ;;
esac
