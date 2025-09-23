// src/js/export-worker.js — Incremental, zero-copy GLB export builder (three@0.157)
import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';
import { GLTFExporter } from 'https://unpkg.com/three@0.157.0/examples/jsm/exporters/GLTFExporter.js';

let group = null;
let expectedCount = 0;
let receivedCount = 0;
let aborted = false;

function makeMaterial(m) {
  // Minimal PBR material (keeps file light; textures can be added later if needed)
  const mat = new THREE.MeshStandardMaterial({
    color: (m && typeof m.color === 'number') ? new THREE.Color(m.color) : new THREE.Color(0xffffff),
    metalness: (m && typeof m.metalness === 'number') ? m.metalness : 0.0,
    roughness: (m && typeof m.roughness === 'number') ? m.roughness : 0.9,
    transparent: !!(m && m.transparent),
    opacity: (m && typeof m.opacity === 'number') ? m.opacity : 1.0,
    side: (m && m.doubleSided) ? THREE.DoubleSide : THREE.FrontSide,
    name: (m && m.name) || 'Material'
  });
  return mat;
}

function bufferAttr(desc) {
  if (!desc || !desc.buffer) return null;
  const ctor = globalThis[desc.arrayType] || Float32Array;
  const array = new ctor(desc.buffer);
  return new THREE.BufferAttribute(array, desc.itemSize, !!desc.normalized);
}

function rebuildGeometry(gd) {
  const geo = new THREE.BufferGeometry();
  if (gd.attributes) {
    for (const key of Object.keys(gd.attributes)) {
      const attr = bufferAttr(gd.attributes[key]);
      if (attr) geo.setAttribute(key, attr);
    }
  }
  if (gd.index && gd.index.buffer) {
    const idxCtor = globalThis[gd.index.arrayType] || Uint32Array;
    const idx = new idxCtor(gd.index.buffer);
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  if (gd.groups && gd.groups.length) {
    gd.groups.forEach(g => geo.addGroup(g.start, g.count, g.materialIndex || 0));
  }
  if (gd.boundingBox) {
    const bb = new THREE.Box3(
      new THREE.Vector3().fromArray(gd.boundingBox.min),
      new THREE.Vector3().fromArray(gd.boundingBox.max)
    );
    geo.boundingBox = bb;
  }
  return geo;
}

function rebuildBones(bonesDesc) {
  // Create Bones and wire hierarchy by parentIndex
  const bones = bonesDesc.map(b => {
    const bone = new THREE.Bone();
    bone.name = b.name || '';
    bone.matrix.fromArray(b.localMatrix);
    bone.matrix.decompose(bone.position, bone.quaternion, bone.scale);
    return bone;
  });
  bonesDesc.forEach((b, i) => {
    if (b.parentIndex !== -1 && bones[b.parentIndex]) {
      bones[b.parentIndex].add(bones[i]);
    }
  });
  // Find root (first with no parent)
  const rootIndex = bonesDesc.findIndex(b => b.parentIndex === -1) ?? 0;
  return { bones, root: bones[rootIndex] || bones[0] };
}

function addMesh(payload) {
  const geometry = rebuildGeometry(payload.geometry);
  const material = Array.isArray(payload.material)
    ? payload.material.map(m => makeMaterial(m))
    : makeMaterial(payload.material);

  let mesh;

  if (payload.type === 'SkinnedMesh') {
    // Rebuild skeleton
    const { bones, root } = rebuildBones(payload.skeleton.bones);

    const boneInverses = payload.skeleton.boneInverses?.map(m => {
      const mat = new THREE.Matrix4();
      mat.fromArray(m);
      return mat;
    }) || [];

    const skeleton = new THREE.Skeleton(bones, boneInverses.length ? boneInverses : undefined);

    mesh = new THREE.SkinnedMesh(geometry, material);
    // Attach bones under the mesh so exporter picks them up as a node tree
    mesh.add(root);
    mesh.bind(skeleton);

    // Respect provided bindMatrix if present
    if (payload.skeleton.bindMatrix) {
      const bindMatrix = new THREE.Matrix4().fromArray(payload.skeleton.bindMatrix);
      mesh.bind(skeleton, bindMatrix);
    }

  } else {
    mesh = new THREE.Mesh(geometry, material);
  }

  mesh.name = payload.name || '';
  if (payload.matrixWorld && payload.matrixWorld.length === 16) {
    mesh.matrix.fromArray(payload.matrixWorld);
    mesh.matrixAutoUpdate = false;
  }

  group.add(mesh);
}

self.onmessage = async (e) => {
  const { type } = e.data || {};
  if (type === 'begin') {
    aborted = false;
    receivedCount = 0;
    expectedCount = e.data.count || 0;
    group = new THREE.Group();
    self.postMessage({ type: 'ready' });
    return;
  }

  if (type === 'mesh') {
    if (aborted || !group) return;
    try {
      addMesh(e.data.payload);
      receivedCount++;
      if (receivedCount % 8 === 0 || receivedCount === expectedCount) {
        self.postMessage({ type: 'mesh:ok', received: receivedCount, total: expectedCount });
      }
    } catch (err) {
      self.postMessage({ type: 'error', message: 'Failed to add mesh: ' + (err?.message || err) });
    }
    return;
  }

  if (type === 'export') {
    if (aborted || !group) {
      self.postMessage({ type: 'error', message: 'Nothing to export.' });
      return;
    }
    try {
      const exporter = new GLTFExporter();
      exporter.parse(
        group,
        (glb) => {
          self.postMessage({ type: 'done', glb }, [glb]); // transfer
          group = null;
        },
        (err) => {
          self.postMessage({ type: 'error', message: 'GLTFExporter failed: ' + (err?.message || err) });
          group = null;
        },
        { binary: true }
      );
    } catch (err) {
      self.postMessage({ type: 'error', message: err?.message || String(err) });
      group = null;
    }
    return;
  }

  if (type === 'abort') {
    aborted = true;
    group = null;
    self.postMessage({ type: 'aborted' });
  }
};