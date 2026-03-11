import { useState, useEffect, useRef } from "react";
import { Link, Outlet, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWebSocketContext } from "../context/WebSocketContext";
import { getChats, createDm, createGroup, getUserById } from "../api";
import type { Chat } from "@melon/shared";
import { getUploadsBaseUrl } from "../config";

export default function ChatLayout() {
  const { user } = useAuth();
  const { subscribe } = useWebSocketContext();
  const navigate = useNavigate();
  const { chatId: currentChatId } = useParams();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [newChatMenuOpen, setNewChatMenuOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [dmUserId, setDmUserId] = useState("");
  const [dmUser, setDmUser] = useState<{ id: string; username: string; avatarUrl: string | null } | null>(null);
  const [dmLoading, setDmLoading] = useState(false);
  const [dmError, setDmError] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupSelected, setGroupSelected] = useState<Array<{ id: string; username: string }>>([]);
  const [groupAddId, setGroupAddId] = useState("");
  const [groupAddError, setGroupAddError] = useState("");
  const [groupError, setGroupError] = useState("");
  const newChatMenuRef = useRef<HTMLDivElement>(null);

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

  function refreshChats() {
    getChats().then((list) => setChats(list as Chat[]));
  }

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
    const onRefresh = () => refreshChats();
    window.addEventListener("melon:refresh-chats", onRefresh);
    return () => window.removeEventListener("melon:refresh-chats", onRefresh);
  }, []);

  useEffect(() => {
    if (!newChatMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (newChatMenuRef.current && !newChatMenuRef.current.contains(e.target as Node)) {
        setNewChatMenuOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [newChatMenuOpen]);

  async function lookupDmUser() {
    const id = dmUserId.trim();
    if (!id) return;
    setDmError("");
    setDmUser(null);
    setDmLoading(true);
    try {
      const u = await getUserById(id);
      if (u) setDmUser(u);
      else setDmError("Пользователь не найден");
    } catch {
      setDmError("Пользователь не найден");
    } finally {
      setDmLoading(false);
    }
  }

  async function startDm(otherUserId: string) {
    setDmError("");
    try {
      const chat = await createDm(otherUserId);
      setDmOpen(false);
      setDmUserId("");
      setDmUser(null);
      setChats((prev) => [chat as Chat, ...prev]);
      navigate(`/chat/${chat.id}`);
    } catch (e) {
      if (e instanceof Error && e.message.includes("already")) {
        const existing = chats.find((c) => c.members.some((m) => m.id === otherUserId));
        if (existing) navigate(`/chat/${existing.id}`);
        setDmOpen(false);
      } else {
        setDmError(e instanceof Error ? e.message : "Не удалось создать чат");
      }
    }
  }

  async function startGroup() {
    const name = groupName.trim();
    if (!name) return;
    setGroupError("");
    try {
      const ids = groupSelected.map((u) => u.id);
      const chat = await createGroup(name, ids);
      setGroupOpen(false);
      setGroupName("");
      setGroupSelected([]);
      setGroupAddId("");
      setGroupAddError("");
      setChats((prev) => [chat as Chat, ...prev]);
      navigate(`/chat/${chat.id}`);
    } catch (err) {
      setGroupError(err instanceof Error ? err.message : "Не удалось создать группу");
    }
  }

  async function addGroupMemberById() {
    const id = groupAddId.trim();
    if (!id) return;
    setGroupAddError("");
    try {
      const u = await getUserById(id);
      if (!u) {
        setGroupAddError("Пользователь не найден");
        return;
      }
      if (u.id === user?.id) return;
      if (groupSelected.some((x) => x.id === u.id)) return;
      setGroupSelected((prev) => [...prev, u]);
      setGroupAddId("");
    } catch {
      setGroupAddError("Пользователь не найден");
    }
  }

  function removeFromGroup(id: string) {
    setGroupSelected((prev) => prev.filter((x) => x.id !== id));
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

  function chatAvatar(chat: Chat) {
    if (chat.type === "group") {
      const url = chat.avatarUrl ?? null;
      if (url) {
        const src = url.startsWith("http") ? url : `${getUploadsBaseUrl()}${url}`;
        return <img src={src} alt="" className="chat-item-avatar-img" />;
      }
      return <span className="chat-item-avatar-letter">{avatarLetter(chat)}</span>;
    }
    const other = chat.members.find((m) => m.id !== user?.id);
    const url = other?.avatarUrl ?? null;
    if (url) {
      const src = url.startsWith("http") ? url : `${getUploadsBaseUrl()}${url}`;
      return <img src={src} alt="" className="chat-item-avatar-img" />;
    }
    return <span className="chat-item-avatar-letter">{avatarLetter(chat)}</span>;
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2 className="sidebar-title">Melon</h2>
          <Link to="/settings" className="sidebar-settings-btn" title="Настройки">
            ⚙
          </Link>
        </div>
        <div className="chat-list">
          {loading ? (
            <p className="chat-list-empty">Загрузка…</p>
          ) : chats.length === 0 ? (
            <p className="chat-list-empty">Нет чатов</p>
          ) : (
            chats.map((chat) => (
              <Link
                key={chat.id}
                to={`/chat/${chat.id}`}
                className={`chat-item ${currentChatId === chat.id ? "chat-item-active" : ""}`}
              >
                <div className="chat-item-avatar">
                  {chatAvatar(chat)}
                </div>
                <div className="chat-item-body">
                  <p className="chat-item-name">{displayName(chat)}</p>
                  <p className="chat-item-preview">{chat.lastMessagePreview ?? "Нет сообщений"}</p>
                </div>
              </Link>
            ))
          )}
        </div>
        <div className="sidebar-footer">
          <div className="new-chat-wrap" ref={newChatMenuRef}>
            <button
              type="button"
              className="new-chat-btn"
              onClick={() => setNewChatMenuOpen((o) => !o)}
              title="Новый чат"
              aria-expanded={newChatMenuOpen}
            >
              +
            </button>
            {newChatMenuOpen && (
              <div className="new-chat-menu">
                <button type="button" onClick={() => { setNewChatMenuOpen(false); setDmOpen(true); }}>
                  Личный чат
                </button>
                <button type="button" onClick={() => { setNewChatMenuOpen(false); setGroupError(""); setGroupOpen(true); }}>
                  Группа
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>

      {dmOpen && (
        <div
          className="search-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) { setDmOpen(false); setDmUser(null); setDmError(""); } }}
        >
          <div className="search-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Новый диалог</h3>
            <div className="search-id-row">
              <input
                type="text"
                placeholder="ID пользователя"
                value={dmUserId}
                onChange={(e) => { setDmUserId(e.target.value); setDmError(""); }}
                onKeyDown={(e) => e.key === "Enter" && lookupDmUser()}
                autoFocus
              />
              <button type="button" onClick={lookupDmUser} disabled={dmLoading || !dmUserId.trim()}>
                {dmLoading ? "…" : "Найти"}
              </button>
            </div>
            {dmError && <p className="search-error">{dmError}</p>}
            {dmUser && (
              <div className="search-result-single">
                <div className="avatar">{dmUser.avatarUrl ? (
                  <img src={dmUser.avatarUrl.startsWith("http") ? dmUser.avatarUrl : `${getUploadsBaseUrl()}${dmUser.avatarUrl}`} alt="" />
                ) : dmUser.username.slice(0, 1).toUpperCase()}</div>
                <span>{dmUser.username}</span>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={(e) => { e.stopPropagation(); startDm(dmUser.id); }}
                >
                  Написать
                </button>
              </div>
            )}
            <button type="button" className="close" onClick={() => { setDmOpen(false); setDmUser(null); setDmError(""); }}>
              Закрыть
            </button>
          </div>
        </div>
      )}

      {groupOpen && (
        <div
          className="search-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setGroupOpen(false); }}
        >
          <div className="search-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Новая группа</h3>
            <input
              type="text"
              placeholder="Название группы"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              autoFocus
            />
            <p className="search-hint">Добавьте участников по ID</p>
            <div className="search-id-row">
              <input
                type="text"
                placeholder="ID пользователя"
                value={groupAddId}
                onChange={(e) => { setGroupAddId(e.target.value); setGroupAddError(""); }}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addGroupMemberById())}
              />
              <button type="button" onClick={addGroupMemberById} disabled={!groupAddId.trim()}>
                Добавить
              </button>
            </div>
            {groupAddError && <p className="search-error">{groupAddError}</p>}
            {groupError && <p className="search-error">{groupError}</p>}
            {groupSelected.length > 0 && (
              <div className="group-selected">
                {groupSelected.map((u) => (
                  <span key={u.id} className="group-chip">
                    {u.username}
                    <button type="button" onClick={() => removeFromGroup(u.id)} aria-label="Удалить">×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="modal-actions" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="close primary"
                onClick={(e) => { e.stopPropagation(); startGroup(); }}
                disabled={!groupName.trim()}
              >
                Создать группу
              </button>
              <button type="button" className="close" onClick={() => setGroupOpen(false)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
