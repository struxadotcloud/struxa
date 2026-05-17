# syntax=docker/dockerfile:1
# Build context: repo root
# docker build -f apps/web/Dockerfile -t struxa-web .

# ── builder: install + compile (Bun for install, next build via Bun) ─────────
FROM oven/bun:1.3.5-alpine AS builder
WORKDIR /repo

# Install deps — layer cached until lockfile or any package.json changes
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

# Copy source after install to maximise cache hits
COPY apps/web/              ./apps/web/
COPY packages/db/src/       ./packages/db/src/
COPY packages/db/package.json ./packages/db/package.json
COPY packages/api/src/      ./packages/api/src/
COPY packages/api/package.json ./packages/api/package.json
COPY packages/auth/src/     ./packages/auth/src/
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/env/src/      ./packages/env/src/
COPY packages/env/package.json ./packages/env/package.json
COPY packages/ui/src/       ./packages/ui/src/
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/config/       ./packages/config/
COPY package.json tsconfig.json ./

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Prevents @t3-oss/env-core from failing during build without runtime secrets
ENV SKIP_ENV_VALIDATION=1

RUN cd apps/web && bun run build

# ── runner: minimal Node image for standalone Next.js ────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static     ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public           ./apps/web/public

USER nextjs
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
