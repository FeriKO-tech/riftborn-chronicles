# Riftborn Chronicles

> *Shatter the Void. Claim Eternity.*

Browser-based anime-fantasy idle/MMORPG built on a fully server-authoritative foundation. pnpm monorepo · NestJS + Prisma · Vite + React + PixiJS · PostgreSQL + Redis.

---

## Quick Start

```bash
# 1. Install (requires Node ≥ 20, pnpm ≥ 9, Docker Desktop)
pnpm install

# 2. Environment variables
cp .env.example .env        # defaults work for local Docker

# 3. Start infrastructure
pnpm infra:up               # PostgreSQL + Redis containers

# 4. Database (first time only)
pnpm db:migrate             # apply Prisma schema
pnpm db:seed                # create dev account

# 5. Run
pnpm dev                    # server :3001 + client :5173
```

**Dev credentials (after seed):** `dev@riftborn.dev` / `DevPass123!`

### Verify

```bash
curl http://localhost:3001/api/v1/health
# → { "success": true, "data": { "status": "ok", "services": { "database": "ok", "redis": "ok" } } }
```

---

## Project Structure

```
riftborn-chronicles/
├── apps/
│   ├── client/              Vite + React + PixiJS frontend
│   │   └── src/
│   │       ├── api/         Axios API clients
│   │       ├── components/  RequireAuth, LoadingScreen, OfflineRewardsModal
│   │       ├── pages/       LoginPage, RegisterPage, GamePage
│   │       ├── store/       Zustand: auth.store, player.store
│   │       └── game/        PixiJS hook
│   └── server/              NestJS backend
│       ├── prisma/          Schema, migrations, seed
│       └── src/
│           ├── auth/        JWT register/login/refresh/logout
│           ├── accounts/    Account CRUD + password hashing
│           ├── players/     Player state, offline rewards, heartbeat
│           ├── stages/      Zone catalogue + room progression
│           ├── config/      AppConfigService
│           ├── database/    PrismaService
│           ├── redis/       RedisService (ioredis)
│           ├── health/      Health endpoint
│           └── common/      Guards, decorators, interceptors, filters
├── packages/
│   └── shared/              TypeScript types & DTOs (built to dist/)
├── infra/
│   └── docker-compose.yml   PostgreSQL + Redis
└── .github/workflows/ci.yml  TypeScript + test CI
```

---

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/health` | Public | DB + Redis liveness |
| `POST` | `/api/v1/auth/register` | Public | Create account + player |
| `POST` | `/api/v1/auth/login` | Public | Login, set refresh cookie |
| `POST` | `/api/v1/auth/refresh` | Cookie | Rotate refresh token |
| `POST` | `/api/v1/auth/logout` | JWT | Revoke session |
| `GET` | `/api/v1/auth/me` | JWT | Full player state |
| `GET` | `/api/v1/players/me` | JWT | Player state |
| `GET` | `/api/v1/players/me/offline-rewards` | JWT | Preview idle gold |
| `POST` | `/api/v1/players/me/offline-rewards/claim` | JWT | Claim + persist |
| `POST` | `/api/v1/players/me/heartbeat` | JWT | Update last-seen |
| `GET` | `/api/v1/players/me/battles` | JWT | Last 20 battle logs |
| `GET` | `/api/v1/players/me/stats` | JWT | Current combat stats |
| `GET` | `/api/v1/stages/zones` | Public | List all 100 zones |
| `GET` | `/api/v1/stages/zones/:zone` | Public | Zone + room details |
| `GET` | `/api/v1/stages/me/progress` | JWT | Player stage progress |
| `POST` | `/api/v1/stages/me/advance` | JWT | Simulate battle, earn rewards + drop |
| `GET` | `/api/v1/inventory` | JWT | List inventory items |
| `POST` | `/api/v1/inventory/equip/:itemId` | JWT | Equip item |
| `DELETE` | `/api/v1/inventory/equip/:itemId` | JWT | Unequip item |

---

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start server + client in parallel |
| `pnpm dev:server` | Build shared then start NestJS watch |
| `pnpm dev:client` | Start Vite dev server |
| `pnpm build` | Build all packages |
| `pnpm build:shared` | Build `@riftborn/shared` to `dist/` |
| `pnpm typecheck` | `tsc --noEmit` across all packages |
| `pnpm test` | Run server unit tests (Jest) |
| `pnpm test:ci` | Run with coverage report |
| `pnpm infra:up` | Start Docker services |
| `pnpm infra:down` | Stop Docker services |
| `pnpm infra:logs` | Tail Docker service logs |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed dev account (resets DB) |
| `pnpm db:studio` | Open Prisma Studio |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | NestJS 10, Prisma 5, PostgreSQL 16, Redis 7, ioredis |
| **Auth** | JWT (access 15m + refresh 7d httpOnly cookie), bcrypt |
| **Frontend** | Vite 5, React 18, PixiJS 8, Zustand, Axios |
| **Types** | TypeScript strict, shared DTOs across client + server |
| **Testing** | Jest, `@nestjs/testing`, ts-jest — 31 unit tests |
| **CI** | GitHub Actions — typecheck + test on PR |
| **Infra** | Docker Compose, pnpm workspaces |

---

## Architecture Principles

1. **Server-authoritative** — all progression math and economy happens server-side
2. **Modular monolith** — clear module boundaries; no premature microservices
3. **Offline rewards capped at 8h** — `floor(500 × level^1.4 × hours)` gold
4. **Refresh token rotation** — old token revoked on every refresh, hash stored in DB
5. **Global guard + `@Public()`** — every route is JWT-protected by default; opt-out with decorator
