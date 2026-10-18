// July 2019, a snow trip where Amelia broke her wrist snowboarding: a flurry
// sweeps over Amelia's bank, the left, as the date shows and leaves a snowman behind,
// in Amelia's teal scarf, with one arm in a sling.
import type { EggProps } from './egg';
import SnowReveal from './SnowReveal';
import { SNOW_SPOTS } from './flurry';
import Snowman from './Snowman';

export default function SnowTrip(props: EggProps) {
  return <SnowReveal {...props} spot={SNOW_SPOTS[2019]} scale={1.25}><Snowman sling /></SnowReveal>;
}
