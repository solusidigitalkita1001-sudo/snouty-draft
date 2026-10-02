#!/usr/bin/env bash
# Menjalankan SNOUTY lengkap untuk diuji dengan tangan.
#
# Memakai `SNOUTY_FAKE_AI=1`: ekstraktor deterministik khusus pengembangan, supaya seluruh
# alur bisa diklik tanpa kunci model. Begitu `OPENROUTER_API_KEY` dan ketiga ID model ada,
# adapter sungguhan otomatis menang dan flag ini tidak berpengaruh.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▸ kontainer"
docker compose up -d mysql redis rabbitmq >/dev/null
until docker compose exec -T mysql mysqladmin ping -h localhost --silent 2>/dev/null; do sleep 1; done

export NODE_ENV=development
export SNOUTY_FAKE_AI=1
export PORT=3001
export DB_HOST=127.0.0.1 DB_PORT=3316 DB_DATABASE=snouty DB_USERNAME=root DB_PASSWORD=snouty DB_POOL_MAX=5
export REDIS_URL=redis://127.0.0.1:6380
export RABBITMQ_URL=amqp://guest:guest@127.0.0.1:5673
export JWT_ACCESS_SECRET=contoh-rahasia-pengembangan-32-karakter
export JWT_REFRESH_SECRET=contoh-rahasia-refresh-32-karakter-lagi
export POLICY_VERSION=v0-draft

echo "▸ migration"
(cd apps/api && node scripts/db-apply.mjs >/dev/null)

echo "▸ katalog contoh (bila belum ada versi aktif)"
(cd apps/api && SEED_SAMPLE_CATALOG=1 SAMPLE_LABEL="dev-$(date +%H%M%S)" node scripts/seed-sample-catalog.mjs >/dev/null 2>&1) || true

echo "▸ build"
pnpm build:types >/dev/null
(cd apps/api && ./node_modules/.bin/tsc -p tsconfig.build.json)
(cd apps/web && NEXT_TELEMETRY_DISABLED=1 ./node_modules/.bin/next build >/dev/null)

echo "▸ API di :3001"
(cd apps/api && node -e "
import('@nestjs/core').then(async ({NestFactory}) => {
  const { AppModule } = await import('./dist/app.module.js');
  const { ApiErrorFilter } = await import('./dist/shared/http/api-error.filter.js');
  const app = await NestFactory.create(AppModule, { logger: ['error','warn'] });
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.useGlobalFilters(new ApiErrorFilter());
  await app.listen(process.env.PORT);
  console.log('API siap');
});" &)

until curl -sf -o /dev/null http://127.0.0.1:3001/health; do sleep 1; done

echo "▸ web di :3000"
(cd apps/web && ./node_modules/.bin/next start --port 3000 &)
until curl -sf -o /dev/null http://127.0.0.1:3000/; do sleep 1; done

cat <<'INFO'

  SNOUTY siap diuji — buka http://localhost:3000

  /              onboarding 5 langkah (muncul sekali per sesi tamu)
  /konsultasi    chat → klarifikasi → analisis → solusi → BOM → skema
  /skema         skema penuh (dibuka dari solusi)
  /masuk         masuk        ← menunggu desain
  /daftar        daftar akun  ← menunggu desain
  /internal/*    back-office  ← menunggu desain
  /tokens        galeri token desain

  Coba tulis di /konsultasi:
    "Rumah 2 lantai, 3 kamar mandi, 4 wastafel, 1 dapur, toren di atap, air bersih"
    lalu tekan "Analisis kebutuhan".

  Yang menguji jalur kebijakan:
    "lebih bagus Pralon atau Rucika?"   → kartu kriteria netral, bukan rekomendasi
    "bangun pabrik 2 lantai"            → kartu validasi teknis
    "rumah 2 lantai"                    → kartu klarifikasi bernomor

  Hentikan: pkill -f 'NestFactory|next start'
INFO
