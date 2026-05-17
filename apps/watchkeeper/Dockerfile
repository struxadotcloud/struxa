# syntax=docker/dockerfile:1
# Build context: repo root
# docker build -f apps/watchkeeper/Dockerfile -t struxa-watchkeeper .
FROM golang:1.24-alpine AS builder
WORKDIR /app
ENV GOFLAGS=-mod=mod
COPY apps/watchkeeper/go.mod ./
RUN go mod download
COPY apps/watchkeeper/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o watchkeeper .

FROM gcr.io/distroless/static:nonroot
COPY --from=builder /app/watchkeeper /watchkeeper
ENTRYPOINT ["/watchkeeper"]
