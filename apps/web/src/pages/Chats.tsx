import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWebSocketContext } from "../context/WebSocketContext";
import { getChats, createDm, searchUsers } from "../api";
import type { Chat } from "@melon/shared";

export default function Chats() {
  const { user, logout } = useAuth();
  const { subscribe } = useWebSocketContext();
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; avatarUrl: string | null }>>([]);
  const [searching, setSearching] = useState(false);

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

  useEffect(() => {
    if (!searchQ.trim() || searchQ.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      setSearching(true);
      searchUsers(searchQ)
        .then(setSearchResults)
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  async function startDm(otherUserId: string) {
    try {
      const chat = await createDm(otherUserId);
      setSearchOpen(false);
      setSearchQ("");
      setSearchResults([]);
      setChats((prev) => [chat as Chat, ...prev]);
      navigate(`/chat/${chat.id}`);
    } catch (e) {
      if (e instanceof Error && e.message.includes("already")) {
        const existing = chats.find((c) =>
          c.members.some((m) => m.id === otherUserId)
        );
        if (existing) navigate(`/chat/${existing.id}`);
        setSearchOpen(false);
      }
    }
  }

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
          <div>
            <button type="button" onClick={() => setSearchOpen(true)}>
              New chat
            </button>
            <button type="button" onClick={logout} style={{ marginLeft: "0.5rem", background: "var(--border)", color: "var(--text)" }}>
              Logout
            </button>
          </div>
        </div>
        <div className="chat-list">
          {loading ? (
            <p style={{ padding: "1rem", color: "var(--muted)" }}>Loading…</p>
          ) : chats.length === 0 ? (
            <p style={{ padding: "1rem", color: "var(--muted)" }}>No chats yet. Start a new chat.</p>
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

      {searchOpen && (
        <div className="search-overlay" onClick={() => setSearchOpen(false)}>
          <div className="search-modal" onClick={(e) => e.stopPropagation()}>
            <h3>New conversation</h3>
            <input
              type="text"
              placeholder="Search by username..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              autoFocus
            />
            <div className="search-results">
              {searching && <p style={{ padding: "0.5rem 1rem", margin: 0, color: "var(--muted)" }}>Searching…</p>}
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="search-result-item"
                  onClick={() => startDm(u.id)}
                >
                  <div className="avatar">{u.username.slice(0, 1).toUpperCase()}</div>
                  <span>{u.username}</span>
                </button>
              ))}
            </div>
            <button type="button" className="close" onClick={() => setSearchOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
