import { getMessages as scyllaGetMessages } from "./scylla";
import { upsertReadCursor } from "./readReceipts";
import { resetUnreadCount } from "./chatUnread";

export async function advanceReadCursor(
  chatId: string,
  userId: string,
  messageId?: string | null
): Promise<{ advanced: boolean; messageId: string | null }> {
  let target = messageId?.trim() || null;
  if (!target) {
    const [latest] = await scyllaGetMessages(chatId, 1);
    if (!latest?.message_id) {
      await resetUnreadCount(chatId, userId);
      return { advanced: false, messageId: null };
    }
    target = latest.message_id;
  }
  const advanced = await upsertReadCursor(chatId, userId, target);
  await resetUnreadCount(chatId, userId);
  return { advanced, messageId: target };
}
