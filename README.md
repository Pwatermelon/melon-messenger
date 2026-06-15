# Watermelon Messenger

Real-time мессенджер: личные и групповые чаты, медиа, голосовые. Backend на **Bun**, фронт на **React**, native-заготовки для **iOS/macOS**.

**Авторизация:** только [Yandex ID](https://oauth.yandex.ru/).  
**Безопасность:** TLS/WSS + шифрование сообщений at-rest на сервере (AES-256-GCM), модель как у Telegram/VK — не client-side E2E.

---

## Архитектура

- **API** — Elysia (REST + WebSocket), JWT после Yandex OAuth
- **Фронт** — React, Vite; native — SwiftUI (`apps/native/`)
- **Данные** — PostgreSQL (users, chats), ScyllaDB (messages), Redis (Pub/Sub, presence)
- **Platinum** — подписка для раннего доступа к beta-функциям

---

## Безопасность

| Слой | Механизм |
|------|----------|
| Транспорт | HTTPS / WSS |
| Хранение | `MESSAGE_AT_REST_KEY` — AES-256-GCM для content и metadata в ScyllaDB |
| Auth | Yandex OAuth 2.0 → JWT (30 дней) |

Задайте `MESSAGE_AT_REST_KEY` в production (base64 ≥32 байт).

---

## Yandex OAuth

Единственный способ входа — [Yandex ID](https://oauth.yandex.ru/).

### 1. Создайте приложение OAuth

[oauth.yandex.ru](https://oauth.yandex.ru/) → **Веб-сервисы** (web) + при необходимости **iOS/macOS**.

### 2. Redirect URI и Suggest Hostname

**Веб-сервисы** в [oauth.yandex.ru](https://oauth.yandex.ru/):

| Поле | Dev | Production |
|------|-----|------------|
| **Redirect URI** | `http://localhost:8080/api/auth/yandex/callback` | `https://watermelon-messenger.ru/api/auth/yandex/callback` |
| **Suggest Hostname** | `localhost` | `watermelon-messenger.ru` |

**iOS / macOS** (отдельная платформа):

| Поле | Значение |
|------|----------|
| Redirect URI | `watermelon://oauth/yandex` |

### 2.1. Иконка приложения в Yandex OAuth

Загрузите в [oauth.yandex.ru](https://oauth.yandex.ru/) **квадратную** иконку:

- Файл: `apps/web/public/yandex-oauth-icon.png` (**200×200**, ~40 KB)
- Формат: PNG, **1:1**, без прозрачных полей по краям
- Не используйте исходник 1536×1024 — Яндекс **сплющит** неквадратные картинки

Доступные размеры в репозитории: `icon-32.png` … `icon-512.png`.

### 3. Env

```
YANDEX_CLIENT_ID=...
YANDEX_CLIENT_SECRET=...
YANDEX_REDIRECT_URI=https://watermelon-messenger.ru/api/auth/yandex/callback
YANDEX_NATIVE_REDIRECT_URI=watermelon://oauth/yandex
WEB_URL=https://watermelon-messenger.ru
ADMIN_YANDEX_LOGINS=platinumwatermelon
MESSAGE_AT_REST_KEY=...
```

### 4. API endpoints

| Method | Path | Назначение |
|--------|------|------------|
| GET | `/auth/yandex` | Web: redirect на Yandex (с CSRF `state`) |
| GET | `/auth/yandex/callback` | Web callback → redirect на `/auth/callback?token=` |
| GET | `/auth/yandex?platform=native` | Native: JSON `{ authorizeUrl, state, redirectUri }` |
| POST | `/auth/yandex/exchange` | Native: `{ code, redirect_uri, state? }` → `{ token, user }` |
| GET | `/auth/yandex/config` | Публичная конфигурация OAuth |

### 5. Native (iOS/macOS)

- `WMYandexAuth` — `ASWebAuthenticationSession` → обмен code на JWT
- В Xcode добавьте URL scheme **`watermelon`** (CFBundleURLSchemes) → host `oauth`, path `/yandex`
- См. [apps/native/YANDEX_OAUTH.md](apps/native/YANDEX_OAUTH.md)

---

## Platinum / YooKassa

Для реальной оплаты подписки Platinum (299 ₽/мес по умолчанию):

```
YOOKASSA_SHOP_ID=...
YOOKASSA_SECRET_KEY=...
PLATINUM_PRICE_RUB=299
API_PUBLIC_URL=https://your-domain.com/api   # webhook: /api/payments/webhook/yookassa
```

Без `YOOKASSA_*` API активирует Platinum сразу (dev-режим).

---

## Push-уведомления (Web Push)

Сгенерируйте VAPID-ключи (`npx web-push generate-vapid-keys`) и добавьте:

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

В настройках мессенджера пользователь включает push. Service worker: `/sw.js`.

---

## Мониторинг и бэкапы

- **Health:** `GET /health` — postgres + redis
- **Metrics:** `GET /metrics` — uptime, requests, memory
- **Rate limits:** Redis, 300 req/min глобально, 30/min auth, 20 uploads/min
- **Backup Postgres:** `./scripts/backup-postgres.sh`

---

## CI / CD (релизы)

Workflow: `.github/workflows/release.yml`

**Запускается только** при коммите вида `ver X.Y.Z`:

```bash
git commit -m "ver 1.0.0" && git push origin main
```

Обычные коммиты и PR — **без CI/CD**.

На релизе: unit + build + smoke → Docker Hub → deploy. Playwright только локально (`bun run test:e2e`), на prod не нужен.

**Secrets:** `DOCKERHUB_TOKEN`, `PROD_ENV_FILE`, `DEPLOY_SSH_*`, `DEPLOY_PATH`.

Образы: `plwatermelon/watermelon-messenger-api:X.Y.Z`, `plwatermelon/watermelon-messenger-web:X.Y.Z`.

См. [deploy/DEPLOY.md](deploy/DEPLOY.md).

---

## Запуск

### Docker

```bash
docker compose up -d --build
```

Приложение: **http://localhost:8080** (единственный порт наружу).

Внутри стека: Postgres, Redis, Scylla, **MinIO** (медиа) — без проброса портов, всё через API/nginx.

### Локально (без полного Docker)

```bash
docker compose up -d postgres redis scylla
cd apps/api && bun install && bun run dev   # MEDIA_STORAGE=local в .env
cd apps/web && bun install && bun run dev
```

---

## Структура

```
watermelon-messenger/
├── apps/
│   ├── api/
│   ├── web/
│   └── native/     # iOS + macOS scaffold (SwiftUI)
└── packages/shared/
```

---

## Platinum

Страница `/platinum` — ранний доступ к экспериментальным функциям. Активация через API `POST /auth/subscription/platinum` (beta, бесплатно).
