/**
 * japqr - GF(2^8) arithmetic
 *
 * Reed-Solomon error correction in QR Codes works over the finite field
 * GF(2^8) reduced by the primitive polynomial `x^8 + x^4 + x^3 + x^2 + 1`
 * (0x11D), with 0x02 as the generator element. We build the classic
 * exponent/logarithm tables once at module load so every multiplication is a
 * couple of array lookups instead of a loop of shifts.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/japofc/japqr
 *
 * @author @japofc
 */

/** Primitive polynomial of GF(2^8) used by the QR Code standard. */
const PRIMITIVE_POLYNOMIAL = 0x11d;

/** Exponent table, doubled in length so `EXP[a + b]` needs no modulo. */
const EXP = new Uint8Array(512);

/** Discrete logarithm table, indexed by field element. */
const LOG = new Uint8Array(256);

function initializeTables(): void {
  let value = 1;
  for (let power = 0; power < 255; power += 1) {
    EXP[power] = value;
    LOG[value] = power;
    value <<= 1;
    if (value & 0x100) {
      value ^= PRIMITIVE_POLYNOMIAL;
    }
  }
  // Mirror the first cycle so additions of exponents never overflow.
  for (let power = 255; power < 512; power += 1) {
    EXP[power] = EXP[power - 255];
  }
}

initializeTables();

/**
 * Multiplies two field elements in GF(2^8).
 * Both operands must be integers in [0, 255].
 */
export function gfMultiply(a: number, b: number): number {
  if (a === 0 || b === 0) {
    return 0;
  }
  return EXP[LOG[a] + LOG[b]];
}

/**
 * Raises `base` to `exponent` in GF(2^8).
 * `base` must be in [0, 255] and `exponent` must be a non-negative integer.
 */
export function gfPow(base: number, exponent: number): number {
  if (exponent === 0) {
    return 1;
  }
  if (base === 0) {
    return 0;
  }
  return EXP[(LOG[base] * exponent) % 255];
}

/** Exposes the exponent table for advanced/debug use. */
export function gfExpTable(): Uint8Array {
  return EXP.slice();
}
