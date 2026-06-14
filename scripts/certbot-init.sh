#!/usr/bin/env bash
# Let's Encrypt: apex + www. Reads WM_DOMAIN, CERTBOT_EMAIL from .env.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-${ROOT}/.env}"
cd "${ROOT}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}"
  exit 1
fi

DOMAIN="$(grep -E '^WM_DOMAIN=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'")"
DOMAIN="${DOMAIN:-watermelon-messenger.ru}"
EMAIL="$(grep -E '^CERTBOT_EMAIL=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'")"

if [[ -z "${EMAIL}" || "${EMAIL}" == "you@example.com" ]]; then
  echo "Set CERTBOT_EMAIL=your@email.com in ${ENV_FILE}"
  exit 1
fi

COMPOSE="docker compose -f deploy/docker-compose.yml --env-file ${ENV_FILE}"
PROJECT="${COMPOSE_PROJECT_NAME:-watermelon-prod}"
CERT_VOL="${PROJECT}_certbot-conf"

cert_exists() {
  docker run --rm -v "${CERT_VOL}:/etc/letsencrypt:ro" alpine \
    test -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
}

set_nginx_conf() {
  local conf="$1"
  if grep -q '^WM_NGINX_CONF=' "${ENV_FILE}"; then
    sed -i "s/^WM_NGINX_CONF=.*/WM_NGINX_CONF=${conf}/" "${ENV_FILE}"
  else
    echo "WM_NGINX_CONF=${conf}" >> "${ENV_FILE}"
  fi
  export WM_NGINX_CONF="${conf}"
}

echo "==> Domain: ${DOMAIN} + www.${DOMAIN}"
echo "==> Starting stack (HTTP mode for ACME)..."
set_nginx_conf "nginx.http.conf"
$COMPOSE up -d

echo "==> Requesting certificate (webroot)..."
$COMPOSE run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d "${DOMAIN}" \
  -d "www.${DOMAIN}" \
  --email "${EMAIL}" \
  --agree-tos \
  --no-eff-email \
  --non-interactive \
  ${FORCE_RENEW:+--force-renewal}

if ! cert_exists; then
  echo "ERROR: Certificate not found after certbot. Check DNS A-records for ${DOMAIN} and www.${DOMAIN}"
  exit 1
fi

echo "==> Enabling HTTPS (nginx.prod.conf)..."
set_nginx_conf "nginx.prod.conf"
$COMPOSE up -d --force-recreate web

echo "==> Reload nginx..."
docker compose -f deploy/docker-compose.yml --env-file "${ENV_FILE}" exec web nginx -s reload 2>/dev/null || true

echo "==> Done."
echo "    https://${DOMAIN}"
echo "    https://www.${DOMAIN} → redirects to apex"
