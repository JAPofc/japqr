/**
 * japofc-qr - terminal renderer
 *
 * Draws the QR Code with Unicode block characters so it can be printed straight
 * to a TTY.
 *
 * The default renderer uses one two-column glyph per module, which keeps the
 * matrix square in monospaced fonts. `compact` instead packs two modules into
 * one character cell with the half-block glyphs `▀`, `▄` and `█`, halving both
 * dimensions — the only way a dense symbol (version 10 and up) still fits a
 * normal 80 to 120 column terminal.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import type { QrLike } from '../core/qr-code.js';

/** Options for the terminal renderer. */
export interface TerminalOptions {
  /** Glyph used for dark modules. Defaults to `"██"`. */
  readonly dark?: string;
  /** Glyph used for light modules. Defaults to `"  "` (two spaces). */
  readonly light?: string;
  /** Quiet zone width, in modules. Defaults to `2`. */
  readonly margin?: number;
  /** Line separator. Defaults to `"\n"`. */
  readonly newline?: string;
  /** Swap dark and light glyphs (useful on light terminals). */
  readonly invert?: boolean;
  /**
   * Pack two modules into one character cell using the half-block glyphs
   * `▀`, `▄` and `█`. Halves both the width and the height, at the cost of a
   * lower effective resolution. `dark` and `light` are ignored in this mode.
   */
  readonly compact?: boolean;
}

/** Renders the QR Code as a printable string. */
export function renderTerminal(qr: QrLike, options: TerminalOptions = {}): string {
  const margin = Math.max(0, Math.floor(options.margin ?? 2));
  const newline = options.newline ?? '\n';

  if (options.compact) {
    return renderCompact(qr, margin, options.invert === true, newline);
  }

  const darkGlyph = options.invert ? (options.light ?? '  ') : (options.dark ?? '██');
  const lightGlyph = options.invert ? (options.dark ?? '██') : (options.light ?? '  ');

  const padding = lightGlyph.repeat(margin);
  const emptyLine = lightGlyph.repeat(qr.size + margin * 2);
  const lines: string[] = [];

  for (let i = 0; i < margin; i += 1) {
    lines.push(emptyLine);
  }

  for (let y = 0; y < qr.size; y += 1) {
    let line = padding;
    const row = qr.modules[y];
    for (let x = 0; x < qr.size; x += 1) {
      line += row[x] ? darkGlyph : lightGlyph;
    }
    lines.push(line + padding);
  }

  for (let i = 0; i < margin; i += 1) {
    lines.push(emptyLine);
  }

  return lines.join(newline);
}

/**
 * Packs two module rows into one character cell: the upper half of the glyph
 * carries the even row, the lower half the odd row.
 */
function renderCompact(qr: QrLike, margin: number, invert: boolean, newline: string): string {
  const total = qr.size + margin * 2;

  const isDark = (x: number, y: number): boolean => {
    if (x < margin || y < margin || x >= margin + qr.size || y >= margin + qr.size) {
      return false;
    }
    const dark = qr.modules[y - margin][x - margin];
    return invert ? !dark : dark;
  };

  const lines: string[] = [];
  for (let y = 0; y < total; y += 2) {
    let line = '';
    for (let x = 0; x < total; x += 1) {
      const upper = isDark(x, y);
      const lower = y + 1 < total ? isDark(x, y + 1) : false;
      line += upper && lower ? '█' : upper ? '▀' : lower ? '▄' : ' ';
    }
    lines.push(line);
  }

  return lines.join(newline);
}
