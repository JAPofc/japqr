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
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { attributionComment, attributionMetadata } from '../brand.js';
import type { QrLike } from '../core/qr-code.js';

/** Linear gradient applied to the dark modules. */
export interface SvgGradient {
  /** Colour at the start of the gradient. */
  readonly from: string;
  /** Colour at the end of the gradient. */
  readonly to: string;
  /**
   * Direction of the gradient in degrees, clockwise from the positive x axis.
   * `0` runs left to right, `90` top to bottom. Defaults to `45`.
   */
  readonly angle?: number;
}

/** Image embedded in the centre of the symbol. */
export interface SvgLogo {
  /** Image URL, usually a `data:` URL so the SVG stays self-contained. */
  readonly data: string;
  /**
   * Logo width as a fraction of the symbol width. Defaults to `0.2` and is
   * clamped to `0.3`: a logo covers the modules underneath it, so the payload
   * only survives through error correction.
   */
  readonly width?: number;
  /** Opacity of the logo, from `0` to `1`. Defaults to `1`. */
  readonly opacity?: number;
}

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
  /**
   * Linear gradient for the dark modules, instead of a flat `dark` colour.
   * Keep both stops dark enough to stay readable by scanners.
   */
  readonly gradient?: SvgGradient;
  /**
   * Image drawn over the centre of the symbol. Logos replace the modules
   * beneath them, so encode with `ecc: 'high'` and keep the logo small.
   */
  readonly logo?: SvgLogo;
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

  const gradient = buildGradient(options.gradient, options.id);
  const logo = buildLogo(options.logo, qr.size, light);

  const declaration = options.includeXmlDeclaration === false ? '' : '<?xml version="1.0" encoding="UTF-8"?>\n';
  const attribution = options.attribution === false ? '' : `${attributionComment()}\n`;
  const metadata =
    options.attribution === false ? '' : `  <metadata>${escapeText(attributionMetadata())}</metadata>\n`;

  return (
    `${declaration}${attribution}<svg xmlns="http://www.w3.org/2000/svg" viewBox="${offset} ${offset} ${dimension} ${dimension}"${sizeAttributes} ` +
    `shape-rendering="crispEdges" role="img" aria-label="${escapeAttribute(ariaLabel)}"${id}${className}>\n` +
    `  <title>${escapeText(title)}</title>\n` +
    metadata +
    (gradient.defs ? `  <defs>${gradient.defs}</defs>\n` : '') +
    `  <rect x="${offset}" y="${offset}" width="${dimension}" height="${dimension}" fill="${light}"/>\n` +
    `  <path fill="${gradient.fill ?? dark}" d="${buildPathData(qr)}"/>\n` +
    (logo ? `${logo}\n` : '') +
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

interface GradientResult {
  readonly defs: string;
  readonly fill: string | undefined;
}

/** Turns a {@link SvgGradient} option into a `<linearGradient>` definition. */
function buildGradient(gradient: SvgGradient | undefined, idPrefix: string | undefined): GradientResult {
  if (!gradient) {
    return { defs: '', fill: undefined };
  }

  const id = `${idPrefix ? `${idPrefix}-` : ''}qr-gradient`;
  const radians = ((gradient.angle ?? 45) * Math.PI) / 180;
  const dx = Math.cos(radians) / 2;
  const dy = Math.sin(radians) / 2;
  const defs =
    `<linearGradient id="${id}" x1="${round(0.5 - dx)}" y1="${round(0.5 - dy)}" ` +
    `x2="${round(0.5 + dx)}" y2="${round(0.5 + dy)}">` +
    `<stop offset="0" stop-color="${escapeAttribute(gradient.from)}"/>` +
    `<stop offset="1" stop-color="${escapeAttribute(gradient.to)}"/>` +
    `</linearGradient>`;

  return { defs, fill: `url(#${id})` };
}

/**
 * Builds the centred logo: a light plate clears the modules underneath so the
 * image sits on a clean background, then the image is drawn on top.
 */
function buildLogo(logo: SvgLogo | undefined, size: number, light: string): string | undefined {
  if (!logo) {
    return undefined;
  }

  const requested = logo.width ?? 0.2;
  const width = Math.min(0.3, Math.max(0.05, requested)) * size;
  const origin = (size - width) / 2;
  const opacity = logo.opacity === undefined ? 1 : Math.min(1, Math.max(0, logo.opacity));
  const radius = round(width * 0.14);

  return (
    `  <rect x="${round(origin)}" y="${round(origin)}" width="${round(width)}" height="${round(width)}" ` +
    `rx="${radius}" fill="${escapeAttribute(light)}"/>\n` +
    `  <image href="${escapeAttribute(logo.data)}" x="${round(origin)}" y="${round(origin)}" ` +
    `width="${round(width)}" height="${round(width)}" preserveAspectRatio="xMidYMid meet" opacity="${opacity}"/>`
  );
}

/** Formats a coordinate without trailing zeros or floating point noise. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
