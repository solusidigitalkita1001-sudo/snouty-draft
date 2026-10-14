#!/usr/bin/env bash
# Uji pemulihan cadangan (docs/DATABASE.md §8): cadangan terbaru dipulihkan ke kontainer MySQL
# SEMENTARA — tanpa port, terpisah dari produksi — lalu jumlah baris tiap tabel dibandingkan dengan
# produksi. Kontainer dihapus di akhir, berhasil atau gagal. Tidak menyentuh database produksi selain
# membaca COUNT(*).
#
#   deploy/restore-check.sh [berkas.sql.gz]
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
set -a; . "$ROOT/.env.production"; set +a
COMPOSE=(docker compose --env-file "$ROOT/.env.production" -f "$ROOT/deploy/docker-compose.prod.yml")
BACKUP="${1:-$(ls -t "$HOME"/backups/"${DB_DATABASE:-snouty}"-*.sql.gz | head -1)}"
NAME=snouty-restore-check
PW="$(head -c 32 /dev/urandom | base64 | tr -dc A-Za-z0-9 | head -c 24)"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1; }
trap cleanup EXIT
cleanup

docker run -d --name "$NAME" -e MYSQL_ROOT_PASSWORD="$PW" -e MYSQL_DATABASE=restore_check mysql:8 >/dev/null
for _ in $(seq 1 60); do
  docker exec "$NAME" mysql -uroot -p"$PW" -e 'SELECT 1' restore_check </dev/null >/dev/null 2>&1 && break
  sleep 3
done

started=$(date +%s)
zcat "$BACKUP" | docker exec -i "$NAME" mysql -uroot -p"$PW" restore_check 2>&1 | grep -v Warning
echo "▸ dipulihkan: $(basename "$BACKUP") dalam $(( $(date +%s) - started )) detik"

restored() { docker exec "$NAME" mysql -uroot -p"$PW" -N restore_check -e "$1" </dev/null 2>/dev/null; }
live() { "${COMPOSE[@]}" exec -T mysql mysql -uroot -p"$DB_ROOT_PASSWORD" -N "$DB_DATABASE" -e "$1" </dev/null 2>/dev/null; }

tables=$(restored "SELECT table_name FROM information_schema.tables WHERE table_schema='restore_check' ORDER BY 1")
count=0; differ=0
for t in $tables; do
  a=$(restored "SELECT COUNT(*) FROM \`$t\`"); b=$(live "SELECT COUNT(*) FROM \`$t\`")
  count=$((count + 1))
  # Produksi tetap menerima data setelah cadangan dibuat: selisih kecil wajar, tabel hilang tidak.
  if [ "$a" != "$b" ]; then differ=$((differ + 1)); echo "  selisih: $t cadangan=$a produksi=$b"; fi
done
echo "▸ tabel dipulihkan: $count · tabel dengan selisih baris: $differ"
[ "$count" -gt 0 ] && echo "✓ cadangan bisa dipulihkan" || { echo "✖ tidak ada tabel dipulihkan"; exit 1; }
