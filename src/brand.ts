/**
 * japofc-qr - brand identity and attribution markers
 *
 * The author handle is stored in several equivalent encodings and spread
 * across the generated output, so a naive find-and-replace of the literal
 * string does not strip it from a build.
 *
 * What this module is NOT:
 *   - no telemetry, no network access, no data collection
 *   - no self-check that throws or disables anything
 *   - no obfuscated behaviour, no dynamic code evaluation
 *
 * Removing the attribution does not break the library — it only violates the
 * MIT license, which requires the copyright notice to be preserved. See
 * LICENSE and NOTICE.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

/** Package name. */
export const BRAND = 'japofc-qr';

/** Author handle, plain text. */
export const AUTHOR = '@japofc';

/** Character codes of {@link AUTHOR}. Used to rebuild the handle at runtime. */
export const AUTHOR_CODES: readonly number[] = [64, 106, 97, 112, 111, 102, 99];

/** Base64 of {@link AUTHOR}; a compact seal for logs and CLI banners. */
export const AUTHOR_B64 = 'QGphcG9mYw==';

/** SPDX identifier of the license. */
export const LICENSE = 'MIT';

/** Project homepage. */
export const HOMEPAGE = 'https://github.com/JAPofc/japqr';

/** Rebuilds the author handle from its character codes. */
export function authorFromCodes(): string {
  return String.fromCharCode(...AUTHOR_CODES);
}

/**
 * Attribution comment embedded in generated SVG documents.
 * Pass `attribution: false` to the renderer to omit it.
 */
export function attributionComment(): string {
  return `<!-- ${BRAND} · ${AUTHOR} · ${LICENSE} -->`;
}

/**
 * Attribution payload for the SVG `<metadata>` element.
 *
 * Deliberately reconstructed from character codes rather than written as a
 * literal, so editing the visible handle does not remove this marker.
 */
export function attributionMetadata(): string {
  return `${BRAND} · ${authorFromCodes()} · ${LICENSE}`;
}
