import type { users } from "../db/schema";
import { formatBirthdayLabel, getBirthdayAge, isBirthdayToday } from "@melon/shared";

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

export function toPublicProfile(u: typeof users.$inferSelect, includeBirthday = true) {
  const base = {
    id: u.id,
    username: u.username,
    avatarUrl: u.avatarUrl,
    avatarHistory: parseAvatarHistory(u.avatarHistory),
    coverUrl: u.coverUrl ?? null,
    bio: u.bio ?? null,
    profilePhotos: parseProfilePhotos(u.profilePhotos),
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
  };
}

/** @deprecated use toPrivateProfile */
export const toUserResponse = toPrivateProfile;
