#!/usr/bin/env node
/**
 * Web-ready watermelon icons: circular cutout without the outer black iOS mat.
 * Preserves original colors inside the artwork — no flood-fill.
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

/** Drop the outer black ring baked into the app-icon master (≈27% of radius). */
const CONTENT_RATIO = 0.725;
const FEATHER_PX = 1;

function applyWebMask(png) {
  const { width: w, height: h, data } = png;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const radius = (Math.min(w, h) / 2) * CONTENT_RATIO;

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

  return trimTransparent(png);
}

function trimTransparent(png) {
  const { width: w, height: h, data } = png;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(w * y + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (minX > maxX || minY > maxY) return png;

  const outW = maxX - minX + 1;
  const outH = maxY - minY + 1;
  const out = new PNG({ width: outW, height: outH });

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const src = ((minY + y) * w + (minX + x)) * 4;
      const dst = (y * outW + x) * 4;
      out.data[dst] = data[src];
      out.data[dst + 1] = data[src + 1];
      out.data[dst + 2] = data[src + 2];
      out.data[dst + 3] = data[src + 3];
    }
  }

  return out;
}

for (const name of files) {
  const path = join(publicDir, name);
  if (!existsSync(path)) {
    console.warn("skip", name);
    continue;
  }
  const png = PNG.sync.read(readFileSync(path));
  applyWebMask(png);
  writeFileSync(path, PNG.sync.write(png));
  console.log(name, "ok", `${png.width}x${png.height}`, `corner alpha=${png.data[3]}`);
}
