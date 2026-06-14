# Production deploy — Watermelon Messenger

Домен: **watermelon-messenger.ru**

## Релиз (единственный способ запустить CI/CD)

CI/CD **не** запускается на обычные коммиты. Только при push в `main` с сообщением:

```bash
git commit -m "ver 1.0.0"
git push origin main
```

Формат: `ver MAJOR.MINOR.PATCH` (semver, первая строка коммита).

### Что происходит автоматически

1. Unit-тесты + сборка web + smoke `/health`
2. Docker-образы → Docker Hub с тегом `:X.Y.Z`
3. Rsync конфигов + `.env.prod` на сервер → deploy

Playwright/E2E **не** используются в релизе. `E2E_TEST_SECRET` на prod **не задаётся**.

## GitHub Secrets

| Secret | Назначение |
|--------|------------|
| `DOCKERHUB_TOKEN` | Access token Docker Hub (аккаунт **plwatermelon**) |
| `PROD_ENV_FILE` | **Полное содержимое** `.env.prod` (многострочный) |
| `DEPLOY_SSH_HOST` | IP/хост сервера |
| `DEPLOY_SSH_USER` | SSH-пользователь |
| `DEPLOY_SSH_KEY` | Приватный SSH-ключ |
| `DEPLOY_PATH` | Путь на сервере, напр. `/opt/watermelon-messenger` |

### Как добавить PROD_ENV_FILE

```bash
# локально заполните .env.prod по шаблону
cp deploy/.env.prod.example .env.prod
nano .env.prod

# скопируйте содержимое в GitHub → Settings → Secrets → PROD_ENV_FILE
# (вставьте весь файл целиком)
```

При каждом релизе секрет перезаписывает `.env.prod` на сервере.

## Первичная настройка сервера

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER

# каталог создаётся автоматически при первом деплое из CI
# или вручную:
sudo mkdir -p /opt/watermelon-messenger/{deploy,scripts}
sudo chown $USER:$USER /opt/watermelon-messenger
```

### TLS (Let's Encrypt)

**В `.env.prod` нужен только email** — паролей у certbot нет:

```env
WM_DOMAIN=watermelon-messenger.ru
CERTBOT_EMAIL=you@example.com
```

**Первый сертификат** (один раз на сервере):

```bash
cd /opt/watermelon-messenger
./scripts/certbot-init.sh   # читает WM_DOMAIN и CERTBOT_EMAIL из .env.prod
```

**Продление** — автоматически: контейнер `certbot` в `deploy/docker-compose.yml` каждые 12 часов делает `certbot renew` через webroot. Доп. настройки не нужны.

## Yandex OAuth

| Поле | Значение |
|------|----------|
| Redirect URI | `https://watermelon-messenger.ru/api/auth/yandex/callback` |
| Suggest Hostname | `watermelon-messenger.ru` |

## Ручной депл конфигов (без CI)

```bash
DEPLOY_HOST=your.server DEPLOY_USER=root DEPLOY_PATH=/opt/watermelon-messenger \
  PROD_ENV_FILE=.env.prod ./scripts/sync-prod-config.sh

ssh user@host "cd /opt/watermelon-messenger && WM_VERSION=1.0.0 ./scripts/deploy-server.sh"
```

## Структура на сервере

```
/opt/watermelon-messenger/
├── .env.prod              ← из PROD_ENV_FILE (секреты)
├── deploy/
│   ├── docker-compose.yml
│   ├── nginx.prod.conf
│   └── nginx.bootstrap.conf
└── scripts/
    ├── deploy-server.sh
    └── certbot-init.sh
```

## Rollback

```bash
WM_VERSION=1.0.0 ./scripts/deploy-server.sh   # предыдущая версия
```

## Мониторинг

- `GET https://watermelon-messenger.ru/api/health`
- Cron бэкап: `./scripts/backup-postgres.sh`
