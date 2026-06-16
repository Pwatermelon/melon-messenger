# Watermelon Native Apps

Заготовка под нативные клиенты iOS и macOS (SwiftUI + shared API layer).

## Структура

```
apps/native/
├── Shared/           # Общий Swift-код (API, модели, auth)
├── iOS/              # iPhone / iPad
└── macOS/            # Mac
```

## API

- REST: `{baseURL}/api` (Docker) или `http://localhost:3000` (dev)
- WebSocket: `{baseURL}/ws`
- Auth: OAuth Yandex → JWT в `Authorization: Bearer`

## Реализовано

- **`WMYandexAuth`** — полноценный Yandex OAuth через `ASWebAuthenticationSession`
- `WatermelonCore`: config, authorize URL, code exchange, `WMSessionStore.loginWithYandex()`
- **iOS**: LoginView с кнопкой Яндекс ID, beta pending, ChatList + WS
- **macOS**: аналогичный flow
- См. [YANDEX_OAUTH.md](YANDEX_OAUTH.md) — URL scheme, redirect URI

## Следующие шаги

1. Создать Xcode workspace с targets iOS + macOS + URL scheme `watermelon`
2. WebSocket realtime (уже есть `WMWebSocket`)
3. TestFlight / App Store
