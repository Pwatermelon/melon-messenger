import { useEffect, useState } from "react";
import { suggestUsers } from "../api";
import type { User } from "@melon/shared";

type Options = {
  minLength?: number;
  limit?: number;
  excludeIds?: string[];
  enabled?: boolean;
};

export function useUserSearchSuggestions(query: string, options: Options = {}) {
  const { minLength = 1, limit = 8, excludeIds = [], enabled = true } = options;
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const excludeKey = excludeIds.join(",");

  useEffect(() => {
    if (!enabled) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const q = query.trim();
    if (q.length < minLength) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void suggestUsers(q, limit)
        .then((users) => {
          if (cancelled) return;
          const blocked = new Set(excludeIds.map((id) => id.toLowerCase()));
          setSuggestions(users.filter((u) => !blocked.has(u.id.toLowerCase())));
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, minLength, limit, enabled, excludeKey]);

  return { suggestions, loading };
}
