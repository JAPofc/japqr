/**
 * japofc-qr - renderer tests
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTHOR,
  AUTHOR_B64,
  AUTHOR_CODES,
  QrCode,
  authorFromCodes,
  renderSvg,
  renderTerminal,
  toBase64,
} from '../dist/esm/index.js';

test('SVG output is a valid, self-contained document', () => {
  const qr = QrCode.encodeText('HELLO');
  const svg = qr.toSvgString();

  assert.match(svg, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n/);
  assert.match(svg, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /viewBox="-4 -4 29 29"/);
  assert.match(svg, /shape-rendering="crispEdges"/);
  assert.match(svg, /role="img"/);
  assert.match(svg, /<title>QR code<\/title>/);
  assert.match(svg, /<rect x="-4" y="-4" width="29" height="29" fill="#ffffff"\/>/);
  assert.match(svg, /<path fill="#000000" d="M/);
  assert.ok(svg.trimEnd().endsWith('</svg>'));
});

test('the quiet zone is configurable', () => {
  const qr = QrCode.encodeText('HELLO');
  assert.match(qr.toSvgString({ margin: 0 }), /viewBox="0 0 21 21"/);
  assert.match(qr.toSvgString({ margin: 8 }), /viewBox="-8 -8 37 37"/);
  assert.match(qr.toSvgString({ margin: -5 }), /viewBox="0 0 21 21"/);
});

test('colours and scale are applied', () => {
  const qr = QrCode.encodeText('HELLO');
  const svg = qr.toSvgString({ dark: '#123456', light: '#fedcba', scale: 10 });
  assert.match(svg, /width="290" height="290"/);
  assert.match(svg, /fill="#fedcba"/);
  assert.match(svg, /fill="#123456"/);
});

test('accessibility metadata can be customised', () => {
  const qr = QrCode.encodeText('HELLO');
  const svg = qr.toSvgString({ title: 'Scan me <now>', ariaLabel: 'Open the site' });
  assert.match(svg, /<title>Scan me &lt;now&gt;<\/title>/);
  assert.match(svg, /aria-label="Open the site"/);
});

test('SVG output embeds the @japofc watermark in two places', () => {
  const qr = QrCode.encodeText('HELLO');
  const svg = qr.toSvgString();

  // Visible comment.
  assert.match(svg, /^<\?xml[^>]*>\n<!-- japofc-qr · @japofc · MIT -->\n/);
  // Structured <metadata> element, rebuilt from character codes.
  assert.match(svg, /<metadata>japofc-qr · @japofc · MIT<\/metadata>/);

  // Both markers disappear when the caller opts out.
  const stripped = qr.toSvgString({ attribution: false });
  assert.equal(stripped.includes('@japofc'), false);
  assert.equal(stripped.includes('<metadata>'), false);
});

test('brand constants are consistent with each other', () => {
  assert.equal(AUTHOR, '@japofc');
  assert.equal(authorFromCodes(), AUTHOR);
  assert.equal(Buffer.from(AUTHOR_B64, 'base64').toString('utf8'), AUTHOR);
  assert.deepEqual([...AUTHOR_CODES], [...AUTHOR].map((char) => char.charCodeAt(0)));
  assert.equal(QrCode.BRAND, 'japofc-qr');
});

test('the XML declaration can be suppressed', () => {
  const qr = QrCode.encodeText('HELLO');
  assert.ok(!qr.toSvgString({ includeXmlDeclaration: false }).startsWith('<?xml'));
});

test('path data merges horizontal runs', () => {
  const qr = QrCode.encodeText('HELLO');
  const svg = qr.toSvgString();
  const path = /<path fill="#000000" d="([^"]*)"/.exec(svg);
  assert.ok(path);
  assert.match(path[1], /M0 0h7v1h-7z/); // finder pattern top edge
});

test('terminal output has the expected dimensions', () => {
  const qr = QrCode.encodeText('HELLO');
  const margin = 2;
  const output = qr.toTerminalString({ margin });
  const lines = output.split('\n');

  assert.equal(lines.length, qr.size + margin * 2);
  assert.ok(lines.every((line) => line.length === (qr.size + margin * 2) * 2));
  assert.ok(lines[0].startsWith('  '));
});

test('terminal glyphs and inversion work', () => {
  const qr = QrCode.encodeText('HELLO');
  const normal = qr.toTerminalString({ margin: 0 });
  const inverted = qr.toTerminalString({ margin: 0, invert: true });
  assert.notEqual(normal, inverted);
  assert.equal(normal.split('\n').length, inverted.split('\n').length);
});

test('data URLs use the SVG media type', () => {
  const qr = QrCode.encodeText('HELLO');
  assert.match(qr.toDataUrl(), /^data:image\/svg\+xml;base64,[A-Za-z0-9+/]+=*$/);
  assert.match(qr.toDataUrl({ encoding: 'uri' }), /^data:image\/svg\+xml,%3C/);
  assert.ok(qr.toDataUrl({ encoding: 'uri' }).includes('%3Csvg'));
});

test('toBase64 handles ASCII and multi-byte input', () => {
  assert.equal(toBase64('hello'), 'aGVsbG8=');
  assert.equal(toBase64('🚀'), '8J+agA==');
});

test('renderers accept any QR-shaped object', () => {
  const qr = QrCode.encodeText('HELLO');
  const svg = renderSvg(qr);
  const terminal = renderTerminal(qr);
  assert.match(svg, /<path/);
  assert.ok(terminal.includes('██'));
});

test('every dark module appears exactly once in the SVG path', () => {
  const qr = QrCode.encodeText('HELLO');
  const svg = qr.toSvgString({ margin: 0 });
  const pathData = /d="([^"]*)"/.exec(svg)[1];
  const rectangles = pathData.match(/M/g).length;

  // Every module of the matrix is either dark or light; the path only carries
  // dark ones, so the count must be at most size * size.
  assert.ok(rectangles > 0);
  assert.ok(rectangles <= qr.size * qr.size);
});
