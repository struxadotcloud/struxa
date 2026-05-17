# syntax=docker/dockerfile:1
# Build context: repo root
# docker build -f apps/watchkeeper/Dockerfile -t struxa-watchkeeper .
FROM oven/bun:1.3.5-alpine
WORKDIR /repo

# Install deps — layer cached until lockfile or any package.json changes
COPY bun.lock package.json ./
COPY apps/watchkeeper/package.json  ./apps/watchkeeper/
COPY apps/web/package.json          ./apps/web/
COPY packages/db/package.json       ./packages/db/
COPY packages/api/package.json      ./packages/api/
COPY packages/auth/package.json     ./packages/auth/
COPY packages/env/package.json      ./packages/env/
COPY packages/ui/package.json       ./packages/ui/
COPY packages/config/package.json   ./packages/config/
RUN bun install --frozen-lockfile

# Copy source after install to maximise cache hits
COPY apps/watchkeeper/src/          ./apps/watchkeeper/src/
COPY apps/watchkeeper/package.json  ./apps/watchkeeper/package.json
COPY packages/db/src/               ./packages/db/src/
COPY packages/db/package.json       ./packages/db/package.json
COPY packages/api/src/              ./packages/api/src/
COPY packages/api/package.json      ./packages/api/package.json
COPY packages/auth/src/             ./packages/auth/src/
COPY packages/auth/package.json     ./packages/auth/package.json
COPY packages/env/src/              ./packages/env/src/
COPY packages/env/package.json      ./packages/env/package.json
COPY package.json                   ./

ENV NODE_ENV=production

CMD ["bun", "run", "apps/watchkeeper/src/index.ts"]
