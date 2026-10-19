// Pure helpers for scripts/voyage-shots.mjs: argument parsing, the list of
// stops to shoot, image diff statistics, the contact sheet's layout and the
// flip-through index page. No browser, files or processes here, so it is
// tested in tests/voyageShots.test.mjs.
import { parseArgs } from 'node:util';

// Named viewports. `mobile` emulates a phone: mobile layout and touch.
export const VIEWPORTS = {
  desktop: { width: 1440, height: 900, mobile: false },
  phone: { width: 390, height: 844, mobile: true },
  'phone-small': { width: 320, height: 568, mobile: true },
  'phone-mid': { width: 375, height: 667, mobile: true },
  'phone-landscape': { width: 844, height: 390, mobile: true },
};
export const DEFAULT_VIEWPORTS = ['desktop', 'phone'];
// Patrick's and Amelia's review servers: --serve never takes these.
export const RESERVED_PORTS = [4321, 4341, 4342];
// A pixel counts as changed when a colour channel moves by more than
// `threshold` (of 255), and a frame when more than `minChanged` of its pixels
// do. Two runs of the same code as reduced-motion stills differ by at most 1
// level in a few dozen pixels, so stills catch even a faint change; live, the
// water shimmers and the trees sway, moving 1 to 4% of pixels by more than
// 24 levels between runs, so only a bigger change shows there. See
// "Screenshots" in docs/VOYAGE.md.
export const THRESHOLDS = { still: { threshold: 8, minChanged: .0001 }, live: { threshold: 48, minChanged: .025 } };

export class UsageError extends Error {}

export const USAGE = `Screenshots of the Garden's voyage at every milestone stop.

  corepack pnpm shots [options]

Target (one of):
  --serve                 start this checkout's dev server on a free port (default)
  --port <n>              the port for --serve (default the first free from 4800)
  --url <base>            a running server, e.g. http://127.0.0.1:4351
  --path <path>           page to open (default /)

What to shoot:
  --only <ids>            stops by id, e.g. opening,meet,engaged,dock
  --at <p,...>            extra scroll progresses from 0 to 1, e.g. .3,.55
                          (with --at alone, only those are shot)
  --viewports <list>      desktop, phone, phone-small, phone-mid, phone-landscape,
                          or WxH (desktop) / WxH-touch (phone); default desktop,phone
  --dpr <n>               device pixel ratio (default 1)
  --live                  scroll as a guest does and wait for the scene to settle,
                          instead of the reduced-motion stills (not repeatable)
  --review                keep the dev Review panel open (hidden by default)

Output and comparison:
  --out <dir>             default .shots/<branch>-<timestamp>/ in this checkout
  --compare <dir>         diff against an earlier run's directory
  --compare-url <base>    diff against the same stops on another server (before)
  --threshold <0-255>     per-pixel change that counts (default ${THRESHOLDS.still.threshold} still, ${THRESHOLDS.live.threshold} live)
  --min-changed <frac>    share of pixels that marks a frame changed
                          (default ${THRESHOLDS.still.minChanged} still, ${THRESHOLDS.live.minChanged} live)

Robustness:
  --timeout <seconds>     give up if the scene isn't ready by then (default 90)
  --settle <ms>           wait after each scroll, and the page's fades (default 150 still, 2500 live)
  --chrome <path>         Chrome or Chromium (or CHROME=...; default /usr/bin/chromium
                          or the usual macOS paths)
  --help`;

const number = (value, name, low, high) => {
  const n = Number(value);
  if (value === '' || !Number.isFinite(n) || n < low || n > high) throw new UsageError(`--${name} wants a number from ${low} to ${high}, not "${value}"`);
  return n;
};
const list = value => value.split(',').map(item => item.trim()).filter(Boolean);
const trimSlash = url => url.replace(/\/+$/, '');

// A viewport by name, or WxH / WxH-touch.
export function parseViewport(spec) {
  if (VIEWPORTS[spec]) return { name: spec, ...VIEWPORTS[spec] };
  const match = /^(\d{3,4})x(\d{3,4})(-touch)?$/.exec(spec);
  if (!match) throw new UsageError(`Unknown viewport "${spec}". Use ${Object.keys(VIEWPORTS).join(', ')}, WxH or WxH-touch.`);
  return { name: spec, width: +match[1], height: +match[2], mobile: !!match[3] };
}

const isUrl = value => { try { return /^https?:$/.test(new URL(value).protocol); } catch { return false; } };

export function parseShotArgs(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      strict: true,
      allowPositionals: false,
      options: {
        url: { type: 'string' }, serve: { type: 'boolean' }, port: { type: 'string' }, path: { type: 'string' },
        only: { type: 'string' }, at: { type: 'string' }, viewports: { type: 'string' }, dpr: { type: 'string' },
        live: { type: 'boolean' }, review: { type: 'boolean' },
        out: { type: 'string' }, compare: { type: 'string' }, 'compare-url': { type: 'string' },
        threshold: { type: 'string' }, 'min-changed': { type: 'string' },
        timeout: { type: 'string' }, settle: { type: 'string' }, chrome: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    }));
  } catch (error) {
    throw new UsageError(error.message);
  }
  if (values.help) return { help: true };
  if (values.url && values.serve) throw new UsageError('Pass either --url or --serve, not both.');
  if (values.url && !isUrl(values.url)) throw new UsageError(`--url wants a base URL like http://127.0.0.1:4351, not "${values.url}"`);
  if (values['compare-url'] && !isUrl(values['compare-url'])) throw new UsageError(`--compare-url wants a base URL like http://127.0.0.1:4342, not "${values['compare-url']}"`);
  if (values.compare && values['compare-url']) throw new UsageError('Pass either --compare or --compare-url, not both.');
  if (values.port && values.url) throw new UsageError('--port is for --serve; --url already names the server.');
  const port = values.port ? number(values.port, 'port', 1024, 65535) : null;
  if (RESERVED_PORTS.includes(port)) throw new UsageError(`Port ${port} belongs to a review server (${RESERVED_PORTS.join(', ')}); pick another.`);
  const path = values.path ?? '/';
  if (!path.startsWith('/')) throw new UsageError(`--path should start with /, not "${path}"`);
  const viewports = list(values.viewports ?? DEFAULT_VIEWPORTS.join(',')).map(parseViewport);
  if (!viewports.length) throw new UsageError('--viewports is empty.');
  if (new Set(viewports.map(v => v.name)).size !== viewports.length) throw new UsageError('A viewport is listed twice.');
  const live = !!values.live;
  return {
    help: false,
    url: values.url ? trimSlash(values.url) : null,
    serve: !values.url,
    port,
    path,
    only: values.only ? list(values.only) : null,
    at: values.at ? list(values.at).map(p => number(p, 'at', 0, 1)) : [],
    viewports,
    dpr: values.dpr ? number(values.dpr, 'dpr', .5, 4) : 1,
    live,
    review: !!values.review,
    out: values.out ?? null,
    compare: values.compare ?? null,
    compareUrl: values['compare-url'] ? trimSlash(values['compare-url']) : null,
    threshold: values.threshold ? number(values.threshold, 'threshold', 0, 255) : THRESHOLDS[live ? 'live' : 'still'].threshold,
    minChanged: values['min-changed'] ? number(values['min-changed'], 'min-changed', 0, 1) : THRESHOLDS[live ? 'live' : 'still'].minChanged,
    timeout: values.timeout ? number(values.timeout, 'timeout', 1, 3600) * 1000 : 90_000,
    settle: values.settle ? number(values.settle, 'settle', 0, 60_000) : live ? 2500 : 150,
    chrome: values.chrome ?? null,
  };
}

// The stops: the opening, each milestone (where the arrow keys land,
// journey.ts's STOPS) and the dock, plus any --at progresses, in scroll
// order. `date` is the label the page shows there: under reduced motion the
// still's (stillProgress), otherwise the scroll's own.
export function stopList({ stops, milestones, dateLabel, stillProgress, only = null, at = [], live = false }) {
  if (stops.length !== milestones.length + 2) throw new Error(`Expected ${milestones.length + 2} stops (opening, milestones, dock), found ${stops.length}`);
  const ids = ['opening', ...milestones.map(m => m.id), 'dock'];
  const shownAt = p => dateLabel(live ? p : stillProgress(p));
  const all = ids.map((id, i) => ({ id, p: stops[i], file: `${String(i).padStart(2, '0')}-${id}`, date: shownAt(stops[i]) }));
  if (only) {
    const unknown = only.filter(id => !ids.includes(id));
    if (unknown.length) throw new UsageError(`Unknown stop ${unknown.join(', ')}. Stops: ${ids.join(', ')}`);
  }
  const chosen = only ? all.filter(stop => only.includes(stop.id)) : at.length ? [] : all;
  const extra = at.map(p => ({ id: `at-${p.toFixed(4)}`, p, file: `at-${p.toFixed(4)}`, date: shownAt(p) }));
  const seen = new Set();
  return [...chosen, ...extra].filter(stop => !seen.has(stop.id) && seen.add(stop.id)).sort((a, b) => a.p - b.p);
}

// The caption under a frame on the contact sheet.
export const frameLabel = stop => `${stop.date ?? '(no date)'} · ${stop.id}`;

// Compares two images of the same size, as raw pixels with `channels` per
// pixel (alpha, if any, is ignored). A pixel changed if any colour channel
// moved by more than `threshold`.
export function diffStats(a, b, { width, height, channels, threshold }) {
  const total = width * height;
  if (a.length !== total * channels || b.length !== total * channels) throw new Error('diffStats: images are not the stated size');
  const mask = new Uint8Array(total);
  let changed = 0, maxDelta = 0, sum = 0;
  let left = width, top = height, right = -1, bottom = -1;
  const colours = Math.min(3, channels);
  for (let i = 0; i < total; i++) {
    let delta = 0;
    for (let c = 0; c < colours; c++) {
      const d = Math.abs(a[i * channels + c] - b[i * channels + c]);
      if (d > delta) delta = d;
    }
    sum += delta;
    if (delta > maxDelta) maxDelta = delta;
    if (delta > threshold) {
      mask[i] = 1; changed++;
      const x = i % width, y = (i - x) / width;
      if (x < left) left = x; if (x > right) right = x;
      if (y < top) top = y; if (y > bottom) bottom = y;
    }
  }
  return {
    changed, total, fraction: changed / total, maxDelta, meanDelta: sum / total, mask,
    box: changed ? { left, top, width: right - left + 1, height: bottom - top + 1 } : null,
  };
}

// Grows a change mask by `radius` pixels so a few changed pixels show up in
// the highlighted-difference image.
export function dilate(mask, width, height, radius) {
  // A square of side 2 * radius + 1 round each changed pixel, one axis at a time.
  const across = new Uint8Array(mask.length), out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % width, row = i - x;
    for (let dx = Math.max(0, x - radius); dx <= Math.min(width - 1, x + radius); dx++) across[row + dx] = 1;
  }
  for (let i = 0; i < across.length; i++) {
    if (!across[i]) continue;
    const x = i % width, y = (i - x) / width;
    for (let dy = Math.max(0, y - radius); dy <= Math.min(height - 1, y + radius); dy++) out[dy * width + x] = 1;
  }
  return out;
}

// Ranks compared stops, most changed first, and marks which count as changed.
export function rankChanges(results, minChanged) {
  return results
    .map(result => ({ ...result, changed: !result.missing && (!!result.sizeDiffers || result.fraction > minChanged) }))
    .sort((a, b) => Number(b.changed) - Number(a.changed) || Number(!!b.sizeDiffers) - Number(!!a.sizeDiffers) || (b.fraction ?? -1) - (a.fraction ?? -1));
}

export const percent = fraction => fraction === 0 ? '0%' : fraction < .00001 ? 'under 0.001%' : fraction >= .1 ? `${(fraction * 100).toFixed(0)}%` : fraction >= .001 ? `${(fraction * 100).toFixed(1)}%` : `${(fraction * 100).toFixed(3)}%`;

// Frames only in this run (a new stop, or one the earlier run left out) are
// listed but have nothing to be compared with.
export function summaryLines(ranked) {
  const compared = ranked.filter(r => !r.missing), changed = compared.filter(r => r.changed), fresh = ranked.filter(r => r.missing);
  const lines = !compared.length ? ['Nothing to compare: no stop appears in both runs.']
    : !changed.length ? [`No changes: ${compared.length} frames compared, none past the threshold (largest ${percent(Math.max(...compared.map(r => r.fraction ?? 0)))} of pixels).`]
    : [`${changed.length} of ${compared.length} frames changed, most first:`,
      ...changed.map(r => `  ${r.viewport.padEnd(9)} ${r.id.padEnd(18)} ${r.sizeDiffers ? 'size differs' : `${percent(r.fraction).padStart(7)} of pixels`}`)];
  if (fresh.length) lines.push(`Not in the earlier run: ${fresh.map(r => `${r.viewport} ${r.id}`).join(', ')}`);
  return lines;
}

// How many columns make a contact sheet of `count` frames closest to
// `aspect` (width / height) overall.
export function chooseColumns(count, thumbWidth, thumbHeight, aspect = 16 / 10) {
  let best = 1, bestScore = Infinity;
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const score = Math.abs(Math.log((columns * thumbWidth) / (rows * thumbHeight) / aspect)) + (columns * rows - count) * .02;
    if (score < bestScore) best = columns, bestScore = score;
  }
  return best;
}

// Where each frame and caption goes on a contact sheet. Thumbnails keep the
// frame's shape; a header line runs across the top.
export function contactSheetLayout({ count, frameWidth, frameHeight, thumbWidth, columns, gap = 16, header = 58, caption = 26, minWidth = 560 }) {
  const thumb = { width: Math.round(thumbWidth), height: Math.round(thumbWidth * frameHeight / frameWidth) };
  columns ??= chooseColumns(count, thumb.width, thumb.height + caption);
  columns = Math.max(1, Math.min(columns, count));
  const rows = Math.ceil(count / columns);
  const cell = { width: thumb.width + gap, height: thumb.height + caption + gap };
  const cells = Array.from({ length: count }, (_, i) => {
    const x = gap + (i % columns) * cell.width, y = header + gap + Math.floor(i / columns) * cell.height;
    return { x, y, captionX: x, captionY: y + thumb.height + caption * .72 };
  });
  return { width: Math.max(minWidth, gap + columns * cell.width), height: header + gap + rows * cell.height, columns, rows, thumb, cells, header, caption };
}

// The thumbnail width for a viewport's contact sheet: about a third of a
// desktop frame, half a phone's.
export const thumbWidthFor = ({ width, mobile }) => Math.round(mobile ? Math.min(width, 640) / 2 : Math.min(width, 1440) / 3);

// A free --serve port: the first not reserved and not taken.
export const pickPort = (taken, from = 4400) => {
  for (let port = from; port < 65536; port++) if (!RESERVED_PORTS.includes(port) && !taken.has(port)) return port;
  throw new Error('No free port');
};

// The URL astro dev prints once it is listening (it moves on to the next
// port if the one asked for is taken).
export function serverUrlFrom(output) {
  const plain = output.replace(/\x1b\[[0-9;]*m/g, '');
  return /Local\s+(https?:\/\/[^\s/]+)/.exec(plain)?.[1] ?? null;
}

const pad = n => String(n).padStart(2, '0');
export const stamp = date => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
// Local time, as on the contact sheets: 2026-10-19 21:20.
export const when = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
export const outDirName = (branch, date) => `${(branch || 'checkout').replace(/[^\w.-]+/g, '-')}-${stamp(date)}`;

// How long the live page takes to travel from one progress to another at the
// story's pace (journeyPace.ts's paceToward), to the nearest frame, until it is within about two pixels of scroll.
export function travelTime(from, to, paceToward, frame = 1 / 60, limit = 120) {
  let p = from, t = 0;
  while (Math.abs(p - to) > 1e-4 && t < limit) p = paceToward(p, to, frame), t += frame;
  return t;
}

export const escapeXml = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

// The flip-through page: contact sheets, every frame large with the arrow
// keys stepping stops, and the comparison when there is one.
export function indexHtml({ title, subtitle, viewports, summary = null }) {
  const data = JSON.stringify({ viewports }).replace(/</g, '\\u003c');
  const rows = summary ? summary.ranked.map(r => `<tr class="${r.changed ? 'changed' : ''}"><td>${escapeXml(r.viewport)}</td><td>${escapeXml(r.id)}</td><td>${r.missing ? 'not in the earlier run' : r.sizeDiffers ? 'size differs' : percent(r.fraction)}</td><td>${r.changed ? 'changed' : ''}</td></tr>`).join('') : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeXml(title)}</title>
<style>
body { font: 14px/1.4 system-ui, sans-serif; margin: 0; background: #f4f1ea; color: #222; }
header { padding: 12px 20px; border-bottom: 1px solid #ddd; }
h1 { font-size: 18px; margin: 0; } .sub { color: #666; }
nav { display: flex; gap: 8px; flex-wrap: wrap; padding: 10px 20px; }
nav button { font: inherit; border: 1px solid #bbb; background: #fff; border-radius: 4px; padding: 3px 8px; cursor: pointer; }
nav button[aria-pressed="true"] { background: #1d6f6a; color: #fff; border-color: #1d6f6a; }
#frame { padding: 0 20px 20px; } #frame img { max-width: 100%; max-height: 78vh; display: block; box-shadow: 0 1px 6px #0003; }
#caption { margin: 8px 0; font-weight: 600; }
section { padding: 10px 20px; } section img { max-width: 100%; }
table { border-collapse: collapse; } td { padding: 2px 10px; border-bottom: 1px solid #ddd; } tr.changed td { color: #a0006e; font-weight: 600; }
pre { white-space: pre-wrap; }
</style></head><body>
<header><h1>${escapeXml(title)}</h1><div class="sub">${escapeXml(subtitle)} · ← → step stops, ↑ ↓ viewport, B after / before / difference</div></header>
${summary ? `<section><h2>Compared with ${escapeXml(summary.against)}</h2><pre>${escapeXml(summary.lines.join('\n'))}</pre><details><summary>Every frame</summary><table>${rows}</table></details></section>` : ''}
<nav id="viewports"></nav><nav id="stops"></nav><nav id="kinds"></nav>
<div id="frame"><div id="caption"></div><img id="big" alt=""></div>
<section id="sheets"></section>
<script>
const { viewports } = ${data};
let v = 0, s = 0, k = 0;
const kinds = () => ['file', 'before', 'compare'].filter(kind => viewports[v].frames[s]?.[kind]);
const button = (label, pressed, onclick) => { const b = document.createElement('button'); b.textContent = label; b.setAttribute('aria-pressed', pressed); b.onclick = onclick; return b; };
function draw() {
  const vp = viewports[v]; s = Math.min(s, vp.frames.length - 1); k = Math.min(k, kinds().length - 1);
  const frame = vp.frames[s], kind = kinds()[k];
  document.getElementById('viewports').replaceChildren(...viewports.map((x, i) => button(x.name + ' ' + x.size, i === v, () => { v = i; draw(); })));
  document.getElementById('stops').replaceChildren(...vp.frames.map((f, i) => button((f.changed ? '● ' : '') + f.id, i === s, () => { s = i; draw(); })));
  document.getElementById('kinds').replaceChildren(...kinds().map((x, i) => button({ file: 'after', before: 'before', compare: 'before | after | difference' }[x], i === k, () => { k = i; draw(); })));
  if (kinds().length < 2) document.getElementById('kinds').replaceChildren();
  document.getElementById('caption').textContent = frame.label + '  (p ' + frame.p.toFixed(4) + ')' + (frame.fraction != null ? ' · ' + (frame.fraction * 100).toFixed(3) + '% of pixels changed' : '');
  document.getElementById('big').src = frame[kind];
}
document.getElementById('sheets').innerHTML = viewports.map(x => '<h2>' + x.name + ' ' + x.size + '</h2><a href="' + x.sheet + '"><img src="' + x.sheet + '" alt="Contact sheet, ' + x.name + '"></a>').join('');
addEventListener('keydown', e => {
  const vp = viewports[v];
  if (e.key === 'ArrowRight') s = (s + 1) % vp.frames.length;
  else if (e.key === 'ArrowLeft') s = (s - 1 + vp.frames.length) % vp.frames.length;
  else if (e.key === 'ArrowDown') v = (v + 1) % viewports.length;
  else if (e.key === 'ArrowUp') v = (v - 1 + viewports.length) % viewports.length;
  else if (e.key === 'b' || e.key === 'B') k = (k + 1) % kinds().length;
  else return;
  e.preventDefault(); draw();
});
draw();
</script></body></html>
`;
}
