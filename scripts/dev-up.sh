#!/usr/bin/env bash
# Menjalankan SNOUTY lengkap untuk diuji dengan tangan.
#
# Memakai `SNOUTY_FAKE_AI=1`: ekstraktor deterministik khusus pengembangan, supaya seluruh
# alur bisa diklik tanpa kunci model. Begitu `OPENROUTER_API_KEY` dan ketiga ID model ada,
# adapter sungguhan otomatis menang dan flag ini tidak berpengaruh.
set -euo pipefail
cd "$(dirname "$0")/.."

# Hentikan server lama LEBIH DULU, sebelum build.
#
# `next build` yang berjalan sementara `next start` lama masih memegang `.next` bisa
# menghasilkan build setengah jadi — gejalanya galat prerender `/_global-error` yang
# membingungkan karena tidak menyebut berkas mana pun. Setelah itu skrip berhenti di
# `set -e` dan API tidak pernah naik, sehingga yang terlihat pengguna hanya 500 dari
# proxy. Itu sudah terjadi sekali.
echo "▸ menghentikan server lama"
# `next start` bercabang menjadi proses bernama `next-server`, jadi pola 'next start'
# melewatkan yang sebenarnya memegang port — dan akibatnya build lama tetap disajikan.
pkill -f 'next-server' 2>/dev/null || true
pkill -f 'next start' 2>/dev/null || true
pkill -f 'NestFactory' 2>/dev/null || true

# Menunggu port BENAR-BENAR lepas, bukan hanya mengirim sinyal. `pkill` lalu langsung
# start menghasilkan EADDRINUSE, dan akibatnya server LAMA tetap menyajikan build lama —
# gejalanya perubahan yang tidak muncul dan 404 di rute baru. Itu sudah terjadi dua kali.
for port in 3000 3001; do
  for _ in $(seq 1 20); do
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 || break
    sleep 0.5
  done
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "✖ port $port masih terpakai. Hentikan prosesnya lalu jalankan ulang." >&2
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >&2
    exit 1
  fi
done

echo "▸ kontainer"
docker compose up -d mysql redis rabbitmq >/dev/null
until docker compose exec -T mysql mysqladmin ping -h localhost --silent 2>/dev/null; do sleep 1; done

# `NODE_ENV` sengaja TIDAK di-export global: API perlu `development` (supaya adapter AI
# pengembangan aktif), sementara `next build` dan `next start` perlu `production` — nilai
# development membuat build gagal prerender dan membuat `next start` memperingatkan
# konfigurasi non-standar. Masing-masing proses mendapat nilainya sendiri di bawah.
export SNOUTY_FAKE_AI=1
export PORT=3001
export DB_HOST=127.0.0.1 DB_PORT=3316 DB_DATABASE=snouty DB_USERNAME=root DB_PASSWORD=snouty DB_POOL_MAX=5
export REDIS_URL=redis://127.0.0.1:6380
export RABBITMQ_URL=amqp://guest:guest@127.0.0.1:5673
export JWT_ACCESS_SECRET=contoh-rahasia-pengembangan-32-karakter
export JWT_REFRESH_SECRET=contoh-rahasia-refresh-32-karakter-lagi
export POLICY_VERSION=v0-draft

echo "▸ migration"
(cd apps/api && NODE_ENV=development node scripts/db-apply.mjs >/dev/null)

echo "▸ katalog contoh (bila belum ada versi aktif)"
(cd apps/api && NODE_ENV=development SEED_SAMPLE_CATALOG=1 SAMPLE_LABEL="dev-$(date +%H%M%S)" node scripts/seed-sample-catalog.mjs >/dev/null 2>&1) || true

echo "▸ build"
pnpm build:types >/dev/null
(cd apps/api && ./node_modules/.bin/tsc -p tsconfig.build.json)

# `next build` WAJIB berjalan dengan NODE_ENV=production.
#
# Dengan `NODE_ENV=development` — yang di-export di atas untuk server — build gagal saat
# prerender `/_global-error` dengan "Cannot read properties of null (reading 'useContext')",
# galat yang tidak menyebut satu pun berkas kita dan karena itu sangat menyesatkan. React
# dalam mode development tidak bisa diprerender oleh jalur build produksi Next.
#
# Hanya langkah build yang diubah; server tetap berjalan sebagai development, yang memang
# diperlukan supaya adapter AI pengembangan aktif.
(cd apps/web && NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 ./node_modules/.bin/next build >/dev/null)

echo "▸ API di :3001"
(cd apps/api && NODE_ENV=development node -e "
import('@nestjs/core').then(async ({NestFactory}) => {
  const { AppModule } = await import('./dist/app.module.js');
  const { ApiErrorFilter } = await import('./dist/shared/http/api-error.filter.js');
  const app = await NestFactory.create(AppModule, { logger: ['error','warn'] });
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.useGlobalFilters(new ApiErrorFilter());
  await app.listen(process.env.PORT);
  console.log('API siap');
});" &)

tries=0
until curl -sf -o /dev/null http://127.0.0.1:3001/health; do
  tries=$((tries + 1))
  if [ "$tries" -gt 40 ]; then
    echo "✖ API tidak merespons di :3001 setelah 40 detik." >&2
    echo "  Jalankan tanpa nohup untuk melihat galatnya, atau cek port 3001 sudah terpakai." >&2
    exit 1
  fi
  sleep 1
done

echo "▸ web di :3000"
(cd apps/web && NODE_ENV=production ./node_modules/.bin/next start --port 3000 &)
until curl -sf -o /dev/null http://127.0.0.1:3000/; do sleep 1; done

cat <<'INFO'

  SNOUTY siap diuji — buka http://localhost:3000

  /              onboarding 5 langkah (muncul sekali per sesi tamu)
  /consultation    chat → klarifikasi → analisis → solusi → BOM → skema
  /schematic         skema penuh (dibuka dari solusi)
  /login         masuk        ← menunggu desain
  /register        daftar akun  ← menunggu desain
  /internal/*    back-office  ← menunggu desain
  /tokens        galeri token desain

  Coba tulis di /consultation:
    "Rumah 2 lantai, 3 kamar mandi, 4 wastafel, 1 dapur, toren di atap, air bersih"
    lalu tekan "Analisis kebutuhan".

  Yang menguji jalur kebijakan:
    "lebih bagus Pralon atau Rucika?"   → kartu kriteria netral, bukan rekomendasi
    "bangun pabrik 2 lantai"            → kartu validasi teknis
    "rumah 2 lantai"                    → kartu klarifikasi bernomor

  Hentikan: pkill -f 'NestFactory|next-server'
INFO
