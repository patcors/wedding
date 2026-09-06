import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { billboardAnchor, billboardNormal } from './cameraJourney';
import type { BillboardSpec } from './billboards';
import { captionTexture, placeholderPhoto } from './placeholder';
import {
  LAYOUT,
  OUTER_H,
  OUTER_W,
  PHOTO_H,
  PHOTO_W,
  backingGeometry,
  backingMaterial,
  matGeometry,
  matMaterial,
  mouldingGeometry,
  mouldingMaterial,
} from './frameGeometry';

/**
 * How far the frame hangs below its anchor on the strand.
 *
 * There is no longer a cord drawn between the two — the pair of tapered
 * cylinders that used to run from the strand to the frame's top corners, plus
 * the grommets they threaded through, are gone. They were the least convincing
 * thing in the scene: five-sided cylinders read as facets at this distance, and
 * two straight cords cannot bend the way the pendulum below implies they
 * should, so the frame appeared to pivot while its cords stayed rigid.
 *
 * Without them the frame reads as suspended anyway — it hangs clear of the
 * strand, sways slowly, and fades into the same fog. Chosen so the frame's
 * centre stays at -6.5 from the anchor, exactly where the old cord-plus-frame
 * stack put it, because the camera framing and MIN_LATERAL_CLEARANCE were both
 * tuned against that position.
 */
const DROP = 6.5 - OUTER_H / 2;

/** Keep captions within the frame width on phones as well as desktop. */
const CAPTION_W = OUTER_W;

/**
 * How far the caption floats in front of the frame's plane.
 *
 * The caption is taller than its gap below the frame, so its top strip overlaps
 * the moulding. `depthWrite={false}` stops it fighting things drawn after it,
 * but not things drawn before — the frame is one of those, so the overlap needs
 * real separation too. See the note on Z layout in frameGeometry.ts for why the
 * separation has to be this generous rather than a hair's breadth.
 */
const CAPTION_LIFT = 0.3;

/** The grey box, and the fallback shown while a real photo decodes. */
function PlaceholderPlane({ map }: { map: THREE.Texture }) {
  return (
    <mesh position={[0, 0, LAYOUT.photo]}>
      <planeGeometry args={[PHOTO_W, PHOTO_H]} />
      <meshBasicMaterial map={map} toneMapped={false} />
    </mesh>
  );
}

/**
 * The photo plane, in its own component because `useTexture` suspends.
 *
 * Kept separate — and given its own <Suspense> below — so one slow photograph
 * only stalls its own frame. Hoisting the hook into Billboard would suspend the
 * whole component, and since every Billboard sits under the single boundary in
 * StoryCanvas, the entire scene (rope included) would blank until the last
 * photo decoded.
 *
 * Note this is not yet the progressive load that docs/ASSET_TASKS.md asks for:
 * every Billboard mounts at scene start, so every photo is still requested at
 * once. What it buys is that none of them block anything.
 */
function PhotoPlane({ src }: { src: string }) {
  const tex = useTexture(src);
  const gl = useThree((s) => s.gl);

  useLayoutEffect(() => {
    /**
     * drei's `useTexture` is a bare three `TextureLoader`, which leaves
     * `colorSpace` at the default `NoColorSpace`. For a colour map that skips
     * the sRGB decode and the photograph renders noticeably dark and oversaturated
     * — so this assignment is load-bearing, not tidying. (The runtime
     * placeholders in placeholder.ts set it for the same reason.)
     */
    tex.colorSpace = THREE.SRGBColorSpace;

    // Frames are yawed to face the camera, so every photo is seen obliquely —
    // the one case where anisotropic filtering is worth asking for.
    tex.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    // Cover the portrait aperture without distorting the photograph.
    const image = tex.image as HTMLImageElement;
    const imageAspect = image.naturalWidth / image.naturalHeight;
    const frameAspect = PHOTO_W / PHOTO_H;
    tex.repeat.set(Math.min(1, frameAspect / imageAspect), Math.min(1, imageAspect / frameAspect));
    tex.offset.set((1 - tex.repeat.x) / 2, (1 - tex.repeat.y) / 2);
    tex.needsUpdate = true;
  }, [tex, gl]);

  return (
    <mesh position={[0, 0, LAYOUT.photo]}>
      <planeGeometry args={[PHOTO_W, PHOTO_H]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

/**
 * A photograph suspended from the strand.
 *
 * Deliberately *not* welded to the strand's shader displacement. Text that
 * sways is text nobody reads, and attaching it would mean reimplementing the
 * GLSL wave() in JS and keeping two copies in sync forever.
 *
 * Instead each frame gets its own slow pendulum about a fixed pivot. Hanging
 * things swing, so that alone sells suspension — and it costs nothing.
 */
export function Billboard({ spec, index }: { spec: BillboardSpec; index: number }) {
  const pivot = useRef<THREE.Group>(null);

  const anchor = useMemo(() => billboardAnchor(spec, index), [spec, index]);

  /**
   * Built even when a real photo exists, because it doubles as the Suspense
   * fallback — the frame shows its grey box immediately and swaps to the
   * photograph on decode, rather than hanging empty. Cached in placeholder.ts,
   * so a re-render costs nothing.
   */
  const placeholder = useMemo(
    () => placeholderPhoto(spec.id, index + 1, PHOTO_W / PHOTO_H),
    [spec.id, index],
  );
  const caption = useMemo(
    () => (spec.caption ? captionTexture(spec.caption) : null),
    [spec.caption],
  );

  // Phase-offset per billboard so they don't swing in unison like a chorus.
  const phase = useMemo(() => (index * 2.399) % (Math.PI * 2), [index]);

  /**
   * Face where the camera will be when the reader arrives. Yaw only — a frame
   * pitched toward the camera reads as broken rather than as depth, and
   * oblique text is the classic failure of this whole genre.
   */
  const yaw = useMemo(() => {
    const normal = billboardNormal(index);
    return Math.atan2(normal.x, normal.z);
  }, [index]);

  useFrame((state) => {
    if (!pivot.current) return;
    const t = state.clock.elapsedTime;
    pivot.current.rotation.z = Math.sin(t * 0.42 + phase) * 0.012;
    pivot.current.rotation.x = Math.sin(t * 0.31 + phase * 1.7) * 0.006;
  });

  return (
    <group dispose={null} position={anchor} rotation={[0, yaw, 0]}>
      <group ref={pivot}>
        <group position={[0, -DROP - OUTER_H / 2, 0]}>
          {/* Geometries and materials are module singletons shared by every
              billboard, so these are `args`-free and reused rather than being
              rebuilt per frame. */}
          <mesh
            geometry={backingGeometry}
            material={backingMaterial}
            position={[0, 0, LAYOUT.backing]}
          />

          {spec.photo ? (
            <Suspense fallback={<PlaceholderPlane map={placeholder} />}>
              <PhotoPlane src={spec.photo} />
            </Suspense>
          ) : (
            <PlaceholderPlane map={placeholder} />
          )}

          {/* Mount board, then the moulding standing proud of it. Drawn after
              the photo so the mat's overlap covers the photo's crop edge. */}
          <mesh geometry={matGeometry} material={matMaterial} position={[0, 0, LAYOUT.mat]} />
          <mesh
            geometry={mouldingGeometry}
            material={mouldingMaterial}
            position={[0, 0, LAYOUT.moulding]}
          />

          {caption && (
            <mesh position={[0, -OUTER_H / 2 - 1.0, CAPTION_LIFT]}>
              <planeGeometry args={[CAPTION_W, CAPTION_W / 4]} />
              <meshBasicMaterial map={caption} transparent depthWrite={false} toneMapped={false} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}
