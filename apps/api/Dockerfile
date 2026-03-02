# Контекст сборки: корень репозитория (docker compose build context: .)
FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json ./
COPY packages ./packages
COPY apps/api ./apps/api

WORKDIR /app/apps/api
RUN bun install
# Генерируем миграции (нужны для db:migrate при старте)
RUN bun run db:generate

COPY apps/api/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
# Запуск из исходников (без бандла) — стабильно в Docker
CMD ["bun", "src/index.ts"]
