/**
 * @japofc-qr - canvas renderer
 *
 * Paints the QR Code onto an existing `<canvas>` element. Kept in its own
 * module so the core encoder stays free of DOM types at runtime.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { InvalidArgumentError } from '../core/errors.js';
import { inFinder, normalizeShape, type ModuleShape } from './shapes.js';
import { assertRasterOptions } from './png.js';
import type { QrLike } from '../core/qr-code.js';

/** Options for the canvas renderer. */
export interface CanvasOptions {
  /** Quiet zone width, in modules. Defaults to `4`. */
  readonly margin?: number;
  /** Device pixels per module. Defaults to `8`. */
  readonly scale?: number;
  /** Fill colour of dark modules. Defaults to `#000000`. */
  readonly dark?: string;
  /** Fill colour of light modules. Defaults to `#ffffff`. */
  readonly light?: string;
  /** Shape of the data modules. Defaults to `square`. Finder patterns stay square. */
  readonly shape?: ModuleShape;
}

/** Paints the QR Code onto `canvas`, resizing it to fit the quiet zone. */
export function drawToCanvas(qr: QrLike, canvas: HTMLCanvasElement, options: CanvasOptions = {}): void {
  assertRasterOptions(options, 'Canvas');
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw new InvalidArgumentError('drawToCanvas() requires a <canvas> element.');
  }

  const margin = Math.max(0, Math.floor(options.margin ?? 4));
  const scale = options.scale ?? 8;
  const dark = options.dark ?? '#000000';
  const light = options.light ?? '#ffffff';
  const shape = normalizeShape(options.shape);
  const total = qr.size + margin * 2;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new InvalidArgumentError('The provided <canvas> element has no 2D context.');
  }

  const width = Math.round(total * scale);
  const height = Math.round(total * scale);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  context.fillStyle = light;
  context.fillRect(0, 0, width, height);
  context.fillStyle = dark;

  for (let y = 0; y < qr.size; y += 1) {
    const row = qr.modules[y];
    for (let x = 0; x < qr.size; x += 1) {
      if (!row[x]) {
        continue;
      }
      const left = (x + margin) * scale;
      const top = (y + margin) * scale;
      const size = Math.ceil(scale);
      // Shapes only touch data modules; the finder patterns stay solid blocks.
      if (shape === 'square' || inFinder(x, y, qr.size)) {
        context.fillRect(left, top, size, size);
      } else {
        drawShapedModule(context, shape, left, top, scale);
      }
    }
  }
}

/** Draws one shaped module at pixel position (left, top). */
function drawShapedModule(
  context: CanvasRenderingContext2D,
  shape: ModuleShape,
  left: number,
  top: number,
  scale: number,
): void {
  const inset = scale * (shape === 'dot' ? 0.08 : 0);
  const x = left + inset;
  const y = top + inset;
  const size = scale - inset * 2;
  context.beginPath();
  if (shape === 'dot') {
    context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    context.fill();
    return;
  }
  if (shape === 'diamond') {
    context.moveTo(x + size / 2, y);
    context.lineTo(x + size, y + size / 2);
    context.lineTo(x + size / 2, y + size);
    context.lineTo(x, y + size / 2);
    context.closePath();
    context.fill();
    return;
  }
  // Rounded: corner radius 0.3 modules, matching the SVG renderer.
  const radius = Math.min(scale * 0.3, size / 2);
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, size, size, radius);
    context.fill();
    return;
  }
  context.moveTo(x + radius, y);
  context.arcTo(x + size, y, x + size, y + size, radius);
  context.arcTo(x + size, y + size, x, y + size, radius);
  context.arcTo(x, y + size, x, y, radius);
  context.arcTo(x, y, x + size, y, radius);
  context.closePath();
  context.fill();
}
