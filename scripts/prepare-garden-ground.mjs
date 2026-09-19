// Offline asset recipe. Source downloads are cached outside public/.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { weld, simplify, reorder, prune } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = process.env.GARDEN_ASSET_CACHE || resolve(tmpdir(), 'wedding-ground-sources');
const output = resolve(root, 'public/models/garden/ground');
await mkdir(output, { recursive: true });
async function download(url, path) {
  try { await access(path); return; } catch {}
  await mkdir(dirname(path), { recursive: true });
  execFileSync('curl', ['-fsSL', '--retry', '2', '--max-time', '90', url, '-o', path]);
}
for (const name of ['leafy_grass', 'rock_moss_set_01']) {
  const metadata = resolve(cache, name + '.json');
  await download(`https://api.polyhaven.com/files/${name}`, metadata);
  const files = JSON.parse(await readFile(metadata, 'utf8'));
  for (const kind of ['Diffuse', 'nor_gl', 'arm']) await download(files[kind]['1k'].jpg.url, resolve(cache, name, kind + '.jpg'));
  if (name === 'rock_moss_set_01') {
    const model = files.gltf['1k'].gltf;
    await download(model.url, resolve(cache, name, 'source.gltf'));
    for (const [path, file] of Object.entries(model.include)) await download(file.url, resolve(cache, name, path));
  }
  for (const [source, target] of [['Diffuse', 'color'], ['nor_gl', 'normal'], ['arm', 'arm']]) {
    const image = sharp(resolve(cache, name, source + '.jpg')).resize(1024, 1024);
    await image.webp({ quality: target === 'normal' ? 95 : 88 }).toFile(resolve(output, `${name}-${target}.webp`));
  }
}
await download('https://ambientcg.com/get?file=Grass007_1K-JPG.zip', resolve(cache, 'Grass007.zip'));
execFileSync('unzip', ['-oq', resolve(cache, 'Grass007.zip'), '-d', resolve(cache, 'Grass007')]);
const meadow = resolve(cache, 'Grass007/Grass007_1K-JPG_');
for (const [source, target] of [['Color', 'color'], ['NormalGL', 'normal']]) {
  await sharp(meadow + source + '.jpg').resize(1024, 1024).webp({ quality: target === 'normal' ? 95 : 88 })
    .toFile(resolve(output, `grass007-${target}.webp`));
}
const ao = await sharp(meadow + 'AmbientOcclusion.jpg').resize(1024, 1024).greyscale().raw().toBuffer();
const rough = await sharp(meadow + 'Roughness.jpg').resize(1024, 1024).greyscale().raw().toBuffer();
const arm = Buffer.alloc(1024 * 1024 * 3);
for (let i = 0; i < ao.length; i++) { arm[i * 3] = ao[i]; arm[i * 3 + 1] = rough[i]; }
await sharp(arm, { raw: { width: 1024, height: 1024, channels: 3 } }).webp({ quality: 88 })
  .toFile(resolve(output, 'grass007-arm.webp'));

// Three complementary rock silhouettes, normalized to a 2-unit footprint and
// grounded at y=0. Keep source UVs/normals for the shared baked texture atlas.
const source = await new NodeIO().read(resolve(cache, 'rock_moss_set_01/source.gltf'));
const nodes = source.getRoot().listNodes().filter(n => n.getMesh());
const scene = new THREE.Group();
for (const [variant, sourceIndex] of [0, 2, 4].entries()) {
  const node = nodes[sourceIndex], primitive = node.getMesh().listPrimitives()[0];
  const geometry = new THREE.BufferGeometry();
  for (const [semantic, attribute] of [['POSITION', 'position'], ['NORMAL', 'normal'], ['TEXCOORD_0', 'uv']]) {
    const accessor = primitive.getAttribute(semantic);
    geometry.setAttribute(attribute, new THREE.BufferAttribute(accessor.getArray().slice(), accessor.getElementSize()));
  }
  geometry.setIndex(new THREE.BufferAttribute(primitive.getIndices().getArray().slice(), 1));
  geometry.applyMatrix4(new THREE.Matrix4().fromArray(node.getWorldMatrix()));
  geometry.computeBoundingBox();
  const box = geometry.boundingBox, size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
  geometry.translate(-centre.x, -box.min.y, -centre.z);
  geometry.scale(...Array(3).fill(2 / Math.max(size.x, size.z)));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.name = `rock-${variant + 1}`; scene.add(mesh);
}
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
};
await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const document = await io.readBinary(new Uint8Array(await new GLTFExporter().parseAsync(scene, { binary: true })));
await document.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: .04, error: .025 }), prune({ keepAttributes: true }), reorder({ encoder: MeshoptEncoder, target: 'size' }));
document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await io.write(resolve(output, 'moss-rocks.glb'), document);
for (const node of document.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (mesh) console.log(node.getName(), mesh.listPrimitives().reduce((n, p) => n + p.getIndices().getCount() / 3, 0), 'triangles');
}
scene.traverse(mesh => { if (mesh.isMesh) { mesh.geometry.dispose(); mesh.material.dispose(); } });
await writeFile(resolve(output, 'sources.json'), JSON.stringify({
  leafy_grass: { author: 'Charlotte Baglioni', url: 'https://polyhaven.com/a/leafy_grass', license: 'CC0', tileMetres: 2 },
  grass007: { author: 'ambientCG / Lennart Demes', url: 'https://ambientcg.com/view?id=Grass007', license: 'CC0' },
  rock_moss_set_01: { author: 'Kless Gyzen', url: 'https://polyhaven.com/a/rock_moss_set_01', license: 'CC0', nodes: [1, 3, 5] },
  preparation: { mapSize: 1024, normal: 'OpenGL', packed: 'R=AO G=roughness B=metalness', simplifyRatio: .04, simplifyError: .025 }
}, null, 2) + '\n');
