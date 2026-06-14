import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getUserById, updateProfile, uploadFile } from "../api";
import { getUploadsBaseUrl } from "../config";
import { compressImage } from "../utils/imageCompress";
import type { User } from "@melon/shared";

function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : `${getUploadsBaseUrl()}${path}`;
}

export default function Profile() {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const { user: me, updateUser } = useAuth();
  const isOwn = !userId || userId === me?.id;
  const targetId = userId ?? me?.id;

  const [profile, setProfile] = useState<User | null>(isOwn && me ? me : null);
  const [loading, setLoading] = useState(!isOwn);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [bio, setBio] = useState(me?.bio ?? "");
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!targetId) return;
    if (isOwn && me) {
      setProfile(me);
      setBio(me.bio ?? "");
      return;
    }
    setLoading(true);
    getUserById(targetId)
      .then((u) => setProfile(u))
      .finally(() => setLoading(false));
  }, [targetId, isOwn, me]);

  async function saveBio() {
    if (!isOwn) return;
    setSaving(true);
    setMessage("");
    try {
      const updated = await updateProfile({ bio: bio.trim() || null });
      updateUser(updated);
      setProfile(updated);
      setMessage("Био сохранено");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    setSaving(true);
    setMessage("");
    try {
      const compressed = await compressImage(file);
      const { path } = await uploadFile(compressed);
      const updated = await updateProfile({ avatarUrl: path });
      updateUser(updated);
      setProfile(updated);
      setMessage("Аватар обновлён");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setSaving(false);
    }
  }

  async function uploadCover(file: File) {
    setSaving(true);
    setMessage("");
    try {
      const compressed = await compressImage(file);
      const { path } = await uploadFile(compressed);
      const updated = await updateProfile({ coverUrl: path });
      updateUser(updated);
      setProfile(updated);
      setMessage("Обложка обновлена");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setSaving(false);
    }
  }

  async function addPhoto(file: File) {
    setSaving(true);
    setMessage("");
    try {
      const compressed = await compressImage(file);
      const { path } = await uploadFile(compressed);
      const current = profile?.profilePhotos ?? [];
      const updated = await updateProfile({ profilePhotos: [...current, path].slice(0, 12) });
      updateUser(updated);
      setProfile(updated);
      setMessage("Фото добавлено");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function removePhoto(path: string) {
    const current = profile?.profilePhotos ?? [];
    const updated = await updateProfile({ profilePhotos: current.filter((p) => p !== path) });
    updateUser(updated);
    setProfile(updated);
  }

  if (loading) {
    return (
      <div className="profile-page">
        <p className="profile-loading">Загрузка профиля…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-page">
        <p>Профиль не найден</p>
        <Link to="/">← Назад</Link>
      </div>
    );
  }

  const coverDisplay = mediaUrl(profile.coverUrl);
  const avatarDisplay = mediaUrl(profile.avatarUrl);
  const photos = profile.profilePhotos ?? [];

  return (
    <div className="profile-page">
      <div className="profile-toolbar">
        <button type="button" className="profile-back" onClick={() => navigate(-1)}>← Назад</button>
        {isOwn && <Link to="/settings" className="profile-settings-link">Настройки</Link>}
      </div>

      <div className="profile-cover-wrap">
        {coverDisplay ? (
          <img src={coverDisplay} alt="" className="profile-cover" />
        ) : (
          <div className="profile-cover-placeholder" />
        )}
        {isOwn && (
          <>
            <input
              type="file"
              ref={coverInputRef}
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void uploadCover(f);
              }}
            />
            <button type="button" className="profile-cover-edit" onClick={() => coverInputRef.current?.click()} disabled={saving}>
              Сменить обложку
            </button>
          </>
        )}
      </div>

      <div className="profile-header">
        <div className="profile-avatar-wrap">
          {avatarDisplay ? (
            <img src={avatarDisplay} alt="" className="profile-avatar" />
          ) : (
            <div className="profile-avatar-placeholder">{profile.username.slice(0, 1).toUpperCase()}</div>
          )}
          {profile.subscriptionTier === "platinum" && <span className="profile-platinum-badge">✦</span>}
          {isOwn && (
            <>
              <input
                type="file"
                ref={avatarInputRef}
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadAvatar(f);
                }}
              />
              <button
                type="button"
                className="profile-avatar-edit"
                onClick={() => avatarInputRef.current?.click()}
                disabled={saving}
                title="Сменить аватар"
              >
                📷
              </button>
            </>
          )}
        </div>
        <h1 className="profile-name">{profile.username}</h1>
        {!isOwn && <p className="profile-id">ID: {profile.id}</p>}
      </div>

      <div className="profile-section">
        <h2>О себе</h2>
        {isOwn ? (
          <>
            <textarea
              className="profile-bio-input"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Расскажите о себе…"
              maxLength={500}
              rows={4}
            />
            <button type="button" onClick={() => void saveBio()} disabled={saving}>Сохранить</button>
          </>
        ) : (
          <p className="profile-bio">{profile.bio?.trim() || "Пользователь пока ничего не написал."}</p>
        )}
      </div>

      <div className="profile-section">
        <div className="profile-photos-header">
          <h2>Фото</h2>
          {isOwn && (
            <>
              <input
                type="file"
                ref={photoInputRef}
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void addPhoto(f);
                }}
              />
              <button type="button" onClick={() => photoInputRef.current?.click()} disabled={saving || photos.length >= 12}>
                + Добавить
              </button>
            </>
          )}
        </div>
        {photos.length === 0 ? (
          <p className="profile-empty">Нет фото</p>
        ) : (
          <div className="profile-photos-grid">
            {photos.map((p) => {
              const url = mediaUrl(p);
              if (!url) return null;
              return (
                <div key={p} className="profile-photo-item">
                  <img src={url} alt="" />
                  {isOwn && (
                    <button type="button" className="profile-photo-remove" onClick={() => void removePhoto(p)} aria-label="Удалить">
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {message && <p className="profile-message">{message}</p>}
    </div>
  );
}
