# syntax=docker/dockerfile:1
# Build context: repo root
# docker build -f packages/db/Dockerfile -t struxa-migrate .
FROM oven/bun:1.3.5-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY bun.lock package.json ./
COPY apps/web/package.json          ./apps/web/
COPY apps/watchkeeper/package.json  ./apps/watchkeeper/
COPY packages/db/package.json       ./packages/db/
COPY packages/api/package.json      ./packages/api/
COPY packages/auth/package.json     ./packages/auth/
COPY packages/env/package.json      ./packages/env/
COPY packages/ui/package.json       ./packages/ui/
COPY packages/config/package.json   ./packages/config/
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.5-alpine AS runner
WORKDIR /repo
COPY --from=deps /repo/node_modules       ./node_modules
COPY packages/db/src/                     ./packages/db/src/
COPY packages/db/package.json             ./packages/db/package.json
COPY packages/env/src/                    ./packages/env/src/
COPY packages/env/package.json            ./packages/env/package.json
COPY package.json                         ./

ENV NODE_ENV=production

CMD ["bun", "run", "packages/db/src/migrate.ts"]
