import { describe, expect, test } from "bun:test";
import { parseProfilePhotos } from "../lib/userDto";
import { resolveRedirectUri } from "../services/yandexOAuth";

describe("parseProfilePhotos", () => {
  test("returns empty for null", () => {
    expect(parseProfilePhotos(null)).toEqual([]);
  });

  test("parses valid JSON array", () => {
    expect(parseProfilePhotos('["/uploads/a.jpg","/uploads/b.jpg"]')).toEqual([
      "/uploads/a.jpg",
      "/uploads/b.jpg",
    ]);
  });

  test("filters non-strings and limits to 12", () => {
    const arr = Array.from({ length: 15 }, (_, i) => `/p${i}.jpg`);
    expect(parseProfilePhotos(JSON.stringify([...arr, 42, null]))).toHaveLength(12);
  });

  test("returns empty on invalid JSON", () => {
    expect(parseProfilePhotos("{bad")).toEqual([]);
  });
});

describe("yandex redirect uri", () => {
  test("allows default web redirect", () => {
    expect(resolveRedirectUri(undefined)).toContain("/auth/yandex/callback");
  });

  test("rejects unknown redirect", () => {
    expect(() => resolveRedirectUri("https://evil.com/callback")).toThrow("not allowed");
  });
});

describe("rate limit key", () => {
  test("extracts first forwarded IP", async () => {
    const { clientKey } = await import("../middleware/rateLimit");
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(clientKey(req)).toBe("1.2.3.4");
  });
});
