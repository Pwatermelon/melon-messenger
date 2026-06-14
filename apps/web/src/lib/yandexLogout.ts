export function logoutViaYandex(logout: () => void) {
  logout();
  const ret = encodeURIComponent(`${window.location.origin}/login`);
  window.location.href = `https://passport.yandex.ru/passport?mode=logout&retpath=${ret}`;
}
