#!/usr/bin/env node
/**
 * Cuts a circular alpha mask around the watermelon icon.
 * Preserves original pixels inside the circle — no color replacement.
 * Usage: node scripts/fix-icon-transparency.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { PNG } from "pngjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "apps/web/public");
const files = [
  "icon-32.png",
  "icon-48.png",
  "icon-180.png",
  "icon-192.png",
  "icon-200.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "yandex-oauth-icon.png",
];

/** Soft edge in pixels for anti-aliased circle cutout. */
const FEATHER_PX = 1.25;

function applyCircularMask(png) {
  const { width: w, height: h, data } = png;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const radius = Math.min(w, h) / 2;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (w * y + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist >= radius) {
        data[o + 3] = 0;
        continue;
      }

      if (FEATHER_PX > 0 && dist > radius - FEATHER_PX) {
        const t = (radius - dist) / FEATHER_PX;
        const factor = Math.max(0, Math.min(1, t));
        data[o + 3] = Math.round(data[o + 3] * factor);
      }
    }
  }

  return png;
}

for (const name of files) {
  const path = join(publicDir, name);
  if (!existsSync(path)) {
    console.warn("skip", name);
    continue;
  }
  const png = PNG.sync.read(readFileSync(path));
  applyCircularMask(png);
  writeFileSync(path, PNG.sync.write(png));
  console.log(name, "ok", `${png.width}x${png.height}`, `corner alpha=${png.data[3]}`);
}
