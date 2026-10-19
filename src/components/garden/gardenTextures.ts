// The Garden's textures, decoded off the main thread as ImageBitmaps. drei's
// useTexture loads <img> elements, which the browser decodes on the main thread
// at upload: about 75ms per map on a mid-range phone, frozen in one go while
// the scene first commits. A bitmap uploads in a few milliseconds.
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { PHONE_SCREEN, TEXTURE_WEIGHT, textureUrl } from './loadChoices.ts';

// The same cutoff as three's GLTFLoader: Safari before 17 mishandles
// createImageBitmap's options, so it keeps the <img> loader.
const safari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  ? Number(navigator.userAgent.match(/Version\/(\d+)/)?.[1] ?? 0) : Infinity;
const bitmaps = typeof createImageBitmap !== 'undefined' && safari >= 17;

// A bitmap's orientation is fixed when it is decoded; three ignores flipY on
// upload. So each orientation is its own loader, and its own cache entry.
function textureLoader(flipY: boolean) {
  return class extends THREE.Loader<THREE.Texture> {
    load(url: string, onLoad: (texture: THREE.Texture) => void, onProgress?: (event: ProgressEvent) => void, onError?: (error: unknown) => void) {
      if (!bitmaps) {
        new THREE.TextureLoader(this.manager).load(url, texture => { texture.flipY = flipY; onLoad(texture); }, onProgress, onError);
        return;
      }
      new THREE.ImageBitmapLoader(this.manager)
        .setOptions(flipY ? { imageOrientation: 'flipY', premultiplyAlpha: 'none' } : { premultiplyAlpha: 'none' })
        .load(url, bitmap => {
          const texture = new THREE.Texture(bitmap);
          texture.flipY = false;
          texture.needsUpdate = true;
          onLoad(texture);
        }, onProgress, onError);
    }
  };
}
const FlippedTextureLoader = textureLoader(true), TextureLoader = textureLoader(false);

// Callers name the original maps; guests get their light copies (loadChoices.ts).
const sources = (urls: string[]) => urls.map(url => textureUrl(url, import.meta.env.BASE_URL, TEXTURE_WEIGHT, PHONE_SCREEN));

// Suspends like drei's useTexture. Not a React hook, so it may be called
// conditionally. flipY matches three's TextureLoader default.
export function useGardenTextures(urls: string[], { flipY = true } = {}) {
  return useLoader(flipY ? FlippedTextureLoader : TextureLoader, sources(urls)) as THREE.Texture[];
}
// Starts the same download without suspending.
export function preloadGardenTextures(urls: string[], { flipY = true } = {}) {
  useLoader.preload(flipY ? FlippedTextureLoader : TextureLoader, sources(urls));
}
