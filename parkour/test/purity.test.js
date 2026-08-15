/**
 * The determinism guard.
 *
 * `src/sim` and `src/data` are pure: no randomness, no wall-clock, no DOM, no
 * three.js. That is what lets the whole race field be simulated in Node, and it
 * is what keeps recorded best times comparable - one stray Math.random() in the
 * simulation would silently invalidate every one of them.
 *
 * This test runs first and is not negotiable.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

/** Strips comments so prose in a docblock cannot trip a pattern. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

const FORBIDDEN = [
  { re: /\bMath\s*\.\s*random\b/, why: 'use Rng from sim/math/prng.js' },
  { re: /\bDate\s*\.\s*now\b/, why: 'the sim has no wall clock; use tick count' },
  { re: /\bnew\s+Date\b/, why: 'the sim has no wall clock' },
  { re: /\bperformance\s*\./, why: 'the sim has no wall clock' },
  { re: /\bwindow\b/, why: 'sim code must not touch the browser' },
  { re: /\bdocument\b/, why: 'sim code must not touch the DOM' },
  { re: /\blocalStorage\b/, why: 'inject a storage adapter into SaveManager' },
  { re: /\brequestAnimationFrame\b/, why: 'the loop lives in app/' },
  { re: /\bnavigator\b/, why: 'sim code must not probe the platform' },
];

function pureFiles() {
  const files = [
    ...walk(join(root, 'src', 'sim')),
    ...walk(join(root, 'src', 'data')),
  ];
  files.push(join(root, 'src', 'config.js'));
  return files;
}

test('sim and data contain no impure APIs', () => {
  const problems = [];
  for (const file of pureFiles()) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const { re, why } of FORBIDDEN) {
      if (re.test(src)) {
        problems.push(`${relative(root, file)}: ${re} - ${why}`);
      }
    }
  }
  assert.deepEqual(problems, [], `impure API used in pure modules:\n${problems.join('\n')}`);
});

test('sim and data never import three.js or view layers', () => {
  const problems = [];
  const importRe = /(?:^|\n)\s*(?:import|export)[^'"\n]*from\s*['"]([^'"]+)['"]/g;
  for (const file of pureFiles()) {
    const src = stripComments(readFileSync(file, 'utf8'));
    let m;
    while ((m = importRe.exec(src)) !== null) {
      const spec = m[1];
      if (!spec.startsWith('.')) {
        // Node ignores import maps, so a bare specifier would break `node --test`.
        problems.push(`${relative(root, file)}: bare specifier "${spec}"`);
        continue;
      }
      if (/\/(render|ui|audio|app|input)\//.test(spec)) {
        problems.push(`${relative(root, file)}: imports view layer "${spec}"`);
      }
    }
  }
  assert.deepEqual(problems, [], `layering violation:\n${problems.join('\n')}`);
});

test('the guard itself is looking at real files', () => {
  const files = pureFiles();
  assert.ok(files.length >= 5, `expected to scan several modules, saw ${files.length}`);
});
