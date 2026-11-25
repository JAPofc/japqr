# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-11-25

Feature release. No breaking changes.

### Added

- **PNG output with no dependency.** `toPngBuffer()` and `toPngDataUrl()` encode
  the matrix as a truecolour PNG: DEFLATE comes from the platform's
  `CompressionStream` and the container is written by hand, so the same code
  runs in Node, Bun, Deno and the browser. This is what lets a QR code be sent
  as an image message instead of an SVG string.
- `toBlob()`, returning an `image/svg+xml` blob by default or an `image/png`
  blob when asked — ready for `FormData`, object URLs and `fetch` bodies.
- Terminal `compact` option: packs two modules into one character cell with the
  half-block glyphs `▀`, `▄` and `█`, halving both dimensions. A version 17
  symbol drops from 89 rows × 178 columns to 45 rows × 89 columns.
- CLI `--format png`, plus `-o qr.png` which infers the format from the
  extension, and `--compact`.

### Fixed

- **CommonJS consumers were getting ESM types.** The `require` condition now
  points at a declaration tree that sits next to `"type": "commonjs"`, so
  TypeScript resolves it as CJS instead of reporting the module as ESM.
  Caught by `attw`, which is now part of CI.

### Changed

- `publint --strict` and `attw --pack .` run in CI, so a malformed `exports`
  map cannot ship again.

### Tests

- 19 new tests: the PNG container is parsed back apart, IDAT is inflated with
  `node:zlib` and every pixel is compared with the module it came from; the
  compact renderer is decoded back into module rows and compared with the
  original matrix.

## [1.1.0] - 2026-11-25

Feature release. No breaking changes; everything added is additive.

### Added

- `QrCode.fromJSON()`: rebuilds a symbol from `toJSON()` output, with full
  validation, so a rendered code can be cached or moved across a process
  boundary without re-encoding.
- `QrCode.toUint8Array()`: packed 1-bit bitmap, MSB first, rows padded to a
  byte boundary — aimed at e-ink displays, label printers and embedded targets.
- SVG `gradient` option: linear gradient for dark modules, with a configurable
  angle. The gradient id is namespaced under the `id` option so several codes
  can live on one page.
- SVG `logo` option: image drawn over the centre of the symbol, clamped to 30%
  of the symbol width to stay scannable.
- Browser bundle at `dist/browser/japofc-qr.min.js` (IIFE, exposes
  `window.JapofcQr`, 8.7 kB gzipped) for `<script>` tags and CDNs.

### Changed

- **Node.js 20 is now the minimum supported version.** Node 16 and 18 are end
  of life; the CI matrix now covers 20, 22 and 24.
- CommonJS output is now produced from the ESM build with esbuild instead of a
  second `tsc` pass, so the two formats cannot drift apart.
- Upgraded to TypeScript 7 and switched the CJS build away from the removed
  `moduleResolution: node10` option.
- CI now enforces coverage thresholds (92% lines, 90% branches, 85% functions)
  and verifies that the browser bundle is inside the published tarball.
- The release workflow publishes through npm trusted publishing (OIDC) and only
  falls back to `NPM_TOKEN` when no trusted publisher is configured yet.

### Fixed

- README browser snippet used a bare specifier that browsers cannot resolve
  without a bundler; it now shows an import map and a CDN `<script>` variant.
- `npm run coverage` silently reported nothing (`--experimental-test-coverage`
  crashed on this suite); it now uses `c8` and enforces thresholds.

### Tests

- 67 tests (up from 52): `fromJSON`, `toUint8Array`, gradient and logo
  options, a seeded fuzz suite of 45 random payloads decoded with `jsqr`, and a
  byte-exact golden SVG fixture.

## [1.0.1] - 2026-11-24

Documentation release. No changes to the library API or runtime behaviour.

### Fixed

- README hero: the tagline no longer runs underneath the QR card, which had
  clipped the last word mid-way.
- README images now point at absolute URLs, so the hero renders on the npm
  package page as well as on GitHub.

## [1.0.0] - 2026-11-24

Initial public release.

### Added

- QR Code encoder covering all 40 versions of ISO/IEC 18004.
- All four error-correction levels (`low`, `medium`, `quartile`, `high`).
- All eight mask patterns, with automatic selection by penalty score.
- Automatic error-correction boosting.
- Smart text segmentation into numeric, alphanumeric and byte segments.
- Manual segment construction through `QrSegment` (numeric, alphanumeric,
  bytes, UTF-8, ECI).
- Reed–Solomon error correction over GF(2^8), with per-block interleaving.
- Renderers: SVG, terminal (Unicode block art), `<canvas>`, and SVG data URLs.
- Raw matrix access: `getModule`, `toMatrix`, `toBinaryStrings`.
- Dual ESM and CommonJS builds with TypeScript declarations and source maps.
- `japofc-qr` command line interface.
- Typed error taxonomy with stable machine-readable codes.
- Test suite including end-to-end decoding through `jsqr` for every version,
  error-correction level and mask pattern.

### Verified

- All 40 versions round-trip through an independent decoder.
- All 4 error-correction levels round-trip.
- All 8 mask patterns round-trip.
- Numeric, alphanumeric, byte, UTF-8 and emoji payloads round-trip.

[1.2.0]: https://github.com/JAPofc/japqr/releases/tag/v1.2.0
[1.1.0]: https://github.com/JAPofc/japqr/releases/tag/v1.1.0
[1.0.1]: https://github.com/JAPofc/japqr/releases/tag/v1.0.1
[1.0.0]: https://github.com/JAPofc/japqr/releases/tag/v1.0.0
