/**
 * japofc-qr - SVG renderer
 *
 * Produces a single, self-contained SVG document: one quiet-zone rectangle plus
 * one `<path>` built from horizontal runs of dark modules. The result is tiny
 * compared with emitting a `<rect>` per module and stays crisp at any size
 * thanks to `shape-rendering="crispEdges"`.
 *
 * The optional `shape`, `theme`, `frame` and `animate` settings trade some of
 * that compactness for presentation; the finder patterns always stay square,
 * because that is what cameras lock onto.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { attributionComment, attributionMetadata } from '../brand.js';
import type { QrLike } from '../core/qr-code.js';

/** Shape used for the data modules. Finder patterns always stay square. */
export type SvgShape = 'square' | 'dot' | 'rounded' | 'diamond';

/** Built-in looks. Explicit options override every field of a theme. */
export type SvgTheme = 'minimal' | 'neon' | 'glass' | 'ink';

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

/** Card drawn around the symbol, with a call to action and a signature. */
export interface SvgFrame {
  /** Line printed under the code. Defaults to `Scan me`. */
  readonly label?: string;
  /** Signature printed in the corner. Defaults to `@japofc`. */
  readonly brand?: string;
  /** Space between the card edge and the quiet zone, in modules. Defaults to `2`. */
  readonly padding?: number;
  /** Corner radius of the card, in modules. Defaults to `1.5`. */
  readonly cornerRadius?: number;
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
  /** Shape of the data modules. Defaults to `square`, which is also the smallest output. */
  readonly shape?: SvgShape;
  /** Built-in look. Defaults to no theme. */
  readonly theme?: SvgTheme;
  /** Draw a card around the symbol. Pass `true` for the defaults. */
  readonly frame?: SvgFrame | boolean;
  /** Sweep a highlight down the symbol. Presentation only. */
  readonly animate?: boolean;
}

/** Default quiet zone, matching the ISO/IEC 18004 recommendation. */
const DEFAULT_MARGIN = 4;

/** Default label of a frame. */
const DEFAULT_LABEL = 'Scan me';

/** Default signature of a frame. */
const DEFAULT_BRAND = '@japofc';

/** Font stack used inside frames, safe across platforms. */
const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/** Finder patterns occupy a 7x7 block in three corners. */
const FINDER_SIZE = 7;

interface ThemeValues {
  readonly dark: string;
  readonly light: string;
  readonly margin: number;
  readonly shape: SvgShape;
  readonly gradient?: SvgGradient;
}

const THEMES: Record<SvgTheme, ThemeValues> = {
  minimal: { dark: '#000000', light: '#ffffff', margin: 4, shape: 'square' },
  neon: {
    dark: '#39ff88',
    light: '#0b0f14',
    margin: 5,
    shape: 'dot',
    gradient: { from: '#39ff88', to: '#00d4ff', angle: 45 },
  },
  glass: { dark: '#0f172a', light: '#f8fafc', margin: 6, shape: 'rounded' },
  ink: { dark: '#1a1a1a', light: '#fdf6e3', margin: 4, shape: 'rounded' },
};

/** Renders the QR Code as an SVG string. */
export function renderSvg(qr: QrLike, options: SvgOptions = {}): string {
  const theme = options.theme ? THEMES[options.theme] : undefined;

  const margin = Math.max(0, Math.floor(options.margin ?? theme?.margin ?? DEFAULT_MARGIN));
  const dark = options.dark ?? theme?.dark ?? '#000000';
  const light = options.light ?? theme?.light ?? '#ffffff';
  const scale = options.scale;
  const shape = options.shape ?? theme?.shape ?? 'square';
  // An explicit `dark` colour wins over the theme's gradient: the gradient
  // would otherwise silently override the colour the caller asked for.
  const gradient = buildGradient(
    options.gradient ?? (options.dark === undefined ? theme?.gradient : undefined),
    options.id,
  );

  const dimension = qr.size + margin * 2;
  const offset = -margin;
  const prefix = options.id ? `${options.id}` : 'qr';

  const frame = resolveFrame(options.frame);
  const framePadding = frame ? Math.max(0, frame.padding) : 0;
  const cardWidth = dimension + framePadding * 2;
  const cardHeight = dimension + framePadding * 2 + (frame && frame.hasCaption ? 6 : 0);

  const sizeAttributes =
    scale !== undefined && Number.isFinite(scale) && scale > 0
      ? ` width="${cardWidth * scale}" height="${cardHeight * scale}"`
      : '';

  const id = options.id ? ` id="${escapeAttribute(options.id)}"` : '';
  const className = options.className ? ` class="${escapeAttribute(options.className)}"` : '';
  const title = options.title ?? 'QR code';
  const ariaLabel = options.ariaLabel ?? title;

  const declaration = options.includeXmlDeclaration === false ? '' : '<?xml version="1.0" encoding="UTF-8"?>\n';
  const attribution = options.attribution === false ? '' : `${attributionComment()}\n`;
  const metadata =
    options.attribution === false ? '' : `  <metadata>${escapeText(attributionMetadata())}</metadata>\n`;

  const modules = buildModules(qr, shape, gradient.fill ?? dark, prefix);
  const logo = buildLogo(options.logo, qr.size, light);
  const scan = options.animate ? buildScan(prefix, offset, dimension, qr.size) : { defs: '', body: '' };

  const defs = gradient.defs || modules.defs || scan.defs
    ? `  <defs>${gradient.defs}${modules.defs}${scan.defs}</defs>\n`
    : '';

  const inner =
    `  <rect x="${offset}" y="${offset}" width="${dimension}" height="${dimension}" fill="${light}"/>\n` +
    `  ${modules.body}\n` +
    (logo ? `${logo}\n` : '') +
    (scan.body ? `${scan.body}\n` : '');

  if (!frame) {
    return (
      `${declaration}${attribution}<svg xmlns="http://www.w3.org/2000/svg" viewBox="${offset} ${offset} ${dimension} ${dimension}"${sizeAttributes} ` +
      `shape-rendering="crispEdges" role="img" aria-label="${escapeAttribute(ariaLabel)}"${id}${className}>\n` +
      `  <title>${escapeText(title)}</title>\n` +
      metadata +
      defs +
      inner +
      `</svg>\n`
    );
  }

  const radius = frame.cornerRadius;
  const caption = frame.hasCaption
    ? `  <text x="${cardWidth / 2}" y="${dimension + framePadding * 2 + 3.6}" text-anchor="middle" ` +
      `font-family="${FONT_STACK}" font-size="2.6" font-weight="600" fill="${escapeAttribute(dark)}">` +
      `${escapeText(frame.label)}</text>\n` +
      `  <text x="${cardWidth - framePadding - 0.6}" y="${cardHeight - 0.9}" text-anchor="end" ` +
      `font-family="${FONT_STACK}" font-size="1.3" fill="${escapeAttribute(dark)}" opacity="0.55">` +
      `${escapeText(frame.brand)}</text>\n`
    : '';

  return (
    `${declaration}${attribution}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cardWidth} ${cardHeight}"${sizeAttributes} ` +
    `role="img" aria-label="${escapeAttribute(ariaLabel)}"${id}${className}>\n` +
    `  <title>${escapeText(title)}</title>\n` +
    metadata +
    defs +
    `  <rect x="0" y="0" width="${cardWidth}" height="${cardHeight}" rx="${radius}" fill="${escapeAttribute(light)}"/>\n` +
    `  <g transform="translate(${framePadding} ${framePadding})">\n` +
    indent(inner) +
    `  </g>\n` +
    caption +
    `</svg>\n`
  );
}

interface ResolvedFrame {
  readonly label: string;
  readonly brand: string;
  readonly padding: number;
  readonly cornerRadius: number;
  readonly hasCaption: boolean;
}

function resolveFrame(option: SvgOptions['frame']): ResolvedFrame | undefined {
  if (!option) {
    return undefined;
  }

  const frame = option === true ? {} : option;
  const label = frame.label ?? DEFAULT_LABEL;
  const brand = frame.brand ?? DEFAULT_BRAND;
  const hasCaption = label.length > 0 || brand.length > 0;

  return {
    label,
    brand,
    padding: frame.padding ?? 2,
    cornerRadius: frame.cornerRadius ?? 1.5,
    hasCaption,
  };
}

/** Indents a block so nested groups stay readable when someone opens the file. */
function indent(block: string): string {
  return block
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => `  ${line}`)
    .join('\n');
}

interface ModuleArt {
  readonly defs: string;
  readonly body: string;
}

/**
 * Draws the data modules. `square` keeps the compact run-based path; the other
 * shapes reuse one primitive through `<use>` and leave the finder patterns
 * square so cameras still have solid blocks to lock onto.
 */
function buildModules(qr: QrLike, shape: SvgShape, fill: string, prefix: string): ModuleArt {
  if (shape === 'square') {
    return { defs: '', body: `<path fill="${fill}" d="${buildPathData(qr)}"/>` };
  }

  const primitive =
    shape === 'dot'
      ? `<circle id="${prefix}-dot" cx="0.5" cy="0.5" r="0.42"/>`
      : shape === 'rounded'
        ? `<rect id="${prefix}-rounded" width="1" height="1" rx="0.3"/>`
        : `<path id="${prefix}-diamond" d="M0.5 0 1 0.5 0.5 1 0 0.5Z"/>`;

  const uses: string[] = [];
  for (let y = 0; y < qr.size; y += 1) {
    const row = qr.modules[y];
    for (let x = 0; x < qr.size; x += 1) {
      if (row[x] && !inFinder(x, y, qr.size)) {
        uses.push(`<use href="#${prefix}-${shape}" x="${x}" y="${y}"/>`);
      }
    }
  }

  return {
    defs: primitive,
    body:
      `<path fill="${fill}" d="${buildPathData(qr, (x, y) => inFinder(x, y, qr.size))}"/>` +
      `<g fill="${fill}">${uses.join('')}</g>`,
  };
}

function inFinder(x: number, y: number, size: number): boolean {
  return (
    (x < FINDER_SIZE && y < FINDER_SIZE) ||
    (x >= size - FINDER_SIZE && y < FINDER_SIZE) ||
    (x < FINDER_SIZE && y >= size - FINDER_SIZE)
  );
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
    `rx="${radius}" fill="${escapeAttribute(light)}"/>` +
    `  <image href="${escapeAttribute(logo.data)}" x="${round(origin)}" y="${round(origin)}" ` +
    `width="${round(width)}" height="${round(width)}" preserveAspectRatio="xMidYMid meet" opacity="${opacity}"/>`
  );
}

interface ScanArt {
  readonly defs: string;
  readonly body: string;
}

/** Builds the sweeping highlight. Clipped to the symbol so the quiet zone stays clean. */
function buildScan(prefix: string, offset: number, dimension: number, size: number): ScanArt {
  const id = `${prefix}-scan`;
  const defs =
    `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#ffffff" stop-opacity="0"/>` +
    `<stop offset="0.5" stop-color="#ffffff" stop-opacity="0.85"/>` +
    `<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<clipPath id="${id}-clip"><rect x="0" y="0" width="${size}" height="${size}"/></clipPath>`;

  const body =
    `  <g clip-path="url(#${id}-clip)"><rect x="0" y="${offset}" width="${size}" height="${round(size * 0.12)}" fill="url(#${id})">` +
    `<animate attributeName="y" values="${offset};${offset + dimension};${offset}" keyTimes="0;0.55;1" ` +
    `dur="2.8s" repeatCount="indefinite"/></rect></g>`;

  return { defs, body };
}

/**
 * Builds compact path data by merging horizontally adjacent dark modules into
 * single rectangles. The optional predicate restricts the runs to a region.
 */
function buildPathData(qr: QrLike, include: (x: number, y: number) => boolean = () => true): string {
  const parts: string[] = [];

  for (let y = 0; y < qr.size; y += 1) {
    const row = qr.modules[y];
    let x = 0;
    while (x < qr.size) {
      if (!row[x] || !include(x, y)) {
        x += 1;
        continue;
      }
      let end = x + 1;
      while (end < qr.size && row[end] && include(end, y)) {
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

/** Formats a coordinate without trailing zeros or floating point noise. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
