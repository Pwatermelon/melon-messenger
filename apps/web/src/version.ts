/** Injected at build: VITE_APP_VERSION (CI / Docker WM_VERSION). */
export const APP_VERSION = import.meta.env.VITE_APP_VERSION?.trim() || "dev";
