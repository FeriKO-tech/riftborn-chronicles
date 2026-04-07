# Riftborn Chronicles — Architecture

## Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend rendering | PixiJS v8 | WebGL-accelerated 2D; canvas owned by PixiJS, UI overlays owned by React |
| Frontend UI/state | React 18 + Zustand | React for declarative UI panels; Zustand for flat game state (no Redux boilerplate) |
| Frontend routing | React Router v6 | Standard; file-based routing added in future if needed |
| API client | Axios + interceptors | Transparent JWT refresh; fetch API lacks interceptor hooks |
| Backend framework | NestJS 10 | TypeScript-native DI, modular architecture, decorator-based |
| ORM | Prisma 5 | Type-safe queries, schema-first migrations, excellent TS codegen |
| Primary DB | PostgreSQL 16 | Relational integrity for economy/progression; JSONB for flexible config |
| Cache / ephemeral | Redis 7 | Session cache, leaderboards (sorted sets), rate limiting, pub/sub |
| Auth | JWT (RS256-style HS256 for simplicity) | Stateless scaling; access token 15m + refresh token 7d (httpOnly cookie) |
| Monorepo | pnpm workspaces | Lightweight; no Nx/Turborepo overhead for MVP |
| Local infra | Docker Compose | Reproducible Postgres + Redis without installation |

## Module Map

```
AppModule
├── ConfigModule         (env validation, typed config service)
├── DatabaseModule       (PrismaService — singleton)
├── RedisModule          (RedisService — ioredis singleton)
├── HealthModule         (GET /health — liveness + readiness)
├── AuthModule           (register, login, refresh, logout)
│   ├── AccountsModule   (account CRUD, password hashing)
│   └── JwtStrategy
├── PlayersModule        (player profile, progression load/save)
└── [Future]
    ├── StageModule      (zone progression, boss gates)
    ├── InventoryModule  (equipment, enhancement)
    ├── CompanionModule  (companion acquisition, leveling)
    ├── ArenaModule      (async PvP)
    ├── GuildModule      (guild management, boss, war)
    ├── EventModule      (liveops event engine)
    └── ShopModule       (purchase abstraction)
```

## Auth Flow

```
Register:
  POST /auth/register { email, password, playerName, playerClass }
  → hash password (bcrypt rounds=12)
  → create Account
  → create Player (with default currencies, stageProgress)
  → issue access token + set refresh token cookie
  → return AuthResponseDto

Login:
  POST /auth/login { email, password }
  → verify password hash
  → issue access token + set refresh token cookie
  → return AuthResponseDto

Refresh:
  POST /auth/refresh
  → read refresh token from httpOnly cookie
  → verify hash against DB (RefreshToken table)
  → rotate: revoke old, issue new refresh token cookie
  → return new access token

Logout:
  POST /auth/logout
  → revoke refresh token in DB
  → clear cookie

Protected routes:
  Authorization: Bearer <accessToken>
  → JwtAuthGuard validates, sets req.player
```

## Server-Authoritative Rules

All of the following are **calculated server-side only**:
- Power Score
- Idle/offline gold rewards
- Combat outcomes (damage, drops)
- Gacha pull results
- Currency changes (any +/- to any currency)
- Stage progression gating (boss threshold checks)

The client sends **intents** (actions), never authoritative state.
The server validates, calculates, and persists — then returns the result.

## Redis Usage Policy

| Use case | Key pattern | TTL |
|---|---|---|
| Player session cache | `session:{playerId}` | 15 min |
| Rate limit: auth endpoints | `rl:auth:{ip}` | 60 s |
| Rate limit: general API | `rl:api:{accountId}` | 60 s |
| Online heartbeat | `hb:{playerId}` | 2 min (sliding) |
| Leaderboard (power score) | `lb:ps:{serverId}` | sorted set, no TTL |
| Refresh token blocklist | `rt:revoked:{tokenId}` | until token expiry |

Redis is NOT used for: player progression (Postgres), economy state (Postgres), guild data (Postgres).

## Data Ownership

| Data | Storage | Reason |
|---|---|---|
| Account credentials | PostgreSQL | Durability, ACID |
| Player progression | PostgreSQL | Durability, audit trail |
| Currency balances | PostgreSQL | Financial data, ACID transactions |
| Equipment inventory | PostgreSQL | Durable, relational |
| Guild state | PostgreSQL | Consistent reads |
| Leaderboards | Redis sorted set | O(log N) rank queries |
| Session cache | Redis | Fast read, acceptable loss |
| Online status | Redis | TTL-based, ephemeral |
| Event/liveops config | MongoDB (future) or PostgreSQL JSONB | Flexible schema |
