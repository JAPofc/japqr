/**
 * japofc-qr - Reed-Solomon encoder
 *
 * QR Codes protect each data block with a Reed-Solomon code over GF(2^8).
 * Given the block payload and the number of error-correction codewords, the
 * encoder returns those ECC codewords in the order they must be appended.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { InvalidArgumentError } from './errors.js';
import { gfMultiply, gfPow } from './galois-field.js';

/**
 * Builds the Reed-Solomon generator polynomial of the requested degree.
 *
 * The result is stored highest-degree-first, excluding the leading monomial
 * (which is always 1). For example, `x^3 + 255x^2 + 8x + 93` is returned as
 * `[255, 8, 93]` - exactly the layout the synthetic division below expects.
 *
 * @param degree Number of error-correction codewords (1..255).
 */
export function rsComputeDivisor(degree: number): Uint8Array {
  if (!Number.isInteger(degree) || degree < 1 || degree > 255) {
    throw new InvalidArgumentError(`Reed-Solomon degree must be an integer in [1, 255], received ${degree}.`);
  }

  // Coefficients in ascending powers: `poly[k]` is the coefficient of x^k.
  // Start with the monomial 1 (degree 0).
  let poly: number[] = [1];

  for (let i = 0; i < degree; i += 1) {
    const root = gfPow(2, i);
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let k = 0; k < poly.length; k += 1) {
      // Multiplying by (x + root) in GF(2) distributes each coefficient.
      next[k] ^= gfMultiply(poly[k], root);
      next[k + 1] ^= poly[k];
    }
    poly = next;
  }

  // Convert to descending order and drop the leading x^degree term.
  return Uint8Array.from(poly.slice(0, degree).reverse());
}

/**
 * Returns the Reed-Solomon remainder (the ECC codewords) for `data`.
 *
 * @param data     Data codewords, most significant byte first.
 * @param divisor  Generator polynomial produced by {@link rsComputeDivisor}.
 */
export function rsComputeRemainder(data: ArrayLike<number>, divisor: Uint8Array): Uint8Array {
  const degree = divisor.length;
  const result = new Uint8Array(degree);

  for (let i = 0; i < data.length; i += 1) {
    const factor = data[i] ^ result[0];
    // Shift the register left by one position and bring in a zero.
    result.copyWithin(0, 1);
    result[degree - 1] = 0;
    if (factor !== 0) {
      for (let k = 0; k < degree; k += 1) {
        result[k] ^= gfMultiply(divisor[k], factor);
      }
    }
  }

  return result;
}

/**
 * Convenience helper: computes the ECC codewords for `data` using a freshly
 * generated divisor of `eccLength`. Callers that encode many blocks should
 * build the divisor once and call {@link rsComputeRemainder} directly.
 */
export function rsEncode(data: ArrayLike<number>, eccLength: number): Uint8Array {
  return rsComputeRemainder(data, rsComputeDivisor(eccLength));
}
