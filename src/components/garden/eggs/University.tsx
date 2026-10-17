// July 2017, they meet at the University of Wollongong, both starting maths
// degrees: a π sculpture on the bank, and rubber ducks from the campus duck
// pond launched into the river beside the boats.
import type { EggProps } from './egg';
import PiSculpture from './PiSculpture';
import Ducks from './Ducks';

export default function University(props: EggProps) {
  return <>
    <PiSculpture {...props} />
    <Ducks {...props} />
  </>;
}
