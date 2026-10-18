// July 2026, a trip to Turkey and Greece: hot-air balloons, Cappadocia style,
// rising over the Hagia Sophia far off down the river.
import type { EggProps } from './egg';
import Balloon from './Balloon';
import HagiaSophia from './HagiaSophia';

export default function TurkeyGreece(props: EggProps) {
  return <>
    <Balloon {...props} />
    <HagiaSophia {...props} />
  </>;
}
