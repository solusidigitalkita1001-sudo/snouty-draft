# SNOUTY — satu Dockerfile multi-target: `api`, `web`, `worker` (docs/INFRASTRUCTURE.md §5).
#
#   docker build --target api    -t snouty-api    .
#   docker build --target web    -t snouty-web    .
#   docker build --target worker -t snouty-worker .
#
# Disusun supaya cache build bekerja (2026-10-09: setiap rilis ±10 menit, padahal biasanya hanya
# kode API yang berubah):
#   - `deps` hanya menyalin manifest paket → `pnpm install` diulang hanya bila dependensi berubah;
#   - `build-server` (api + worker) dan `build-web` terpisah → ubahan API tidak membangun ulang web;
#   - Chromium dipasang di image dasar sendiri (`chromium`) yang tidak bergantung pada kode, jadi
#     tidak diunduh ulang setiap rilis.
# Semua target berjalan sebagai pengguna non-root `node`.

# ── dasar ────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.25.0 --activate
WORKDIR /app

# ── dependensi: hanya manifest ───────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/config/package.json packages/config/
COPY packages/engineering/package.json packages/engineering/
COPY packages/jobs/package.json packages/jobs/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

# ── build server (api + worker) ──────────────────────────────────────────────
FROM deps AS build-server
COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/worker ./apps/worker
# Data runtime: contoh pemahaman pertanyaan (`data/understanding`, P16-11) dibaca API saat boot.
COPY data/understanding ./data/understanding
# Fakta pengetahuan pipa bersumber (`data/knowledge`, daftar FAQ pemilik 2026-10-09).
COPY data/knowledge ./data/knowledge
RUN pnpm build:types \
  && pnpm --filter @snouty/api build \
  && pnpm --filter @snouty/worker build

# ── build web ────────────────────────────────────────────────────────────────
FROM deps AS build-web
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm build:types && NODE_ENV=production pnpm --filter @snouty/web build

# ── api ──────────────────────────────────────────────────────────────────────
FROM build-server AS api
ENV NODE_ENV=production
WORKDIR /app/apps/api
# Volume cache vektor pemahaman harus bisa ditulis `node` — volume baru mewarisi kepemilikan ini.
RUN mkdir -p /data/understanding-cache /data/storage && chown node:node /data/understanding-cache /data/storage
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]

# ── web ──────────────────────────────────────────────────────────────────────
FROM build-web AS web
ENV NODE_ENV=production
WORKDIR /app/apps/web
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["./node_modules/.bin/next", "start", "--port", "3000"]

# ── Chromium (tanpa kode — di-cache antar rilis) ─────────────────────────────
FROM node:22-bookworm-slim AS chromium
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*
# Volume penyimpanan (PDF laporan) harus bisa ditulis `node` — volume baru mewarisi kepemilikan ini.
RUN mkdir -p /data/storage && chown node:node /data/storage

# ── worker (Chromium untuk PDF) ──────────────────────────────────────────────
FROM chromium AS worker
ENV NODE_ENV=production CHROMIUM_PATH=/usr/bin/chromium
COPY --from=build-server /app /app
WORKDIR /app/apps/worker
USER node
CMD ["node", "dist/main.js"]
