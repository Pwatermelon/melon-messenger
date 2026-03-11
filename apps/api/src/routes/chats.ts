import { Elysia } from "elysia";
import { eq, and, inArray, desc } from "drizzle-orm";
import { authPlugin, requireAuth } from "../auth";
import { db, users, chats, chatMembers } from "../db";
import { getMessages as scyllaGetMessages, deleteChatMessages } from "../services/scylla";

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
  .get("/users/:id", async ({ user, params, set }) => {
    const u = requireAuth(set)(user);
    const id = (params as { id?: string }).id?.trim();
    if (!id || id === u.id) {
      set.status = 404;
      return { error: "User not found" };
    }
    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) {
      set.status = 404;
      return { error: "User not found" };
    }
    return toUser(target);
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
            lastMessagePreview = first.encrypted ? "🔒 Зашифрованное сообщение" : first.content.slice(0, 80);
            lastMessageAt = first.created_at?.toISOString?.() ?? null;
          }
        } catch {
          // Scylla might be unavailable
        }
        return {
          id: row.chat.id,
          type: row.chat.type,
          name: row.chat.name,
          avatarUrl: row.chat.avatarUrl,
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
        avatarUrl: chat.avatarUrl,
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
      avatarUrl: chat.avatarUrl,
      createdAt: chat.createdAt?.toISOString?.(),
      lastMessageAt: null,
      lastMessagePreview: null,
      members: members.map((m) => ({ ...toUser(m.user), role: m.role })),
    };
  })
  .post("/group", async ({ user, body, set }) => {
    const u = requireAuth(set)(user);
    const { name, memberIds } = body as { name?: string; memberIds?: string[] };
    if (!name?.trim()) {
      set.status = 400;
      return { error: "name is required" };
    }
    const ids = Array.isArray(memberIds) ? [...new Set(memberIds)].filter((id) => id !== u.id) : [];
    if (ids.length > 0) {
      const existing = await db.select().from(users).where(inArray(users.id, ids));
      if (existing.length !== ids.length) {
        set.status = 400;
        return { error: "Some users not found" };
      }
    }
    const [chat] = await db.insert(chats).values({ type: "group", name: name.trim() }).returning();
    await db.insert(chatMembers).values([
      { chatId: chat.id, userId: u.id, role: "admin" },
      ...ids.map((userId) => ({ chatId: chat.id, userId, role: "member" as const })),
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
      avatarUrl: chat.avatarUrl,
      createdAt: chat.createdAt?.toISOString?.(),
      lastMessageAt: null,
      lastMessagePreview: null,
      members: members.map((m) => ({ ...toUser(m.user), role: m.role })),
    };
  })
  .get("/:id", async ({ user, params, set }) => {
    const u = requireAuth(set)(user);
    const { id: chatId } = params;
    const [chatRow] = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
    if (!chatRow) {
      set.status = 404;
      return { error: "Chat not found" };
    }
    const [myMember] = await db.select().from(chatMembers).where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, u.id))).limit(1);
    if (!myMember) {
      set.status = 403;
      return { error: "Not a member" };
    }
    const members = await db
      .select({ user: users, role: chatMembers.role })
      .from(chatMembers)
      .innerJoin(users, eq(users.id, chatMembers.userId))
      .where(eq(chatMembers.chatId, chatId));
    let lastMessagePreview: string | null = null;
    let lastMessageAt: string | null = null;
    try {
      const [first] = await scyllaGetMessages(chatId, 1);
      if (first) {
        lastMessagePreview = first.encrypted ? "🔒 Зашифрованное сообщение" : first.content.slice(0, 80);
        lastMessageAt = first.created_at?.toISOString?.() ?? null;
      }
    } catch {}
    return {
      id: chatRow.id,
      type: chatRow.type,
      name: chatRow.name,
      avatarUrl: chatRow.avatarUrl,
      createdAt: chatRow.createdAt?.toISOString?.(),
      lastMessageAt,
      lastMessagePreview,
      members: members.map((m) => ({ ...toUser(m.user), role: m.role })),
    };
  })
  .post("/:id/members", async ({ user, params, body, set }) => {
    const u = requireAuth(set)(user);
    const { id: chatId } = params;
    const [chatRow] = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
    if (!chatRow || chatRow.type !== "group") {
      set.status = 404;
      return { error: "Group not found" };
    }
    const [myMember] = await db.select().from(chatMembers).where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, u.id))).limit(1);
    if (!myMember || myMember.role !== "admin") {
      set.status = 403;
      return { error: "Only admin can add members" };
    }
    const { userIds } = body as { userIds?: string[] };
    const ids = Array.isArray(userIds) ? [...new Set(userIds)].filter((id) => id && id !== u.id) : [];
    if (ids.length === 0) {
      set.status = 400;
      return { error: "userIds required" };
    }
    const existingUsers = await db.select().from(users).where(inArray(users.id, ids));
    if (existingUsers.length !== ids.length) {
      set.status = 400;
      return { error: "Some users not found" };
    }
    const alreadyIn = await db.select({ userId: chatMembers.userId }).from(chatMembers).where(eq(chatMembers.chatId, chatId));
    const alreadySet = new Set(alreadyIn.map((r) => r.userId));
    const toAdd = ids.filter((id) => !alreadySet.has(id));
    if (toAdd.length > 0) {
      await db.insert(chatMembers).values(toAdd.map((userId) => ({ chatId, userId, role: "member" as const })));
    }
    const members = await db
      .select({ user: users, role: chatMembers.role })
      .from(chatMembers)
      .innerJoin(users, eq(users.id, chatMembers.userId))
      .where(eq(chatMembers.chatId, chatId));
    let lastMessagePreview: string | null = null;
    let lastMessageAt: string | null = null;
    try {
      const [first] = await scyllaGetMessages(chatId, 1);
      if (first) {
        lastMessagePreview = first.encrypted ? "🔒 Зашифрованное сообщение" : first.content.slice(0, 80);
        lastMessageAt = first.created_at?.toISOString?.() ?? null;
      }
    } catch {}
    return {
      id: chatRow.id,
      type: chatRow.type,
      name: chatRow.name,
      createdAt: chatRow.createdAt?.toISOString?.(),
      lastMessageAt,
      lastMessagePreview,
      members: members.map((m) => ({ ...toUser(m.user), role: m.role })),
    };
  })
  .delete("/:id/members/:userId", async ({ user, params, set }) => {
    const u = requireAuth(set)(user);
    const { id: chatId, userId: targetUserId } = params;
    const [chatRow] = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
    if (!chatRow || chatRow.type !== "group") {
      set.status = 404;
      return { error: "Group not found" };
    }
    const [myMember] = await db.select().from(chatMembers).where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, u.id))).limit(1);
    if (!myMember) {
      set.status = 403;
      return { error: "Not a member" };
    }
    if (targetUserId !== u.id && myMember.role !== "admin") {
      set.status = 403;
      return { error: "Only admin can remove other members" };
    }
    await db.delete(chatMembers).where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, targetUserId)));
    const members = await db
      .select({ user: users, role: chatMembers.role })
      .from(chatMembers)
      .innerJoin(users, eq(users.id, chatMembers.userId))
      .where(eq(chatMembers.chatId, chatId));
    let lastMessagePreview: string | null = null;
    let lastMessageAt: string | null = null;
    try {
      const [first] = await scyllaGetMessages(chatId, 1);
      if (first) {
        lastMessagePreview = first.encrypted ? "🔒 Зашифрованное сообщение" : first.content.slice(0, 80);
        lastMessageAt = first.created_at?.toISOString?.() ?? null;
      }
    } catch {}
    return {
      id: chatRow.id,
      type: chatRow.type,
      name: chatRow.name,
      avatarUrl: chatRow.avatarUrl,
      createdAt: chatRow.createdAt?.toISOString?.(),
      lastMessageAt,
      lastMessagePreview,
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
    return { messages: messages.slice().reverse() };
  })
  .put("/:id", async ({ user, params, body, set }) => {
    const u = requireAuth(set)(user);
    const { id: chatId } = params;
    const [chatRow] = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
    if (!chatRow) {
      set.status = 404;
      return { error: "Chat not found" };
    }
    if (chatRow.type !== "group") {
      set.status = 400;
      return { error: "Only groups can be updated" };
    }
    const [myMember] = await db
      .select()
      .from(chatMembers)
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, u.id)))
      .limit(1);
    if (!myMember || myMember.role !== "admin") {
      set.status = 403;
      return { error: "Only admin can update group" };
    }
    const payload = body as { name?: string; avatarUrl?: string | null };
    const updates: Partial<typeof chats.$inferInsert> = {};
    if (typeof payload.name === "string") {
      const trimmed = payload.name.trim();
      if (!trimmed) {
        set.status = 400;
        return { error: "name cannot be empty" };
      }
      updates.name = trimmed;
    }
    if ("avatarUrl" in payload) {
      if (payload.avatarUrl == null) {
        updates.avatarUrl = null;
      } else if (typeof payload.avatarUrl === "string") {
        updates.avatarUrl = payload.avatarUrl.trim() || null;
      }
    }
    if (Object.keys(updates).length === 0) {
      return {
        id: chatRow.id,
        type: chatRow.type,
        name: chatRow.name,
        avatarUrl: chatRow.avatarUrl,
        createdAt: chatRow.createdAt?.toISOString?.(),
        lastMessageAt: null,
        lastMessagePreview: null,
        members: [] as unknown as Array<ReturnType<typeof toUser> & { role: string }>,
      };
    }
    const [updatedChat] = await db
      .update(chats)
      .set(updates)
      .where(eq(chats.id, chatId))
      .returning();
    const members = await db
      .select({ user: users, role: chatMembers.role })
      .from(chatMembers)
      .innerJoin(users, eq(users.id, chatMembers.userId))
      .where(eq(chatMembers.chatId, chatId));
    let lastMessagePreview: string | null = null;
    let lastMessageAt: string | null = null;
    try {
      const [first] = await scyllaGetMessages(chatId, 1);
      if (first) {
        lastMessagePreview = first.encrypted ? "🔒 Зашифрованное сообщение" : first.content.slice(0, 80);
        lastMessageAt = first.created_at?.toISOString?.() ?? null;
      }
    } catch {}
    return {
      id: updatedChat.id,
      type: updatedChat.type,
      name: updatedChat.name,
      avatarUrl: updatedChat.avatarUrl,
      createdAt: updatedChat.createdAt?.toISOString?.(),
      lastMessageAt,
      lastMessagePreview,
      members: members.map((m) => ({ ...toUser(m.user), role: m.role })),
    };
  })
  .delete("/:id", async ({ user, params, set }) => {
    const u = requireAuth(set)(user);
    const { id: chatId } = params;
    const [chatRow] = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
    if (!chatRow) {
      set.status = 404;
      return { error: "Chat not found" };
    }
    const [member] = await db
      .select()
      .from(chatMembers)
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, u.id)))
      .limit(1);
    if (!member) {
      set.status = 403;
      return { error: "Not a member of this chat" };
    }

    if (chatRow.type === "group") {
      if (member.role !== "admin") {
        set.status = 403;
        return { error: "Only admin can delete group" };
      }
      await db.delete(chatMembers).where(eq(chatMembers.chatId, chatId));
      await db.delete(chats).where(eq(chats.id, chatId));
      await deleteChatMessages(chatId).catch(() => {});
      return { success: true };
    }

    await db
      .delete(chatMembers)
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, u.id)));
    const remaining = await db
      .select()
      .from(chatMembers)
      .where(eq(chatMembers.chatId, chatId))
      .limit(1);
    if (remaining.length === 0) {
      await db.delete(chats).where(eq(chats.id, chatId));
      await deleteChatMessages(chatId).catch(() => {});
    }
    return { success: true };
  });
