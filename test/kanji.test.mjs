/**
 * japofc-qr - kanji mode tests
 *
 * Kanji mode packs Shift-JIS characters into 13 bits each. The fixtures below
 * are real Shift-JIS byte pairs (checked against `TextDecoder('shift_jis')`),
 * and the packed bit values are derived from the subtraction step defined by
 * ISO/IEC 18004, so both halves of the contract are pinned.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import {
  QrSegment,
  QrCode,
  SegmentMode,
  charCountBits,
  InvalidArgumentError,
  UnsupportedCharacterError,
} from '../dist/esm/index.js';

/** Decodes Shift-JIS, available in Node builds with full ICU (all official ones). */
const shiftJis = new TextDecoder('shift_jis');

function bitsToNumber(bits) {
  return bits.reduce((value, bit) => value * 2 + bit, 0);
}

test('kanji fixtures are real Shift-JIS text', () => {
  assert.equal(shiftJis.decode(Uint8Array.from([0x8a, 0xbf, 0x8e, 0x9a])), '漢字');
  assert.equal(shiftJis.decode(Uint8Array.from([0x88, 0x9f])), '亜');
});

test('kanji packs 13 bits per character with the standard subtraction', () => {
  // 亜 = Shift-JIS 0x889F -> 0x889F - 0x8140 = 0x075F -> 0x07 * 0xC0 + 0x5F.
  const segment = QrSegment.kanji([0x88, 0x9f]);
  assert.equal(segment.mode, SegmentMode.Kanji);
  assert.equal(segment.numChars, 1);
  assert.equal(segment.data.length, 13);
  assert.equal(bitsToNumber(segment.data), 0x07 * 0xc0 + 0x5f);
});

test('kanji subtracts 0xC140 in the 0xE040-0xEBBF range', () => {
  // 0xE040 - 0xC140 = 0x1F00 -> 0x1F * 0xC0 + 0x00.
  const segment = QrSegment.kanji([0xe0, 0x40]);
  assert.equal(segment.data.length, 13);
  assert.equal(bitsToNumber(segment.data), 0x1f * 0xc0);
});

test('kanji counts characters, not bytes', () => {
  const segment = QrSegment.kanji([0x8a, 0xbf, 0x8e, 0x9a]);
  assert.equal(segment.numChars, 2);
  assert.equal(segment.data.length, 26);
  assert.equal(segment.totalBits(1), 4 + 8 + 26);
  assert.equal(segment.totalBits(10), 4 + 10 + 26);
});

test('kanji uses the version-band character-count widths', () => {
  assert.equal(charCountBits(SegmentMode.Kanji, 9), 8);
  assert.equal(charCountBits(SegmentMode.Kanji, 10), 10);
  assert.equal(charCountBits(SegmentMode.Kanji, 27), 12);
});

test('kanji validates length, byte range and Shift-JIS ranges', () => {
  assert.throws(() => QrSegment.kanji([0x8a]), InvalidArgumentError, 'odd length');
  assert.throws(() => QrSegment.kanji([0x8a, 300]), InvalidArgumentError, 'byte out of range');
  assert.throws(() => QrSegment.kanji([0x81, 0x3f]), UnsupportedCharacterError, 'below 0x8140');
  assert.throws(() => QrSegment.kanji([0x9f, 0xfd]), UnsupportedCharacterError, 'above 0x9FFC');
  assert.throws(() => QrSegment.kanji([0xa0, 0x40]), UnsupportedCharacterError, 'gap between ranges');
  assert.throws(() => QrSegment.kanji([0xec, 0x40]), UnsupportedCharacterError, 'above 0xEBBF');
});

test('kanji segments encode into a scannable symbol', () => {
  const sjis = [0x8a, 0xbf, 0x8e, 0x9a]; // 漢字
  const qr = QrCode.encodeSegments([QrSegment.kanji(sjis)], { ecc: 'high' });
  assert.equal(QrSegment.kanji(sjis).mode, SegmentMode.Kanji);
  assert.ok(qr.version >= 1 && qr.version <= 40);
  assert.equal(qr.size, qr.version * 4 + 17);
});

test('kanji segments decode back to the original text through jsQR', () => {
  const sjis = Uint8Array.from([0x8a, 0xbf, 0x8e, 0x9a]); // 漢字
  const qr = QrCode.encodeSegments([QrSegment.kanji(sjis)], { ecc: 'high' });

  const scale = 6;
  const margin = 4;
  const dimension = (qr.size + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(dimension * dimension * 4).fill(255);
  for (let y = 0; y < qr.size; y += 1) {
    for (let x = 0; x < qr.size; x += 1) {
      if (!qr.modules[y][x]) {
        continue;
      }
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const at = ((y + margin) * scale + dy) * dimension * 4 + ((x + margin) * scale + dx) * 4;
          pixels[at] = 0;
          pixels[at + 1] = 0;
          pixels[at + 2] = 0;
        }
      }
    }
  }

  const decoded = jsQR(pixels, dimension, dimension);
  assert.ok(decoded, 'kanji symbol must be scannable');
  assert.equal(decoded.chunks[0].type, 'kanji');
  assert.equal(decoded.data, '漢字');
  assert.deepEqual([...decoded.binaryData], [...sjis]);
});

test('kanji mode stores Japanese denser than byte mode', () => {
  const sjis = Array.from({ length: 20 }, (_, index) => [0x88 + (index % 2), 0x9f + (index % 30)]).flat();
  const kanjiVersion = QrCode.encodeSegments([QrSegment.kanji(sjis)], { ecc: 'medium', boostEcc: false }).version;
  const byteVersion = QrCode.encodeSegments([QrSegment.bytes(sjis)], { ecc: 'medium', boostEcc: false }).version;
  assert.ok(kanjiVersion <= byteVersion, `kanji v${kanjiVersion} should fit in byte v${byteVersion}`);
});
