// How the Garden loads (see docs/VOYAGE.md). Guests download lighter copies
// of the scene's textures (scripts/lighten-garden-textures.mjs), half size
// on phones, and the scene is prepared as soon as it has downloaded, while
// the opening butterflies fly in, but fades in only once they have landed on
// the names, or as soon as it is ready if they landed first. The Review
// panel can switch either back to compare: preparing early and fading in at
// once, or preparing only after the butterflies land, as before. Each takes
// effect on reload. No imports, so the page can read these without pulling in three.

export type TextureWeight = 'light' | 'original';
export type PrepareWhen = 'early' | 'downloaded' | 'butterflies';
export const TEXTURE_WEIGHTS: Record<TextureWeight, string> = { light: 'Light', original: 'Original' };
export const PREPARE_WHEN: Record<PrepareWhen, string> = { early: 'Early, then wait', downloaded: 'Early', butterflies: 'After butterflies' };

// Dev only: the Review choices, remembered across reloads.
export const REVIEW_TEXTURES = 'pa_dev_textures', REVIEW_PREPARE = 'pa_dev_prepare';
export const textureWeight = (stored: string | null): TextureWeight => stored === 'original' ? 'original' : 'light';
export const prepareWhen = (stored: string | null): PrepareWhen => stored === 'butterflies' || stored === 'downloaded' ? stored : 'early';

const stored = (key: string) => import.meta.env?.DEV && typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
export const TEXTURE_WEIGHT = textureWeight(stored(REVIEW_TEXTURES));
export const PREPARE = prepareWhen(stored(REVIEW_PREPARE));

// A phone by its screen, not its window, so a narrow desktop window still gets the full maps.
export const PHONE_SCREEN = typeof screen !== 'undefined' && Math.min(screen.width, screen.height) < 600;

// Where a texture downloads from: a scene map under models/garden or
// textures/garden has its light copy under light/, or light-phone/ on a
// phone, at the same path. Anything else is left as it is.
export function textureUrl(url: string, base: string, weight: TextureWeight, phone: boolean) {
  if (weight === 'original' || !url.startsWith(base)) return url;
  const path = url.slice(base.length);
  if (!/^(models|textures)\/garden\/.+\.(webp|jpg)$/.test(path)) return url;
  return `${base}${phone ? 'light-phone' : 'light'}/${path}`;
}
