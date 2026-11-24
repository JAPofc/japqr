/**
 * japofc-qr - SVG renderer
 *
 * Produces a single, self-contained SVG document: one quiet-zone rectangle plus
 * one `<path>` built from horizontal runs of dark modules. The result is tiny
 * compared with emitting a `<rect>` per module and stays crisp at any size
 * thanks to `shape-rendering="crispEdges"`.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/japofc/japofc-qr
 *
 * @author @japofc
 */

import { attributionComment, attributionMetadata } from '../brand.js';
import type { QrLike } from '../core/qr-code.js';

/** Options for the SVG renderer. */
export interface SvgOptions {
  /** Quiet zone width, in modules. Defaults to `4` (the spec minimum). */
  readonly margin?: number;
  /** Fill colour of dark modules. Defaults to `#000000`. */
  readonly dark?: string;
  /** Fill colour of light modules. Defaults to `#ffffff`. */
  readonly light?: string;
  /**
   * Pixels per module. When omitted the SVG has no intrinsic size and scales
   * to its container, which is usually what you want on the web.
   */
  readonly scale?: number;
  /** Prepend the `<?xml ... ?>` declaration. Defaults to `true`. */
  readonly includeXmlDeclaration?: boolean;
  /** Accessible title. Defaults to `QR code`. */
  readonly title?: string;
  /** `aria-label` value. Defaults to the title. */
  readonly ariaLabel?: string;
  /** Optional `id` attribute for the root `<svg>` element. */
  readonly id?: string;
  /** Optional `class` attribute for the root `<svg>` element. */
  readonly className?: string;
  /**
   * Embed an attribution comment in the document. Defaults to `true`.
   * Set to `false` for byte-exact output requirements.
   */
  readonly attribution?: boolean;
}

/** Default quiet zone, matching the ISO/IEC 18004 recommendation. */
const DEFAULT_MARGIN = 4;

/** Renders the QR Code as an SVG string. */
export function renderSvg(qr: QrLike, options: SvgOptions = {}): string {
  const margin = Math.max(0, Math.floor(options.margin ?? DEFAULT_MARGIN));
  const dark = options.dark ?? '#000000';
  const light = options.light ?? '#ffffff';
  const scale = options.scale;
  const dimension = qr.size + margin * 2;
  const offset = -margin;

  const sizeAttributes =
    scale !== undefined && Number.isFinite(scale) && scale > 0
      ? ` width="${dimension * scale}" height="${dimension * scale}"`
      : '';

  const id = options.id ? ` id="${escapeAttribute(options.id)}"` : '';
  const className = options.className ? ` class="${escapeAttribute(options.className)}"` : '';
  const title = options.title ?? 'QR code';
  const ariaLabel = options.ariaLabel ?? title;

  const declaration = options.includeXmlDeclaration === false ? '' : '<?xml version="1.0" encoding="UTF-8"?>\n';
  const attribution = options.attribution === false ? '' : `${attributionComment()}\n`;
  const metadata =
    options.attribution === false ? '' : `  <metadata>${escapeText(attributionMetadata())}</metadata>\n`;

  return (
    `${declaration}${attribution}<svg xmlns="http://www.w3.org/2000/svg" viewBox="${offset} ${offset} ${dimension} ${dimension}"${sizeAttributes} ` +
    `shape-rendering="crispEdges" role="img" aria-label="${escapeAttribute(ariaLabel)}"${id}${className}>\n` +
    `  <title>${escapeText(title)}</title>\n` +
    metadata +
    `  <rect x="${offset}" y="${offset}" width="${dimension}" height="${dimension}" fill="${light}"/>\n` +
    `  <path fill="${dark}" d="${buildPathData(qr)}"/>\n` +
    `</svg>\n`
  );
}

/**
 * Builds compact path data by merging horizontally adjacent dark modules into
 * single rectangles.
 */
function buildPathData(qr: QrLike): string {
  const parts: string[] = [];

  for (let y = 0; y < qr.size; y += 1) {
    const row = qr.modules[y];
    let x = 0;
    while (x < qr.size) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      let end = x + 1;
      while (end < qr.size && row[end]) {
        end += 1;
      }
      const width = end - x;
      parts.push(`M${x} ${y}h${width}v1h${-width}z`);
      x = end;
    }
  }

  return parts.join('');
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
