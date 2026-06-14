#!/usr/bin/env node
/**
 * Consty branding asset generator.
 *
 * Source artwork (committed in /public):
 *   - consty-icon.png  → the hexagonal "C" mark only (used for all square icons)
 *   - consty-logo.png  → mark + "CONSTY" wordmark + tagline (used for OG / wide art)
 *
 * Regenerates every icon Jeton previously shipped, now as Consty:
 *   - public/icons/icon-{16,32,72,96,128,144,152,192,384,512}.png
 *   - public/icons/maskable-icon-512x512.png   (extra safe-zone padding)
 *   - public/apple-touch-icon.png              (180x180, white bg, no alpha)
 *   - public/favicon.ico                       (16/32/48 PNG-embedded)
 *   - src/app/favicon.ico                       (Next.js App Router serves this at /favicon.ico)
 *   - public/og-image.png                      (1200x630 social card from the wordmark logo)
 *
 * Run:  node scripts/generate-branding.mjs
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICON_SRC = join(ROOT, 'public', 'consty-icon.png');
const LOGO_SRC = join(ROOT, 'public', 'consty-logo.png');
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

/** Trim the mark from its white background once, reuse for every size. */
const markBuf = await sharp(ICON_SRC).trim({ threshold: 10 }).png().toBuffer();

/**
 * Render the trimmed mark centered on a square white canvas.
 * @param size       output edge length in px
 * @param coverage   fraction of the canvas the mark may occupy (rest is padding)
 */
async function squareIcon(size, coverage = 0.78) {
  const inner = Math.round(size * coverage);
  const resized = await sharp(markBuf)
    .resize(inner, inner, { fit: 'inside', withoutEnlargement: false })
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: WHITE },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toBuffer();
}

const SIZES = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];
for (const s of SIZES) {
  const buf = await squareIcon(s, s <= 32 ? 0.9 : 0.78); // tiny sizes need less padding
  writeFileSync(join(ROOT, 'public', 'icons', `icon-${s}x${s}.png`), buf);
}

// Maskable icon: generous safe-zone padding so platforms can crop to any shape.
writeFileSync(
  join(ROOT, 'public', 'icons', 'maskable-icon-512x512.png'),
  await squareIcon(512, 0.6),
);

// Apple touch icon: 180x180, opaque white (iOS dislikes transparency).
writeFileSync(
  join(ROOT, 'public', 'apple-touch-icon.png'),
  await sharp(await squareIcon(180, 0.8)).flatten({ background: WHITE }).png().toBuffer(),
);

// favicon.ico — hand-built with PNG-compressed entries (16/32/48), modern-browser compatible.
async function buildIco(sizes) {
  const images = [];
  for (const s of sizes) images.push({ size: s, data: await squareIcon(s, s <= 32 ? 0.9 : 0.84) });
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  const blobs = [];
  let offset = 6 + images.length * 16;
  for (const img of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(img.size >= 256 ? 0 : img.size, 0); // width
    e.writeUInt8(img.size >= 256 ? 0 : img.size, 1); // height
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(img.data.length, 8); // size of image data
    e.writeUInt32LE(offset, 12); // offset
    offset += img.data.length;
    entries.push(e);
    blobs.push(img.data);
  }
  return Buffer.concat([header, ...entries, ...blobs]);
}
const ico = await buildIco([16, 32, 48]);
writeFileSync(join(ROOT, 'public', 'favicon.ico'), ico);
writeFileSync(join(ROOT, 'src', 'app', 'favicon.ico'), ico);

// OG / social card: 1200x630 with the full wordmark logo centered on white.
const logoTrim = await sharp(LOGO_SRC).trim({ threshold: 10 }).png().toBuffer();
const ogLogo = await sharp(logoTrim).resize(840, 420, { fit: 'inside' }).toBuffer();
writeFileSync(
  join(ROOT, 'public', 'og-image.png'),
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: WHITE } })
    .composite([{ input: ogLogo, gravity: 'center' }])
    .png()
    .toBuffer(),
);

/**
 * Transparent in-app artwork. The source art sits on a solid white background;
 * we key out near-white pixels so the mark/wordmark drop cleanly onto any UI
 * surface (sidebar, login, splash).
 */
async function whiteToTransparent(srcBuf, edge) {
  const { data, info } = await sharp(srcBuf)
    .resize(edge, edge, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const px = info.width * info.height;
  for (let i = 0; i < px; i++) {
    const o = i * info.channels;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    // Pure white -> fully transparent; near-white -> proportionally faded
    const minWhite = Math.min(r, g, b);
    if (minWhite >= 250) data[o + 3] = 0;
    else if (minWhite >= 235) data[o + 3] = Math.round(((250 - minWhite) / 15) * 255);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png()
    .toBuffer();
}

writeFileSync(
  join(ROOT, 'public', 'consty-mark.png'),
  await whiteToTransparent(markBuf, 512),
);
writeFileSync(
  join(ROOT, 'public', 'consty-wordmark.png'),
  await whiteToTransparent(logoTrim, 1024),
);

console.log('Branding assets regenerated from consty-icon.png / consty-logo.png');
