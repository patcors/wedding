// Every Easter egg, by the id its milestone names in journey.ts. Adding one
// means adding its id to EggId and to its milestone's `egg`, its component
// here, and nothing else; egg.ts says how an egg times and places itself.
import type { ComponentType } from 'react';
import { MILESTONES, type EggId } from '../journey';
import type { SlotProps } from '../JourneyProvider';
import type { EggProps } from './egg';
import Balloon from './Balloon';
import University from './University';
import FriendsFleet from './FriendsFleet';
import SnowTrip from './SnowTrip';
import Graduation from './Graduation';
import Birdhouses from './Birdhouses';
import SecondSnowTrip from './SecondSnowTrip';
import YearMarkers from './YearMarkers';
import DatingButterflies from './DatingButterflies';
import EngagementPetals from './EngagementPetals';
import Careers from './Careers';

const EGGS: Record<EggId, ComponentType<EggProps>> = { balloon: Balloon, university: University, coast: FriendsFleet, 'snow-2019': SnowTrip,
  graduation: Graduation, apartments: Birdhouses, 'snow-2025': SecondSnowTrip };
// Scenery that isn't an egg on a milestone: the years marked along the banks,
// the butterflies that circle the boats as they start dating, part of the
// boats' joining, the rose petals in the catamaran's wake as they get engaged,
// and ornaments on the banks for their working lives.
const SCENERY: ComponentType<SlotProps>[] = [YearMarkers, DatingButterflies, EngagementPetals, Careers];

export default function Eggs(props: SlotProps) {
  return <>{MILESTONES.map(milestone => {
    if (!milestone.egg) return null;
    const Egg = EGGS[milestone.egg];
    return <Egg key={milestone.id} milestone={milestone} {...props} />;
  })}
  {SCENERY.map((Scenery, i) => <Scenery key={i} {...props} />)}</>;
}
