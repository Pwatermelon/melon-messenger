import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Chat, ChatFolder } from "@melon/shared";
import { VIRTUAL_FOLDER_ALL } from "@melon/shared";

export type ChatListMenuState = {
  chat: Chat;
  x: number;
  y: number;
};

type Props = {
  chat: Chat;
  folders: ChatFolder[];
  x: number;
  y: number;
  onClose: () => void;
  onMarkRead: (chatId: string) => void;
  onToggleFolder: (chatId: string, folderId: string, inFolder: boolean) => void;
  onDelete: (chatId: string) => void;
};

export function ChatListContextMenu({
  chat,
  folders,
  x,
  y,
  onClose,
  onMarkRead,
  onToggleFolder,
  onDelete,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [foldersOpen, setFoldersOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const menu = ref.current;
      if (!menu || menu.contains(e.target as Node)) return;
      onClose();
    };
    const id = window.setTimeout(() => {
      window.addEventListener("pointerdown", onPointerDown, true);
    }, 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [onClose]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad;
    if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad;
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [x, y, foldersOpen, folders.length]);

  const hasUnread = (chat.unreadCount ?? 0) > 0;
  const chatFolderIds = new Set(chat.folderIds ?? []);

  return createPortal(
    <div ref={ref} className="chat-list-context-menu" role="menu" style={{ left: x, top: y }}>
      {hasUnread && (
        <button
          type="button"
          className="chat-list-context-item"
          role="menuitem"
          onClick={() => {
            onMarkRead(chat.id);
            onClose();
          }}
        >
          Прочитать
        </button>
      )}
      <div className="chat-list-context-folder-wrap">
        <button
          type="button"
          className={`chat-list-context-item chat-list-context-item-submenu${foldersOpen ? " is-open" : ""}`}
          role="menuitem"
          aria-expanded={foldersOpen}
          onClick={() => setFoldersOpen((o) => !o)}
        >
          <span>Добавить в папку</span>
          <span className="chat-list-context-chevron" aria-hidden>
            ›
          </span>
        </button>
        {foldersOpen && (
          <div className="chat-list-context-submenu" role="menu">
            {folders.length === 0 ? (
              <p className="chat-list-context-submenu-empty">Нет папок — создайте в настройках</p>
            ) : (
              folders.map((f) => {
                const inFolder = chatFolderIds.has(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    className={`chat-list-context-item chat-list-context-subitem${inFolder ? " is-checked" : ""}`}
                    role="menuitemcheckbox"
                    aria-checked={inFolder}
                    onClick={() => {
                      onToggleFolder(chat.id, f.id, inFolder);
                    }}
                  >
                    <span>{f.name}</span>
                    {inFolder && <span className="chat-list-context-check" aria-hidden>✓</span>}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        className="chat-list-context-item chat-list-context-item-danger"
        role="menuitem"
        onClick={() => {
          onDelete(chat.id);
          onClose();
        }}
      >
        Удалить
      </button>
    </div>,
    document.body
  );
}

export function loadActiveFolderId(): string {
  try {
    const saved = localStorage.getItem("wm-chat-folder");
    return saved || VIRTUAL_FOLDER_ALL;
  } catch {
    return VIRTUAL_FOLDER_ALL;
  }
}

export function saveActiveFolderId(folderId: string) {
  try {
    localStorage.setItem("wm-chat-folder", folderId);
  } catch {
    // ignore
  }
}

export function filterChatsByFolder(chats: Chat[], folderId: string): Chat[] {
  if (folderId === VIRTUAL_FOLDER_ALL) return chats;
  return chats.filter((c) => c.folderIds?.includes(folderId));
}
