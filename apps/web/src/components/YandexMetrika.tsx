import { useEffect } from "react";

declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...args: unknown[]) => void;
  }
}

/** Опционально: GitHub Secret VITE_YANDEX_METRIKA_ID при сборке web. */
export default function YandexMetrika() {
  const counterId = import.meta.env.VITE_YANDEX_METRIKA_ID?.trim();

  useEffect(() => {
    if (!counterId || typeof window === "undefined") return;
    const id = Number(counterId);
    if (!Number.isFinite(id)) return;

    if (!window.ym) {
      const stub = function (...args: unknown[]) {
        (stub as typeof stub & { a?: unknown[] }).a = (stub as typeof stub & { a?: unknown[] }).a || [];
        (stub as typeof stub & { a: unknown[] }).a.push(args);
      };
      stub.l = Date.now();
      window.ym = stub as Window["ym"];

      if (!document.getElementById("yandex-metrika")) {
        const script = document.createElement("script");
        script.id = "yandex-metrika";
        script.async = true;
        script.src = "https://mc.yandex.ru/metrika/tag.js";
        document.head.appendChild(script);
      }
    }

    window.ym?.(id, "init", {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: false,
    });
  }, [counterId]);

  if (!counterId) return null;

  return (
    <noscript>
      <div>
        <img
          src={`https://mc.yandex.ru/watch/${counterId}`}
          style={{ position: "absolute", left: "-9999px" }}
          alt=""
        />
      </div>
    </noscript>
  );
}
