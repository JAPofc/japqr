/**
 * japqr - error taxonomy tests
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
  EncodingError,
  InvalidArgumentError,
  QrCode,
  QrCodeError,
  UnsupportedCharacterError,
} from '../dist/esm/index.js';

test('every library error extends QrCodeError and Error', () => {
  const errors = [
    new InvalidArgumentError('bad'),
    new DataTooLongError('long'),
    new UnsupportedCharacterError('char'),
    new EncodingError('state'),
  ];

  for (const error of errors) {
    assert.ok(error instanceof QrCodeError);
    assert.ok(error instanceof Error);
    assert.ok(typeof error.code === 'string');
    assert.ok(error.code.startsWith('ERR_'));
    assert.equal(error.name, error.constructor.name);
  }
});

test('error codes are stable and documented', () => {
  assert.equal(new InvalidArgumentError('x').code, 'ERR_INVALID_ARGUMENT');
  assert.equal(new DataTooLongError('x').code, 'ERR_DATA_TOO_LONG');
  assert.equal(new UnsupportedCharacterError('x').code, 'ERR_UNSUPPORTED_CHARACTER');
  assert.equal(new EncodingError('x').code, 'ERR_ENCODING');
});

test('instanceof survives subclassing across modules', () => {
  assert.throws(
    () => QrCode.encodeText('x', { ecc: 'nope' }),
    (error) => error instanceof QrCodeError && error.code === 'ERR_INVALID_ARGUMENT',
  );
});

test('oversized payloads report the required size', () => {
  try {
    QrCode.encodeText('x'.repeat(4000), { maxVersion: 10 });
    assert.fail('expected DataTooLongError');
  } catch (error) {
    assert.ok(error instanceof DataTooLongError);
    assert.match(error.message, /bits/);
  }
});
