/**
 * japofc-qr - feature tests
 *
 * Covers `fromJSON`, the packed bitmap, and the SVG gradient and logo options.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QrCode, InvalidArgumentError } from '../dist/esm/index.js';

test('fromJSON rebuilds an identical symbol', () => {
  const original = QrCode.encodeText('https://github.com/JAPofc/japqr', { ecc: 'high' });
  const restored = QrCode.fromJSON(JSON.parse(JSON.stringify(original.toJSON())));

  assert.equal(restored.version, original.version);
  assert.equal(restored.size, original.size);
  assert.equal(restored.ecc, original.ecc);
  assert.equal(restored.mask, original.mask);
  assert.deepEqual(restored.toBinaryStrings(), original.toBinaryStrings());
});

test('fromJSON survives a real JSON string round-trip', () => {
  const original = QrCode.encodeText('emoji: 🚀', { ecc: 'quartile' });
  const restored = QrCode.fromJSON(JSON.parse(JSON.stringify(original.toJSON())));

  assert.equal(restored.toSvgString(), original.toSvgString());
});

test('fromJSON rejects malformed documents', () => {
  const valid = QrCode.encodeText('x').toJSON();

  assert.throws(() => QrCode.fromJSON(null), InvalidArgumentError);
  assert.throws(() => QrCode.fromJSON('nope'), InvalidArgumentError);
  assert.throws(() => QrCode.fromJSON({ ...valid, version: 0 }), /version must be an integer/);
  assert.throws(() => QrCode.fromJSON({ ...valid, version: 41 }), /version must be an integer/);
  assert.throws(() => QrCode.fromJSON({ ...valid, ecc: 'ultra' }), /unknown error-correction level/);
  assert.throws(() => QrCode.fromJSON({ ...valid, mask: 8 }), /mask must be an integer/);
  assert.throws(() => QrCode.fromJSON({ ...valid, modules: [] }), /expected 21 rows/);
  assert.throws(
    () => QrCode.fromJSON({ ...valid, modules: valid.modules.map((row) => `${row.slice(1)}2`) }),
    /must be a 21-character string/,
  );
});

test('toUint8Array packs one bit per module, MSB first', () => {
  const qr = QrCode.encodeText('x', { ecc: 'high' });
  const bytes = qr.toUint8Array();
  const rowBytes = Math.ceil(qr.size / 8);

  assert.equal(bytes.length, rowBytes * qr.size);
  assert.ok(bytes instanceof Uint8Array);

  for (let y = 0; y < qr.size; y += 1) {
    for (let x = 0; x < qr.size; x += 1) {
      const bit = (bytes[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
      assert.equal(bit === 1, qr.modules[y][x], `module (${x}, ${y}) mismatch`);
    }
  }
});

test('toUint8Array pads the final byte of every row', () => {
  // 21 modules -> 3 bytes per row, so 3 padding bits at the end of each row.
  const qr = QrCode.encodeText('x');
  const bytes = qr.toUint8Array();
  const rowBytes = Math.ceil(qr.size / 8);

  for (let y = 0; y < qr.size; y += 1) {
    const last = bytes[y * rowBytes + rowBytes - 1];
    const paddingBits = rowBytes * 8 - qr.size;
    assert.equal(last & ((1 << paddingBits) - 1), 0, `row ${y} has dirty padding bits`);
  }
});

test('SVG gradient injects a linearGradient and a url() fill', () => {
  const svg = QrCode.encodeText('gradient').toSvgString({
    gradient: { from: '#0b0f14', to: '#1f6feb', angle: 45 },
  });

  assert.match(svg, /<defs><linearGradient id="qr-gradient"/);
  assert.match(svg, /<stop offset="0" stop-color="#0b0f14"\/>/);
  assert.match(svg, /<stop offset="1" stop-color="#1f6feb"\/>/);
  assert.match(svg, /<path fill="url\(#qr-gradient\)"/);
});

test('SVG gradient angle controls the direction', () => {
  const horizontal = QrCode.encodeText('gradient').toSvgString({
    gradient: { from: '#000000', to: '#ffffff', angle: 0 },
  });
  const vertical = QrCode.encodeText('gradient').toSvgString({
    gradient: { from: '#000000', to: '#ffffff', angle: 90 },
  });

  assert.match(horizontal, /x1="0" y1="0.5" x2="1" y2="0.5"/);
  assert.match(vertical, /x1="0.5" y1="0" x2="0.5" y2="1"/);
});

test('SVG gradient id is namespaced under the svg id', () => {
  const svg = QrCode.encodeText('gradient').toSvgString({
    id: 'hero',
    gradient: { from: '#000000', to: '#ffffff' },
  });

  assert.match(svg, /<linearGradient id="hero-qr-gradient"/);
  assert.match(svg, /fill="url\(#hero-qr-gradient\)"/);
});

test('SVG logo clears the modules underneath and draws an image', () => {
  const svg = QrCode.encodeText('logo', { ecc: 'high' }).toSvgString({
    light: '#ffffff',
    logo: { data: 'data:image/svg+xml;base64,PHN2Zy8+', width: 0.2 },
  });

  assert.match(svg, /<rect x="8.4" y="8.4" width="4.2" height="4.2" rx="0.588" fill="#ffffff"\/>/);
  assert.match(svg, /<image href="data:image\/svg\+xml;base64,PHN2Zy8\+"/);
  assert.match(svg, /preserveAspectRatio="xMidYMid meet" opacity="1"/);
});

test('SVG logo width is clamped to a scannable range', () => {
  const huge = QrCode.encodeText('logo', { ecc: 'high' }).toSvgString({
    logo: { data: 'data:,', width: 0.9 },
  });
  const tiny = QrCode.encodeText('logo', { ecc: 'high' }).toSvgString({
    logo: { data: 'data:,', width: 0.01 },
  });

  // 21 modules: 0.3 -> 6.3, 0.05 -> 1.05.
  assert.match(huge, /width="6.3" height="6.3"/);
  assert.match(tiny, /width="1.05" height="1.05"/);
});

test('SVG logo opacity is clamped to 0..1', () => {
  const svg = QrCode.encodeText('logo', { ecc: 'high' }).toSvgString({
    logo: { data: 'data:,', opacity: 4 },
  });

  assert.match(svg, /opacity="1"/);
});

test('gradient and logo combine with the attribution switch', () => {
  const svg = QrCode.encodeText('x').toSvgString({
    attribution: false,
    gradient: { from: '#000000', to: '#333333' },
    logo: { data: 'data:,', width: 0.15 },
  });

  assert.doesNotMatch(svg, /@japofc/);
  assert.match(svg, /<linearGradient/);
  assert.match(svg, /<image /);
});
