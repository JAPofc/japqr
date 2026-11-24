/**
 * japofc-qr - segment modes and character-count widths
 *
 * ISO/IEC 18004 defines five data modes. Each mode has a 4-bit indicator and a
 * character-count field whose width depends on the version band. This module is
 * the single source of truth for those numbers.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/japofc/japofc-qr
 *
 * @author @japofc
 */

/** Data-coding modes defined by ISO/IEC 18004 (Table 2). */
export enum SegmentMode {
  /** Decimal digits 0-9. */
  Numeric = 0b0001,
  /** 0-9, A-Z, space and `$%*+-./:`. */
  Alphanumeric = 0b0010,
  /** Raw bytes, typically UTF-8 text. */
  Byte = 0b0100,
  /** Shift-JIS double-byte characters. */
  Kanji = 0b1000,
  /** Extended Channel Interpretation designator. */
  Eci = 0b0111,
}

/**
 * Character-count field widths per version band (1-9, 10-26, 27-40).
 * Index 0 is a placeholder so modes can be used directly as indexes.
 */
const CHAR_COUNT_BITS: Readonly<Record<SegmentMode, readonly [number, number, number]>> = {
  [SegmentMode.Numeric]: [10, 12, 14],
  [SegmentMode.Alphanumeric]: [9, 11, 13],
  [SegmentMode.Byte]: [8, 16, 16],
  [SegmentMode.Kanji]: [8, 10, 12],
  [SegmentMode.Eci]: [0, 0, 0],
};

/** Width of the character-count field for a mode at a given version. */
export function charCountBits(mode: SegmentMode, version: number): number {
  const band = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  return CHAR_COUNT_BITS[mode][band];
}

/**
 * Above this many raw runs, run-merging is skipped and the text is encoded as
 * one byte segment. Protects against quadratic behaviour on pathological input.
 */
export const MAX_RUNS_FOR_OPTIMIZATION = 96;
