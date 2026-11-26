/**
 * japofc-qr - PNG renderer
 *
 * Encodes the matrix as a truecolour PNG without a single dependency: the
 * DEFLATE stream comes from the platform's `CompressionStream`, and the PNG
 * container itself — signature, IHDR, IDAT, IEND and the CRC32 of every chunk —
 * is written by hand.
 *
 * `CompressionStream` is global in Node.js 18+, Bun, Deno and every modern
 * browser, so the same code runs on the server and on the client. That is why
 * the result is a `Promise`: the codec is stream based.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { EncodingError, InvalidArgumentError } from '../core/errors.js';
import { crc32 } from './crc32.js';
import { inFinder, normalizeShape, type ModuleShape } from './shapes.js';
import type { QrLike } from '../core/qr-code.js';

/** Options for the PNG renderer. */
export interface PngOptions {
  /** Quiet zone width, in modules. Defaults to `4`. */
  readonly margin?: number;
  /** Dark module colour as a hex triplet. Defaults to `#000000`. */
  readonly dark?: string;
  /** Light module colour as a hex triplet. Defaults to `#ffffff`. */
  readonly light?: string;
  /** Pixels per module. Defaults to `8`. Must be at least `1`. */
  readonly scale?: number;
  /** Shape of the data modules. Defaults to `square`. Finder patterns stay square. */
  readonly shape?: ModuleShape;
}

/** Options for `QrCode.toBlob()`. */
export interface BlobOptions extends PngOptions {
  /**
   * MIME type of the blob. Defaults to `image/svg+xml`, which is smaller and
   * resolution independent; use `image/png` when the consumer cannot read SVG.
   */
  readonly type?: 'image/svg+xml' | 'image/png';
}

/** Default quiet zone, matching the SVG renderer. */
const DEFAULT_MARGIN = 4;

/** Default pixels per module. */
const DEFAULT_SCALE = 8;

/** PNG file signature. */
const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Options that only the SVG renderer can honour. Raster output rejects them
 * loudly instead of silently dropping them: a caller who passes `logo` to
 * `toPngBuffer()` should never walk away thinking the logo is in the file.
 */
const SVG_ONLY_OPTIONS = ['gradient', 'logo', 'frame', 'theme', 'animate'] as const;

/** Throws when raster output is asked for an SVG-only feature. */
export function assertRasterOptions(options: object, renderer: string): void {
  for (const key of SVG_ONLY_OPTIONS) {
    if ((options as Record<string, unknown>)[key] !== undefined) {
      throw new InvalidArgumentError(
        `${renderer} output cannot render "${key}"; render an SVG with toSvgString() instead.`,
      );
    }
  }
}

/** Renders the QR Code as an encoded PNG. */
export async function renderPng(qr: QrLike, options: PngOptions = {}): Promise<Uint8Array> {
  assertRasterOptions(options, 'PNG');
  const margin = Math.max(0, Math.floor(options.margin ?? DEFAULT_MARGIN));
  const scale = Math.max(1, Math.floor(options.scale ?? DEFAULT_SCALE));
  const dark = parseColor(options.dark ?? '#000000');
  const light = parseColor(options.light ?? '#ffffff');
  const shape = normalizeShape(options.shape);

  const size = (qr.size + margin * 2) * scale;
  const stride = size * 3 + 1;
  const raw = new Uint8Array(stride * size);

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter type 0: none
    const moduleY = Math.floor(y / scale) - margin;

    for (let x = 0; x < size; x += 1) {
      const moduleX = Math.floor(x / scale) - margin;
      const isDark =
        moduleX >= 0 &&
        moduleY >= 0 &&
        moduleX < qr.size &&
        moduleY < qr.size &&
        qr.modules[moduleY][moduleX];
      // Shapes only touch data modules; the finder patterns stay solid blocks
      // so cameras still have something to lock onto.
      const paint =
        isDark &&
        (shape === 'square' || inFinder(moduleX, moduleY, qr.size)
          ? true
          : pixelInShape(shape, x % scale, y % scale, scale));
      const [red, green, blue] = paint ? dark : light;
      const offset = rowStart + 1 + x * 3;
      raw[offset] = red;
      raw[offset + 1] = green;
      raw[offset + 2] = blue;
    }
  }

  const idat = await deflate(raw);
  const ihdr = new Uint8Array(13);
  const header = new DataView(ihdr.buffer);
  header.setUint32(0, size);
  header.setUint32(4, size);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/** Compresses a byte stream with the platform DEFLATE codec. */
async function deflate(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    throw new EncodingError('PNG output needs CompressionStream, which this runtime does not provide.');
  }

  const codec = new CompressionStream('deflate');
  const writer = codec.writable.getWriter();
  // Read first so backpressure can never deadlock the pipe.
  const compressed = new Response(codec.readable).arrayBuffer();

  await writer.write(data as Uint8Array<ArrayBuffer>);
  await writer.close();

  return new Uint8Array(await compressed);
}

/** Builds one PNG chunk: length, type, data and the CRC of type + data. */
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * Tests whether a pixel inside one module belongs to the module's shape.
 * The geometry mirrors the SVG primitives: a circle of radius `0.42` for
 * `dot`, corner radius `0.3` for `rounded`, and a diamond whose vertices touch
 * the edge midpoints.
 */
function pixelInShape(shape: ModuleShape, px: number, py: number, scale: number): boolean {
  // Pixel centre in module units, so (-0.5, -0.5) .. (0.5, 0.5).
  const u = (px + 0.5) / scale - 0.5;
  const v = (py + 0.5) / scale - 0.5;
  switch (shape) {
    case 'dot':
      return u * u + v * v <= 0.42 * 0.42;
    case 'diamond':
      return Math.abs(u) + Math.abs(v) <= 0.5;
    default: {
      const radius = 0.3;
      const qx = Math.abs(u) - (0.5 - radius);
      const qy = Math.abs(v) - (0.5 - radius);
      const outside = Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2);
      return outside + Math.min(Math.max(qx, qy), 0) <= radius;
    }
  }
}

/** Parses `#rgb` or `#rrggbb` into an RGB triple. */
function parseColor(value: string): readonly [number, number, number] {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) {
    throw new InvalidArgumentError(`PNG colours must be hex (#rgb or #rrggbb), received ${JSON.stringify(value)}.`);
  }

  const hex = match[1];
  const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex;

  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}
