#!/usr/bin/env node
/**
 * Генерирует favicon и PNG-иконки для web/PWA (apps/web/public).
 * Usage: node scripts/generate-icons.mjs
 */
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { PNG } from "pngjs";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "apps/web/public");

const SIZES = [16, 32, 48, 180, 192, 200, 512];

function setPixel(data, o, [r, g, b], alpha = 255) {
  data[o] = r;
  data[o + 1] = g;
  data[o + 2] = b;
  data[o + 3] = alpha;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}

const SEEDS = [
  [0.08, -0.18],
  [-0.12, -0.04],
  [0.14, 0.06],
  [-0.04, 0.16],
  [0.0, -0.08],
];

function drawWatermelon(size) {
  const png = new PNG({ width: size, height: size });
  const { data } = png;
  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 512;
  const outerR = size * 0.46;
  const rindInner = outerR * 0.88;
  const fleshR = outerR * 0.78;
  const seedRx = 5.5 * scale;
  const seedRy = 8 * scale;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (size * y + x) * 4;
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const dist = Math.hypot(dx, dy);

      if (dist > outerR) {
        setPixel(data, o, [0, 0, 0], 0);
        continue;
      }

      if (dist > rindInner) {
        const angle = Math.atan2(dy, dx);
        const stripe = Math.sin(angle * 7 + dist * 0.04) > 0.05;
        const dark = [34, 118, 52];
        const light = [56, 156, 72];
        const c = stripe ? dark : light;
        const edge = (outerR - dist) / (outerR - rindInner);
        const c2 = mixColor(c, [20, 90, 40], Math.max(0, 1 - edge * 3));
        setPixel(data, o, c2);
        continue;
      }

      const fleshBase = [236, 78, 92];
      const fleshDark = [210, 52, 68];
      const t = dist / fleshR;
      let flesh = mixColor(fleshBase, fleshDark, t * 0.35);

      for (const [sx, sy] of SEEDS) {
        const sdx = dx / fleshR - sx;
        const sdy = dy / fleshR - sy;
        const sd = Math.hypot(sdx / (seedRx / fleshR), sdy / (seedRy / fleshR));
        if (sd < 1) {
          const seedT = 1 - sd;
          flesh = mixColor(flesh, [24, 18, 16], seedT * 0.95);
        }
      }

      if (dist > fleshR * 0.92 && dist <= fleshR) {
        const highlight = (1 - (dist - fleshR * 0.92) / (fleshR * 0.08)) * 0.15;
        flesh = mixColor(flesh, [255, 180, 190], highlight);
      }

      setPixel(data, o, flesh);
    }
  }

  return png;
}

function pngToIco(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry[4] = 1;
  entry[5] = 0;
  entry[6] = 32;
  entry[7] = 0;
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, pngBuffer]);
}

function writeSvg() {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Watermelon">
  <circle cx="256" cy="256" r="236" fill="#2f8a44"/>
  <path d="M256 20a236 236 0 0 1 0 472a236 236 0 0 1 0-472" fill="none" stroke="#1f6a34" stroke-width="18" stroke-dasharray="36 28"/>
  <circle cx="256" cy="256" r="198" fill="#ec4e5c"/>
  <ellipse cx="206" cy="214" rx="18" ry="28" fill="#181210" transform="rotate(-18 206 214)"/>
  <ellipse cx="292" cy="238" rx="16" ry="26" fill="#181210" transform="rotate(12 292 238)"/>
  <ellipse cx="248" cy="292" rx="17" ry="27" fill="#181210" transform="rotate(-8 248 292)"/>
  <ellipse cx="318" cy="286" rx="15" ry="24" fill="#181210" transform="rotate(22 318 286)"/>
  <ellipse cx="228" cy="176" rx="14" ry="22" fill="#181210" transform="rotate(-28 228 176)"/>
</svg>
`;
  writeFileSync(join(publicDir, "favicon.svg"), svg);
}

writeSvg();

for (const size of SIZES) {
  const png = drawWatermelon(size);
  const buf = PNG.sync.write(png);
  const names =
    size === 180 ? ["apple-touch-icon.png", "icon-180.png"] : [`icon-${size}.png`];
  for (const name of names) {
    writeFileSync(join(publicDir, name), buf);
    console.log("wrote", name, `${size}x${size}`);
  }
}

const favicon32 = drawWatermelon(32);
const favicon32Buf = PNG.sync.write(favicon32);
writeFileSync(join(publicDir, "favicon.ico"), pngToIco(favicon32Buf, 32));
console.log("wrote favicon.ico");

const yandexOAuth = drawWatermelon(200);
writeFileSync(join(publicDir, "yandex-oauth-icon.png"), PNG.sync.write(yandexOAuth));
console.log("wrote yandex-oauth-icon.png");
