import { Elysia } from "elysia";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { authPlugin, requireAuth } from "../auth";
import { db, users, chats, chatMembers } from "../db";
import { getMessages as scyllaGetMessages } from "../services/scylla";

function toUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    avatarUrl: u.avatarUrl,
    publicKey: u.publicKey ?? null,
    createdAt: u.createdAt?.toISOString?.(),
  };
}

export const chatRoutes = new Elysia({ prefix: "/chats" })
  .use(authPlugin)
  .get("/users/search", async ({ user, query, set }) => {
    const u = requireAuth(set)(user);
    const q = (query.q as string)?.trim();
    if (!q || q.length < 2) {
      return { users: [] };
    }
    const list = await db
      .select()
      .from(users)
      .where(sql`${users.username} ilike ${"%" + q + "%"} AND ${users.id} != ${u.id}`)
      .limit(20);
    return { users: list.map(toUser) };
  })
  .get("/", async ({ user, set }) => {
    const u = requireAuth(set)(user);
    const memberChats = await db
      .select({
        chatId: chatMembers.chatId,
        role: chatMembers.role,
        chat: chats,
      })
      .from(chatMembers)
      .innerJoin(chats, eq(chats.id, chatMembers.chatId))
      .where(eq(chatMembers.userId, u.id))
      .orderBy(desc(chats.createdAt));

    const result = await Promise.all(
      memberChats.map(async (row) => {
        const members = await db
          .select({ user: users, role: chatMembers.role })
          .from(chatMembers)
          .innerJoin(users, eq(users.id, chatMembers.userId))
          .where(eq(chatMembers.chatId, row.chatId));
        let lastMessagePreview: string | null = null;
        let lastMessageAt: string | null = null;
        try {
          const [first] = await scyllaGetMessages(row.chatId, 1);
          if (first) {
            lastMessagePreview = first.content.slice(0, 80);
            lastMessageAt = first.created_at?.toISOString?.() ?? null;
          }
        } catch {
          // Scylla might be unavailable
        }
        return {
          id: row.chat.id,
          type: row.chat.type,
          name: row.chat.name,
          createdAt: row.chat.createdAt?.toISOString?.(),
          lastMessageAt,
          lastMessagePreview,
          members: members.map((m) => ({ ...toUser(m.user), role: m.role })),
        };
      })
    );
    return result;
  })
  .post("/dm", async ({ user, body, set }) => {
    const u = requireAuth(set)(user);
    const { userId: otherUserId } = body as { userId?: string };
    if (!otherUserId) {
      set.status = 400;
      return { error: "userId is required" };
    }
    if (otherUserId === u.id) {
      set.status = 400;
      return { error: "Cannot create DM with yourself" };
    }
    const [other] = await db.select().from(users).where(eq(users.id, otherUserId)).limit(1);
    if (!other) {
      set.status = 404;
      return { error: "User not found" };
    }
    const bothMembers = await db
      .select({ chatId: chatMembers.chatId })
      .from(chatMembers)
      .innerJoin(chats, eq(chats.id, chatMembers.chatId))
      .where(and(eq(chats.type, "dm"), inArray(chatMembers.userId, [u.id, otherUserId])));
    const chatIdCount = new Map<string, number>();
    for (const row of bothMembers) {
      chatIdCount.set(row.chatId, (chatIdCount.get(row.chatId) ?? 0) + 1);
    }
    const existingDmId = [...chatIdCount.entries()].find(([, c]) => c === 2)?.[0];
    if (existingDmId) {
      const [chat] = await db.select().from(chats).where(eq(chats.id, existingDmId)).limit(1);
      const members = await db
        .select({ user: users, role: chatMembers.role })
        .from(chatMembers)
        .innerJoin(users, eq(users.id, chatMembers.userId))
        .where(eq(chatMembers.chatId, chat.id));
      return {
        id: chat.id,
        type: chat.type,
        name: chat.name,
        createdAt: chat.createdAt?.toISOString?.(),
        lastMessageAt: null,
        lastMessagePreview: null,
        members: members.map((m) => ({ ...toUser(m.user), role: m.role })),
      };
    }
    const [chat] = await db.insert(chats).values({ type: "dm" }).returning();
    await db.insert(chatMembers).values([
      { chatId: chat.id, userId: u.id, role: "member" },
      { chatId: chat.id, userId: otherUserId, role: "member" },
    ]);
    const members = await db
      .select({ user: users, role: chatMembers.role })
      .from(chatMembers)
      .innerJoin(users, eq(users.id, chatMembers.userId))
      .where(eq(chatMembers.chatId, chat.id));
    return {
      id: chat.id,
      type: chat.type,
      name: chat.name,
      createdAt: chat.createdAt?.toISOString?.(),
      lastMessageAt: null,
      lastMessagePreview: null,
      members: members.map((m) => ({ ...toUser(m.user), role: m.role })),
    };
  })
  .get("/:id/messages", async ({ user, params, query, set }) => {
    const u = requireAuth(set)(user);
    const { id: chatId } = params;
    const limit = Math.min(Number(query.limit) || 50, 100);
    const before = (query.before as string) || undefined;
    const [member] = await db
      .select()
      .from(chatMembers)
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, u.id)))
      .limit(1);
    if (!member) {
      set.status = 403;
      return { error: "Not a member of this chat" };
    }
    const rows = await scyllaGetMessages(chatId, limit, before);
    const userIds = [...new Set(rows.map((r) => r.sender_id))];
    const userMap = new Map<string, typeof users.$inferSelect>();
    if (userIds.length) {
      const list = await db.select().from(users).where(inArray(users.id, userIds));
      list.forEach((us) => userMap.set(us.id, us));
    }
    const messages = rows.map((r) => {
      let attachmentMetadata = null;
      try {
        if (r.attachment_metadata) attachmentMetadata = JSON.parse(r.attachment_metadata) as import("@melon/shared").AttachmentMetadata;
      } catch {}
      return {
        id: r.message_id,
        chatId: r.chat_id,
        senderId: r.sender_id,
        content: r.content,
        createdAt: r.created_at?.toISOString?.(),
        sender: userMap.get(r.sender_id) ? toUser(userMap.get(r.sender_id)!) : undefined,
        messageType: (r.message_type as import("@melon/shared").MessageType) ?? "text",
        attachmentUrl: r.attachment_url ?? null,
        attachmentMetadata,
        encrypted: r.encrypted ?? false,
      };
    });
    return { messages };
  });
