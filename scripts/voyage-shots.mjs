// Screenshots of the Garden's voyage at every milestone stop, in headless
// Chrome: one PNG per stop and viewport, a labelled contact sheet per
// viewport, an index.html to flip through them, and optionally a visual diff
// against an earlier run or another server. See "Screenshots" in
// docs/VOYAGE.md, or run with --help.
//
//   corepack pnpm shots                                  this checkout, on a dev server it starts
//   corepack pnpm shots --url http://127.0.0.1:4351      a server already running
//   corepack pnpm shots --only meet,engaged --viewports phone
//   corepack pnpm shots --compare-url http://127.0.0.1:4342
//   corepack pnpm shots --compare .shots/main-20261019-221500
//
// The stops come from this checkout's journey.ts, whichever server is shot.
// Pure helpers are in voyage-shots-lib.mjs (tests/voyageShots.test.mjs).
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir, platform } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { MILESTONES, STOPS, dateLabel, stillProgress } from '../src/components/garden/journey.ts';
import { paceToward } from '../src/components/garden/journeyPace.ts';
import {
  USAGE, UsageError, contactSheetLayout, diffStats, dilate, escapeXml, frameLabel, indexHtml, outDirName, when,
  parseShotArgs, percent, pickPort, rankChanges, serverUrlFrom, stopList, summaryLines, thumbWidthFor, travelTime,
} from './voyage-shots-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sleep = ms => new Promise(done => setTimeout(done, ms));
const started = Date.now();
const seconds = since => `${((Date.now() - since) / 1000).toFixed(1)}s`;
const log = message => console.log(message);

// Everything started here, so it can always be stopped: on success, on an
// error, and on Ctrl-C.
const owned = { chromes: new Set(), servers: new Set(), profiles: new Set() };

const alive = child => child.exitCode === null && child.signalCode === null;
// Each child is started detached, in a process group of its own, so its
// helpers (Chrome's GPU and renderer processes, Vite's esbuild) go with it.
// Only that group, by the PID recorded at spawn, is ever signalled.
function signalGroup(child, signal) {
  try { process.kill(-child.pid, signal); } catch { try { process.kill(child.pid, signal); } catch {} }
}
async function stop(child) {
  if (alive(child)) {
    const exited = new Promise(done => child.once('exit', done));
    signalGroup(child, 'SIGTERM');
    if (await Promise.race([exited.then(() => true), sleep(4000).then(() => false)]) === false) {
      signalGroup(child, 'SIGKILL');
      await Promise.race([exited, sleep(2000)]);
    }
  }
  signalGroup(child, 'SIGKILL');
}
let stopping = null;
function stopAll() {
  stopping ??= (async () => {
    await Promise.all([...owned.chromes, ...owned.servers].map(stop));
    owned.chromes.clear(); owned.servers.clear();
    for (const profile of owned.profiles) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    owned.profiles.clear();
  })();
  return stopping;
}
// The last resort if Node exits some other way: synchronous, so it runs.
process.on('exit', () => {
  for (const child of [...owned.chromes, ...owned.servers]) signalGroup(child, 'SIGKILL');
  for (const profile of owned.profiles) try { rmSync(profile, { recursive: true, force: true }); } catch {}
});
for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) {
  process.on(signal, async () => {
    console.error(`\n${signal}: stopping Chrome and the dev server…`);
    await stopAll();
    process.exit(code);
  });
}

function git(...args) {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
}

// Chrome: --chrome, then CHROME, then the usual Linux and macOS places.
function findChrome(path) {
  const chosen = path ?? process.env.CHROME;
  if (chosen) {
    if (!existsSync(chosen)) throw new Error(`No Chrome at ${chosen}${path ? ' (--chrome)' : ' (CHROME)'}.`);
    return chosen;
  }
  for (const candidate of ['/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']) {
    if (existsSync(candidate)) return candidate;
  }
  for (const name of ['chromium', 'google-chrome', 'google-chrome-stable', 'chromium-browser']) {
    try { return execFileSync('which', [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
  }
  throw new Error('Chrome not found. Pass --chrome /path/to/chrome or set CHROME.');
}

// The GPU, not SwiftShader, which takes minutes a frame: Vulkan on Linux,
// Chrome's own Metal on a Mac. CHROME_FLAGS adds or overrides.
const gpuFlags = () => [
  '--enable-gpu', '--ignore-gpu-blocklist',
  ...(platform() === 'linux' ? ['--use-angle=vulkan', '--enable-features=Vulkan'] : []),
  ...(process.env.CHROME_FLAGS?.split(/\s+/).filter(Boolean) ?? []),
];

async function launchChrome(path) {
  const profile = await mkdtemp(join(tmpdir(), 'voyage-shots-chrome-'));
  owned.profiles.add(profile);
  const chrome = spawn(path, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, ...gpuFlags(),
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', 'about:blank',
  ], { detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
  owned.chromes.add(chrome);
  let errors = '';
  chrome.stderr.on('data', chunk => { errors = (errors + chunk).slice(-4000); });
  chrome.on('error', error => { errors += String(error); });
  const portFile = join(profile, 'DevToolsActivePort');
  for (let waited = 0; !existsSync(portFile); waited += 100) {
    if (!alive(chrome) || waited > 20_000) throw new Error(`Chrome didn't start (${path}).\n${errors.trim().split('\n').slice(-8).join('\n')}`);
    await sleep(100);
  }
  await sleep(50);
  const [port, wsPath] = readFileSync(portFile, 'utf8').trim().split('\n');
  return connect(`ws://127.0.0.1:${port}${wsPath}`);
}

// A small Chrome DevTools Protocol client over Node's own WebSocket.
async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((done, fail) => { socket.onopen = done; socket.onerror = () => fail(new Error('Could not connect to Chrome')); });
  let nextId = 0;
  const pending = new Map(), listeners = new Set();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id === undefined) return listeners.forEach(listener => listener(message));
    const waiting = pending.get(message.id);
    if (!waiting) return;
    pending.delete(message.id); clearTimeout(waiting.timer);
    message.error ? waiting.fail(new Error(`${waiting.method}: ${message.error.message}`)) : waiting.done(message.result);
  };
  socket.onclose = () => { for (const { fail, timer } of pending.values()) clearTimeout(timer), fail(new Error('Chrome closed the connection')); pending.clear(); };
  const send = (method, params = {}, sessionId, timeout = 60_000) => new Promise((done, fail) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); fail(new Error(`Chrome didn't answer ${method} within ${timeout / 1000}s`)); }, timeout);
    pending.set(id, { done, fail, timer, method });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
  return { send, listeners, close: () => socket.close() };
}

// A tab set up as the viewport: phone emulation with touch, reduced motion
// for stills, and the dev Review panel tucked away unless asked for.
async function openPage(cdp, viewport, { dpr, reduced, review }) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params, timeout) => cdp.send(method, params, sessionId, timeout);
  const errors = [], reloads = [], loading = new Set();
  let lastRequest = Date.now();
  const listener = message => {
    if (message.sessionId !== sessionId) return;
    if (message.method === 'Network.requestWillBeSent') loading.add(message.params.requestId), lastRequest = Date.now();
    if (message.method === 'Network.loadingFinished' || message.method === 'Network.loadingFailed') loading.delete(message.params.requestId), lastRequest = Date.now();
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description?.split('\n')[0] ?? message.params.exceptionDetails.text);
    // The dev server swapping in changed code (Vite's hot updates) or
    // reloading the page part way through, which would mix old and new.
    if (message.method === 'Runtime.consoleAPICalled') {
      const text = message.params.args.map(arg => arg.value ?? '').join(' ');
      if (/^\[vite\] (hot updated|page reload|css hot updated)/.test(text)) reloads.push(text);
    }
    if (message.method === 'Page.frameNavigated' && !message.params.frame.parentId) reloads.push(`navigated to ${message.params.frame.url}`);
  };
  cdp.listeners.add(listener);
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  const { width, height, mobile } = viewport;
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile, screenWidth: width, screenHeight: height });
  if (mobile) {
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
  }
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] });
  if (!review) await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('pa_dev_review_hidden', '1'); } catch {}` });
  const evaluate = async (expression, timeout) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeout);
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  // Until nothing has been downloading for a moment (a late texture, a font),
  // or 10s.
  const idle = async () => {
    const since = Date.now();
    while ((loading.size || Date.now() - lastRequest < 200) && Date.now() - since < 10_000) await sleep(50);
    await evaluate('document.fonts.ready.then(() => true)', 10_000);
  };
  return {
    send, evaluate, errors, reloads, idle,
    close: async () => { cdp.listeners.delete(listener); await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); },
  };
}

// Waits for the scene to be up (Garden.tsx sets data-garden-state).
async function waitReady(page, url, timeout) {
  const since = Date.now();
  let state = null;
  while (Date.now() - since < timeout) {
    state = await page.evaluate(`document.documentElement.dataset.gardenState ?? (document.querySelector('main.garden-prototype') ? 'loading' : null)`).catch(() => null);
    if (state === 'ready') return;
    if (state === 'error') throw new Error(`The Garden at ${url} couldn't start its scene (WebGL failed?).${page.errors.length ? `\n  ${page.errors.join('\n  ')}` : ''}`);
    await sleep(250);
  }
  throw new Error(state === null
    ? `No Garden at ${url}: the page never showed main.garden-prototype. Check --url and --path.`
    : `The scene at ${url} wasn't ready after ${timeout / 1000}s (still "${state}"). Is Chrome using the GPU? Raise --timeout if the server is just slow.${page.errors.length ? `\n  ${page.errors.join('\n  ')}` : ''}`);
}

const SCROLLER = `document.querySelector('main.garden-prototype')`;
const scrollTo = p => `(() => { const m = ${SCROLLER}; const span = Math.max(1, m.scrollHeight - m.clientHeight); m.scrollTop = ${p} * span; return m.scrollTop / span; })()`;
const frames = `new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => done(true))))`;
// Until the page's fades (the scroll cue's, the copy's) have finished, or 5s:
// no finite animation running for ten frames in a row, since React can start
// one a few frames after the scroll.
const fadesDone = `new Promise(done => {
  const since = performance.now();
  let quiet = 0;
  const check = () => {
    const fading = document.getAnimations().some(a => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity);
    quiet = fading ? 0 : quiet + 1;
    quiet >= 10 || performance.now() - since > 5000 ? done(true) : requestAnimationFrame(check);
  };
  check();
})`;

class Reloaded extends Error {}

// Shoots every stop at one viewport into `dir`.
async function shootViewport(cdp, base, viewport, stops, options, dir) {
  const url = `${base}${options.path}`;
  const page = await openPage(cdp, viewport, { dpr: options.dpr, reduced: !options.live, review: options.review });
  try {
    const { errorText } = await page.send('Page.navigate', { url });
    if (errorText) throw new Error(`Couldn't open ${url}: ${errorText}`);
    await waitReady(page, url, options.timeout);
    // Code swapped in while the page loaded (an edit saved just before the
    // run) leaves it part old, part new, and remounted parts of the scene
    // may not draw as a fresh page does: load it again. Its own first
    // navigation doesn't count.
    const own = page.reloads.findIndex(reason => reason.startsWith('navigated to'));
    if (own >= 0) page.reloads.splice(own, 1);
    if (page.reloads.length) throw new Reloaded(`while loading: ${page.reloads[0]}`);
    if (viewport.mobile && !await page.evaluate(`matchMedia('(hover: none)').matches`)) console.warn(`  ${viewport.name}: the emulated phone still reports hover, so phone-only styles won't show`);
    // The cover fades (1.2s even under reduced motion); live, the butterflies
    // also land on the names.
    await page.idle();
    if (options.live) await sleep(7000);
    else await page.evaluate(fadesDone, 10_000);
    const shots = [];
    let at = 0;
    for (const stop of stops) {
      if (options.live) {
        // Scrolled as a guest scrolls, kept at the target as the leash lets it
        // run on, for as long as the story's pace takes to get there.
        const until = Date.now() + travelTime(at, stop.p, paceToward) * 1000 + options.settle;
        do { await page.evaluate(scrollTo(stop.p)); await sleep(250); } while (Date.now() < until);
      } else {
        await page.evaluate(scrollTo(stop.p));
        await page.evaluate(frames, 10_000);
        await page.idle();
        await page.evaluate(fadesDone, 10_000);
        await sleep(options.settle);
      }
      const reached = await page.evaluate(`(() => { const m = ${SCROLLER}; return m.scrollTop / Math.max(1, m.scrollHeight - m.clientHeight); })()`);
      if (Math.abs(reached - stop.p) > 2e-3) console.warn(`  ${viewport.name} ${stop.id}: the page stopped at ${reached.toFixed(4)}, not ${stop.p.toFixed(4)}`);
      at = stop.p;
      await page.evaluate(frames, 10_000);
      const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
      const file = `${viewport.name}/${stop.file}.png`;
      await writeFile(join(dir, file), Buffer.from(data, 'base64'));
      shots.push({ id: stop.id, p: stop.p, date: stop.date, label: frameLabel(stop), file });
    }
    if (page.reloads.length) throw new Reloaded(page.reloads[0]);
    if (page.errors.length) console.warn(`  ${viewport.name}: the page threw ${page.errors.length} error(s):\n    ${[...new Set(page.errors)].join('\n    ')}`);
    return shots;
  } finally {
    await page.close();
  }
}

// A run: every viewport at one server, with contact sheets and a manifest.
async function shootRun(cdp, base, stops, options, dir, info) {
  await mkdir(dir, { recursive: true });
  const viewports = [];
  for (const viewport of options.viewports) {
    const since = Date.now();
    await mkdir(join(dir, viewport.name), { recursive: true });
    let frames;
    for (let attempt = 1; !frames; attempt++) {
      try {
        frames = await shootViewport(cdp, base, viewport, stops, options, dir);
      } catch (error) {
        if (!(error instanceof Reloaded)) throw error;
        if (attempt === 3) throw new Error(`The dev server kept changing the page's code while shooting ${viewport.name} (${error.message}). Is something still editing files?`);
        console.warn(`  ${viewport.name}: the dev server changed the page's code part way through (${error.message}); shooting it again`);
      }
    }
    const entry = { name: viewport.name, width: viewport.width, height: viewport.height, mobile: viewport.mobile, dpr: options.dpr, frames, sheet: `contact-${viewport.name}.png` };
    await contactSheet(dir, entry, info);
    viewports.push(entry);
    log(`  ${viewport.name.padEnd(9)} ${frames.length} frames in ${seconds(since)}`);
  }
  const manifest = { version: 1, ...info, url: `${base}${options.path}`, mode: options.live ? 'live' : 'still', viewports };
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

const FONT = `font-family="Helvetica, Arial, 'DejaVu Sans', sans-serif"`;

async function contactSheet(dir, viewport, info) {
  const first = await sharp(join(dir, viewport.frames[0].file)).metadata();
  const layout = contactSheetLayout({ count: viewport.frames.length, frameWidth: first.width, frameHeight: first.height, thumbWidth: thumbWidthFor(viewport) });
  const thumbs = await Promise.all(viewport.frames.map(async (frame, i) => ({
    input: await sharp(join(dir, frame.file)).resize(layout.thumb.width, layout.thumb.height).png().toBuffer(),
    left: layout.cells[i].x, top: layout.cells[i].y,
  })));
  const size = Math.max(11, Math.min(14, layout.thumb.width / 16));
  const detail = `${viewport.name} ${viewport.width}×${viewport.height}${viewport.mobile ? ' touch' : ''} · ${info.mode === 'live' ? 'live' : 'reduced-motion stills'} · ${info.when}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}">
    <text x="16" y="26" ${FONT} font-size="16" font-weight="bold" fill="#222">${escapeXml(info.title)}</text>
    <text x="16" y="47" ${FONT} font-size="13" fill="#555">${escapeXml(detail)}</text>
    ${viewport.frames.map((frame, i) => `<text x="${layout.cells[i].captionX}" y="${layout.cells[i].captionY}" ${FONT} font-size="${size}" fill="#333">${escapeXml(frame.label)}</text>`).join('\n')}
  </svg>`;
  await sharp({ create: { width: layout.width, height: layout.height, channels: 3, background: '#f4f1ea' } })
    .composite([...thumbs, { input: Buffer.from(svg), left: 0, top: 0 }]).png().toFile(join(dir, viewport.sheet));
}

const raw = file => sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });

// Before | after | highlighted difference for one frame.
async function compareImage(beforeFile, afterFile, out, stats, info, { beforeName, afterName, threshold }) {
  const { width, height } = info;
  const mask = dilate(stats.mask, width, height, Math.max(1, Math.round(width / 480)));
  const after = await raw(afterFile);
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    if (mask[i]) { pixels[i * 3] = 225; pixels[i * 3 + 1] = 0; pixels[i * 3 + 2] = 140; continue; }
    const lum = .3 * after.data[i * 3] + .59 * after.data[i * 3 + 1] + .11 * after.data[i * 3 + 2];
    pixels.fill(Math.round(255 - (255 - lum) * .3), i * 3, i * 3 + 3);
  }
  const panel = Math.min(width, 900), panelHeight = Math.round(height * panel / width), gap = 12, top = 36;
  const scaled = input => sharp(input.raw ? input.data : input, input.raw ? { raw: input.raw } : undefined).resize(panel, panelHeight).png().toBuffer();
  const panels = await Promise.all([scaled(beforeFile), scaled(afterFile), scaled({ data: pixels, raw: { width, height, channels: 3 } })]);
  const canvas = { width: gap + 3 * (panel + gap), height: top + panelHeight + gap };
  const labels = [`before · ${beforeName}`, `after · ${afterName}`, `difference · ${percent(stats.fraction)} of pixels moved more than ${threshold}`];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">${labels.map((label, i) =>
    `<text x="${gap + i * (panel + gap)}" y="24" ${FONT} font-size="14" fill="${i === 2 && stats.changed ? '#a0006e' : '#222'}">${escapeXml(label)}</text>`).join('')}</svg>`;
  await sharp({ create: { ...canvas, channels: 3, background: '#f4f1ea' } })
    .composite([...panels.map((input, i) => ({ input, left: gap + i * (panel + gap), top })), { input: Buffer.from(svg), left: 0, top: 0 }])
    .png().toFile(out);
}

async function compareRuns(beforeDir, before, afterDir, after, options, names) {
  const results = [];
  const byKey = new Map(before.viewports.flatMap(viewport => viewport.frames.map(frame => [`${viewport.name}/${frame.id}`, frame])));
  const seen = new Set();
  for (const viewport of after.viewports) {
    await mkdir(join(afterDir, 'compare', viewport.name), { recursive: true });
    for (const frame of viewport.frames) {
      const key = `${viewport.name}/${frame.id}`, old = byKey.get(key);
      seen.add(key);
      const result = { viewport: viewport.name, id: frame.id, file: frame.file };
      if (!old) { results.push({ ...result, missing: 'after' }); continue; }
      result.before = relative(afterDir, join(beforeDir, old.file));
      const [a, b] = await Promise.all([raw(join(beforeDir, old.file)), raw(join(afterDir, frame.file))]);
      if (a.info.width !== b.info.width || a.info.height !== b.info.height) { results.push({ ...result, sizeDiffers: true }); continue; }
      const stats = diffStats(a.data, b.data, { width: a.info.width, height: a.info.height, channels: 3, threshold: options.threshold });
      stats.changed = stats.fraction > options.minChanged;
      const compare = `compare/${frame.file}`;
      await compareImage(join(beforeDir, old.file), join(afterDir, frame.file), join(afterDir, compare), stats, b.info, { ...names, threshold: options.threshold });
      results.push({ ...result, compare, fraction: stats.fraction, maxDelta: stats.maxDelta, box: stats.box });
    }
  }
  // Stops only in the earlier run (left out with --only, or since removed)
  // are counted but not compared.
  const skipped = [...byKey.keys()].filter(key => !seen.has(key) && after.viewports.some(v => key.startsWith(`${v.name}/`))).length;
  return { ranked: rankChanges(results, options.minChanged), skipped };
}

const isFree = port => new Promise(done => {
  const probe = createServer().once('error', () => done(false)).listen(port, '127.0.0.1', () => probe.close(() => done(true)));
});
async function freePort() {
  const taken = new Set();
  for (;;) {
    const port = pickPort(taken, 4800);
    if (await isFree(port)) return port;
    taken.add(port);
  }
}

// This checkout's dev server, on a free port that isn't a review server's.
async function serve(timeout, asked) {
  const pkg = join(root, 'node_modules/astro/package.json');
  if (!existsSync(pkg)) throw new Error('No astro in node_modules. Run `corepack pnpm install` first.');
  const { bin } = JSON.parse(readFileSync(pkg, 'utf8'));
  const astro = join(dirname(pkg), typeof bin === 'string' ? bin : bin.astro);
  if (asked && !await isFree(asked)) throw new Error(`Port ${asked} is already in use. Pass --url http://127.0.0.1:${asked} to shoot what's there, or another --port.`);
  const port = asked ?? await freePort();
  // In the foreground, so its PID is the server's: --ignore-lock lets it run
  // beside a `pnpm dev` of the same checkout, and ASTRO_DEV_BACKGROUND stops
  // Astro 7 sending itself to the background when it detects an agent.
  const server = spawn(process.execPath, [astro, 'dev', '--port', String(port), '--host', '127.0.0.1', '--ignore-lock'], {
    cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ASTRO_DEV_BACKGROUND: '1', FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  owned.servers.add(server);
  let output = '';
  server.stdout.on('data', chunk => { output = (output + chunk).slice(-20_000); });
  server.stderr.on('data', chunk => { output = (output + chunk).slice(-20_000); });
  const since = Date.now();
  let base = null;
  while (!base) {
    if (!alive(server)) throw new Error(`The dev server stopped:\n${output.trim().split('\n').slice(-15).join('\n')}`);
    if (Date.now() - since > timeout) throw new Error(`The dev server didn't start within ${timeout / 1000}s:\n${output.trim().split('\n').slice(-15).join('\n')}`);
    base = serverUrlFrom(output);
    await sleep(200);
  }
  const actual = Number(new URL(base).port);
  if (actual !== port) throw new Error(`The dev server came up on ${base}, not port ${port}. Stopping it.`);
  log(`Dev server ${base} (PID ${server.pid})`);
  return base.replace(/\/$/, '');
}

async function probe(base, path, timeout) {
  const since = Date.now();
  let last = '';
  while (Date.now() - since < timeout) {
    try {
      const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(30_000) });
      if (response.ok) return;
      last = `HTTP ${response.status}`;
    } catch (error) { last = error.cause?.code ?? error.message; }
    await sleep(500);
  }
  throw new Error(`Nothing serving ${base}${path} (${last}). Start the dev server, or pass --serve.`);
}

async function readManifest(dir) {
  const file = join(dir, 'manifest.json');
  if (!existsSync(file)) throw new Error(`${dir} isn't a voyage-shots run (no manifest.json).`);
  return JSON.parse(await readFile(file, 'utf8'));
}

async function main() {
  const options = parseShotArgs(process.argv.slice(2));
  if (options.help) return log(USAGE);
  const stops = stopList({ stops: STOPS, milestones: MILESTONES, dateLabel, stillProgress, only: options.only, at: options.at, live: options.live });
  const chromePath = findChrome(options.chrome);
  const compareDir = options.compare ? resolve(options.compare) : null;
  const previous = compareDir ? await readManifest(compareDir) : null;
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD') || 'checkout', commit = git('rev-parse', '--short', 'HEAD');
  const dirty = git('status', '--porcelain', '--untracked-files=no') !== '';
  const now = new Date();
  const out = resolve(options.out ?? join(root, '.shots', outDirName(branch, now)));
  const checkout = `${branch}${commit ? ` @ ${commit}` : ''}${dirty ? ' + changes' : ''}`;

  const base = options.url ?? await serve(options.timeout, options.port);
  await probe(base, options.path, options.serve ? options.timeout : 10_000);
  if (options.compareUrl) await probe(options.compareUrl, options.path, 10_000);
  log(`Shooting ${stops.length} stop${stops.length === 1 ? '' : 's'} × ${options.viewports.map(v => v.name).join(', ')} (${options.live ? 'live' : 'reduced-motion stills'}) from ${base}${options.path}`);

  const cdp = await launchChrome(chromePath);
  try {
    const info = { title: options.url ? `${base}${options.path}` : checkout, checkout, created: now.toISOString(), when: when(now), mode: options.live ? 'live' : 'still' };
    const after = await shootRun(cdp, base, stops, options, out, info);
    let beforeDir = compareDir, before = previous;
    if (options.compareUrl) {
      log(`Shooting the same stops from ${options.compareUrl}${options.path} to compare`);
      beforeDir = join(out, 'before');
      before = await shootRun(cdp, options.compareUrl, stops, options, beforeDir, { ...info, title: `${options.compareUrl}${options.path}` });
    }
    cdp.close();
    await stopAll();

    let summary = null;
    if (before) {
      const since = Date.now();
      const inCheckout = relative(root, beforeDir);
      const names = { beforeName: options.compareUrl ? `${options.compareUrl}${options.path}` : inCheckout && !inCheckout.startsWith('..') ? inCheckout : beforeDir, afterName: after.title };
      const { ranked, skipped } = await compareRuns(beforeDir, before, out, after, options, names);
      const lines = summaryLines(ranked);
      if (skipped) lines.push(`(${skipped} frame${skipped === 1 ? '' : 's'} in the earlier run not shot this time)`);
      summary = { against: names.beforeName, threshold: options.threshold, minChanged: options.minChanged, lines, ranked };
      await writeFile(join(out, 'compare', 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
      await writeFile(join(out, 'compare', 'summary.txt'), lines.join('\n') + '\n');
      log(`\nCompared with ${names.beforeName} in ${seconds(since)}:\n${lines.join('\n')}`);
    }
    const byKey = new Map(summary?.ranked.map(r => [`${r.viewport}/${r.id}`, r]) ?? []);
    const viewports = after.viewports.map(viewport => ({
      name: viewport.name, size: `${viewport.width}×${viewport.height}`, sheet: viewport.sheet,
      frames: viewport.frames.map(frame => {
        const r = byKey.get(`${viewport.name}/${frame.id}`);
        return { ...frame, before: r?.before, compare: r?.compare, fraction: r?.fraction, changed: r?.changed };
      }),
    }));
    await writeFile(join(out, 'index.html'), indexHtml({ title: `Voyage shots · ${after.title}`, subtitle: `${info.mode === 'live' ? 'live' : 'reduced-motion stills'} · stops from ${checkout} · ${info.when}`, viewports, summary }));
    const shown = relative(process.cwd(), out);
    log(`\n${shown && !shown.startsWith('..') ? shown : out}/index.html  (${seconds(started)} in all)`);
  } finally {
    cdp.close();
  }
}

try {
  await main();
} catch (error) {
  process.exitCode = 2;
  if (error instanceof UsageError) console.error(`${error.message}\n\nRun with --help for the options.`);
  else console.error(`voyage-shots: ${error.message}`);
} finally {
  await stopAll();
}
