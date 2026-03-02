# Как запустить Melon Messenger

## Вариант 0: Всё в Docker (проще всего)

Из корня проекта:

```bash
cd /Users/platinum_watermelon/Documents/melon-messenger
docker compose up -d --build
```

Подожди 1–2 минуты (сборка, старт ScyllaDB, миграции). Потом открой в браузере:

- **Приложение:** http://localhost:8080  
- **API:** http://localhost:3000  

Остановить: `docker compose down`.

**Тестовые пользователи.** Чтобы завести тестовые аккаунты, выполни сид (один раз):

```bash
docker compose exec api bun run src/db/seed.ts
```

Данные для входа (пароль у всех один: `password123`):

| Email              | Логин   |
|--------------------|--------|
| alice@test.local   | alice  |
| bob@test.local     | bob    |
| charlie@test.local | charlie |

## Вариант 1: Всё через Bun (рекомендуется)

### 1. Установи Bun (если ещё нет)

```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. Подними инфраструктуру (PostgreSQL, Redis, ScyllaDB)

Из корня проекта:

```bash
cd /Users/platinum_watermelon/Documents/melon-messenger
docker compose up -d
```

Подожди 30–40 секунд, пока поднимется ScyllaDB.

### 3. Бэкенд (API)

```bash
cd apps/api
bun install
bun run db:generate    # создать миграции Drizzle
bun run db:migrate     # применить миграции к PostgreSQL
bun run dev
```

Должно появиться: `API + WS on http://localhost:3000`.

### 4. Фронтенд (в другом терминале)

```bash
cd apps/web
bun install
bun run dev
```

Открой в браузере: **http://localhost:5173**

---

## Вариант 2: Запуск API и Web одной командой из корня

После того как один раз выполнил шаги 1–2 и `bun install` в `apps/api` и `apps/web`:

```bash
cd /Users/platinum_watermelon/Documents/melon-messenger
bun install
bun run dev
```

Так запустятся и API, и фронт одновременно.

---

## Если Bun нет: только npm

### Инфраструктура — как выше

```bash
docker compose up -d
```

### API

```bash
cd apps/api
npm install
npx drizzle-kit generate
npx drizzle-kit migrate
npm run dev
```

(Для `npm run dev` в package.json указан `bun run --watch` — замени в `apps/api/package.json` скрипт `dev` на `"dev": "tsx watch src/index.ts"` или установи `tsx` и используй его.)

### Web

```bash
cd apps/web
npm install
npm run dev
```

Открой **http://localhost:5173**.

---

## Проверка

1. Зарегистрируй двух пользователей (в двух вкладках или в режиме инкогнито).
2. В одном аккаунте нажми «New chat», найди второго пользователя и создай чат.
3. Пиши сообщения — они должны приходить в реальном времени.
4. Кнопки в поле ввода: скрепка (файл/фото/видео), геолокация, микрофон (голосовое).

## Порты

| Сервис   | Порт  |
|----------|--------|
| API + WS | 3000   |
| Frontend | 5173   |
| PostgreSQL | 5432 |
| Redis    | 6379   |
| ScyllaDB | 9042   |
