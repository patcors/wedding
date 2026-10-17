// Every Easter egg, by the id its milestone names in journey.ts. Adding one
// means adding its id to EggId and the milestone, a component here, and nothing else.
import type { ComponentType } from 'react';
import { MILESTONES, type EggId } from '../journey';
import type { SlotProps } from '../JourneyProvider';
import type { EggProps } from './egg';
import Balloon from './Balloon';

const EGGS: Record<EggId, ComponentType<EggProps>> = { balloon: Balloon };

export default function Eggs(props: SlotProps) {
  return <>{MILESTONES.map(milestone => {
    if (!milestone.egg) return null;
    const Egg = EGGS[milestone.egg];
    return <Egg key={milestone.id} milestone={milestone} {...props} />;
  })}</>;
}
