// Offline asset recipe: stores the Garden's tree models' positions and UVs as
// 16-bit integers (KHR_mesh_quantization) before meshopt, so they download
// about a third smaller. gardenModels.ts turns them back into the same
// world-unit floats as they load, so every part of the scene that reads
// them is unchanged; the difference is well under a thousandth of a unit.
// The leaf centres stay as floats (they run outside what 16 bits can hold
// without a transform). Already-quantized files are left alone, so it is
// safe to re-run, e.g. after scripts/generate-garden-trees.mjs:
//   node scripts/quantize-garden-models.mjs
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { quantize, reorder } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const QUANTIZED_MODELS = ['ash-1', 'ash-2', 'ash-1-distant', 'ash-2-distant', 'old-tree', 'bush', 'ash-1-far', 'ash-2-far'];
const dir = fileURLToPath(new URL('../public/models/garden/', import.meta.url));
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
for (const name of QUANTIZED_MODELS) {
  const path = `${dir}${name}.glb`, source = await readFile(path);
  const document = await io.readBinary(new Uint8Array(source));
  if (document.getRoot().listExtensionsUsed().some(extension => extension.extensionName === 'KHR_mesh_quantization')) { console.log(`${name}: already quantized`); continue; }
  // One volume for the whole model, so branches and leaves share a transform.
  await document.transform(quantize({ quantizePosition: 16, quantizeTexcoord: 16, quantizeNormal: 8, quantizeGeneric: 16, quantizationVolume: 'scene' }),
    reorder({ encoder: MeshoptEncoder, target: 'size' }));
  document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const output = await io.writeBinary(document);
  await writeFile(path, output);
  console.log(`${name}: ${Math.round(source.byteLength / 1024)} KB → ${Math.round(output.byteLength / 1024)} KB`);
}
