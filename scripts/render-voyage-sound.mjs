// Renders the voyage's sounds (src/components/garden/soundEngine.ts) to WAV
// files, so they can be listened to without scrolling the Garden, and prints
// each file's peak and RMS levels. The engine runs in an OfflineAudioContext
// in headless Chromium, loaded from the dev server, so these are exactly the
// sounds the page makes.
//
//   corepack pnpm astro dev --port 4357 --host 127.0.0.1   (in another shell)
//   node scripts/render-voyage-sound.mjs http://127.0.0.1:4357/ /tmp/voyage-sound
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [base = 'http://127.0.0.1:4357/', out = 'voyage-sound'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const profile = mkdtempSync('/tmp/voyage-sound-chrome-');
const port = 9800 + Math.floor(Math.random() * 150);
const chrome = spawn('/usr/bin/chromium', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch {}
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => ws.onopen = resolve);
  let id = 0;
  const pending = new Map();
  ws.onmessage = message => { const data = JSON.parse(message.data); if (data.id) { pending.get(data.id)?.(data); pending.delete(data.id); } };
  const send = (method, params = {}) => new Promise(resolve => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable');
  // Any page from the dev server will do; the logo is the lightest.
  await send('Page.navigate', { url: new URL('logo.png', base).href });
  await sleep(1500);

  // Runs in the page: renders one sample, returns it as 16-bit PCM and its levels.
  const render = async ({ name, seconds, scene }) => {
    const [{ createSoundEngine }, sound, journey] = await Promise.all([
      import('/src/components/garden/soundEngine.ts'), import('/src/components/garden/soundscape.ts'), import('/src/components/garden/journey.ts'),
    ]);
    const rate = 48000, ctx = new OfflineAudioContext(2, seconds * rate, rate);
    const engine = createSoundEngine(ctx, 7);
    const cue = id => sound.CUES.find(c => c.id === id);
    const alone = ambience => ({ ...ambience, level: 0 });
    // Fades in and out like the page (2.5s in, a gentler 2s out at the end).
    engine.fade(1, 2.5, 0);
    engine.fade(0, 2, seconds - 2);
    const steady = (p, mode, quiet = false) => {
      const ambience = sound.ambienceAt(p);
      engine.scene(quiet ? alone(ambience) : ambience, mode, 0, true);
      if (!quiet && mode !== 'off') engine.birdsong(0, seconds - 2, ambience.birds);
    };
    const chimeAt = (ids, from, every) => ids.forEach((id, i) => engine.chime(sound.chimeNotes(id), from + i * every));
    const scenes = {
      morning: () => steady(journey.progressAt(journey.DATES.meet), 'ambience'),
      midday: () => steady(journey.progressAt('2020-08'), 'ambience'),
      dusk: () => steady(1, 'ambience'),
      chimes: quiet => { steady(journey.progressAt('2021-02'), 'chimes', quiet); chimeAt(['graduation', 'sydney', 'interim'], 2, 4); },
      rocket: quiet => { steady(cue('rocket').at, 'chimes', quiet); engine.touch(cue('rocket'), 1.5); },
      burner: quiet => { steady(cue('burner').at, 'chimes', quiet); engine.touch(cue('burner'), 1); },
      birds: quiet => {
        steady(journey.progressAt('2024-05'), 'chimes', quiet);
        const birds = sound.CUES.filter(c => c.kind === 'bird');
        engine.touch(birds[0], 1); engine.touch(birds[1], 1);
        engine.touch(birds[2], 5.5); engine.touch(birds[3], 10);
      },
      // The golden light turning to dusk at the dock over the length of the
      // sample, the festoons' warmth coming up with their lights.
      festoons: quiet => {
        const from = sound.AMBIENCE_KEYS.at(-3)[0];
        for (let t = 0; t < seconds; t += .25) {
          const ambience = sound.ambienceAt(from + (1 - from) * Math.min(1, t / (seconds - 6)));
          engine.scene(quiet ? alone(ambience) : ambience, 'chimes', t, t === 0);
          if (!quiet) engine.birdsong(t, t + .25, ambience.birds);
        }
      },
    };
    const [kind, quiet] = scene.split(':');
    scenes[kind](quiet === 'alone');
    const started = performance.now();
    const buffer = await ctx.startRendering();
    const renderMs = performance.now() - started;
    const channels = [buffer.getChannelData(0), buffer.getChannelData(1)];
    let peak = 0, sum = 0, clipped = 0, loudest = 0;
    const window = rate, windowSums = new Float64Array(Math.ceil(buffer.length / window));
    channels.forEach(data => data.forEach((v, i) => {
      const a = Math.abs(v);
      if (a > peak) peak = a;
      if (a >= 1) clipped++;
      sum += v * v; windowSums[Math.floor(i / window)] += v * v;
    }));
    windowSums.forEach(s => { loudest = Math.max(loudest, Math.sqrt(s / (2 * window))); });
    const pcm = new Int16Array(buffer.length * 2);
    for (let i = 0; i < buffer.length; i++) for (let c = 0; c < 2; c++) pcm[i * 2 + c] = Math.max(-32768, Math.min(32767, Math.round(channels[c][i] * 32767)));
    const bytes = new Uint8Array(pcm.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const db = v => 20 * Math.log10(Math.max(v, 1e-10));
    return { name, rate, data: btoa(binary), peak: db(peak), rms: db(Math.sqrt(sum / (2 * buffer.length))), loudest: db(loudest), clipped, realtime: seconds * 1000 / renderMs };
  };

  const samples = [
    ['ambience-morning', 30, 'morning'], ['ambience-midday', 30, 'midday'], ['ambience-dusk', 30, 'dusk'],
    ['chimes-three-milestones', 14, 'chimes'], ['chimes-three-milestones-alone', 14, 'chimes:alone'],
    ['touch-rocket-whoosh', 9, 'rocket'], ['touch-rocket-whoosh-alone', 9, 'rocket:alone'],
    ['touch-balloon-burner', 7, 'burner'], ['touch-balloon-burner-alone', 7, 'burner:alone'],
    ['touch-church-st-birds', 14, 'birds'], ['touch-church-st-birds-alone', 14, 'birds:alone'],
    ['touch-festoon-warmth', 30, 'festoons'], ['touch-festoon-warmth-alone', 30, 'festoons:alone'],
  ];
  const wav = (pcm, rate) => {
    const header = Buffer.alloc(44);
    header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
    header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22);
    header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
    header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([header, pcm]);
  };
  console.log('file'.padEnd(34), 'peak dBFS', ' RMS dBFS', 'loudest 1s', 'clipped', 'x realtime');
  for (const [name, seconds, scene] of samples) {
    const reply = await send('Runtime.evaluate', { expression: `(${render})(${JSON.stringify({ name, seconds, scene })})`, awaitPromise: true, returnByValue: true });
    if (reply.result?.exceptionDetails || reply.error) throw new Error(JSON.stringify(reply.result?.exceptionDetails ?? reply.error));
    const r = reply.result.result.value;
    writeFileSync(join(out, `${name}.wav`), wav(Buffer.from(r.data, 'base64'), r.rate));
    console.log(`${name}.wav`.padEnd(34), r.peak.toFixed(1).padStart(9), r.rms.toFixed(1).padStart(9), r.loudest.toFixed(1).padStart(10), String(r.clipped).padStart(7), r.realtime.toFixed(0).padStart(10));
  }
  ws.close();
} finally {
  chrome.kill();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true });
}
