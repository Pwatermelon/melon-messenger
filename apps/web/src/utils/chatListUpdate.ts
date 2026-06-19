import type { Chat, Message } from "@melon/shared";
import { messagePreviewText } from "./messagePreview";

/** Keep server rows as source of truth; retain local-only chats (e.g. just-created DM before list refresh). */
export function mergeChatLists(local: Chat[], server: Chat[]): Chat[] {
  const serverIds = new Set(server.map((c) => c.id));
  const localOnly = local.filter((c) => !serverIds.has(c.id));
  return sortChatsByRecent([...server, ...localOnly]);
}

export function upsertChatInList(chats: Chat[], chat: Chat): Chat[] {
  const prior = chats.find((c) => c.id === chat.id);
  const merged: Chat = {
    ...(prior ?? {}),
    ...chat,
    unreadCount: prior?.unreadCount ?? chat.unreadCount ?? 0,
  };
  return sortChatsByRecent([merged, ...chats.filter((c) => c.id !== chat.id)]);
}

export function sortChatsByRecent(chats: Chat[]): Chat[] {
  return [...chats].sort((a, b) => {
    const at = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
    const bt = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
    if (bt !== at) return bt - at;
    const ac = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bc = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bc - ac;
  });
}

export function applyMessageToChatList(chats: Chat[], message: Pick<Message, "chatId" | "createdAt" | "content" | "messageType">): Chat[] {
  const i = chats.findIndex((c) => c.id === message.chatId);
  if (i < 0) return chats;
  const cur = chats[i]!;
  if (cur.lastMessageAt && cur.lastMessageAt > message.createdAt) return chats;

  const preview = messagePreviewText(message).slice(0, 80);
  const isNewer = !cur.lastMessageAt || message.createdAt > cur.lastMessageAt;

  if (!isNewer) {
    if (cur.lastMessageAt === message.createdAt && cur.lastMessagePreview !== preview) {
      const copy = [...chats];
      copy[i] = { ...cur, lastMessagePreview: preview };
      return copy;
    }
    return chats;
  }

  const copy = [...chats];
  copy[i] = {
    ...cur,
    lastMessageAt: message.createdAt,
    lastMessagePreview: preview,
  };
  const [moved] = copy.splice(i, 1);
  copy.unshift(moved);
  return copy;
}
