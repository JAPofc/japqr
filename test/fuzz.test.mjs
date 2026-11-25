/**
 * japofc-qr - fuzz and golden tests
 *
 * Two complementary guards:
 *
 * 1. Fuzzing encodes pseudo-random payloads (seeded, so failures reproduce)
 *    and decodes them with `jsqr`, catching input shapes the fixed fixtures
 *    never reach.
 * 2. Golden files pin the SVG output byte for byte, so a change in path
 *    building, escaping or attribution is detected instead of shipping
 *    silently.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import jsQR from 'jsqr';
import { QrCode, ECC_LEVELS } from '../dist/esm/index.js';

const here = dirname(fileURLToPath(import.meta.url));

const ALPHABETS = [
  '0123456789',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 $%*+-./:',
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,;:!?@#&()-_/',
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,;:!?@#&()-_/·—→🚀😀éüñ日本語',
];

/** Deterministic 32-bit PRNG so a failure can be reproduced from its seed. */
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Renders a QR Code into an RGBA buffer with a quiet zone. */
function rasterize(qr, scale = 5, margin = 4) {
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

  return { data, dimension };
}

function decode(qr) {
  const { data, dimension } = rasterize(qr);
  return jsQR(data, dimension, dimension)?.data ?? null;
}

test('random payloads round-trip through an independent decoder', () => {
  const random = mulberry32(0x6a617066);
  const lengths = [1, 3, 7, 12, 25, 60, 120, 300, 700];

  for (let iteration = 0; iteration < 45; iteration += 1) {
    // Array.from splits by code point, so emoji never become lone surrogates.
    const alphabet = Array.from(ALPHABETS[iteration % ALPHABETS.length]);
    const length = lengths[Math.floor(random() * lengths.length)];
    let payload = '';
    for (let index = 0; index < length; index += 1) {
      payload += alphabet[Math.floor(random() * alphabet.length)];
    }

    const ecc = ECC_LEVELS[Math.floor(random() * ECC_LEVELS.length)];
    const mask = Math.floor(random() * 8);
    const qr = QrCode.encodeText(payload, { ecc, mask });
    const decoded = decode(qr);

    assert.equal(decoded, payload, `seed 0x6a617066, iteration ${iteration}, ecc ${ecc}, mask ${mask}`);
  }
});

test('SVG output matches the golden file byte for byte', () => {
  const svg = QrCode.encodeText('https://github.com/JAPofc/japqr', { ecc: 'high', mask: 3 }).toSvgString();
  const golden = readFileSync(join(here, 'golden', 'repo-v4-high-mask3.svg'), 'utf8');

  assert.equal(svg, golden);
});

test('golden SVG is well-formed XML', () => {
  const golden = readFileSync(join(here, 'golden', 'repo-v4-high-mask3.svg'), 'utf8');

  assert.match(golden, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n/);
  assert.match(golden, /<svg[^>]*viewBox="-4 -4 41 41"/);
  assert.match(golden, /<\/svg>\n$/);
  assert.equal((golden.match(/<title>/g) ?? []).length, 1);
  assert.equal((golden.match(/<metadata>/g) ?? []).length, 1);
});
