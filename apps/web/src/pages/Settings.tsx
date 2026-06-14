import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { updateProfile, uploadFile } from "../api";
import { getUploadsBaseUrl } from "../config";
import { compressImage } from "../utils/imageCompress";
import { subscribeToPush, unsubscribeFromPush } from "../lib/pushNotifications";

export default function Settings() {
  const { user, updateUser, logout, token } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [username, setUsername] = useState(user?.username ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [idCopied, setIdCopied] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function copyId() {
    if (!user?.id) return;
    try {
      await navigator.clipboard.writeText(user.id);
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 2000);
    } catch {
      setMessage("Не удалось скопировать");
    }
  }

  async function shareId() {
    if (!user?.id) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Мой ID в Watermelon",
          text: user.id,
        });
      } else {
        await navigator.clipboard.writeText(user.id);
        setIdCopied(true);
        setTimeout(() => setIdCopied(false), 2000);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMessage("Не удалось поделиться");
    }
  }

  const avatarDisplayUrl = avatarUrl
    ? (avatarUrl.startsWith("http") ? avatarUrl : `${getUploadsBaseUrl()}${avatarUrl}`)
    : null;

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    setSaving(true);
    setMessage("");
    try {
      const compressed = await compressImage(file);
      const { url } = await uploadFile(compressed);
      const path = url.startsWith("http") ? new URL(url).pathname : url;
      const updated = await updateProfile({ avatarUrl: path });
      setAvatarUrl(updated.avatarUrl ?? null);
      updateUser(updated as Parameters<typeof updateUser>[0]);
      setMessage("Аватар обновлён");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile() {
    const name = username.trim();
    if (!name) return;
    setSaving(true);
    setMessage("");
    try {
      const updated = await updateProfile({ username: name });
      updateUser(updated as Parameters<typeof updateUser>[0]);
      setMessage("Имя сохранено");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  async function togglePush() {
    if (!token) return;
    setPushLoading(true);
    setMessage("");
    try {
      if (pushEnabled) {
        await unsubscribeFromPush(token);
        setPushEnabled(false);
        setMessage("Push-уведомления отключены");
      } else {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") throw new Error("Разрешите уведомления в браузере");
        const ok = await subscribeToPush(token);
        if (!ok) throw new Error("Push недоступен (нужен VAPID_PUBLIC_KEY на сервере)");
        setPushEnabled(true);
        setMessage("Push-уведомления включены");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка push");
    } finally {
      setPushLoading(false);
    }
  }

  return (
    <div className="settings-page">
      <h1>Настройки</h1>
      <div className="settings-section">
        <h2>Профиль</h2>
        <Link to="/profile" className="settings-profile-link">Редактировать профиль →</Link>
        <div className="settings-avatar-row">
          <div className="settings-avatar-wrap">
            {avatarDisplayUrl ? (
              <img src={avatarDisplayUrl} alt="" className="settings-avatar" />
            ) : (
              <div className="settings-avatar-placeholder">
                {(user?.username ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: "none" }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
            >
              {saving ? "…" : "Сменить аватар"}
            </button>
          </div>
        </div>
        <div className="settings-field">
          <label htmlFor="settings-username">Имя (отображаемое)</label>
          <input
            id="settings-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Ваше имя"
          />
          <button type="button" onClick={handleSaveProfile} disabled={saving || !username.trim()}>
            Сохранить имя
          </button>
        </div>
        {message && <p className="settings-message">{message}</p>}
      </div>
      <div className="settings-section">
        <h2>Подписка</h2>
        <div className="settings-tier-row">
          {user?.subscriptionTier === "platinum" ? (
            <span className="settings-tier settings-tier-platinum">✦ Platinum</span>
          ) : (
            <span className="settings-tier">Free</span>
          )}
          <button type="button" className="settings-platinum-link" onClick={() => navigate("/platinum")}>
            {user?.subscriptionTier === "platinum" ? "Подробнее" : "Получить Platinum"}
          </button>
        </div>
      </div>
      <div className="settings-section">
        <h2>Уведомления</h2>
        <button type="button" onClick={() => void togglePush()} disabled={pushLoading}>
          {pushLoading ? "…" : pushEnabled ? "Отключить push" : "Включить push-уведомления"}
        </button>
        <p className="settings-security-note">Работает при открытой вкладке в фоне и настроенном VAPID на сервере.</p>
      </div>
      <div className="settings-section">
        <h2>Безопасность</h2>
        <p className="settings-security-note">
          Сообщения передаются по TLS/WSS и хранятся на сервере в зашифрованном виде (AES-256-GCM at-rest).
        </p>
      </div>
      <div className="settings-section">
        <h2>Тема</h2>
        <div className="settings-theme-row">
          <button
            type="button"
            className={`settings-theme-btn ${theme === "dark" ? "active" : ""}`}
            onClick={() => setTheme("dark")}
          >
            Тёмная
          </button>
          <button
            type="button"
            className={`settings-theme-btn ${theme === "light" ? "active" : ""}`}
            onClick={() => setTheme("light")}
          >
            Светлая
          </button>
        </div>
      </div>
      <div className="settings-section">
        <p className="settings-id-label">Ваш ID (для добавления в чаты)</p>
        <div className="settings-id-row">
          <button
            type="button"
            className="settings-id-code"
            onClick={copyId}
            title="Нажмите, чтобы скопировать"
          >
            {idCopied ? "Скопировано" : (user?.id ?? "—")}
          </button>
          <button type="button" className="settings-id-share" onClick={shareId} title="Поделиться">
            Поделиться
          </button>
        </div>
      </div>
      {user?.isAdmin && (
        <div className="settings-section">
          <h2>Администрирование</h2>
          <Link to="/admin" className="settings-admin-link">Панель beta-доступа</Link>
        </div>
      )}
      <div className="settings-section">
        <button type="button" className="settings-logout" onClick={handleLogout}>
          Выйти
        </button>
      </div>
    </div>
  );
}
