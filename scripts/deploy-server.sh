#!/usr/bin/env bash
# Pull versioned images from Docker Hub and restart production stack.
set -euo pipefail

DOCKERHUB_USER="plwatermelon"
VERSION="${WM_VERSION:-${WM_IMAGE_TAG:-}}"

if [[ -z "$VERSION" ]]; then
  echo "Set WM_VERSION (e.g. 1.0.0) — same as commit message 'ver 1.0.0'"
  exit 1
fi

COMPOSE="docker compose -f deploy/docker-compose.yml --env-file .env.prod"

if [[ ! -f .env.prod ]]; then
  echo "Missing .env.prod — should be synced from CI secret PROD_ENV_FILE or copied manually."
  exit 1
fi

# Persist deployed version in .env.prod (for manual restarts without CI)
if grep -q '^WM_VERSION=' .env.prod; then
  sed -i "s/^WM_VERSION=.*/WM_VERSION=${VERSION}/" .env.prod
else
  echo "WM_VERSION=${VERSION}" >> .env.prod
fi

export WM_VERSION="${VERSION}"

echo "==> Deploying ver ${VERSION}"
echo "    API: ${DOCKERHUB_USER}/watermelon-messenger-api:${VERSION}"
echo "    Web: ${DOCKERHUB_USER}/watermelon-messenger-web:${VERSION}"

echo "==> Pulling api + web..."
$COMPOSE pull api web

echo "==> Restarting stack..."
$COMPOSE up -d --remove-orphans

DOMAIN="$(grep -E '^WM_DOMAIN=' .env.prod | cut -d= -f2- | tr -d '"' || echo watermelon-messenger.ru)"
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
