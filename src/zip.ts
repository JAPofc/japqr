/**
 * japofc-qr - batch archive
 *
 * Builds a ZIP of QR codes without a dependency. The archive uses the stored
 * (uncompressed) method — PNG data is already DEFLATE-compressed, so
 * compressing it again buys nothing and the writer stays small and predictable.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { QrCode } from './core/qr-code.js';
import type { EncodeOptions } from './core/types.js';
import { crc32 } from './render/crc32.js';
import { renderPng, type PngOptions } from './render/png.js';

/** One entry of a batch archive. */
export interface BatchItem {
  /** File name inside the archive, without the `.png` suffix. */
  readonly name: string;
  /** Text to encode. */
  readonly text: string;
  /** Per-entry encoding options. */
  readonly encode?: EncodeOptions;
}

/** Options for {@link encodeBatch}. */
export interface BatchOptions {
  /** PNG options applied to every entry. */
  readonly png?: PngOptions;
  /** Encoding options applied to every entry. */
  readonly encode?: EncodeOptions;
}

/** Fixed DOS timestamp so identical inputs produce identical archives. */
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

/**
 * Encodes every item and returns a ZIP archive holding one PNG per item.
 *
 * Useful for events, member cards and stock labels: a list of names or IDs in,
 * one archive out.
 */
export async function encodeBatch(
  items: readonly BatchItem[],
  options: BatchOptions = {},
): Promise<Uint8Array> {
  const entries: { name: string; data: Uint8Array; offset: number }[] = [];
  const localParts: Uint8Array[] = [];
  let offset = 0;

  for (const item of items) {
    const fileName = `${sanitizeName(item.name)}.png`;
    const qr = QrCode.encodeText(item.text, { ...options.encode, ...item.encode });
    const data = await renderPng(qr, options.png ?? {});
    const nameBytes = new TextEncoder().encode(fileName);
    const header = localHeader(nameBytes, data);

    localParts.push(header, data);
    entries.push({ name: fileName, data, offset });
    offset += header.length + data.length;
  }

  const centralParts: Uint8Array[] = [];
  let centralSize = 0;
  for (const entry of entries) {
    const record = centralRecord(new TextEncoder().encode(entry.name), entry.data, entry.offset);
    centralParts.push(record);
    centralSize += record.length;
  }

  const end = endOfCentralDirectory(entries.length, centralSize, offset);
  return concat([...localParts, ...centralParts, end]);
}

function localHeader(name: Uint8Array, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(30 + name.length);
  const view = new DataView(out.buffer);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true); // version needed
  view.setUint16(6, 0, true); // flags
  view.setUint16(8, 0, true); // method: stored
  view.setUint16(10, DOS_TIME, true);
  view.setUint16(12, DOS_DATE, true);
  view.setUint32(14, crc32(data), true);
  view.setUint32(18, data.length, true);
  view.setUint32(22, data.length, true);
  view.setUint16(26, name.length, true);
  view.setUint16(28, 0, true); // extra length
  out.set(name, 30);

  return out;
}

function centralRecord(name: Uint8Array, data: Uint8Array, offset: number): Uint8Array {
  const out = new Uint8Array(46 + name.length);
  const view = new DataView(out.buffer);

  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true); // version made by
  view.setUint16(6, 20, true); // version needed
  view.setUint16(8, 0, true); // flags
  view.setUint16(10, 0, true); // method: stored
  view.setUint16(12, DOS_TIME, true);
  view.setUint16(14, DOS_DATE, true);
  view.setUint32(16, crc32(data), true);
  view.setUint32(20, data.length, true);
  view.setUint32(24, data.length, true);
  view.setUint16(28, name.length, true);
  view.setUint16(30, 0, true); // extra length
  view.setUint16(32, 0, true); // comment length
  view.setUint16(34, 0, true); // disk start
  view.setUint16(36, 0, true); // internal attributes
  view.setUint32(38, 0, true); // external attributes
  view.setUint32(42, offset, true);
  out.set(name, 46);

  return out;
}

function endOfCentralDirectory(count: number, size: number, offset: number): Uint8Array {
  const out = new Uint8Array(22);
  const view = new DataView(out.buffer);

  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true); // this disk
  view.setUint16(6, 0, true); // central directory start disk
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, size, true);
  view.setUint32(16, offset, true);
  view.setUint16(20, 0, true); // comment length

  return out;
}

/** Keeps a file name safe on every platform while staying readable. */
function sanitizeName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^\.+/, '');

  return cleaned.length > 0 ? cleaned : 'qr-code';
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}
