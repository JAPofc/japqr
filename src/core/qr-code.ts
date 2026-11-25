/**
 * japofc-qr - the QR Code encoder
 *
 * Public entry points live here: `QrCode.encodeText`, `QrCode.encodeBinary`
 * and `QrCode.encodeSegments`. They choose the version, pad the payload,
 * interleave the Reed-Solomon blocks, place the codewords, and pick the mask
 * pattern with the lowest penalty score.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { BRAND } from '../brand.js';
import { BitBuffer } from './bit-buffer.js';
import { DataTooLongError, InvalidArgumentError } from './errors.js';
import { QrMatrix } from './matrix.js';
import { rsComputeDivisor, rsComputeRemainder } from './reed-solomon.js';
import { QrSegment } from './segments.js';
import {
  assertMask,
  ECC_CODEWORDS_PER_BLOCK,
  ECC_LEVELS,
  eccIndex,
  getNumDataCodewords,
  getNumRawDataModules,
  getSize,
  MAX_VERSION,
  MIN_VERSION,
  NUM_ERROR_CORRECTION_BLOCKS,
  type EccLevel,
  type EncodeOptions,
  type MaskPattern,
} from './types.js';
import { renderSvg, type SvgOptions } from '../render/svg.js';
import { renderTerminal, type TerminalOptions } from '../render/terminal.js';
import { drawToCanvas, type CanvasOptions } from '../render/canvas.js';
import { toBase64 } from '../render/base64.js';

/** Shape accepted by every renderer. */
export interface QrLike {
  readonly size: number;
  readonly modules: readonly (readonly boolean[])[];
}

/** Constructor arguments for {@link QrCode}. */
export interface QrCodeInit {
  readonly version: number;
  readonly ecc: EccLevel;
  readonly mask: MaskPattern;
  readonly modules: readonly (readonly boolean[])[];
}

/** Options for {@link QrCode.toDataUrl}. */
export interface DataUrlOptions extends SvgOptions {
  /** `base64` (default) or RFC 2397 `uri` encoding. */
  readonly encoding?: 'base64' | 'uri';
}

/** An immutable, fully rendered QR Code. */
export class QrCode implements QrLike {
  /** Package name, exposed for consumers that embed attribution themselves. */
  public static readonly BRAND = BRAND;

  /** Version number, 1 to 40. */
  public readonly version: number;

  /** Error-correction level actually used. */
  public readonly ecc: EccLevel;

  /** Mask pattern actually used. */
  public readonly mask: MaskPattern;

  /** Module count per side. */
  public readonly size: number;

  /** Module colours, indexed as `[y][x]`. */
  public readonly modules: readonly (readonly boolean[])[];

  public constructor(init: QrCodeInit) {
    if (!Array.isArray(init.modules) || init.modules.length === 0) {
      throw new InvalidArgumentError('QrCode requires a non-empty module matrix.');
    }
    const size = init.modules.length;
    for (const row of init.modules) {
      if (row.length !== size) {
        throw new InvalidArgumentError(`QrCode modules must be a square matrix, found a row of length ${row.length}.`);
      }
    }

    this.version = init.version;
    this.ecc = init.ecc;
    this.mask = init.mask;
    this.size = size;
    this.modules = init.modules.map((row) => row.slice());
  }

  // ---------------------------------------------------------------------------
  // Encoding
  // ---------------------------------------------------------------------------

  /**
   * Encodes a Unicode string. The text is split into numeric, alphanumeric and
   * byte segments automatically.
   *
   * @example
   * const qr = QrCode.encodeText('https://example.com');
   */
  public static encodeText(text: string, options: EncodeOptions = {}): QrCode {
    if (typeof text !== 'string') {
      throw new InvalidArgumentError('encodeText() expects a string.');
    }
    return QrCode.encodeSegments(QrSegment.fromText(text), options);
  }

  /** Encodes raw bytes as a single byte-mode segment. */
  public static encodeBinary(data: ArrayLike<number>, options: EncodeOptions = {}): QrCode {
    return QrCode.encodeSegments([QrSegment.bytes(data)], options);
  }

  /** Encodes an already prepared list of segments. */
  public static encodeSegments(segments: readonly QrSegment[], options: EncodeOptions = {}): QrCode {
    const ecc = QrCode.normalizeEcc(options.ecc);
    const minVersion = QrCode.normalizeVersion(options.minVersion, MIN_VERSION, 'minVersion');
    const maxVersion = QrCode.normalizeVersion(options.maxVersion, MAX_VERSION, 'maxVersion');
    if (minVersion > maxVersion) {
      throw new InvalidArgumentError(`minVersion (${minVersion}) must not exceed maxVersion (${maxVersion}).`);
    }
    if (!Array.isArray(segments) || segments.length === 0) {
      throw new InvalidArgumentError('At least one segment is required to build a QR Code.');
    }

    const requestedMask = options.mask === undefined ? 'auto' : options.mask;
    const forcedMask = requestedMask === 'auto' ? undefined : assertMask(requestedMask);

    const allSegments: QrSegment[] = [];
    if (options.eci !== undefined) {
      allSegments.push(QrSegment.eci(options.eci));
    }
    allSegments.push(...segments);

    // Pick the smallest version that fits the payload.
    let version = minVersion;
    let usedBits = 0;
    for (;;) {
      usedBits = QrCode.totalBits(allSegments, version);
      if (usedBits <= getNumDataCodewords(version, ecc) * 8) {
        break;
      }
      if (version >= maxVersion) {
        throw new DataTooLongError(
          `Payload needs ${usedBits} bits but version ${version}-${ecc.toUpperCase()} only holds ` +
            `${getNumDataCodewords(version, ecc) * 8} bits.`,
        );
      }
      version += 1;
    }

    // Upgrade the error-correction level while the payload still fits.
    let finalEcc = ecc;
    if (options.boostEcc !== false) {
      for (const candidate of ECC_LEVELS) {
        if (eccIndex(candidate) > eccIndex(finalEcc) && usedBits <= getNumDataCodewords(version, candidate) * 8) {
          finalEcc = candidate;
        }
      }
    }

    const data = QrCode.buildCodewordStream(allSegments, version, finalEcc);
    const codewords = QrCode.addEccAndInterleave(data, version, finalEcc);

    const matrix = new QrMatrix(version);
    matrix.drawCodewords(codewords);

    let mask: MaskPattern = forcedMask ?? 0;
    if (forcedMask === undefined) {
      let bestScore = Number.POSITIVE_INFINITY;
      for (let candidate = 0; candidate <= 7; candidate += 1) {
        const candidateMask = candidate as MaskPattern;
        matrix.applyMask(candidateMask);
        matrix.drawFormatBits(finalEcc, candidateMask);
        const score = matrix.penaltyScore();
        matrix.applyMask(candidateMask); // Undo: masking is an involution.
        if (score < bestScore) {
          bestScore = score;
          mask = candidateMask;
        }
      }
    }

    matrix.applyMask(mask);
    matrix.drawFormatBits(finalEcc, mask);

    return new QrCode({ version, ecc: finalEcc, mask, modules: matrix.toModules() });
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  /** Colour of a module; `false` outside the grid. */
  public getModule(x: number, y: number): boolean {
    return x >= 0 && x < this.size && y >= 0 && y < this.size && this.modules[y][x];
  }

  /** Returns a mutable copy of the module grid. */
  public toMatrix(): boolean[][] {
    return this.modules.map((row) => row.slice());
  }

  /** Returns the grid as strings of `'1'`/`'0'`, handy for snapshots. */
  public toBinaryStrings(): string[] {
    return this.modules.map((row) => row.map((dark) => (dark ? '1' : '0')).join(''));
  }

  /**
   * Packed monochrome bitmap: one bit per module, MSB first, with each row
   * padded to a byte boundary. A set bit marks a dark module.
   *
   * Useful for e-ink displays, thermal and label printers, and any device that
   * wants a compact frame buffer instead of a nested array.
   */
  public toUint8Array(): Uint8Array {
    const rowBytes = Math.ceil(this.size / 8);
    const bytes = new Uint8Array(rowBytes * this.size);
    for (let y = 0; y < this.size; y += 1) {
      const row = this.modules[y];
      for (let x = 0; x < this.size; x += 1) {
        if (row[x]) {
          bytes[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
        }
      }
    }
    return bytes;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  /** Renders the code as a standalone SVG document. */
  public toSvgString(options: SvgOptions = {}): string {
    return renderSvg(this, options);
  }

  /** Renders the code with Unicode block characters for terminal output. */
  public toTerminalString(options: TerminalOptions = {}): string {
    return renderTerminal(this, options);
  }

  /** Paints the code onto an existing `<canvas>` element (browser only). */
  public draw(canvas: HTMLCanvasElement, options: CanvasOptions = {}): void {
    drawToCanvas(this, canvas, options);
  }

  /** Returns an `data:image/svg+xml` URL, usable as an `<img src>`. */
  public toDataUrl(options: DataUrlOptions = {}): string {
    const svg = renderSvg(this, options);
    if (options.encoding === 'uri') {
      return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
    return `data:image/svg+xml;base64,${toBase64(svg)}`;
  }

  // ---------------------------------------------------------------------------
  // Introspection
  // ---------------------------------------------------------------------------

  /** Compact human-readable summary. */
  public toString(): string {
    return `QrCode { version: ${this.version}, size: ${this.size}, ecc: "${this.ecc}", mask: ${this.mask} }`;
  }

  /** JSON-friendly representation for logging and snapshot testing. */
  public toJSON(): {
    generator: string;
    version: number;
    size: number;
    ecc: EccLevel;
    mask: MaskPattern;
    modules: string[];
  } {
    return {
      generator: BRAND,
      version: this.version,
      size: this.size,
      ecc: this.ecc,
      mask: this.mask,
      modules: this.toBinaryStrings(),
    };
  }

  /**
   * Rebuilds a symbol from the output of {@link QrCode.toJSON}.
   *
   * Useful for caching a rendered symbol or moving it across a process
   * boundary without re-encoding the payload. The input is validated: a
   * malformed document throws {@link InvalidArgumentError} instead of
   * producing a matrix that cannot be scanned.
   */
  public static fromJSON(value: unknown): QrCode {
    if (typeof value !== 'object' || value === null) {
      throw new InvalidArgumentError('fromJSON() expects the object returned by toJSON().');
    }

    const { version, ecc, mask, modules } = value as Record<string, unknown>;

    if (typeof version !== 'number' || !Number.isInteger(version) || version < MIN_VERSION || version > MAX_VERSION) {
      throw new InvalidArgumentError(`fromJSON(): version must be an integer between ${MIN_VERSION} and ${MAX_VERSION}.`);
    }
    if (typeof ecc !== 'string' || !ECC_LEVELS.includes(ecc as EccLevel)) {
      throw new InvalidArgumentError('fromJSON(): unknown error-correction level.');
    }
    if (typeof mask !== 'number' || !Number.isInteger(mask) || mask < 0 || mask > 7) {
      throw new InvalidArgumentError('fromJSON(): mask must be an integer between 0 and 7.');
    }

    const size = version * 4 + 17;
    if (!Array.isArray(modules) || modules.length !== size) {
      throw new InvalidArgumentError(
        `fromJSON(): expected ${size} rows, received ${Array.isArray(modules) ? modules.length : 'none'}.`,
      );
    }

    const parsed = modules.map((row, index) => {
      if (typeof row !== 'string' || row.length !== size || /[^01]/.test(row)) {
        throw new InvalidArgumentError(`fromJSON(): row ${index} must be a ${size}-character string of 0 and 1.`);
      }
      return [...row].map((cell) => cell === '1');
    });

    return new QrCode({ version, ecc: ecc as EccLevel, mask: mask as MaskPattern, modules: parsed });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private static normalizeEcc(level: EccLevel | undefined): EccLevel {
    if (level === undefined) {
      return 'medium';
    }
    eccIndex(level); // Throws for unknown levels.
    return level;
  }

  private static normalizeVersion(value: number | undefined, fallback: number, name: string): number {
    if (value === undefined) {
      return fallback;
    }
    if (!Number.isInteger(value) || value < MIN_VERSION || value > MAX_VERSION) {
      throw new InvalidArgumentError(`${name} must be an integer in [1, 40], received ${value}.`);
    }
    return value;
  }

  /** Sums the bit footprint of every segment at the given version. */
  private static totalBits(segments: readonly QrSegment[], version: number): number {
    let total = 0;
    for (const segment of segments) {
      total += segment.totalBits(version);
    }
    return total;
  }

  /** Concatenates the segments, terminator and pad bytes into data codewords. */
  private static buildCodewordStream(segments: readonly QrSegment[], version: number, ecc: EccLevel): Uint8Array {
    const capacityBits = getNumDataCodewords(version, ecc) * 8;
    const buffer = new BitBuffer();

    for (const segment of segments) {
      buffer.appendBits(segment.mode, 4);
      const countBits = segment.charCountBits(version);
      if (countBits > 0) {
        buffer.appendBits(segment.numChars, countBits);
      }
      for (const bit of segment.data) {
        buffer.appendBit(bit);
      }
    }

    // Terminator: up to four zero bits.
    buffer.appendBits(0, Math.min(4, capacityBits - buffer.length));

    // Pad the final partial byte with zeros.
    buffer.appendBits(0, (8 - (buffer.length % 8)) % 8);

    // Fill the remaining capacity with the standard pad bytes.
    let padByte = 0xec;
    while (buffer.length < capacityBits) {
      buffer.appendByte(padByte);
      padByte ^= 0xec ^ 0x11;
    }

    return buffer.toBytes();
  }

  /** Splits the data into blocks, computes ECC and interleaves everything. */
  private static addEccAndInterleave(data: Uint8Array, version: number, ecc: EccLevel): Uint8Array {
    const index = eccIndex(ecc);
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[index][version];
    const eccPerBlock = ECC_CODEWORDS_PER_BLOCK[index][version];
    const rawCodewords = Math.floor(getNumRawDataModules(version) / 8);
    const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);
    const divisor = rsComputeDivisor(eccPerBlock);

    const blocks: number[][] = [];
    let offset = 0;
    for (let block = 0; block < numBlocks; block += 1) {
      const dataLength = shortBlockLen - eccPerBlock + (block < numShortBlocks ? 0 : 1);
      const blockData = Array.from(data.slice(offset, offset + dataLength));
      offset += dataLength;

      const eccBytes = Array.from(rsComputeRemainder(blockData, divisor));
      if (block < numShortBlocks) {
        // Placeholder so every block has the same length during interleaving.
        blockData.push(0);
      }
      blocks.push(blockData.concat(eccBytes));
    }

    const result: number[] = [];
    const blockLength = blocks[0].length;
    for (let position = 0; position < blockLength; position += 1) {
      for (let block = 0; block < blocks.length; block += 1) {
        const isPlaceholder = position === shortBlockLen - eccPerBlock && block < numShortBlocks;
        if (!isPlaceholder) {
          result.push(blocks[block][position]);
        }
      }
    }

    if (result.length !== rawCodewords) {
      throw new InvalidArgumentError(
        `Interleaving produced ${result.length} codewords, expected ${rawCodewords}.`,
      );
    }
    return Uint8Array.from(result);
  }
}

/** Size in modules for a given version. Exposed for advanced planning. */
export function getQrSize(version: number): number {
  return getSize(version);
}

/** Number of data codewords available for a version/ECC pair. */
export function getDataCapacity(version: number, ecc: EccLevel): number {
  return getNumDataCodewords(version, ecc);
}
