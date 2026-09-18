'use strict';
// Draws the source icon that `npx tauri icon` expands into the full icon set.
//
// The app ships no square artwork, and a checked-in opaque binary would be
// unreviewable. Drawing it keeps the design readable and lets any size be
// regenerated. Palette matches the inline favicon in index.html.
//
// Usage: node scripts/make-icon.js [out.png] [size]
//   node scripts/make-icon.js src-tauri/icons/source.png 1024
//   node scripts/make-icon.js /tmp/preview.png 256      # small copy, for eyeballing

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SIZE = Number(process.argv[3]) || 1024;

// --- minimal PNG writer: RGBA8, no interlace, one IDAT ---
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
const crc32 = buf => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
// Chunk layout is length | type | data | crc — the CRC trails the data, it does not
// follow the length.
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const head = Buffer.alloc(4); head.writeUInt32BE(data.length, 0);
  const tail = Buffer.alloc(4); tail.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([head, typeBuf, data, tail]);
}
function encodePng(size, rgba) {
  const stride = size * 4 + 1, raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// --- shapes, in normalised coordinates where the spade body is roughly unit-sized ---
const BG = [25, 33, 30], GOLD = [215, 188, 129];
const ROUND = 0.30;   // corner radius as a fraction of the half-canvas
const SCALE = 0.50;   // spade half-height as a fraction of the canvas
const V_OFFSET = 0.25; // the shape's own vertical centre — the stem makes it asymmetric

// Heart implicit with the y-cube term negated, which mirrors it vertically: the lobes
// end up at the bottom and the point at the top, i.e. a spade. y grows downwards here.
const inBody = (u, v) => { const t = u * u + v * v - 1; return t * t * t - u * u * v * v * v <= 0; };
// The stem fills the cusp the body leaves at bottom centre and flares out below it.
const stemHalf = v => 0.10 + 0.26 * (v - 0.72) / 0.78;
const inSpade = (u, v) => inBody(u, v) || (v >= 0.72 && v <= 1.50 && Math.abs(u) <= stemHalf(v));

const inSquare = (x, y) => {
  const r = ROUND, dx = Math.max(Math.abs(x) - (1 - r), 0), dy = Math.max(Math.abs(y) - (1 - r), 0);
  return dx * dx + dy * dy <= r * r;
};

const px = Buffer.alloc(SIZE * SIZE * 4);
const SS = 3, step = 1 / (SIZE * SS); // 3x3 supersampling keeps the curves clean
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
  let inside = 0, spade = 0;
  for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
    const nx = ((x * SS + sx + 0.5) * step) * 2 - 1, ny = ((y * SS + sy + 0.5) * step) * 2 - 1;
    if (!inSquare(nx, ny)) continue;
    inside++;
    if (inSpade(nx / SCALE, ny / SCALE + V_OFFSET)) spade++;
  }
  const total = SS * SS, alpha = Math.round(255 * inside / total), mix = inside ? spade / inside : 0;
  const i = (y * SIZE + x) * 4;
  for (let c = 0; c < 3; c++) px[i + c] = Math.round(BG[c] * (1 - mix) + GOLD[c] * mix);
  px[i + 3] = alpha;
}

const out = path.join(__dirname, '..', process.argv[2] || 'src-tauri/icons/source.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, encodePng(SIZE, px));
console.log(`${out} · ${SIZE}x${SIZE} · ${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
