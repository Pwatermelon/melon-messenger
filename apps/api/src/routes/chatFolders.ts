import { Elysia } from "elysia";
import { authPlugin, requireAuth } from "../auth";
import {
  addChatToFolder,
  createFolder,
  deleteFolder,
  listFolders,
  removeChatFromFolder,
  renameFolder,
  reorderFolders,
} from "../services/chatFolders";

export const chatFolderRoutes = new Elysia({ prefix: "/chat-folders" })
  .use(authPlugin)
  .get("/", async ({ user, set }) => {
    const u = requireAuth(set)(user);
    const folders = await listFolders(u.id);
    return {
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        sortOrder: f.sortOrder,
        kind: f.kind,
      })),
    };
  })
  .post("/", async ({ user, body, set }) => {
    const u = requireAuth(set)(user);
    const payload = (typeof body === "object" && body !== null ? body : {}) as { name?: string };
    const name = payload.name?.trim();
    if (!name) {
      set.status = 400;
      return { error: "name required" };
    }
    try {
      const folder = await createFolder(u.id, name);
      return { folder: { id: folder.id, name: folder.name, sortOrder: folder.sortOrder, kind: folder.kind } };
    } catch (e) {
      set.status = 400;
      return { error: String(e) };
    }
  })
  .patch("/reorder", async ({ user, body, set }) => {
    const u = requireAuth(set)(user);
    const payload = (typeof body === "object" && body !== null ? body : {}) as { folderIds?: string[] };
    if (!Array.isArray(payload.folderIds)) {
      set.status = 400;
      return { error: "folderIds required" };
    }
    const folders = await reorderFolders(u.id, payload.folderIds);
    return {
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        sortOrder: f.sortOrder,
        kind: f.kind,
      })),
    };
  })
  .patch("/:id", async ({ user, params, body, set }) => {
    const u = requireAuth(set)(user);
    const { id: folderId } = params;
    const payload = (typeof body === "object" && body !== null ? body : {}) as { name?: string };
    const name = payload.name?.trim();
    if (!name) {
      set.status = 400;
      return { error: "name required" };
    }
    try {
      const folder = await renameFolder(u.id, folderId, name);
      if (!folder) {
        set.status = 404;
        return { error: "Folder not found" };
      }
      return { folder: { id: folder.id, name: folder.name, sortOrder: folder.sortOrder, kind: folder.kind } };
    } catch (e) {
      set.status = 400;
      return { error: String(e) };
    }
  })
  .delete("/:id", async ({ user, params, set }) => {
    const u = requireAuth(set)(user);
    const { id: folderId } = params;
    try {
      const ok = await deleteFolder(u.id, folderId);
      if (!ok) {
        set.status = 404;
        return { error: "Folder not found" };
      }
      return { ok: true };
    } catch (e) {
      set.status = 400;
      return { error: String(e) };
    }
  })
  .put("/:id/chats/:chatId", async ({ user, params, set }) => {
    const u = requireAuth(set)(user);
    const { id: folderId, chatId } = params;
    const ok = await addChatToFolder(u.id, folderId, chatId);
    if (!ok) {
      set.status = 404;
      return { error: "Folder or chat not found" };
    }
    return { ok: true };
  })
  .delete("/:id/chats/:chatId", async ({ user, params, set }) => {
    const u = requireAuth(set)(user);
    const { id: folderId, chatId } = params;
    const ok = await removeChatFromFolder(u.id, folderId, chatId);
    if (!ok) {
      set.status = 404;
      return { error: "Folder not found" };
    }
    return { ok: true };
  });
