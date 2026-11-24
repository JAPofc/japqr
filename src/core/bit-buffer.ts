/**
 * japofc-qr - variable-length bit buffer
 *
 * A tiny, allocation-friendly container used while assembling the QR Code
 * codeword stream. Bits are appended MSB-first, matching the bit order that
 * ISO/IEC 18004 expects for every segment.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { InvalidArgumentError } from './errors.js';

/** Append-only bit queue. */
export class BitBuffer {
  private readonly bits: number[] = [];

  /** Number of bits currently stored. */
  public get length(): number {
    return this.bits.length;
  }

  /** Appends a single `0` or `1`. */
  public appendBit(bit: number): this {
    if (bit !== 0 && bit !== 1) {
      throw new InvalidArgumentError(`Bit must be 0 or 1, received ${bit}.`);
    }
    this.bits.push(bit);
    return this;
  }

  /**
   * Appends the low-order `length` bits of `value`, most significant bit first.
   *
   * @throws {InvalidArgumentError} If the value does not fit in `length` bits.
   */
  public appendBits(value: number, length: number): this {
    if (!Number.isInteger(length) || length < 0 || length > 31) {
      throw new InvalidArgumentError(`Bit length must be an integer in [0, 31], received ${length}.`);
    }
    if (!Number.isInteger(value) || value < 0 || value >= 2 ** length) {
      throw new InvalidArgumentError(`Value ${value} does not fit in ${length} bit(s).`);
    }
    for (let i = length - 1; i >= 0; i -= 1) {
      this.bits.push((value >>> i) & 1);
    }
    return this;
  }

  /** Appends one byte (8 bits, MSB first). */
  public appendByte(byte: number): this {
    if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
      throw new InvalidArgumentError(`Byte must be an integer in [0, 255], received ${byte}.`);
    }
    return this.appendBits(byte, 8);
  }

  /** Appends every byte of `bytes`, MSB first. */
  public appendBytes(bytes: ArrayLike<number>): this {
    for (let i = 0; i < bytes.length; i += 1) {
      this.appendByte(bytes[i]);
    }
    return this;
  }

  /** Returns the bit at `index` (0 or 1). */
  public getBit(index: number): number {
    if (!Number.isInteger(index) || index < 0 || index >= this.bits.length) {
      throw new InvalidArgumentError(`Bit index ${index} is out of range.`);
    }
    return this.bits[index];
  }

  /**
   * Packs the stored bits into bytes, padding the trailing partial byte with
   * zero bits. This is the packing used for the final codeword stream.
   */
  public toBytes(): Uint8Array {
    const out = new Uint8Array(Math.ceil(this.bits.length / 8));
    for (let i = 0; i < this.bits.length; i += 1) {
      if (this.bits[i] !== 0) {
        out[i >>> 3] |= 1 << (7 - (i & 7));
      }
    }
    return out;
  }

  /** Removes every stored bit. */
  public clear(): void {
    this.bits.length = 0;
  }
}
