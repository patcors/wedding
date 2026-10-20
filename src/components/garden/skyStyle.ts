// The Review panel's sky (GardenSky.tsx): the clear day, or the Garden's old
// misty one to compare, over any of the rivers in WATERS. The clear day is the
// site's. Apart from GardenSky so the page's first script can read it
// without pulling in three (see docs/VOYAGE.md, "The first script").
import type { WaterStyle } from './skyCycle';

export type SkyStyle = { sky: 'day' | 'mist'; water: WaterStyle };
export const SKY_STYLE: SkyStyle = { sky: 'day', water: 'clear' };
