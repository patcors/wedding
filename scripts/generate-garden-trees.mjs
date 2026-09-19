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
import { MeshoptEncoder } from 'meshoptimizer';

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
const io = new NodeIO().registerExtensions([EXTMeshoptCompression])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
for (const [variant, seed] of [36330, 83712].entries()) {
  for (const distant of [false, true]) {
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
    const scene = new THREE.Group();
    for (const [name, mesh] of [['branches', tree.branchesMesh], ['leaves', tree.leavesMesh]]) {
      const geometry = mesh.geometry;
      geometry.scale(.20, .20, .20);
      if (geometry.attributes.position.count > 65535) throw new Error('EZ-Tree Uint16 index limit exceeded');
      // Preserve a centre per leaf card for coherent wind without stretching it.
      if (name === 'leaves') {
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
      const exported = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ name }));
      exported.name = name;
      scene.add(exported);
    }
    const name = `ash-${variant + 1}${distant ? '-distant' : ''}.glb`;
    const binary = await new GLTFExporter().parseAsync(scene, { binary: true });
    const document = await io.readBinary(new Uint8Array(binary));
    await document.transform(dedup(), reorder({ encoder: MeshoptEncoder, target: 'size' }));
    // FILTER retains world-unit vertex positions, including leaf centres, so
    // meshes can be instanced directly without quantization node transforms.
    document.createExtension(EXTMeshoptCompression).setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
    const compressed = await io.writeBinary(document);
    await writeFile(resolve(output, name), compressed);
    console.log(`${name}: ${compressed.byteLength} bytes, ${scene.children.reduce((n, m) => n + m.geometry.index.count / 3, 0)} triangles`);
    scene.traverse(mesh => { if (mesh.isMesh) { mesh.geometry.dispose(); mesh.material.dispose(); } });
  }
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
