// Dev only: what the inspect mode shares between the scene (InspectProbe.tsx,
// which raycasts) and the page (InspectTools.tsx, which shows the label, the
// note box and the notes). One small store, as they sit in different React
// roots: the Canvas renders its own.
import { useSyncExternalStore } from 'react';
import { INSPECT_KEY, NOTES_KEY, readNotes, type Described, type InspectNote } from './inspect';

// An object under the pointer: what it is, the progress the scene showed,
// where on the screen and in the world, and which bank.
export type InspectHit = { described: Described; p: number; screen: InspectNote['screen']; world: [number, number, number]; bank: string; touch: boolean };
export type InspectState = {
  on: boolean;
  // Under the mouse (desktop) or last tapped (phone).
  hover: InspectHit | null;
  // Clicked, or tapped then "Add a note": the note box is open on it.
  draft: InspectHit | null;
  notes: readonly InspectNote[];
};

let state: InspectState = { on: false, hover: null, draft: null, notes: [] };
if (typeof localStorage !== 'undefined') {
  state = { ...state, on: localStorage.getItem(INSPECT_KEY) === '1', notes: readNotes(localStorage.getItem(NOTES_KEY)) };
}
const listeners = new Set<() => void>();
export const getInspect = () => state;
export function setInspect(change: Partial<InspectState>) {
  state = { ...state, ...change };
  if ('on' in change) {
    if (state.on) localStorage.setItem(INSPECT_KEY, '1'); else localStorage.removeItem(INSPECT_KEY);
    if (!state.on) state = { ...state, hover: null, draft: null };
  }
  if ('notes' in change) localStorage.setItem(NOTES_KEY, JSON.stringify(state.notes));
  listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useInspect<T>(select: (state: InspectState) => T) {
  return useSyncExternalStore(subscribe, () => select(state), () => select(state));
}
