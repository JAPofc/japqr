/**
 * japofc-qr - matrix geometry
 *
 * Builds the module grid of a QR Code: function patterns (finder, separator,
 * timing, alignment, dark module, format and version information), the zigzag
 * placement of the codewords, and the eight mask patterns with their penalty
 * scoring. Everything follows ISO/IEC 18004.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/japofc/japofc-qr
 *
 * @author @japofc
 */

import { InvalidArgumentError } from './errors.js';
import { ECC_FORMAT_BITS, getSize, type EccLevel, type MaskPattern } from './types.js';

/** Penalty weights defined by ISO/IEC 18004 (Annex E). */
const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

/** `1011101` preceded by four light modules (a finder-like pattern). */
const FINDER_LIKE_A = [true, false, true, true, true, false, true, false, false, false, false] as const;

/** `00001011101` - the same pattern read in the other direction. */
const FINDER_LIKE_B = [false, false, false, false, true, false, true, true, true, false, true] as const;

/** Mutable module grid used while a code is being assembled. */
export class QrMatrix {
  /** Number of modules per side (21 for version 1, 177 for version 40). */
  public readonly size: number;

  /** Current colours, indexed as `[y][x]`. */
  public readonly modules: boolean[][];

  /** Marks modules reserved for function patterns. */
  private readonly isFunction: boolean[][];

  public constructor(public readonly version: number) {
    if (!Number.isInteger(version) || version < 1 || version > 40) {
      throw new InvalidArgumentError(`Version must be an integer in [1, 40], received ${version}.`);
    }
    this.size = getSize(version);
    this.modules = QrMatrix.createGrid<boolean>(this.size, false);
    this.isFunction = QrMatrix.createGrid<boolean>(this.size, false);
    this.drawFunctionPatterns();
  }

  /** True when the module belongs to a function pattern. */
  public isFunctionModule(x: number, y: number): boolean {
    return this.isFunction[y][x];
  }

  /** Colour of a module, or `false` when the coordinates are out of bounds. */
  public getModule(x: number, y: number): boolean {
    return x >= 0 && x < this.size && y >= 0 && y < this.size && this.modules[y][x];
  }

  /** Returns a defensive copy of the grid. */
  public toModules(): boolean[][] {
    return this.modules.map((row) => row.slice());
  }

  // ---------------------------------------------------------------------------
  // Function patterns
  // ---------------------------------------------------------------------------

  private drawFunctionPatterns(): void {
    // Timing patterns: alternate dark/light on row 6 and column 6.
    for (let i = 0; i < this.size; i += 1) {
      this.setFunctionModule(6, i, i % 2 === 0);
      this.setFunctionModule(i, 6, i % 2 === 0);
    }

    // Finder patterns in three corners (bottom-right is left free).
    this.drawFinderPattern(3, 3);
    this.drawFinderPattern(this.size - 4, 3);
    this.drawFinderPattern(3, this.size - 4);

    // Alignment patterns, skipping the three finder corners.
    const positions = this.alignmentPatternPositions();
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = 0; j < positions.length; j += 1) {
        const skip =
          (i === 0 && j === 0) ||
          (i === 0 && j === positions.length - 1) ||
          (i === positions.length - 1 && j === 0);
        if (!skip) {
          this.drawAlignmentPattern(positions[i], positions[j]);
        }
      }
    }

    // Placeholder format bits; rewritten once the mask is known.
    this.drawFormatBits('medium', 0);
    this.drawVersionBits();
  }

  /** Draws a 9x9 finder pattern including its separator, centred on (x, y). */
  private drawFinderPattern(x: number, y: number): void {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) {
          this.setFunctionModule(xx, yy, distance !== 2 && distance !== 4);
        }
      }
    }
  }

  /** Draws a 5x5 alignment pattern centred on (x, y). */
  private drawAlignmentPattern(x: number, y: number): void {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  /** Ascending list of alignment-pattern coordinates for this version. */
  private alignmentPatternPositions(): number[] {
    if (this.version === 1) {
      return [];
    }
    const count = Math.floor(this.version / 7) + 2;
    const step = Math.floor((this.version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
    const positions = [6];
    let position = this.size - 7;
    while (positions.length < count && position > 6) {
      positions.splice(1, 0, position);
      position -= step;
    }
    return positions;
  }

  /**
   * Draws both copies of the 15-bit format information for the given
   * error-correction level and mask pattern.
   */
  public drawFormatBits(ecc: EccLevel, mask: MaskPattern): void {
    const data = (ECC_FORMAT_BITS[ecc] << 3) | mask;
    let remainder = data;
    for (let i = 0; i < 10; i += 1) {
      remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
    }
    const bits = ((data << 10) | remainder) ^ 0x5412;

    // First copy, around the top-left finder pattern.
    for (let i = 0; i <= 5; i += 1) {
      this.setFunctionModule(8, i, getBit(bits, i));
    }
    this.setFunctionModule(8, 7, getBit(bits, 6));
    this.setFunctionModule(8, 8, getBit(bits, 7));
    this.setFunctionModule(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i += 1) {
      this.setFunctionModule(14 - i, 8, getBit(bits, i));
    }

    // Second copy, split between the top-right and bottom-left edges.
    for (let i = 0; i < 8; i += 1) {
      this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
    }
    for (let i = 8; i < 15; i += 1) {
      this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
    }
    this.setFunctionModule(8, this.size - 8, true); // Always dark.
  }

  /** Draws both copies of the 18-bit version information (versions 7+). */
  private drawVersionBits(): void {
    if (this.version < 7) {
      return;
    }
    let remainder = this.version;
    for (let i = 0; i < 12; i += 1) {
      remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
    }
    const bits = (this.version << 12) | remainder;

    for (let i = 0; i < 18; i += 1) {
      const colour = getBit(bits, i);
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFunctionModule(a, b, colour);
      this.setFunctionModule(b, a, colour);
    }
  }

  /** Marks a module as a function pattern and assigns its colour. */
  private setFunctionModule(x: number, y: number, isDark: boolean): void {
    this.modules[y][x] = isDark;
    this.isFunction[y][x] = true;
  }

  // ---------------------------------------------------------------------------
  // Codeword placement and masking
  // ---------------------------------------------------------------------------

  /**
   * Places the codeword bits into the data area using the standard zigzag
   * scan: two-column pairs, bottom-right to top-left, alternating direction.
   */
  public drawCodewords(data: ArrayLike<number>): void {
    const totalBits = data.length * 8;
    let bitIndex = 0;

    for (let right = this.size - 1; right >= 1; right -= 2) {
      // The vertical timing pattern occupies column 6, so the pair (6, 5)
      // collapses to a single column at x = 5.
      if (right === 6) {
        right = 5;
      }
      const upward = ((right + 1) & 2) === 0;

      for (let vertical = 0; vertical < this.size; vertical += 1) {
        for (let offset = 0; offset < 2; offset += 1) {
          const x = right - offset;
          const y = upward ? this.size - 1 - vertical : vertical;
          if (!this.isFunction[y][x] && bitIndex < totalBits) {
            this.modules[y][x] = ((data[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0;
            bitIndex += 1;
          }
        }
      }
    }

    if (bitIndex !== totalBits) {
      throw new InvalidArgumentError(
        `Codeword length mismatch: placed ${bitIndex} bits, expected ${totalBits}.`,
      );
    }
  }

  /** XORs the non-function modules with the given mask pattern. */
  public applyMask(mask: MaskPattern): void {
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        if (!this.isFunction[y][x] && shouldInvert(mask, x, y)) {
          this.modules[y][x] = !this.modules[y][x];
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Penalty scoring
  // ---------------------------------------------------------------------------

  /**
   * Penalty score of the current grid. Lower is better; the encoder picks the
   * mask that minimises it, exactly as the standard prescribes.
   */
  public penaltyScore(): number {
    let score = 0;

    // Rule 1 (runs) and rule 3 (finder-like patterns), applied to every row
    // and every column.
    for (let y = 0; y < this.size; y += 1) {
      score += scoreLine(this.modules[y]);
    }
    for (let x = 0; x < this.size; x += 1) {
      score += scoreLine(this.column(x));
    }

    // Rule 2: 2x2 blocks of a single colour.
    for (let y = 0; y < this.size - 1; y += 1) {
      for (let x = 0; x < this.size - 1; x += 1) {
        const colour = this.modules[y][x];
        if (
          colour === this.modules[y][x + 1] &&
          colour === this.modules[y + 1][x] &&
          colour === this.modules[y + 1][x + 1]
        ) {
          score += PENALTY_N2;
        }
      }
    }

    // Rule 4: deviation of the dark-module ratio from 50%.
    let dark = 0;
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        if (this.modules[y][x]) {
          dark += 1;
        }
      }
    }
    const total = this.size * this.size;
    // `size` is odd, so the ratio can never be exactly 50%; clamp anyway.
    const steps = Math.max(0, Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1);
    score += steps * PENALTY_N4;

    return score;
  }

  private column(x: number): boolean[] {
    const column = new Array<boolean>(this.size);
    for (let y = 0; y < this.size; y += 1) {
      column[y] = this.modules[y][x];
    }
    return column;
  }

  private static createGrid<T>(size: number, fill: T): T[][] {
    return Array.from({ length: size }, () => new Array<T>(size).fill(fill));
  }
}

// ---------------------------------------------------------------------------
// Mask predicates
// ---------------------------------------------------------------------------

/** Returns true when the module at (x, y) must be inverted by `mask`. */
function shouldInvert(mask: MaskPattern, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      throw new InvalidArgumentError(`Unknown mask pattern: ${mask}.`);
  }
}

// ---------------------------------------------------------------------------
// Penalty helpers
// ---------------------------------------------------------------------------

/** Rule 1 (runs of equal colour) plus rule 3 (finder-like patterns). */
function scoreLine(line: readonly boolean[]): number {
  let score = 0;

  let runColour = line[0];
  let runLength = 1;
  for (let i = 1; i <= line.length; i += 1) {
    if (i < line.length && line[i] === runColour) {
      runLength += 1;
    } else {
      if (runLength >= 5) {
        score += PENALTY_N1 + (runLength - 5);
      }
      if (i < line.length) {
        runColour = line[i];
        runLength = 1;
      }
    }
  }

  for (let start = 0; start + FINDER_LIKE_A.length <= line.length; start += 1) {
    if (matchesAt(line, start, FINDER_LIKE_A) || matchesAt(line, start, FINDER_LIKE_B)) {
      score += PENALTY_N3;
    }
  }

  return score;
}

function matchesAt(line: readonly boolean[], start: number, pattern: readonly boolean[]): boolean {
  for (let i = 0; i < pattern.length; i += 1) {
    if (line[start + i] !== pattern[i]) {
      return false;
    }
  }
  return true;
}

/** Returns the bit at `index` of `value`, counting from the least significant. */
function getBit(value: number, index: number): boolean {
  return ((value >>> index) & 1) !== 0;
}
