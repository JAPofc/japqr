/**
 * japofc-qr - error taxonomy
 *
 * Every exception thrown by this library derives from {@link QrCodeError}, so
 * callers can branch on `instanceof` or on the stable `code` property.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

/** Stable machine-readable error codes used by this package. */
export type QrErrorCode =
  | 'ERR_QR_CODE'
  | 'ERR_INVALID_ARGUMENT'
  | 'ERR_DATA_TOO_LONG'
  | 'ERR_UNSUPPORTED_CHARACTER'
  | 'ERR_ENCODING';

/** Base class for every error thrown by this library. */
export class QrCodeError extends Error {
  /** Stable, machine-readable identifier (e.g. `ERR_DATA_TOO_LONG`). */
  public readonly code: QrErrorCode;

  public constructor(message: string, code: QrErrorCode = 'ERR_QR_CODE') {
    super(message);
    this.name = new.target.name;
    this.code = code;
    // Keeps `instanceof` correct when the consumer transpiles down to ES5.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when a value is outside the accepted range or has the wrong shape. */
export class InvalidArgumentError extends QrCodeError {
  public constructor(message: string) {
    super(message, 'ERR_INVALID_ARGUMENT');
  }
}

/** Thrown when the payload cannot fit in the largest allowed version/ECC level. */
export class DataTooLongError extends QrCodeError {
  public constructor(message: string) {
    super(message, 'ERR_DATA_TOO_LONG');
  }
}

/** Thrown when a character cannot be represented in the requested segment mode. */
export class UnsupportedCharacterError extends QrCodeError {
  public constructor(message: string) {
    super(message, 'ERR_UNSUPPORTED_CHARACTER');
  }
}

/** Thrown when the encoder reaches an impossible internal state. */
export class EncodingError extends QrCodeError {
  public constructor(message: string) {
    super(message, 'ERR_ENCODING');
  }
}
