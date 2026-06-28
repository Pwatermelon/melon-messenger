import { Elysia, t } from "elysia";
import { and, desc, eq } from "drizzle-orm";
import { db, reports, users } from "../db";
import { verifyBearerUser } from "./auth";
import { canonicalUploadsPath } from "../services/mediaAccess";
import { checkRateLimit } from "../middleware/rateLimit";

const REPORT_CATEGORIES = new Set(["bug", "content", "account", "service", "other"]);

export const reportsRoutes = new Elysia({ prefix: "/reports" }).post(
  "/",
  async ({ request, body, set }) => {
    const user = await verifyBearerUser(request);
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const ok = await checkRateLimit(`report:${user.id}`, 3600, 10);
    if (!ok) {
      set.status = 429;
      return { error: "Слишком много обращений. Попробуйте позже." };
    }

    const message = body.message?.trim();
    if (!message || message.length < 10) {
      set.status = 400;
      return { error: "Опишите проблему подробнее (минимум 10 символов)" };
    }
    if (message.length > 4000) {
      set.status = 400;
      return { error: "Слишком длинное сообщение" };
    }

    const category = body.category?.trim().toLowerCase() || "other";
    if (!REPORT_CATEGORIES.has(category)) {
      set.status = 400;
      return { error: "Неверная категория" };
    }

    const screenshotUrl = body.screenshotUrl
      ? canonicalUploadsPath(body.screenshotUrl.trim())
      : null;
    const pageUrl = body.pageUrl?.trim().slice(0, 2000) || null;

    const [row] = await db
      .insert(reports)
      .values({
        userId: user.id,
        category,
        message,
        pageUrl,
        screenshotUrl,
      })
      .returning();

    return {
      id: row!.id,
      status: row!.status,
      createdAt: row!.createdAt.toISOString(),
    };
  },
  {
    body: t.Object({
      message: t.String(),
      category: t.Optional(t.String()),
      pageUrl: t.Optional(t.String()),
      screenshotUrl: t.Optional(t.String()),
    }),
  }
);

export const adminReportsRoutes = new Elysia({ prefix: "/admin/reports" })
  .get("/", async ({ request, query, set }) => {
    const admin = await verifyBearerUser(request);
    if (!admin?.isAdmin) {
      set.status = 403;
      return { error: "Forbidden" };
    }

    const status = query.status?.trim();
    let rows;
    const baseQuery = db
      .select({
        id: reports.id,
        category: reports.category,
        message: reports.message,
        pageUrl: reports.pageUrl,
        screenshotUrl: reports.screenshotUrl,
        status: reports.status,
        adminNote: reports.adminNote,
        createdAt: reports.createdAt,
        resolvedAt: reports.resolvedAt,
        userId: reports.userId,
        yandexLogin: users.yandexLogin,
        username: users.username,
      })
      .from(reports)
      .innerJoin(users, eq(users.id, reports.userId))
      .orderBy(desc(reports.createdAt))
      .limit(200);

    if (status === "open" || status === "resolved") {
      rows = await baseQuery.where(eq(reports.status, status));
    } else {
      rows = await baseQuery;
    }

    return rows.map((r) => ({
      id: r.id,
      category: r.category,
      message: r.message,
      pageUrl: r.pageUrl,
      screenshotUrl: r.screenshotUrl,
      status: r.status,
      adminNote: r.adminNote,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      user: {
        id: r.userId,
        yandexLogin: r.yandexLogin,
        username: r.username,
      },
    }));
  }, {
    query: t.Object({
      status: t.Optional(t.String()),
    }),
  })
  .post("/:id/resolve", async ({ request, params, body, set }) => {
    const admin = await verifyBearerUser(request);
    if (!admin?.isAdmin) {
      set.status = 403;
      return { error: "Forbidden" };
    }

    const note = body.note?.trim().slice(0, 2000) || null;
    const [updated] = await db
      .update(reports)
      .set({
        status: "resolved",
        adminNote: note,
        resolvedAt: new Date(),
        resolvedBy: admin.id,
      })
      .where(and(eq(reports.id, params.id), eq(reports.status, "open")))
      .returning();

    if (!updated) {
      set.status = 404;
      return { error: "Жалоба не найдена или уже закрыта" };
    }

    return {
      id: updated.id,
      status: updated.status,
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
    };
  }, {
    body: t.Object({
      note: t.Optional(t.String()),
    }),
  });
