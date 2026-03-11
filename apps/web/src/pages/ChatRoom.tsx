import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWebSocketContext } from "../context/WebSocketContext";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { getChats, getMessages, uploadFile, setPublicKey, addGroupMembers, removeGroupMember, getUserById, deleteChat, updateGroup } from "../api";
import * as e2e from "../crypto/e2e";
import { compressImage } from "../utils/imageCompress";
import type { Chat, Message } from "@melon/shared";
import type { MessageItem } from "../api";
import { getUploadsBaseUrl, getWsUrl } from "../config";

export default function ChatRoom() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { send, ready, status, reconnect, subscribe } = useWebSocketContext();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [decryptedContent, setDecryptedContent] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [contactInfoOpen, setContactInfoOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [groupAddId, setGroupAddId] = useState("");
  const [groupAddError, setGroupAddError] = useState("");
  const [idCopiedProfile, setIdCopiedProfile] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);

  async function copyProfileId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setIdCopiedProfile(id);
      setTimeout(() => setIdCopiedProfile(null), 2000);
    } catch {}
  }
  const listRef = useRef<HTMLDivElement>(null);
  const { recording, duration, start: startVoice, stop: stopVoice } = useVoiceRecorder();

  useEffect(() => {
    if (!lightboxImage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxImage(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxImage]);

  useEffect(() => {
    if (!contactInfoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selectedMemberId) setSelectedMemberId(null);
      else setContactInfoOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contactInfoOpen, selectedMemberId]);

  const otherMember = chat?.type === "dm" ? chat.members.find((m) => m.id !== user?.id) : null;
  const canEncrypt = Boolean(chat?.type === "dm" && otherMember?.publicKey && e2e.getStoredKeys());

  useEffect(() => {
    let stored = e2e.getStoredKeys();
    if (!stored) {
      e2e.generateKeyPair().then(({ publicKey, privateKey }) => {
        e2e.storeKeys(publicKey, privateKey);
        setPublicKey(publicKey).catch(() => {});
      });
    } else {
      setPublicKey(stored.publicKey).catch(() => {});
    }
  }, []);

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === "message" && msg.message.chatId === chatId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.message.id)) return prev;
          return [...prev, msg.message];
        });
      }
    });
  }, [subscribe, chatId]);

  useEffect(() => {
    if (!chatId) return;
    let cancelled = false;
    setLoading(true);
    getChats()
      .then((chats) => {
        const c = (chats as Chat[]).find((ch) => ch.id === chatId);
        if (!cancelled) setChat(c ?? null);
      })
      .catch(() => {
        if (!cancelled) setChat(null);
      });

    getMessages(chatId, 50)
      .then(({ messages: list }) => {
        if (!cancelled) setMessages(list as Message[]);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  useEffect(() => {
    if (!chatId || !ready) return;
    send({ type: "subscribe", chatId });
    return () => {
      send({ type: "unsubscribe", chatId });
    };
  }, [chatId, ready, send]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!otherMember?.publicKey || !e2e.getStoredKeys()) return;
    const keys = e2e.getStoredKeys()!;
    messages
      .filter((m) => m.encrypted && m.content && m.senderId !== user?.id && !decryptedContent[m.id])
      .forEach((m) => {
        e2e.decrypt(m.content, otherMember.publicKey!, keys.privateKey).then(
          (plain) => setDecryptedContent((prev) => ({ ...prev, [m.id]: plain })),
          () => {}
        );
      });
  }, [messages, otherMember?.publicKey, user?.id, decryptedContent]);

  async function sendMessage(opts: {
    content: string;
    messageType?: "text" | "image" | "file" | "video" | "location" | "voice";
    attachmentUrl?: string | null;
    attachmentMetadata?: { fileName?: string; mimeType?: string; size?: number; duration?: number; lat?: number; lng?: number } | null;
  }) {
    if (!chatId || sending) return;
    let content = opts.content;
    let encrypted = false;
    if (
      (opts.messageType ?? "text") === "text" &&
      canEncrypt &&
      otherMember?.publicKey
    ) {
      try {
        const keys = e2e.getStoredKeys()!;
        content = await e2e.encrypt(content, otherMember.publicKey, keys.privateKey);
        encrypted = true;
      } catch (_) {}
    }
    setSending(true);
    try {
      send({
        type: "message",
        chatId,
        content,
        messageType: opts.messageType ?? "text",
        attachmentUrl: opts.attachmentUrl ?? null,
        attachmentMetadata: opts.attachmentMetadata ?? null,
        encrypted,
      });
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendMessage({ content: text });
  }

  function openAttach(accept: string) {
    setAttachMenuOpen(false);
    const inputEl = fileInputRef.current;
    if (!inputEl) return;
    inputEl.accept = accept;
    inputEl.click();
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !chatId) return;
    e.target.value = "";
    setSending(true);
    try {
      const isImage = file.type.startsWith("image/");
      const toUpload = isImage ? await compressImage(file) : file;
      const { url } = await uploadFile(toUpload);
      const type = isImage ? "image" : file.type.startsWith("video/") ? "video" : "file";
      await sendMessage({
        content: type === "image" ? "Фотография" : file.name,
        messageType: type,
        attachmentUrl: url,
        attachmentMetadata: type === "image" ? { fileName: "Фотография", mimeType: toUpload.type, size: toUpload.size } : { fileName: file.name, mimeType: file.type, size: file.size },
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  function handleLocation() {
    if (!navigator.geolocation) return;
    setSending(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        sendMessage({
          content: `Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          messageType: "location",
          attachmentMetadata: { lat, lng },
        });
        setSending(false);
      },
      () => setSending(false)
    );
  }

  async function handleVoiceStop() {
    const { blob, duration: d } = await stopVoice();
    const minSize = 200;
    if (blob.size < minSize) return;
    setSending(true);
    try {
      const mime = blob.type || "audio/webm";
      const ext = mime.includes("ogg") ? "ogg" : "webm";
      const file = new File([blob], `voice.${ext}`, { type: mime });
      const { url } = await uploadFile(file);
      const path = url.startsWith("http") ? new URL(url).pathname : url;
      await sendMessage({
        content: "Голосовое сообщение",
        messageType: "voice",
        attachmentUrl: path,
        attachmentMetadata: { duration: d, mimeType: mime },
      });
    } catch (err) {
      console.error("Voice send failed:", err);
    } finally {
      setSending(false);
    }
  }

  function displayContent(m: Message | MessageItem): string {
    if (m.encrypted && m.senderId !== user?.id && decryptedContent[m.id]) return decryptedContent[m.id];
    if (m.encrypted) return "🔒 Зашифрованное сообщение";
    return m.content;
  }

  const displayName = chat
    ? chat.name ?? (chat.type === "dm" ? chat.members.find((m) => m.id !== user?.id)?.username : null) ?? "Chat"
    : "…";

  function headerAvatarUrl(): string | null {
    if (!chat) return null;
    if (chat.type === "group" && chat.avatarUrl) return chat.avatarUrl;
    if (chat.type === "dm" && otherMember?.avatarUrl) return otherMember.avatarUrl;
    return null;
  }

  function headerAvatarLetter(): string {
    return displayName.slice(0, 1).toUpperCase();
  }

  const isGroupAdmin = Boolean(chat?.type === "group" && chat.members.find((m) => m.id === user?.id)?.role === "admin");

  async function handleDeleteChat() {
    if (!chatId) return;
    try {
      await deleteChat(chatId);
      window.dispatchEvent(new Event("melon:refresh-chats"));
      navigate("/", { replace: true });
    } catch (e) {
      console.error(e);
    }
  }

  async function handleGroupAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!chatId) return;
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    setSending(true);
    try {
      const compressed = await compressImage(file);
      const { url } = await uploadFile(compressed);
      const path = url.startsWith("http") ? new URL(url).pathname : url;
      const updated = await updateGroup(chatId, { avatarUrl: path });
      setChat(updated as Chat);
      window.dispatchEvent(new Event("melon:refresh-chats"));
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  async function handleAddGroupMember() {
    if (!chatId || !groupAddId.trim()) return;
    setGroupAddError("");
    try {
      const u = await getUserById(groupAddId.trim());
      if (!u) {
        setGroupAddError("Пользователь не найден");
        return;
      }
      const updated = await addGroupMembers(chatId, [u.id]);
      setChat(updated as Chat);
      setGroupAddId("");
    } catch (e) {
      setGroupAddError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function handleRemoveGroupMember(memberId: string) {
    if (!chatId) return;
    try {
      const updated = await removeGroupMember(chatId, memberId);
      setSelectedMemberId(null);
      if (memberId === user?.id) {
        window.dispatchEvent(new Event("melon:refresh-chats"));
        navigate("/", { replace: true });
        return;
      }
      setChat(updated as Chat);
    } catch (e) {
      console.error(e);
    }
  }

  if (!chatId) return null;

  return (
    <>
      <div className="chat-header">
        <button
          type="button"
          className="chat-header-user"
          onClick={() => setContactInfoOpen(true)}
          title="Информация о чате"
        >
          <div className="chat-header-avatar">
            {(() => {
              const url = headerAvatarUrl();
              return url ? (
                <img src={url.startsWith("http") ? url : `${getUploadsBaseUrl()}${url}`} alt="" />
              ) : (
                headerAvatarLetter()
              );
            })()}
          </div>
          <div className="chat-header-name-wrap">
            <h3 className="chat-header-name">{displayName}</h3>
            {chat?.type === "group" && (
              <span className="chat-header-meta">{chat.members.length} участников</span>
            )}
          </div>
        </button>
        {status === "connecting" && (
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }} title={getWsUrl()}>
            Connecting…
          </span>
        )}
        {status === "auth_failed" && (
          <span style={{ fontSize: "0.8rem", color: "var(--danger)" }}>Session expired. Log out and log in again.</span>
        )}
        {status === "failed" && (
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            Disconnected. <button type="button" onClick={reconnect} className="link-button">Retry</button> (or log out and log in)
          </span>
        )}
        {canEncrypt && <span className="e2e-badge">E2E</span>}
      </div>
      <div className="messages" ref={listRef}>
        {loading ? (
          <p style={{ color: "var(--muted)", padding: "1rem" }}>Loading messages…</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`message ${m.senderId === user?.id ? "own" : ""}`}
            >
              {(chat?.type === "group" || (m.sender && m.senderId !== user?.id)) && (
                <div className="message-sender">{m.sender?.username ?? "?"}</div>
              )}
              {(m.messageType ?? "text") === "text" && (
                <p className="message-content">{displayContent(m)}</p>
              )}
              {(m.messageType ?? "text") === "image" && m.attachmentUrl && (() => {
                const imgUrl = m.attachmentUrl.startsWith("http") ? m.attachmentUrl : `${getUploadsBaseUrl()}${m.attachmentUrl}`;
                return (
                  <div className="message-image-wrap">
                    <button type="button" className="message-image-btn" onClick={() => setLightboxImage(imgUrl)}>
                      <img src={imgUrl} alt="" className="message-image" />
                    </button>
                    <span className="message-image-caption">Фотография</span>
                  </div>
                );
              })()}
              {(m.messageType ?? "text") === "file" && m.attachmentUrl && (
                <a href={m.attachmentUrl.startsWith("http") ? m.attachmentUrl : `${getUploadsBaseUrl()}${m.attachmentUrl}`} target="_blank" rel="noopener noreferrer" className="message-file">
                  📎 {m.attachmentMetadata?.fileName ?? "File"}
                </a>
              )}
              {(m.messageType ?? "text") === "video" && m.attachmentUrl && (
                <video src={m.attachmentUrl.startsWith("http") ? m.attachmentUrl : `${getUploadsBaseUrl()}${m.attachmentUrl}`} controls className="message-video" />
              )}
              {(m.messageType ?? "text") === "location" && m.attachmentMetadata?.lat != null && (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${m.attachmentMetadata.lat}&mlon=${m.attachmentMetadata.lng}&zoom=15`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="message-location"
                >
                  📍 Location
                </a>
              )}
              {(m.messageType ?? "text") === "voice" && m.attachmentUrl && (
                <div className="message-voice">
                  <audio
                    controls
                    preload="metadata"
                    src={m.attachmentUrl.startsWith("http") ? m.attachmentUrl : `${getUploadsBaseUrl()}${m.attachmentUrl}`}
                  />
                  {m.attachmentMetadata?.duration != null && (
                    <span className="message-voice-duration">{m.attachmentMetadata.duration}s</span>
                  )}
                </div>
              )}
              <div className="message-time">
                {m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : ""}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="compose">
        <input
          type="file"
          ref={fileInputRef}
          accept="*/*"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
        <form onSubmit={handleSubmit} className="compose-form compose-form-inline">
          <div className="compose-attach-wrap">
            <button
              type="button"
              className="compose-btn compose-btn-icon"
              onClick={() => setAttachMenuOpen((o) => !o)}
              disabled={!ready || sending}
              title="Attach"
            >
              📎
            </button>
            {attachMenuOpen && (
              <>
                <div className="compose-attach-backdrop" onClick={() => setAttachMenuOpen(false)} />
                <div className="compose-attach-menu">
                  <button type="button" onClick={() => openAttach("image/*")}>🖼 Photo</button>
                  <button type="button" onClick={() => openAttach("video/*")}>🎬 Video</button>
                  <button type="button" onClick={() => openAttach("*/*")}>📄 File</button>
                  <button type="button" onClick={() => { setAttachMenuOpen(false); handleLocation(); }}>📍 Location</button>
                </div>
              </>
            )}
          </div>
          <input
            type="text"
            className="compose-input"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!ready}
          />
          <button type="submit" className="compose-btn compose-btn-send" disabled={!ready || sending || !input.trim()}>
            Send
          </button>
          {!recording ? (
            <button type="button" className="compose-btn compose-btn-icon" onClick={startVoice} disabled={!ready || sending} title="Voice">🎤</button>
          ) : (
            <button type="button" className="compose-btn compose-btn-icon voice-stop" onClick={handleVoiceStop} title="Send">{duration}s ✓</button>
          )}
        </form>
      </div>
      {lightboxImage && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр изображения"
          onClick={() => setLightboxImage(null)}
        >
          <button type="button" className="lightbox-close" onClick={() => setLightboxImage(null)} aria-label="Закрыть">×</button>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxImage} alt="" className="lightbox-img" />
          </div>
        </div>
      )}

      {contactInfoOpen && chat && (
        <div
          className="contact-info-overlay"
          onClick={() => { setContactInfoOpen(false); setSelectedMemberId(null); setGroupAddError(""); }}
          role="dialog"
          aria-modal="true"
          aria-label="Информация о чате"
        >
          <div className="contact-info-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="contact-info-close" onClick={() => { setContactInfoOpen(false); setSelectedMemberId(null); }} aria-label="Закрыть">×</button>
            {chat.type === "dm" && otherMember ? (
              <>
                <div className="contact-info-avatar-wrap">
                  {otherMember.avatarUrl ? (
                    <img
                      src={otherMember.avatarUrl.startsWith("http") ? otherMember.avatarUrl : `${getUploadsBaseUrl()}${otherMember.avatarUrl}`}
                      alt=""
                      className="contact-info-avatar"
                    />
                  ) : (
                    <div className="contact-info-avatar-placeholder">
                      {(otherMember.username ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <p className="contact-info-name">{otherMember.username}</p>
                <div className="contact-info-id-block">
                  <span className="contact-info-label">ID</span>
                  <div className="contact-info-id-row">
                    <code className="contact-info-code">{otherMember.id}</code>
                    <button type="button" className="contact-info-copy-btn" onClick={() => copyProfileId(otherMember.id)}>
                      {idCopiedProfile === otherMember.id ? "Скопировано" : "Скопировать"}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="contact-info-remove-btn"
                  onClick={handleDeleteChat}
                >
                  Удалить чат
                </button>
              </>
            ) : chat.type === "group" && selectedMemberId ? (
              (() => {
                const m = chat.members.find((x) => x.id === selectedMemberId);
                if (!m) return null;
                return (
                  <>
                    <button type="button" className="contact-info-back" onClick={() => setSelectedMemberId(null)}>
                      ← Назад
                    </button>
                    <div className="contact-info-avatar-wrap">
                      {m.avatarUrl ? (
                        <img
                          src={m.avatarUrl.startsWith("http") ? m.avatarUrl : `${getUploadsBaseUrl()}${m.avatarUrl}`}
                          alt=""
                          className="contact-info-avatar"
                        />
                      ) : (
                        <div className="contact-info-avatar-placeholder">
                          {(m.username ?? "?").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <p className="contact-info-name">{m.username}</p>
                    <div className="contact-info-id-block">
                      <span className="contact-info-label">ID</span>
                      <div className="contact-info-id-row">
                        <code className="contact-info-code">{m.id}</code>
                        <button type="button" className="contact-info-copy-btn" onClick={() => copyProfileId(m.id)}>
                          {idCopiedProfile === m.id ? "Скопировано" : "Скопировать"}
                        </button>
                      </div>
                    </div>
                        {isGroupAdmin && m.id !== user?.id && (
                      <button
                        type="button"
                        className="contact-info-remove-btn"
                        onClick={() => handleRemoveGroupMember(m.id)}
                      >
                        Удалить из группы
                      </button>
                    )}
                  </>
                );
              })()
            ) : chat.type === "group" ? (
              <>
                <p className="contact-info-name contact-info-group-title">{chat.name ?? "Группа"}</p>
                <div className="contact-info-group-avatar-block">
                  <div className="contact-info-group-avatar">
                    {chat.avatarUrl ? (
                      <img
                        src={chat.avatarUrl.startsWith("http") ? chat.avatarUrl : `${getUploadsBaseUrl()}${chat.avatarUrl}`}
                        alt=""
                      />
                    ) : (
                      (chat.name ?? "Группа").slice(0, 1).toUpperCase()
                    )}
                  </div>
                  {isGroupAdmin && (
                    <>
                      <input
                        type="file"
                        ref={groupAvatarInputRef}
                        accept="image/*"
                        onChange={handleGroupAvatarChange}
                        style={{ display: "none" }}
                      />
                      <button
                        type="button"
                        className="contact-info-group-avatar-change"
                        onClick={() => groupAvatarInputRef.current?.click()}
                        disabled={sending}
                      >
                        Сменить аватар группы
                      </button>
                    </>
                  )}
                </div>
                <p className="contact-info-members-label">Участники</p>
                <ul className="contact-info-members">
                  {chat.members.map((m) => (
                    <li key={m.id} className="contact-info-member">
                      <button
                        type="button"
                        className="contact-info-member-btn"
                        onClick={() => setSelectedMemberId(m.id)}
                      >
                        <div className="contact-info-member-avatar">
                          {m.avatarUrl ? (
                            <img src={m.avatarUrl.startsWith("http") ? m.avatarUrl : `${getUploadsBaseUrl()}${m.avatarUrl}`} alt="" />
                          ) : (
                            (m.username ?? "?").slice(0, 1).toUpperCase()
                          )}
                        </div>
                        <div className="contact-info-member-body">
                          <span className="contact-info-member-name">{m.username}</span>
                        </div>
                      </button>
                      {isGroupAdmin && m.id !== user?.id && (
                        <button
                          type="button"
                          className="contact-info-member-remove"
                          onClick={(e) => { e.stopPropagation(); handleRemoveGroupMember(m.id); }}
                          title="Удалить из группы"
                        >
                          ×
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {isGroupAdmin && (
                  <div className="contact-info-add-members">
                    <p className="contact-info-members-label">Добавить по ID</p>
                    <div className="search-id-row">
                      <input
                        type="text"
                        placeholder="ID пользователя"
                        value={groupAddId}
                        onChange={(e) => { setGroupAddId(e.target.value); setGroupAddError(""); }}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddGroupMember())}
                      />
                      <button type="button" onClick={handleAddGroupMember} disabled={!groupAddId.trim()}>
                        Добавить
                      </button>
                    </div>
                    {groupAddError && <p className="search-error">{groupAddError}</p>}
                  </div>
                )}
                {user && (
                  <button
                    type="button"
                    className="contact-info-remove-btn"
                    onClick={() => handleRemoveGroupMember(user.id)}
                  >
                    Покинуть группу
                  </button>
                )}
                {isGroupAdmin && (
                  <button
                    type="button"
                    className="contact-info-remove-btn"
                    onClick={handleDeleteChat}
                  >
                    Удалить группу
                  </button>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
