// The Garden's 3D scene: wiring only. Each part lives in its own component,
// so it can be worked on without touching the others (see docs/VOYAGE.md).
import { Suspense, lazy, useMemo, useState, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { MOBILE_RIVER_WIDTH } from './gardenGeometry';
import { OLD_TREE_FIRST } from './gardenTreeSpots';
import GardenTrees, { OLD_TREE_MODEL, OPENING_TREE_MODELS, treeTextures } from './GardenTrees';
import GardenPreparation from './GardenPreparation.tsx';
import GardenGround, { groundTextures, type GroundStyle, type RockStyle } from './GardenGround';
import GardenRocks, { ROCK_MODEL, ROCK_TEXTURES } from './GardenRocks';
import GardenPlants from './GardenPlants';
import GardenBankDetails from './GardenBankDetails';
import { FallingLeaves, Petals } from './GardenDrift';
import GardenSeasons from './GardenSeasons';
import GardenWater, { WATER_NORMALS, createWaterTint } from './GardenWater';
import GardenSky, { type SkyStyle } from './GardenSky';
import type { PlantStyle } from './gardenPlantGeometry';
import { preloadGardenTextures, useGardenTextures } from './gardenTextures';
import { dequantizeModel } from './gardenModels';
import { JourneyProvider, type SlotProps } from './JourneyProvider';
import type { Pace } from './journeyPace';
import VoyageCamera from './VoyageCamera';
import VoyageWorld from './VoyageWorld';
import VoyageBoats from './VoyageBoats';
import GuestBoat from './GuestBoat';
import NameFlight from './NameFlight';
import Eggs from './eggs';
import type { BoatLook } from './boatLooks';
import Inspectable from './inspect/Inspectable';

// Dev only: the Review panel's inspect mode (inspect/).
const InspectProbe = import.meta.env.DEV ? lazy(() => import('./inspect/InspectProbe')) : null;

type AssetChoices = { groundStyle: GroundStyle; rockStyle: RockStyle; lightTrees: boolean; oldTreeFirst?: boolean };

// Every model and texture the scene needs, with the orientation its maps load in.
function gardenAssets({ groundStyle, rockStyle, lightTrees, oldTreeFirst = false }: AssetChoices) {
  const moss = rockStyle === 'moss';
  return {
    models: [OPENING_TREE_MODELS, ...moss ? [[ROCK_MODEL]] : [], ...oldTreeFirst ? [[OLD_TREE_MODEL]] : []],
    textures: [[groundTextures(groundStyle), true], [WATER_NORMALS, true], [treeTextures(lightTrees), true],
      ...moss ? [[ROCK_TEXTURES, false]] : []] as [string[], boolean][],
  };
}
// Starts every download at once. Suspending on one asset at a time would
// leave the rest waiting behind it.
export function preloadGardenAssets(choices: AssetChoices) {
  const { models, textures } = gardenAssets(choices);
  models.forEach(urls => useGLTF.preload(urls));
  textures.forEach(([urls, flipY]) => preloadGardenTextures(urls, { flipY }));
}
// Holds the whole scene until everything has arrived. Otherwise React renders
// it again each time an asset lands, rebuilding the banks and planting from
// scratch, which stalls the butterflies while they fly in.
function useGardenAssets(choices: AssetChoices) {
  preloadGardenAssets(choices);
  const { models, textures } = gardenAssets(choices);
  // Stored quantized: back to world-unit floats before any part reads them (gardenModels.ts).
  models.forEach(urls => useGLTF(urls).forEach(dequantizeModel));
  textures.forEach(([urls, flipY]) => useGardenTextures(urls, { flipY }));
}
type SceneProps = { prepare: boolean; progress: number; pace: Pace; paused: boolean; reduced: boolean; onReady: () => void; onError: () => void; boatLaunchRequest: number; lightTrees: boolean; groundStyle: GroundStyle; rockStyle: RockStyle; plantStyle: PlantStyle; skyStyle: SkyStyle; boatLook?: BoatLook;
  // The year turning in the canopy, grass and light (seasons.ts).
  seasons?: boolean;
  // The opening title's panel, while its names are to fly to their boats.
  arrival?: RefObject<HTMLElement | null> };

export default function GardenScene({ prepare, progress, pace, paused, reduced, onReady, onError, boatLaunchRequest, lightTrees, groundStyle, rockStyle, plantStyle, skyStyle, boatLook, arrival, seasons = false }: SceneProps) {
  // Under reduced motion the story cuts straight to wherever the guest
  // scrolls, the dock included, so there it waits for the old tree too.
  const [oldTreeFirst] = useState(() => progress >= OLD_TREE_FIRST || matchMedia('(prefers-reduced-motion: reduce)').matches);
  useGardenAssets({ groundStyle, rockStyle, lightTrees, oldTreeFirst });
  const size = useThree(state => state.size);
  // On touch screens the canvas runs on under Safari's toolbar (see
  // garden.css), so framing is worked out for the part above it.
  const visibleHeight = Math.min(size.height, innerHeight);
  const mobile = size.width / visibleHeight < .85;
  const width = mobile ? MOBILE_RIVER_WIDTH : 1;
  const still = paused || reduced;
  const slot: SlotProps = { paused: still, reduced, mobile, width };
  const waterTint = useMemo(createWaterTint, []);
  return <JourneyProvider scroll={progress} pace={pace} paused={paused} reduced={reduced}>
    <VoyageCamera mobile={mobile} width={width} visibleHeight={visibleHeight} />
    <GardenSeasons on={seasons} />
    <Inspectable id="sky"><GardenSky {...slot} skyStyle={skyStyle} waterTint={waterTint} seasons={seasons} /></Inspectable>
    <GardenGround width={width} style={groundStyle} />
    <GardenTrees width={width} mobile={mobile} paused={still} lightTrees={lightTrees} oldTreeFirst={oldTreeFirst} />
    <GardenBankDetails width={width} rockStyle={rockStyle} plantStyle={plantStyle} />
    {plantStyle === 'varied' && <GardenPlants width={width} mobile={mobile} paused={still} visible />}
    {rockStyle === 'moss' && <GardenRocks width={width} visible />}
    <Inspectable id="water"><GardenWater paused={still} width={width} mobile={mobile} reeds={plantStyle === 'varied'} launchRequest={boatLaunchRequest} tint={waterTint} height={visibleHeight} /></Inspectable>
    <Inspectable id="petals"><Petals paused={still} width={width} seasons={seasons} /></Inspectable>
    <FallingLeaves paused={still} width={width} seasons={seasons} />
    <VoyageWorld {...slot} />
    <VoyageBoats {...slot} look={boatLook} />
    <GuestBoat {...slot} height={visibleHeight} look={boatLook?.guest} />
    <Eggs {...slot} />
    {arrival && <NameFlight panel={arrival} width={width} />}
    <GardenPreparation start={prepare} onReady={onReady} onError={onError} />
    {InspectProbe && <Suspense fallback={null}><InspectProbe width={width} /></Suspense>}
  </JourneyProvider>;
}
