/**
 * japofc-qr - styling tests
 *
 * Shapes, themes, frames and the scan animation all trade output size for
 * presentation. The invariant that matters is that the finder patterns keep
 * their solid 7x7 blocks, because that is what a camera locks onto.
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

const QR = QrCode.encodeText('https://github.com/JAPofc/japqr', { ecc: 'high' });

test('square keeps the single-run path and stays compact', () => {
  const svg = QR.toSvgString({ shape: 'square' });

  assert.match(svg, /<path fill="#000000" d="M0 0h7v1h-7z/);
  assert.doesNotMatch(svg, /<use /);
});

test('dot replaces data modules with a reused circle', () => {
  const svg = QR.toSvgString({ shape: 'dot' });

  assert.match(svg, /<circle id="qr-dot" cx="0\.5" cy="0\.5" r="0\.42"\/>/);
  assert.match(svg, /<use href="#qr-dot" x="\d+" y="\d+"\/>/);
});

test('rounded and diamond draw their own primitives', () => {
  assert.match(QR.toSvgString({ shape: 'rounded' }), /<rect id="qr-rounded" width="1" height="1" rx="0\.3"\/>/);
  assert.match(QR.toSvgString({ shape: 'diamond' }), /<path id="qr-diamond" d="M0\.5 0 1 0\.5 0\.5 1 0 0\.5Z"\/>/);
});

test('finder patterns stay square in every shape', () => {
  for (const shape of ['dot', 'rounded', 'diamond']) {
    const svg = QR.toSvgString({ shape });
    const uses = [...svg.matchAll(/<use href="#qr-[a-z]+" x="(\d+)" y="(\d+)"\/>/g)];

    // A 7x7 finder block sits in each corner; no data module may be drawn there.
    for (const [, x, y] of uses) {
      const inFinder =
        (Number(x) < 7 && Number(y) < 7) ||
        (Number(x) >= QR.size - 7 && Number(y) < 7) ||
        (Number(x) < 7 && Number(y) >= QR.size - 7);
      assert.equal(inFinder, false, `${shape} drew a module at (${x}, ${y}) inside a finder`);
    }

    // The three finder blocks are still drawn as solid squares.
    const finderPath = svg.match(/<path fill="#000000" d="(M0 0h7v1h-7z[^"]*)"/);
    assert.ok(finderPath, `${shape} lost the finder path`);
  }
});

test('shape uses fewer elements than there are dark modules', () => {
  const darkModules = QR.modules.flat().filter(Boolean).length;
  const uses = [...QR.toSvgString({ shape: 'dot' }).matchAll(/<use /g)].length;

  assert.ok(uses < darkModules, `${uses} uses for ${darkModules} dark modules`);
  assert.ok(uses > 0);
});

test('neon theme applies its palette, shape and gradient', () => {
  const svg = QR.toSvgString({ theme: 'neon' });

  assert.match(svg, /<linearGradient id="qr-gradient"/);
  assert.match(svg, /<stop offset="0" stop-color="#39ff88"\/>/);
  assert.match(svg, /<stop offset="1" stop-color="#00d4ff"\/>/);
  assert.match(svg, /<circle id="qr-dot"/);
  assert.match(svg, /fill="#0b0f14"/);
});

test('every theme produces a well-formed document', () => {
  for (const theme of ['minimal', 'neon', 'glass', 'ink']) {
    const svg = QR.toSvgString({ theme });

    assert.match(svg, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n/);
    assert.match(svg, /<\/svg>\n$/);
    assert.match(svg, /role="img"/);
  }
});

test('explicit options override the theme', () => {
  const svg = QR.toSvgString({ theme: 'neon', dark: '#111111', shape: 'square' });

  assert.match(svg, /<path fill="#111111"/);
  assert.doesNotMatch(svg, /<use /);
});

test('frame wraps the symbol in a card with a label', () => {
  const plain = QR.toSvgString();
  const framed = QR.toSvgString({ frame: true });

  assert.match(framed, /<text[^>]*>Scan me<\/text>/);
  assert.match(framed, /<text[^>]*>@japofc<\/text>/);
  assert.match(framed, /<rect x="0" y="0" width="\d+" height="\d+" rx="1\.5"/);

  const plainBox = plain.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  const frameBox = framed.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  assert.ok(frameBox[2] > plainBox[2], 'frame must widen the viewBox');
  assert.ok(frameBox[3] > plainBox[3], 'frame must heighten the viewBox');
});

test('frame label and brand are configurable and escapable', () => {
  const svg = QR.toSvgString({ frame: { label: 'Scan <ini>', brand: 'J&AP', padding: 3 } });

  assert.match(svg, /Scan &lt;ini&gt;</);
  assert.match(svg, /J&amp;AP/);
});

test('an empty label and brand drop the caption entirely', () => {
  const svg = QR.toSvgString({ frame: { label: '', brand: '' } });

  assert.doesNotMatch(svg, /<text/);
});

test('animate adds a clipped sweeping highlight', () => {
  const svg = QR.toSvgString({ animate: true });

  assert.match(svg, /<clipPath id="qr-scan-clip"><rect x="0" y="0" width="\d+" height="\d+"\/><\/clipPath>/);
  assert.match(svg, /<animate attributeName="y"/);
  assert.match(svg, /dur="2\.8s" repeatCount="indefinite"/);
});

test('animate is off by default', () => {
  assert.doesNotMatch(QR.toSvgString(), /<animate/);
});

test('styling options compose', () => {
  const svg = QR.toSvgString({
    theme: 'neon',
    frame: { label: 'Scan me' },
    animate: true,
    logo: { data: 'data:,', width: 0.15 },
  });

  assert.match(svg, /<linearGradient id="qr-gradient"/);
  assert.match(svg, /<text[^>]*>Scan me<\/text>/);
  assert.match(svg, /<animate attributeName="y"/);
  assert.match(svg, /<image href="data:,"/);
});
