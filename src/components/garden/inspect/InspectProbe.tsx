// Dev only: the scene's half of the Review panel's inspect mode. While it is
// on, it raycasts what is under the mouse (at most every 50ms, and again as
// the scene moves on under a still mouse) or a tap, and shows a numbered
// marker where each note is pinned. While it is off it is not mounted, so it
// costs nothing; guests' builds never load it (GardenScene.tsx).
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useJourney } from '../JourneyProvider';
import { bankAt, describe, refine, type InspectLink } from './inspect';
import { getInspect, setInspect, useInspect, type InspectHit } from './inspectStore';
import './inspect.css';

export default function InspectProbe({ width }: { width: number }) {
  const on = useInspect(state => state.on);
  return on ? <Probe width={width} /> : null;
}

const HOVER_EVERY = 50, RECAST_EVERY = 150;
type Pointer = { x: number; y: number; moved: boolean };

// Hidden objects, and ones faded right out, can't be pointed at.
function faded(material: THREE.Material | THREE.Material[]) {
  const all = Array.isArray(material) ? material : [material];
  return all.every(m => !m.visible || (m.transparent && m.opacity < .02));
}

function Probe({ width }: { width: number }) {
  const { gl, camera, scene, invalidate } = useThree();
  const clock = useJourney();
  const notes = useInspect(state => state.notes);
  const pointer = useRef<Pointer | null>(null), last = useRef(0);
  const tools = useMemo(() => ({ raycaster: new THREE.Raycaster(), ndc: new THREE.Vector2(), matrix: new THREE.Matrix4(), origin: new THREE.Vector3(), local: new THREE.Vector3() }), []);

  const cast = (x: number, y: number, touch: boolean): InspectHit | null => {
    const { raycaster, ndc, matrix, origin, local } = tools;
    const rect = gl.domElement.getBoundingClientRect();
    ndc.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits: THREE.Intersection[] = [];
    const visit = (object: THREE.Object3D) => {
      if (!object.visible) return;
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh && !faded(mesh.material)) {
        // Instances and bones that move each frame keep no bounds of their own.
        if ((object as THREE.InstancedMesh).isInstancedMesh && !object.frustumCulled) (object as THREE.InstancedMesh).computeBoundingSphere();
        if ((object as THREE.SkinnedMesh).isSkinnedMesh) (object as THREE.SkinnedMesh).computeBoundingSphere();
        mesh.raycast(raycaster, hits);
      }
      object.children.forEach(visit);
    };
    visit(scene);
    hits.sort((a, b) => a.distance - b.distance);
    const described = hits.map(hit => {
      const chain: InspectLink[] = [];
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
        const geometryName = o === hit.object ? (o as THREE.Mesh).geometry?.name : '';
        chain.push({ name: o.name || geometryName || '', type: o.type, tag: o.userData.inspect });
      }
      return { hit, described: describe(chain) };
    });
    const chosen = described.find(d => !d.described.background) ?? described[0];
    if (!chosen) return null;
    const { hit } = chosen;
    const instanced = hit.object as THREE.InstancedMesh;
    if (instanced.isInstancedMesh && hit.instanceId !== undefined) {
      instanced.getMatrixAt(hit.instanceId, matrix);
      origin.setFromMatrixPosition(matrix.premultiply(instanced.matrixWorld));
    } else hit.object.getWorldPosition(origin);
    const point = hit.point, round = (v: number) => Math.round(v * 100) / 100;
    let pair: THREE.Object3D | null = hit.object;
    while (pair && pair.name !== 'voyage-boats') pair = pair.parent;
    const side = pair ? Math.sign(pair.worldToLocal(local.copy(point)).x) : undefined;
    return {
      described: refine(chosen.described, { x: origin.x, z: origin.z }, width, side),
      p: clock.progress,
      screen: { x: Math.round(x), y: Math.round(y), width: innerWidth, height: innerHeight },
      world: [round(point.x), round(point.y), round(point.z)],
      bank: chosen.described.background ? '' : bankAt(point.x, point.z, width),
      touch,
    };
  };
  const castRef = useRef(cast);
  castRef.current = cast;

  useEffect(() => {
    const canvas = gl.domElement;
    let touched = false;
    const onDown = (event: PointerEvent) => { touched = event.pointerType !== 'mouse'; };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      if (event.target !== canvas) {
        if (pointer.current) { pointer.current = null; if (getInspect().hover && !getInspect().hover!.touch) setInspect({ hover: null }); }
        return;
      }
      pointer.current = { x: event.clientX, y: event.clientY, moved: true };
      invalidate();
    };
    // A click pins a note there; a tap shows the label, which offers to. The
    // river's own tap (a guest's boat) is held back while inspecting.
    const onClick = (event: MouseEvent) => {
      if (event.target !== canvas) return;
      event.stopPropagation();
      const type = (event as PointerEvent).pointerType;
      const touch = type ? type !== 'mouse' : touched;
      const hit = castRef.current(event.clientX, event.clientY, touch);
      if (touch) setInspect({ hover: hit });
      else if (hit) setInspect({ draft: hit, hover: null });
    };
    addEventListener('pointerdown', onDown, true);
    addEventListener('pointermove', onMove, true);
    addEventListener('click', onClick, true);
    return () => {
      removeEventListener('pointerdown', onDown, true);
      removeEventListener('pointermove', onMove, true);
      removeEventListener('click', onClick, true);
      setInspect({ hover: null });
    };
  }, [gl, invalidate]);

  useFrame(() => {
    const at = pointer.current;
    if (!at || getInspect().draft) return;
    const now = performance.now();
    if (now - last.current < (at.moved ? HOVER_EVERY : RECAST_EVERY)) {
      // Under reduced motion or a pause, frames come only when asked for.
      if (at.moved) invalidate();
      return;
    }
    last.current = now;
    at.moved = false;
    setInspect({ hover: cast(at.x, at.y, false) });
  });

  return <>{notes.map((note, i) => note.world && <Html key={note.id} position={note.world} center zIndexRange={[4, 4]} style={{ pointerEvents: 'none' }}>
    <span className="garden-inspect-marker" title={note.text}>{i + 1}</span>
  </Html>)}</>;
}
