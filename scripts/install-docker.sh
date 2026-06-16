#!/usr/bin/env bash
# Docker Engine + compose v2 on Ubuntu (incl. 20.04 focal).
# Run on the server: curl -fsSL ... | bash   OR   ./scripts/install-docker.sh
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

echo "==> Installing Docker..."

$SUDO apt-get update -qq
$SUDO apt-get install -y ca-certificates curl gnupg

$SUDO install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg
$SUDO chmod a+r /etc/apt/keyrings/docker.gpg

. /etc/os-release
ARCH="$(dpkg --print-architecture)"
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  | $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null

$SUDO apt-get update -qq

# Explicit list — без docker-model-plugin (ломает get.docker.com на focal)
$SUDO apt-get install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-compose-plugin \
  docker-buildx-plugin

$SUDO systemctl enable --now docker

DEPLOY_USER="${SUDO_USER:-ubuntu}"
if id "${DEPLOY_USER}" &>/dev/null; then
  $SUDO usermod -aG docker "${DEPLOY_USER}"
  echo "==> User ${DEPLOY_USER} added to group docker (re-login or: newgrp docker)"
fi

echo "==> Versions:"
docker --version
docker compose version
echo "==> Done."
