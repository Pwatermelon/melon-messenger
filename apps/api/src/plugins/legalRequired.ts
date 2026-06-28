import { Elysia } from "elysia";
import { getUserLegalStatus } from "../services/legalAcceptance";

/** Blocks authenticated API calls until user accepts current legal document versions. */
export const legalRequiredPlugin = new Elysia({ name: "legal-required" }).onBeforeHandle(
  async ({ user, set }) => {
    if (!user) return;
    const { upToDate } = await getUserLegalStatus(user.id);
    if (!upToDate) {
      set.status = 403;
      return {
        error: "Требуется принять актуальные юридические документы",
        code: "legal_acceptance_required",
      };
    }
  }
);
