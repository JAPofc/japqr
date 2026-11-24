/**
 * japqr - encoding behaviour tests
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/japofc/japqr
 *
 * @author @japofc
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DataTooLongError,
  getDataCapacity,
  getNumDataCodewords,
  InvalidArgumentError,
  QrCode,
  QrSegment,
  SegmentMode,
  UnsupportedCharacterError,
} from '../dist/esm/index.js';

test('a short string produces a version 1 code', () => {
  const qr = QrCode.encodeText('HELLO');
  assert.equal(qr.version, 1);
  assert.equal(qr.size, 21);
  assert.equal(qr.modules.length, 21);
  assert.ok(qr.modules.every((row) => row.length === 21));
});

test('size follows the 17 + 4 * version formula for every version', () => {
  for (let version = 1; version <= 40; version += 1) {
    const capacity = getDataCapacity(version, 'low');
    const countBits = version <= 9 ? 8 : 16;
    const payload = 'x'.repeat(Math.max(1, Math.floor((capacity * 8 - 4 - countBits) / 8)));
    const qr = QrCode.encodeText(payload, { ecc: 'low', boostEcc: false });
    assert.equal(qr.version, version);
    assert.equal(qr.size, 17 + 4 * version);
  }
});

test('version selection is minimal for the requested payload', () => {
  // Version 1 medium holds 16 data codewords = 128 bits; byte mode needs 12 bits of overhead.
  assert.equal(QrCode.encodeText('x'.repeat(14)).version, 1);
  assert.equal(QrCode.encodeText('x'.repeat(15)).version, 2);
});

test('capacity table matches the ISO/IEC 18004 reference values', () => {
  assert.equal(getDataCapacity(1, 'low'), 19);
  assert.equal(getDataCapacity(1, 'medium'), 16);
  assert.equal(getDataCapacity(1, 'quartile'), 13);
  assert.equal(getDataCapacity(1, 'high'), 9);
  assert.equal(getDataCapacity(10, 'low'), 274);
  assert.equal(getDataCapacity(40, 'low'), 2956);
  assert.equal(getDataCapacity(40, 'medium'), 2334);
  assert.equal(getDataCapacity(40, 'quartile'), 1666);
  assert.equal(getDataCapacity(40, 'high'), 1276);
  assert.equal(getNumDataCodewords(40, 'low'), 2956);
});

test('error-correction level is boosted while the payload still fits', () => {
  assert.equal(QrCode.encodeText('a').ecc, 'high');
  assert.equal(QrCode.encodeText('a', { ecc: 'low' }).ecc, 'high');
  assert.equal(QrCode.encodeText('a', { ecc: 'low', boostEcc: false }).ecc, 'low');
  // 15 bytes need 132 bits: they fit version 1 at low (152 bits) but not at
  // high (72 bits), so boosting must leave the level untouched.
  const full = QrCode.encodeText('x'.repeat(15), { ecc: 'low' });
  assert.equal(full.version, 1);
  assert.equal(full.ecc, 'low');
});

test('every error-correction level is honoured when boosting is off', () => {
  for (const ecc of ['low', 'medium', 'quartile', 'high']) {
    assert.equal(QrCode.encodeText('x'.repeat(40), { ecc, boostEcc: false }).ecc, ecc);
  }
});

test('the mask can be forced, or picked automatically', () => {
  for (let mask = 0; mask <= 7; mask += 1) {
    assert.equal(QrCode.encodeText('mask', { mask }).mask, mask);
  }
  const auto = QrCode.encodeText('mask', { mask: 'auto' }).mask;
  assert.ok(auto >= 0 && auto <= 7 && Number.isInteger(auto));
});

test('minVersion and maxVersion are respected', () => {
  assert.equal(QrCode.encodeText('a', { minVersion: 7, boostEcc: false }).version, 7);
  assert.throws(() => QrCode.encodeText('a'.repeat(500), { maxVersion: 5 }), DataTooLongError);
  assert.throws(() => QrCode.encodeText('a', { minVersion: 10, maxVersion: 5 }), InvalidArgumentError);
});

test('getModule returns false outside the grid', () => {
  const qr = QrCode.encodeText('x');
  assert.equal(qr.getModule(-1, 0), false);
  assert.equal(qr.getModule(0, -1), false);
  assert.equal(qr.getModule(qr.size, 0), false);
  assert.equal(qr.getModule(0, qr.size), false);
  assert.equal(typeof qr.getModule(0, 0), 'boolean');
});

test('toMatrix returns a detached copy', () => {
  const qr = QrCode.encodeText('x');
  const matrix = qr.toMatrix();
  const before = matrix[0][0];
  matrix[0][0] = !matrix[0][0];
  assert.equal(qr.getModule(0, 0), before);
});

test('numeric payloads produce a numeric segment', () => {
  const segments = QrSegment.fromText('1234567890');
  assert.equal(segments.length, 1);
  assert.equal(segments[0].mode, SegmentMode.Numeric);
  assert.equal(segments[0].numChars, 10);
  // 3 digits -> 10 bits, 3 digits -> 10 bits, 3 digits -> 10 bits, 1 digit -> 4 bits.
  assert.equal(segments[0].data.length, 34);
});

test('alphanumeric payloads produce an alphanumeric segment', () => {
  const segments = QrSegment.fromText('HELLO WORLD');
  assert.equal(segments.length, 1);
  assert.equal(segments[0].mode, SegmentMode.Alphanumeric);
  assert.equal(segments[0].numChars, 11);
  // Five pairs -> 55 bits, one leftover character -> 6 bits.
  assert.equal(segments[0].data.length, 61);
});

test('mixed text is split into cost-optimal segments', () => {
  const segments = QrSegment.fromText('ABC123xyz');
  assert.equal(segments.length, 2);
  assert.equal(segments[0].mode, SegmentMode.Alphanumeric);
  assert.equal(segments[0].numChars, 6);
  assert.equal(segments[1].mode, SegmentMode.Byte);
  assert.equal(segments[1].numChars, 3);
});

test('optimize: false forces a single byte segment', () => {
  const segments = QrSegment.fromText('HELLO 123', { optimize: false });
  assert.equal(segments.length, 1);
  assert.equal(segments[0].mode, SegmentMode.Byte);
  assert.equal(segments[0].numChars, 9);
});

test('non-Latin text falls back to byte mode', () => {
  const segments = QrSegment.fromText('Halo, dunia!');
  assert.equal(segments.length, 1);
  assert.equal(segments[0].mode, SegmentMode.Byte);
});

test('emoji are encoded as UTF-8', () => {
  const segments = QrSegment.fromText('🚀');
  assert.equal(segments.length, 1);
  assert.equal(segments[0].numChars, 4);
  assert.equal(segments[0].data.length, 32);
});

test('ECI segments encode the assignment value in the standard widths', () => {
  // The 4-bit mode indicator is emitted by the encoder, so a segment only
  // carries the assignment value itself.
  const small = QrSegment.eci(26);
  assert.deepEqual([...small.data], [0, 0, 0, 1, 1, 0, 1, 0]);
  assert.equal(small.mode, SegmentMode.Eci);
  assert.equal(small.totalBits(1), 12);

  const medium = QrSegment.eci(200);
  assert.equal(medium.data.length, 16); // 2-bit prefix + 14-bit value
  assert.deepEqual([...medium.data].slice(0, 2), [1, 0]);

  const large = QrSegment.eci(999999);
  assert.equal(large.data.length, 24); // 3-bit prefix + 21-bit value
  assert.deepEqual([...large.data].slice(0, 3), [1, 1, 0]);

  assert.throws(() => QrSegment.eci(-1), InvalidArgumentError);
  assert.throws(() => QrSegment.eci(1000000), InvalidArgumentError);
});

test('character-count widths follow the version bands', () => {
  assert.equal(new QrSegment(SegmentMode.Byte, 1, []).charCountBits(9), 8);
  assert.equal(new QrSegment(SegmentMode.Byte, 1, []).charCountBits(10), 16);
  assert.equal(new QrSegment(SegmentMode.Byte, 1, []).charCountBits(27), 16);
  assert.equal(new QrSegment(SegmentMode.Numeric, 1, []).charCountBits(9), 10);
  assert.equal(new QrSegment(SegmentMode.Numeric, 1, []).charCountBits(26), 12);
  assert.equal(new QrSegment(SegmentMode.Alphanumeric, 1, []).charCountBits(40), 13);
});

test('empty payloads are rejected', () => {
  assert.throws(() => QrCode.encodeText(''), InvalidArgumentError);
  assert.throws(() => QrCode.encodeSegments([]), InvalidArgumentError);
});

test('non-string input is rejected', () => {
  assert.throws(() => QrCode.encodeText(123), InvalidArgumentError);
  assert.throws(() => QrCode.encodeText(null), InvalidArgumentError);
});

test('unsupported characters are rejected with a dedicated error', () => {
  assert.throws(() => QrSegment.numeric('12A4'), UnsupportedCharacterError);
  assert.throws(() => QrSegment.alphanumeric('hello'), UnsupportedCharacterError);
  assert.equal(QrSegment.isNumeric('0123456789'), true);
  assert.equal(QrSegment.isNumeric('12 4'), false);
  assert.equal(QrSegment.isAlphanumeric('AB 12$%*+-./:'), true);
  assert.equal(QrSegment.isAlphanumeric('ab'), false);
});

test('invalid option values are rejected', () => {
  assert.throws(() => QrCode.encodeText('x', { ecc: 'ultra' }), InvalidArgumentError);
  assert.throws(() => QrCode.encodeText('x', { mask: 8 }), InvalidArgumentError);
  assert.throws(() => QrCode.encodeText('x', { mask: -1 }), InvalidArgumentError);
  assert.throws(() => QrCode.encodeText('x', { minVersion: 0 }), InvalidArgumentError);
  assert.throws(() => QrCode.encodeText('x', { maxVersion: 41 }), InvalidArgumentError);
  assert.throws(() => QrCode.encodeBinary([256]), InvalidArgumentError);
  assert.throws(() => QrCode.encodeBinary([-1]), InvalidArgumentError);
});

test('binary payloads survive untouched', () => {
  const bytes = Uint8Array.from([0x00, 0x0a, 0x7f, 0x80, 0xfe, 0xff]);
  const qr = QrCode.encodeBinary(bytes);
  assert.equal(qr.version, 1);
  assert.equal(qr.size, 21);
});

test('toJSON exposes a stable snapshot shape', () => {
  const qr = QrCode.encodeText('HELLO', { boostEcc: false });
  const json = qr.toJSON();
  assert.equal(json.generator, 'japqr');
  assert.equal(json.version, 1);
  assert.equal(json.size, 21);
  assert.equal(json.ecc, 'medium');
  assert.equal(json.mask, qr.mask);
  assert.equal(json.modules.length, 21);
  assert.ok(json.modules.every((row) => /^[01]{21}$/.test(row)));
});
