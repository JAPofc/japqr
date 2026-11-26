/**
 * japofc-qr - CLI tests
 *
 * The command line surface is exercised as a real child process: flag
 * validation, styling pass-through and batch ZIP mode are all covered, so a
 * flag can never silently stop applying again.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/cli.mjs', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'japofc-qr-cli-'));

function run(...args) {
  const result = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
  return {
    code: result.status,
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
  };
}

test.after(() => rmSync(work, { recursive: true, force: true }));

test('--help documents the styling and batch flags', () => {
  const { code, stdout } = run('--help');
  assert.equal(code, 0);
  for (const flag of ['--theme', '--shape', '--frame-label', '--animate', '--zip']) {
    assert.match(stdout, new RegExp(flag.replace(/-/g, '\\-')));
  }
});

test('--version prints the package version', () => {
  const { code, stdout } = run('--version');
  assert.equal(code, 0);
  assert.match(stdout, /^japofc-qr \d+\.\d+\.\d+ · @japofc/);
});

test('payload can be piped on stdin', () => {
  const result = spawnSync(process.execPath, [CLI, '--format', 'matrix', '-q'], {
    encoding: 'utf8',
    input: 'stdin',
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^[01]+$/m);
});

test('json and matrix formats produce their documented shapes', () => {
  const json = JSON.parse(run('x', '-f', 'json', '-q').stdout);
  assert.equal(json.generator, 'japofc-qr');
  assert.ok(Array.isArray(json.modules));

  const matrix = run('x', '-f', 'matrix', '-q').stdout.trim().split('\n');
  assert.equal(matrix.length, json.size);
  assert.ok(matrix.every((row) => /^[01]+$/.test(row)));
});

test('data-url styling is applied to the embedded SVG', () => {
  const { code, stdout } = run('https://example.com', '-f', 'data-url', '--frame-label', 'Pindai', '--shape', 'dot', '-q');
  assert.equal(code, 0);
  const encoded = stdout.trim().replace(/^data:image\/svg\+xml;base64,/, '');
  const svg = Buffer.from(encoded, 'base64').toString('utf8');
  assert.match(svg, /Pindai/);
  assert.match(svg, /qr-dot/);
});

test('svg output applies theme, frame and animation', () => {
  const themed = run('https://example.com', '--theme', 'neon');
  assert.equal(themed.code, 0);
  assert.match(themed.stdout, /linearGradient/);

  const framed = run('https://example.com', '--frame-label', 'Scan untuk terhubung');
  assert.equal(framed.code, 0);
  assert.match(framed.stdout, /Scan untuk terhubung/);
  assert.match(framed.stdout, /@japofc/);

  const animated = run('https://example.com', '--animate');
  assert.equal(animated.code, 0);
  assert.match(animated.stdout, /<animate/);
});

test('png output accepts shapes and produces real PNG files', () => {
  const plain = join(work, 'plain.png');
  const dotted = join(work, 'dotted.png');
  assert.equal(run('https://example.com', '-f', 'png', '-o', plain, '-q').code, 0);
  assert.equal(run('https://example.com', '-f', 'png', '--shape', 'dot', '-o', dotted, '-q').code, 0);

  const plainBytes = readFileSync(plain);
  const dottedBytes = readFileSync(dotted);
  assert.deepEqual([...plainBytes.slice(0, 4)], [137, 80, 78, 71]);
  assert.deepEqual([...dottedBytes.slice(0, 4)], [137, 80, 78, 71]);
  assert.notDeepEqual([...plainBytes], [...dottedBytes]);
});

test('invalid flags fail with helpful messages', () => {
  const badShape = run('x', '--shape', 'circle');
  assert.equal(badShape.code, 1);
  assert.match(badShape.stderr, /shape/i);

  const svgOnly = run('x', '--theme', 'neon', '-f', 'png', '-o', join(work, 'no.png'));
  assert.equal(svgOnly.code, 1);
  assert.match(svgOnly.stderr, /SVG-only/);

  const wrongFormat = run('x', '--frame', '-f', 'terminal');
  assert.equal(wrongFormat.code, 1);
  assert.match(wrongFormat.stderr, /not available/);
});

test('--zip renders a batch archive', () => {
  const list = join(work, 'batch.json');
  const out = join(work, 'batch.zip');
  writeFileSync(
    list,
    JSON.stringify([
      { name: 'tiket/001', text: 'https://example.com/001' },
      { name: 'tiket/002', text: 'https://example.com/002' },
    ]),
  );

  const { code, stderr } = run('--zip', list, '-o', out);
  assert.equal(code, 0);
  assert.match(stderr, /wrote/);

  const zip = readFileSync(out);
  assert.deepEqual([...zip.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const text = zip.toString('latin1');
  assert.match(text, /tiket-001\.png/);
  assert.match(text, /tiket-002\.png/);
});

test('--zip rejects malformed input and conflicting flags', () => {
  const bad = join(work, 'bad.json');
  writeFileSync(bad, JSON.stringify({ name: 'x' }));
  assert.equal(run('--zip', bad).code, 1);

  const list = join(work, 'ok.json');
  writeFileSync(list, JSON.stringify([{ name: 'a', text: 'x' }]));
  assert.equal(run('--zip', list, '--format', 'svg').code, 1);
  assert.equal(run('--zip', list, '--frame').code, 1);
  assert.equal(run('--zip', list, 'positional').code, 1);
});
