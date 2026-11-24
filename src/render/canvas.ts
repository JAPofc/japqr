/**
 * @japofc-qr - canvas renderer
 *
 * Paints the QR Code onto an existing `<canvas>` element. Kept in its own
 * module so the core encoder stays free of DOM types at runtime.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/japofc/japofc-qr
 *
 * @author @japofc
 */

import { InvalidArgumentError } from '../core/errors.js';
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
}

/** Paints the QR Code onto `canvas`, resizing it to fit the quiet zone. */
export function drawToCanvas(qr: QrLike, canvas: HTMLCanvasElement, options: CanvasOptions = {}): void {
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw new InvalidArgumentError('drawToCanvas() requires a <canvas> element.');
  }

  const margin = Math.max(0, Math.floor(options.margin ?? 4));
  const scale = options.scale ?? 8;
  const dark = options.dark ?? '#000000';
  const light = options.light ?? '#ffffff';
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
      if (row[x]) {
        context.fillRect((x + margin) * scale, (y + margin) * scale, Math.ceil(scale), Math.ceil(scale));
      }
    }
  }
}
