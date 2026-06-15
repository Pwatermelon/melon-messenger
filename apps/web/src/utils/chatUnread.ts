import type { Message } from "@melon/shared";

export type UnreadBounds = {
  first: Message | null;
  last: Message | null;
  count: number;
};

export function compareMessageId(a: string, b: string): number {
  return a.toLowerCase().localeCompare(b.toLowerCase());
}

export function isCountableMessage(m: Message): boolean {
  return (m.messageType ?? "text") !== "system";
}

export function isUnreadIncoming(
  m: Message,
  lastReadMessageId: string | null | undefined,
  userId: string
): boolean {
  if (!isCountableMessage(m)) return false;
  if (m.senderId === userId) return false;
  if (!lastReadMessageId) return true;
  return compareMessageId(m.id, lastReadMessageId) > 0;
}

export function findUnreadBounds(
  messages: Message[],
  lastReadMessageId: string | null | undefined,
  userId: string
): UnreadBounds {
  const unread = messages.filter((m) => isUnreadIncoming(m, lastReadMessageId, userId));
  return {
    first: unread[0] ?? null,
    last: unread[unread.length - 1] ?? null,
    count: unread.length,
  };
}

export function countUnreadBelowViewport(
  listEl: HTMLElement,
  messages: Message[],
  lastReadMessageId: string | null | undefined,
  userId: string
): number {
  const listBottom = listEl.getBoundingClientRect().bottom - 12;
  let count = 0;
  for (const m of messages) {
    if (!isUnreadIncoming(m, lastReadMessageId, userId)) continue;
    const el = listEl.querySelector(`[data-message-id="${m.id}"]`);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.top >= listBottom) count += 1;
  }
  return count;
}

export function isMessageBelowViewport(listEl: HTMLElement, messageId: string, margin = 12): boolean {
  const el = listEl.querySelector(`[data-message-id="${messageId}"]`);
  if (!el) return false;
  const listBottom = listEl.getBoundingClientRect().bottom - margin;
  return el.getBoundingClientRect().bottom > listBottom;
}

export function scrollListToMessage(
  listEl: HTMLElement,
  messageId: string,
  block: "start" | "center" | "end" = "center",
  margin = 12
): boolean {
  const el = listEl.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement | null;
  if (!el) return false;
  const elTop = el.offsetTop;
  const elHeight = el.offsetHeight;
  let target: number;
  if (block === "start") target = elTop - margin;
  else if (block === "end") target = elTop + elHeight - listEl.clientHeight + margin;
  else target = elTop - (listEl.clientHeight - elHeight) / 2;
  listEl.scrollTop = Math.max(0, target);
  return true;
}
