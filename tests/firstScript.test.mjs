import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';

// The page's first script is Garden.tsx and everything it imports statically.
// It brings the opening butterflies in, so it must not wait on three.js: the
// scene arrives later, through GardenCanvas's lazy import (docs/VOYAGE.md,
// "The first script"). Type-only imports vanish from the build, so they don't count.
const garden = new URL('../src/components/garden/', import.meta.url).pathname;
const IMPORT = /^\s*(?:import|export)\s+(?!type\b)([^;]*?)\s*from\s*['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm;

// By the exact name on disk, as the build does on a case-sensitive system.
function resolve(from, spec) {
  const path = normalize(join(dirname(from), spec)), dir = dirname(path), name = path.slice(dir.length + 1);
  const entries = readdirSync(dir);
  for (const candidate of [name, ...['.ts', '.tsx', '.mjs', '.js'].map(ext => name + ext)])
    if (entries.includes(candidate) && statSync(join(dir, candidate)).isFile()) return join(dir, candidate);
  return null;
}

function staticGraph(entry) {
  const parent = new Map([[entry, null]]), packages = [];
  for (const file of parent.keys()) {
    for (const [, names, from, bare] of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      const spec = from ?? bare;
      if (names && /^\{\s*(type\s+\w+\s*,?\s*)+\}$/.test(names)) continue;
      if (spec.endsWith('.css')) continue;
      if (!spec.startsWith('.')) { packages.push({ file, spec }); continue; }
      const next = resolve(file, spec);
      if (next && !parent.has(next)) parent.set(next, file);
    }
  }
  const chain = file => { const out = []; for (let at = file; at; at = parent.get(at)) out.unshift(relative(garden, at)); return out.join(' → '); };
  return { files: [...parent.keys()], packages, chain };
}

test('the first script reaches neither three.js nor React Three Fiber', () => {
  const { files, packages, chain } = staticGraph(join(garden, 'Garden.tsx'));
  const three = packages.filter(({ spec }) => /^(three|@react-three\/)/.test(spec));
  assert.deepEqual(three.map(({ file, spec }) => `${chain(file)} imports ${spec}`), []);
  // The scene is still there, behind the lazy import.
  assert.ok(!files.some(file => file.endsWith('GardenCanvas.tsx')));
  assert.match(readFileSync(join(garden, 'Garden.tsx'), 'utf8'), /lazy\(\(\) => import\('\.\/GardenCanvas'\)\)/);
});
