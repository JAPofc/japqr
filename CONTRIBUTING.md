# Contributing

Terima kasih sudah ingin berkontribusi! / Thanks for wanting to contribute!

This document explains how to set up the project, run the tests, and submit a change.

## Development setup

```bash
git clone https://github.com/japofc/japqr.git
cd japqr
npm install
```

Node.js 18 or newer is recommended (the package itself supports 16+).

## Common tasks

| Command | What it does |
| --- | --- |
| `npm run typecheck` | Type-check the sources without emitting. |
| `npm run build` | Build ESM, CommonJS and declarations into `dist/`. |
| `npm test` | Build, then run the whole test suite. |
| `npm run test:only` | Run the tests against the existing build. |
| `npm run coverage` | Run the tests with coverage instrumentation. |
| `npm run preflight` | Run the 28 pre-publish checks. |
| `npm run example` | Execute `examples/node/quickstart.mjs`. |

## Project layout

```
src/core/      encoder, matrix geometry, Reed–Solomon, segments, constants
src/render/    SVG, terminal, canvas, base64
src/index.ts   public API surface
test/          node:test suites
bin/cli.mjs    command line interface
```

Everything under `src/` is plain TypeScript with no runtime dependencies. Please keep it that way — a new dependency needs a very good reason.

## Making a change

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/my-change
   ```
2. Make your changes in `src/` (never edit `dist/` — it is generated).
3. Add or update tests in `test/`. Every bug fix should come with a test that
   fails without the fix.
4. Run the full verification:
   ```bash
   npm run typecheck && npm test
   ```
5. Commit with a conventional message, e.g. `fix: correct mask penalty for column runs`.
6. Open a pull request against `main`.

## Code style

- TypeScript, `strict` mode, no `any` unless it is genuinely unavoidable.
- Every source file starts with the licence header and the `@japofc` watermark.
- Public APIs must be documented with JSDoc; every `@param` needs a description.
- Keep functions small and pure where possible; the encoder is intentionally
  easy to audit line by line against the ISO/IEC 18004 tables.
- Prefer `readonly` and immutable data structures in public APIs.

## Testing guidelines

The suite is intentionally dependency-light: it uses `node:test` and `jsqr`.
The round-trip tests are the most valuable part — if you change the encoder,
make sure `node --test test/roundtrip.test.mjs` still passes.

When adding a new feature, cover:

- the happy path,
- the error path (which `QrCodeError` subclass and `code`),
- at least one end-to-end round-trip if the matrix is affected.

## Reporting bugs

Open an issue with:

- the smallest payload that reproduces the problem,
- the version of the package,
- Node.js/browser and version,
- what you expected and what happened.

## Watermark

Every file carries the `@japofc` watermark header. Please keep it when adding new
files:

```ts
/**
 * japqr - <short description>
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/japofc/japqr
 *
 * @author @japofc
 */
```
