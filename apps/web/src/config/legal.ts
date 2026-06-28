/**
 * Реквизиты оператора персональных данных (152-ФЗ).
 * Заполните через .env (см. apps/web/.env.example) перед production.
 *
 * По умолчанию — физическое лицо (без ООО/ИП). Для ИП или ООО задайте VITE_LEGAL_OPERATOR_TYPE.
 */
const trim = (v: string | undefined) => v?.trim() ?? "";

export type OperatorType = "individual" | "ip" | "company";

function parseOperatorType(): OperatorType {
  const raw = trim(import.meta.env.VITE_LEGAL_OPERATOR_TYPE).toLowerCase();
  if (raw === "ip") return "ip";
  if (raw === "company" || raw === "llc" || raw === "ooo") return "company";
  return "individual";
}

export const LEGAL = {
  serviceName: "Watermelon Messenger",
  serviceUrl: trim(import.meta.env.VITE_WEB_URL) || "https://watermelon-messenger.ru",
  policyVersion: "1.0",
  termsVersion: "1.0",
  policyEffectiveDate: "26 июня 2026 г.",
  consentVersion: "1.0",
  operatorType: parseOperatorType(),
  operator: {
    /** ФИО (физ. лицо), «ИП Фамилия И.О.» или полное наименование ООО */
    name: trim(import.meta.env.VITE_LEGAL_OPERATOR_NAME) || "Жуков Матвей Сергеевич",
    email: trim(import.meta.env.VITE_LEGAL_OPERATOR_EMAIL) || "platinumwatermelon@yandex.ru",
    /** ИНН: 12 цифр для физ. лица, 10/12 для ИП/ООО — по желанию, но рекомендуется */
    inn: trim(import.meta.env.VITE_LEGAL_OPERATOR_INN),
    /** Только для ИП (ОГРНИП) или ООО (ОГРН); для физ. лица не заполняйте */
    ogrn: trim(import.meta.env.VITE_LEGAL_OPERATOR_OGRN),
    /** Не заполняйте для физ. лица — домашний адрес не публикуется; контакт через e-mail */
    address: trim(import.meta.env.VITE_LEGAL_OPERATOR_ADDRESS),
  },
} as const;

export const PD_CONSENT_STORAGE_KEY = "wm_pd_consent_v1"; // legacy client hint; audit — in DB

export function operatorKindLabel(type: OperatorType = LEGAL.operatorType): string {
  if (type === "ip") return "индивидуальный предприниматель";
  if (type === "company") return "юридическое лицо";
  return "физическое лицо";
}

export function operatorIdentificationLine(): string {
  const { name, inn, ogrn, address, email } = LEGAL.operator;
  const type = LEGAL.operatorType;
  const parts: string[] = [];

  if (type === "ip") {
    parts.push(name.startsWith("ИП") ? name : `ИП ${name}`);
  } else {
    parts.push(name);
  }

  parts.push(operatorKindLabel(type));

  if (inn) parts.push(`ИНН ${inn}`);
  if (ogrn) parts.push(type === "ip" ? `ОГРНИП ${ogrn}` : `ОГРН ${ogrn}`);
  if (address) parts.push(`адрес для обращений: ${address}`);
  parts.push(`e-mail: ${email}`);

  return parts.join(", ");
}
