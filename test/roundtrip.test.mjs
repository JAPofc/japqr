/**
 * japqr - round-trip tests
 *
 * Every generated matrix is rasterised and decoded again with `jsqr`. This is
 * the strongest correctness check available: it exercises the whole pipeline
 * (segmentation, padding, Reed-Solomon, interleaving, zigzag placement,
 * masking, format and version information) against an independent decoder.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/japofc/japqr
 *
 * @author @japofc
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { QrCode, getDataCapacity } from '../dist/esm/index.js';

/** Renders a QR Code into an RGBA buffer with a quiet zone. */
function rasterize(qr, scale = 6, margin = 4) {
  const dimension = (qr.size + margin * 2) * scale;
  const data = new Uint8ClampedArray(dimension * dimension * 4).fill(255);

  for (let y = 0; y < qr.size; y += 1) {
    for (let x = 0; x < qr.size; x += 1) {
      if (!qr.modules[y][x]) {
        continue;
      }
      const originX = (x + margin) * scale;
      const originY = (y + margin) * scale;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const index = ((originY + dy) * dimension + originX + dx) * 4;
          data[index] = 0;
          data[index + 1] = 0;
          data[index + 2] = 0;
        }
      }
    }
  }

  return { data, width: dimension, height: dimension };
}

/** Encodes, rasterises, decodes and asserts the payload round-trips. */
function assertRoundTrip(payload, options) {
  const qr = QrCode.encodeText(payload, options);
  const image = rasterize(qr);
  const decoded = jsQR(image.data, image.width, image.height);
  assert.ok(decoded, `QR Code for ${JSON.stringify(payload.slice(0, 40))} was not decodable`);
  assert.equal(decoded.data, payload);
  return qr;
}

test('plain ASCII round-trips', () => {
  assertRoundTrip('Hello, World!');
  assertRoundTrip('The quick brown fox jumps over the lazy dog.');
  assertRoundTrip('a');
  assertRoundTrip('x'.repeat(1000));
});

test('URLs round-trip', () => {
  assertRoundTrip('https://example.com/path?query=1&other=2#fragment');
  assertRoundTrip('https://github.com/japofc/japqr');
  assertRoundTrip('mailto:hello@example.com?subject=QR%20Code');
});

test('numeric payloads round-trip', () => {
  assertRoundTrip('0');
  assertRoundTrip('1234567890');
  assertRoundTrip('1234567890123456789012345678901234567890');
});

test('alphanumeric payloads round-trip', () => {
  assertRoundTrip('HELLO WORLD');
  assertRoundTrip('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  assertRoundTrip(' $%*+-./:');
  assertRoundTrip('A1B2C3D4E5');
});

test('UTF-8 payloads round-trip', () => {
  assertRoundTrip('Halo, dunia!');
  assertRoundTrip('Selamat datang di Medan');
  assertRoundTrip('🚀 QR codes everywhere');
  assertRoundTrip('日本語のテキスト');
});

test('all 40 versions encode and decode correctly', () => {
  for (let version = 1; version <= 40; version += 1) {
    const previousCapacity = version === 1 ? 0 : getDataCapacity(version - 1, 'medium');
    const length = version === 1 ? 1 : Math.floor((previousCapacity * 8 - 12) / 8) + 1;
    const payload = 'v'.repeat(length);
    const qr = assertRoundTrip(payload, { ecc: 'medium', boostEcc: false });
    assert.equal(qr.version, version, `expected version ${version}`);
    assert.equal(qr.size, 17 + 4 * version);
  }
});

test('every error-correction level round-trips', () => {
  const payload = 'ECC ' + 'x'.repeat(60);
  for (const ecc of ['low', 'medium', 'quartile', 'high']) {
    const qr = assertRoundTrip(payload, { ecc, boostEcc: false });
    assert.equal(qr.ecc, ecc);
  }
});

test('every mask pattern round-trips', () => {
  for (let mask = 0; mask <= 7; mask += 1) {
    const qr = assertRoundTrip(`Mask pattern ${mask}`, { mask });
    assert.equal(qr.mask, mask);
  }
});

test('high-capacity payloads round-trip', () => {
  const qr = QrCode.encodeText('z'.repeat(2900), { ecc: 'low' });
  assert.ok(qr.version >= 35);
  assertRoundTrip('z'.repeat(2900), { ecc: 'low' });
});

test('binary payloads round-trip', () => {
  const bytes = Uint8Array.from(Array.from({ length: 32 }, (_, index) => (index * 7) & 0xff));
  const qr = QrCode.encodeBinary(bytes);
  const image = rasterize(qr);
  const decoded = jsQR(image.data, image.width, image.height);
  assert.ok(decoded);
  assert.deepEqual([...decoded.binaryData], [...bytes]);
});
