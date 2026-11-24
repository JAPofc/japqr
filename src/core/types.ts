/**
 * japofc-qr - shared types and ISO/IEC 18004 constants
 *
 * Everything that is defined by the QR Code specification lives here: the
 * error-correction levels, the per-block codeword tables, and the capacity
 * formulas. Keeping them in one module makes the encoder easy to audit.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { InvalidArgumentError } from './errors.js';

/** Error-correction level, ordered from the least to the most redundant. */
export type EccLevel = 'low' | 'medium' | 'quartile' | 'high';

/** The eight mask patterns defined by ISO/IEC 18004. */
export type MaskPattern = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Options accepted by every `encode*` entry point. */
export interface EncodeOptions {
  /** Error-correction level. Defaults to `'medium'`. */
  readonly ecc?: EccLevel;
  /** Smallest version to consider. Defaults to `1`. */
  readonly minVersion?: number;
  /** Largest version to consider. Defaults to `40`. */
  readonly maxVersion?: number;
  /** Force a specific mask, or `'auto'` to pick the best-scoring one. */
  readonly mask?: MaskPattern | 'auto';
  /**
   * Upgrade the error-correction level whenever the payload still fits.
   * Defaults to `true`.
   */
  readonly boostEcc?: boolean;
  /** Optional ECI designator emitted before the data segments. */
  readonly eci?: number;
}

/** Canonical order of error-correction levels. */
export const ECC_LEVELS: readonly EccLevel[] = ['low', 'medium', 'quartile', 'high'];

/** Two-bit format descriptor of each error-correction level. */
export const ECC_FORMAT_BITS: Readonly<Record<EccLevel, number>> = {
  low: 1,
  medium: 0,
  quartile: 3,
  high: 2,
};

/** Smallest version defined by the standard. */
export const MIN_VERSION = 1;

/** Largest version defined by the standard. */
export const MAX_VERSION = 40;

/**
 * Error-correction codewords per block, indexed by `[ecc][version]`.
 * Index 0 is a placeholder so that versions can be used directly as indexes.
 */
export const ECC_CODEWORDS_PER_BLOCK: ReadonlyArray<ReadonlyArray<number>> = [
  // 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // low
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28], // medium
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // quartile
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // high
];

/**
 * Number of Reed-Solomon blocks, indexed by `[ecc][version]`.
 * Index 0 is a placeholder so that versions can be used directly as indexes.
 */
export const NUM_ERROR_CORRECTION_BLOCKS: ReadonlyArray<ReadonlyArray<number>> = [
  // 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25], // low
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49], // medium
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68], // quartile
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81], // high
];

/** Returns the 0..3 ordinal of an error-correction level. */
export function eccIndex(level: EccLevel): number {
  const index = ECC_LEVELS.indexOf(level);
  if (index < 0) {
    throw new InvalidArgumentError(`Unknown error-correction level: ${String(level)}.`);
  }
  return index;
}

/**
 * Number of modules available for codewords (data + ECC + remainder bits)
 * in the given version. Derived from the standard's geometry formula.
 */
export function getNumRawDataModules(version: number): number {
  if (!Number.isInteger(version) || version < MIN_VERSION || version > MAX_VERSION) {
    throw new InvalidArgumentError(`Version must be an integer in [1, 40], received ${version}.`);
  }
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) {
      result -= 36;
    }
  }
  return result;
}

/**
 * Number of data codewords (excluding ECC and remainder bits) available in the
 * given version and error-correction level.
 */
export function getNumDataCodewords(version: number, level: EccLevel): number {
  const index = eccIndex(level);
  return (
    Math.floor(getNumRawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[index][version] * NUM_ERROR_CORRECTION_BLOCKS[index][version]
  );
}

/** Returns the size (in modules) of a QR Code of the given version. */
export function getSize(version: number): number {
  return version * 4 + 17;
}

/** Normalises a mask value, throwing when it is not a valid pattern. */
export function assertMask(mask: number): MaskPattern {
  if (!Number.isInteger(mask) || mask < 0 || mask > 7) {
    throw new InvalidArgumentError(`Mask must be an integer in [0, 7], received ${mask}.`);
  }
  return mask as MaskPattern;
}
