/**
 * japqr - base64 helper
 *
 * Encodes UTF-8 text (typically an SVG document) into base64. The string is
 * always converted to UTF-8 bytes first, so emoji and other astral characters
 * survive the round trip - `btoa` alone would treat them as Latin-1.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/japofc/japqr
 *
 * @author @japofc
 */

/** Minimal shape of Node's `Buffer`, used only as a fallback for `btoa`. */
interface BufferLike {
  from(input: string, encoding: string): { toString(encoding: string): string };
}

interface GlobalWithBuffer {
  Buffer?: BufferLike;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Encodes a UTF-8 string as base64. */
export function toBase64(input: string): string {
  const bytes = utf8Bytes(input);

  if (typeof btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  const globalObject = globalThis as GlobalWithBuffer;
  if (globalObject.Buffer) {
    return globalObject.Buffer.from(input, 'utf8').toString('base64');
  }

  return bytesToBase64(bytes);
}

/** Pure-JS base64 encoder for environments without `btoa` or `Buffer`. */
function bytesToBase64(bytes: readonly number[]): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;

    output += ALPHABET[b0 >> 2];
    output += ALPHABET[((b0 & 3) << 4) | (b1 >> 4)];
    output += i + 1 < bytes.length ? ALPHABET[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    output += i + 2 < bytes.length ? ALPHABET[b2 & 63] : '=';
  }
  return output;
}

/** Converts a JavaScript string into its UTF-8 byte sequence. */
function utf8Bytes(input: string): number[] {
  const out: number[] = [];

  for (let i = 0; i < input.length; i += 1) {
    let code = input.charCodeAt(i);

    // Combine a UTF-16 surrogate pair into a single code point.
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1);
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
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }

  return out;
}
