// July 2026, a trip to Turkey and Greece: a hot-air balloon, Cappadocia style,
// rising over a miniature Hagia Sophia on the bank.
import type { EggProps } from './egg';
import Balloon from './Balloon';
import HagiaSophia from './HagiaSophia';

export default function TurkeyGreece(props: EggProps) {
  return <>
    <Balloon {...props} />
    <HagiaSophia {...props} />
  </>;
}
