/**
 * japofc-qr - QR Code segments
 *
 * A segment is one mode switch inside the codeword stream. This module knows
 * how to turn text into the most compact sequence of numeric, alphanumeric and
 * byte segments, and how to build raw byte / ECI segments by hand.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { InvalidArgumentError, UnsupportedCharacterError } from './errors.js';
import { charCountBits, MAX_RUNS_FOR_OPTIMIZATION, SegmentMode } from './modes.js';

export { SegmentMode };

/** Characters accepted by alphanumeric mode (ISO/IEC 18004, 7.4.3). */
export const ALPHANUMERIC_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

const ALPHANUMERIC_LOOKUP = new Map<string, number>();
for (let i = 0; i < ALPHANUMERIC_CHARSET.length; i += 1) {
  ALPHANUMERIC_LOOKUP.set(ALPHANUMERIC_CHARSET[i], i);
}

/** Options for {@link QrSegment.fromText}. */
export interface SegmentTextOptions {
  /**
   * Split the text into runs and pick the cheapest mode per run.
   * Set to `false` to force the whole string into a single byte segment.
   * Defaults to `true`.
   */
  readonly optimize?: boolean;
}

/** One mode-switch unit of a QR Code payload. */
export class QrSegment {
  /** Mode indicator defined by the standard. */
  public readonly mode: SegmentMode;

  /** Number of characters (numeric/alphanumeric) or bytes (byte mode). */
  public readonly numChars: number;

  private readonly bitData: number[];

  /**
   * Creates a segment. Most callers should use the static factories instead.
   *
   * @param mode     Mode indicator.
   * @param numChars Character/byte count of the unencoded payload.
   * @param bitData  Encoded payload bits, MSB first.
   */
  public constructor(mode: SegmentMode, numChars: number, bitData: ArrayLike<number>) {
    if (!Number.isInteger(numChars) || numChars < 0) {
      throw new InvalidArgumentError(`Character count must be a non-negative integer, received ${numChars}.`);
    }
    for (let i = 0; i < bitData.length; i += 1) {
      if (bitData[i] !== 0 && bitData[i] !== 1) {
        throw new InvalidArgumentError(`Segment bits must be 0 or 1, found ${bitData[i]} at index ${i}.`);
      }
    }
    this.mode = mode;
    this.numChars = numChars;
    this.bitData = Array.from(bitData);
  }

  /** Encoded payload bits, MSB first. */
  public get data(): readonly number[] {
    return this.bitData;
  }

  // ---------------------------------------------------------------------------
  // Static factories
  // ---------------------------------------------------------------------------

  /** Builds a numeric segment from a string of decimal digits. */
  public static numeric(text: string): QrSegment {
    if (!QrSegment.isNumeric(text)) {
      throw new UnsupportedCharacterError('Numeric segments only accept decimal digits.');
    }
    const bits: number[] = [];
    for (let i = 0; i < text.length; ) {
      const remaining = Math.min(text.length - i, 3);
      const value = Number(text.slice(i, i + remaining));
      const width = remaining * 3 + 1;
      for (let b = width - 1; b >= 0; b -= 1) {
        bits.push((value >>> b) & 1);
      }
      i += remaining;
    }
    return new QrSegment(SegmentMode.Numeric, text.length, bits);
  }

  /** Builds an alphanumeric segment from the 45-character QR alphabet. */
  public static alphanumeric(text: string): QrSegment {
    if (!QrSegment.isAlphanumeric(text)) {
      throw new UnsupportedCharacterError(
        'Alphanumeric segments only accept 0-9, A-Z, space and $%*+-./:',
      );
    }
    const bits: number[] = [];
    let i = 0;
    for (; i + 2 <= text.length; i += 2) {
      const value = (ALPHANUMERIC_LOOKUP.get(text[i]) ?? 0) * 45 + (ALPHANUMERIC_LOOKUP.get(text[i + 1]) ?? 0);
      for (let b = 10; b >= 0; b -= 1) {
        bits.push((value >>> b) & 1);
      }
    }
    if (i < text.length) {
      const value = ALPHANUMERIC_LOOKUP.get(text[i]) ?? 0;
      for (let b = 5; b >= 0; b -= 1) {
        bits.push((value >>> b) & 1);
      }
    }
    return new QrSegment(SegmentMode.Alphanumeric, text.length, bits);
  }

  /** Builds a byte segment from raw bytes (MSB first). */
  public static bytes(bytes: ArrayLike<number>): QrSegment {
    const bits: number[] = [];
    for (let i = 0; i < bytes.length; i += 1) {
      const byte = bytes[i];
      if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
        throw new InvalidArgumentError(`Byte at index ${i} is out of range [0, 255]: ${byte}.`);
      }
      for (let b = 7; b >= 0; b -= 1) {
        bits.push((byte >>> b) & 1);
      }
    }
    return new QrSegment(SegmentMode.Byte, bytes.length, bits);
  }

  /**
   * Builds an Extended Channel Interpretation designator.
   *
   * @param assignmentValue ECI assignment number, in `[0, 999999]`.
   */
  public static eci(assignmentValue: number): QrSegment {
    if (!Number.isInteger(assignmentValue) || assignmentValue < 0 || assignmentValue > 999999) {
      throw new InvalidArgumentError(`ECI assignment value must be in [0, 999999], received ${assignmentValue}.`);
    }
    const bits: number[] = [];
    const push = (value: number, width: number): void => {
      for (let b = width - 1; b >= 0; b -= 1) {
        bits.push((value >>> b) & 1);
      }
    };
    if (assignmentValue < 1 << 7) {
      push(assignmentValue, 8);
    } else if (assignmentValue < 1 << 14) {
      push(0b10, 2);
      push(assignmentValue, 14);
    } else {
      push(0b110, 3);
      push(assignmentValue, 21);
    }
    return new QrSegment(SegmentMode.Eci, 0, bits);
  }

  /** Builds a single byte segment from a UTF-8 encoded string. */
  public static utf8(text: string): QrSegment {
    return QrSegment.bytes(utf8Encode(text));
  }

  /**
   * Splits Unicode text into the most compact sequence of segments.
   *
   * The text is first split into maximal runs of digits, alphanumeric
   * characters and everything else. Adjacent runs are then merged whenever the
   * mode-switch overhead outweighs the savings of a dedicated segment.
   *
   * @param text    Text to encode. Surrogate pairs are handled as UTF-8.
   * @param options Set `optimize: false` to emit a single byte segment.
   */
  public static fromText(text: string, options: SegmentTextOptions = {}): QrSegment[] {
    if (text.length === 0) {
      return [];
    }

    const runs = QrSegment.splitIntoRuns(text);

    if (options.optimize === false || runs.length > MAX_RUNS_FOR_OPTIMIZATION) {
      return [QrSegment.utf8(text)];
    }
    if (runs.length === 1) {
      return [QrSegment.runToSegment(runs[0])];
    }

    return QrSegment.mergeRuns(runs).map((run) => QrSegment.runToSegment(run));
  }

  // ---------------------------------------------------------------------------
  // Predicates
  // ---------------------------------------------------------------------------

  /** True when every character is a decimal digit. */
  public static isNumeric(text: string): boolean {
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      if (code < 0x30 || code > 0x39) {
        return false;
      }
    }
    return true;
  }

  /** True when every character belongs to the 45-character QR alphabet. */
  public static isAlphanumeric(text: string): boolean {
    for (const char of text) {
      if (!ALPHANUMERIC_LOOKUP.has(char)) {
        return false;
      }
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Bit budgeting
  // ---------------------------------------------------------------------------

  /**
   * Number of bits the segment occupies at the given version, including the
   * 4-bit mode indicator and the character-count field.
   */
  public totalBits(version: number): number {
    return 4 + charCountBits(this.mode, version) + this.bitData.length;
  }

  /** Number of bits the character-count field needs at the given version. */
  public charCountBits(version: number): number {
    return charCountBits(this.mode, version);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private static splitIntoRuns(text: string): Run[] {
    const runs: Run[] = [];
    for (const char of text) {
      const mode = QrSegment.classify(char);
      const last = runs[runs.length - 1];
      if (last !== undefined && last.mode === mode) {
        last.text += char;
      } else {
        runs.push({ mode, text: char });
      }
    }
    return runs;
  }

  private static classify(char: string): SegmentMode {
    if (char >= '0' && char <= '9' && char.length === 1) {
      return SegmentMode.Numeric;
    }
    if (ALPHANUMERIC_LOOKUP.has(char)) {
      return SegmentMode.Alphanumeric;
    }
    return SegmentMode.Byte;
  }

  private static runToSegment(run: Run): QrSegment {
    switch (run.mode) {
      case SegmentMode.Numeric:
        return QrSegment.numeric(run.text);
      case SegmentMode.Alphanumeric:
        return QrSegment.alphanumeric(run.text);
      default:
        return QrSegment.utf8(run.text);
    }
  }

  private static mergeRuns(runs: Run[]): Run[] {
    const merged = runs.map((run) => ({ ...run }));
    let changed = true;

    while (changed && merged.length > 1) {
      changed = false;
      let bestIndex = -1;
      let bestSavings = 0;

      for (let i = 0; i + 1 < merged.length; i += 1) {
        const savings = QrSegment.mergeSavings(merged[i], merged[i + 1]);
        if (savings > bestSavings) {
          bestSavings = savings;
          bestIndex = i;
        }
      }

      if (bestIndex >= 0) {
        const left = merged[bestIndex];
        const right = merged[bestIndex + 1];
        merged.splice(bestIndex, 2, {
          mode: QrSegment.mergeMode(left.mode, right.mode),
          text: left.text + right.text,
        });
        changed = true;
      }
    }

    return merged;
  }

  private static mergeSavings(left: Run, right: Run): number {
    const separate = runCost(left) + runCost(right);
    const joined = runCost({
      mode: QrSegment.mergeMode(left.mode, right.mode),
      text: left.text + right.text,
    });
    return separate - joined;
  }

  private static mergeMode(a: SegmentMode, b: SegmentMode): SegmentMode {
    if (a === b) {
      return a;
    }
    if (a !== SegmentMode.Byte && b !== SegmentMode.Byte) {
      return SegmentMode.Alphanumeric;
    }
    return SegmentMode.Byte;
  }
}

interface Run {
  mode: SegmentMode;
  text: string;
}

/** Cost of one run when encoded with the version-1 character-count widths. */
function runCost(run: Run): number {
  return 4 + charCountBits(run.mode, 1) + payloadBits(run);
}

function payloadBits(run: Run): number {
  switch (run.mode) {
    case SegmentMode.Numeric: {
      const length = run.text.length;
      return Math.floor(length / 3) * 10 + (length % 3 === 1 ? 4 : length % 3 === 2 ? 7 : 0);
    }
    case SegmentMode.Alphanumeric: {
      const length = run.text.length;
      return Math.floor(length / 2) * 11 + (length % 2) * 6;
    }
    default:
      return utf8Encode(run.text).length * 8;
  }
}

/**
 * Encodes a JavaScript string as UTF-8 bytes. Uses the platform `TextEncoder`
 * when available and falls back to a hand-rolled encoder otherwise.
 */
export function utf8Encode(text: string): Uint8Array {
  if (typeof TextEncoder === 'function') {
    return new TextEncoder().encode(text);
  }
  return utf8EncodeFallback(text);
}

function utf8EncodeFallback(text: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      }
    }
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return Uint8Array.from(out);
}
