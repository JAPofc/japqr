<div align="center">

# japqr

**Zero-dependency QR Code generator for Node.js, Bun, Deno and browsers.**

All 40 versions · 4 error-correction levels · 8 mask patterns · SVG, terminal and canvas output

<p>
  <a href="https://www.npmjs.com/package/japqr"><img alt="npm version" src="https://img.shields.io/npm/v/japqr?style=flat-square&color=cb3837"></a>
  <a href="https://www.npmjs.com/package/japqr"><img alt="npm downloads" src="https://img.shields.io/npm/dm/japqr?style=flat-square&color=cb3837"></a>
  <a href="https://github.com/JAPofc/japqr/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/JAPofc/japqr/ci.yml?branch=main&style=flat-square&label=CI"></a>
  <a href="https://www.npmjs.com/package/japqr"><img alt="types" src="https://img.shields.io/npm/types/japqr?style=flat-square&color=3178c6"></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-2ea44f?style=flat-square"></a>
  <img alt="dependencies" src="https://img.shields.io/badge/dependencies-0-2ea44f?style=flat-square">
</p>

<p>
  <a href="#installation">Installation</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#api">API</a> ·
  <a href="#output">Output</a> ·
  <a href="#errors">Errors</a>
</p>

<p>
  <sub>
    English &nbsp;|&nbsp;
    <a href="docs/README.id.md">Bahasa Indonesia</a>
  </sub>
</p>

</div>

---

## Installation

```bash
npm install japqr
```

```bash
pnpm add japqr
yarn add japqr
bun add japqr
```

Node.js 16+ or any modern browser. No dependencies, no native modules.

<details>
<summary><strong>Use it from a CDN</strong></summary>

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

const qr = QrCode.encodeText('https://github.com/JAPofc/japqr');

qr.version; // 3
qr.size;    // 29
qr.ecc;     // 'medium'
qr.mask;    // 0-7

const svg = qr.toSvgString();      // SVG document
const art = qr.toTerminalString(); // printable in a terminal
const raw = qr.toMatrix();         // boolean[][]
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

# highest error correction, wider quiet zone, larger scale
npx japqr "Top secret" --ecc high --margin 3 --scale 12
```

<details>
<summary><strong>All CLI options</strong></summary>

```
japqr <text> [options]
cat payload.txt | japqr [options]

  -o, --out <file>        Write to a file instead of stdout
  -f, --format <format>   svg | terminal | data-url | json | matrix  (default: svg)
  -e, --ecc <level>       low | medium | quartile | high  (or L, M, Q, H)
  -m, --margin <modules>  Quiet zone width in modules  (default: 4)
  -s, --scale <px>        Pixels per module for SVG output
      --mask <0-7>        Force a mask pattern  (default: automatic)
      --min-version <n>   Smallest version to consider  (1-40)
      --max-version <n>   Largest version to consider  (1-40)
      --no-boost          Disable automatic error-correction boosting
      --dark <color>      Dark module colour  (default: #000000)
      --light <color>     Light module colour  (default: #ffffff)
      --title <text>      Accessible title for the SVG
      --no-xml            Omit the XML declaration
  -q, --quiet             Suppress the summary printed to stderr
  -h, --help              Show help
  -v, --version           Print the package version
```

</details>

---

## API

### `QrCode.encodeText(text, options?)`

Encodes a Unicode string. The text is split into numeric, alphanumeric and byte segments automatically, and the cheapest combination is chosen.

```js
QrCode.encodeText('HELLO 12345 world');
// -> alphanumeric segment "HELLO 12345 " + byte segment "world"
```

### `QrCode.encodeBinary(bytes, options?)`

Encodes raw bytes as a single byte-mode segment. Useful for binary payloads, signed tokens or pre-encoded text.

```js
QrCode.encodeBinary(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
```

### `QrCode.encodeSegments(segments, options?)`

Encodes a list of prepared segments — the escape hatch for full control.

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

All options are optional and validated; invalid values throw an [`InvalidArgumentError`](#errors).

### Properties

| Member | Type | Description |
| --- | --- | --- |
| `version` | `number` | Version actually used, 1–40. |
| `size` | `number` | Modules per side (`17 + 4 × version`). |
| `ecc` | `EccLevel` | Error-correction level actually used. |
| `mask` | `MaskPattern` | Mask pattern actually used. |
| `modules` | `readonly (readonly boolean[])[]` | Module colours, indexed `[y][x]`. |

### Methods

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

---

## Output

### SVG

```js
qr.toSvgString({
  margin: 4,                       // quiet zone, in modules
  dark: '#000000',                 // dark modules
  light: '#ffffff',                // light modules
  scale: 8,                        // pixels per module; omit for a responsive SVG
  includeXmlDeclaration: true,     // prepend <?xml ...?>
  attribution: true,               // embed <!-- japqr · @japofc · MIT -->
  title: 'Open the repository',    // <title> and aria-label
  id: 'qr-code',                   // optional id attribute
  className: 'qr',                 // optional class attribute
});
```

Dark modules are merged into horizontal runs, so even a 177×177 code produces a compact `<path>`.

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
qr.toDataUrl();                     // base64
qr.toDataUrl({ encoding: 'uri' });  // percent-encoded, smaller for short codes
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

getDataCapacity(40, 'low'); // 2956
```

---

## Errors

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

## Credits

Implements ISO/IEC 18004. The architecture — version selection, block interleaving, penalty-scored masking — is inspired by [Nayuki's QR Code generator](https://github.com/nayuki/QR-Code-generator). This package is an independent TypeScript implementation.

Built by [@japofc](https://github.com/japofc).

## License

[MIT](LICENSE) © 2026 @japofc

The license requires the copyright notice to be preserved in copies and
substantial portions of the software — including the `@japofc` attribution
emitted in generated output. See [NOTICE](NOTICE).
