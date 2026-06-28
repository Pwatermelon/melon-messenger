import { getApiUrl } from "../config";

export type LegalConfig = {
  privacyVersion: string;
  termsVersion: string;
  consentVersion: string;
  effectiveDate: string;
};

let cached: LegalConfig | null = null;

export async function fetchLegalConfig(): Promise<LegalConfig> {
  if (cached) return cached;
  const res = await fetch(`${getApiUrl()}/legal/config`);
  if (!res.ok) throw new Error("Legal config unavailable");
  cached = (await res.json()) as LegalConfig;
  return cached;
}

export function yandexLoginUrl(cfg: LegalConfig): string {
  const params = new URLSearchParams({
    legal_pd: cfg.consentVersion,
    legal_terms: cfg.termsVersion,
    legal_privacy: cfg.privacyVersion,
  });
  return `/api/auth/yandex?${params.toString()}`;
}
