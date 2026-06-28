import { useEffect } from "react";

/** Stable document scroll — fixes rubber-band fighting on legal/FAQ pages. */
export function useDocumentScroll(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const html = document.documentElement;
    html.classList.add("document-scroll");
    return () => html.classList.remove("document-scroll");
  }, [enabled]);
}
