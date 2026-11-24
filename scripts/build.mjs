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
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');

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

compile('tsconfig.cjs.json');
writePackageJson('cjs', 'commonjs');

console.log('\nBuild complete:');
console.log(`  ESM  -> dist/esm/index.js`);
console.log(`  CJS  -> dist/cjs/index.js`);
console.log(`  d.ts -> dist/esm/index.d.ts`);
