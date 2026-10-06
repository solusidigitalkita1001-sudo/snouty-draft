#!/usr/bin/env bash
# SNOUTY — deploy produksi di server (docs/DEPLOYMENT.md).
#
#   deploy/deploy.sh build      bangun image api/web/worker dari working tree
#   deploy/deploy.sh migrate    jalankan migration ke MySQL SNOUTY (langkah terpisah, disengaja)
#   deploy/deploy.sh up         nyalakan/perbarui seluruh layanan
#   deploy/deploy.sh smoke      cek health API dan halaman web
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
    ;;
  up)
    # Tanpa --remove-orphans: proyek lama di server memakai nama compose `snouty` juga, dan flag itu
    # menghapus kontainernya (snouty_backend/db/frontend) — yang kita ingin simpan untuk rollback.
    "${COMPOSE[@]}" up -d
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
