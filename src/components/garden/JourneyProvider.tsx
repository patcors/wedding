import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { stillProgress } from './journey';
import { advancePace, type Pace } from './journeyPace';

// The progress the scene shows: the scroll, eased so the camera glides after
// it, at no more than the story's pace allows (journeyPace.ts). The page owns
// `pace`, so its date and copy show the same progress. Everything that moves with the story reads `progress` in its frame loop,
// so boats, sky and eggs stay in step with the camera rather than the raw
// scroll. It is mutated each frame, never React state, so reading it doesn't
// re-render anything.
// `lift` is how far up the finale's flight the camera is (VoyageCamera), 0 to 1.
export type JourneyClock = { progress: number; scroll: number; lift: number };
const JourneyContext = createContext<JourneyClock | null>(null);

export function useJourney() {
  const clock = useContext(JourneyContext);
  if (!clock) throw new Error('useJourney needs a JourneyProvider');
  return clock;
}

// What every slot in the scene (sky, world, boats, eggs) is given. `paused`
// holds decorative animation: the guest paused it or prefers reduced motion.
// `width` scales the river: 1 on desktop, MOBILE_RIVER_WIDTH in portrait.
export type SlotProps = { paused: boolean; reduced: boolean; mobile: boolean; width: number };

export function JourneyProvider({ scroll, pace, paused, reduced, children }: { scroll: number; pace: Pace; paused: boolean; reduced: boolean; children: ReactNode }) {
  const clock = useMemo<JourneyClock>(() => ({ progress: 0, scroll: 0, lift: 0 }), []);
  // Reduced motion cuts between still views, and renders only on demand.
  const still = reduced ? stillProgress(scroll) : null;
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => { invalidate(); }, [still, invalidate]);
  // Before every other frame callback, so they all see this frame's progress.
  useFrame(() => {
    clock.scroll = scroll;
    if (still !== null) clock.progress = still;
    else if (!paused) advancePace(pace, performance.now()), clock.progress = pace.progress;
  }, -2);
  return <JourneyContext.Provider value={clock}>{children}</JourneyContext.Provider>;
}
