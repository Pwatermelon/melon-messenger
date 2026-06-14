import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApiUrl } from "../config";
import { BrandIcon } from "../components/BrandIcon";

const ERRORS: Record<string, string> = {
  yandex_denied: "Авторизация отменена",
  yandex_failed: "Не удалось войти через Яндекс",
  yandex_not_configured: "Yandex OAuth не настроен на сервере",
};

export default function Login() {
  const [params] = useSearchParams();
  const errorCode = params.get("error");
  const { loginWithYandex, user } = useAuth();
  const [oauthReady, setOauthReady] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`${getApiUrl()}/auth/yandex/config`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c: { configured?: boolean } | null) => setOauthReady(c?.configured ?? false))
      .catch(() => setOauthReady(false));
  }, []);

  if (user) {
    window.location.replace("/");
    return null;
  }

  return (
    <div className="login-page">
      <div className="login-bg" aria-hidden />
      <div className="login-content">
        <div className="login-brand">
          <div className="login-logo">
            <BrandIcon size={88} />
          </div>
          <h1>Watermelon</h1>
          <p className="login-tagline">Безопасный мессенджер нового поколения</p>
        </div>

        <div className="login-card">
          <h2>Вход</h2>
          <p className="login-hint">Используйте Яндекс ID — это единственный способ авторизации</p>

          {errorCode && ERRORS[errorCode] && (
            <p className="auth-error">{ERRORS[errorCode]}</p>
          )}

          <button
            type="button"
            className="yandex-btn"
            onClick={loginWithYandex}
            disabled={oauthReady === false}
          >
            <span className="yandex-btn-icon">Я</span>
            {oauthReady === false ? "Yandex OAuth не настроен" : "Войти через Яндекс ID"}
          </button>

          <p className="login-security">
            Сообщения передаются по защищённому каналу (TLS/WSS) и хранятся на сервере в зашифрованном виде.
          </p>
        </div>

        <a href="/platinum" className="login-platinum-link">
          ✦ Узнать про подписку Platinum
        </a>
      </div>
    </div>
  );
}
