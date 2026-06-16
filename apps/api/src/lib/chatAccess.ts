import { and, eq, inArray } from "drizzle-orm";
import { db, chatMembers } from "../db";

/** True if both users are members of at least one chat (DM or group). */
export async function usersShareChat(userA: string, userB: string): Promise<boolean> {
  if (userA === userB) return true;

  const targetChatIds = db
    .select({ chatId: chatMembers.chatId })
    .from(chatMembers)
    .where(eq(chatMembers.userId, userB));

  const [row] = await db
    .select({ chatId: chatMembers.chatId })
    .from(chatMembers)
    .where(and(eq(chatMembers.userId, userA), inArray(chatMembers.chatId, targetChatIds)))
    .limit(1);

  return Boolean(row);
}
