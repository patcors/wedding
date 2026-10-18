// August 2025, another snow trip: a flurry sweeps over the left bank as the
// date shows and leaves two snowmen behind holding hands, Amelia's in her
// teal scarf on the left and Patrick's in his soft yellow on the right.
import type { EggProps } from './egg';
import SnowReveal from './SnowReveal';
import { SNOW_SPOTS } from './flurry';
import Snowmen from './Snowmen';

export default function SecondSnowTrip(props: EggProps) {
  return <SnowReveal {...props} spot={SNOW_SPOTS[2025]} scale={1.25}><Snowmen scarves={['#4d827f', '#e3c46a']} /></SnowReveal>;
}
