// The voyage's sounds, all made here with the Web Audio API: no audio files
// to download. Works on a live AudioContext or an OfflineAudioContext, so the
// same code renders the samples (scripts/render-voyage-sound.mjs).
//
// - The river: a soft bed of pink noise under a brook of tiny bubbles (each a
//   rising, quickly fading tone, after van den Doel's model of bubbles),
//   built once into an 8 second loop.
// - Distant birds: short modelled calls (a falling two-note whistle, a trill,
//   a thin seep, a warble, a rising whistle), each a single tone swept
//   through its notes, sung in little bouts from somewhere in the trees.
// - The chimes: a soft additive bell, mostly its fundamental.
// - The touches: a whoosh for the rocket, a balloon's burner, the Church St
//   birds' calls, and a quiet warm chord under the festoons at dusk.
//
// Everything runs through a soft limiter, and the master level is kept low. Levels were checked on rendered samples
// (docs/VOYAGE.md, "Sound").
import type { Ambience, Cue } from './soundscape';
import type { SoundMode } from './soundChoices';

export const LEVELS = {
  master: .5,
  // The river's noise bed and its bubbles.
  rush: .42, brook: .5,
  birds: .065, chime: .2, warmth: .028,
  rocket: .45, burner: .45, call: .21,
  reverb: .55,
} as const;

// A small seeded random generator (mulberry32), so a render can be repeated.
export function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = s + 0x6d2b79f5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Buffers are made at a low rate where nothing above 10kHz matters; the
// context resamples them as they play.
const LOW_RATE = 22050;
const rms = (data: Float32Array) => Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
const scaleTo = (channels: Float32Array[], target: number) => {
  const k = target / Math.max(1e-9, Math.max(...channels.map(rms)));
  channels.forEach(data => { for (let i = 0; i < data.length; i++) data[i] *= k; });
};

// Pink noise (Paul Kellet's filter), which loops without a seam you can hear.
function pinkNoise(ctx: BaseAudioContext, random: () => number, seconds: number) {
  const buffer = ctx.createBuffer(1, seconds * LOW_RATE, LOW_RATE), data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < data.length; i++) {
    const w = random() * 2 - 1;
    b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852;
    b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898;
    data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362;
    b6 = w * .115926;
  }
  scaleTo([data], .15);
  return buffer;
}

// White noise for the whoosh and the burner.
function whiteNoise(ctx: BaseAudioContext, random: () => number, seconds: number) {
  const buffer = ctx.createBuffer(1, seconds * LOW_RATE, LOW_RATE), data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (random() * 2 - 1) * .5;
  return buffer;
}

// The brook: `rate` bubbles a second, each a tone rising a little as it
// fades, low ones louder, spread across the stereo field. Written round the
// loop's end, so it loops seamlessly.
function brook(ctx: BaseAudioContext, random: () => number, seconds = 8, rate = 38) {
  const n = seconds * LOW_RATE, buffer = ctx.createBuffer(2, n, LOW_RATE);
  const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
  for (let k = 0; k < seconds * rate; k++) {
    const start = Math.floor(random() * n);
    const f0 = 260 * 2 ** (random() * 2.5);
    const amp = (.25 + .75 * random() ** 2) * Math.sqrt(400 / f0);
    // Decay (per second) and length from the bubble's size.
    const decay = .043 * f0 + .0014 * f0 ** 1.5, length = Math.min(.3, 6 / decay) * LOW_RATE;
    const pan = .15 + .7 * random(), gl = Math.cos(pan * Math.PI / 2), gr = Math.sin(pan * Math.PI / 2);
    let phase = random() * Math.PI * 2;
    for (let j = 0; j < length; j++) {
      const t = j / LOW_RATE;
      phase += 2 * Math.PI * f0 * (1 + .1 * decay * t) / LOW_RATE;
      const v = amp * Math.sin(phase) * Math.exp(-decay * t) * Math.min(1, j / (.003 * LOW_RATE));
      const i = (start + j) % n;
      left[i] += v * gl; right[i] += v * gr;
    }
  }
  // The odd big bubble is rounded off, so the brook murmurs rather than plops.
  const ceiling = 4 * Math.max(rms(left), rms(right));
  [left, right].forEach(data => { for (let i = 0; i < n; i++) data[i] = ceiling * Math.tanh(data[i] / ceiling); });
  scaleTo([left, right], .1);
  return buffer;
}

// A small room's tail for the birds, chimes and touches: decaying noise,
// darkening as it fades. At the context's rate, as a convolver needs.
function tail(ctx: BaseAudioContext, random: () => number, seconds = 1.4) {
  const n = Math.floor(seconds * ctx.sampleRate), buffer = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let y = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      y += (.6 - .5 * t) * ((random() * 2 - 1) - y);
      data[i] = y * Math.exp(-t * 5.5) * Math.min(1, i / (.01 * ctx.sampleRate));
    }
  }
  return buffer;
}

// A bird call: one tone swept through its notes. `freq` and `gain` give its
// shape at each point from 0 to 1 over `length` seconds.
type Call = { length: number; freq: (t: number) => number; gain: (t: number) => number };
const hump = (t: number, from: number, to: number) => t < from || t > to ? 0 : Math.sin(Math.PI * (t - from) / (to - from)) ** 2;
export const SONGS: Record<string, Call> = {
  // A falling two-note whistle, tee-oo.
  teeoo: { length: .45, freq: t => t < .45 ? 3600 - 700 * t : 2950 - 800 * (t - .55), gain: t => hump(t, 0, .42) + .8 * hump(t, .55, 1) },
  // A quick trill of nine notes, each flicking up, the run falling a little.
  trill: { length: .62, freq: t => 4300 - 400 * t + 350 * ((t * 9) % 1), gain: t => hump((t * 9) % 1, .1, .9) * hump(t, -.1, 1.05) },
  // A thin high seep, falling.
  seep: { length: .3, freq: t => 6100 - 900 * t, gain: t => hump(t, 0, 1) },
  // A warble round a rising note.
  warble: { length: .8, freq: t => 2600 + 300 * t + 420 * Math.sin(2 * Math.PI * 9 * t * .8), gain: t => hump(t, 0, 1) * (.75 + .25 * Math.sin(2 * Math.PI * 7 * t)) },
  // A rising whistle, tu-wee.
  tuwee: { length: .5, freq: t => t < .42 ? 2250 : 3050 + 400 * (t - .5), gain: t => .8 * hump(t, 0, .4) + hump(t, .5, 1) },
};
// The Church St birds, nearer and clearer: hers bright, his a little lower.
const CALLS: Record<string, Call> = {
  amelia: { length: .36, freq: t => t < .4 ? 3500 + 300 * t : 4150 - 250 * (t - .5), gain: t => .85 * hump(t, 0, .38) + hump(t, .48, 1) },
  patrick: { length: .42, freq: t => t < .4 ? 2650 : 3250 + 500 * (t - .5), gain: t => .85 * hump(t, 0, .36) + hump(t, .5, 1) },
};
const curve = (fn: (t: number) => number, scale = 1, points = 96) => Float32Array.from({ length: points }, (_, i) => fn(i / (points - 1)) * scale);

export type SoundEngine = ReturnType<typeof createSoundEngine>;
export function createSoundEngine(ctx: BaseAudioContext, seed = 1) {
  const random = seeded(seed);
  const gain = (value: number, to?: AudioNode) => { const node = new GainNode(ctx, { gain: value }); if (to) node.connect(to); return node; };
  const filter = (type: BiquadFilterType, frequency: number, to: AudioNode, Q = .7) => { const node = new BiquadFilterNode(ctx, { type, frequency, Q }); node.connect(to); return node; };

  // The master: a soft limiter, then the fade in and out. The mix sits well
  // under its threshold, so it only catches the odd peak; with the makeup
  // gain every compressor adds (about 6.6dB here), nothing leaves louder
  // than about −4.5 dBFS.
  const fader = gain(0, ctx.destination);
  const limiter = new DynamicsCompressorNode(ctx, { threshold: -12, knee: 6, ratio: 12, attack: .003, release: .25 });
  limiter.connect(fader);
  const master = gain(LEVELS.master, limiter);
  const room = new ConvolverNode(ctx, { buffer: tail(ctx, random) });
  room.connect(gain(LEVELS.reverb, master));
  const send = (from: AudioNode, amount: number) => from.connect(gain(amount, room));

  // The river.
  const water = gain(0, master);
  const rush = gain(LEVELS.rush, water), rushTone = filter('lowpass', 600, filter('highpass', 70, rush));
  const brookGain = gain(LEVELS.brook, water), brookTone = filter('lowpass', 2500, brookGain);
  const loop = (buffer: AudioBuffer, to: AudioNode) => {
    const source = new AudioBufferSourceNode(ctx, { buffer, loop: true });
    source.connect(to);
    source.start(0, random() * buffer.duration);
  };
  loop(pinkNoise(ctx, random, 6), rushTone);
  loop(brook(ctx, random), brookTone);
  // Slow swells, so the water breathes rather than hisses.
  const swell = (to: AudioParam, rate: number, depth: number) => {
    const lfo = new OscillatorNode(ctx, { frequency: rate });
    lfo.connect(gain(depth)).connect(to);
    lfo.start(0);
  };
  swell(rush.gain, .07, LEVELS.rush * .2);
  swell(brookGain.gain, .11, LEVELS.brook * .25);

  // Distant birds, softened and set back in the room.
  const birds = gain(0, master);
  const birdTone = filter('lowpass', 6000, birds);
  const birdBus = filter('highpass', 1400, birdTone);
  send(birdTone, .7);

  // The chimes.
  const chimes = gain(LEVELS.chime, master);
  const chimeBus = filter('lowpass', 5000, chimes);
  send(chimes, .5);

  // The festoons' warmth: a quiet D major chord, breathing slowly.
  const warmth = gain(0, master);
  const warmBus = filter('lowpass', 1100, warmth);
  send(warmth, .3);
  [[146.83, .5], [220, .45], [369.99, .3], [440.6, .12]].forEach(([frequency, level]) => {
    const tone = new OscillatorNode(ctx, { frequency });
    tone.connect(gain(level, warmBus));
    tone.start(0);
  });

  // The touches.
  const touches = gain(1, master);
  send(touches, .3);
  const noise = whiteNoise(ctx, random, 3);

  const pan = (value: number, to: AudioNode) => { const node = new StereoPannerNode(ctx, { pan: value }); node.connect(to); return node; };
  const playCall = (call: Call, at: number, level: number, place: number, to: AudioNode, pitch = 1) => {
    const tone = new OscillatorNode(ctx, { frequency: call.freq(0) * pitch }), envelope = gain(0, pan(place, to));
    tone.connect(envelope);
    tone.frequency.setValueCurveAtTime(curve(call.freq, pitch), at, call.length);
    envelope.gain.setValueCurveAtTime(curve(call.gain, level), at, call.length);
    tone.start(at); tone.stop(at + call.length + .05);
  };
  const noiseBurst = (at: number, length: number) => {
    const source = new AudioBufferSourceNode(ctx, { buffer: noise, loop: true });
    source.start(at, random() * 2); source.stop(at + length);
    return source;
  };

  // Birdsong is planned in half-second slots: each may start a bout, one
  // bird singing its song two to four times from one place in the trees.
  let plannedTo = 0;
  const songs = Object.values(SONGS);
  const birdsong = (from: number, to: number, rate: number) => {
    let slot = Math.max(from, plannedTo);
    for (; slot < to; slot += .5) {
      if (random() >= rate * .11) continue;
      const song = songs[Math.floor(random() * songs.length)], place = random() * 1.6 - .8;
      const near = .35 + .65 * random(), pitch = .92 + .16 * random();
      let at = slot + random() * .5;
      for (let i = 2 + Math.floor(random() * 3); i > 0; i--) {
        playCall(song, at, near * (.85 + .15 * random()), place, birdBus, pitch);
        at += song.length + 1.2 + random() * 1.8;
      }
    }
    plannedTo = slot;
  };

  const chime = (notes: readonly number[], at: number) => notes.forEach((frequency, n) => {
    const start = at + n * .16, level = n ? .7 : 1, voice = pan((random() - .5) * .3, chimeBus);
    // The partials: the fundamental rings longest; the octave, twelfth and a
    // faint shimmer above fade sooner.
    [[1, 1, 2.6], [2, .2, 1.3], [3, .06, .7], [4.16, .025, .4]].forEach(([ratio, share, ring]) => {
      const tone = new OscillatorNode(ctx, { frequency: frequency * ratio }), envelope = gain(0, voice);
      tone.connect(envelope);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(level * share, start + .02);
      envelope.gain.setTargetAtTime(0, start + .02, ring / 4.6);
      tone.start(start); tone.stop(start + ring * 1.5);
    });
  });

  const rocket = (at: number, place: number) => {
    // A low hiss as it ignites, then a rising whoosh as it climbs away down
    // the river, closing as it goes into the haze.
    const length = 5, source = noiseBurst(at, length);
    const band = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 250, Q: .9 }), envelope = gain(0);
    const where = pan(place, touches);
    source.connect(band).connect(filter('lowpass', 2600, envelope));
    envelope.connect(where);
    band.frequency.setValueAtTime(250, at);
    band.frequency.linearRampToValueAtTime(420, at + .5);
    band.frequency.exponentialRampToValueAtTime(1500, at + 1.1);
    band.frequency.exponentialRampToValueAtTime(550, at + 4.2);
    const g = envelope.gain;
    g.setValueAtTime(0, at);
    g.linearRampToValueAtTime(LEVELS.rocket * .3, at + .35);
    g.linearRampToValueAtTime(LEVELS.rocket, at + 1);
    g.setTargetAtTime(0, at + 1, .8);
    where.pan.setValueAtTime(place, at + .5);
    where.pan.linearRampToValueAtTime(place * .2, at + 4);
  };

  const burner = (at: number, place: number) => {
    // A balloon's burner: a soft roar with a flutter, brighter than the
    // river so it isn't lost in it, then another further off.
    [[0, 1, 2400, place], [1.7, .4, 1400, place * 1.5]].forEach(([delay, share, tone, where]) => {
      const start = at + delay, length = 1.3, source = noiseBurst(start, length + .8), envelope = gain(0, pan(Math.max(-1, where), touches));
      source.connect(new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 900, Q: .5 })).connect(filter('lowpass', tone, envelope));
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.setTargetAtTime(LEVELS.burner * share, start, .08);
      envelope.gain.setValueCurveAtTime(curve(t => 1 + .12 * Math.sin(t * 37) * Math.sin(t * 11 + 1), LEVELS.burner * share, 64), start + .3, length - .3);
      envelope.gain.setTargetAtTime(0, start + length + .001, .15);
    });
  };

  const bird = (cue: Cue, at: number) => {
    // A call as it takes off, and a shorter one as it lands.
    const call = CALLS[cue.owner ?? 'amelia'];
    playCall(call, at, LEVELS.call, cue.pan, touches);
    playCall({ ...call, length: call.length * .7 }, at + 1.45, LEVELS.call * .7, cue.to ?? cue.pan, touches, 1.04);
  };

  const touch = (cue: Cue, at: number) => {
    const start = at + (cue.delay ?? 0);
    if (cue.kind === 'rocket') rocket(start, cue.pan);
    else if (cue.kind === 'burner') burner(start, cue.pan);
    else bird(cue, start);
  };

  // The continuous layers follow the scene: set straight away, or eased
  // over about a second.
  let last = '';
  const scene = (ambience: Ambience, mode: SoundMode, at: number, immediate = false) => {
    const on = mode === 'off' ? 0 : 1;
    const values: [AudioParam, number][] = [
      [water.gain, on * ambience.level * ambience.water],
      [rushTone.frequency, 380 + 700 * ambience.waterTone],
      [brookTone.frequency, 1500 + 2500 * ambience.waterTone],
      [birds.gain, on * ambience.level * LEVELS.birds],
      [birdTone.frequency, 3800 + 3600 * ambience.birdTone],
      [warmth.gain, mode === 'chimes' ? ambience.warmth * LEVELS.warmth : 0],
    ];
    const key = values.map(([, v]) => v.toFixed(4)).join();
    if (key === last && !immediate) return;
    last = key;
    values.forEach(([param, value]) => {
      if (immediate) param.setValueAtTime(value, at);
      else param.setTargetAtTime(value, at, .35);
    });
  };

  // Fades the whole mix to `to` over `seconds`.
  const fade = (to: number, seconds: number, at = ctx.currentTime) => {
    const g = fader.gain;
    // Held where it is now, mid-fade or not, and on from there.
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(at);
    else { g.cancelScheduledValues(at); g.setValueAtTime(g.value, at); }
    g.linearRampToValueAtTime(to, at + seconds);
  };

  return { scene, birdsong, chime, touch, fade };
}
