# Melon Messenger

Real-time messenger: **Bun** (backend) + **React** (frontend), WebSocket, PostgreSQL (users/chats), **ScyllaDB** (messages), Redis (pub/sub + presence). Horizontal scaling via Redis Pub/Sub for WebSocket broadcast.

## Stack

| Layer        | Tech |
|-------------|------|
| Backend     | Bun, Elysia, TypeScript |
| Frontend    | React, Vite, TypeScript |
| Real-time   | WebSocket (Bun native), Redis Pub/Sub |
| Auth        | JWT |
| DB (metadata) | PostgreSQL, Drizzle ORM |
| DB (messages) | ScyllaDB (CQL, cassandra-driver) |
| Cache / bus | Redis (presence, WS broadcast) |

## Features

- Registration / login (JWT)
- 1‑on‑1 (DM) chats
- **E2E encryption (P2P)** — X25519 key agreement + AES-256-GCM for text in DMs when both users have keys; public key stored on server, private in browser
- **Media messages** — photo, file, video (upload to server, link in message)
- **Geolocation** — send current position (OpenStreetMap link)
- **Voice messages** — record in browser (WebM), upload, play in chat
- Real-time messaging over WebSocket
- Message history with pagination (ScyllaDB)
- Typing indicators (WS)
- Presence (online/offline via Redis)
- User search to start a new DM
- Multi-instance ready: Redis Pub/Sub for cross-server WS delivery

## Quick start

### Вариант A: Всё в Docker

Из корня проекта:

```bash
docker compose up -d --build
```

Подожди 1–2 минуты (сборка образов, старт ScyllaDB, миграции). Затем открой в браузере:

- **Фронт:** http://localhost:8080  
- **API:** http://localhost:3000  

Логи: `docker compose logs -f api` и `docker compose logs -f web`.

### Вариант B: Только инфраструктура в Docker, приложения локально

### 1. Start infrastructure

```bash
docker compose up -d postgres redis scylla
```

PostgreSQL (5432), Redis (6379), ScyllaDB (9042) will be up. Wait ~30s for ScyllaDB to be ready.

### 2. Backend (Bun)

```bash
cd apps/api
bun install
bun run db:generate   # generate Drizzle migrations
bun run db:migrate    # run migrations (needs DATABASE_URL)
bun run dev
```

API + WebSocket: `http://localhost:3000`, WS at `ws://localhost:3000/ws`.

Env (optional):

- `DATABASE_URL` — default `postgres://postgres:postgres@localhost:5432/melon`
- `REDIS_URL` — default `redis://localhost:6379`
- `SCYLLA_CONTACT_POINTS` — default `127.0.0.1`
- `SCYLLA_KEYSPACE` — default `melon`
- `JWT_SECRET` — set in production
- `UPLOAD_DIR` — directory for uploads (default: `apps/api/uploads`)

### 3. Frontend

```bash
cd apps/web
bun install   # or npm install
bun run dev   # or npm run dev
```

Open `http://localhost:5173`. For API/WS on another host set:

- `VITE_API_URL` (e.g. `http://localhost:3000`)
- `VITE_WS_URL` (e.g. `ws://localhost:3000`)

## Project layout

```
melon-messenger/
├── apps/
│   ├── api/          # Bun + Elysia, REST + WebSocket
│   │   ├── src/
│   │   │   ├── db/       # Drizzle schema, PG
│   │   │   ├── routes/   # auth, chats, messages
│   │   │   ├── services/ # ScyllaDB, Redis
│   │   │   ├── auth.ts
│   │   │   ├── ws.ts     # WebSocket + Redis pub/sub
│   │   │   └── index.ts
│   │   └── drizzle/
│   └── web/          # React + Vite
│       └── src/
│           ├── context/  # Auth
│           ├── hooks/    # useWebSocket
│           ├── pages/    # Login, Register, Chats, ChatRoom
│           └── api.ts
├── packages/
│   └── shared/       # Shared types (User, Chat, Message, WS types)
├── docker-compose.yml
└── README.md
```

## Architecture (high level)

- **PostgreSQL**: users, chats, chat_members. ACID, Drizzle ORM.
- **ScyllaDB**: messages table with `message_type`, `attachment_url`, `attachment_metadata`, `encrypted` for media and E2E.
- **Redis**:  
  - Pub/Sub: channel `ws:chat:{chatId}` for real-time message broadcast across API instances.  
  - Presence: keys `presence:{userId}` with TTL for online/offline.
- **WebSocket**: First message is `{ type: "auth", token }`. Then `subscribe`/`unsubscribe` by `chatId`, `message` (send), `typing`. Server publishes to Redis on new message; each instance subscribes and calls `server.publish(chat:chatId, payload)` so local WS clients get the message.

## Scripts (root)

- `bun run dev` — run API + Web in parallel (if Bun available)
- `bun run dev:api` / `bun run dev:web` — run separately
- `bun run db:generate` / `bun run db:migrate` / `bun run db:studio` — Drizzle (from `apps/api` or via workspace)

## Scaling

- Run several API instances behind a load balancer (sticky sessions not required).
- Each instance subscribes to Redis `ws:chat:*`; when a message is saved to ScyllaDB, the handler publishes to Redis; every instance receives and pushes to its local WS subscribers for that chat.
- ScyllaDB and Redis are built for high throughput; PostgreSQL handles metadata and membership.
