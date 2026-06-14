# Quicksilver Server

Go backend that fronts arbitrary email providers via **IMAP** (read) and **SMTP** (send), exposing a JSON API consumed by the Quicksilver frontend.

The server holds **no mail in its own storage** — IMAP is the source of truth. Per-user credentials are kept in process memory only, sealed with AES-GCM, and dropped when the session expires.

## Quick start

```bash
cp .env.example .env
# Generate real secrets:
#   openssl rand -base64 48          # → QUICKSILVER_JWT_SECRET
#   openssl rand -hex 32             # → QUICKSILVER_SESSION_SEAL_KEY
$EDITOR .env

go mod tidy
make run
```

Smoke test:

```bash
curl -s http://localhost:8080/healthz
curl -s http://localhost:8080/readyz
```

## Layout

```
cmd/server/main.go        entrypoint, graceful shutdown
internal/
  config/                 env-driven config (QUICKSILVER_* vars)
  log/                    slog setup, credential redaction
  http/
    router.go             chi router
    errors.go             uniform API error envelope
    handlers/             HTTP handlers
    middleware/           request ID, recover, security headers, CORS, access log
  auth/                   (Phase 2) JWT
  session/                (Phase 2) in-memory session store
  imap/                   (Phase 3) IMAP client wrapper
  smtp/                   (Phase 4) SMTP client wrapper
  mail/                   shared DTOs
```

## API (current)

| Method | Path        | Auth | Purpose                |
|-------:|-------------|------|------------------------|
| GET    | `/healthz`  | none | Liveness probe         |
| GET    | `/readyz`   | none | Readiness probe        |

Mail and auth endpoints land in subsequent phases. See repo root design docs for the full spec.

## Make targets

| Target          | What it does                          |
|-----------------|---------------------------------------|
| `make build`    | Compile to `bin/quicksilver-server`         |
| `make run`      | `go run ./cmd/server`                 |
| `make test`     | `go test ./...`                       |
| `make test-race`| Same with `-race -count=1`            |
| `make vet`      | `go vet ./...`                        |
| `make fmt`      | `gofmt -s -w .`                       |
| `make lint`     | `golangci-lint run` if installed      |
| `make tidy`     | `go mod tidy`                         |
| `make docker`   | Build distroless image                |

## Production notes

- **No defaults for secrets.** `QUICKSILVER_JWT_SECRET` and `QUICKSILVER_SESSION_SEAL_KEY` are required; the process refuses to start without them.
- **Run behind TLS.** Either supply `QUICKSILVER_TLS_CERT`/`QUICKSILVER_TLS_KEY` or terminate TLS at a proxy/load balancer.
- **Restrict CORS.** Set `QUICKSILVER_ALLOWED_ORIGINS` to the deployed frontend origin(s); wildcards are deliberately not supported.
- **Single-instance sessions.** v1 stores sessions in process memory. To scale horizontally, run behind a sticky load balancer or migrate the session store to Redis.
- **Image is distroless non-root** with a stripped, static binary.
