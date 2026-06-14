import type { users } from "../db/schema";

export function parseProfilePhotos(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function toPublicProfile(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    avatarUrl: u.avatarUrl,
    coverUrl: u.coverUrl ?? null,
    bio: u.bio ?? null,
    profilePhotos: parseProfilePhotos(u.profilePhotos),
    subscriptionTier: u.subscriptionTier ?? "free",
    subscriptionExpiresAt: u.subscriptionExpiresAt?.toISOString?.() ?? null,
    createdAt: u.createdAt?.toISOString?.(),
  };
}

export function toPrivateProfile(u: typeof users.$inferSelect) {
  return {
    ...toPublicProfile(u),
    email: u.email,
    yandexId: u.yandexId ?? null,
    betaApproved: u.betaApproved ?? false,
    isAdmin: u.isAdmin ?? false,
  };
}

/** @deprecated use toPrivateProfile */
export const toUserResponse = toPrivateProfile;
