/**
 * japofc-qr - public API surface
 *
 * Everything a consumer needs is re-exported from this single module, so both
 * `import { QrCode } from 'japofc-qr'` and the CommonJS equivalent work
 * with identical shapes.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

export {
  QrCode,
  getDataCapacity,
  getQrSize,
  type DataUrlOptions,
  type QrCodeInit,
  type QrLike,
} from './core/qr-code.js';
export {
  QrSegment,
  ALPHANUMERIC_CHARSET,
  utf8Encode,
  type SegmentTextOptions,
} from './core/segments.js';
export {
  AUTHOR,
  AUTHOR_B64,
  AUTHOR_CODES,
  BRAND,
  HOMEPAGE,
  LICENSE,
  attributionComment,
  attributionMetadata,
  authorFromCodes,
} from './brand.js';
export { SegmentMode, charCountBits } from './core/modes.js';
export { BitBuffer } from './core/bit-buffer.js';
export { QrMatrix } from './core/matrix.js';
export { rsComputeDivisor, rsComputeRemainder, rsEncode } from './core/reed-solomon.js';
export { gfMultiply, gfPow } from './core/galois-field.js';
export * from './core/errors.js';
export { renderSvg, type SvgOptions, type SvgGradient, type SvgLogo } from './render/svg.js';
export { renderPng, type PngOptions, type BlobOptions } from './render/png.js';
export { renderTerminal, type TerminalOptions } from './render/terminal.js';
export { drawToCanvas, type CanvasOptions } from './render/canvas.js';
export { toBase64, bytesToBase64 } from './render/base64.js';
export {
  assertMask,
  ECC_CODEWORDS_PER_BLOCK,
  ECC_FORMAT_BITS,
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
} from './core/types.js';
