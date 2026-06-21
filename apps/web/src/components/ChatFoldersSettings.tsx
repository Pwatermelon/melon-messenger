import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ChatFolder } from "@melon/shared";
import {
  createChatFolder,
  deleteChatFolder,
  getChatFolders,
  renameChatFolder,
  reorderChatFolders,
} from "../api";
import { useOverlayDismiss } from "../hooks/useOverlayDismiss";

type Props = {
  onClose: () => void;
};

export default function ChatFoldersSettings({ onClose }: Props) {
  const overlayDismiss = useOverlayDismiss(onClose);
  const [folders, setFolders] = useState<ChatFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    void getChatFolders()
      .then(setFolders)
      .catch(() => setError("Не удалось загрузить папки"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function notifyChanged() {
    window.dispatchEvent(new Event("wm:folders-changed"));
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError("");
    try {
      await createChatFolder(name);
      setNewName("");
      reload();
      notifyChanged();
    } catch {
      setError("Не удалось создать папку");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(folderId: string) {
    const name = editName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError("");
    try {
      await renameChatFolder(folderId, name);
      setEditingId(null);
      reload();
      notifyChanged();
    } catch {
      setError("Не удалось переименовать");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(folder: ChatFolder) {
    if (busy) return;
    if (!window.confirm(`Удалить папку «${folder.name}»?`)) return;
    setBusy(true);
    setError("");
    try {
      await deleteChatFolder(folder.id);
      reload();
      notifyChanged();
    } catch {
      setError("Не удалось удалить папку");
    } finally {
      setBusy(false);
    }
  }

  async function moveFolder(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= folders.length || busy) return;
    const reordered = [...folders];
    const [item] = reordered.splice(index, 1);
    reordered.splice(next, 0, item!);
    setBusy(true);
    setError("");
    try {
      const updated = await reorderChatFolders(reordered.map((f) => f.id));
      setFolders(updated);
      notifyChanged();
    } catch {
      setError("Не удалось изменить порядок");
    } finally {
      setBusy(false);
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
        <h3>Папки чатов</h3>
        <p className="search-hint chat-folders-settings-hint">
          Папка «Все» всегда показывает все диалоги. Свои папки создавайте здесь — порядок совпадает с вкладками в
          списке чатов.
        </p>
        {error && <p className="search-error">{error}</p>}
        <div className="sticker-packs-settings-body">
          {loading ? (
            <p className="search-hint">Загрузка…</p>
          ) : (
            <ul className="chat-folders-settings-list">
              {folders.map((f, i) => (
                <li key={f.id} className="chat-folders-settings-row">
                  <div className="chat-folders-settings-row-main">
                    <div className="chat-folders-settings-order">
                      <button
                        type="button"
                        className="chat-folders-order-btn"
                        disabled={busy || i === 0}
                        onClick={() => void moveFolder(i, -1)}
                        aria-label="Выше"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="chat-folders-order-btn"
                        disabled={busy || i === folders.length - 1}
                        onClick={() => void moveFolder(i, 1)}
                        aria-label="Ниже"
                      >
                        ↓
                      </button>
                    </div>
                    {editingId === f.id ? (
                      <input
                        type="text"
                        className="themed-input chat-folders-settings-rename"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRename(f.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                      />
                    ) : (
                      <span className="chat-folders-settings-name">{f.name}</span>
                    )}
                  </div>
                  <div className="chat-folders-settings-actions">
                    {editingId === f.id ? (
                      <>
                        <button type="button" className="btn" disabled={busy} onClick={() => void handleRename(f.id)}>
                          OK
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => setEditingId(null)}>
                          Отмена
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={busy}
                          onClick={() => {
                            setEditingId(f.id);
                            setEditName(f.name);
                          }}
                        >
                          Переименовать
                        </button>
                        <button
                          type="button"
                          className="btn-secondary chat-folders-delete-btn"
                          disabled={busy}
                          onClick={() => void handleDelete(f)}
                        >
                          Удалить
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="chat-folders-settings-create">
            <input
              type="text"
              className="themed-input"
              placeholder="Название новой папки"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
            />
            <button type="button" className="btn" disabled={busy || !newName.trim()} onClick={() => void handleCreate()}>
              Создать
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
