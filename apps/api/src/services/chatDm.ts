import { and, eq, inArray } from "drizzle-orm";
import { db, chats, chatMembers, users } from "../db";
import { getMessages as scyllaGetMessages } from "./scylla";

export async function findDmChatId(userA: string, userB: string): Promise<string | null> {
  const bothMembers = await db
    .select({ chatId: chatMembers.chatId })
    .from(chatMembers)
    .innerJoin(chats, eq(chats.id, chatMembers.chatId))
    .where(and(eq(chats.type, "dm"), inArray(chatMembers.userId, [userA, userB])));
  const chatIdCount = new Map<string, number>();
  for (const row of bothMembers) {
    chatIdCount.set(row.chatId, (chatIdCount.get(row.chatId) ?? 0) + 1);
  }
  return [...chatIdCount.entries()].find(([, c]) => c === 2)?.[0] ?? null;
}

export async function chatHasMessages(chatId: string): Promise<boolean> {
  try {
    const [first] = await scyllaGetMessages(chatId, 1);
    return Boolean(first);
  } catch {
    return false;
  }
}

export async function getOrCreateDmChat(userA: string, userB: string) {
  const existingId = await findDmChatId(userA, userB);
  if (existingId) {
    const [chat] = await db.select().from(chats).where(eq(chats.id, existingId)).limit(1);
    if (!chat) throw new Error("DM chat not found");
    const members = await db
      .select({ user: users, role: chatMembers.role })
      .from(chatMembers)
      .innerJoin(users, eq(users.id, chatMembers.userId))
      .where(eq(chatMembers.chatId, chat.id));
    return { chat, members, created: false };
  }
  const [chat] = await db.insert(chats).values({ type: "dm" }).returning();
  await db.insert(chatMembers).values([
    { chatId: chat.id, userId: userA, role: "member" },
    { chatId: chat.id, userId: userB, role: "member" },
  ]);
  const members = await db
    .select({ user: users, role: chatMembers.role })
    .from(chatMembers)
    .innerJoin(users, eq(users.id, chatMembers.userId))
    .where(eq(chatMembers.chatId, chat.id));
  return { chat, members, created: true };
}
