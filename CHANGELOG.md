# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.1]: https://github.com/JAPofc/japqr/releases/tag/v1.0.1
[1.0.0]: https://github.com/JAPofc/japqr/releases/tag/v1.0.0
