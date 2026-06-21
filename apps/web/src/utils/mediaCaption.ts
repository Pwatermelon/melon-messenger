import type { Message, MessageType } from "@melon/shared";

export function isDefaultImageContent(content: string): boolean {
  const c = content.trim();
  return c === "Фотография" || c === "GIF" || /^\d+ фото$/.test(c);
}

export function isDefaultMediaContent(
  content: string,
  messageType: MessageType,
  fileName?: string | null
): boolean {
  const c = content.trim();
  if (!c) return true;
  if (messageType === "image") return isDefaultImageContent(c);
  if (messageType === "video") return c === "Видео";
  if (messageType === "file") return Boolean(fileName && c === fileName.trim());
  return false;
}

export function mediaMessageCaption(m: Pick<Message, "content" | "messageType" | "attachmentMetadata">): string | null {
  const mt = m.messageType ?? "text";
  if (mt !== "image" && mt !== "video" && mt !== "file") return null;
  const c = m.content.trim();
  if (!c || isDefaultMediaContent(c, mt, m.attachmentMetadata?.fileName)) return null;
  return c;
}

export function resolveMediaCaption(caption: string | undefined, fallback: string): string {
  const trimmed = caption?.trim();
  return trimmed || fallback;
}
