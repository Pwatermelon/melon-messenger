import type { AttachmentMetadata, Message, MessageType } from "@melon/shared";
import { isDefaultMediaContent } from "./mediaCaption";

export function messagePreviewText(
  m: Pick<Message, "content" | "messageType" | "attachmentMetadata" | "attachmentUrl">
): string {
  const mt = m.messageType ?? "text";
  const c = m.content.trim();
  switch (mt) {
    case "image": {
      if (c && !isDefaultMediaContent(c, "image")) return c.slice(0, 160);
      const album = m.attachmentMetadata?.attachments;
      if (album && album.length > 1) {
        return `${album.length} фото`;
      }
      if (
        m.attachmentMetadata?.mimeType === "image/gif" ||
        /\.gif$/i.test(m.attachmentUrl?.split("?")[0] ?? "") ||
        c === "GIF"
      ) {
        return "GIF";
      }
      return "Фотография";
    }
    case "voice":
      return "Голосовое сообщение";
    case "circle":
      return "Кружок";
    case "video":
      if (c && !isDefaultMediaContent(c, "video")) return c.slice(0, 160);
      return "Видео";
    case "file":
      if (c && !isDefaultMediaContent(c, "file", m.attachmentMetadata?.fileName)) return c.slice(0, 160);
      return "Файл";
    case "location":
      return "Геопозиция";
    case "sticker":
      return m.attachmentMetadata?.emoji ? `${m.attachmentMetadata.emoji} Стикер` : "Стикер";
    case "system":
      return m.content.trim().slice(0, 160) || "Событие";
    default:
      return m.content.trim().slice(0, 160) || "Сообщение";
  }
}

export function buildReplyTo(m: Message): NonNullable<AttachmentMetadata["replyTo"]> {
  return {
    messageId: m.id,
    senderId: m.senderId,
    senderName: m.sender?.username ?? "Пользователь",
    preview: messagePreviewText(m),
    messageType: (m.messageType ?? "text") as MessageType,
  };
}
