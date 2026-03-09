import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWebSocketContext } from "../context/WebSocketContext";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { getChats, getMessages, uploadFile, setPublicKey } from "../api";
import * as e2e from "../crypto/e2e";
import type { Chat, Message } from "@melon/shared";
import type { MessageItem } from "../api";

import { getUploadsBaseUrl, getWsUrl } from "../config";

export default function ChatRoom() {
  const { chatId } = useParams<{ chatId: string }>();
  const { user } = useAuth();
  const { send, ready, status, reconnect, subscribe } = useWebSocketContext();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [decryptedContent, setDecryptedContent] = useState<Record<string, string>>({});
  const [, setE2eReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { recording, duration, start: startVoice, stop: stopVoice } = useVoiceRecorder();

  const otherMember = chat?.members.find((m) => m.id !== user?.id);
  const canEncrypt = Boolean(otherMember?.publicKey && e2e.getStoredKeys());

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
    let stored = e2e.getStoredKeys();
    if (!stored) {
      e2e.generateKeyPair().then(({ publicKey, privateKey }) => {
        e2e.storeKeys(publicKey, privateKey);
        setE2eReady(true);
        setPublicKey(publicKey).catch(() => {});
      });
    } else {
      setE2eReady(true);
      setPublicKey(stored.publicKey).catch(() => {});
    }
  }, []);

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
        e2e.decrypt(m.content, otherMember.publicKey!, keys.privateKey).then((plain) => {
          setDecryptedContent((prev) => ({ ...prev, [m.id]: plain }));
        }).catch(() => {
          setDecryptedContent((prev) => ({ ...prev, [m.id]: "[decryption failed]" }));
        });
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
    if (opts.messageType === "text" && canEncrypt && content) {
      try {
        content = await e2e.encrypt(content, otherMember!.publicKey!, e2e.getStoredKeys()!.privateKey);
        encrypted = true;
      } catch (e) {
        console.error("Encrypt failed", e);
      }
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
    const input = fileInputRef.current;
    if (!input) return;
    input.accept = accept;
    input.click();
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !chatId) return;
    e.target.value = "";
    setSending(true);
    try {
      const { url } = await uploadFile(file);
      const type = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file";
      await sendMessage({
        content: file.name,
        messageType: type,
        attachmentUrl: url,
        attachmentMetadata: { fileName: file.name, mimeType: file.type, size: file.size },
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
    if (blob.size < 1000) return;
    setSending(true);
    try {
      const file = new File([blob], "voice.webm", { type: "audio/webm" });
      const { url } = await uploadFile(file);
      await sendMessage({
        content: "Voice message",
        messageType: "voice",
        attachmentUrl: url,
        attachmentMetadata: { duration: d, mimeType: "audio/webm" },
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  function displayContent(m: Message | MessageItem): string {
    if (m.encrypted && m.senderId !== user?.id && decryptedContent[m.id] !== undefined) {
      return decryptedContent[m.id];
    }
    return m.content;
  }

  const displayName = chat
    ? chat.name ?? chat.members.find((m) => m.id !== user?.id)?.username ?? "Chat"
    : "…";

  if (!chatId) {
    return (
      <div className="layout">
        <aside className="sidebar" />
        <main className="main"><div className="empty-chat">Invalid chat</div></main>
      </div>
    );
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Melon</h2>
          <Link to="/" style={{ color: "var(--muted)", textDecoration: "none", fontSize: "0.9rem" }}>← Chats</Link>
        </div>
        <div className="chat-list">
          <Link to="/" className="chat-item">
            <div className="chat-item-avatar">{displayName.slice(0, 1).toUpperCase()}</div>
            <div className="chat-item-body">
              <p className="chat-item-name">{displayName}</p>
              <p className="chat-item-preview">{canEncrypt ? "🔒 E2E" : "Current chat"}</p>
            </div>
          </Link>
        </div>
      </aside>
      <main className="main">
        <div className="chat-header">
          <h3>{displayName}</h3>
          {canEncrypt && <span className="e2e-badge">E2E</span>}
          {status === "connecting" && (
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }} title={getWsUrl()}>
              Connecting…
            </span>
          )}
          {status === "auth_failed" && <span style={{ fontSize: "0.8rem", color: "var(--danger)" }}>Session expired. Log out and log in again.</span>}
          {status === "failed" && (
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              Disconnected.{" "}
              <button type="button" onClick={reconnect} className="link-button">Retry</button>
              {" "}(or log out and log in)
            </span>
          )}
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
                {m.sender && m.senderId !== user?.id && (
                  <div className="message-sender">{m.sender.username}</div>
                )}
                {(m.messageType ?? "text") === "text" && (
                  <p className="message-content">{displayContent(m)}</p>
                )}
                {(m.messageType ?? "text") === "image" && m.attachmentUrl && (
                  <a href={m.attachmentUrl.startsWith("http") ? m.attachmentUrl : `${getUploadsBaseUrl()}${m.attachmentUrl}`} target="_blank" rel="noopener noreferrer">
                    <img src={m.attachmentUrl.startsWith("http") ? m.attachmentUrl : `${getUploadsBaseUrl()}${m.attachmentUrl}`} alt="" className="message-image" />
                  </a>
                )}
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
                    <audio controls src={m.attachmentUrl.startsWith("http") ? m.attachmentUrl : `${getUploadsBaseUrl()}${m.attachmentUrl}`} />
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
      </main>
    </div>
  );
}
