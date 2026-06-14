/** Ссылки на соцсети для beta-страницы. Замените на реальные, когда будут готовы. */
export const BETA_LINKS = {
  vk: import.meta.env.VITE_VK_URL?.trim() || "https://vk.com/",
  telegram: import.meta.env.VITE_TELEGRAM_URL?.trim() || "https://t.me/",
};

export const BETA_WELCOME_KEY = "wm_beta_welcome_seen";
