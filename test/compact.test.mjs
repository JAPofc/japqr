/**
 * japofc-qr - compact terminal renderer tests
 *
 * The half-block renderer trades resolution for size, so the important property
 * is that no module is lost: every character cell is decoded back into its two
 * module rows and compared with the original matrix.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QrCode } from '../dist/esm/index.js';

/** Decodes a compact rendering back into a module matrix, quiet zone included. */
function decodeCompact(text) {
  const lines = text.split('\n');
  const grid = [];

  for (let row = 0; row < lines.length; row += 1) {
    const upper = [];
    const lower = [];
    for (const cell of lines[row]) {
      const solid = cell === '█';
      const top = solid || cell === '▀';
      const bottom = solid || cell === '▄';
      upper.push(top);
      lower.push(bottom);
    }
    grid.push(upper, lower);
  }

  return grid;
}

test('compact halves both dimensions', () => {
  const qr = QrCode.encodeText('compact');
  const normal = qr.toTerminalString().split('\n');
  const compact = qr.toTerminalString({ compact: true }).split('\n');

  assert.equal(normal[0].length, (qr.size + 4) * 2);
  assert.equal(compact[0].length, qr.size + 4);
  assert.equal(compact.length, Math.ceil((qr.size + 4) / 2));
});

test('compact loses no module', () => {
  const qr = QrCode.encodeText('https://github.com/JAPofc/japqr', { ecc: 'high' });
  const margin = 2;
  const grid = decodeCompact(qr.toTerminalString({ compact: true, margin }));

  for (let y = 0; y < qr.size; y += 1) {
    for (let x = 0; x < qr.size; x += 1) {
      assert.equal(
        grid[y + margin][x + margin],
        qr.modules[y][x],
        `module (${x}, ${y}) changed in compact mode`,
      );
    }
  }
});

test('compact keeps the quiet zone light', () => {
  const qr = QrCode.encodeText('quiet zone');
  const margin = 2;
  const grid = decodeCompact(qr.toTerminalString({ compact: true, margin }));
  const total = qr.size + margin * 2;

  for (let y = 0; y < total; y += 1) {
    for (let x = 0; x < total; x += 1) {
      const inside =
        x >= margin && y >= margin && x < margin + qr.size && y < margin + qr.size;
      if (!inside) {
        assert.equal(grid[y][x], false, `quiet zone cell (${x}, ${y}) is dark`);
      }
    }
  }
});

test('compact pads an odd trailing row', () => {
  // Version 1 is 21 modules; with no quiet zone that is an odd height.
  const qr = QrCode.encodeText('x');
  const text = qr.toTerminalString({ compact: true, margin: 0 });
  const lines = text.split('\n');

  assert.equal(lines.length, Math.ceil(qr.size / 2));
  assert.equal(lines[lines.length - 1].length, qr.size);
});

test('compact honours the quiet zone width', () => {
  const qr = QrCode.encodeText('margin');
  const narrow = qr.toTerminalString({ compact: true, margin: 1 }).split('\n');
  const wide = qr.toTerminalString({ compact: true, margin: 4 }).split('\n');

  assert.equal(narrow[0].length, qr.size + 2);
  assert.equal(wide[0].length, qr.size + 8);
});

test('compact inverts when asked', () => {
  const qr = QrCode.encodeText('invert');
  const plain = qr.toTerminalString({ compact: true }).split('\n');
  const inverted = qr.toTerminalString({ compact: true, invert: true }).split('\n');

  assert.equal(plain.length, inverted.length);
  assert.notDeepEqual(plain, inverted);

  const a = decodeCompact(plain.join('\n'));
  const b = decodeCompact(inverted.join('\n'));
  const margin = 2;
  const total = qr.size + margin * 2;

  for (let y = 0; y < total; y += 1) {
    for (let x = 0; x < total; x += 1) {
      const inside =
        x >= margin && y >= margin && x < margin + qr.size && y < margin + qr.size;
      if (inside) {
        assert.equal(a[y][x], !b[y][x], `module cell (${x}, ${y}) was not inverted`);
      } else {
        // The quiet zone is background, so it stays clear in both modes.
        assert.equal(a[y][x], false, `quiet zone cell (${x}, ${y}) is dark`);
        assert.equal(b[y][x], false, `quiet zone cell (${x}, ${y}) is dark when inverted`);
      }
    }
  }
});

test('compact fits a dense symbol in a 120 column terminal', () => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let payload = '';
  for (let index = 0; index < 300; index += 1) {
    payload += alphabet[(index * 7 + 3) % alphabet.length];
  }

  const qr = QrCode.encodeText(payload, { ecc: 'high' });
  const compact = qr.toTerminalString({ compact: true }).split('\n');

  assert.ok(compact[0].length <= 120, `width ${compact[0].length} exceeds 120 columns`);
  assert.ok(compact.length <= 50, `height ${compact.length} exceeds 50 rows`);
});
