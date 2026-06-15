import type { AttachmentMetadata, Message, MessageType } from "@melon/shared";

export function messagePreviewText(
  m: Pick<Message, "content" | "messageType" | "attachmentMetadata" | "attachmentUrl">
): string {
  const mt = m.messageType ?? "text";
  switch (mt) {
    case "image": {
      const album = m.attachmentMetadata?.attachments;
      if (album && album.length > 1) {
        return `${album.length} фото`;
      }
      if (
        m.attachmentMetadata?.mimeType === "image/gif" ||
        /\.gif$/i.test(m.attachmentUrl?.split("?")[0] ?? "") ||
        m.content === "GIF"
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
      return "Видео";
    case "file":
      return "Файл";
    case "location":
      return "Геопозиция";
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
