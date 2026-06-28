/** Актуальные версии юридических документов (синхронизируйте с web VITE_LEGAL_*). */
export const LEGAL_DOCUMENT_TYPES = ["personal_data", "terms", "privacy"] as const;
export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

export type LegalVersions = Record<LegalDocumentType, string>;

export function getLegalVersions(): LegalVersions {
  return {
    personal_data: process.env.LEGAL_CONSENT_VERSION?.trim() || "1.0",
    terms: process.env.LEGAL_TERMS_VERSION?.trim() || "1.0",
    privacy: process.env.LEGAL_PRIVACY_VERSION?.trim() || "1.0",
  };
}

export function getLegalConfigPublic() {
  const versions = getLegalVersions();
  return {
    privacyVersion: versions.privacy,
    termsVersion: versions.terms,
    consentVersion: versions.personal_data,
    effectiveDate: process.env.LEGAL_EFFECTIVE_DATE?.trim() || "26 июня 2026 г.",
  };
}

export type LegalAcceptanceBundle = LegalVersions;

export function bundleFromQuery(q: {
  legal_pd?: string;
  legal_terms?: string;
  legal_privacy?: string;
}): LegalAcceptanceBundle | null {
  const personal_data = q.legal_pd?.trim();
  const terms = q.legal_terms?.trim();
  const privacy = q.legal_privacy?.trim();
  if (!personal_data || !terms || !privacy) return null;
  return { personal_data, terms, privacy };
}

export function isCurrentLegalBundle(bundle: LegalAcceptanceBundle): boolean {
  const current = getLegalVersions();
  return (
    bundle.personal_data === current.personal_data &&
    bundle.terms === current.terms &&
    bundle.privacy === current.privacy
  );
}
