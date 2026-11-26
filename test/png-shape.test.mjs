/**
 * japofc-qr - module shape and option honesty tests
 *
 * The pixel-level shape geometry is checked against the PNG it produces, and
 * every SVG-only feature must be rejected loudly by the raster renderers:
 * silently ignoring `logo` would leave callers believing the logo is there.
 * The canvas renderer is exercised through a recording mock context.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import jsQR from 'jsqr';
import {
  QrCode,
  InvalidArgumentError,
  renderSvg,
  drawToCanvas,
} from '../dist/esm/index.js';

/** Decodes a truecolour PNG (filter 0 rows, as this library writes them). */
function decode(bytes) {
  const chunks = [];
  let offset = 8;
  while (offset < bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset);
    const length = view.getUint32(0);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    chunks.push({ type, data: bytes.subarray(offset + 8, offset + 8 + length) });
    offset += 12 + length;
  }
  const ihdr = chunks.find((chunk) => chunk.type === 'IHDR');
  const header = new DataView(ihdr.data.buffer, ihdr.data.byteOffset);
  const width = header.getUint32(0);
  const height = header.getUint32(4);
  const idat = chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data);
  const total = idat.reduce((sum, part) => sum + part.length, 0);
  const compressed = new Uint8Array(total);
  let cursor = 0;
  for (const part of idat) {
    compressed.set(part, cursor);
    cursor += part.length;
  }
  const raw = inflateSync(compressed);
  const stride = width * 3 + 1;
  const pixel = (x, y) => {
    const at = y * stride + 1 + x * 3;
    return [raw[at], raw[at + 1], raw[at + 2]];
  };
  return { width, height, pixel };
}

/** Converts decoded pixels to RGBA and decodes the symbol with jsQR. */
function scan(png) {
  const { width, height, pixel } = decode(png);
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(x, y);
      const at = (y * width + x) * 4;
      rgba[at] = r;
      rgba[at + 1] = g;
      rgba[at + 2] = b;
      rgba[at + 3] = 255;
    }
  }
  return jsQR(rgba, width, height);
}

const isDark = ([r, g, b]) => r + g + b < 384;

test('explicit square is byte-identical to the default', async () => {
  const qr = QrCode.encodeText('shape-default', { ecc: 'high' });
  const plain = await qr.toPngBuffer({ scale: 3 });
  const squared = await qr.toPngBuffer({ scale: 3, shape: 'square' });
  assert.deepEqual([...squared], [...plain]);
});

test('dot, rounded and diamond change the pixels but stay scannable', async () => {
  const qr = QrCode.encodeText('https://github.com/JAPofc/japqr', { ecc: 'high' });
  const square = await qr.toPngBuffer({ scale: 6, margin: 2 });

  for (const shape of ['dot', 'rounded', 'diamond']) {
    const png = await qr.toPngBuffer({ scale: 6, margin: 2, shape });
    assert.notDeepEqual([...png], [...square], `${shape} must differ from square`);
    const decoded = scan(png);
    assert.ok(decoded, `${shape} output must be scannable`);
    assert.equal(decoded.data, 'https://github.com/JAPofc/japqr');
  }

  const dot = await qr.toPngBuffer({ scale: 6, margin: 2, shape: 'dot' });
  const diamond = await qr.toPngBuffer({ scale: 6, margin: 2, shape: 'diamond' });
  assert.notDeepEqual([...dot], [...diamond]);
});

test('shapes leave the finder patterns square', async () => {
  const qr = QrCode.encodeText('finders', { ecc: 'high' });
  const scale = 4;
  const png = await qr.toPngBuffer({ scale, margin: 0, shape: 'dot' });
  const { pixel } = decode(png);

  // Module (0, 0) is a finder pattern: every pixel must be dark.
  for (let y = 0; y < scale; y += 1) {
    for (let x = 0; x < scale; x += 1) {
      assert.ok(isDark(pixel(x, y)), `finder pixel (${x}, ${y}) must be dark`);
    }
  }

  // A dark data module with `dot` keeps its corners light at this scale.
  outer: for (let my = 7; my < qr.size - 7; my += 1) {
    for (let mx = 7; mx < qr.size - 7; mx += 1) {
      if (qr.modules[my][mx]) {
        assert.ok(!isDark(pixel(mx * scale, my * scale)), 'dot corner must be light');
        assert.ok(isDark(pixel(mx * scale + 2, my * scale + 2)), 'dot centre must be dark');
        break outer;
      }
    }
  }
});

test('PNG rejects unknown shapes', async () => {
  const qr = QrCode.encodeText('x');
  await assert.rejects(() => qr.toPngBuffer({ shape: 'circle' }), InvalidArgumentError);
});

test('PNG rejects SVG-only options instead of ignoring them', async () => {
  const qr = QrCode.encodeText('honest', { ecc: 'high' });
  const svgOnly = {
    logo: { data: 'data:image/png;base64,x' },
    frame: true,
    theme: 'neon',
    gradient: { from: '#000000', to: '#111111' },
    animate: true,
  };
  for (const key of Object.keys(svgOnly)) {
    await assert.rejects(
      () => qr.toPngBuffer({ [key]: svgOnly[key] }),
      (error) => {
        assert.ok(error instanceof InvalidArgumentError);
        assert.match(error.message, /cannot render/);
        assert.match(error.message, /toSvgString/);
        return true;
      },
      `${key} must be rejected`,
    );
  }
});

test('SVG rejects unknown themes and shapes', () => {
  const qr = QrCode.encodeText('x');
  assert.throws(() => renderSvg(qr, { theme: 'neon2' }), InvalidArgumentError);
  assert.throws(() => renderSvg(qr, { shape: 'circle' }), InvalidArgumentError);
});

function mockContext() {
  const calls = [];
  const record = (name) => (...args) => calls.push([name, ...args]);
  return {
    calls,
    fillRect: record('fillRect'),
    beginPath: record('beginPath'),
    arc: record('arc'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    closePath: record('closePath'),
    fill: record('fill'),
    arcTo: record('arcTo'),
    roundRect: record('roundRect'),
  };
}

function mockCanvas(context) {
  return {
    width: 0,
    height: 0,
    getContext: () => context,
  };
}

test('drawToCanvas paints shapes through the 2D context', () => {
  const qr = QrCode.encodeText('canvas', { ecc: 'high' });

  for (const shape of ['square', 'dot', 'rounded', 'diamond']) {
    const context = mockContext();
    drawToCanvas(qr, mockCanvas(context), { shape, scale: 4, margin: 1 });
    const names = context.calls.map(([name]) => name);
    assert.ok(names.includes('fillRect'), `${shape} clears the background`);
    if (shape === 'dot') {
      assert.ok(names.includes('arc'), 'dot uses arc()');
    } else if (shape === 'diamond') {
      assert.ok(names.includes('moveTo') && names.includes('lineTo'), 'diamond uses a path');
    } else if (shape === 'rounded') {
      assert.ok(names.includes('roundRect') || names.includes('arcTo'), 'rounded uses roundRect/arcTo');
    } else {
      assert.ok(!names.includes('arc'), 'square uses fillRect only');
    }
  }
});

test('drawToCanvas falls back to arcTo without roundRect', () => {
  const qr = QrCode.encodeText('fallback', { ecc: 'high' });
  const context = mockContext();
  delete context.roundRect;
  drawToCanvas(qr, mockCanvas(context), { shape: 'rounded', scale: 4, margin: 1 });
  const names = context.calls.map(([name]) => name);
  assert.ok(names.includes('arcTo'));
});

test('drawToCanvas rejects SVG-only options and unknown shapes', () => {
  const qr = QrCode.encodeText('x');
  const canvas = mockCanvas(mockContext());
  assert.throws(() => drawToCanvas(qr, canvas, { logo: { data: 'data:,' } }), InvalidArgumentError);
  assert.throws(() => drawToCanvas(qr, canvas, { animate: true }), InvalidArgumentError);
  assert.throws(() => drawToCanvas(qr, canvas, { shape: 'star' }), InvalidArgumentError);
});

test('drawToCanvas validates the canvas and its context', () => {
  const qr = QrCode.encodeText('x');
  assert.throws(() => drawToCanvas(qr, null), InvalidArgumentError);
  assert.throws(() => drawToCanvas(qr, { getContext: () => null }), InvalidArgumentError);
});
