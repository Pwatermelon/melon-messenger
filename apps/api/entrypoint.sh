#!/bin/sh
set -e
# Ждём PostgreSQL и пробуем миграции (можно падать — при первом запуске БД может быть не готова)
for i in 1 2 3 4 5 6 7 8 9 10; do
  if bun run db:migrate 2>/dev/null; then
    break
  fi
  echo "Waiting for DB... ($i/10)"
  sleep 2
done
exec "$@"
