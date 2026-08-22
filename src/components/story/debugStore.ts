import { useSyncExternalStore } from 'react';

/**
 * Live-tunable values for the debug panel.
 *
 * Plain external stores rather than React state lifted into StoryCanvas:
 * consumers subscribe individually, so nothing above them re-renders, and
 * removing a knob touches this file plus one block in each consumer.
 *
 * These are for *finding* a number, not for keeping it. Once a value is settled,
 * hard-code it in the component and delete the knob.
 */

interface Store<T> {
  get: () => T;
  set: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
}

function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      if (next === value) return;
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useDebugValue<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/* ------------------------------------------------------------------ *
 * Rope construction
 * ------------------------------------------------------------------ */

/**
 * Which rope geometry to build.
 *
 * `tube` is the original: one swept surface with the strands faked as a cosine
 * bulge of the radius. `laid` sweeps each strand as its own solid so they
 * overlap. Kept as an A/B because the whole question is whether the extra
 * ~1.7x vertices earns its keep on screen — and a difference you can only see
 * across a page reload is one you cannot see.
 *
 * Settle this, then delete the loser along with its branch in strandMaterial.ts.
 */
export type RopeMode = 'tube' | 'laid';
export const ropeMode = createStore<RopeMode>('laid');

/**
 * Turns of the lay for the laid rope. The most visible single parameter: it
 * sets the angle the strands sit at.
 *
 * Tune against the **crown** angle in the console readout, not the lay angle:
 * the crown is the ridge along the top of each strand and is roughly twice the
 * strand-centre angle, so it is the number your eye is actually reading. 84
 * turns is ~36 degrees at the crown and a 4.3-diameter lay length, both inside
 * the range real three-strand rope is specified at. Lower runs the strands more
 * along the rope.
 *
 * Unlike the tube's knobs this one is *geometry*, so dragging it rebuilds the
 * mesh and will hitch. That is the trade for real strands — accepted, because
 * a rebuild is still an order of magnitude faster than a Blender round-trip.
 */
export const laidTurns = createStore(84);

/**
 * Strand radius as a fraction of the touching size. 1.0 = exactly touching.
 *
 * Slightly over 1 is usually the flattering direction: the strands interpenetrate
 * a little, which closes the view down into the core and reads as a softer rope.
 */
export const laidFill = createStore(1.0);

/**
 * Noise displacement of the strand surface, as a fraction of the strand radius.
 *
 * Breaks the extruded-plastic look. Lumpiness rather than fibre — the mesh is
 * far too coarse to hold anything hair-sized, which is what `fuzz` is for.
 * Geometry, so it rebuilds.
 */
export const laidFray = createStore(0.12);

/**
 * Stray fibres over the whole rope.
 *
 * The only thing that puts hair on the silhouette, which is the one place a
 * texture cannot reach. 0 disables the mesh entirely. Geometry, so it rebuilds;
 * budget roughly 3 vertices per fibre.
 */
export const fuzzCount = createStore(24000);

/**
 * How far fibres stand off the surface. Low lies them along the yarn, which is
 * how fibres that have escaped a twisted strand actually sit. High is a bottle
 * brush.
 */
export const fuzzStandoff = createStore(0.35);

/**
 * Texture tiles around each strand. **Whole numbers only** — v wraps, so a
 * fraction leaves a seam running the length of every strand.
 *
 * Because the UVs are generated in circumferences of arc, this scales both axes
 * at once and stays aspect-correct by construction. 1 puts the tile's ~26 cords
 * around one strand; 2 gives 52, i.e. finer yarn at the same twist angle.
 */
export const yarnScale = createStore(1);

/* ------------------------------------------------------------------ *
 * Rope surface tuning — `tube` mode only
 * ------------------------------------------------------------------ */

/**
 * Radial bulge of the geometric strand lay, as a fraction of the tube radius.
 *
 * 0 = a plain round tube with the fibre detail coming only from the normal map.
 * ~0.10 gives strands you can see on the silhouette. Above ~0.2 the tube starts
 * to look like a screw thread.
 */
export const layAmp = createStore(0.1);

/**
 * How many strands the lay is made from, i.e. how many ridges wrap the
 * circumference.
 *
 * Measured in the browser: 3–6 clean, 8 borderline, 10+ aliases into a knurled
 * mesh. Matching the texture's ~26 cords would need ~5x the tubular segments.
 */
export const layStrands = createStore(6);

/**
 * Turns of the lay over the full length. Sets the helix *angle* only — the ridge
 * count is layStrands. Raising this steepens the twist and is what needs more
 * tubularSegments to stay free of aliasing.
 */
export const layTurns = createStore(120);

/** `normalScale` on the rope material. The fine-yarn shading depth. */
export const normalStrength = createStore(1.6);

/* ------------------------------------------------------------------ *
 * Free camera
 * ------------------------------------------------------------------ */

/**
 * Detach the camera from the scroll curve and fly it with the mouse:
 * left-drag orbits, right-drag pans, wheel dollies.
 *
 * The rig keeps running underneath — velocity still tracks the scroll, so the
 * strands billow exactly as they would — it simply stops writing position and
 * lookAt. Switching back off therefore *eases* home rather than snapping,
 * because the rig's lerp is unchanged and just resumes from wherever you left
 * the lens.
 *
 * Pairs with `scrub`: park on a t, then walk around what is there. That
 * combination is the only way to see a billboard's back, or to judge the rope
 * from an angle the reader will never be given.
 */
export const freeCamera = createStore(false);

/**
 * Where the free camera currently is, written every frame and polled by the
 * panel at 10Hz.
 *
 * A plain mutable object rather than a store: it changes every frame and
 * nothing should re-render on it. Its purpose is to let you find a placement by
 * eye and then paste the numbers into cameraPositionAt.
 */
export const cameraReadout = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0 };

/* ------------------------------------------------------------------ *
 * TEMPORARY — normal-map bit-depth A/B. Delete this section, plus
 * public/textures/rope/normal-16.png and the blocks marked DEBUG in
 * Strands.tsx and Scrubber.tsx, once 8-bit is confirmed.
 *
 * TextureCan ships normal_opengl as a 16-bit RGBA PNG (6.44 MB); the 8-bit RGB
 * conversion is 1.73 MB. Expect *no* visible difference: three's TextureLoader
 * decodes through an HTMLImageElement, so the browser hands WebGL 8 bits per
 * channel whatever the PNG held, and texture.type is UnsignedByteType on upload
 * regardless. The precision is discarded before anything is drawn.
 * ------------------------------------------------------------------ */

export type NormalDepth = '8' | '16';

/** Sizes on disk, so the panel can show what the choice actually costs. */
export const NORMAL_BYTES: Record<NormalDepth, number> = {
  '8': 1_726_442,
  '16': 6_441_285,
};

export const normalDepth = createStore<NormalDepth>('8');
