// Author with EZ-Tree offline: visitors download only the selected geometry/maps.
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'public/models/garden');
const packageRoot = resolve(dirname(fileURLToPath(import.meta.resolve('@dgreenheck/ez-tree'))), '..');
await mkdir(output, { recursive: true });

// EZ-Tree eagerly loads its browser textures. Geometry authoring only needs
// placeholders; export the chosen maps separately below, shared by every tree.
const loadTexture = THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
let Tree;
try {
  ({ Tree } = await import('@dgreenheck/ez-tree'));
} finally {
  THREE.TextureLoader.prototype.load = loadTexture;
}
// GLTFExporter uses this browser API to assemble its binary output.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); });
  }
};

const preset = JSON.parse(await readFile(resolve(packageRoot, 'src/lib/presets/ash_medium.json'), 'utf8'));
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
// Scales a generated tree into garden units and writes its branches and
// leaves (or only its branches) as one compressed GLB.
async function writeTree(tree, name, { scale = .20, leaves = true } = {}) {
  const scene = new THREE.Group();
  for (const [part, mesh] of [['branches', tree.branchesMesh], ...leaves ? [['leaves', tree.leavesMesh]] : []]) {
    const geometry = mesh.geometry;
    geometry.scale(scale, scale, scale);
    if (geometry.attributes.position.count > 65535) throw new Error('EZ-Tree Uint16 index limit exceeded');
    // Preserve a centre per leaf card for coherent wind without stretching it.
    if (part === 'leaves') {
      const positions = geometry.attributes.position;
      const centres = new Float32Array(positions.count * 3);
      for (let i = 0; i < positions.count; i += 4) {
        const centre = new THREE.Vector3();
        for (let j = 0; j < 4; j++) centre.add(new THREE.Vector3().fromBufferAttribute(positions, i + j));
        centre.multiplyScalar(.25);
        for (let j = 0; j < 4; j++) centre.toArray(centres, (i + j) * 3);
      }
      geometry.setAttribute('_leafcentre', new THREE.BufferAttribute(centres, 3));
    }
    mesh.material.dispose();
    const exported = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ name: part }));
    exported.name = part;
    scene.add(exported);
  }
  const binary = await new GLTFExporter().parseAsync(scene, { binary: true });
  const document = await io.readBinary(new Uint8Array(binary));
  await document.transform(dedup(), reorder({ encoder: MeshoptEncoder, target: 'size' }));
  // FILTER retains world-unit vertex positions, including leaf centres, so
  // meshes can be instanced directly without quantization node transforms.
  // (Guests' copies are then quantized by scripts/quantize-garden-models.mjs,
  // which gardenModels.ts undoes as they load: run it after this.)
  document.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  const compressed = await io.writeBinary(document);
  await writeFile(resolve(output, name), compressed);
  console.log(`${name}: ${compressed.byteLength} bytes, ${scene.children.reduce((n, m) => n + m.geometry.index.count / 3, 0)} triangles`);
  scene.traverse(mesh => { if (mesh.isMesh) { mesh.geometry.dispose(); mesh.material.dispose(); } });
}

// Collapses branch faces, keeping the silhouette. Vertices split along UV
// seams are welded first, so the tubes simplify without opening cracks.
function simplifyBranches(geometry, ratio) {
  const positions = geometry.attributes.position.array;
  const remap = MeshoptSimplifier.generatePositionRemap(new Float32Array(positions), 3);
  const indices = Uint32Array.from(geometry.index.array, index => remap[index]);
  const [simplified] = MeshoptSimplifier.simplify(indices, new Float32Array(positions), 3,
    Math.floor(indices.length * ratio / 3) * 3, .02);
  geometry.setIndex(new THREE.BufferAttribute(Uint16Array.from(simplified), 1));
}

for (const [variant, seed] of [36330, 83712].entries()) {
  // Detailed trees for the foreground, distant ones for the groves, and far
  // ones for stretches of river deep in the mist.
  for (const lod of ['', '-distant', '-far']) {
    const distant = lod !== '';
    const tree = new Tree();
    tree.options.copy(preset);
    tree.options.seed = seed;
    tree.options.bark.textured = false;
    tree.options.branch.start[1] = .48;
    tree.options.branch.angle[1] = 53;
    tree.options.branch.length[1] = 20;
    tree.options.branch.length[2] = 8;
    tree.options.leaves.size = distant ? 4.2 : 2.7;
    if (distant) {
      tree.options.leaves.count = 6;
      tree.options.leaves.billboard = 'single';
      tree.options.branch.sections = { 0: 8, 1: 5, 2: 3, 3: 2 };
      tree.options.branch.segments = { 0: 7, 1: 4, 2: 3, 3: 3 };
    }
    tree.generate();
    // The far tree is the distant one's branches, simplified, so the grove
    // looks the same when a stretch of river switches between them. It keeps
    // the distant tree's leaves.
    if (lod === '-far') simplifyBranches(tree.branchesMesh.geometry, .3);
    await writeTree(tree, `ash-${variant + 1}${lod}.glb`, { leaves: lod !== '-far' });
  }
}

// The old tree at Jasper's Berry, where the boats dock: the same ash bark and
// leaves as the garden, grown as a broad old tree. A short, thick trunk splits
// low into long limbs that reach out nearly level and droop at their ends, so
// the crown is far wider than it is tall.
{
  const tree = new Tree();
  tree.options.copy(preset);
  tree.options.seed = 51871;
  tree.options.bark.textured = false;
  Object.assign(tree.options.branch, {
    levels: 3,
    angle: { 1: 64, 2: 48, 3: 50 },
    children: { 0: 7, 1: 6, 2: 4 },
    force: { direction: { x: 0, y: 1, z: 0 }, strength: -.015 },
    gnarliness: { 0: .1, 1: .22, 2: .2, 3: .1 },
    length: { 0: 30, 1: 46, 2: 22, 3: 8 },
    radius: { 0: 6, 1: .62, 2: .7, 3: .7 },
    sections: { 0: 14, 1: 10, 2: 6, 3: 4 },
    segments: { 0: 16, 1: 8, 2: 5, 3: 3 },
    start: { 1: .42, 2: .2, 3: 0 },
    taper: { 0: .75, 1: .6, 2: .7, 3: .7 },
    twist: { 0: .2, 1: -.1, 2: 0, 3: 0 },
  });
  Object.assign(tree.options.leaves, { count: 11, size: 3.6, sizeVariance: .6, angle: 40, start: .1 });
  tree.generate();
  await writeTree(tree, 'old-tree.glb');
}

// A low, leafy shrub in the same ash leaves, for the island's crown and the
// understorey of the stand that hides the old tree.
{
  const tree = new Tree();
  tree.options.copy(JSON.parse(await readFile(resolve(packageRoot, 'src/lib/presets/bush_1.json'), 'utf8')));
  tree.options.bark.textured = false;
  tree.options.branch.sections = { 0: 4, 1: 4, 2: 5, 3: 4 };
  tree.options.leaves.count = 9;
  tree.options.leaves.size = 3;
  tree.generate();
  await writeTree(tree, 'bush.glb');
}

for (const [source, target, size] of [
  ['bark/oak_color_1k.jpg', 'bark-color.webp', 1024],
  ['bark/oak_normal_1k.jpg', 'bark-normal.webp', 1024],
  ['bark/oak_roughness_1k.jpg', 'bark-roughness.webp', 512],
  ['leaves/ash_color.png', 'ash-leaves.webp', 512],
]) {
  let texture = sharp(resolve(packageRoot, 'src/lib/assets', source)).resize(size, size);
  if (target === 'bark-color.webp' || target === 'ash-leaves.webp') {
    texture = texture.modulate({ saturation: .60, brightness: 1.10 });
    // Retain the earlier dark palette for an immediate UI comparison.
    await texture.clone().webp({ quality: 90, alphaQuality: 100 })
      .toFile(resolve(output, target.replace('.webp', '-dark.webp')));
    // Bring the texture midtones towards the original pale wood/sage palette
    // while retaining darker bark grooves and the leaf silhouettes.
    texture = target === 'bark-color.webp' ? texture.linear(.65, 105) : texture.linear(.70, 55);
  }
  await texture.webp({ quality: 90, alphaQuality: 100 }).toFile(resolve(output, target));
}
await copyFile(resolve(packageRoot, 'LICENSE'), resolve(output, 'EZ-TREE-LICENSE.txt'));
