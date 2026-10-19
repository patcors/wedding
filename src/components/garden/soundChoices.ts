// Optional sound for the voyage, off by default (see docs/VOYAGE.md, "Sound").
// While developing, the Review panel's "Sound" choice turns it on; guests get
// a small speaker button only once GUEST_SOUND is set. Either way nothing
// plays until the guest taps, clicks or presses a key, as browsers require.
// No imports, so the page can read these without loading the sound itself.

export const SOUND_MODES = { off: 'Off', ambience: 'Ambience', chimes: 'With chimes' } as const;
export type SoundMode = keyof typeof SOUND_MODES;

// Dev only: the Review choice, remembered across reloads.
export const REVIEW_SOUND = 'pa_dev_sound';
export const soundMode = (stored: string | null): SoundMode =>
  stored !== null && Object.hasOwn(SOUND_MODES, stored) ? stored as SoundMode : 'off';

// Whether guests see the speaker button (Amelia to decide), and what it
// turns on. Off for now: guests hear nothing and see no button.
export const GUEST_SOUND = false;
export const GUEST_SOUND_MODE: SoundMode = 'chimes';
