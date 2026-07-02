import { useMemo, useState } from "react";
import type { Chat } from "@melon/shared";
import { mediaUrl } from "../utils/mediaUrl";
import { userDisplayName } from "../utils/userDisplay";

type Props = {
  chats: Chat[];
  userId?: string;
  currentChatId?: string;
  messageCount?: number;
  onSelect: (chatId: string) => void;
  onClose: () => void;
  sending?: boolean;
};

function chatLabel(chat: Chat, userId?: string): string {
  if (chat.type === "group") return chat.name ?? "Группа";
  const other = chat.members.find((m) => m.id !== userId);
  return other ? userDisplayName(other) : "Диалог";
}

function chatSearchText(chat: Chat, userId?: string): string {
  const parts: string[] = [];
  if (chat.type === "group") {
    if (chat.name) parts.push(chat.name);
    for (const m of chat.members) {
      if (m.username) parts.push(m.username);
      if (m.yandexLogin) parts.push(m.yandexLogin);
    }
  } else {
    const other = chat.members.find((m) => m.id !== userId);
    if (other) {
      parts.push(userDisplayName(other));
      if (other.username) parts.push(other.username);
      if (other.yandexLogin) parts.push(other.yandexLogin);
    }
  }
  return parts.join(" ").toLowerCase();
}

function chatAvatar(chat: Chat, userId?: string): string | null {
  if (chat.type === "group" && chat.avatarUrl) return chat.avatarUrl;
  const other = chat.members.find((m) => m.id !== userId);
  return other?.avatarUrl ?? null;
}

export function ForwardMessageModal({ chats, userId, currentChatId, messageCount = 1, onSelect, onClose, sending }: Props) {
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? chats.filter((c) => chatSearchText(c, userId).includes(q)) : chats;
    if (!currentChatId) return filtered;
    const current = filtered.find((c) => c.id === currentChatId);
    if (!current) return filtered;
    return [current, ...filtered.filter((c) => c.id !== currentChatId)];
  }, [chats, query, userId, currentChatId]);

  return (
    <div className="search-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="search-modal forward-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} disabled={sending} aria-label="Закрыть">
          ×
        </button>
        <h3>
          {messageCount > 1
            ? `Переслать ${messageCount} ${messageCount < 5 ? "сообщения" : "сообщений"} в…`
            : "Переслать в…"}
        </h3>
        <input
          type="search"
          className="forward-modal-search"
          placeholder="Поиск чата…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          spellCheck={false}
          autoComplete="off"
        />
        <div className="forward-chat-list">
          {list.length === 0 ? (
            <p className="search-hint">
              {query.trim() ? "Ничего не найдено" : "Нет чатов — создайте диалог через «+»"}
            </p>
          ) : (
            list.map((chat) => {
              const avatar = chatAvatar(chat, userId);
              const label = chatLabel(chat, userId);
              const isCurrent = chat.id === currentChatId;
              return (
                <button
                  key={chat.id}
                  type="button"
                  className={`forward-chat-item${isCurrent ? " forward-chat-item-current" : ""}`}
                  disabled={sending}
                  onClick={() => onSelect(chat.id)}
                >
                  <span className="forward-chat-avatar">
                    {avatar ? (
                      <img src={mediaUrl(avatar)} alt="" />
                    ) : (
                      label.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span className="forward-chat-name">
                    {label}
                    {isCurrent && <span className="forward-chat-badge">этот чат</span>}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
