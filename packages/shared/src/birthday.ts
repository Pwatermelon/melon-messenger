const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

/** Normalize Yandex birthday (YYYY-MM-DD, year may be 0000). */
export function parseYandexBirthday(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function formatBirthdayLabel(birthday: string): string {
  const m = birthday.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return birthday;
  const [, year, month, day] = m;
  const monthName = MONTHS[Number(month) - 1];
  const dayNum = Number(day);
  if (year === "0000") return `${dayNum} ${monthName}`;
  return `${dayNum} ${monthName} ${year}`;
}

export function isBirthdayToday(birthday: string, now = new Date()): boolean {
  const m = birthday.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const month = m[2];
  const day = m[3];
  const todayMonth = String(now.getMonth() + 1).padStart(2, "0");
  const todayDay = String(now.getDate()).padStart(2, "0");
  return month === todayMonth && day === todayDay;
}

/** Full years; null if year unknown (0000). */
export function getBirthdayAge(birthday: string, now = new Date()): number | null {
  const m = birthday.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m || m[1] === "0000") return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  let age = now.getFullYear() - year;
  const monthDiff = now.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < day)) age--;
  return age >= 0 && age <= 130 ? age : null;
}

export function formatBirthdayWithAge(birthday: string): { label: string; age: number | null } {
  return { label: formatBirthdayLabel(birthday), age: getBirthdayAge(birthday) };
}
