#!/usr/bin/env node
'use strict';

// Pure-Node 実装の PNG ジェネレーターです。外部依存を避けるため zlib のみで PNG を組み立てます。
// アイコンデザイン: 黒の squircle 背景 + 太い赤の X 字。
// X (旧 Twitter) のブランドカラーである黒をベースに、「X が OFF」のメッセージを赤の X 字で表現します。
// 4×4 supersampling のアンチエイリアスで小サイズでも輪郭をなめらかに描画します。

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const COLOR_RED = [244, 33, 46];
const COLOR_WHITE = [255, 255, 255];
const COLOR_BLACK = [0, 0, 0];
const TRANSPARENT = [0, 0, 0, 0];

const SAMPLES_PER_AXIS = 4;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function createIhdr(width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  return ihdr;
}

// 1 サンプル分の色決定。座標は連続値（小数 OK）。
function sampleColor(x, y, size) {
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const dx = x - cx;
  const dy = y - cy;

  // squircle 背景: |dx|^4 + |dy|^4 <= R^4 形式の super-ellipse。
  // size の半径と「角丸み」の係数 0.46 で iOS アイコン風の squircle を作ります。
  const r = size * 0.50 - 0.5;
  const k = Math.pow(Math.abs(dx) / r, 4) + Math.pow(Math.abs(dy) / r, 4);
  if (k > 1) return TRANSPARENT;

  // X の二本の対角線。原点中心の y=x と y=-x からの距離で判定します。
  const diag1 = Math.abs(dy - dx) / Math.SQRT2;
  const diag2 = Math.abs(dy + dx) / Math.SQRT2;
  const xThick = size * 0.13;
  const xRadius = size * 0.34;
  const inXBounds = Math.max(Math.abs(dx), Math.abs(dy)) <= xRadius;
  if (inXBounds && (diag1 <= xThick || diag2 <= xThick)) {
    return [...COLOR_RED, 255];
  }
  return [...COLOR_BLACK, 255];
}

// premultiplied alpha でアンチエイリアス。
// 同色×透明の境界でアルファだけが滑らかに落ちる結果を得るためです。
function pixelAt(x, y, size) {
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let aSum = 0;
  for (let sy = 0; sy < SAMPLES_PER_AXIS; sy += 1) {
    for (let sx = 0; sx < SAMPLES_PER_AXIS; sx += 1) {
      const subX = x + (sx + 0.5) / SAMPLES_PER_AXIS - 0.5;
      const subY = y + (sy + 0.5) / SAMPLES_PER_AXIS - 0.5;
      const [r, g, b, a] = sampleColor(subX, subY, size);
      const aN = a / 255;
      rSum += r * aN;
      gSum += g * aN;
      bSum += b * aN;
      aSum += aN;
    }
  }
  const total = SAMPLES_PER_AXIS * SAMPLES_PER_AXIS;
  if (aSum < 1e-6) return [0, 0, 0, 0];
  const aFinal = aSum / total;
  return [
    clamp255(rSum / aSum),
    clamp255(gSum / aSum),
    clamp255(bSum / aSum),
    clamp255(aFinal * 255),
  ];
}

function clamp255(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function makePng(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = createIhdr(size, size);

  const rowBytes = 1 + size * 4;
  const raw = Buffer.alloc(size * rowBytes);

  for (let y = 0; y < size; y += 1) {
    raw[y * rowBytes] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixelAt(x, y, size);
      const off = y * rowBytes + 1 + x * 4;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
      raw[off + 3] = a;
    }
  }

  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, '..', 'src', 'icons');
fs.mkdirSync(outDir, { recursive: true });

[16, 32, 48, 128].forEach((size) => {
  const png = makePng(size);
  const filename = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(filename, png);
  console.log(`generated ${filename} (${png.length} bytes)`);
});
