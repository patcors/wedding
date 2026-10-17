// Every Easter egg, by the id its milestone names in journey.ts. Adding one
// means adding its id to EggId and to its milestone's `egg`, its component
// here, and nothing else; egg.ts says how an egg times and places itself.
import type { ComponentType } from 'react';
import { MILESTONES, type EggId } from '../journey';
import type { SlotProps } from '../JourneyProvider';
import type { EggProps } from './egg';
import Balloon from './Balloon';
import YearMarkers from './YearMarkers';
import DatingButterflies from './DatingButterflies';

const EGGS: Record<EggId, ComponentType<EggProps>> = { balloon: Balloon };
// Scenery that isn't an egg on a milestone: the years marked along the banks,
// and the butterflies that circle the boats as they start dating, part of the
// boats' joining.
const SCENERY: ComponentType<SlotProps>[] = [YearMarkers, DatingButterflies];

export default function Eggs(props: SlotProps) {
  return <>{MILESTONES.map(milestone => {
    if (!milestone.egg) return null;
    const Egg = EGGS[milestone.egg];
    return <Egg key={milestone.id} milestone={milestone} {...props} />;
  })}
  {SCENERY.map((Scenery, i) => <Scenery key={i} {...props} />)}</>;
}
