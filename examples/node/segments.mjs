#!/usr/bin/env node
/**
 * japqr - advanced segments example
 *
 * Run with: node examples/node/segments.mjs
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/japofc/japqr
 *
 * @author @japofc
 */

import { QrCode, QrSegment, SegmentMode, getDataCapacity } from '../../dist/esm/index.js';

// Automatic mode selection: "HELLO" and "12345" become one alphanumeric
// segment, "world" stays in byte mode.
const segments = QrSegment.fromText('HELLO 12345 world');
for (const segment of segments) {
  console.log(`${SegmentMode[segment.mode]}: ${segment.numChars} chars, ${segment.data.length} bits`);
}

// Manual segment control, including an ECI designator for UTF-8.
const custom = QrCode.encodeSegments(
  [QrSegment.eci(26), QrSegment.numeric('0123456789'), QrSegment.alphanumeric('HELLO WORLD')],
  { ecc: 'medium' },
);
console.log(`\nECI + mixed segments -> version ${custom.version}, ${custom.size}x${custom.size}`);

// Raw bytes, for binary payloads such as protobuf or signed tokens.
const bytes = Uint8Array.from([0xde, 0xad, 0xbe, 0xef, 0x00, 0x42]);
const binary = QrCode.encodeBinary(bytes);
console.log(`binary payload      -> version ${binary.version}, ecc ${binary.ecc}`);

// A version/ECC pair can be planned ahead with getDataCapacity().
for (const ecc of ['low', 'medium', 'quartile', 'high']) {
  console.log(`version 10 @ ${ecc.padEnd(8)} -> ${getDataCapacity(10, ecc)} data codewords`);
}
