// One day over the Voyage: soft dawn under the opening title, the Garden's
// misty daylight through the middle, golden light round the last stretch and
// dusk at the dock. GardenSky eases between these keyframes along progress.
// Pure, so it can be tested (tests/skyCycle.test.mjs).
import { ARRIVAL_END, DATES, ROOM, VOYAGE_END, progressAt } from './journey.ts';

// Colours are sRGB hex. `horizon` is the background, fog and bottom of the
// dome, `zenith` its top. `glow` is the pale wash behind the page's copy and
// `ink` the copy itself (see --garden-sky-glow and --garden-ink-on-sky).
// `sun` is the direction the sunlight comes from, at the old sun's distance.
export type SkyKey = { horizon: string; zenith: string; glow: string; ink: string; hemiSky: string; hemiGround: string; hemi: number;
  sunColor: string; sunIntensity: number; sun: [number, number, number]; water: string; glint: string };

// Low from the far bank at dawn, over the near bank at dusk, so long shadows
// fall across the river towards the jetty.
export const DAWN: SkyKey = { horizon: '#f0e0d6', zenith: '#dcdfe5', glow: '#f3e9e1', ink: '#384135', hemiSky: '#f7eee8', hemiGround: '#aeb1a3', hemi: 1.55,
  sunColor: '#ffdcc4', sunIntensity: 1.7, sun: [17, 13, 20], water: '#bab9ad', glint: '#ffeee0' };
// The Garden's misty daylight, exactly as it was before the day cycle.
export const DAY: SkyKey = { horizon: '#eeeee5', zenith: '#eeeee5', glow: '#eeeee5', ink: '#384135', hemiSky: '#fffbee', hemiGround: '#b0b5a0', hemi: 1.7,
  sunColor: '#fff2d6', sunIntensity: 2.3, sun: [-18, 24, 9], water: '#b5bca6', glint: '#fff9e9' };
export const GOLDEN: SkyKey = { horizon: '#efe4d2', zenith: '#e4e2dc', glow: '#f1e8d9', ink: '#384135', hemiSky: '#fff2df', hemiGround: '#afad98', hemi: 1.6,
  sunColor: '#ffe0b4', sunIntensity: 2.2, sun: [-25, 17, 1], water: '#b6b7a0', glint: '#fff0d4' };
export const DUSK: SkyKey = { horizon: '#ebc9b2', zenith: '#a9a8c0', glow: '#f1dece', ink: '#313a2e', hemiSky: '#dccdd6', hemiGround: '#8d8a80', hemi: 1.15,
  sunColor: '#ffbf8f', sunIntensity: 1.8, sun: [-29, 8, -8], water: '#9a98a8', glint: '#ffcf9f' };

// Dawn holds while the title is up and lifts as the boats meet; the day holds
// until the engagement, turns golden over the trip and the bend, and is dusk
// by the time the dock comes into view.
export const SKY_KEYS: readonly (readonly [number, SkyKey])[] = [
  [0, DAWN], [ARRIVAL_END * .6, DAWN], [progressAt('2017-11'), DAY],
  [progressAt(DATES.engaged), DAY], [progressAt('2026-07') + ROOM, GOLDEN], [VOYAGE_END, DUSK], [1, DUSK],
];

export type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as Rgb;
export const hex = (c: Rgb) => '#' + c.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
const COLOURS = ['horizon', 'zenith', 'glow', 'ink', 'hemiSky', 'hemiGround', 'sunColor', 'water', 'glint'] as const;
type ColourName = typeof COLOURS[number];
export type Sky = Record<ColourName, Rgb> & { hemi: number; sunIntensity: number; sun: Rgb };
const KEYS = SKY_KEYS.map(([p, key]) => [p, {
  ...Object.fromEntries(COLOURS.map(name => [name, rgb(key[name])])) as Record<ColourName, Rgb>,
  hemi: key.hemi, sunIntensity: key.sunIntensity, sun: key.sun,
}] as const);

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// The sky at progress p, eased in and out of each keyframe. The sun's
// direction is mixed then put back at the old sun's distance.
export function skyAt(p: number): Sky {
  let i = 1;
  while (i < KEYS.length - 1 && p > KEYS[i][0]) i++;
  const [pa, a] = KEYS[i - 1], [pb, b] = KEYS[i];
  const x = Math.min(1, Math.max(0, (p - pa) / (pb - pa))), t = x * x * (3 - 2 * x);
  const sun = mix(a.sun, b.sun, t), scale = Math.hypot(...DAY.sun) / Math.hypot(...sun);
  return {
    ...Object.fromEntries(COLOURS.map(name => [name, mix(a[name], b[name], t)])) as Record<ColourName, Rgb>,
    hemi: a.hemi + (b.hemi - a.hemi) * t, sunIntensity: a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t,
    sun: sun.map(v => v * scale) as Rgb,
  };
}

// WCAG contrast ratio between two sRGB colours.
export function contrast(a: Rgb, b: Rgb) {
  const luminance = (c: Rgb) => {
    const [r, g, bl] = c.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return .2126 * r + .7152 * g + .0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + .05) / (lo + .05);
}
