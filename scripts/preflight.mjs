#!/usr/bin/env node
/**
 * japqr - pre-publish preflight check
 *
 * Runs every sanity check that would otherwise be discovered the hard way,
 * halfway through `npm publish`: package metadata, entry points, bin files,
 * watermark coverage, README consistency and changelog coverage.
 *
 * Usage:
 *   npm run preflight        # after `npm run build`
 *   npm run preflight -- --verbose
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/japofc/japqr
 *
 * @author @japofc
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const verbose = process.argv.includes('--verbose');

let passed = 0;
const failures = [];
const warnings = [];

function ok(message) {
  passed += 1;
  console.log(`  \x1b[32m✔\x1b[0m ${message}`);
}

function fail(message) {
  failures.push(message);
  console.log(`  \x1b[31m✘\x1b[0m ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.log(`  \x1b[33m!\x1b[0m ${message}`);
}

function section(title) {
  console.log(`\n${title}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function walk(dir, extensions, out = []) {
  if (!existsSync(dir)) {
    return out;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }
      walk(full, extensions, out);
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
console.log('japqr preflight');

// 1. package.json ------------------------------------------------------------
section('Package metadata');

const pkg = readJson(join(root, 'package.json'));

if (typeof pkg.name === 'string' && /^[a-z0-9][a-z0-9._-]*$/.test(pkg.name)) {
  ok(`name is a valid npm name: ${pkg.name}`);
} else {
  fail(`invalid or missing package name: ${JSON.stringify(pkg.name)}`);
}

if (/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(pkg.version ?? '')) {
  ok(`version is valid semver: ${pkg.version}`);
} else {
  fail(`version is not valid semver: ${JSON.stringify(pkg.version)}`);
}

if (pkg.license === 'MIT') {
  ok('license is MIT');
} else {
  warn(`license is ${JSON.stringify(pkg.license)}, expected "MIT"`);
}

if (typeof pkg.description === 'string' && pkg.description.length >= 20) {
  ok(`description present (${pkg.description.length} chars)`);
} else {
  fail('description is missing or too short');
}

if (Array.isArray(pkg.keywords) && pkg.keywords.length >= 5) {
  ok(`keywords present (${pkg.keywords.length})`);
} else {
  warn('fewer than 5 keywords');
}

for (const field of ['homepage', 'bugs', 'repository']) {
  if (pkg[field]) {
    ok(`${field} is set`);
  } else {
    fail(`${field} is missing`);
  }
}

if (pkg.repository?.url && !pkg.repository.url.includes('github.com')) {
  warn('repository.url does not point to github.com');
}

// 2. Entry points ------------------------------------------------------------
section('Entry points');

function checkFile(label, path) {
  const absolute = resolve(root, path);
  if (existsSync(absolute) && statSync(absolute).isFile()) {
    ok(`${label} -> ${path}`);
    return true;
  }
  fail(`${label} -> ${path} does not exist (run \`npm run build\` first)`);
  return false;
}

let allEntriesExist = true;
for (const field of ['main', 'module', 'types']) {
  if (pkg[field]) {
    allEntriesExist = checkFile(field, pkg[field]) && allEntriesExist;
  }
}

for (const [subpath, targets] of Object.entries(pkg.exports ?? {})) {
  if (subpath === './package.json') {
    continue;
  }
  for (const [condition, target] of Object.entries(targets)) {
    allEntriesExist = checkFile(`exports["${subpath}"].${condition}`, target) && allEntriesExist;
  }
}

// 3. Bin files ---------------------------------------------------------------
section('Binaries');

for (const [name, path] of Object.entries(pkg.bin ?? {})) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) {
    fail(`bin "${name}" -> ${path} does not exist`);
    continue;
  }
  const firstLine = readFileSync(absolute, 'utf8').split('\n')[0];
  if (!firstLine.startsWith('#!')) {
    fail(`bin "${name}" has no shebang line`);
    continue;
  }
  const mode = statSync(absolute).mode & 0o777;
  if (!(mode & 0o111)) {
    warn(`bin "${name}" is not executable (npm will fix this on publish)`);
  }
  ok(`bin "${name}" -> ${path} (shebang ok)`);
}

// 4. Published files ---------------------------------------------------------
section('Published files');

for (const entry of pkg.files ?? []) {
  if (existsSync(resolve(root, entry))) {
    ok(`files[] present: ${entry}`);
  } else {
    fail(`files[] entry missing: ${entry}`);
  }
}

// 5. Watermark ---------------------------------------------------------------
section('Watermark');

const sourceFiles = [
  ...walk(join(root, 'src'), ['.ts']),
  ...walk(join(root, 'bin'), ['.mjs']),
  ...walk(join(root, 'scripts'), ['.mjs']),
  ...walk(join(root, 'test'), ['.mjs']),
  ...walk(join(root, 'examples'), ['.mjs', '.html']),
];

const missingWatermark = sourceFiles.filter(
  (file) => !/@japofc/i.test(readFileSync(file, 'utf8')),
);

if (missingWatermark.length === 0) {
  ok(`all ${sourceFiles.length} source files carry the @japofc watermark`);
} else {
  for (const file of missingWatermark) {
    fail(`missing watermark: ${relative(root, file)}`);
  }
}

// 6. Documentation -----------------------------------------------------------
section('Documentation');

if (existsSync(join(root, 'README.md'))) {
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  if (readme.length > 1000) {
    ok(`README.md present (${readme.length} chars)`);
  } else {
    warn('README.md is unusually short');
  }
  if (readme.includes(`npm i ${pkg.name}`) || readme.includes(`npm install ${pkg.name}`)) {
    ok(`README mentions the install command for "${pkg.name}"`);
  } else {
    fail(`README does not mention \`npm install ${pkg.name}\``);
  }
  if (readme.includes('japofc')) {
    ok('README credits @japofc');
  } else {
    fail('README does not credit @japofc');
  }
} else {
  fail('README.md is missing');
}

if (existsSync(join(root, 'LICENSE'))) {
  const license = readFileSync(join(root, 'LICENSE'), 'utf8');
  if (/MIT/i.test(license) && license.includes('@japofc')) {
    ok('LICENSE is MIT and credits @japofc');
  } else {
    fail('LICENSE is not a MIT license crediting @japofc');
  }
} else {
  fail('LICENSE is missing');
}

if (existsSync(join(root, 'CHANGELOG.md'))) {
  const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
  if (changelog.includes(pkg.version)) {
    ok(`CHANGELOG.md has an entry for ${pkg.version}`);
  } else {
    fail(`CHANGELOG.md has no entry for ${pkg.version}`);
  }
} else {
  fail('CHANGELOG.md is missing');
}

// 7. Stale references --------------------------------------------------------
section('Stale references');

// Built from parts so this script does not flag itself.
const stalePatterns = [`japofc-${'qrcodegen'}`, `@japofc/${'qrcodegen'}`];
const textFiles = [
  ...sourceFiles,
  join(root, 'README.md'),
  join(root, 'CHANGELOG.md'),
  join(root, 'CONTRIBUTING.md'),
  join(root, 'SECURITY.md'),
  join(root, 'package.json'),
];

for (const pattern of stalePatterns) {
  const hits = textFiles.filter((file) => existsSync(file) && readFileSync(file, 'utf8').includes(pattern));
  if (hits.length === 0) {
    ok(`no stale references to "${pattern}"`);
  } else {
    for (const file of hits) {
      fail(`stale reference to "${pattern}" in ${relative(root, file)}`);
    }
  }
}

// 8. npm authentication ------------------------------------------------------
section('npm');

try {
  const user = execFileSync('npm', ['whoami'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (user) {
    ok(`authenticated to npm as ${user}`);
  }
} catch {
  warn('not authenticated to npm yet (run `npm login` before publishing)');
}

// ---------------------------------------------------------------------------
console.log('');
if (failures.length > 0) {
  console.log(`\x1b[31m${failures.length} check(s) failed, ${passed} passed.\x1b[0m`);
  if (verbose) {
    console.log('\nFailures:');
    for (const failure of failures) {
      console.log(`  - ${failure}`);
    }
  }
  process.exit(1);
}

console.log(`\x1b[32mAll ${passed} checks passed.\x1b[0m`);
if (warnings.length > 0) {
  console.log(`\x1b[33m${warnings.length} warning(s) — review before publishing.\x1b[0m`);
}
