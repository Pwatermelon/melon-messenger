#!/usr/bin/env bash
# Postgres backup for Watermelon Messenger
set -euo pipefail

OUT_DIR="${1:-./backups}"
TS=$(date +%Y%m%d_%H%M%S)
FILE="$OUT_DIR/watermelon_${TS}.sql.gz"

DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/melon}"

mkdir -p "$OUT_DIR"
echo "Backing up to $FILE ..."
pg_dump "$DATABASE_URL" | gzip > "$FILE"
echo "Done: $FILE ($(du -h "$FILE" | cut -f1))"
