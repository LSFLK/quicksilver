# Quicksilver

A modern React-based email client implementing the Email 2.0 vision.

## The Vision: Email 2.0

Email 2.0 reimagines email as something an order of magnitude more productive and user-friendly than current email systems. The vision integrates:

- **Modern messaging UX**: Conversational UI with threads that can compete with WhatsApp in simplicity
- **Security & Privacy by Design**: Built-in identity, authentication, and privacy features
- **Roles & Groups**: Support for individual users, organizational roles, and temporary assignments
- **Multilingual Support**: Sinhala and Tamil language support with translation
- **Offline-First**: Reliable functionality even with flaky connectivity
- **Smart Organization**: AI-powered categorization beyond folders and labels
- **Integrated Workflows**: First-class support for attachments, calendars, tasks, and forms

See [docs/Email-2.md](docs/Email-2.md) for the complete vision.

## Architecture

Quicksilver is two cooperating pieces in one monorepo:

```
┌──────────────────┐  HTTPS+JWT  ┌──────────────────┐  IMAP/TLS  ┌──────────────┐
│  Frontend        │────────────▶│  Backend         │───────────▶│  Mail server │
│  React + Vite    │             │  Go (chi)        │  SMTP/TLS  │  (any IMAP)  │
│  src/            │             │  server/         │───────────▶│              │
└──────────────────┘             └──────────────────┘            └──────────────┘
```

- **`src/`** — React 19 + TypeScript + MUI, served by Vite.
- **`server/`** — Go HTTP API that brokers IMAP/SMTP. Holds no mail; IMAP is the source of truth. Per-user credentials are kept only in process memory, sealed with AES-GCM.

The frontend speaks to the backend over a JSON API (`/api/v1/*`). The dev Vite server proxies `/api` → `http://localhost:8080` so the browser stays same-origin.

See [`server/README.md`](server/README.md) for the backend in detail.

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite, MUI, React Router 7
- **Backend**: Go 1.23, chi router, go-imap, go-mail, JWT (HS256), AES-GCM session sealing, slog
- **Auth**: Direct IMAP login — no separate Quicksilver account. JWT-only storage in the browser; passwords never touch localStorage.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+ (LTS recommended) + [pnpm](https://pnpm.io/) 10+ (`corepack enable pnpm`)
- [Go](https://go.dev/) 1.23+ (only needed if you're running the backend locally)

### One-time setup

```bash
# Frontend deps
pnpm install

# Backend deps + secrets
cd server
cp .env.example .env
# Generate real secrets (one per line; paste into .env):
#   openssl rand -base64 48     → QUICKSILVER_JWT_SECRET
#   openssl rand -hex 32        → QUICKSILVER_SESSION_SEAL_KEY
$EDITOR .env
go mod download
cd ..

# Optional: frontend env (defaults are usually fine in dev)
cp .env.example .env
```

### Run both stacks

Open two terminals:

```bash
# Terminal 1 — backend on :8080
cd server && make run

# Terminal 2 — frontend on :3000, proxies /api → :8080
pnpm run dev
```

Then open **http://localhost:3000/quicksilver/** in your browser.

### Available scripts

| Command             | Stack    | Description                                                |
| ------------------- | -------- | ---------------------------------------------------------- |
| `pnpm run dev`       | frontend | Vite dev server (http://localhost:3000/quicksilver/, HMR)        |
| `pnpm start`         | frontend | Alias for `pnpm run dev`                                    |
| `pnpm run build`     | frontend | Production bundle → `build/`                               |
| `pnpm run preview`   | frontend | Preview the production build locally                       |
| `pnpm run typecheck` | frontend | `tsc --noEmit` (does not block `build`)                    |
| `make run`          | backend  | `go run ./cmd/server` (run from `server/`)                 |
| `make build`        | backend  | Build → `server/bin/quicksilver-server`                          |
| `make test`         | backend  | `go test ./...`                                            |
| `make test-race`    | backend  | Same, with the race detector                               |
| `make docker`       | backend  | Multi-stage distroless image                               |

### Environment variables

| Var (frontend `.env`)    | Default                  | Purpose                                                       |
| ------------------------ | ------------------------ | ------------------------------------------------------------- |
| `VITE_API_BASE_URL`      | `""` (same-origin proxy) | Absolute backend URL for prod builds                          |
| `VITE_API_PROXY_TARGET`  | `http://localhost:8080`  | Where Vite dev proxies `/api`                                 |

Backend vars live in `server/.env` and are documented in [`server/.env.example`](server/.env.example).

## Development Roadmap

### Milestone 1: Foundation & Core UI

**Goal**: Basic email client functionality with modern UX

- React application setup and architecture
- Authentication and connection to Silver server
- Inbox view with email list
- Conversational UI for reading emails and threads
- Basic compose and send functionality
- Responsive design for mobile and desktop
- Security by design: encrypted connections

**Deliverable**: A working email client that can read, compose, and send emails with a WhatsApp-like conversational interface.

### Milestone 2: Enhanced Features & Roles

**Goal**: User roles, offline support, and multilingual capabilities

- User roles and groups management
- Offline access and sync capabilities
- Sinhala and Tamil language support with basic translation
- Dependable search functionality
- Read receipts and typing indicators
- Draft auto-save
- Settings and preferences management

**Deliverable**: A production-ready email client with role-based features and offline capabilities.

### Milestone 3: Integrated Productivity

**Goal**: First-class support for attachments, calendars, tasks, and forms

- Advanced attachment handling (preview, inline display, versioning)
- Integrated calendar view and management
- Task management within email threads
- Forms creation and submission
- Custom workflows and automation rules
- Document authentication and signing
- Scheduled emails and un-send functionality

**Deliverable**: A comprehensive productivity platform built on email infrastructure.

### Milestone 4: Intelligence & Analytics

**Goal**: AI-powered features and advanced capabilities

- AI-powered email categorization and tagging
- Smart summaries of email threads
- Email-to-email agent workflows
- Analytics on email use and productivity
- Collaboration on documents
- TTL (Time-to-Live) for emails with validity periods
- Expectations management for response times

**Deliverable**: An intelligent email system that enhances productivity through AI and automation.
