/** Можно отправлять read receipt только когда вкладка видима и окно в фокусе. */
export function canMarkChatReadNow(): boolean {
  if (typeof document === "undefined") return true;
  if (document.visibilityState !== "visible" || document.hidden) return false;
  if (typeof document.hasFocus === "function" && !document.hasFocus()) return false;
  return true;
}
