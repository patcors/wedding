// Dev only: names what is mounted inside it for the Review panel's inspect
// mode (inspect.ts says what each id is called and where it is made). Guests'
// builds get the children alone, with no group round them.
import type { ReactNode } from 'react';

export default function Inspectable({ id, milestone, children }: { id: string; milestone?: string; children: ReactNode }) {
  if (!import.meta.env.DEV) return children;
  return <group userData={{ inspect: { id, milestone } }}>{children}</group>;
}
