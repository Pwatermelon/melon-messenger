import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { User } from "@melon/shared";
import { getBlockedUsers, unblockUser } from "../api";
import { mediaUrl } from "../utils/mediaUrl";
import { useOverlayDismiss } from "../hooks/useOverlayDismiss";

type Props = {
  onClose: () => void;
};

export default function BlockedUsersSettings({ onClose }: Props) {
  const overlayDismiss = useOverlayDismiss(onClose);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    void getBlockedUsers()
      .then(setUsers)
      .catch(() => setError("Не удалось загрузить список"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleUnblock(userId: string) {
    setBusyId(userId);
    setError("");
    try {
      await unblockUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      window.dispatchEvent(new Event("wm:block-changed"));
    } catch {
      setError("Не удалось разблокировать");
    } finally {
      setBusyId(null);
    }
  }

  return createPortal(
    <div
      className="search-overlay modal-overlay-top sticker-packs-settings-overlay"
      onPointerDown={overlayDismiss.onOverlayPointerDown}
      onClick={overlayDismiss.onOverlayClick}
    >
      <div
        className="search-modal search-modal-wide sticker-packs-settings"
        onPointerDown={overlayDismiss.onModalPointerDown}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-close" aria-label="Закрыть" onClick={onClose}>
          ×
        </button>
        <h3>Заблокированные</h3>
        {error && <p className="search-error">{error}</p>}
        <div className="sticker-packs-settings-body">
          {loading ? (
            <p className="search-hint">Загрузка…</p>
          ) : users.length === 0 ? (
            <p className="search-hint">Заблокированных пользователей нет</p>
          ) : (
            <ul className="sticker-packs-list">
              {users.map((u) => (
                <li key={u.id} className="sticker-packs-list-row">
                  <div className="blocked-user-row">
                    {u.avatarUrl ? (
                      <img src={mediaUrl(u.avatarUrl)} alt="" className="blocked-user-avatar" />
                    ) : (
                      <div className="blocked-user-avatar blocked-user-avatar-placeholder">
                        {u.username.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span className="blocked-user-name">{u.username}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busyId === u.id}
                    onClick={() => void handleUnblock(u.id)}
                  >
                    Разблокировать
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
