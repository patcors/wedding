import type { Milestone } from '../journey';
import type { SlotProps } from '../JourneyProvider';

// The contract every Easter egg follows. An egg is given its milestone and the
// scene's settings, and reads the eased progress from useJourney() in its
// frame loop, usually through scrolledSince(milestone.month, progress) so it
// arrives on its date and moves with the scroll. It may linger after its date.
// While `paused` it holds any idle animation; when `reduced` the camera cuts
// between still views at each milestone's start, so an egg should show a
// settled pose there rather than the first frame of its arrival.
export type EggProps = SlotProps & { milestone: Milestone };
