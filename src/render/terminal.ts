/**
 * japofc-qr - terminal renderer
 *
 * Draws the QR Code with Unicode block characters so it can be printed straight
 * to a TTY. Dark and light glyphs are both two columns wide, which keeps the
 * matrix square in monospaced fonts.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/japofc/japofc-qr
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
}

/** Renders the QR Code as a printable string. */
export function renderTerminal(qr: QrLike, options: TerminalOptions = {}): string {
  const darkGlyph = options.invert ? (options.light ?? '  ') : (options.dark ?? '██');
  const lightGlyph = options.invert ? (options.dark ?? '██') : (options.light ?? '  ');
  const margin = Math.max(0, Math.floor(options.margin ?? 2));
  const newline = options.newline ?? '\n';

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
