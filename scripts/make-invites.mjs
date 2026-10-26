// Renders each Party's invitation image to invites/out/<code>.png by
// screenshotting the dev-only /dev/invite/<code> page in headless Chrome.
// Needs `pnpm dev` running. See "Invitations" in the README.
//
//   node scripts/make-invites.mjs                  every Party
//   node scripts/make-invites.mjs curry racecar    just these codes
//   --no-photo                                     leave the photograph out
//   --style=vibes                                  another look from STYLES in the page
//   --script='Imperial Script'                     another script font from SCRIPTS in the page
//   --crop=offset                                  another crop from CROPS in the page
//   --scale=1                                      1080×1350 instead of 2160×2700
//   --base=http://localhost:4334                   dev server (default :4321)
//   --out=/tmp/drafts                              write somewhere other than invites/out
//
// Chrome is found at the usual macOS/Linux paths, or set CHROME=/path/to/chrome.
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { parties } from '../src/data/parties.ts';

const WIDTH = 1080;
const HEIGHT = 1350;
const root = fileURLToPath(new URL('../', import.meta.url));


const args = process.argv.slice(2);
const option = (name, fallback) => args.find(arg => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const base = option('base', 'http://localhost:4321').replace(/\/$/, '');
const scale = Number(option('scale', '2'));
const query = new URLSearchParams();
if (args.includes('--no-photo')) query.set('photo', 'none');
for (const name of ['style', 'script', 'crop']) if (option(name)) query.set(name, option(name));
const codes = args.filter(arg => !arg.startsWith('--'));
const output = resolve(root, option('out', 'invites/out'));

const unknown = codes.filter(code => !parties.some(party => party.code === code));
if (unknown.length) {
  console.error(`No Party with code ${unknown.join(', ')} in src/data/parties.ts`);
  process.exit(1);
}
const chosen = codes.length ? parties.filter(party => codes.includes(party.code)) : parties;

const probe = await fetch(`${base}/dev/invite/${chosen[0].code}/`).catch(() => null);
if (!probe?.ok) {
  console.error(`No invite page at ${base}/dev/invite/. Start \`pnpm dev\` first, or pass --base=<url>.`);
  process.exit(1);
}

function findChrome() {
  const candidates = [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean);
  for (const path of candidates) if (existsSync(path)) return path;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try { return execFileSync('which', [name], { encoding: 'utf8' }).trim(); } catch {}
  }
  throw new Error('Chrome not found. Set CHROME=/path/to/chrome.');
}

// A small Chrome DevTools Protocol client: one browser, one tab, every Party.
const profile = await mkdtemp(resolve(tmpdir(), 'wedding-invites-'));
const chrome = spawn(findChrome(), [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });

let socket;
try {
  const portFile = resolve(profile, 'DevToolsActivePort');
  for (let i = 0; !existsSync(portFile); i++) {
    if (i > 100) throw new Error('Chrome did not start');
    await new Promise(done => setTimeout(done, 100));
  }
  const [port, path] = (await readFile(portFile, 'utf8')).trim().split('\n');
  socket = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  await new Promise((done, fail) => { socket.onopen = done; socket.onerror = fail; });

  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id === undefined) return listeners.forEach(listener => listener(message));
    const { resolve: done, reject: fail } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? fail(new Error(message.error.message)) : done(message.result);
  };
  const send = (method, params = {}, sessionId) => new Promise((done, fail) => {
    const id = ++nextId;
    pending.set(id, { resolve: done, reject: fail });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const once = (method, sessionId) => new Promise(done => {
    const listener = message => {
      if (message.method === method && message.sessionId === sessionId) { listeners.delete(listener); done(message.params); }
    };
    listeners.add(listener);
  });

  const within = (promise, what) => Promise.race([promise, new Promise((_, fail) =>
    setTimeout(() => fail(new Error(`Gave up waiting for ${what} after 30s`)), 30_000).unref())]);

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: scale, mobile: false }, sessionId);

  await mkdir(output, { recursive: true });
  const render = async url => {
    const loaded = once('Page.loadEventFired', sessionId);
    await send('Page.navigate', { url }, sessionId);
    await within(loaded, `${url} to load`);
    const ready = await within(send('Runtime.evaluate', { expression: 'window.inviteReady', awaitPromise: true }, sessionId), `${url}'s fonts and photo`);
    if (ready.exceptionDetails) throw new Error(`${url}: ${ready.exceptionDetails.exception?.description ?? ready.exceptionDetails.text}`);
    return send('Page.captureScreenshot', { format: 'png' }, sessionId);
  };
  for (const party of chosen) {
    const url = `${base}/dev/invite/${party.code}/${query.size ? `?${query}` : ''}`;
    // Saving the page while this runs makes the dev server reload it mid-render: try once more.
    const { data } = await render(url).catch(error => {
      if (!/navigated|destroyed/i.test(error.message)) throw error;
      return render(url);
    });
    const file = resolve(output, `${party.code}.png`);
    await writeFile(file, Buffer.from(data, 'base64'));
    console.log(`${party.code.padEnd(16)} ${party.greeting}`);
  }
  console.log(`\n${chosen.length} invite${chosen.length === 1 ? '' : 's'} in ${relative(process.cwd(), output).startsWith('..') ? output : relative(process.cwd(), output) || output} at ${WIDTH * scale}×${HEIGHT * scale}`);
} finally {
  socket?.close();
  if (chrome.exitCode === null) {
    const exited = new Promise(done => chrome.once('exit', done));
    chrome.kill();
    await exited;
  }
  // Chromium's helpers can still be writing to the profile as it exits.
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
