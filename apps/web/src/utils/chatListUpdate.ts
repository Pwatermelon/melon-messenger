import type { Chat, Message } from "@melon/shared";
import { messagePreviewText } from "./messagePreview";

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
