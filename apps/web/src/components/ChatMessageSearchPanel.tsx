import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "@melon/shared";
import { searchChatMessages } from "../api";
import type { MessageItem } from "../api";
import { mediaMessageCaption } from "../utils/mediaCaption";
import { formatPreviewText } from "../utils/formatMessageText";

type Props = {
  chatId: string;
  isGroup: boolean;
  onClose: () => void;
  onSelectMessage: (messageId: string) => void;
};

function previewText(m: MessageItem): string {
  const cap = mediaMessageCaption(m as Message);
  if (cap) return cap;
  const type = m.messageType ?? "text";
  if (type === "voice") return "Голосовое сообщение";
  if (type === "circle") return "Кружок";
  if (type === "sticker") return m.attachmentMetadata?.emoji ?? "Стикер";
  if (type === "image") return "Фотография";
  if (type === "video") return "Видео";
  if (type === "file") return m.attachmentMetadata?.fileName ?? "Файл";
  if (type === "location") return "Геолокация";
  return m.content;
}

function highlightSnippet(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) {
    const short = text.length > 120 ? `${text.slice(0, 117)}…` : text;
    return short;
  }
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + q.length + 60);
  const slice = text.slice(start, end);
  const rel = idx - start;
  const before = slice.slice(0, rel);
  const match = slice.slice(rel, rel + q.length);
  const after = slice.slice(rel + q.length);
  return (
    <>
      {start > 0 ? "…" : null}
      {before ? formatPreviewText(before) : null}
      <mark className="chat-search-hit">{match}</mark>
      {after ? formatPreviewText(after) : null}
      {end < text.length ? "…" : null}
    </>
  );
}

export function ChatMessageSearchPanel({ chatId, isGroup, onClose, onSelectMessage }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  const runSearch = useCallback(
    async (q: string, nextCursor?: string | null) => {
      const trimmed = q.trim();
      if (trimmed.length < 1) {
        setResults([]);
        setHasMore(false);
        setCursor(null);
        setError("");
        return;
      }
      const reqId = ++reqIdRef.current;
      if (nextCursor) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const data = await searchChatMessages(chatId, trimmed, {
          limit: 30,
          cursor: nextCursor ?? undefined,
        });
        if (reqId !== reqIdRef.current) return;
        setResults((prev) => (nextCursor ? [...prev, ...data.messages] : data.messages));
        setHasMore(data.hasMore);
        setCursor(data.cursor);
      } catch {
        if (reqId !== reqIdRef.current) return;
        setError("Не удалось выполнить поиск");
        if (!nextCursor) setResults([]);
      } finally {
        if (reqId === reqIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [chatId]
  );

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  return (
    <div className="chat-message-search">
      <div className="chat-message-search-bar">
        <button type="button" className="chat-message-search-back" onClick={onClose} aria-label="Закрыть поиск">
          ×
        </button>
        <input
          ref={inputRef}
          type="search"
          className="chat-message-search-input"
          placeholder="Поиск по сообщениям"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          enterKeyHint="search"
          autoComplete="off"
        />
      </div>
      <div className="chat-message-search-results">
        {loading && <p className="chat-message-search-hint">Ищем…</p>}
        {!loading && error && <p className="chat-message-search-error">{error}</p>}
        {!loading && !error && query.trim() && results.length === 0 && (
          <p className="chat-message-search-hint">Ничего не найдено</p>
        )}
        {!loading && results.length > 0 && (
          <ul className="chat-message-search-list">
            {results.map((m) => {
              const text = previewText(m);
              const when = m.createdAt
                ? new Date(m.createdAt).toLocaleString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    className="chat-message-search-item"
                    onClick={() => onSelectMessage(m.id)}
                  >
                    <span className="chat-message-search-item-meta">
                      {isGroup && (
                        <span className="chat-message-search-item-author">
                          {m.sender?.username ?? "?"}
                        </span>
                      )}
                      <span className="chat-message-search-item-time">{when}</span>
                    </span>
                    <span className="chat-message-search-item-text">
                      {highlightSnippet(text, query)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {hasMore && !loading && (
          <button
            type="button"
            className="chat-message-search-more"
            disabled={loadingMore}
            onClick={() => void runSearch(query, cursor)}
          >
            {loadingMore ? "Загрузка…" : "Показать ещё"}
          </button>
        )}
      </div>
    </div>
  );
}
