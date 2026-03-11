# Melon Messenger

Real-time мессенджер: личные и групповые чаты, медиа, голосовые, E2E-шифрование. Backend на **Bun**, фронт на **React**, доставка сообщений через WebSocket и Redis Pub/Sub.

---

## Архитектура

**Слои**

- **API** — Elysia (REST + WebSocket), JWT, загрузка файлов. Один инстанс обслуживает HTTP и WS; несколько инстансов за балансировщиком делят подписчиков по чатам.
- **Фронт** — React, Vite, один глобальный WebSocket, контексты Auth/Theme/WS.
- **Данные** — PostgreSQL (пользователи, чаты, участники) через Drizzle; **ScyllaDB** — лента сообщений (append-only, по времени); **Redis** — Pub/Sub для рассылки по чатам и presence (online/offline).

**Поток сообщения**

Клиент шлёт `message` по WebSocket → API пишет в ScyllaDB и публикует в Redis `ws:chat:{chatId}` → все API-инстансы, подписанные на этот канал, отдают payload своим WS-клиентам этого чата. Липкие сессии не нужны.

**Масштабирование**

Несколько API за LB; каждый подписан на Redis Pub/Sub. PostgreSQL — метаданные, ScyllaDB и Redis — высокая пропускная способность.

---

## Структура репозитория

```
melon-messenger/
├── apps/
│   ├── api/          # Elysia, routes (auth, chats, upload), ws.ts, Scylla/Redis
│   └── web/          # React, Vite, context, pages, api.ts
├── packages/
│   └── shared/       # Общие типы (User, Chat, Message, WS-события)
└── docker-compose.yml
```

---

## Возможности

- Регистрация/логин (JWT), профиль (аватар, имя), смена темы.
- Личные и групповые чаты; создание по ID пользователя; управление участниками (добавление/удаление для админа).
- Текст, фото (сжатие), файлы, видео, геолокация, голосовые сообщения.
- E2E-шифрование (X25519 + AES-256-GCM), опционально шифрование at rest в ScyllaDB.
- Real-time: сообщения, набор текста, присутствие. История с пагинацией (ScyllaDB).

---

## Запуск

### Всё в Docker

Из корня:

```bash
docker compose up -d --build
```

Через 1–2 минуты: приложение — **http://localhost:8080**, API — **http://localhost:3000**.

Тестовые пользователи (пароль `password123`):

```bash
docker compose exec api bun run src/db/seed.ts
```

| Email              |
|--------------------|
| alice@test.local   |
| bob@test.local     |
| charlie@test.local |

Остановка: `docker compose down`.

---

### Локально (Bun)

1. **Инфраструктура:** `docker compose up -d` (PostgreSQL, Redis, ScyllaDB). Подождать ~30 с.

2. **API:**
   ```bash
   cd apps/api && bun install && bun run db:generate && bun run db:migrate && bun run dev
   ```
   API и WS: **http://localhost:3000**, **ws://localhost:3000/ws**.

3. **Фронт** (в другом терминале):
   ```bash
   cd apps/web && bun install && bun run dev
   ```
   Открыть **http://localhost:5173**.

Либо из корня одной командой: `bun run dev` (API + web параллельно).

---

### Порты

| Сервис    | Порт  |
|-----------|-------|
| API + WS  | 3000  |
| Frontend  | 5173 (dev) / 8080 (Docker) |
| PostgreSQL| 5432  |
| Redis     | 6379  |
| ScyllaDB  | 9042  |
