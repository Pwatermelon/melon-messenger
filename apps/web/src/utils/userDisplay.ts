export type UserLabelSource = {
  username?: string | null;
  yandexLogin?: string | null;
};

/** Имя из Яндекса (display_name) или запасной вариант */
export function userDisplayName(u: UserLabelSource): string {
  const name = u.username?.trim();
  if (name) return name;
  const login = u.yandexLogin?.trim();
  if (login) return login;
  return "?";
}

/** Логин-тег, если отличается от отображаемого имени */
export function userLoginTag(u: UserLabelSource): string | null {
  const login = u.yandexLogin?.trim();
  if (!login) return null;
  const name = u.username?.trim();
  if (name && name.toLowerCase() === login.toLowerCase()) return null;
  return login;
}

export function userAvatarLetter(u: UserLabelSource): string {
  return userDisplayName(u).slice(0, 1).toUpperCase();
}
