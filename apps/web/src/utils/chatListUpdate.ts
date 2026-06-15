import type { Chat, Message } from "@melon/shared";
import { messagePreviewText } from "./messagePreview";

export function applyMessageToChatList(chats: Chat[], message: Pick<Message, "chatId" | "createdAt" | "content" | "messageType">): Chat[] {
  const i = chats.findIndex((c) => c.id === message.chatId);
  if (i < 0) return chats;
  const cur = chats[i]!;
  if (cur.lastMessageAt && cur.lastMessageAt > message.createdAt) return chats;
  const preview = messagePreviewText(message).slice(0, 80);
  if (cur.lastMessageAt === message.createdAt && cur.lastMessagePreview === preview) return chats;
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
