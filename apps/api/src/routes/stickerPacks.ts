import { Elysia } from "elysia";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { authPlugin, requireAuth } from "../auth";
import { db, stickerPacks, stickers, userStickerPacks, users } from "../db";
import { signMediaPath } from "../services/mediaAccess";
import type { StickerItem, StickerPackDetail, StickerPackSummary } from "@melon/shared";

async function signStickerItem(item: typeof stickers.$inferSelect, userId: string): Promise<StickerItem> {
  const signed = await signMediaPath(item.imageUrl, userId);
  return {
    id: item.id,
    packId: item.packId,
    emoji: item.emoji,
    imageUrl: signed ?? item.imageUrl,
    imagePath: item.imageUrl,
    sortOrder: item.sortOrder,
  };
}

async function packSummary(
  pack: typeof stickerPacks.$inferSelect,
  creatorUsername: string,
  stickerCount: number,
  userId: string,
  installedIds: Set<string>
): Promise<StickerPackSummary> {
  const isOwned = pack.creatorId === userId;
  return {
    id: pack.id,
    title: pack.title,
    creatorId: pack.creatorId,
    creatorUsername,
    stickerCount,
    isOwned,
    isInstalled: isOwned || installedIds.has(pack.id),
    createdAt: pack.createdAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

export const stickerPackRoutes = new Elysia({ prefix: "/sticker-packs" })
  .use(authPlugin)
  .get("/", async ({ user, set }) => {
    const me = requireAuth(set)(user);
    const owned = await db.select().from(stickerPacks).where(eq(stickerPacks.creatorId, me.id));
    const installedRows = await db
      .select({ pack: stickerPacks })
      .from(userStickerPacks)
      .innerJoin(stickerPacks, eq(stickerPacks.id, userStickerPacks.packId))
      .where(eq(userStickerPacks.userId, me.id));
    const installedIds = new Set(installedRows.map((r) => r.pack.id));
    const all = [...owned, ...installedRows.map((r) => r.pack)];
    const byId = new Map<string, typeof stickerPacks.$inferSelect>();
    for (const p of all) byId.set(p.id, p);
    const packIds = [...byId.keys()];
    if (packIds.length === 0) return { owned: [], installed: [] };

    const counts = await db
      .select({ packId: stickers.packId, n: count() })
      .from(stickers)
      .where(inArray(stickers.packId, packIds))
      .groupBy(stickers.packId);
    const countMap = new Map(counts.map((c) => [c.packId, Number(c.n)]));

    const creatorIds = [...new Set([...byId.values()].map((p) => p.creatorId))];
    const creators = await db.select().from(users).where(inArray(users.id, creatorIds));
    const creatorMap = new Map(creators.map((u) => [u.id, u.username]));

    const summaries = await Promise.all(
      [...byId.values()].map((p) =>
        packSummary(p, creatorMap.get(p.creatorId) ?? "?", countMap.get(p.id) ?? 0, me.id, installedIds)
      )
    );
    return {
      owned: summaries.filter((s) => s.isOwned),
      installed: summaries.filter((s) => s.isInstalled && !s.isOwned),
    };
  })
  .get("/:id", async ({ user, params, set }) => {
    const me = requireAuth(set)(user);
    const id = (params as { id?: string }).id?.trim();
    if (!id) {
      set.status = 400;
      return { error: "Invalid pack id" };
    }
    const [pack] = await db.select().from(stickerPacks).where(eq(stickerPacks.id, id)).limit(1);
    if (!pack) {
      set.status = 404;
      return { error: "Pack not found" };
    }
    const [creator] = await db.select().from(users).where(eq(users.id, pack.creatorId)).limit(1);
    const stickerRows = await db
      .select()
      .from(stickers)
      .where(eq(stickers.packId, id))
      .orderBy(asc(stickers.sortOrder), asc(stickers.createdAt));
    const [installed] = await db
      .select()
      .from(userStickerPacks)
      .where(and(eq(userStickerPacks.userId, me.id), eq(userStickerPacks.packId, id)))
      .limit(1);
    const installedIds = new Set(installed ? [id] : []);
    const summary = await packSummary(
      pack,
      creator?.username ?? "?",
      stickerRows.length,
      me.id,
      installedIds
    );
    const signedStickers = await Promise.all(stickerRows.map((s) => signStickerItem(s, me.id)));
    const detail: StickerPackDetail = { ...summary, stickers: signedStickers };
    return detail;
  })
  .post("/", async ({ user, body, set }) => {
    const me = requireAuth(set)(user);
    const title = (typeof body === "object" && body !== null ? (body as { title?: string }).title : "")?.trim();
    if (!title) {
      set.status = 400;
      return { error: "title is required" };
    }
    const [pack] = await db.insert(stickerPacks).values({ creatorId: me.id, title }).returning();
    await db.insert(userStickerPacks).values({ userId: me.id, packId: pack!.id }).onConflictDoNothing();
    return packSummary(pack!, me.username, 0, me.id, new Set([pack!.id]));
  })
  .patch("/:id", async ({ user, params, body, set }) => {
    const me = requireAuth(set)(user);
    const id = (params as { id?: string }).id?.trim();
    const title = (typeof body === "object" && body !== null ? (body as { title?: string }).title : "")?.trim();
    if (!id || !title) {
      set.status = 400;
      return { error: "Invalid request" };
    }
    const [pack] = await db.select().from(stickerPacks).where(eq(stickerPacks.id, id)).limit(1);
    if (!pack) {
      set.status = 404;
      return { error: "Pack not found" };
    }
    if (pack.creatorId !== me.id) {
      set.status = 403;
      return { error: "Forbidden" };
    }
    const [updated] = await db.update(stickerPacks).set({ title }).where(eq(stickerPacks.id, id)).returning();
    const [n] = await db.select({ n: count() }).from(stickers).where(eq(stickers.packId, id));
    return packSummary(updated!, me.username, Number(n?.n ?? 0), me.id, new Set([id]));
  })
  .delete("/:id", async ({ user, params, set }) => {
    const me = requireAuth(set)(user);
    const id = (params as { id?: string }).id?.trim();
    if (!id) {
      set.status = 400;
      return { error: "Invalid pack id" };
    }
    const [pack] = await db.select().from(stickerPacks).where(eq(stickerPacks.id, id)).limit(1);
    if (!pack) {
      set.status = 404;
      return { error: "Pack not found" };
    }
    if (pack.creatorId !== me.id) {
      set.status = 403;
      return { error: "Forbidden" };
    }
    await db.delete(stickerPacks).where(eq(stickerPacks.id, id));
    return { ok: true };
  })
  .post("/:id/stickers", async ({ user, params, body, set }) => {
    const me = requireAuth(set)(user);
    const id = (params as { id?: string }).id?.trim();
    const b = (typeof body === "object" && body !== null ? body : {}) as { emoji?: string; imageUrl?: string };
    const emoji = b.emoji?.trim();
    const imageUrl = b.imageUrl?.trim();
    if (!id || !emoji || !imageUrl) {
      set.status = 400;
      return { error: "emoji and imageUrl are required" };
    }
    const [pack] = await db.select().from(stickerPacks).where(eq(stickerPacks.id, id)).limit(1);
    if (!pack) {
      set.status = 404;
      return { error: "Pack not found" };
    }
    if (pack.creatorId !== me.id) {
      set.status = 403;
      return { error: "Forbidden" };
    }
    const [maxRow] = await db
      .select({ m: sql<number>`coalesce(max(${stickers.sortOrder}), -1)` })
      .from(stickers)
      .where(eq(stickers.packId, id));
    const sortOrder = Number(maxRow?.m ?? -1) + 1;
    const [row] = await db
      .insert(stickers)
      .values({ packId: id, emoji, imageUrl, sortOrder })
      .returning();
    return signStickerItem(row!, me.id);
  })
  .patch("/:id/stickers/:stickerId", async ({ user, params, body, set }) => {
    const me = requireAuth(set)(user);
    const id = (params as { id?: string }).id?.trim();
    const stickerId = (params as { stickerId?: string }).stickerId?.trim();
    const emoji = (typeof body === "object" && body !== null ? (body as { emoji?: string }).emoji : "")?.trim();
    if (!id || !stickerId || !emoji) {
      set.status = 400;
      return { error: "Invalid request" };
    }
    const [pack] = await db.select().from(stickerPacks).where(eq(stickerPacks.id, id)).limit(1);
    if (!pack || pack.creatorId !== me.id) {
      set.status = pack ? 403 : 404;
      return { error: pack ? "Forbidden" : "Pack not found" };
    }
    const [row] = await db
      .update(stickers)
      .set({ emoji })
      .where(and(eq(stickers.id, stickerId), eq(stickers.packId, id)))
      .returning();
    if (!row) {
      set.status = 404;
      return { error: "Sticker not found" };
    }
    return signStickerItem(row, me.id);
  })
  .delete("/:id/stickers/:stickerId", async ({ user, params, set }) => {
    const me = requireAuth(set)(user);
    const id = (params as { id?: string }).id?.trim();
    const stickerId = (params as { stickerId?: string }).stickerId?.trim();
    if (!id || !stickerId) {
      set.status = 400;
      return { error: "Invalid request" };
    }
    const [pack] = await db.select().from(stickerPacks).where(eq(stickerPacks.id, id)).limit(1);
    if (!pack || pack.creatorId !== me.id) {
      set.status = pack ? 403 : 404;
      return { error: pack ? "Forbidden" : "Pack not found" };
    }
    await db.delete(stickers).where(and(eq(stickers.id, stickerId), eq(stickers.packId, id)));
    return { ok: true };
  })
  .post("/:id/install", async ({ user, params, set }) => {
    const me = requireAuth(set)(user);
    const id = (params as { id?: string }).id?.trim();
    if (!id) {
      set.status = 400;
      return { error: "Invalid pack id" };
    }
    const [pack] = await db.select().from(stickerPacks).where(eq(stickerPacks.id, id)).limit(1);
    if (!pack) {
      set.status = 404;
      return { error: "Pack not found" };
    }
    await db.insert(userStickerPacks).values({ userId: me.id, packId: id }).onConflictDoNothing();
    return { ok: true };
  })
  .delete("/:id/install", async ({ user, params, set }) => {
    const me = requireAuth(set)(user);
    const id = (params as { id?: string }).id?.trim();
    if (!id) {
      set.status = 400;
      return { error: "Invalid pack id" };
    }
    const [pack] = await db.select().from(stickerPacks).where(eq(stickerPacks.id, id)).limit(1);
    if (!pack) {
      set.status = 404;
      return { error: "Pack not found" };
    }
    if (pack.creatorId === me.id) {
      set.status = 400;
      return { error: "Cannot uninstall your own pack" };
    }
    await db
      .delete(userStickerPacks)
      .where(and(eq(userStickerPacks.userId, me.id), eq(userStickerPacks.packId, id)));
    return { ok: true };
  });
