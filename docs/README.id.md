<div align="center">

# japqr

**Generator QR Code tanpa dependensi untuk Node.js, Bun, Deno, dan browser.**

Seluruh 40 versi · 4 level error correction · 8 pola mask · output SVG, terminal, dan canvas

<p>
  <a href="https://www.npmjs.com/package/japqr"><img alt="versi npm" src="https://img.shields.io/npm/v/japqr?style=flat-square&color=cb3837"></a>
  <a href="https://www.npmjs.com/package/japqr"><img alt="unduhan npm" src="https://img.shields.io/npm/dm/japqr?style=flat-square&color=cb3837"></a>
  <a href="https://github.com/JAPofc/japqr/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/JAPofc/japqr/ci.yml?branch=main&style=flat-square&label=CI"></a>
  <a href="https://www.npmjs.com/package/japqr"><img alt="types" src="https://img.shields.io/npm/types/japqr?style=flat-square&color=3178c6"></a>
  <a href="../LICENSE"><img alt="lisensi" src="https://img.shields.io/badge/license-MIT-2ea44f?style=flat-square"></a>
  <img alt="dependensi" src="https://img.shields.io/badge/dependensi-0-2ea44f?style=flat-square">
</p>

<p>
  <a href="README.id.md#instalasi">Instalasi</a> ·
  <a href="README.id.md#mulai-cepat">Mulai cepat</a> ·
  <a href="README.id.md#api">API</a> ·
  <a href="README.id.md#output">Output</a> ·
  <a href="README.id.md#error">Error</a>
</p>

<p>
  <sub>
    <a href="../README.md">English</a> &nbsp;|&nbsp; Bahasa Indonesia
  </sub>
</p>

</div>

---

## Instalasi

```bash
npm install japqr
```

```bash
pnpm add japqr
yarn add japqr
bun add japqr
```

Node.js 16+ atau browser modern. Tanpa dependensi, tanpa modul native.

---

## Mulai cepat

### Node.js

```js
import { QrCode } from 'japqr';

const qr = QrCode.encodeText('https://github.com/JAPofc/japqr');

qr.version; // 3
qr.size;    // 29
qr.ecc;     // 'medium'
qr.mask;    // 0-7

const svg = qr.toSvgString();      // dokumen SVG
const art = qr.toTerminalString(); // bisa langsung dicetak di terminal
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

  // Gambar ke canvas yang sudah ada
  qr.draw(document.querySelector('#qr'), { scale: 8 });

  // Atau sisipkan SVG inline
  document.body.insertAdjacentHTML('beforeend', qr.toSvgString({ includeXmlDeclaration: false }));

  // Atau pakai data URL untuk <img>
  document.querySelector('img').src = qr.toDataUrl();
</script>
```

### Command line

```bash
npx japqr "https://example.com" -o qr.svg

# tampilkan langsung di terminal
npx japqr "Halo, dunia!" --format terminal

# error correction tertinggi, quiet zone lebih lebar, skala lebih besar
npx japqr "Rahasia" --ecc high --margin 3 --scale 12
```

---

## API

### `QrCode.encodeText(text, options?)`

Mengencode string Unicode. Teks otomatis dipecah menjadi segmen numeric, alphanumeric, dan byte, lalu dipilih kombinasi yang paling hemat bit.

```js
QrCode.encodeText('HALO 12345 dunia');
// -> segmen alphanumeric "HALO 12345 " + segmen byte "dunia"
```

> Catatan: mode alphanumeric standar QR hanya menerima huruf besar A–Z. Huruf kecil otomatis masuk ke mode byte.

### `QrCode.encodeBinary(bytes, options?)`

Mengencode byte mentah sebagai satu segmen byte. Cocok untuk payload biner, token bertanda tangan, atau teks yang sudah di-encode.

```js
QrCode.encodeBinary(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
```

### `QrCode.encodeSegments(segments, options?)`

Mengencode daftar segmen yang sudah disiapkan — pintu keluar untuk kontrol penuh.

```js
import { QrCode, QrSegment } from 'japqr';

const qr = QrCode.encodeSegments(
  [QrSegment.eci(26), QrSegment.numeric('0123456789'), QrSegment.alphanumeric('HELLO WORLD')],
  { ecc: 'medium' },
);
```

### Opsi

| Opsi | Tipe | Default | Keterangan |
| --- | --- | --- | --- |
| `ecc` | `'low' \| 'medium' \| 'quartile' \| 'high'` | `'medium'` | Level error correction awal. |
| `minVersion` | `number` | `1` | Versi terkecil yang dipertimbangkan (1–40). |
| `maxVersion` | `number` | `40` | Versi terbesar yang dipertimbangkan (1–40). |
| `mask` | `0–7 \| 'auto'` | `'auto'` | Paksa pola mask, atau biarkan skor penalty memilih. |
| `boostEcc` | `boolean` | `true` | Naikkan level ECC selama payload masih muat. |
| `eci` | `number` | – | Tambahkan designator ECI sebelum data (0–999999). |

Semua opsi bersifat opsional dan tervalidasi; nilai tidak valid melempar [`InvalidArgumentError`](#error).

### Properti

| Member | Tipe | Keterangan |
| --- | --- | --- |
| `version` | `number` | Versi yang benar-benar dipakai, 1–40. |
| `size` | `number` | Jumlah modul per sisi (`17 + 4 × version`). |
| `ecc` | `EccLevel` | Level error correction yang dipakai. |
| `mask` | `MaskPattern` | Pola mask yang dipakai. |
| `modules` | `readonly (readonly boolean[])[]` | Warna modul, diindeks `[y][x]`. |

### Method

| Method | Return | Keterangan |
| --- | --- | --- |
| `getModule(x, y)` | `boolean` | Warna satu modul; `false` di luar grid. |
| `toMatrix()` | `boolean[][]` | Salinan grid yang bisa dimodifikasi. |
| `toBinaryStrings()` | `string[]` | Satu string `'0'`/`'1'` per baris — cocok untuk snapshot test. |
| `toSvgString(options?)` | `string` | Dokumen SVG lengkap. |
| `toTerminalString(options?)` | `string` | Unicode block art. |
| `draw(canvas, options?)` | `void` | Menggambar ke elemen `<canvas>` yang sudah ada. |
| `toDataUrl(options?)` | `string` | URL `data:image/svg+xml`. |
| `toJSON()` | `object` | Objek polos untuk logging dan snapshot test. |

### `QrSegment`

| Static method | Keterangan |
| --- | --- |
| `QrSegment.numeric(text)` | Digit desimal, 3 digit per 10 bit. |
| `QrSegment.alphanumeric(text)` | Alfabet QR 45 karakter (`0-9 A-Z spasi $%*+-./:`). |
| `QrSegment.bytes(bytes)` | Byte mentah, 8 bit tiap byte. |
| `QrSegment.utf8(text)` | Satu segmen byte dari teks UTF-8. |
| `QrSegment.eci(value)` | Designator Extended Channel Interpretation. |
| `QrSegment.fromText(text, options?)` | Segmentasi otomatis yang paling hemat bit. |
| `QrSegment.isNumeric(text)` | Apakah string cocok untuk mode numeric. |
| `QrSegment.isAlphanumeric(text)` | Apakah string cocok untuk mode alphanumeric. |

Instance mengekspos `mode`, `numChars`, `data` (bit yang sudah diencode), `totalBits(version)`, dan `charCountBits(version)`.

---

## Output

### SVG

```js
qr.toSvgString({
  margin: 4,                       // quiet zone, dalam modul
  dark: '#000000',                 // warna modul gelap
  light: '#ffffff',                // warna modul terang
  scale: 8,                        // pixel per modul; hilangkan untuk SVG responsif
  includeXmlDeclaration: true,     // tambahkan <?xml ...?>
  attribution: true,               // sisipkan <!-- japqr · @japofc · MIT -->
  title: 'Buka repositori',        // <title> dan aria-label
  id: 'qr-code',                   // atribut id opsional
  className: 'qr',                 // atribut class opsional
});
```

Modul gelap digabung per baris horizontal, jadi kode 177×177 pun tetap menghasilkan `<path>` yang ringkas.

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
qr.toDataUrl({ encoding: 'uri' });  // percent-encoded, lebih kecil untuk kode pendek
```

### Matriks mentah

```js
for (const row of qr.modules) {
  console.log(row.map((dark) => (dark ? '##' : '  ')).join(''));
}
```

---

## Kapasitas

`getDataCapacity(version, ecc)` mengembalikan jumlah codeword data (byte) yang tersedia. Payload byte mode juga butuh 4 bit untuk mode indicator plus 8 atau 16 bit untuk character count.

| Versi | Low | Medium | Quartile | High | Modul |
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

## Error

Semua error turunan `QrCodeError`, jadi satu `catch` cukup untuk seluruh library. Tiap error juga membawa `code` yang stabil dan bisa dibaca mesin.

| Class | `code` | Dilempar saat |
| --- | --- | --- |
| `InvalidArgumentError` | `ERR_INVALID_ARGUMENT` | Opsi atau input di luar rentang, atau bentuknya salah. |
| `DataTooLongError` | `ERR_DATA_TOO_LONG` | Payload tidak muat di `maxVersion`. |
| `UnsupportedCharacterError` | `ERR_UNSUPPORTED_CHARACTER` | Teks mengandung karakter di luar mode yang diminta. |
| `EncodingError` | `ERR_ENCODING` | Kondisi internal yang seharusnya mustahil. |

```js
import { QrCode, DataTooLongError } from 'japqr';

try {
  QrCode.encodeText('x'.repeat(10_000));
} catch (error) {
  if (error instanceof DataTooLongError) {
    console.error('Payload terlalu besar untuk satu QR Code.');
  }
}
```

---

## Kredit

Mengimplementasikan ISO/IEC 18004. Arsitekturnya — pemilihan versi, interleaving blok, masking berbasis skor penalty — terinspirasi dari [QR Code generator milik Nayuki](https://github.com/nayuki/QR-Code-generator). Package ini implementasi TypeScript independen.

Dibuat oleh [@japofc](https://github.com/japofc).

## Lisensi

[MIT](../LICENSE) © 2026 @japofc

Lisensi ini mewajibkan notice hak cipta tetap disertakan pada salinan dan
bagian substansial dari software — termasuk atribusi `@japofc` pada output
yang dihasilkan. Lihat [NOTICE](../NOTICE).
