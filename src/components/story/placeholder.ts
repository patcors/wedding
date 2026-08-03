import * as THREE from 'three';

/**
 * Grey-box assets, generated at runtime so the scaffold runs with no files.
 * Everything here gets deleted once real photographs and a real font arrive.
 */

const cache = new Map<string, THREE.Texture>();

/** A numbered placeholder standing in for a photograph. */
export function placeholderPhoto(label: string, seed = 0) {
  const key = `photo:${label}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const hue = (seed * 47) % 360;
  ctx.fillStyle = `hsl(${hue} 12% 74%)`;
  ctx.fillRect(0, 0, size, size);

  // Diagonal hatching, so it's obviously a placeholder rather than a bug.
  ctx.strokeStyle = `hsl(${hue} 14% 66%)`;
  ctx.lineWidth = 8;
  for (let x = -size; x < size * 2; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + size, size);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(30,28,26,0.82)';
  ctx.font = '600 40px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, size / 2, size / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

/**
 * Caption rendered to a canvas texture rather than real 3D text.
 *
 * Chosen so the scaffold is self-contained: troika (drei's <Text>) needs a font
 * file, and a DOM overlay via <Html> would not fade with the scene fog, which
 * breaks the depth read. Swap this for <Text> with a self-hosted font once you
 * have picked the typeface — see docs/GLOSSARY.md.
 */
export function captionTexture(text: string, width = 1024) {
  const key = `caption:${text}:${width}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const height = Math.round(width / 4);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(250,248,244,0.95)';
  ctx.font = `500 ${Math.round(height * 0.34)}px ui-serif, Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Naive wrap at two lines; real captions should be short anyway.
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > width * 0.9 && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  lines.push(line);

  const lh = height * 0.42;
  const top = height / 2 - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => ctx.fillText(l, width / 2, top + i * lh));

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

/**
 * Soft round sprite for the dust motes. Without an alpha map, three.js draws
 * points as hard squares, which is glaringly obvious on the ones nearest the
 * camera.
 */
export function softDot(size = 64) {
  const key = `softdot:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  cache.set(key, tex);
  return tex;
}

/** Stand-in for the rope fibre normal map until a real one is authored. */
export function proceduralRopeNormal(size = 256) {
  const key = `ropenormal:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);

  // Diagonal twisted-fibre ridges, encoded as a tangent-space normal map.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const s = Math.sin(((x + y * 2.2) / size) * Math.PI * 2 * 9);
      const nx = s * 0.6;
      img.data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      img.data[i + 1] = 128;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(260, 3);
  cache.set(key, tex);
  return tex;
}
