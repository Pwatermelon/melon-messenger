/** Официальные соцсети — страница ожидания beta и welcome. */
export const BETA_LINKS = {
  vk: import.meta.env.VITE_VK_URL?.trim() || "https://vk.com/watermelon_messenger",
  telegram: import.meta.env.VITE_TELEGRAM_URL?.trim() || "https://t.me/watermelon_messenger",
} as const;

export const BETA_WELCOME_KEY = "wm_beta_welcome_seen";
