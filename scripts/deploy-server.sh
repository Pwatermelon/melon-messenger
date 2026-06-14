#!/usr/bin/env bash
# Pull versioned images from Docker Hub and restart production stack.
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found. Run: bash scripts/install-docker.sh"
  exit 127
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose plugin not found."
  exit 127
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

VERSION="${WM_VERSION:-${WM_IMAGE_TAG:-}}"
if [[ -z "$VERSION" ]]; then
  echo "Set WM_VERSION (e.g. 1.0.0) — same as commit message 'ver 1.0.0'"
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Missing ${ROOT}/.env — copy deploy/.env.example or sync from GitHub PROD_ENV_FILE"
  exit 1
fi

# docker compose сам читает .env из текущей директории
COMPOSE="docker compose -f deploy/docker-compose.yml"

if grep -q '^WM_VERSION=' .env; then
  sed -i "s/^WM_VERSION=.*/WM_VERSION=${VERSION}/" .env
else
  echo "WM_VERSION=${VERSION}" >> .env
fi

export WM_VERSION="${VERSION}"

echo "==> Deploying ver ${VERSION}"
echo "    API: plwatermelon/watermelon-messenger-api:${VERSION}"
echo "    Web: plwatermelon/watermelon-messenger-web:${VERSION}"

$COMPOSE pull api web
$COMPOSE up -d --remove-orphans

DOMAIN="$(grep -E '^WM_DOMAIN=' .env | cut -d= -f2- | tr -d '"' || echo watermelon-messenger.ru)"
echo "==> Waiting for https://${DOMAIN}/api/health ..."
for i in $(seq 1 30); do
  if curl -sfk "https://${DOMAIN}/api/health" >/dev/null 2>&1; then
    echo "==> Deploy OK (ver ${VERSION})"
    exit 0
  fi
  sleep 3
done

echo "==> Stack restarted (health check timed out — check: $COMPOSE logs -f api web)"
$COMPOSE ps
