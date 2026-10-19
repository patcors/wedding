// The voyage's optional sound, on the page (see docs/VOYAGE.md, "Sound").
// Nothing plays until the guest taps, clicks or presses a key: the returned
// `unlock` must be called from such a gesture (the Review choice and the
// speaker button do), and a choice remembered from before waits for the
// first one anywhere on the page. It fades in once the scene is showing,
// fades out and suspends the audio when turned off, when the tab is hidden
// or when the guest pauses the scene, and closes it on leaving the page.
// The sounds themselves load only once it is turned on (soundPlayer.ts).
import { useCallback, useEffect, useRef, useState } from 'react';
import { stillProgress } from './journey';
import type { SoundMode } from './soundChoices';
import type { SoundPlayer } from './soundPlayer';

// Milliseconds between updates: enough to catch each touch's moment and the
// day's slow changes, at next to no cost.
const EVERY = 120;
// Seconds to fade in and out.
const FADE_IN = 2.5, FADE_OUT = .6;

export function useSoundscape({ mode, paused, reduced, ready, progress }: {
  mode: SoundMode; paused: boolean; reduced: boolean; ready: boolean; progress: () => number;
}) {
  const context = useRef<AudioContext | null>(null), player = useRef<SoundPlayer | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const unlock = useCallback(() => {
    if (!context.current) {
      const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return;
      context.current = new Context({ latencyHint: 'playback' });
    }
    const ctx = context.current;
    void ctx.resume().then(() => { if (ctx.state === 'running') setUnlocked(true); });
  }, []);
  // A remembered choice waits for the guest's first gesture.
  useEffect(() => {
    if (mode === 'off' || unlocked) return;
    const events = ['pointerdown', 'keydown', 'touchend'];
    events.forEach(event => addEventListener(event, unlock, { capture: true, passive: true }));
    return () => events.forEach(event => removeEventListener(event, unlock, { capture: true }));
  }, [mode, unlocked, unlock]);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const audible = mode !== 'off' && unlocked && ready && !paused && !hidden;
  useEffect(() => {
    const ctx = context.current;
    if (!ctx) return;
    let cancelled = false, interval: ReturnType<typeof setInterval> | undefined, timer: ReturnType<typeof setTimeout> | undefined;
    if (audible) {
      void (async () => {
        const { createSoundPlayer } = await import('./soundPlayer');
        if (cancelled) return;
        await ctx.resume();
        if (cancelled) return;
        player.current ??= createSoundPlayer(ctx);
        const sound = player.current;
        sound.resume();
        const tick = () => sound.update({ p: reduced ? stillProgress(progress()) : progress(), reduced, mode, now: performance.now() / 1000 });
        tick();
        sound.fade(1, FADE_IN);
        interval = setInterval(tick, EVERY);
      })();
    } else if (player.current) {
      player.current.fade(0, FADE_OUT);
      timer = setTimeout(() => void ctx.suspend(), FADE_OUT * 1000 + 100);
    } else void ctx.suspend();
    return () => { cancelled = true; clearInterval(interval); clearTimeout(timer); };
  }, [audible, mode, reduced, progress]);
  useEffect(() => () => { void context.current?.close(); }, []);
  return unlock;
}
