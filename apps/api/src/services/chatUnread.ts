import { db } from "../db";
import { sql } from "drizzle-orm";
import { countUnreadMessages as scyllaCountUnreadMessages } from "./scylla";

function rowsFromExecute<T>(result: unknown): T[] {
  const rows = (result as { rows?: T[] }).rows ?? result;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

export async function getUnreadCount(chatId: string, userId: string): Promise<number | null> {
  const result = await db.execute<{ unread_count: number }>(sql`
    SELECT unread_count FROM chat_unread_counts
    WHERE chat_id = ${chatId}::uuid AND user_id = ${userId}::uuid
    LIMIT 1
  `);
  const row = rowsFromExecute(result)[0];
  return row ? Number(row.unread_count) : null;
}

export async function getUnreadCountsByChat(userId: string): Promise<Map<string, number>> {
  const result = await db.execute<{ chat_id: string; unread_count: number }>(sql`
    SELECT chat_id, unread_count FROM chat_unread_counts WHERE user_id = ${userId}::uuid
  `);
  const map = new Map<string, number>();
  for (const row of rowsFromExecute(result)) {
    map.set(String(row.chat_id), Number(row.unread_count));
  }
  return map;
}

export async function setUnreadCount(chatId: string, userId: string, count: number): Promise<void> {
  const safe = Math.max(0, Math.floor(count));
  await db.execute(sql`
    INSERT INTO chat_unread_counts (chat_id, user_id, unread_count, updated_at)
    VALUES (${chatId}::uuid, ${userId}::uuid, ${safe}, now())
    ON CONFLICT (chat_id, user_id) DO UPDATE SET
      unread_count = EXCLUDED.unread_count,
      updated_at = now()
  `);
}

export async function resetUnreadCount(chatId: string, userId: string): Promise<void> {
  await setUnreadCount(chatId, userId, 0);
}

export async function incrementUnreadForChat(chatId: string, senderId: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO chat_unread_counts (chat_id, user_id, unread_count, updated_at)
    SELECT ${chatId}::uuid, user_id, 1, now()
    FROM chat_members
    WHERE chat_id = ${chatId}::uuid AND user_id != ${senderId}::uuid
    ON CONFLICT (chat_id, user_id) DO UPDATE SET
      unread_count = chat_unread_counts.unread_count + 1,
      updated_at = now()
  `);
}

/** Postgres counter; one-time Scylla backfill when row is missing (migration). */
export async function resolveUnreadCount(
  chatId: string,
  userId: string,
  lastReadMessageId: string | null
): Promise<number> {
  const existing = await getUnreadCount(chatId, userId);
  let count = existing;
  if (count === null) {
    try {
      count = await scyllaCountUnreadMessages(chatId, lastReadMessageId, userId);
    } catch {
      count = 0;
    }
    await setUnreadCount(chatId, userId, count);
    return count;
  }
  if (count > 0) {
    try {
      const actual = await scyllaCountUnreadMessages(chatId, lastReadMessageId, userId);
      if (actual !== count) {
        await setUnreadCount(chatId, userId, actual);
        return actual;
      }
    } catch {
      // keep postgres value
    }
  }
  return count;
}
