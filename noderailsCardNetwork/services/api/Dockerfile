# syntax=docker/dockerfile:1
# WallCard backend: API + signer-host + BullMQ worker. Postgres / Redis via env outside the image.
#
# Builds use a trimmed workspace (`docker/pnpm-workspace.backend.yaml`) so **`pnpm install` does not resolve
# apps/mobile (Expo), apps/web (Next), etc.** — full lockfile (~960 importer paths) collapses to ~340 packages here.
#
# **`docker compose build` Exit 137** = OOM — add swap on EC2, use a bigger instance, build in CI, or raise RAM.
#
# See <https://pnpm.io/docker>, <https://pnpm.io/filtering>.

FROM node:20-bookworm-slim

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl bash \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Root + turbo + trimmed workspace manifest (avoid installing every app frontend).
COPY package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY docker/pnpm-workspace.backend.yaml ./pnpm-workspace.yaml

# Backend-related workspace projects only (~10 workspaces → ~343 packages instead of ~960).
COPY packages/common ./packages/common
COPY packages/chain ./packages/chain
COPY packages/crypto ./packages/crypto
COPY packages/database ./packages/database
COPY packages/queue ./packages/queue
COPY packages/redis ./packages/redis
COPY packages/service-base ./packages/service-base
COPY services/api ./services/api
COPY services/signer-host ./services/signer-host
COPY services/worker ./services/worker

COPY docker/start-backend-stack.sh ./docker/start-backend-stack.sh
COPY docker/wait-signer-and-start-api.sh ./docker/wait-signer-and-start-api.sh

RUN chmod +x ./docker/start-backend-stack.sh ./docker/wait-signer-and-start-api.sh

ARG BUILD_NODE_HEAP_MB=1024
ARG PNPM_CHILD_CONCURRENCY=1
ARG TURBO_CONCURRENCY=1

ENV TURBO_TELEMETRY_DISABLED=1

# Isolated RUN: install peaks separately from Turbo/TScompile. No BuildKit cache mount here — pnpm
# defaults can hardlink into the global store; a cache volume that disappears after RUN would corrupt later layers.

RUN set -eu; \
  export NODE_OPTIONS="--max-old-space-size=${BUILD_NODE_HEAP_MB}"; \
  export CI=true; \
  pnpm install --frozen-lockfile \
    --child-concurrency="${PNPM_CHILD_CONCURRENCY}" \
    --network-concurrency=1

RUN set -eu; \
  export NODE_OPTIONS="--max-old-space-size=${BUILD_NODE_HEAP_MB}"; \
  pnpm exec turbo run build \
    --concurrency="${TURBO_CONCURRENCY}" \
    --filter=@noderails-card/worker...

RUN set -eu; \
  export NODE_OPTIONS="--max-old-space-size=${BUILD_NODE_HEAP_MB}"; \
  pnpm exec turbo run build \
    --concurrency="${TURBO_CONCURRENCY}" \
    --filter=@noderails-card/signer-host...

RUN set -eu; \
  export NODE_OPTIONS="--max-old-space-size=${BUILD_NODE_HEAP_MB}"; \
  pnpm exec turbo run build \
    --concurrency="${TURBO_CONCURRENCY}" \
    --filter=@noderails-card/api...

ENV NODE_ENV=production
ENV SIGNER_HOST_URL=http://127.0.0.1:8081
ENV SIGNER_HOST_PORT=8081

EXPOSE 9080

CMD ["./docker/start-backend-stack.sh"]
