// The tree models are stored quantized (scripts/quantize-garden-models.mjs):
// positions and UVs as 16-bit integers, with each mesh's node carrying the
// scale and offset back to world units, so they download a third smaller.
// Everything in the scene instances or reads their geometry directly, so as
// they load each mesh is turned back into world-unit floats with no node
// transform, as the models were before. Normals stay as stored (8-bit, as
// they always were). Safe to call again on the same model.
import * as THREE from 'three';

const point = new THREE.Vector3(), IDENTITY = new THREE.Quaternion();
export function dequantizeModel<T extends { scene: THREE.Object3D }>(model: T) {
  if (model.scene.userData.gardenDequantized) return model;
  model.scene.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry, position = geometry.getAttribute('position');
    if (!position || position.array instanceof Float32Array && !position.normalized) return;
    mesh.updateMatrix();
    const floats = new Float32Array(position.count * 3);
    const { array } = position, stride = (position as THREE.BufferAttribute).itemSize;
    if (array instanceof Int16Array && position.normalized && stride === 3 && !(position as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute
      && mesh.quaternion.equals(IDENTITY) && mesh.scale.x === mesh.scale.y && mesh.scale.y === mesh.scale.z) {
      // The quantizer's own transform, a uniform scale and an offset: straight off the integers.
      const k = mesh.scale.x, [x, y, z] = mesh.position.toArray();
      for (let i = 0; i < array.length; i += 3) {
        floats[i] = Math.max(array[i] / 32767, -1) * k + x;
        floats[i + 1] = Math.max(array[i + 1] / 32767, -1) * k + y;
        floats[i + 2] = Math.max(array[i + 2] / 32767, -1) * k + z;
      }
    } else for (let i = 0; i < position.count; i++) point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrix).toArray(floats, i * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(floats, 3));
    const uv = geometry.getAttribute('uv');
    if (uv && !(uv.array instanceof Float32Array)) {
      const plain = new Float32Array(uv.count * 2);
      if (uv.array instanceof Uint16Array && uv.normalized && uv.itemSize === 2 && !(uv as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute)
        for (let i = 0; i < plain.length; i++) plain[i] = uv.array[i] / 65535;
      else for (let i = 0; i < uv.count; i++) { plain[i * 2] = uv.getX(i); plain[i * 2 + 1] = uv.getY(i); }
      geometry.setAttribute('uv', new THREE.BufferAttribute(plain, 2));
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    mesh.position.set(0, 0, 0); mesh.quaternion.identity(); mesh.scale.set(1, 1, 1);
    mesh.updateMatrix();
  });
  model.scene.userData.gardenDequantized = true;
  model.scene.updateMatrixWorld(true);
  return model;
}
