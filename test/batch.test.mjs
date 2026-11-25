/**
 * japofc-qr - batch archive, API surface and output pins
 *
 * Three different kinds of "nothing changed by accident":
 *
 * 1. The ZIP produced by `encodeBatch()` is validated structurally.
 * 2. The public API is snapshotted, so an export cannot appear or disappear
 *    without a commit that says so.
 * 3. The PNG bytes are pinned by hash, so a renderer tweak cannot change pixel
 *    output silently.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import * as api from '../dist/esm/index.js';
import { QrCode, encodeBatch } from '../dist/esm/index.js';

/** CRC-32 over a byte range, mirroring what the ZIP writer used. */
function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

test('encodeBatch returns a valid ZIP with one PNG per item', async () => {
  const zip = await encodeBatch([
    { name: 'tiket/001', text: 'https://example.com/001' },
    { name: 'tiket 002', text: 'https://example.com/002' },
  ]);

  assert.equal(zip[0], 0x50);
  assert.equal(zip[1], 0x4b);
  assert.equal(zip[2], 0x03);
  assert.equal(zip[3], 0x04);

  // End of central directory signature, 22 bytes from the end.
  assert.equal(zip[zip.length - 22], 0x50);
  assert.equal(zip[zip.length - 21], 0x4b);
  assert.equal(zip[zip.length - 20], 0x05);
  assert.equal(zip[zip.length - 19], 0x06);

  const text = new TextDecoder('latin1').decode(zip);
  assert.match(text, /tiket-001\.png/);
  assert.match(text, /tiket-002\.png/);
});

test('encodeBatch sanitizes file names', async () => {
  const zip = await encodeBatch([
    { name: 'a/b\\c:d*e?f"g<h>i|j', text: 'x' },
    { name: '   ', text: 'y' },
  ]);

  const text = new TextDecoder('latin1').decode(zip);
  assert.match(text, /a-b-c-d-e-f-g-h-i-j\.png/);
  assert.match(text, /qr-code\.png/);
});

test('encodeBatch stores PNG data uncompressed', async () => {
  const zip = await encodeBatch([{ name: 'one', text: 'x' }], { png: { scale: 2 } });

  // Local header: signature(4) + version(2) + flags(2) + method(2) ...
  const view = new DataView(zip.buffer, zip.byteOffset);
  assert.equal(view.getUint16(8, true), 0, 'method must be stored');
  assert.equal(view.getUint32(18, true), view.getUint32(22, true), 'stored sizes must match');

  // The CRC in the local header must match the payload it describes.
  const nameLength = view.getUint16(26, true);
  const dataStart = 30 + nameLength;
  const size = view.getUint32(18, true);
  const stored = view.getUint32(14, true);
  const expected = crc32(zip.subarray(dataStart, dataStart + size));

  assert.equal(stored, expected);
});

test('encodeBatch applies per-entry and batch options', async () => {
  const zip = await encodeBatch(
    [
      { name: 'a', text: 'short', encode: { ecc: 'high' } },
      { name: 'b', text: 'x'.repeat(200) },
    ],
    { encode: { ecc: 'low' }, png: { scale: 1 } },
  );

  assert.ok(zip.length > 0);
  // Each name appears twice: in the local header and in the central directory.
  assert.equal(new TextDecoder('latin1').decode(zip).match(/\.png/g).length, 4);
});

test('encodeBatch rejects an empty list cleanly', async () => {
  const zip = await encodeBatch([]);
  assert.equal(zip.length, 22, 'an empty archive is just the end record');
});

test('every ZIP payload is a valid PNG', async () => {
  const zip = await encodeBatch([{ name: 'a', text: 'x' }, { name: 'b', text: 'y' }], {
    png: { scale: 2 },
  });

  const view = new DataView(zip.buffer, zip.byteOffset);
  let offset = 0;
  let checked = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const nameLength = view.getUint16(offset + 26, true);
    const size = view.getUint32(offset + 18, true);
    const dataStart = offset + 30 + nameLength;
    assert.equal(zip[dataStart], 137, 'PNG signature');
    assert.equal(zip[dataStart + 1], 80);
    offset = dataStart + size;
    checked += 1;
  }

  assert.equal(checked, 2);
});

test('public API surface matches the snapshot', () => {
  assert.deepEqual(Object.keys(api).sort(), [
    'ALPHANUMERIC_CHARSET',
    'AUTHOR',
    'AUTHOR_B64',
    'AUTHOR_CODES',
    'BRAND',
    'BitBuffer',
    'DataTooLongError',
    'ECC_CODEWORDS_PER_BLOCK',
    'ECC_FORMAT_BITS',
    'ECC_LEVELS',
    'EncodingError',
    'HOMEPAGE',
    'InvalidArgumentError',
    'LICENSE',
    'MAX_VERSION',
    'MIN_VERSION',
    'NUM_ERROR_CORRECTION_BLOCKS',
    'QrCode',
    'QrCodeError',
    'QrMatrix',
    'QrPayload',
    'QrSegment',
    'SegmentMode',
    'UnsupportedCharacterError',
    'assertMask',
    'attributionComment',
    'attributionMetadata',
    'authorFromCodes',
    'bytesToBase64',
    'charCountBits',
    'drawToCanvas',
    'eccIndex',
    'encodeBatch',
    'getDataCapacity',
    'getNumDataCodewords',
    'getNumRawDataModules',
    'getQrSize',
    'getSize',
    'gfMultiply',
    'gfPow',
    'renderPng',
    'renderSvg',
    'renderTerminal',
    'rsComputeDivisor',
    'rsComputeRemainder',
    'rsEncode',
    'toBase64',
    'utf8Encode',
  ]);
});

test('PNG output is pinned by hash', async () => {
  const qr = QrCode.encodeText('https://github.com/JAPofc/japqr', { ecc: 'high', mask: 3 });
  const digest = createHash('sha256').update(await qr.toPngBuffer({ scale: 4 })).digest('hex');

  assert.equal(digest, '5996f68db1335f78f7a00d305ac1fe0ef8a196f4a6c11fe7a8b1a162e49a82e7');
});

test('PNG output is deterministic across calls', async () => {
  const qr = QrCode.encodeText('determinism', { ecc: 'high' });
  const first = createHash('sha256').update(await qr.toPngBuffer({ scale: 3 })).digest('hex');
  const second = createHash('sha256').update(await qr.toPngBuffer({ scale: 3 })).digest('hex');

  assert.equal(first, second);
});

test('inflating the PNG scanlines reproduces the matrix', async () => {
  const qr = QrCode.encodeText('roundtrip', { ecc: 'high' });
  const png = await qr.toPngBuffer({ margin: 1, scale: 2 });

  // Skip to the first IDAT and inflate it.
  const view = new DataView(png.buffer, png.byteOffset);
  let offset = 8;
  let idat = null;
  while (offset < png.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    if (type === 'IDAT') {
      idat = png.subarray(offset + 8, offset + 8 + length);
      break;
    }
    offset += 12 + length;
  }

  const raw = inflateSync(idat);
  const size = (qr.size + 2) * 2;
  const stride = size * 3 + 1;
  assert.equal(raw.length, stride * size);

  // One quiet-zone module at scale 2 puts module (0, 0) at pixels 2..3.
  const pixelOffset = 2 * stride + 1 + 2 * 3;
  assert.equal(raw[pixelOffset], 0);
  // And the quiet zone itself stays light.
  assert.equal(raw[1 * stride + 1 + 1 * 3], 255);
});
