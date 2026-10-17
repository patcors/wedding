// One day over the Voyage, under a clear blue sky: soft dawn under the opening
// title, a bright light-blue morning by the time the boats meet, clear midday,
// a deeper blue afternoon, golden light round the bend and dusk at the dock.
// The light keeps moving the whole way: each stretch of the story is a little
// later in the day, and the sun swings across the sky so shadows turn as they
// lengthen. The Garden's old misty day stays for the Review panel (MIST_KEYS).
// GardenSky eases between these keyframes along progress. Pure, so it can be
// tested (tests/skyCycle.test.mjs).
import { ARRIVAL_END, DATES, ROOM, VOYAGE_END, progressAt } from './journey.ts';

// Colours are sRGB hex. `horizon` is the background, fog and bottom of the
// dome, `zenith` its top. `glow` is the wash behind the page's copy and `ink`
// the copy itself (see --garden-sky-glow and --garden-ink-on-sky).
// `sun` is the direction the sunlight comes from, at the old sun's distance.
// `waterLight` is the light on the river's own colour (a WaterStyle), so every
// water warms and dims with the day; `glint` is the sun's sparkle on it.
// `haze` runs from a clear day's fog (0) to the old mist's (1).
export type SkyKey = { horizon: string; zenith: string; glow: string; ink: string; hemiSky: string; hemiGround: string; hemi: number;
  sunColor: string; sunIntensity: number; sun: [number, number, number]; waterLight: [number, number, number]; glint: string; haze: number };

export type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as Rgb;
export const hex = (c: Rgb) => '#' + c.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');

// The river's colours for the Review panel, as each looks in clear midday
// light. Deep blue is Patrick's clear-day water and sage the old misty river.
export type WaterStyle = 'deep' | 'clear' | 'teal' | 'sage' | 'dark';
export const WATERS: Record<WaterStyle, { label: string; color: string }> = {
  deep: { label: 'Deep blue', color: '#1d4f8c' },
  clear: { label: 'Clear blue', color: '#4d86c4' },
  teal: { label: 'Teal', color: '#1c7a70' },
  sage: { label: 'Sage mist', color: '#b5bca6' },
  dark: { label: 'Dark mirror', color: '#050c14' },
};

// The sun `azimuth` degrees round from straight upstream (behind the camera,
// +z) towards the right bank (+x), `elevation` degrees up, at the old sun's distance.
const SUN_DISTANCE = Math.hypot(-18, 24, 9);
const sunAt = (azimuth: number, elevation: number): [number, number, number] => {
  const [a, e] = [azimuth * Math.PI / 180, elevation * Math.PI / 180];
  return [Math.sin(a) * Math.cos(e) * SUN_DISTANCE, Math.sin(e) * SUN_DISTANCE, Math.cos(a) * Math.cos(e) * SUN_DISTANCE];
};

// The sun rises low over the right bank behind the camera, so the first long
// shadows fall across the river; it is high and nearly behind the boats at
// midday, swings over the left bank through the afternoon and sinks ahead
// of them, so the shadows reach back across the water towards the jetty.
export const DAWN: SkyKey = { horizon: '#f3dccb', zenith: '#a9c3e2', glow: '#f6e9df', ink: '#33403f', hemiSky: '#eee5e6', hemiGround: '#9e9c88', hemi: 1.35,
  sunColor: '#ffd3b0', sunIntensity: 2.2, sun: sunAt(48, 16), waterLight: [1.08, .98, .96], glint: '#e8cdb8', haze: .55 };
export const MORNING: SkyKey = { horizon: '#c9def3', zenith: '#8db7e6', glow: '#e9f1fa', ink: '#2f3d45', hemiSky: '#dde9fb', hemiGround: '#94a172', hemi: 1.5,
  sunColor: '#fff1dc', sunIntensity: 2.8, sun: sunAt(26, 34), waterLight: [1.05, 1.06, 1.08], glint: '#dde6f2', haze: .2 };
export const MIDDAY: SkyKey = { horizon: '#b5d0ec', zenith: '#73a2db', glow: '#deeaf7', ink: '#2d3b46', hemiSky: '#d3e3fb', hemiGround: '#8d9a68', hemi: 1.45,
  sunColor: '#fff3df', sunIntensity: 3, sun: sunAt(-14, 56), waterLight: [1, 1, 1], glint: '#d6e2f2', haze: 0 };
export const AFTERNOON: SkyKey = { horizon: '#a3bfe0', zenith: '#5584c4', glow: '#d5e2f1', ink: '#2b3846', hemiSky: '#c8d9f5', hemiGround: '#8a9466', hemi: 1.38,
  sunColor: '#ffe9c8', sunIntensity: 2.95, sun: sunAt(-48, 42), waterLight: [.96, .95, .96], glint: '#e4dccf', haze: 0 };
export const LATE: SkyKey = { horizon: '#b4c1d6', zenith: '#4c76b5', glow: '#dde3ec', ink: '#2c3745', hemiSky: '#d2d6e8', hemiGround: '#8c9065', hemi: 1.32,
  sunColor: '#ffdcae', sunIntensity: 2.8, sun: sunAt(-74, 29), waterLight: [.97, .94, .92], glint: '#e6d2b6', haze: .08 };
export const GOLDEN: SkyKey = { horizon: '#eccfac', zenith: '#6a7fb3', glow: '#f3e5d3', ink: '#33393a', hemiSky: '#ecdcc9', hemiGround: '#928a6a', hemi: 1.3,
  sunColor: '#ffc78c', sunIntensity: 2.6, sun: sunAt(-94, 20), waterLight: [.98, .9, .84], glint: '#e8c494', haze: .3 };
// The old dusk, a touch deeper overhead so it follows the blue afternoon.
export const DUSK: SkyKey = { horizon: '#ebc9b2', zenith: '#9c9dbf', glow: '#f1dece', ink: '#313a2e', hemiSky: '#dccdd6', hemiGround: '#8d8a80', hemi: 1.15,
  sunColor: '#ffbf8f', sunIntensity: 1.8, sun: sunAt(-105, 15), waterLight: [.86, .74, .84], glint: '#ffcf9f', haze: .6 };

// A keyframe at most milestones' worth of scroll apart, so the light never
// stands still: dawn holds only while the title is up, it is morning by the
// meeting, midday by graduation, afternoon from the dating, late afternoon by
// the engagement, golden over the trip and the bend, and dusk at the dock.
const GOLDEN_AT = progressAt('2026-07') + ROOM;
export const SKY_KEYS: readonly (readonly [number, SkyKey])[] = [
  [0, DAWN], [ARRIVAL_END * .4, DAWN], [progressAt(DATES.meet), MORNING], [progressAt('2020-08'), MIDDAY],
  [progressAt(DATES.dating), AFTERNOON], [progressAt(DATES.engaged), LATE], [GOLDEN_AT, GOLDEN], [VOYAGE_END, DUSK], [1, DUSK],
];

// The Garden's old misty day, for comparison in the Review panel: soft dawn
// held under the title, misty daylight until the engagement, golden over the
// trip and dusk at the dock, always in the mist. Its water lights turn the
// sage river into exactly the old waters.
const SAGE = rgb(WATERS.sage.color);
const lightOn = (water: string) => rgb(water).map((v, i) => v / SAGE[i]) as [number, number, number];
export const MIST_DAWN: SkyKey = { horizon: '#f0e0d6', zenith: '#dcdfe5', glow: '#f3e9e1', ink: '#384135', hemiSky: '#f7eee8', hemiGround: '#aeb1a3', hemi: 1.55,
  sunColor: '#ffdcc4', sunIntensity: 1.7, sun: [17, 13, 20], waterLight: lightOn('#bab9ad'), glint: '#ffeee0', haze: 1 };
export const MIST_DAY: SkyKey = { horizon: '#eeeee5', zenith: '#eeeee5', glow: '#eeeee5', ink: '#384135', hemiSky: '#fffbee', hemiGround: '#b0b5a0', hemi: 1.7,
  sunColor: '#fff2d6', sunIntensity: 2.3, sun: [-18, 24, 9], waterLight: [1, 1, 1], glint: '#fff9e9', haze: 1 };
const MIST_GOLDEN: SkyKey = { horizon: '#efe4d2', zenith: '#e4e2dc', glow: '#f1e8d9', ink: '#384135', hemiSky: '#fff2df', hemiGround: '#afad98', hemi: 1.6,
  sunColor: '#ffe0b4', sunIntensity: 2.2, sun: [-25, 17, 1], waterLight: lightOn('#b6b7a0'), glint: '#fff0d4', haze: 1 };
const MIST_DUSK: SkyKey = { horizon: '#ebc9b2', zenith: '#a9a8c0', glow: '#f1dece', ink: '#313a2e', hemiSky: '#dccdd6', hemiGround: '#8d8a80', hemi: 1.15,
  sunColor: '#ffbf8f', sunIntensity: 1.8, sun: [-29, 8, -8], waterLight: lightOn('#9a98a8'), glint: '#ffcf9f', haze: 1 };
export const MIST_KEYS: readonly (readonly [number, SkyKey])[] = [
  [0, MIST_DAWN], [ARRIVAL_END * .6, MIST_DAWN], [progressAt('2017-11'), MIST_DAY],
  [progressAt(DATES.engaged), MIST_DAY], [GOLDEN_AT, MIST_GOLDEN], [VOYAGE_END, MIST_DUSK], [1, MIST_DUSK],
];

const COLOURS = ['horizon', 'zenith', 'glow', 'ink', 'hemiSky', 'hemiGround', 'sunColor', 'glint'] as const;
type ColourName = typeof COLOURS[number];
export type Sky = Record<ColourName, Rgb> & { hemi: number; sunIntensity: number; sun: Rgb; waterLight: Rgb; haze: number };
type Keys = readonly (readonly [number, SkyKey])[];
const parse = (keys: Keys) => keys.map(([p, key]) => [p, {
  ...Object.fromEntries(COLOURS.map(name => [name, rgb(key[name])])) as Record<ColourName, Rgb>,
  hemi: key.hemi, sunIntensity: key.sunIntensity, sun: key.sun, waterLight: key.waterLight, haze: key.haze,
}] as const);
const PARSED = new Map<Keys, ReturnType<typeof parse>>([[SKY_KEYS, parse(SKY_KEYS)], [MIST_KEYS, parse(MIST_KEYS)]]);

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// The sky at progress p. Straight between keyframes, so the light keeps
// moving through each one rather than settling on it. The sun's direction is
// mixed then put back at the old sun's distance.
export function skyAt(p: number, keys: Keys = SKY_KEYS): Sky {
  const parsed = PARSED.get(keys) ?? parse(keys);
  let i = 1;
  while (i < parsed.length - 1 && p > parsed[i][0]) i++;
  const [pa, a] = parsed[i - 1], [pb, b] = parsed[i];
  const t = Math.min(1, Math.max(0, (p - pa) / (pb - pa)));
  const sun = mix(a.sun, b.sun, t), scale = SUN_DISTANCE / Math.hypot(...sun);
  return {
    ...Object.fromEntries(COLOURS.map(name => [name, mix(a[name], b[name], t)])) as Record<ColourName, Rgb>,
    hemi: lerp(a.hemi, b.hemi, t), sunIntensity: lerp(a.sunIntensity, b.sunIntensity, t), haze: lerp(a.haze, b.haze, t),
    sun: sun.map(v => v * scale) as Rgb, waterLight: mix(a.waterLight, b.waterLight, t),
  };
}

// A river's colour in the sky's light.
export const waterIn = (sky: Sky, water: WaterStyle): Rgb => rgb(WATERS[water].color).map((v, i) => v * sky.waterLight[i]) as Rgb;

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
// How far the golden light has turned to dusk at p.
export const duskAt = (p: number) => smooth((p - GOLDEN_AT) / (VOYAGE_END - GOLDEN_AT));
// The festoons and the jetty's lantern come on through the second half of the
// dusk, so they glow as the old tree comes round the bend and are fully lit
// before the dock.
export const lampsAt = (p: number) => smooth((duskAt(p) - .35) / .65);

// WCAG contrast ratio between two sRGB colours.
export function contrast(a: Rgb, b: Rgb) {
  const luminance = (c: Rgb) => {
    const [r, g, bl] = c.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return .2126 * r + .7152 * g + .0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + .05) / (lo + .05);
}
