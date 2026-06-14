#!/usr/bin/env bash
# Copy deploy configs + scripts to production host (manual fallback).
# CI does this automatically on "ver X.Y.Z" releases.
#
# Usage:
#   DEPLOY_HOST=1.2.3.4 DEPLOY_USER=root DEPLOY_PATH=/opt/watermelon-messenger \
#     PROD_ENV_FILE=.env.prod ./scripts/sync-prod-config.sh

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:?set DEPLOY_HOST}"
DEPLOY_USER="${DEPLOY_USER:?set DEPLOY_USER}"
DEPLOY_PATH="${DEPLOY_PATH:?set DEPLOY_PATH}"
PROD_ENV_FILE="${PROD_ENV_FILE:-.env.prod}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_rsa}"
RSYNC_SSH="ssh -i ${SSH_KEY} -o StrictHostKeyChecking=accept-new"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new \
  "${DEPLOY_USER}@${DEPLOY_HOST}" "mkdir -p ${DEPLOY_PATH}/deploy ${DEPLOY_PATH}/scripts"

rsync -avz -e "$RSYNC_SSH" \
  "${ROOT}/deploy/docker-compose.yml" \
  "${ROOT}/deploy/nginx.prod.conf" \
  "${ROOT}/deploy/nginx.bootstrap.conf" \
  "${ROOT}/deploy/.env.prod.example" \
  "${REMOTE}/deploy/"

rsync -avz -e "$RSYNC_SSH" \
  "${ROOT}/scripts/deploy-server.sh" \
  "${ROOT}/scripts/certbot-init.sh" \
  "${ROOT}/scripts/backup-postgres.sh" \
  "${ROOT}/scripts/sync-prod-config.sh" \
  "${REMOTE}/scripts/"

if [[ -f "${PROD_ENV_FILE}" ]]; then
  rsync -avz -e "$RSYNC_SSH" "${PROD_ENV_FILE}" "${REMOTE}/.env.prod"
else
  echo "Warning: ${PROD_ENV_FILE} not found — .env.prod on server not updated"
fi

ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new \
  "${DEPLOY_USER}@${DEPLOY_HOST}" "chmod +x ${DEPLOY_PATH}/scripts/*.sh"

echo "==> Configs synced to ${DEPLOY_PATH}"
