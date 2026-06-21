import { db } from "../db";
import { sql } from "drizzle-orm";
import { eq, and } from "drizzle-orm";
import { chatMembers } from "../db/schema";

export const FOLDER_KIND_CUSTOM = "custom";

export type ChatFolderRow = {
  id: string;
  name: string;
  sortOrder: number;
  kind: string;
};

function rowsFromExecute<T>(result: unknown): T[] {
  const rows = (result as { rows?: T[] }).rows ?? result;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

export async function listFolders(userId: string): Promise<ChatFolderRow[]> {
  const result = await db.execute<{
    id: string;
    name: string;
    sort_order: number;
    kind: string;
  }>(sql`
    SELECT id, name, sort_order, kind FROM chat_folders
    WHERE user_id = ${userId}::uuid
    ORDER BY sort_order ASC, created_at ASC
  `);
  return rowsFromExecute(result).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    sortOrder: Number(r.sort_order),
    kind: String(r.kind),
  }));
}

export async function createFolder(userId: string, name: string): Promise<ChatFolderRow> {
  const trimmed = name.trim().slice(0, 100);
  if (!trimmed) throw new Error("Name required");
  const maxResult = await db.execute<{ max: number | null }>(sql`
    SELECT COALESCE(MAX(sort_order), -1) AS max FROM chat_folders WHERE user_id = ${userId}::uuid
  `);
  const maxRows = rowsFromExecute(maxResult);
  const nextOrder = (maxRows[0]?.max ?? -1) + 1;
  const inserted = await db.execute<{ id: string; name: string; sort_order: number; kind: string }>(sql`
    INSERT INTO chat_folders (user_id, name, sort_order, kind)
    VALUES (${userId}::uuid, ${trimmed}, ${nextOrder}, ${FOLDER_KIND_CUSTOM})
    RETURNING id, name, sort_order, kind
  `);
  const row = rowsFromExecute(inserted)[0];
  if (!row) throw new Error("Failed to create folder");
  return {
    id: String(row.id),
    name: String(row.name),
    sortOrder: Number(row.sort_order),
    kind: String(row.kind),
  };
}

export async function renameFolder(userId: string, folderId: string, name: string): Promise<ChatFolderRow | null> {
  const trimmed = name.trim().slice(0, 100);
  if (!trimmed) throw new Error("Name required");
  const existing = await getFolderForUser(userId, folderId);
  if (!existing) return null;
  const updated = await db.execute<{ id: string; name: string; sort_order: number; kind: string }>(sql`
    UPDATE chat_folders SET name = ${trimmed}
    WHERE id = ${folderId}::uuid AND user_id = ${userId}::uuid
    RETURNING id, name, sort_order, kind
  `);
  const row = rowsFromExecute(updated)[0];
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.name),
    sortOrder: Number(row.sort_order),
    kind: String(row.kind),
  };
}

export async function deleteFolder(userId: string, folderId: string): Promise<boolean> {
  const existing = await getFolderForUser(userId, folderId);
  if (!existing) return false;
  await db.execute(sql`
    DELETE FROM chat_folders
    WHERE id = ${folderId}::uuid AND user_id = ${userId}::uuid
  `);
  return true;
}

export async function reorderFolders(userId: string, folderIds: string[]): Promise<ChatFolderRow[]> {
  const current = await listFolders(userId);
  const currentIds = new Set(current.map((f) => f.id));
  const ordered = folderIds.filter((id) => currentIds.has(id));
  for (const f of current) {
    if (!ordered.includes(f.id)) ordered.push(f.id);
  }
  for (let i = 0; i < ordered.length; i++) {
    await db.execute(sql`
      UPDATE chat_folders SET sort_order = ${i}
      WHERE id = ${ordered[i]}::uuid AND user_id = ${userId}::uuid
    `);
  }
  return listFolders(userId);
}

async function getFolderForUser(userId: string, folderId: string): Promise<ChatFolderRow | null> {
  const result = await db.execute<{ id: string; name: string; sort_order: number; kind: string }>(sql`
    SELECT id, name, sort_order, kind FROM chat_folders
    WHERE id = ${folderId}::uuid AND user_id = ${userId}::uuid
    LIMIT 1
  `);
  const row = rowsFromExecute(result)[0];
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.name),
    sortOrder: Number(row.sort_order),
    kind: String(row.kind),
  };
}

async function assertChatMember(userId: string, chatId: string): Promise<boolean> {
  const [member] = await db
    .select({ userId: chatMembers.userId })
    .from(chatMembers)
    .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)))
    .limit(1);
  return Boolean(member);
}

export async function addChatToFolder(userId: string, folderId: string, chatId: string): Promise<boolean> {
  const folder = await getFolderForUser(userId, folderId);
  if (!folder) return false;
  if (!(await assertChatMember(userId, chatId))) return false;
  await db.execute(sql`
    INSERT INTO chat_folder_items (user_id, folder_id, chat_id)
    VALUES (${userId}::uuid, ${folderId}::uuid, ${chatId}::uuid)
    ON CONFLICT (user_id, folder_id, chat_id) DO NOTHING
  `);
  return true;
}

export async function removeChatFromFolder(userId: string, folderId: string, chatId: string): Promise<boolean> {
  const folder = await getFolderForUser(userId, folderId);
  if (!folder) return false;
  await db.execute(sql`
    DELETE FROM chat_folder_items
    WHERE user_id = ${userId}::uuid AND folder_id = ${folderId}::uuid AND chat_id = ${chatId}::uuid
  `);
  return true;
}

export async function getFolderIdsByChatForUser(userId: string): Promise<Map<string, string[]>> {
  const result = await db.execute<{ chat_id: string; folder_id: string }>(sql`
    SELECT chat_id, folder_id FROM chat_folder_items WHERE user_id = ${userId}::uuid
  `);
  const map = new Map<string, string[]>();
  for (const row of rowsFromExecute(result)) {
    const chatId = String(row.chat_id);
    const folderId = String(row.folder_id);
    const list = map.get(chatId) ?? [];
    list.push(folderId);
    map.set(chatId, list);
  }
  return map;
}
