# Yandex OAuth — Native (iOS / macOS)

## Redirect URI

В [oauth.yandex.ru](https://oauth.yandex.ru/) добавьте:

```
watermelon://oauth/yandex
```

Должен совпадать с `YANDEX_NATIVE_REDIRECT_URI` на API.

## Xcode: URL Scheme

В target iOS/macOS → **Info** → **URL Types**:

| Field | Value |
|-------|-------|
| Identifier | `ru.watermelon.oauth` |
| URL Schemes | `watermelon` |
| Role | Editor |

Или в `Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>watermelon</string>
    </array>
    <key>CFBundleURLName</key>
    <string>ru.watermelon.oauth</string>
  </dict>
</array>
```

## Поток авторизации

1. Пользователь нажимает «Войти через Яндекс ID»
2. `WMYandexAuth` запрашивает `GET /auth/yandex?platform=native&redirect_uri=watermelon://oauth/yandex`
3. Открывается `ASWebAuthenticationSession` с `authorizeUrl`
4. Yandex редиректит на `watermelon://oauth/yandex?code=...&state=...`
5. `POST /auth/yandex/exchange` → JWT + профиль
6. Если `betaApproved === false` — экран ожидания (poll `/auth/me` каждые 5s)

## Env для локальной разработки

```bash
export WM_API_BASE=http://localhost:8080/api
export WM_WS_BASE=ws://localhost:8080/ws
```

## API env

```
YANDEX_CLIENT_ID=...
YANDEX_CLIENT_SECRET=...
YANDEX_NATIVE_REDIRECT_URI=watermelon://oauth/yandex
```
