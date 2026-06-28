import { desc, eq } from "drizzle-orm";
import { db, userLegalAcceptances, users } from "../db";
import type { LegalAcceptanceBundle, LegalDocumentType } from "../lib/legalConfig";
import { getLegalVersions, isCurrentLegalBundle } from "../lib/legalConfig";

export type LegalAuditMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

const DOC_ENTRIES: Array<{ type: LegalDocumentType; versionKey: keyof LegalAcceptanceBundle }> = [
  { type: "personal_data", versionKey: "personal_data" },
  { type: "terms", versionKey: "terms" },
  { type: "privacy", versionKey: "privacy" },
];

export async function recordLegalAcceptances(
  userId: string,
  bundle: LegalAcceptanceBundle,
  meta: LegalAuditMeta = {}
): Promise<string> {
  if (!isCurrentLegalBundle(bundle)) {
    throw new Error("Legal document versions outdated");
  }

  const batchId = crypto.randomUUID();
  const ip = meta.ipAddress?.trim().slice(0, 64) || null;
  const ua = meta.userAgent?.trim().slice(0, 512) || null;

  await db.insert(userLegalAcceptances).values(
    DOC_ENTRIES.map(({ type, versionKey }) => ({
      userId,
      batchId,
      documentType: type,
      documentVersion: bundle[versionKey],
      ipAddress: ip,
      userAgent: ua,
    }))
  );

  return batchId;
}

export async function getUserLegalStatus(userId: string) {
  const current = getLegalVersions();
  const rows = await db
    .select({
      documentType: userLegalAcceptances.documentType,
      documentVersion: userLegalAcceptances.documentVersion,
      acceptedAt: userLegalAcceptances.acceptedAt,
    })
    .from(userLegalAcceptances)
    .where(eq(userLegalAcceptances.userId, userId))
    .orderBy(desc(userLegalAcceptances.acceptedAt));

  const latest: Partial<Record<LegalDocumentType, { version: string; acceptedAt: string }>> = {};
  for (const row of rows) {
    const t = row.documentType as LegalDocumentType;
    if (!latest[t]) {
      latest[t] = {
        version: row.documentVersion,
        acceptedAt: row.acceptedAt.toISOString(),
      };
    }
  }

  const upToDate = (DOC_ENTRIES as typeof DOC_ENTRIES).every(
    ({ type }) => latest[type]?.version === current[type]
  );

  return { current, accepted: latest, upToDate };
}

export async function listLegalAcceptancesForAdmin(limit = 100) {
  const rows = await db
    .select({
      id: userLegalAcceptances.id,
      batchId: userLegalAcceptances.batchId,
      documentType: userLegalAcceptances.documentType,
      documentVersion: userLegalAcceptances.documentVersion,
      ipAddress: userLegalAcceptances.ipAddress,
      acceptedAt: userLegalAcceptances.acceptedAt,
      userId: userLegalAcceptances.userId,
      yandexLogin: users.yandexLogin,
      username: users.username,
    })
    .from(userLegalAcceptances)
    .innerJoin(users, eq(users.id, userLegalAcceptances.userId))
    .orderBy(desc(userLegalAcceptances.acceptedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    batchId: r.batchId,
    documentType: r.documentType,
    documentVersion: r.documentVersion,
    ipAddress: r.ipAddress,
    acceptedAt: r.acceptedAt.toISOString(),
    user: {
      id: r.userId,
      yandexLogin: r.yandexLogin,
      username: r.username,
    },
  }));
}

export function auditMetaFromRequest(request: Request): LegalAuditMeta {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || null;
  return {
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  };
}
