import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createPlatinumPayment, getPlatinumPaymentStatus } from "../api";
import type { User } from "@melon/shared";

const PAYMENT_KEY = "wm_platinum_payment";

export default function Platinum() {
  const { user, token, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [price] = useState("299");

  const isPlatinum =
    user?.subscriptionTier === "platinum" &&
    (!user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt) > new Date());

  useEffect(() => {
    if (searchParams.get("payment") !== "return" || !token) return;
    const paymentId = localStorage.getItem(PAYMENT_KEY);
    if (!paymentId) {
      setMessage("Ожидаем подтверждение оплаты…");
      return;
    }
    let cancelled = false;
    async function poll() {
      for (let i = 0; i < 12 && !cancelled; i++) {
        try {
          const { status, user: fresh } = await getPlatinumPaymentStatus(paymentId!);
          if (status === "succeeded") {
            updateUser(fresh);
            localStorage.removeItem(PAYMENT_KEY);
            setMessage("Platinum активирован! Спасибо.");
            return;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) setMessage("Оплата обрабатывается. Обновите страницу через минуту.");
    }
    void poll();
    return () => { cancelled = true; };
  }, [searchParams, token, updateUser]);

  async function checkout() {
    if (!token) {
      navigate("/login");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const data = await createPlatinumPayment();
      if (data.devMode && data.user) {
        updateUser(data.user as User);
        setMessage(data.message ?? "Platinum активирован (dev)");
        return;
      }
      if (data.user) {
        updateUser(data.user as User);
        setMessage(data.message ?? "Platinum уже активен");
        return;
      }
      if (data.paymentId) localStorage.setItem(PAYMENT_KEY, data.paymentId);
      if (data.confirmationUrl) {
        window.location.href = data.confirmationUrl;
        return;
      }
      throw new Error("Не получена ссылка на оплату");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка оплаты");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="platinum-page">
      <div className="platinum-hero">
        <Link to={user ? "/" : "/login"} className="platinum-back">← Назад</Link>
        <div className="platinum-badge">✦ Platinum</div>
        <h1>Ранний доступ к новым функциям</h1>
        <p className="platinum-lead">
          Подписка Platinum открывает тестирование экспериментальных возможностей Watermelon раньше всех.
        </p>
      </div>

      <div className="platinum-grid">
        <div className="platinum-feature">
          <span className="platinum-feature-icon">🚀</span>
          <h3>Ранний доступ</h3>
          <p>Новые фичи появляются у вас первыми — до публичного релиза.</p>
        </div>
        <div className="platinum-feature">
          <span className="platinum-feature-icon">🔒</span>
          <h3>Приоритетная безопасность</h3>
          <p>Расширенные настройки приватности и защиты данных.</p>
        </div>
        <div className="platinum-feature">
          <span className="platinum-feature-icon">📱</span>
          <h3>Native-приложения</h3>
          <p>Ранний доступ к iOS и macOS клиентам Watermelon.</p>
        </div>
        <div className="platinum-feature">
          <span className="platinum-feature-icon">💬</span>
          <h3>Эксклюзивные чаты</h3>
          <p>Бета-функции групповых чатов и медиа до всех остальных.</p>
        </div>
      </div>

      <div className="platinum-cta">
        {isPlatinum ? (
          <div className="platinum-active">
            <span className="platinum-active-badge">✦ Platinum активен</span>
            {user?.subscriptionExpiresAt && (
              <p className="platinum-expires">
                До {new Date(user.subscriptionExpiresAt).toLocaleDateString("ru-RU")}
              </p>
            )}
            <p>Спасибо, что поддерживаете Watermelon!</p>
            <Link to="/" className="platinum-btn platinum-btn-secondary">Открыть мессенджер</Link>
          </div>
        ) : (
          <>
            <p className="platinum-price">{price} ₽ / месяц</p>
            <button type="button" className="platinum-btn" onClick={() => void checkout()} disabled={loading}>
              {loading ? "Переход к оплате…" : user ? "Оформить Platinum" : "Войти и оформить"}
            </button>
            {!user && (
              <p className="platinum-note">Для оплаты нужен вход через Яндекс ID</p>
            )}
            {!import.meta.env.PROD && (
              <p className="platinum-note">Без YOOKASSA_* — dev-режим, активация сразу</p>
            )}
          </>
        )}
        {message && <p className="platinum-message">{message}</p>}
      </div>
    </div>
  );
}
