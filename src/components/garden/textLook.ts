// Dev only (the Review panel): how the Garden's copy over the scene is set,
// to choose what replaces the glow round it. Guests see the glow until Amelia
// picks; the styles are in gardenReview.css. Pure, so it can be tested.
import { GOLDEN, LATE, SKY_KEYS, type SkyKey } from './skyCycle.ts';

export const TEXT_LOOKS = { glow: 'Glow', white: 'White', shadow: 'White, soft shadow', ink: 'Ink', scrim: 'White over a scrim' } as const;
export type TextLook = keyof typeof TEXT_LOOKS;

// A remembered choice, or the glow for anything else.
export const textLook = (stored: string | null): TextLook =>
  stored !== null && Object.hasOwn(TEXT_LOOKS, stored) ? stored as TextLook : 'glow';

// Ink keeps the sky's dark ink until the late afternoon is halfway to golden
// (between the sky's LATE and GOLDEN keys, which falls as the trip's date
// shows): from there to the dock the trees close over the river and the copy
// sits over their shade, so it turns white with the soft shadow.
const keyAt = (key: SkyKey) => SKY_KEYS.find(([, k]) => k === key)![0];
export const INK_TURNS_WHITE = (keyAt(LATE) + keyAt(GOLDEN)) / 2;
export const inkTurnsWhite = (p: number) => p >= INK_TURNS_WHITE;
