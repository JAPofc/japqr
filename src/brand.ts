/**
 * japqr - brand and attribution metadata
 *
 * The only thing this module does is expose who built the package and stamp
 * that identity into generated documents. There is no telemetry, no network
 * access, no data collection and no hidden behaviour: the attribution is a
 * plain, human-readable comment that anyone can read and turn off.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

/** Package name. */
export const BRAND = 'japqr';

/** Author handle, used as the watermark in generated output. */
export const AUTHOR = '@japofc';

/** SPDX identifier of the license. */
export const LICENSE = 'MIT';

/** Project homepage. */
export const HOMEPAGE = 'https://github.com/JAPofc/japqr';

/**
 * Attribution comment embedded in generated SVG documents.
 * Pass `attribution: false` to the renderer to omit it.
 */
export function attributionComment(): string {
  return `<!-- ${BRAND} · ${AUTHOR} · ${LICENSE} -->`;
}
