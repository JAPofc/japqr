#!/usr/bin/env node
/**
 * japofc-qr - build script
 *
 * Compiles the TypeScript sources twice: once as native ESM and once as
 * CommonJS. Each output folder gets its own `package.json` with the right
 * `type` field, which is what makes the dual `exports` map work.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as bundle } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

if (!existsSync(tsc)) {
  console.error('TypeScript is not installed. Run `npm install` first.');
  process.exit(1);
}

const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });

function compile(project) {
  console.log(`> tsc -p ${project}`);
  execFileSync(process.execPath, [tsc, '-p', project], { cwd: root, stdio: 'inherit' });
}

function writePackageJson(folder, type) {
  writeFileSync(join(dist, folder, 'package.json'), `${JSON.stringify({ type }, null, 2)}\n`);
}

compile('tsconfig.esm.json');
writePackageJson('esm', 'module');

// CommonJS is produced from the ESM build rather than compiled twice: one
// compiler pass, and the two outputs cannot drift apart.
await bundleTo('cjs', 'dist/cjs/index.js', 'cjs', 'node');
writePackageJson('cjs', 'commonjs');

await bundleBrowser();

console.log('\nBuild complete:');
console.log('  ESM    -> dist/esm/index.js');
console.log('  CJS    -> dist/cjs/index.js');
console.log('  d.ts   -> dist/esm/index.d.ts');
console.log('  browser-> dist/browser/japofc-qr.min.js');

/** Bundles the ESM build into a different module format. */
async function bundleTo(outdir, outfile, format, platform) {
  console.log(`> esbuild dist/esm/index.js -> ${outfile}`);
  await bundle({
    entryPoints: [join(dist, 'esm', 'index.js')],
    outfile: join(root, outfile),
    bundle: true,
    minify: false,
    sourcemap: false,
    format,
    platform,
    target: platform === 'node' ? ['node16'] : ['es2019'],
    legalComments: 'none',
  });
}

/**
 * Bundles the ESM build into a single IIFE file for `<script>` tags and CDNs.
 * This is the only output that works without a bundler, so it is what the
 * README points browser users at.
 */
async function bundleBrowser() {
  const outdir = join(dist, 'browser');
  console.log('> esbuild dist/esm/index.js -> dist/browser/japofc-qr.min.js');

  await bundle({
    entryPoints: [join(dist, 'esm', 'index.js')],
    outfile: join(outdir, 'japofc-qr.min.js'),
    bundle: true,
    minify: true,
    sourcemap: false,
    format: 'iife',
    globalName: 'JapofcQr',
    platform: 'browser',
    target: ['es2019'],
    legalComments: 'none',
    banner: { js: `/*! japofc-qr ${pkg.version} · @japofc · MIT License */` },
  });

  // Types for the global that the IIFE exposes.
  writeFileSync(
    join(outdir, 'japofc-qr.d.ts'),
    `declare const JapofcQr: typeof import('../esm/index.js');\nexport = JapofcQr;\n`,
  );
}
