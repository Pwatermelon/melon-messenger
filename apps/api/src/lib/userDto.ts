import type { users } from "../db/schema";
import { formatBirthdayLabel, getBirthdayAge, isBirthdayToday } from "@melon/shared";
import { canonicalUploadsPath } from "../services/mediaAccess";

export function parseProfilePhotos(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function parseAvatarHistory(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, 24) : [];
  } catch {
    return [];
  }
}

function sanitizeProfileMedia(u: {
  avatarUrl?: string | null;
  avatarHistory?: string[];
  profilePhotos?: string[];
}) {
  const crop = u.avatarUrl ?? null;
  const avatarHistory = (u.avatarHistory ?? []).filter((p) => p && p !== crop);
  const avatarPaths = new Set(
    [crop, ...avatarHistory]
      .map((p) => (p ? canonicalUploadsPath(p) : null))
      .filter((p): p is string => Boolean(p))
  );
  const profilePhotos = (u.profilePhotos ?? []).filter((p) => {
    const canonical = canonicalUploadsPath(p);
    return canonical ? !avatarPaths.has(canonical) : true;
  });
  return { avatarHistory, profilePhotos };
}

export function toPublicProfile(u: typeof users.$inferSelect, includeBirthday = true) {
  const avatarHistory = parseAvatarHistory(u.avatarHistory);
  const profilePhotos = parseProfilePhotos(u.profilePhotos);
  const media = sanitizeProfileMedia({
    avatarUrl: u.avatarUrl,
    avatarHistory,
    profilePhotos,
  });
  const base = {
    id: u.id,
    username: u.username,
    avatarUrl: u.avatarUrl,
    avatarHistory: media.avatarHistory,
    coverUrl: u.coverUrl ?? null,
    bio: u.bio ?? null,
    profilePhotos: media.profilePhotos,
    subscriptionTier: u.subscriptionTier ?? "free",
    subscriptionExpiresAt: u.subscriptionExpiresAt?.toISOString?.() ?? null,
    yandexLogin: u.yandexLogin ?? null,
    createdAt: u.createdAt?.toISOString?.(),
  };
  if (includeBirthday && u.birthdayVisible && u.birthday) {
    const age = getBirthdayAge(u.birthday);
    return {
      ...base,
      birthdayLabel: formatBirthdayLabel(u.birthday),
      birthdayAge: age,
      isBirthdayToday: isBirthdayToday(u.birthday),
    };
  }
  return base;
}

export function toPrivateProfile(u: typeof users.$inferSelect) {
  return {
    ...toPublicProfile(u, u.birthdayVisible),
    email: u.email,
    yandexId: u.yandexId ?? null,
    yandexLogin: u.yandexLogin ?? null,
    birthday: u.birthday ?? null,
    birthdayVisible: u.birthdayVisible ?? false,
    betaApproved: u.betaApproved ?? false,
    isAdmin: u.isAdmin ?? false,
    coinBalance: u.coinBalance ?? 0,
  };
}

/** @deprecated use toPrivateProfile */
export const toUserResponse = toPrivateProfile;
