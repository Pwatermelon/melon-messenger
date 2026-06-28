import { Elysia, t } from "elysia";
import { getLegalConfigPublic, isCurrentLegalBundle, type LegalAcceptanceBundle } from "../lib/legalConfig";
import {
  auditMetaFromRequest,
  getUserLegalStatus,
  listLegalAcceptancesForAdmin,
  recordLegalAcceptances,
} from "../services/legalAcceptance";
import { verifyBearerUser } from "./auth";

export const legalRoutes = new Elysia({ prefix: "/legal" }).get("/config", () => getLegalConfigPublic());

export const authLegalRoutes = new Elysia({ prefix: "/auth/legal" })
  .get("/status", async ({ request, set }) => {
    const user = await verifyBearerUser(request);
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    return getUserLegalStatus(user.id);
  })
  .post(
    "/accept",
    async ({ request, body, set }) => {
      const user = await verifyBearerUser(request);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const bundle: LegalAcceptanceBundle = {
        personal_data: body.personal_data.trim(),
        terms: body.terms.trim(),
        privacy: body.privacy.trim(),
      };

      if (!isCurrentLegalBundle(bundle)) {
        set.status = 400;
        return { error: "Устаревшая версия документов. Обновите страницу." };
      }

      try {
        const batchId = await recordLegalAcceptances(user.id, bundle, auditMetaFromRequest(request));
        return { ok: true, batchId };
      } catch (e) {
        set.status = 400;
        return { error: e instanceof Error ? e.message : "Acceptance failed" };
      }
    },
    {
      body: t.Object({
        personal_data: t.String(),
        terms: t.String(),
        privacy: t.String(),
      }),
    }
  );

export const adminLegalRoutes = new Elysia({ prefix: "/admin/legal" }).get(
  "/acceptances",
  async ({ request, set }) => {
    const admin = await verifyBearerUser(request);
    if (!admin?.isAdmin) {
      set.status = 403;
      return { error: "Forbidden" };
    }
    return listLegalAcceptancesForAdmin(200);
  }
);
