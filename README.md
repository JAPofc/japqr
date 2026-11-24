<h1 align="center">japqr</h1>

<p align="center">
  <strong>Zero-dependency QR Code generator for Node.js, Bun, Deno and the browser.</strong><br />
  <sub>by <a href="https://github.com/japofc">@japofc</a></sub><br />
  Numeric, alphanumeric, byte and ECI segments. SVG, terminal and canvas output. All 40 versions, all 8 masks.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/japqr"><img alt="npm version" src="https://img.shields.io/npm/v/japqr?style=flat-square&color=cb3837" /></a>
  <a href="https://www.npmjs.com/package/japqr"><img alt="npm downloads" src="https://img.shields.io/npm/dm/japqr?style=flat-square&color=cb3837" /></a>
  <a href="https://github.com/japofc/japqr/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/japofc/japqr/ci.yml?branch=main&style=flat-square&label=CI" /></a>
  <a href="https://bundlephobia.com/package/japqr"><img alt="bundle size" src="https://img.shields.io/bundlephobia/minzip/japqr?style=flat-square&color=2ea44f" /></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-2ea44f?style=flat-square" /></a>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-100%25-3178c6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="zero dependencies" src="https://img.shields.io/badge/dependencies-0-2ea44f?style=flat-square" />
</p>

<p align="center">
  <a href="#installation">Install</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#api-reference">API</a> ·
  <a href="#output-formats">Output formats</a> ·
  <a href="#publishing">Publishing</a> ·
  <a href="#bahasa-indonesia">Bahasa Indonesia</a>
</p>

---

## Why this package

Most QR libraries either pull in a framework-sized dependency tree or stop at "here is a PNG". This one is a small, auditable TypeScript implementation of the ISO/IEC 18004 encoder with no runtime dependencies and every output format you actually need.

- **Zero dependencies** — nothing to install, nothing to audit, nothing to bundle but the library itself.
- **All 40 versions, all 4 error-correction levels, all 8 mask patterns.**
- **Smart segmentation** — text is split into numeric / alphanumeric / byte runs and merged only when the mode-switch overhead pays off.
- **Automatic ECC boosting** — uses the highest error-correction level the payload still fits into, unless you say otherwise.
- **SVG, terminal, canvas and data-URL output**, plus the raw boolean matrix.
- **Fully typed** — declarations and source maps ship with the package.
- **Dual ESM + CommonJS** builds behind a standard `exports` map.
- **Deterministic** — same input, same matrix, every time. Snapshot-testable.
- **Tested against an independent decoder** — every version, every ECC level and every mask is round-tripped through `jsqr` in CI.

```text
npm install japqr
```

<details>
<summary><strong>Package size</strong></summary>

| Build | Minified | Gzipped | Dependencies |
| --- | ---: | ---: | ---: |
| ESM (whole library) | 18.7 kB | 7.1 kB | 0 |

Measured with esbuild (`--minify --target=es2020`, then `gzip -9`). Tree-shaking
unused renderers brings it down further in bundler-based apps.

</details>

---

## Installation

```bash
npm install japqr
# or
pnpm add japqr
yarn add japqr
bun add japqr
```

Requirements: Node.js 16+ (for `btoa` and `TextEncoder`), or any modern browser.

<details>
<summary><strong>Using a CDN instead?</strong></summary>

The ESM build is a plain JavaScript module, so it works directly from a CDN:

```html
<script type="module">
  import { QrCode } from 'https://cdn.jsdelivr.net/npm/japqr@1/dist/esm/index.js';
  document.body.innerHTML = QrCode.encodeText('Hello from a CDN').toSvgString();
</script>
```

</details>

---

## Quick start

### Node.js

```js
import { QrCode } from 'japqr';

const qr = QrCode.encodeText('https://github.com/japofc/japqr');

console.log(qr.version); // 3
console.log(qr.size);    // 29
console.log(qr.ecc);     // 'medium'
console.log(qr.mask);    // 0-7

// SVG string
const svg = qr.toSvgString();

// Print it in the terminal
console.log(qr.toTerminalString());

// Raw matrix
const matrix = qr.toMatrix(); // boolean[][]
```

### CommonJS

```js
const { QrCode } = require('japqr');

const qr = QrCode.encodeText('https://example.com');
console.log(qr.toSvgString());
```

### Browser

```html
<canvas id="qr"></canvas>

<script type="module">
  import { QrCode } from 'japqr';

  const qr = QrCode.encodeText('https://example.com', { ecc: 'high' });

  // Paint an existing canvas
  qr.draw(document.querySelector('#qr'), { scale: 8 });

  // Or inject an inline SVG
  document.body.insertAdjacentHTML('beforeend', qr.toSvgString({ includeXmlDeclaration: false }));

  // Or use a data URL in an <img>
  document.querySelector('img').src = qr.toDataUrl();
</script>
```

### Command line

```bash
npx japqr "https://example.com" -o qr.svg

# print it in the terminal instead
npx japqr "Hello, world!" --format terminal

# force the highest error correction and a wider quiet zone
npx japqr "Top secret" --ecc high --margin 3 --scale 12
```

---

## API reference

### `QrCode.encodeText(text, options?)`

Encodes a Unicode string. The text is split into numeric, alphanumeric and byte segments automatically, and the cheapest combination is chosen.

```js
const qr = QrCode.encodeText('HELLO 12345 world');
// -> alphanumeric segment "HELLO 12345 " + byte segment "world"
```

### `QrCode.encodeBinary(bytes, options?)`

Encodes raw bytes as a single byte-mode segment. Useful for binary payloads, signed tokens or pre-encoded text.

```js
const qr = QrCode.encodeBinary(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
```

### `QrCode.encodeSegments(segments, options?)`

Encodes a list of already prepared segments — the escape hatch for full control.

```js
import { QrCode, QrSegment } from 'japqr';

const qr = QrCode.encodeSegments(
  [QrSegment.eci(26), QrSegment.numeric('0123456789'), QrSegment.alphanumeric('HELLO WORLD')],
  { ecc: 'medium' },
);
```

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `ecc` | `'low' \| 'medium' \| 'quartile' \| 'high'` | `'medium'` | Error-correction level to start from. |
| `minVersion` | `number` | `1` | Smallest version to consider (1–40). |
| `maxVersion` | `number` | `40` | Largest version to consider (1–40). |
| `mask` | `0–7 \| 'auto'` | `'auto'` | Force a mask, or let the penalty scorer pick one. |
| `boostEcc` | `boolean` | `true` | Upgrade the ECC level while the payload still fits. |
| `eci` | `number` | – | Emit an ECI designator before the data (0–999999). |

All options are optional and validated; invalid values throw an `InvalidArgumentError`.

### Instance properties

| Member | Type | Description |
| --- | --- | --- |
| `version` | `number` | Version actually used, 1–40. |
| `size` | `number` | Modules per side (`17 + 4 × version`). |
| `ecc` | `EccLevel` | Error-correction level actually used. |
| `mask` | `MaskPattern` | Mask pattern actually used. |
| `modules` | `readonly (readonly boolean[])[]` | Module colours, indexed `[y][x]`. |

### Instance methods

| Method | Returns | Description |
| --- | --- | --- |
| `getModule(x, y)` | `boolean` | Colour of a module; `false` outside the grid. |
| `toMatrix()` | `boolean[][]` | Mutable copy of the grid. |
| `toBinaryStrings()` | `string[]` | One `'0'`/`'1'` string per row — ideal for snapshots. |
| `toSvgString(options?)` | `string` | Standalone SVG document. |
| `toTerminalString(options?)` | `string` | Unicode block art. |
| `draw(canvas, options?)` | `void` | Paints an existing `<canvas>` element. |
| `toDataUrl(options?)` | `string` | `data:image/svg+xml` URL. |
| `toJSON()` | `object` | Plain object for logging and snapshot tests. |

### `QrSegment`

| Static method | Description |
| --- | --- |
| `QrSegment.numeric(text)` | Decimal digits, packed 3 digits per 10 bits. |
| `QrSegment.alphanumeric(text)` | The 45-character QR alphabet (`0-9 A-Z space $%*+-./:`). |
| `QrSegment.bytes(bytes)` | Raw bytes, 8 bits each. |
| `QrSegment.utf8(text)` | A single byte segment from UTF-8 text. |
| `QrSegment.eci(value)` | Extended Channel Interpretation designator. |
| `QrSegment.fromText(text, options?)` | Automatic cost-optimal segmentation. |
| `QrSegment.isNumeric(text)` | Whether the string fits numeric mode. |
| `QrSegment.isAlphanumeric(text)` | Whether the string fits alphanumeric mode. |

Instances expose `mode`, `numChars`, `data` (the encoded bits), `totalBits(version)` and `charCountBits(version)`.

### Errors

Every error extends `QrCodeError`, so one `catch` covers the whole library. Each also carries a stable machine-readable `code`.

| Class | `code` | Thrown when |
| --- | --- | --- |
| `InvalidArgumentError` | `ERR_INVALID_ARGUMENT` | An option or input is out of range or malformed. |
| `DataTooLongError` | `ERR_DATA_TOO_LONG` | The payload cannot fit `maxVersion`. |
| `UnsupportedCharacterError` | `ERR_UNSUPPORTED_CHARACTER` | Text contains characters outside the requested mode. |
| `EncodingError` | `ERR_ENCODING` | An impossible internal state was reached. |

```js
import { QrCode, DataTooLongError } from 'japqr';

try {
  QrCode.encodeText('x'.repeat(10_000));
} catch (error) {
  if (error instanceof DataTooLongError) {
    console.error('Payload too large for a single QR Code.');
  }
}
```

---

## Output formats

### SVG

```js
qr.toSvgString({
  margin: 4,                       // quiet zone, in modules
  dark: '#000000',                 // dark modules
  light: '#ffffff',                // light modules
  scale: 8,                        // pixels per module; omit for a responsive SVG
  includeXmlDeclaration: true,     // prepend <?xml ...?>
  title: 'Open the repository',    // <title> and aria-label
  id: 'qr-code',                   // optional id attribute
  className: 'qr',                 // optional class attribute
});
```

Dark modules are merged into horizontal runs, so a 177×177 code still produces a compact `<path>`.

```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 29 29" shape-rendering="crispEdges" role="img" aria-label="QR code">
  <title>QR code</title>
  <rect x="-4" y="-4" width="29" height="29" fill="#ffffff"/>
  <path fill="#000000" d="M0 0h7v1h-7z..."/>
</svg>
```

### Terminal

```js
console.log(qr.toTerminalString({ dark: '██', light: '  ', margin: 2 }));
```

```text
    ██████████████  ██  ██████████
    ██          ██        ██    ██
    ██  ██████  ██  ████  ██  ██
    ...
```

### Canvas

```js
qr.draw(document.querySelector('#qr'), { margin: 4, scale: 8, dark: '#111', light: '#fff' });
```

### Data URL

```js
qr.toDataUrl();                        // base64
qr.toDataUrl({ encoding: 'uri' });     // percent-encoded, smaller for short codes
```

### Raw matrix

```js
for (const row of qr.modules) {
  console.log(row.map((dark) => (dark ? '##' : '  ')).join(''));
}
```

---

## Capacity

`getDataCapacity(version, ecc)` returns the number of data codewords (bytes) available. Byte-mode payloads also need 4 bits for the mode indicator plus 8 or 16 bits for the character count.

| Version | Low | Medium | Quartile | High | Modules |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 19 | 16 | 13 | 9 | 21×21 |
| 5 | 108 | 86 | 62 | 46 | 37×37 |
| 10 | 274 | 216 | 154 | 122 | 57×57 |
| 20 | 861 | 669 | 485 | 385 | 97×97 |
| 30 | 1735 | 1373 | 985 | 745 | 137×137 |
| 40 | 2956 | 2334 | 1666 | 1276 | 177×177 |

```js
import { getDataCapacity } from 'japqr';

console.log(getDataCapacity(40, 'low')); // 2956
```

---

## How it works

```text
text
  │
  ├─ QrSegment.fromText()  → numeric / alphanumeric / byte runs
  │
  ├─ version selection     → smallest version that fits
  ├─ ECC boosting          → highest level that still fits
  │
  ├─ bit stream            → mode + count + payload, terminator, 0xEC/0x11 padding
  ├─ Reed–Solomon          → per-block ECC over GF(2^8)
  ├─ interleaving          → codewords spread across blocks
  │
  ├─ matrix                → finder, timing, alignment, format, version info
  ├─ zigzag placement      → codewords into the data area
  └─ masking               → 8 candidates, lowest penalty score wins
```

The implementation follows ISO/IEC 18004 directly and is independently verified: the test suite rasterises every generated matrix and decodes it again with [`jsqr`](https://github.com/cozmo/jsQR).

---

## Comparison

| | japqr | qrcode | nayuki qrcodegen |
| --- | --- | --- | --- |
| Runtime dependencies | **0** | several | 0 |
| Bundle size (min+gzip) | **~7.1 kB** | — | — |
| All 40 versions | ✅ | ✅ | ✅ |
| Auto segmentation | ✅ | ✅ | ✅ |
| ECC boosting | ✅ | ❌ | ✅ |
| SVG output | ✅ | ❌ | ❌ |
| Terminal output | ✅ | ❌ | ❌ |
| Canvas output | ✅ | ✅ | ❌ |
| TypeScript types | ✅ | ✅ | ✅ |
| ESM + CJS | ✅ | ✅ | ✅ |
| CLI | ✅ | ✅ | ❌ |

<sub>Bundle size measured for this package only (esbuild, minified, ES2020, gzip -9);
the other libraries were not measured under identical conditions.</sub>

---

## Project structure

```text
japqr/
├── src/
│   ├── core/
│   │   ├── bit-buffer.ts       # append-only bit queue
│   │   ├── errors.ts           # error taxonomy
│   │   ├── galois-field.ts     # GF(2^8) arithmetic
│   │   ├── matrix.ts           # module geometry and masking
│   │   ├── modes.ts            # segment modes, character-count widths
│   │   ├── qr-code.ts          # the encoder
│   │   ├── reed-solomon.ts     # ECC generator and remainder
│   │   ├── segments.ts         # segment factories and segmentation
│   │   └── types.ts            # ISO/IEC 18004 constants
│   ├── render/
│   │   ├── base64.ts           # UTF-8 aware base64
│   │   ├── canvas.ts           # <canvas> painter
│   │   ├── svg.ts              # SVG renderer
│   │   └── terminal.ts         # Unicode block renderer
│   └── index.ts                # public API
├── bin/cli.mjs                 # command line interface
├── test/                       # node:test suites (incl. jsqr round-trip)
├── examples/                   # Node and browser examples
├── scripts/                    # build and clean scripts
├── docs/PUBLISHING.md          # GitHub + npm release guide
└── dist/                       # generated by `npm run build`
```

---

## Development

```bash
git clone https://github.com/japofc/japqr.git
cd japqr
npm install

npm run typecheck   # tsc --noEmit
npm run build       # ESM + CJS + declarations into dist/
npm test            # build, then run the full suite
npm run test:only   # run the suite without rebuilding
npm run preflight   # 28 pre-publish checks (metadata, watermark, entry points)
npm run example     # run the quick start example
```

The test suite covers:

- version selection across all 40 versions,
- every error-correction level and mask pattern,
- numeric, alphanumeric, byte and UTF-8 payloads,
- ECI encoding widths,
- Reed–Solomon correctness through end-to-end decoding,
- SVG, terminal, data-URL and base64 output,
- the full error taxonomy.

---

## Publishing

See [`docs/PUBLISHING.md`](https://github.com/japofc/japqr/blob/main/docs/PUBLISHING.md) for the complete GitHub and npm release walkthrough. The short version:

```bash
npm version patch        # or minor / major
git push --follow-tags
npm publish              # runs clean -> build -> preflight -> test
```

Pushing a `vX.Y.Z` tag also triggers `.github/workflows/release.yml`, which
builds, verifies and publishes automatically with an npm provenance attestation.

---

## Credits

The encoder follows the public QR Code specification, ISO/IEC 18004. The architecture — in particular the compact version-selection and interleaving approach — is inspired by [Nayuki's QR Code generator](https://github.com/nayuki/QR-Code-generator), the reference implementation of the algorithm. The code in this repository is an independent TypeScript implementation written from the specification, with its own segmentation optimiser, renderers, CLI and test suite.

- Author: **[@japofc](https://github.com/japofc)**
- Repository: **[github.com/japofc/japqr](https://github.com/japofc/japqr)**
- Package: **[npmjs.com/package/japqr](https://www.npmjs.com/package/japqr)**

## License

[MIT](LICENSE) © 2026 @japofc

---

## Bahasa Indonesia

### Ringkasan

`japqr` adalah library generator QR Code **tanpa dependensi** untuk Node.js, Bun, Deno, dan browser. Ditulis penuh dalam TypeScript, mengikuti standar ISO/IEC 18004, dan sudah diuji dengan decoder independen.

**Fitur utama**

- Mendukung **seluruh 40 versi**, 4 level error correction (L/M/Q/H), dan 8 pola mask.
- **Segmentasi otomatis**: teks dipecah jadi segmen numeric / alphanumeric / byte, lalu digabung hanya jika hemat bit.
- **ECC boosting otomatis**: naik ke level koreksi tertinggi yang masih muat.
- Output **SVG, terminal, canvas, data URL**, dan matriks boolean mentah.
- Tipe **TypeScript lengkap**, build **ESM + CommonJS**, plus **CLI**.

### Instalasi

```bash
npm install japqr
```

### Contoh cepat

```js
import { QrCode } from 'japqr';

const qr = QrCode.encodeText('Halo, dunia!');

console.log(qr.version);              // 1
console.log(qr.toSvgString());        // string SVG
console.log(qr.toTerminalString());   // tampil di terminal
```

### Opsi yang sering dipakai

| Opsi | Nilai | Kegunaan |
| --- | --- | --- |
| `ecc` | `'low'`, `'medium'`, `'quartile'`, `'high'` | Level koreksi error. |
| `minVersion` / `maxVersion` | `1`–`40` | Batas versi QR. |
| `mask` | `0`–`7` atau `'auto'` | Paksa pola mask tertentu. |
| `boostEcc` | `boolean` | Naikkan ECC otomatis (default `true`). |

### Membuat QR dengan level koreksi tertinggi

```js
import { QrCode } from 'japqr';

// Cocok kalau QR-nya mau diberi logo di tengah
const qr = QrCode.encodeText('https://github.com/japofc/japqr', {
  ecc: 'high',
});

console.log(qr.toDataUrl()); // langsung jadi src <img>
```

### Menulis ke file SVG

```js
import { writeFileSync } from 'node:fs';
import { QrCode } from 'japqr';

const qr = QrCode.encodeText('Halo, dunia!');
writeFileSync('qr.svg', qr.toSvgString({ margin: 4, scale: 10 }));
```

### CLI

```bash
npx japqr "https://example.com" -o qr.svg
npx japqr "Halo, dunia!" --format terminal
```

### Struktur proyek

Semua file source ada di `src/`, build di `dist/`, test di `test/`. Setiap file memiliki header watermark `@japofc`. Lisensi **MIT**.

### Publikasi ke GitHub dan npm

Panduan lengkap ada di [`docs/PUBLISHING.md`](https://github.com/japofc/japqr/blob/main/docs/PUBLISHING.md). Singkatnya:

```bash
npm version patch
git push --follow-tags
npm publish
```

---

<p align="center">
  Dibuat dengan ❤ oleh <a href="https://github.com/japofc"><strong>@japofc</strong></a>
</p>
