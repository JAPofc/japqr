/**
 * japofc-qr - PNG renderer tests
 *
 * The PNG container is parsed back apart: chunks are walked, IDAT is inflated
 * with `node:zlib`, and every pixel is compared with the module it came from.
 * That proves both the encoder and the pixel mapping, not just the file header.
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
import { QrCode, InvalidArgumentError, EncodingError } from '../dist/esm/index.js';

/** Splits a PNG into its chunks. */
function readChunks(bytes) {
  assert.equal(bytes[0], 137);
  assert.equal(bytes[1], 80);
  assert.equal(bytes[2], 78);
  assert.equal(bytes[3], 71);

  const chunks = [];
  let offset = 8;
  while (offset < bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset);
    const length = view.getUint32(0);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    chunks.push({ type, data: bytes.subarray(offset + 8, offset + 8 + length) });
    offset += 12 + length;
  }
  return chunks;
}

/** Decodes a PNG back into { width, height, pixels }. */
function decode(bytes) {
  const chunks = readChunks(bytes);
  const ihdr = chunks.find((chunk) => chunk.type === 'IHDR');
  const header = new DataView(ihdr.data.buffer, ihdr.data.byteOffset);
  const width = header.getUint32(0);
  const height = header.getUint32(4);
  assert.equal(ihdr.data[8], 8, 'bit depth');
  assert.equal(ihdr.data[9], 2, 'colour type is truecolour');

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
  assert.equal(raw.length, stride * height, 'inflated size');

  const pixel = (x, y) => {
    const offset = y * stride + 1 + x * 3;
    return [raw[offset], raw[offset + 1], raw[offset + 2]];
  };

  return { width, height, pixel, chunks };
}

test('PNG starts with the file signature', async () => {
  const png = await QrCode.encodeText('x').toPngBuffer();
  assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test('PNG dimensions follow the module count, quiet zone and scale', async () => {
  const qr = QrCode.encodeText('dimensions');
  const { width, height } = decode(await qr.toPngBuffer({ margin: 2, scale: 5 }));

  assert.equal(width, (qr.size + 4) * 5);
  assert.equal(height, (qr.size + 4) * 5);
});

test('PNG contains IHDR, IDAT and IEND in order', async () => {
  const { chunks } = decode(await QrCode.encodeText('chunks').toPngBuffer());

  assert.deepEqual(
    chunks.map((chunk) => chunk.type),
    ['IHDR', 'IDAT', 'IEND'],
  );
});

test('PNG pixels match the module matrix', async () => {
  const qr = QrCode.encodeText('https://github.com/JAPofc/japqr', { ecc: 'high' });
  const margin = 2;
  const scale = 3;
  const { pixel } = decode(await qr.toPngBuffer({ margin, scale, dark: '#112233', light: '#e0e0e0' }));

  for (let y = 0; y < qr.size; y += 1) {
    for (let x = 0; x < qr.size; x += 1) {
      const expected = qr.modules[y][x] ? [0x11, 0x22, 0x33] : [0xe0, 0xe0, 0xe0];
      const px = (x + margin) * scale + Math.floor(scale / 2);
      const py = (y + margin) * scale + Math.floor(scale / 2);
      assert.deepEqual(pixel(px, py), expected, `module (${x}, ${y})`);
    }
  }
});

test('PNG quiet zone uses the light colour', async () => {
  const qr = QrCode.encodeText('quiet');
  const { pixel } = decode(await qr.toPngBuffer({ margin: 3, scale: 2, light: '#fafafa' }));

  assert.deepEqual(pixel(0, 0), [0xfa, 0xfa, 0xfa]);
  assert.deepEqual(pixel((qr.size + 6) * 2 - 1, (qr.size + 6) * 2 - 1), [0xfa, 0xfa, 0xfa]);
});

test('PNG accepts shorthand hex colours', async () => {
  const { pixel } = decode(
    await QrCode.encodeText('hex').toPngBuffer({ margin: 1, scale: 1, dark: '#0f0', light: '#ffffff' }),
  );
  // Module (0, 0) is the top-left corner of the finder pattern, so it is dark.
  const [red, green, blue] = pixel(1, 1);

  assert.deepEqual([red, green, blue], [0, 255, 0]);
});

test('PNG rejects non-hex colours', async () => {
  const qr = QrCode.encodeText('colour');

  await assert.rejects(() => qr.toPngBuffer({ dark: 'red' }), InvalidArgumentError);
  await assert.rejects(() => qr.toPngBuffer({ light: 'rgb(0,0,0)' }), InvalidArgumentError);
});

test('PNG scale is clamped to at least one pixel per module', async () => {
  const qr = QrCode.encodeText('scale');
  const { width } = decode(await qr.toPngBuffer({ margin: 1, scale: 0 }));

  assert.equal(width, qr.size + 2);
});

test('toPngDataUrl returns a base64 PNG data URL', async () => {
  const url = await QrCode.encodeText('data url').toPngDataUrl();

  assert.match(url, /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/);
});

test('toBlob produces an SVG blob by default', async () => {
  const blob = await QrCode.encodeText('blob').toBlob();

  assert.equal(blob.type, 'image/svg+xml');
  assert.match(await blob.text(), /^<\?xml/);
});

test('toBlob produces a PNG blob when asked', async () => {
  const blob = await QrCode.encodeText('blob').toBlob({ type: 'image/png', scale: 2 });
  const bytes = new Uint8Array(await blob.arrayBuffer());

  assert.equal(blob.type, 'image/png');
  assert.equal(bytes[0], 137);
});

test('PNG output fails clearly without CompressionStream', async (t) => {
  const original = globalThis.CompressionStream;
  t.after(() => {
    globalThis.CompressionStream = original;
  });
  globalThis.CompressionStream = undefined;

  await assert.rejects(() => QrCode.encodeText('no codec').toPngBuffer(), EncodingError);
});
