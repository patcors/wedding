import manifest from './gardenAssets.generated.json';

export function gardenAsset(source: keyof typeof manifest) {
  return import.meta.env.BASE_URL + manifest[source];
}

export const memories = [
  { src: gardenAsset('photos/20191122_191734.jpg'), caption: 'The early days.', alt: 'Patrick and Amelia with a friend beside the harbour' },
  { src: gardenAsset('photos/IMG_5509.jpg'), caption: 'And then, this.', alt: 'Patrick and Amelia smiling together on a night out' },
  { src: gardenAsset('photos/IMG_7024.jpg'), caption: 'The first trip away.', alt: 'Patrick and Amelia with hot-air balloons in the sky behind them' },
  { src: gardenAsset('photos/944d7da37c56a0522ee21fd47b54a4b0.jpg'), caption: 'Dressed up, somewhere with a view.', alt: 'Patrick and Amelia dressed up together at sunset' },
  { src: gardenAsset('photos/IMG_0466.jpg'), caption: 'Us, being us.', alt: 'A playful close-up selfie of Patrick and Amelia' },
];

export const treeModels = (['models/garden/ash-1.glb', 'models/garden/ash-2.glb',
  'models/garden/ash-1-distant.glb', 'models/garden/ash-2-distant.glb'] as const).map(gardenAsset);
export const treeTextures = (['models/garden/bark-color.webp', 'models/garden/bark-normal.webp',
  'models/garden/bark-roughness.webp', 'models/garden/ash-leaves.webp',
  'models/garden/bark-color-dark.webp', 'models/garden/ash-leaves-dark.webp'] as const).map(gardenAsset);
export const groundTextures = [gardenAsset('textures/garden/ground-color.jpg'),
  gardenAsset('textures/garden/ground-normal.jpg'), gardenAsset('textures/garden/ground-roughness.jpg')];
export const waterTexture = gardenAsset('textures/garden/water-normal.jpg');
