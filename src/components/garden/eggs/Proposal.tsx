// April 2026, they get engaged: a little man proposes to a little woman on
// the catamaran's deck (see proposal.ts). Drawn inside VoyageBoats' group,
// in its model units, so the figures bob and heel with the deck. Each step
// plays in real time once the scroll reaches it and holds while paused; under
// reduced motion the engagement's still shows him kneeling, and the stills
// after it the two of them hand in hand. One skinned draw call, no shadows,
// hidden until they come out on deck.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useJourney, type SlotProps } from '../JourneyProvider';
import { BONES, DECK_TOP, PROPOSAL, groundedHips, proposalPose, proposalStages, proposalTime, type Stages } from './proposal';
import { proposalFigures } from './proposalGeometry';

export default function Proposal({ paused, reduced, mobile }: Pick<SlotProps, 'paused' | 'reduced' | 'mobile'>) {
  const clock = useJourney();
  const figures = useMemo(() => proposalFigures(), []);
  useEffect(() => () => figures.dispose(), [figures]);
  const stages = useRef<Stages>({ appear: 0, kneel: 0, rise: 0 });

  useFrame((_, dt) => {
    const { mesh, bones } = figures;
    stages.current = proposalStages(stages.current, proposalTime(clock.progress), paused ? 0 : Math.min(dt, .1), reduced);
    mesh.visible = stages.current.appear > 0;
    if (!mesh.visible) return;
    const pose = proposalPose(stages.current), scale = mobile ? PROPOSAL.scale.mobile : PROPOSAL.scale.desktop;
    for (const who of ['amelia', 'patrick'] as const) {
      const { x, z, yaw, bones: turns } = pose[who], own = bones[who];
      own.root.position.set(x, DECK_TOP, z);
      own.root.rotation.set(0, yaw, 0);
      own.root.scale.setScalar(scale);
      own.hips.position.y = groundedHips(who, pose[who]);
      for (const bone of BONES) if (bone !== 'root') own[bone].rotation.set(...(turns[bone] ?? [0, 0, 0]));
    }
    bones.patrick.ring.scale.setScalar(Math.max(pose.ring, 1e-3));
    // Solid once they're out on deck; faded in as they come out.
    const material = mesh.material, fading = pose.opacity < 1;
    material.opacity = pose.opacity;
    if (material.transparent !== fading) {
      material.transparent = fading;
      material.depthWrite = !fading;
      material.needsUpdate = true;
    }
  });

  return <primitive object={figures.mesh} />;
}
