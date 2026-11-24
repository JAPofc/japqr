#!/usr/bin/env node
/**
 * japofc-qr - quick start example
 *
 * Run with: node examples/node/quickstart.mjs
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/japofc/japofc-qr
 *
 * @author @japofc
 */

import { writeFileSync } from 'node:fs';
import { QrCode } from '../../dist/esm/index.js';

// 1. The one-liner most people need.
const qr = QrCode.encodeText('https://github.com/japofc/japofc-qr');
console.log(qr.toString());

// 2. Print it straight to the terminal.
console.log('\n--- terminal ---');
console.log(qr.toTerminalString({ margin: 2 }));

// 3. Write an SVG file.
const svg = qr.toSvgString({ margin: 4, scale: 8, title: 'Visit the repository' });
writeFileSync(new URL('./quickstart.svg', import.meta.url), svg);
console.log('--- wrote examples/node/quickstart.svg ---');

// 4. A data URL you can drop into an <img src>.
console.log('--- data url ---');
console.log(qr.toDataUrl({ margin: 2 }).slice(0, 80) + '...');

// 5. Inspect the matrix.
console.log('--- matrix ---');
console.log(`version=${qr.version} size=${qr.size} ecc=${qr.ecc} mask=${qr.mask}`);
console.log(qr.toBinaryStrings().slice(0, 3).join('\n') + '\n...');

// 6. Force error correction for a logo overlay, and check the capacity cost.
const robust = QrCode.encodeText('https://example.com', { ecc: 'high' });
console.log('--- robust ---');
console.log(`ecc=${robust.ecc} version=${robust.version} size=${robust.size}`);
