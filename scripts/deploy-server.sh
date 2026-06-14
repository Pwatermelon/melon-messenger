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

ENV_FILE="${ROOT}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE} — copy deploy/.env.example or sync from GitHub PROD_ENV_FILE"
  exit 1
fi

COMPOSE="docker compose -f deploy/docker-compose.yml --env-file ${ENV_FILE}"
PROJECT="${COMPOSE_PROJECT_NAME:-watermelon-prod}"
CERT_VOL="${PROJECT}_certbot-conf"
DOMAIN="$(grep -E '^WM_DOMAIN=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
DOMAIN="${DOMAIN:-watermelon-messenger.ru}"

cert_exists() {
  docker run --rm -v "${CERT_VOL}:/etc/letsencrypt:ro" alpine \
    test -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" 2>/dev/null
}

pick_nginx_conf() {
  if [[ -n "$(grep -E '^WM_NGINX_CONF=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'")" ]]; then
    grep -E '^WM_NGINX_CONF=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'"
    return
  fi
  if cert_exists; then
    echo "nginx.prod.conf"
  else
    echo "nginx.http.conf"
  fi
}

NGINX_CONF="$(pick_nginx_conf)"
if grep -q '^WM_NGINX_CONF=' "${ENV_FILE}"; then
  sed -i "s/^WM_NGINX_CONF=.*/WM_NGINX_CONF=${NGINX_CONF}/" "${ENV_FILE}"
else
  echo "WM_NGINX_CONF=${NGINX_CONF}" >> "${ENV_FILE}"
fi
export WM_NGINX_CONF="${NGINX_CONF}"

if grep -q '^WM_VERSION=' "${ENV_FILE}"; then
  sed -i "s/^WM_VERSION=.*/WM_VERSION=${VERSION}/" "${ENV_FILE}"
else
  echo "WM_VERSION=${VERSION}" >> "${ENV_FILE}"
fi
export WM_VERSION="${VERSION}"

echo "==> Deploying ver ${VERSION} (nginx: ${NGINX_CONF})"
echo "    API: plwatermelon/watermelon-messenger-api:${VERSION}"
echo "    Web: plwatermelon/watermelon-messenger-web:${VERSION}"

$COMPOSE pull api web
$COMPOSE up -d --remove-orphans

if [[ "${NGINX_CONF}" == "nginx.http.conf" ]]; then
  echo "==> No TLS cert yet — site on http://${DOMAIN}"
  echo "    Run: ./scripts/certbot-init.sh"
fi

echo "==> Waiting for /api/health ..."
for i in $(seq 1 30); do
  if curl -sfk "https://${DOMAIN}/api/health" >/dev/null 2>&1; then
    echo "==> Deploy OK (ver ${VERSION}, HTTPS)"
    exit 0
  fi
  if curl -sf "http://${DOMAIN}/api/health" >/dev/null 2>&1; then
    echo "==> Deploy OK (ver ${VERSION}, HTTP — run certbot-init.sh for HTTPS)"
    exit 0
  fi
  sleep 3
done

echo "==> Stack restarted (health check timed out — check: $COMPOSE logs -f api web)"
$COMPOSE ps
