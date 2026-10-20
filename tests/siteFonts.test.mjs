import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

// The site's fonts are its own files (SiteFonts.astro), so every face it
// declares and every file a page preloads must be there.
const src = new URL('../src/', import.meta.url).pathname, pub = new URL('../public/fonts/', import.meta.url).pathname;
const component = readFileSync(`${src}components/SiteFonts.astro`, 'utf8');
const subsets = [...component.match(/const SUBSETS = \{([\s\S]*?)\};/)[1].matchAll(/^\s*'?([a-z-]+)'?:/gm)].map(m => m[1]);
const styles = [...component.match(/const STYLES = \[([\s\S]*?)\] as const;/)[1].matchAll(/\['([^']+)', '(\w+)', \[[\d, ]+\]\]/g)].map(m => [m[1], m[2]]);
const file = (family, style, subset) => `${family.toLowerCase().replaceAll(' ', '-')}-${style}-${subset}.woff2`;

test('every face the site declares has its file', () => {
  assert.deepEqual(subsets, ['cyrillic-ext', 'cyrillic', 'vietnamese', 'latin-ext', 'latin']);
  assert.deepEqual(styles, [['Cormorant Garamond', 'italic'], ['Cormorant Garamond', 'normal'], ['Montserrat', 'normal']]);
  for (const [family, style] of styles) for (const subset of subsets) assert.ok(existsSync(pub + file(family, style, subset)), file(family, style, subset));
});

test('the Garden preloads its title\'s two files and waits for them; the details page swaps as it always did', () => {
  const garden = readFileSync(`${src}components/garden/GardenPage.astro`, 'utf8');
  const details = readFileSync(`${src}pages/details.astro`, 'utf8');
  assert.match(garden, /<SiteFonts display="block" preload=\{\['cormorant-garamond-normal-latin\.woff2', 'cormorant-garamond-italic-latin\.woff2'\]\} \/>/);
  for (const preload of ['cormorant-garamond-normal-latin.woff2', 'cormorant-garamond-italic-latin.woff2']) assert.ok(existsSync(pub + preload));
  assert.match(details, /<SiteFonts display="swap" \/>/);
  for (const page of [garden, details]) assert.doesNotMatch(page, /fonts\.googleapis/);
});
