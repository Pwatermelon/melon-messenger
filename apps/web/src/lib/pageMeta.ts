export type PageMeta = {
  title: string;
  description: string;
  robots?: string;
};

export const DEFAULT_PAGE_META: PageMeta = {
  title: "Watermelon Messenger",
  description:
    "Watermelon Messenger — self-hosted мессенджер с личными и групповыми чатами, медиа и голосовыми сообщениями. Вход через Яндекс ID.",
};

const NOINDEX = "noindex, nofollow";

/** Публичные страницы с уникальными title/description для поисковиков. */
export function getPageMeta(pathname: string): PageMeta {
  if (pathname === "/login") {
    return {
      title: "Вход — Watermelon Messenger",
      description:
        "Войдите в Watermelon Messenger через Яндекс ID. Self-hosted мессенджер с чатами, медиа и голосовыми сообщениями.",
    };
  }
  if (pathname === "/legal/privacy") {
    return {
      title: "Политика конфиденциальности — Watermelon Messenger",
      description:
        "Политика конфиденциальности Watermelon Messenger: какие персональные данные обрабатываются, цели, права пользователей и контакты оператора (152-ФЗ).",
    };
  }
  if (pathname === "/legal/personal-data-consent") {
    return {
      title: "Согласие на обработку ПДн — Watermelon Messenger",
      description:
        "Согласие на обработку персональных данных в сервисе Watermelon Messenger: перечень данных, цели обработки и порядок отзыва согласия.",
    };
  }
  if (pathname === "/legal/terms") {
    return {
      title: "Пользовательское соглашение — Watermelon Messenger",
      description:
        "Пользовательское соглашение Watermelon Messenger: правила использования мессенджера, контент, подписка Platinum и ответственность сторон.",
    };
  }
  if (pathname === "/faq") {
    return {
      title: "FAQ — Watermelon Messenger",
      description:
        "Ответы на частые вопросы о Watermelon Messenger: вход, beta-доступ, Platinum, безопасность сообщений, уведомления и удаление аккаунта.",
    };
  }
  if (pathname === "/platinum") {
    return {
      title: "Platinum — Watermelon Messenger",
      description:
        "Подписка Platinum в Watermelon Messenger: ранний доступ к новым функциям, native-клиентам и расширенным возможностям мессенджера.",
    };
  }

  // Приватные и служебные маршруты — не индексируем.
  if (
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/beta/") ||
    pathname.startsWith("/chat/") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/settings") ||
    pathname === "/admin" ||
    pathname === "/icon" ||
    pathname === "/"
  ) {
    return { ...DEFAULT_PAGE_META, robots: NOINDEX };
  }

  if (pathname !== "/" && pathname !== "") {
    return {
      title: "Страница не найдена — Watermelon Messenger",
      description: "Запрошенная страница Watermelon Messenger не найдена.",
      robots: NOINDEX,
    };
  }

  return { ...DEFAULT_PAGE_META, robots: NOINDEX };
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function removeMeta(attr: "name" | "property", key: string) {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

export function applyPageMeta(meta: PageMeta) {
  document.title = meta.title;
  upsertMeta("name", "description", meta.description);
  upsertMeta("property", "og:title", meta.title);
  upsertMeta("property", "og:description", meta.description);

  if (meta.robots) {
    upsertMeta("name", "robots", meta.robots);
  } else {
    removeMeta("name", "robots");
  }
}
