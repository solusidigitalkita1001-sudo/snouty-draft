#!/usr/bin/env bash
# Preflight server pengembangan — BACA SAJA.
#
# Skrip ini tidak memasang, mengubah, atau menghapus apa pun. Ia menjawab satu
# pertanyaan: apakah host ini sanggup menjalankan lingkungan pengembangan SNOUTY,
# dan apakah ia infrastruktur bersama yang menuntut kehati-hatian ekstra.
#
# Pemakaian:  scripts/remote-preflight.sh user@host [port-ssh]
#
# Yang diperiksa terakhir — keberadaan database aplikasi lain — adalah yang paling
# menentukan. Host yang memuat database tim lain mengubah seluruh aturan main:
# migration di sana menuntut persetujuan pemilik dan backup terkonfirmasi
# (docs/DATABASE.md §4), bukan sekadar `pnpm db:apply`.
set -uo pipefail

TARGET="${1:-}"
PORT="${2:-22}"
if [ -z "$TARGET" ]; then
  echo "pemakaian: $0 user@host [port-ssh]" >&2
  exit 2
fi

echo "▸ preflight $TARGET (port $PORT) — baca saja, tidak mengubah apa pun"
echo

# `BatchMode=yes` supaya skrip gagal cepat alih-alih menggantung meminta password.
ssh -o BatchMode=yes -o ConnectTimeout=8 -p "$PORT" "$TARGET" 'bash -s' <<'REMOTE'
set -uo pipefail
line() { printf '%-26s %s\n' "$1" "$2"; }

echo "── sistem ──"
line "os"        "$( (. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME") || uname -s )"
line "kernel"    "$(uname -r)"
line "arsitektur" "$(uname -m)"
line "cpu"       "$(nproc 2>/dev/null || echo '?') core"
line "ram"       "$(free -h 2>/dev/null | awk '/^Mem:/{print $2" total, "$7" tersedia"}' || echo '?')"
line "disk /"    "$(df -h / 2>/dev/null | awk 'NR==2{print $4" bebas dari "$2" ("$5" terpakai)"}')"

echo
echo "── perkakas yang sudah ada ──"
for t in docker node pnpm git mysql redis-server rabbitmq-server; do
  if command -v "$t" >/dev/null 2>&1; then
    line "$t" "$("$t" --version 2>/dev/null | head -1)"
  else
    line "$t" "— belum ada"
  fi
done
if command -v docker >/dev/null 2>&1; then
  line "docker jalan?" "$(docker info --format '{{.ServerVersion}}' 2>/dev/null || echo 'daemon tidak merespons / butuh izin')"
  line "docker compose"  "$(docker compose version --short 2>/dev/null || echo '— belum ada')"
fi

echo
echo "── port yang sudah dipakai (bentrok dengan SNOUTY?) ──"
for p in 3000 3001 3306 3316 3317 5672 5673 6379 6380; do
  if (command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -q ":$p ") \
     || (command -v netstat >/dev/null 2>&1 && netstat -ltn 2>/dev/null | grep -q ":$p "); then
    line "  :$p" "TERPAKAI"
  fi
done

echo
echo "── apakah ini infrastruktur bersama? ──"
if command -v mysql >/dev/null 2>&1; then
  # Tanpa kredensial: cukup hitung database yang terlihat oleh socket lokal bila ada.
  n=$(mysql -N -B -e "SELECT COUNT(*) FROM information_schema.schemata \
      WHERE schema_name NOT IN ('mysql','information_schema','performance_schema','sys');" 2>/dev/null)
  if [ -n "${n:-}" ]; then
    line "database aplikasi" "$n"
    [ "$n" -gt 1 ] && echo "  ⚠ lebih dari satu database aplikasi — perlakukan sebagai infrastruktur bersama"
  else
    line "database aplikasi" "tidak terbaca tanpa kredensial (itu wajar)"
  fi
else
  line "mysql server" "tidak ada di host ini"
fi
REMOTE

rc=$?
echo
if [ "$rc" -ne 0 ]; then
  echo "✖ tidak bisa terhubung tanpa interaksi (rc=$rc)."
  echo "  Kemungkinan kunci SSH belum terpasang. Uji manual:  ssh -p $PORT $TARGET"
  exit "$rc"
fi
echo "✓ preflight selesai — tidak ada yang diubah di server."
