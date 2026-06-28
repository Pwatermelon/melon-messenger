import { and, eq, inArray } from "drizzle-orm";
import {
  chatMembers,
  chats,
  db,
  mediaFiles,
  stickerPacks,
  stickers,
  users,
  type User,
} from "../db";
import { parseAvatarHistory, parseProfilePhotos } from "../lib/userDto";
import { canonicalUploadsPath } from "./mediaAccess";
import { getMediaStorage, storageKeyFromPath } from "./mediaStorage";
import { deleteChatMessages, deleteMessagesBySender } from "./scylla";
import { publishChatEvent, kickUserFromChat } from "../ws";
import { disconnectUser } from "../wsRegistry";

function collectProfileMediaPaths(user: User): string[] {
  const paths = new Set<string>();
  const add = (p: string | null | undefined) => {
    if (!p) return;
    const canonical = canonicalUploadsPath(p);
    if (canonical) paths.add(canonical);
  };
  add(user.avatarUrl);
  add(user.coverUrl);
  for (const p of parseProfilePhotos(user.profilePhotos)) add(p);
  for (const p of parseAvatarHistory(user.avatarHistory)) add(p);
  return [...paths];
}

async function collectUserStoragePaths(userId: string, user: User): Promise<string[]> {
  const paths = new Set(collectProfileMediaPaths(user));

  const owned = await db.select({ filename: mediaFiles.filename }).from(mediaFiles).where(eq(mediaFiles.ownerId, userId));
  for (const row of owned) paths.add(row.filename);

  const packs = await db.select({ id: stickerPacks.id }).from(stickerPacks).where(eq(stickerPacks.creatorId, userId));
  if (packs.length > 0) {
    const packIds = packs.map((p) => p.id);
    const packStickers = await db.select({ imageUrl: stickers.imageUrl }).from(stickers).where(inArray(stickers.packId, packIds));
    for (const s of packStickers) {
      if (s.imageUrl) {
        const canonical = canonicalUploadsPath(s.imageUrl);
        if (canonical) paths.add(canonical);
      }
    }
  }

  return [...paths];
}

async function deleteStorageFiles(paths: string[]): Promise<void> {
  const storage = getMediaStorage();
  await Promise.all(
    paths.map((path) => storage.delete(storageKeyFromPath(path)).catch(() => {}))
  );
}

export async function deleteUserAccount(userId: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("User not found");

  const storagePaths = await collectUserStoragePaths(userId, user);

  const memberships = await db
    .select({ chatId: chatMembers.chatId })
    .from(chatMembers)
    .where(eq(chatMembers.userId, userId));

  if (memberships.length > 0) {
    const chatIds = memberships.map((m) => m.chatId);
    const chatRows = await db.select().from(chats).where(inArray(chats.id, chatIds));
    const chatById = new Map(chatRows.map((c) => [c.id, c]));

    for (const { chatId } of memberships) {
      const chat = chatById.get(chatId);
      if (!chat) continue;

      if (chat.type === "dm") {
        const members = await db
          .select({ userId: chatMembers.userId })
          .from(chatMembers)
          .where(eq(chatMembers.chatId, chatId));

        for (const m of members) {
          kickUserFromChat(m.userId, chatId, { type: "chat_removed", chatId });
        }

        await db.delete(chatMembers).where(eq(chatMembers.chatId, chatId));
        await db.delete(chats).where(eq(chats.id, chatId));
        await deleteChatMessages(chatId);
        await publishChatEvent(chatId, { type: "chat_removed", chatId }).catch(() => {});
        continue;
      }

      const deletedMessageIds = await deleteMessagesBySender(chatId, userId);
      for (const messageId of deletedMessageIds) {
        await publishChatEvent(chatId, { type: "message_deleted", chatId, messageId }).catch(() => {});
      }

      await db
        .delete(chatMembers)
        .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)));

      const remaining = await db.select().from(chatMembers).where(eq(chatMembers.chatId, chatId)).limit(1);
      if (remaining.length === 0) {
        await db.delete(chats).where(eq(chats.id, chatId));
        await deleteChatMessages(chatId);
        await publishChatEvent(chatId, { type: "chat_removed", chatId }).catch(() => {});
      } else {
        await publishChatEvent(chatId, { type: "chat_members_changed", chatId }).catch(() => {});
      }

      kickUserFromChat(userId, chatId, { type: "chat_removed", chatId });
    }
  }

  disconnectUser(userId);
  await db.delete(users).where(eq(users.id, userId));
  await deleteStorageFiles(storagePaths);
}
