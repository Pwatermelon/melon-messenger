import { getMessage as scyllaGetMessage, getMessages as scyllaGetMessages } from "./scylla";
import { upsertReadCursor } from "./readReceipts";
import { resetUnreadCount } from "./chatUnread";

export async function advanceReadCursor(
  chatId: string,
  userId: string,
  messageId?: string | null
): Promise<{ advanced: boolean; messageId: string | null; updatedAt: string | null }> {
  const target = messageId?.trim().toLowerCase() || null;
  if (!target) {
    return { advanced: false, messageId: null, updatedAt: null };
  }
  const row = await scyllaGetMessage(chatId, target);
  const canonicalId = row ? String(row.message_id).trim().toLowerCase() : target;
  const { advanced, messageId: cursorId, updatedAt } = await upsertReadCursor(chatId, userId, canonicalId);
  // Always reset counter — cursor may already be advanced but postgres counter can be stale.
  await resetUnreadCount(chatId, userId);
  return { advanced, messageId: cursorId, updatedAt };
}

/** Mark chat read up to the latest message (sidebar «Прочитать»). */
export async function markChatFullyRead(
  chatId: string,
  userId: string
): Promise<{ advanced: boolean; messageId: string | null; updatedAt: string | null }> {
  const rows = await scyllaGetMessages(chatId, 1);
  const latest = rows[0];
  if (!latest) {
    await resetUnreadCount(chatId, userId);
    return { advanced: false, messageId: null, updatedAt: null };
  }
  const messageId = String(latest.message_id).trim().toLowerCase();
  return advanceReadCursor(chatId, userId, messageId);
}
