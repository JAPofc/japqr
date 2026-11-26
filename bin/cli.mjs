#!/usr/bin/env node
/**
 * japofc-qr - command line interface
 *
 * Usage:
 *   japofc-qr "Hello, world!"
 *   japofc-qr "https://example.com" -o qr.svg --ecc high
 *   japofc-qr "Hello" --format terminal
 *   cat payload.txt | japofc-qr --format data-url
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QrCode, encodeBatch } from '../dist/esm/index.js';

const HELP = `
japofc-qr - generate QR codes from the command line

USAGE
  japofc-qr <text> [options]
  cat payload.txt | japofc-qr [options]

OPTIONS
  -o, --out <file>        Write to a file instead of stdout
  -f, --format <format>   svg | png | terminal | data-url | json | matrix  (default: svg)
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
      --compact           Half-block terminal output (1 column per module)
      --no-xml            Omit the XML declaration

STYLING (SVG output, including data-url)
      --theme <name>      minimal | neon | glass | ink
      --shape <shape>     square | dot | rounded | diamond  (also for png)
      --frame             Draw a card around the symbol
      --frame-label <t>   Text printed under the code  (implies --frame)
      --animate           Sweep a highlight down the symbol

BATCH
      --zip <file>        JSON array of {name, text} entries -> ZIP of PNGs

  -q, --quiet             Suppress the summary printed to stderr
  -h, --help              Show this help
  -v, --version           Print the package version

EXAMPLES
  japofc-qr "https://github.com/JAPofc/japqr"
  japofc-qr "Hello, world!" -f terminal
  japofc-qr "https://example.com" --theme neon --frame -o card.svg
  japofc-qr "https://example.com" -f png --shape dot -o qr.png
  japofc-qr --zip batch.json -o batch.zip
  printf 'payload' | japofc-qr --format data-url
`;

const VERSION = readVersion();
const AUTHOR = '@japofc';

function readVersion() {
  try {
    const packageJson = JSON.parse(
      readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'),
    );
    return packageJson.version;
  } catch {
    return '0.0.0';
  }
}

function fail(message) {
  process.stderr.write(`japofc-qr: ${message}\n`);
  process.stderr.write('Run `japofc-qr --help` for usage.\n');
  process.exit(1);
}

const ECC_ALIASES = {
  l: 'low',
  m: 'medium',
  q: 'quartile',
  h: 'high',
  low: 'low',
  medium: 'medium',
  quartile: 'quartile',
  high: 'high',
};

function parseArguments(argv) {
  const options = {
    format: 'svg',
    formatGiven: false,
    margin: undefined,
    scale: undefined,
    ecc: undefined,
    mask: undefined,
    minVersion: undefined,
    maxVersion: undefined,
    boostEcc: true,
    dark: undefined,
    light: undefined,
    title: undefined,
    out: undefined,
    quiet: false,
    includeXmlDeclaration: true,
    compact: false,
    help: false,
    version: false,
    theme: undefined,
    shape: undefined,
    frame: false,
    frameLabel: undefined,
    animate: false,
    zip: undefined,
  };
  const positional = [];

  const value = (index, flag) => {
    if (index + 1 >= argv.length) {
      fail(`missing value for ${flag}`);
    }
    return argv[index + 1];
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.indexOf('=');
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const inlineValue = eq === -1 ? undefined : arg.slice(eq + 1);

    const takesValue = (name) => (inlineValue !== undefined ? inlineValue : value(i, flag));
    const isLast = inlineValue !== undefined;

    switch (flag) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-v':
      case '--version':
        options.version = true;
        break;
      case '-q':
      case '--quiet':
        options.quiet = true;
        break;
      case '--no-boost':
        options.boostEcc = false;
        break;
      case '--no-xml':
        options.includeXmlDeclaration = false;
        break;
      case '--compact':
        options.compact = true;
        break;
      case '-o':
      case '--out':
        options.out = takesValue(flag);
        if (!isLast) i += 1;
        break;
      case '-f':
      case '--format':
        options.format = takesValue(flag).toLowerCase();
        options.formatGiven = true;
        if (!isLast) i += 1;
        break;
      case '-e':
      case '--ecc': {
        const raw = takesValue(flag).toLowerCase();
        if (!ECC_ALIASES[raw]) fail(`unknown error-correction level "${raw}" (use low, medium, quartile or high)`);
        options.ecc = ECC_ALIASES[raw];
        if (!isLast) i += 1;
        break;
      }
      case '-m':
      case '--margin':
        options.margin = Number(takesValue(flag));
        if (!isLast) i += 1;
        break;
      case '-s':
      case '--scale':
        options.scale = Number(takesValue(flag));
        if (!isLast) i += 1;
        break;
      case '--mask':
        options.mask = Number(takesValue(flag));
        if (!isLast) i += 1;
        break;
      case '--min-version':
        options.minVersion = Number(takesValue(flag));
        if (!isLast) i += 1;
        break;
      case '--max-version':
        options.maxVersion = Number(takesValue(flag));
        if (!isLast) i += 1;
        break;
      case '--dark':
        options.dark = takesValue(flag);
        if (!isLast) i += 1;
        break;
      case '--light':
        options.light = takesValue(flag);
        if (!isLast) i += 1;
        break;
      case '--title':
        options.title = takesValue(flag);
        if (!isLast) i += 1;
        break;
      case '--theme':
        options.theme = takesValue(flag).toLowerCase();
        if (!isLast) i += 1;
        break;
      case '--shape':
        options.shape = takesValue(flag).toLowerCase();
        if (!isLast) i += 1;
        break;
      case '--frame':
        options.frame = true;
        break;
      case '--frame-label':
        options.frameLabel = takesValue(flag);
        if (!isLast) i += 1;
        break;
      case '--animate':
        options.animate = true;
        break;
      case '--zip':
        options.zip = takesValue(flag);
        if (!isLast) i += 1;
        break;
      default:
        if (arg.startsWith('-') && arg !== '-') {
          fail(`unknown option "${arg}"`);
        }
        positional.push(arg);
    }
  }

  return { options, positional };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const { options, positional } = parseArguments(process.argv.slice(2));

  if (options.help) {
    process.stdout.write(HELP.trimStart());
    return;
  }
  if (options.version) {
    process.stdout.write(`japofc-qr ${VERSION} · @japofc\n`);
    return;
  }

  const encodeOptions = {
    ecc: options.ecc,
    mask: options.mask,
    minVersion: options.minVersion,
    maxVersion: options.maxVersion,
    boostEcc: options.boostEcc,
  };

  // `-o qr.png` is enough; the format is inferred from the extension.
  const format =
    options.format === 'svg' && options.out && /\.png$/i.test(options.out) ? 'png' : options.format;

  let output;
  if (options.zip) {
    if (options.formatGiven) {
      fail('--zip cannot be combined with --format');
    }
    if (positional.length > 0) {
      fail('use either <text> or --zip, not both');
    }
    if (options.theme !== undefined || options.frame || options.frameLabel !== undefined || options.animate) {
      fail('--theme, --frame and --animate are SVG-only and cannot be used with --zip (the archive holds PNGs)');
    }
    let items;
    try {
      items = JSON.parse(readFileSync(resolve(options.zip), 'utf8'));
    } catch (error) {
      fail(`cannot read ${options.zip}: ${error instanceof Error ? error.message : error}`);
    }
    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      items.some(
        (item) =>
          !item ||
          typeof item !== 'object' ||
          typeof item.name !== 'string' ||
          typeof item.text !== 'string',
      )
    ) {
      fail('--zip expects a non-empty JSON array of {"name": "...", "text": "..."} entries');
    }
    output = Buffer.from(
      await encodeBatch(items, {
        encode: encodeOptions,
        png: {
          margin: options.margin,
          scale: options.scale,
          dark: options.dark,
          light: options.light,
          shape: options.shape,
        },
      }),
    );
    if (!options.out) {
      options.out = 'batch.zip';
    }
  } else {
    let payload = positional.join(' ');
    if (payload.length === 0 && !process.stdin.isTTY) {
      payload = await readStdin();
    }
    if (payload.length === 0) {
      fail('no payload given. Pass the text as an argument or pipe it on stdin.');
    }

    const shaped = options.shape !== undefined;
    const decorated = options.theme !== undefined || options.frame || options.frameLabel !== undefined || options.animate;
    if ((shaped || decorated) && !['svg', 'data-url', 'png'].includes(format)) {
      fail(`--theme/--shape/--frame/--animate are not available for ${format} output`);
    }
    if (decorated && format === 'png') {
      fail('--theme, --frame and --animate are SVG-only; use -f svg (or --format data-url)');
    }

    const style = {
      theme: options.theme,
      shape: options.shape,
      frame:
        options.frame || options.frameLabel !== undefined
          ? (options.frameLabel !== undefined ? { label: options.frameLabel } : true)
          : undefined,
      animate: options.animate ? true : undefined,
    };

    const qr = QrCode.encodeText(payload, encodeOptions);

    switch (format) {
      case 'svg':
        output = qr.toSvgString({
          margin: options.margin,
          scale: options.scale,
          dark: options.dark,
          light: options.light,
          title: options.title,
          includeXmlDeclaration: options.includeXmlDeclaration,
          ...style,
        });
        break;
      case 'png':
        // Binary output, so the payload is a Buffer rather than a string.
        output = Buffer.from(
          await qr.toPngBuffer({
            margin: options.margin,
            scale: options.scale,
            dark: options.dark,
            light: options.light,
            shape: options.shape,
          }),
        );
        break;
      case 'terminal':
        output = qr.toTerminalString({
          margin: options.margin ?? 2,
          dark: options.dark,
          light: options.light,
          compact: options.compact,
        });
        break;
      case 'data-url':
        output = `${qr.toDataUrl({
          margin: options.margin,
          scale: options.scale,
          dark: options.dark,
          light: options.light,
          ...style,
        })}\n`;
        break;
      case 'json':
        output = `${JSON.stringify(qr.toJSON(), null, 2)}\n`;
        break;
      case 'matrix':
        output = `${qr.toBinaryStrings().join('\n')}\n`;
        break;
      default:
        fail(`unknown format "${format}" (use svg, png, terminal, data-url, json or matrix)`);
    }
  }

  if (options.out) {
    const target = resolve(options.out);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, output);
    if (!options.quiet) {
      process.stderr.write(`wrote ${target}\n`);
    }
  } else {
    process.stdout.write(output);
    if (format === 'terminal' && !options.quiet) {
      process.stderr.write(`version ${qr.version} | ${qr.size}x${qr.size} modules | ecc ${qr.ecc} | mask ${qr.mask}\n`);
    }
  }

  if (options.quiet) {
    return;
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
