import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { applyPageMeta, getPageMeta, HOME_PAGE_META } from "../lib/pageMeta";

const NOINDEX = "noindex, nofollow";

/** Обновляет title и meta description при смене маршрута (SPA). */
export default function RouteMeta() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (pathname === "/" && user) {
      applyPageMeta({ ...HOME_PAGE_META, robots: NOINDEX });
      return;
    }
    applyPageMeta(getPageMeta(pathname));
  }, [pathname, user]);

  return null;
}
