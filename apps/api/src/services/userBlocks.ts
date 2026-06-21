import { and, eq, or } from "drizzle-orm";
import { db, userBlocks } from "../db";

export async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const [row] = await db
    .select({ blockerId: userBlocks.blockerId })
    .from(userBlocks)
    .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)))
    .limit(1);
  return Boolean(row);
}

/** True if either user has blocked the other (no messaging in DM). */
export async function areUsersBlocked(userA: string, userB: string): Promise<boolean> {
  const [row] = await db
    .select({ blockerId: userBlocks.blockerId })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, userA), eq(userBlocks.blockedId, userB)),
        and(eq(userBlocks.blockerId, userB), eq(userBlocks.blockedId, userA))
      )
    )
    .limit(1);
  return Boolean(row);
}

export async function getDmBlockStatus(
  viewerId: string,
  otherUserId: string
): Promise<{ blockedByMe: boolean; blockedByPeer: boolean }> {
  const [blockedByMe, blockedByPeer] = await Promise.all([
    isBlocked(viewerId, otherUserId),
    isBlocked(otherUserId, viewerId),
  ]);
  return { blockedByMe, blockedByPeer };
}

/** Blocker blocked sender — reject message to that recipient. */
export async function isSenderBlockedByRecipient(
  senderId: string,
  recipientIds: string[]
): Promise<boolean> {
  for (const recipientId of recipientIds) {
    if (recipientId === senderId) continue;
    if (await isBlocked(recipientId, senderId)) return true;
    if (await isBlocked(senderId, recipientId)) return true;
  }
  return false;
}
