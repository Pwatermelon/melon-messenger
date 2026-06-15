import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BETA_LINKS } from "../config/beta";
import { getApiUrl } from "../config";
import type { User } from "@melon/shared";
import { BrandIcon } from "../components/BrandIcon";
import { logoutViaYandex } from "../lib/yandexLogout";

export default function BetaPending() {
  const { user, token, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) return;
    const check = () => {
      fetch(`${getApiUrl()}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((u: User | null) => {
          if (u?.betaApproved) {
            updateUser(u);
            navigate("/beta/welcome", { replace: true });
          }
        })
        .catch(() => {});
    };
    check();
    const iv = setInterval(check, 5000);
    return () => clearInterval(iv);
  }, [token, navigate, updateUser]);

  return (
    <div className="beta-page">
      <div className="beta-bg" aria-hidden />
      <div className="beta-card beta-card-pending" data-testid="beta-pending">
        <div className="beta-logo">
          <BrandIcon size={72} />
        </div>
        <span className="beta-badge beta-badge-pending">Ожидание</span>
        <h1>Доступ к beta ещё не открыт</h1>
        <p className="beta-lead">
          Привет, {user?.username ?? "друг"}! Вы успешно вошли через Яндекс ID.
          Администратор проверит заявку и откроет доступ к мессенджеру.
        </p>
        <p className="beta-hint">
          Пока ждёте — подпишитесь на наши каналы, чтобы следить за новостями и релизами:
        </p>

        <div className="beta-social">
          <a href={BETA_LINKS.vk} target="_blank" rel="noopener noreferrer" className="beta-social-btn beta-social-vk">
            <span className="beta-social-icon">VK</span>
            ВКонтакте
          </a>
          <a href={BETA_LINKS.telegram} target="_blank" rel="noopener noreferrer" className="beta-social-btn beta-social-tg">
            <span className="beta-social-icon">TG</span>
            Telegram
          </a>
        </div>

        <button type="button" className="beta-logout-btn" onClick={() => logoutViaYandex(logout)}>
          Выйти
        </button>
      </div>
    </div>
  );
}
