// Every Easter egg, by the id its milestone names in journey.ts. Adding one
// means adding its id to EggId and to its milestone's `egg`, its component
// here, and nothing else; egg.ts says how an egg times and places itself.
import type { ComponentType } from 'react';
import { MILESTONES, type EggId } from '../journey';
import type { SlotProps } from '../JourneyProvider';
import type { EggProps } from './egg';
import TurkeyGreece from './TurkeyGreece';
import University from './University';
import SnowTrip from './SnowTrip';
import Graduation from './Graduation';
import Birdhouses from './Birdhouses';
import SecondSnowTrip from './SecondSnowTrip';
import YearMarkers from './YearMarkers';
import DatingButterflies from './DatingButterflies';
import EngagementPetals from './EngagementPetals';
import EngagementTruck from './EngagementTruck';
import BarkCarvings from './BarkCarvings';
import MobiusSculpture from './MobiusSculpture';
import ParkBench from './ParkBench';
import Careers from './Careers';
import BulletOrnament from './BulletOrnament';
import Circus from './Circus';
import Sydney from './Sydney';
import Inspectable from '../inspect/Inspectable';

const EGGS: Record<EggId, ComponentType<EggProps>> = { balloon: TurkeyGreece, university: University, 'snow-2019': SnowTrip,
  graduation: Graduation, sydney: Sydney, apartments: Birdhouses, 'snow-2025': SecondSnowTrip };
// Scenery that isn't an egg on a milestone: the years marked along the banks,
// the butterflies that circle the boats as they start dating, part of the
// boats' joining, the rose petals in the catamaran's wake as they get engaged
// and the old truck they got engaged on, parked on the bank (see
// engagementTruck.ts), the university years' ornaments (see uniOrnaments.ts),
// ornaments on the banks for their working lives, the bullet ornament on
// Patrick's bank (see bulletOrnament.ts), and Amelia's
// aerial circus hung from the trees on her bank (see circusRigs.ts).
const SCENERY: ComponentType<SlotProps>[] = [YearMarkers, DatingButterflies, EngagementPetals, EngagementTruck, BarkCarvings, MobiusSculpture, ParkBench, Careers, BulletOrnament, Circus];

export default function Eggs(props: SlotProps) {
  return <>{MILESTONES.map(milestone => {
    if (!milestone.egg) return null;
    const Egg = EGGS[milestone.egg];
    return <Inspectable key={milestone.id} id={milestone.egg} milestone={milestone.id}><Egg milestone={milestone} {...props} /></Inspectable>;
  })}
  {SCENERY.map((Scenery, i) => <Scenery key={i} {...props} />)}</>;
}
