// Reads a Garden model as the scene sees it: the tree models are stored
// quantized (scripts/quantize-garden-models.mjs), and gardenModels.ts turns
// them back into world-unit floats with no node transform as they load, so
// tests read them the same way.
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { clearNodeTransform, dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
const raw = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
export const treeIO = {
  raw,
  async read(path) {
    const document = await raw.read(path);
    await document.transform(dequantize());
    for (const node of document.getRoot().listNodes()) if (node.getMesh()) clearNodeTransform(node);
    return document;
  },
};
