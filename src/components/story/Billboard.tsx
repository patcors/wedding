import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  MIN_LATERAL_CLEARANCE,
  cameraPositionAt,
  spineAt,
  spineRightAt,
  strandPointAt,
  type Side,
} from './curves';
import type { BillboardSpec } from './billboards';
import { captionTexture, placeholderPhoto } from './placeholder';

const FRAME_W = 7.2;
const FRAME_H = 5.0;
const HANG = 3.1; // cord length from strand down to the top of the frame

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

  const anchor = useMemo(() => {
    const v = new THREE.Vector3();
    const point =
      spec.side === 'shared'
        ? spineAt(spec.t, v).clone()
        : strandPointAt(spec.t, spec.side as Side, v).clone();

    /**
     * Guarantee a minimum lateral clearance from the spine, or the camera flies
     * straight through the frame.
     *
     * This has to apply to every billboard, not just 'shared' ones: the strands
     * have essentially converged well before BRAID_T, so a rope or silk
     * billboard placed near the braid sits on the centre line too — which is
     * exactly the camera's path.
     *
     * Billboards already clear of the line keep the side they were on, so the
     * pre-braid rope/silk split is preserved.
     */
    const spine = spineAt(spec.t, new THREE.Vector3());
    const right = spineRightAt(spec.t, new THREE.Vector3());
    const lateral = point.clone().sub(spine).dot(right);

    if (Math.abs(lateral) < MIN_LATERAL_CLEARANCE) {
      // Always pushed left, because the camera drifts *right* through the braid
      // (see cameraPositionAt). Alternating sides here would simply relocate the
      // collision rather than remove it.
      const dir = spec.lateral ?? -1;
      point.add(right.multiplyScalar(dir * MIN_LATERAL_CLEARANCE - lateral));
    }
    return point;
  }, [spec.t, spec.side, spec.lateral, index]);

  const photo = useMemo(
    () => (spec.photo ? null : placeholderPhoto(spec.id, index + 1)),
    [spec.photo, spec.id, index],
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
    const cam = cameraPositionAt(spec.t, new THREE.Vector3());
    return Math.atan2(cam.x - anchor.x, cam.z - anchor.z);
  }, [anchor, spec.t]);

  useFrame((state) => {
    if (!pivot.current) return;
    const t = state.clock.elapsedTime;
    pivot.current.rotation.z = Math.sin(t * 0.42 + phase) * 0.035;
    pivot.current.rotation.x = Math.sin(t * 0.31 + phase * 1.7) * 0.018;
  });

  return (
    <group position={anchor} rotation={[0, yaw, 0]}>
      <group ref={pivot}>
        {/* Cords from the strand down to the frame's top corners. */}
        {[-FRAME_W * 0.38, FRAME_W * 0.38].map((x) => (
          <mesh key={x} position={[x / 2, -HANG / 2, 0]} rotation={[0, 0, Math.atan2(x / 2, HANG / 2)]}>
            <cylinderGeometry args={[0.045, 0.045, HANG * 1.02, 5]} />
            <meshStandardMaterial color="#8d7c5e" roughness={0.9} />
          </mesh>
        ))}

        <group position={[0, -HANG - FRAME_H / 2, 0]}>
          {/* Backing panel, slightly larger than the photo — this is the piece
              to replace with a real glTF frame. See docs/ASSET_TASKS.md. */}
          <mesh position={[0, 0, -0.06]} castShadow={false}>
            <boxGeometry args={[FRAME_W + 0.5, FRAME_H + 0.5, 0.12]} />
            <meshStandardMaterial color="#2b2723" roughness={0.75} />
          </mesh>

          <mesh>
            <planeGeometry args={[FRAME_W, FRAME_H]} />
            <meshBasicMaterial map={photo ?? undefined} toneMapped={false} />
          </mesh>

          {/* Grommets — the small detail that sells "genuinely attached". */}
          {[-FRAME_W * 0.38, FRAME_W * 0.38].map((x) => (
            <mesh key={x} position={[x, FRAME_H / 2 + 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.16, 0.05, 6, 12]} />
              <meshStandardMaterial color="#c9c2b4" roughness={0.4} metalness={0.6} />
            </mesh>
          ))}

          {caption && (
            <mesh position={[0, -FRAME_H / 2 - 1.15, 0]}>
              <planeGeometry args={[FRAME_W * 1.15, (FRAME_W * 1.15) / 4]} />
              <meshBasicMaterial map={caption} transparent depthWrite={false} toneMapped={false} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}
