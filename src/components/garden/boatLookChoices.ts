// The story boats' looks to choose from (boatLooks.ts has their paint).
// Guests see BOAT_LOOK; the others are dev-only Review choices. Apart from
// boatLooks.ts so the page's first script can read them without pulling in
// three (see docs/VOYAGE.md, "The first script").
export const DINGHY_LOOKS = {
  original: 'Original',
  // Glossy painted hull over a white bottom, striped main and jib, a little cabin.
  toy: 'Toy sloop',
  // Dark planked hull with iron straps, a lug sail with bands of waves.
  lugger: 'Lugger',
  // Weathered planks over a pale bottom, a plain white spritsail.
  skiff: 'Spritsail skiff',
} as const;
export const CATAMARAN_LOOKS = {
  original: 'Original',
  // White hulls and deck, a cabin, an alloy mast, navy-edged main and jib.
  cruiser: 'Cruiser',
  // The cruiser with a racing panel on the main: P&A over 27.
  numbered: 'Cruiser, numbered',
  // Ivory hulls with each one's stripe, the wooden deck, sails edged in the Garden's ink.
  warm: 'Cruiser, warm',
} as const;
export type DinghyLook = keyof typeof DINGHY_LOOKS;
export type CatamaranLook = keyof typeof CATAMARAN_LOOKS;
export type BoatLook = { dinghy: DinghyLook; catamaran: CatamaranLook };
export const BOAT_LOOK: BoatLook = { dinghy: 'toy', catamaran: 'original' };
export const boatLook = (dinghy: string | null, catamaran: string | null): BoatLook => ({
  dinghy: dinghy && dinghy in DINGHY_LOOKS ? dinghy as DinghyLook : BOAT_LOOK.dinghy,
  catamaran: catamaran && catamaran in CATAMARAN_LOOKS ? catamaran as CatamaranLook : BOAT_LOOK.catamaran,
});
