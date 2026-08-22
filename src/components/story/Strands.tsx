import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { buildStrandCurve } from './curves';
import { buildRopeGeometry, buildSilkGeometry } from './strandGeometry';
import { buildLaidRopeGeometry } from './ropeGeometry';
import { buildFuzzGeometry } from './ropeFuzz';
import { injectStrandDisplacement, makeStrandUniforms } from './strandMaterial';
import {
  fuzzCount,
  fuzzStandoff,
  laidFill,
  laidFray,
  laidTurns,
  layAmp,
  layStrands,
  layTurns,
  normalDepth,
  normalStrength,
  ropeMode,
  useDebugValue,
  yarnScale,
} from './debugStore';

/**
 * Rope and silk share one shader but not one parameter set, and that contrast
 * is the entire point of having chosen these two objects.
 *
 * Rope is stiff: low amplitude, low frequency, slow, barely responsive to
 * scroll velocity. Rope sways under its own weight — it does not ripple. If it
 * ripples it reads as a garden hose and the material contrast dies.
 *
 * Silk billows: larger amplitude, a travelling wave, cross-wise flutter, and a
 * strong velocity response so it settles when the reader stops scrolling.
 */

/**
 * Rope tiling — the one number here that actually matters.
 *
 * The tile is a square of ~26 cords twisted at roughly 45°. u and v must stay
 * in proportion to the tube's real dimensions or that twist angle shears: the
 * curve is ~470 units of arc length and the circumference is 2π × 0.62 ≈ 3.9,
 * a ratio of about 120:1.
 *
 * **v must be a whole number.** The circumference wraps, so a fractional v
 * leaves a seam running the entire length of the rope.
 *
 * (120, 1) shows 26 cords around the rope. (240, 2) shows 52 — finer twine at
 * the same twist angle. Both are aspect-correct; choose by eye.
 *
 * The old placeholder value of (260, 3) predates having a real texture and is
 * wrong for this one: 78 cords around reads as a hairy cable, and the 260:3
 * ratio flattens the twist toward the axis.
 */
const ROPE_REPEAT = new THREE.Vector2(120, 1);

/**
 * Turns of the geometric strand lay over the full length.
 *
 * Deliberately the same number as ROPE_REPEAT.x, because it is the same
 * quantity: both are (arc length / circumference), which is the pitch that puts
 * a helix at 45°. The texture's yarns run at 45° in the tile and the tiling is
 * aspect-correct, so they arrive at 45° in world space — and the strands have to
 * agree with them or the two scales visibly fight.
 */
const ROPE_LAY_TURNS = ROPE_REPEAT.x;

/**
 * Ridges around the circumference.
 *
 * 6 rather than a physically-orthodox 3, chosen by eye in the browser: 3 reads
 * as a chunky cable, 6 as properly laid rope. 8 is the point where it starts to
 * go noisy and 10 is a knurled mesh — see the aliasing note in strandGeometry.ts.
 *
 * It does **not** line up 1-to-1 with the texture's yarns and cannot: repeat.y
 * of 1 puts all ~26 of the tile's cords around the circumference, and 26 ridges
 * needs roughly 14,000 tubular x 150 radial segments to resolve. Millions of
 * verts for a wedding invite. The two scales are meant to layer, not match.
 */
const ROPE_LAY_STRANDS = 6;

export function Rope({ velocityRef }: { velocityRef: React.RefObject<number> }) {
  const mode = useDebugValue(ropeMode);
  const turns = useDebugValue(laidTurns);
  const fill = useDebugValue(laidFill);
  const fray = useDebugValue(laidFray);
  const yarn = useDebugValue(yarnScale);

  const geometry = useMemo(() => {
    const curve = buildStrandCurve('rope');
    if (mode === 'tube') return buildRopeGeometry(curve);
    const geo = buildLaidRopeGeometry(curve, { turns, strandFill: fill, fray });
    // Cheap to print, and the numbers that matter — crown angle for the look,
    // lay length as the sanity check against real rope, triangles for the
    // budget — are otherwise invisible.
    console.info('[rope]', geo.userData.rope);
    return geo;
  }, [mode, turns, fill, fray]);

  // Geometry is now rebuilt on a knob drag, so the old buffers have to go back.
  // Without this every drag leaks a few MB of GPU memory.
  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () =>
      makeStrandUniforms({
        uAmp: 0.5,
        uFreq: 34,
        uSpeed: 0.55,
        uVelGain: 0.5,
        uLayStrands: ROPE_LAY_STRANDS,
        uLayTurns: ROPE_LAY_TURNS,
      }),
    [],
  );

  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());

  /**
   * Suspends while loading — StoryCanvas provides the <Suspense> boundary.
   *
   * DEBUG: `normal8` and `normal16` are both loaded up front rather than being
   * swapped by URL. Re-suspending on toggle would blank the canvas between A
   * and B, and a difference you can only see across a gap is one you cannot
   * see. Drop `normal16` with debugTextures.ts.
   */
  const { map, roughnessMap, normal8, normal16 } = useTexture({
    map: '/textures/rope/color.jpg',
    roughnessMap: '/textures/rope/roughness.jpg',
    normal8: '/textures/rope/normal-8.png',
    normal16: '/textures/rope/normal-16.png',
  });

  const depth = useDebugValue(normalDepth);

  const textures = useMemo(
    () => [map, roughnessMap, normal8, normal16],
    [map, roughnessMap, normal8, normal16],
  );

  /**
   * Tiling, which now depends on the mode.
   *
   * `tube` needs the old (120, 1): its UVs run the length of the whole rope, so
   * the two numbers have to stay in proportion to the tube's real dimensions or
   * the twist shears. `laid` bakes arc-length UVs in circumferences, so a square
   * repeat is aspect-correct by construction and one whole number does it.
   *
   * Separate from the material below so yarnScale stays live — rebuilding the
   * material would re-run onBeforeCompile and hitch for nothing.
   */
  useEffect(() => {
    for (const tex of textures) {
      // Without RepeatWrapping, repeat values above 1 clamp instead of tiling.
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      if (mode === 'tube') tex.repeat.copy(ROPE_REPEAT);
      else tex.repeat.set(yarn, yarn);
      // The rope is viewed at a grazing angle almost everywhere at these repeat
      // counts. Anisotropic filtering is the difference between crisp fibre and
      // a smear.
      tex.anisotropy = maxAnisotropy;
    }
    // Colour is sRGB. Normal and roughness are *data* — gamma-correcting them
    // flattens the bumps and lifts the roughness.
    map.colorSpace = THREE.SRGBColorSpace;
  }, [textures, map, mode, yarn, maxAnisotropy]);

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      map,
      roughnessMap,
      // The default depth; the effect below swaps it. Set here rather than left
      // undefined so the first compile already has USE_NORMALMAP and we don't
      // pay for a second one immediately.
      normalMap: normal8,
      // `color` multiplies the albedo, so the old '#b9a37e' tint would double
      // up and go muddy. White means "use the texture as authored".
      color: '#ffffff',
      // `roughness` multiplies roughnessMap, so 1.0 means "trust the map".
      roughness: 1.0,
      metalness: 0.0,
      // Live-tuned below; see debugStore.ts.
      normalScale: new THREE.Vector2(1.6, 1.6),
    });
    injectStrandDisplacement(m, uniforms, mode);
    return m;
  }, [map, roughnessMap, normal8, normal16, uniforms, mode]);

  useEffect(() => () => material.dispose(), [material]);

  // DEBUG: swap the map in place rather than rebuilding the material, which
  // would re-run onBeforeCompile and hitch. Remove with debugTextures.ts.
  useEffect(() => {
    material.normalMap = depth === '8' ? normal8 : normal16;
    material.needsUpdate = true;
  }, [material, depth, normal8, normal16]);

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
    uniforms.uVel.value = velocityRef.current;

    // Read the debug knobs straight from the store rather than subscribing:
    // each is a single scalar write, far cheaper than a re-render, and it keeps
    // the panel out of React's way. Hard-code these and delete the knobs once set.
    if (mode === 'tube') {
      // The laid rope has no use for these — its strands are geometry, so the
      // shader never calls ropeLay and the uniforms are compiled away.
      uniforms.uLayAmp.value = layAmp.get();
      uniforms.uLayStrands.value = layStrands.get();
      uniforms.uLayTurns.value = layTurns.get();
    }
    const n = normalStrength.get();
    if (material.normalScale.x !== n) material.normalScale.set(n, n);
  });

  return (
    <>
      <mesh geometry={geometry} material={material} frustumCulled={false} />
      {/* Shares `uniforms`, so the fibres wave with the rope rather than beside it. */}
      {mode === 'laid' && <RopeFuzz uniforms={uniforms} turns={turns} fill={fill} />}
    </>
  );
}

/**
 * Stray fibres, as their own mesh.
 *
 * Separate from the rope because it is separate geometry with a separate
 * material — unindexed triangles, no textures, no UVs — but it is *not*
 * independent: it takes the rope's uniforms object, so both are displaced by the
 * same wave on the same frame. Passing a copy would let them drift apart by a
 * frame and the fuzz would visibly swim over the surface.
 */
function RopeFuzz({
  uniforms,
  turns,
  fill,
}: {
  uniforms: ReturnType<typeof makeStrandUniforms>;
  turns: number;
  fill: number;
}) {
  const count = useDebugValue(fuzzCount);
  const standoff = useDebugValue(fuzzStandoff);

  const geometry = useMemo(
    () =>
      count > 0
        ? buildFuzzGeometry(buildStrandCurve('rope'), {
            turns,
            strandFill: fill,
            count,
            standoff,
          })
        : null,
    [turns, fill, count, standoff],
  );

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      // A shade lighter than the rope's albedo: a loose fibre is lit from more
      // directions than the surface it left, so matching the rope exactly makes
      // the fuzz read as grime instead of hair.
      color: '#cbb08a',
      roughness: 0.95,
      metalness: 0.0,
      // Single triangles, so they are visible from exactly one side otherwise.
      side: THREE.DoubleSide,
    });
    injectStrandDisplacement(m, uniforms, 'laid');
    return m;
  }, [uniforms]);

  useEffect(() => {
    if (geometry) return () => geometry.dispose();
  }, [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  if (!geometry) return null;
  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

export function Silk({ velocityRef }: { velocityRef: React.RefObject<number> }) {
  const geometry = useMemo(() => buildSilkGeometry(buildStrandCurve('silk')), []);
  const uniforms = useMemo(
    () =>
      makeStrandUniforms({
        uAmp: 2.1,
        uFreq: 17,
        uSpeed: 1.5,
        uVelGain: 2.4,
        uCrossAmp: 0.42,
        uCrossFreq: 1.6,
      }),
    [],
  );

  const material = useMemo(() => {
    // Sheen is three.js's fabric term — a soft retroreflective rim that is
    // what makes cloth look like cloth rather than painted plastic.
    const m = new THREE.MeshPhysicalMaterial({
      color: '#c94f6d',
      roughness: 0.62,
      metalness: 0.0,
      sheen: 1.0,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color('#ffd9e2'),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.94,
    });
    injectStrandDisplacement(m, uniforms, 'ribbon');
    return m;
  }, [uniforms]);

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
    uniforms.uVel.value = velocityRef.current;
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
