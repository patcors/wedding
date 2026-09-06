import * as THREE from 'three';

/** Apply matching, aspect-correct tiling to every rope surface map. */
export function configureRopeTextures(
  textures: THREE.Texture[],
  colorMap: THREE.Texture,
  mode: 'tube' | 'laid',
  yarn: number,
  anisotropy: number,
) {
  for (const texture of textures) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    if (mode === 'tube') texture.repeat.set(120, 1);
    else texture.repeat.set(yarn, yarn);
    texture.anisotropy = anisotropy;
    texture.colorSpace = texture === colorMap ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    // useTexture may already have uploaded this map with clamped sampling.
    // Refresh the GPU sampler, otherwise UVs beyond the first tile smear its edge.
    texture.needsUpdate = true;
  }
}
