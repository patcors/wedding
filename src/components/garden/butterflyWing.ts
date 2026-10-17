// The butterfly's artwork in its 100 × 100 viewBox, shared by the page's
// butterflies (ButterflyArtwork) and the 3D ones that circle the boats
// (eggs/datingButterflyGeometry.ts). The wing is the left one; the right mirrors it.
export const WING = {
  forewing: { edge: 'M49 49C39 27 18 6 5 10C0 21 7 43 16 51L49 58Z', fill: 'M47 48C35 27 17 15 10 16C10 29 16 41 23 47L45 54Z' },
  hindwing: { edge: 'M49 54L22 48C8 56 12 73 21 77L24 91L30 78C39 82 47 68 49 57Z', fill: 'M45 56L24 52C17 59 19 69 26 72L29 80L33 72C39 73 44 65 45 56Z' },
  veins: 'M46 51L17 26M44 49L25 22M44 57L25 65M43 60L32 72',
  spots: 'M16 57L18 60M18 66L20 68M35 74L37 72',
  // The gradient runs from the body out to the wingtip.
  gradient: { from: [49, 58], to: [15, 20], stops: [0, .45, .78, 1] },
  edgeColour: '#101923', veinColour: '#092b46', spotColour: '#b4dcde',
} as const;
