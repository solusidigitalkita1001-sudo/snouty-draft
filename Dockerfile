# SNOUTY — satu Dockerfile multi-target: `api`, `web`, `worker` (docs/INFRASTRUCTURE.md §5).
#
#   docker build --target api    -t snouty-api    .
#   docker build --target web    -t snouty-web    .
#   docker build --target worker -t snouty-worker .
#
# Satu tahap `build` membangun seluruh workspace pnpm sekali (shared-types, engineering, jobs,
# api, web, worker); tiap target hanya memilih perintah start-nya. Image belum dipangkas ke ukuran
# minimum — prioritasnya deploy pertama yang benar; pemangkasan (pnpm deploy / standalone) menyusul.
# Semua target berjalan sebagai pengguna non-root `node`.

# ── build ────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.25.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
# Data runtime: contoh pemahaman pertanyaan (`data/understanding`, P16-11) dibaca API saat boot.
COPY data ./data
RUN pnpm install --frozen-lockfile
RUN pnpm build:types \
  && pnpm --filter @snouty/api build \
  && pnpm --filter @snouty/worker build \
  && NODE_ENV=production pnpm --filter @snouty/web build

# ── api ──────────────────────────────────────────────────────────────────────
FROM build AS api
ENV NODE_ENV=production
WORKDIR /app/apps/api
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]

# ── web ──────────────────────────────────────────────────────────────────────
FROM build AS web
ENV NODE_ENV=production
WORKDIR /app/apps/web
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["./node_modules/.bin/next", "start", "--port", "3000"]

# ── worker (Chromium untuk PDF) ──────────────────────────────────────────────
FROM build AS worker
ENV NODE_ENV=production
USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*
ENV CHROMIUM_PATH=/usr/bin/chromium
WORKDIR /app/apps/worker
USER node
CMD ["node", "dist/main.js"]
