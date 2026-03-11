import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWebSocketContext } from "../context/WebSocketContext";
import { getChats } from "../api";
import type { Chat } from "@melon/shared";

export default function Chats() {
  const { user } = useAuth();
  const { subscribe } = useWebSocketContext();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === "message") {
        setChats((prev) => {
          const copy = [...prev];
          const i = copy.findIndex((c) => c.id === msg.message.chatId);
          if (i >= 0) {
            copy[i] = {
              ...copy[i],
              lastMessageAt: msg.message.createdAt,
              lastMessagePreview: msg.message.encrypted ? "🔒 Зашифрованное сообщение" : msg.message.content.slice(0, 80),
            };
            const [moved] = copy.splice(i, 1);
            copy.unshift(moved);
          }
          return copy;
        });
      }
    });
  }, [subscribe]);

  useEffect(() => {
    let cancelled = false;
    getChats()
      .then((list) => {
        if (!cancelled) setChats(list as Chat[]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function displayName(chat: Chat): string {
    if (chat.name) return chat.name;
    const other = chat.members.find((m) => m.id !== user?.id);
    return other?.username ?? "Chat";
  }

  function avatarLetter(chat: Chat): string {
    const name = displayName(chat);
    return name.slice(0, 1).toUpperCase();
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>{user?.username ?? "Melon"}</h2>
        </div>
        <div className="chat-list">
          {loading ? (
            <p style={{ padding: "1rem", color: "var(--muted)" }}>Loading…</p>
          ) : chats.length === 0 ? (
            <p style={{ padding: "1rem", color: "var(--muted)" }}>No chats yet.</p>
          ) : (
            chats.map((chat) => (
              <Link key={chat.id} to={`/chat/${chat.id}`} className="chat-item">
                <div className="chat-item-avatar">{avatarLetter(chat)}</div>
                <div className="chat-item-body">
                  <p className="chat-item-name">{displayName(chat)}</p>
                  <p className="chat-item-preview">
                    {chat.lastMessagePreview ?? "No messages"}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </aside>
      <main className="main">
        <div className="empty-chat">Select a chat or start a new one</div>
      </main>
    </div>
  );
}
