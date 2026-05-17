# syntax=docker/dockerfile:1
# Build context: repo root
# docker build -f packages/db/Dockerfile -t struxa-migrate .
FROM golang:1.24-alpine AS builder
WORKDIR /app
ENV GOFLAGS=-mod=mod
COPY packages/db/migrate/go.mod ./
RUN go mod download
COPY packages/db/migrate/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o migrate .

FROM gcr.io/distroless/static:nonroot
COPY --from=builder /app/migrate /migrate
COPY packages/db/src/migrations/ /migrations/
ENV MIGRATIONS_DIR=/migrations
ENTRYPOINT ["/migrate"]
