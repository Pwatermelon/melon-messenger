#!/usr/bin/env node
/**
 * Makes black outer background transparent in watermelon PNG icons.
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

function isBg(r, g, b, a) {
  return a > 0 && r <= 28 && g <= 28 && b <= 28;
}

function floodTransparent(png) {
  const { width: w, height: h, data } = png;
  const visited = new Uint8Array(w * h);
  const stack = [];

  for (let x = 0; x < w; x++) {
    stack.push([x, 0], [x, h - 1]);
  }
  for (let y = 0; y < h; y++) {
    stack.push([0, y], [w - 1, y]);
  }

  const idx = (x, y) => (w * y + x) * 4;

  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const i = w * y + x;
    if (visited[i]) continue;
    const o = idx(x, y);
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const a = data[o + 3];
    if (!isBg(r, g, b, a)) continue;
    visited[i] = 1;
    data[o + 3] = 0;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return png;
}

for (const name of files) {
  const path = join(publicDir, name);
  if (!existsSync(path)) {
    console.warn("skip", name);
    continue;
  }
  const buf = readFileSync(path);
  const png = PNG.sync.read(buf);
  floodTransparent(png);
  writeFileSync(path, PNG.sync.write(png));
  console.log(name, "ok", `corner alpha=${png.data[3]}`);
}
