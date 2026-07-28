# Production-oriented image for the API (and a second container for the worker).
# Expects managed Postgres (with pgvector), Redis, and S3 — not the Compose
# MinIO/dev defaults. Set NODE_ENV=production and real env vars at runtime.
#
# Build from repo root:
#   docker build -t canvas-api .
# Run API:
#   docker run --env-file .env.prod -p 3001:3001 canvas-api
# Run worker (same image, different command):
#   docker run --env-file .env.prod canvas-api pnpm start:worker
#
# Serve apps/web `pnpm --filter @canvas/web build` dist behind the same
# origin reverse-proxy that forwards /trpc /auth /uploads /ws /api/v1 etc.

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/e2e/package.json apps/e2e/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

FROM deps AS app
COPY . .
RUN pnpm --filter @canvas/api build
ENV NODE_ENV=production
EXPOSE 3001
# Migrate against the target DATABASE_URL before first traffic:
#   docker run --env-file .env.prod canvas-api pnpm db:migrate
CMD ["pnpm", "start:api"]
