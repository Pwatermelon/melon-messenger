import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const pointerDragIdRef = useRef<string | null>(null);
  const dragOverIdRef = useRef<string | null>(null);

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

  async function persistOrder(reordered: ChatFolder[]) {
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

  function reorderByIds(fromId: string, toId: string) {
    const fromIndex = folders.findIndex((f) => f.id === fromId);
    const toIndex = folders.findIndex((f) => f.id === toId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return null;
    const reordered = [...folders];
    const [item] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, item!);
    return reordered;
  }

  function folderIdAtPoint(clientX: number, clientY: number): string | null {
    const el = document.elementFromPoint(clientX, clientY);
    const row = el?.closest("[data-folder-id]") as HTMLElement | null;
    return row?.dataset.folderId ?? null;
  }

  function setDragTarget(targetId: string | null) {
    dragOverIdRef.current = targetId;
    setDragOverId(targetId);
  }

  function handleGripPointerDown(e: ReactPointerEvent<HTMLButtonElement>, folderId: string) {
    if (busy || editingId) return;
    pointerDragIdRef.current = folderId;
    setDraggingId(folderId);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function handleGripPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const fromId = pointerDragIdRef.current;
    if (!fromId) return;
    const targetId = folderIdAtPoint(e.clientX, e.clientY);
    if (targetId && targetId !== fromId) {
      setDragTarget(targetId);
    }
  }

  async function finishPointerDrag(clientX: number, clientY: number) {
    const fromId = pointerDragIdRef.current;
    pointerDragIdRef.current = null;
    setDraggingId(null);
    const toId = folderIdAtPoint(clientX, clientY) ?? dragOverIdRef.current;
    setDragTarget(null);
    if (!fromId || !toId || fromId === toId || busy) return;
    const reordered = reorderByIds(fromId, toId);
    if (!reordered) return;
    setFolders(reordered);
    await persistOrder(reordered);
  }

  async function handleGripPointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!pointerDragIdRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    await finishPointerDrag(e.clientX, e.clientY);
  }

  async function handleGripPointerCancel(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!pointerDragIdRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    pointerDragIdRef.current = null;
    setDraggingId(null);
    setDragTarget(null);
  }

  const canDrag = !busy && !editingId;

  return createPortal(
    <div
      className="search-overlay modal-overlay-top sticker-packs-settings-overlay"
      onPointerDown={overlayDismiss.onOverlayPointerDown}
      onClick={overlayDismiss.onOverlayClick}
    >
      <div
        className="search-modal search-modal-wide sticker-packs-settings chat-folders-settings-modal"
        onPointerDown={overlayDismiss.onModalPointerDown}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-close" aria-label="Закрыть" onClick={onClose}>
          ×
        </button>
        <h3>Папки чатов</h3>
        <div className="sticker-packs-settings-body">
          {error && <p className="search-error">{error}</p>}
          {loading ? (
            <p className="search-hint">Загрузка…</p>
          ) : (
            <>
              {folders.length > 0 && (
                <ul className="chat-folders-settings-list">
                  {folders.map((f) => (
                    <li
                      key={f.id}
                      data-folder-id={f.id}
                      className={`chat-folders-settings-row${draggingId === f.id ? " is-dragging" : ""}${dragOverId === f.id ? " is-drag-over" : ""}`}
                    >
                      <div className="chat-folders-settings-row-main">
                        <button
                          type="button"
                          className="chat-folders-drag-handle"
                          disabled={!canDrag}
                          onPointerDown={(e) => handleGripPointerDown(e, f.id)}
                          onPointerMove={handleGripPointerMove}
                          onPointerUp={(e) => void handleGripPointerUp(e)}
                          onPointerCancel={(e) => void handleGripPointerCancel(e)}
                          aria-label={`Перетащить папку «${f.name}»`}
                          title="Удерживайте и перетащите"
                        >
                          <span aria-hidden>⠿</span>
                        </button>
                        {editingId === f.id ? (
                          <input
                            type="text"
                            className="chat-folders-settings-rename"
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
                            <button type="button" className="btn btn-secondary" onClick={() => setEditingId(null)}>
                              Отмена
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary"
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
                              className="btn btn-secondary chat-folders-delete-btn"
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
              <div className="search-id-row chat-folders-settings-create">
                <input
                  type="text"
                  placeholder="Название новой папки"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
                />
                <button type="button" className="btn" disabled={busy || !newName.trim()} onClick={() => void handleCreate()}>
                  Создать
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
