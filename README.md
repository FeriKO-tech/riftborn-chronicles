# Riftborn Chronicles

> *Shatter the Void. Claim Eternity.*

Browser-based anime-fantasy idle/MMORPG. Server-authoritative progression, PixiJS rendering, NestJS backend.

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 20.0.0 |
| pnpm | ≥ 9.0.0 |
| Docker + Docker Compose | latest |

Install pnpm if needed: `npm install -g pnpm`

---

## Quick Start

### 1. Clone and install dependencies

```bash
pnpm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Edit .env — the defaults work for local Docker setup
```

### 3. Start infrastructure (PostgreSQL + Redis)

```bash
pnpm infra:up
# Verify containers are healthy:
docker ps
```

### 4. Run database migrations (Batch B — after schema is added)

```bash
pnpm db:migrate
pnpm db:seed
```

### 5. Start development servers

```bash
# Start both backend + frontend in parallel
pnpm dev

# Or start separately:
pnpm dev:server   # http://localhost:3001/api/v1
pnpm dev:client   # http://localhost:5173
```

### 6. Verify

```bash
# Health check
curl http://localhost:3001/api/v1/health
# Expected: { "status": "ok", "timestamp": "...", "services": {...} }
```

---

## Project Structure

```
riftborn-chronicles/
├── apps/
│   ├── client/          # Vite + React + TypeScript + PixiJS
│   └── server/          # NestJS + Prisma
├── packages/
│   └── shared/          # Shared TypeScript types & DTOs
├── infra/
│   └── docker-compose.yml
├── docs/
│   └── architecture.md
├── .env.example
└── pnpm-workspace.yaml
```

---

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start server + client in parallel |
| `pnpm dev:server` | Start NestJS server only |
| `pnpm dev:client` | Start Vite client only |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | TypeScript check all packages |
| `pnpm infra:up` | Start Docker services |
| `pnpm infra:down` | Stop Docker services |
| `pnpm infra:logs` | Tail Docker service logs |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed development data |
| `pnpm db:studio` | Open Prisma Studio |

---

## Development Ports

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001/api/v1 |
| Health Check | http://localhost:3001/api/v1/health |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| Prisma Studio | http://localhost:5555 |

---

## Implementation Batches

| Batch | Status | Contents |
|---|---|---|
| **A** | ✅ Complete | Monorepo, shared types, NestJS health endpoint, Vite+React+PixiJS shell |
| **B** | 🔜 Next | ConfigModule, PrismaModule, RedisModule, AuthModule (register/login/JWT) |
| **C** | ⏳ Pending | Full Prisma schema, migrations, seed |
| **D** | ⏳ Pending | Frontend auth flow, Zustand store, API client with token refresh |
| **E** | ⏳ Pending | Player state load, offline rewards, progression save/load |
| **F** | ⏳ Pending | Tests, CI/CD, observability |

---

## Architecture Principles

1. **Server-authoritative**: All progression, economy, and reward calculations happen server-side
2. **Modular monolith first**: Clear module boundaries, no premature microservices
3. **Config-driven balance**: All game numbers in DB config — changeable without deploy
4. **Audit trail**: All economy transactions logged
