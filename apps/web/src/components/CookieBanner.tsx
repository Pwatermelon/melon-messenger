import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const COOKIE_NOTICE_KEY = "wm_cookie_notice_v1";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(!localStorage.getItem(COOKIE_NOTICE_KEY));
    } catch {
      setVisible(true);
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(COOKIE_NOTICE_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Уведомление о cookie">
      <div className="cookie-banner-inner">
        <p>
          Мы используем локальное хранилище браузера для сессии, настроек и работы PWA. Рекламные cookie и
          сторонняя аналитика не применяются. Подробнее — в{" "}
          <Link to="/legal/privacy" onClick={accept}>
            политике конфиденциальности
          </Link>
          .
        </p>
        <button type="button" className="cookie-banner-btn" onClick={accept}>
          Понятно
        </button>
      </div>
    </div>
  );
}
